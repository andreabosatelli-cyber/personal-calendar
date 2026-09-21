// Edge Function: sync-calendari
// Full-replace della sorgente 'lavoro' dal feed ICS pubblicato di Outlook.
// Brief §5 + cambio di scope: SOLO 'lavoro'; fuso_origine costante 'Europe/Rome'.
//
// Invocata dal client (login / apertura app / pulsante Aggiorna). Legge l'utente
// dal JWT, espande le ricorrenze su [-1 mese, +11 mesi] rispettando EXDATE e le
// eccezioni RECURRENCE-ID, poi sostituisce atomicamente via RPC. Se il fetch ICS
// fallisce NON cancella nulla: registra l'errore in preferenze.ultimo_sync.
//
// Secret richiesto: ICS_LAVORO (URL del feed .ics). Mai esposto al client.
//
// Multi-utente: il feed appartiene all'owner, quindi la sync gira SOLO per gli
// account con preferenze.sync_abilitato = true. Vedi 0008_multiutente.sql.

import ICAL from 'npm:ical.js@2.2.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// fuso_origine costante: ignoriamo i nomi Windows del feed, l'istante UTC lo
// calcola comunque ical.js dai VTIMEZONE incorporati.
const FUSO_ORIGINE = 'Europe/Rome'
const ORIGINE = 'lavoro'

interface EventoOut {
  titolo: string
  descrizione: string | null
  luogo: string | null
  inizio_utc: string
  fine_utc: string
  fuso_origine: string
  tutto_il_giorno: boolean
  id_esterno: string
}

function espandiICS(raw: string): EventoOut[] {
  const comp = new ICAL.Component(ICAL.parse(raw))

  // Registra i VTIMEZONE incorporati (nomi Windows -> offset corretti).
  for (const vt of comp.getAllSubcomponents('vtimezone')) {
    const tz = new ICAL.Timezone(vt)
    if (!ICAL.TimezoneService.has(tz.tzid)) ICAL.TimezoneService.register(tz)
  }

  // Finestra: 1 mese fa -> 11 mesi avanti.
  const oggi = new Date()
  const inizioFinestra = ICAL.Time.fromJSDate(
    new Date(oggi.getFullYear(), oggi.getMonth() - 1, oggi.getDate()),
    false,
  )
  const fineFinestra = ICAL.Time.fromJSDate(
    new Date(oggi.getFullYear(), oggi.getMonth() + 11, oggi.getDate()),
    false,
  )

  const vevents = comp.getAllSubcomponents('vevent')

  // Aggancia le eccezioni RECURRENCE-ID ai rispettivi master.
  const eccezioni = new Map<string, ICAL.Event[]>()
  const master: ICAL.Event[] = []
  const singoli: ICAL.Event[] = []
  for (const ve of vevents) {
    const ev = new ICAL.Event(ve)
    if (ev.isRecurrenceException()) {
      const arr = eccezioni.get(ev.uid) ?? []
      arr.push(ev)
      eccezioni.set(ev.uid, arr)
    } else if (ev.isRecurring()) {
      master.push(ev)
    } else {
      singoli.push(ev)
    }
  }
  for (const m of master) {
    for (const e of eccezioni.get(m.uid) ?? []) m.relateException(e.component)
  }

  const out: EventoOut[] = []

  const annullato = (ev: ICAL.Event) =>
    String(ev.component.getFirstPropertyValue('status') ?? '').toUpperCase() === 'CANCELLED'

  const spingi = (
    startI: ICAL.Time,
    endI: ICAL.Time | null,
    titolo: string,
    descrizione: unknown,
    luogo: unknown,
    idEsterno: string,
  ) => {
    const tuttoGiorno = startI.isDate
    const inizio = startI.toJSDate().toISOString()
    const fine = (endI ?? startI).toJSDate().toISOString()
    out.push({
      titolo: titolo || '(senza titolo)',
      descrizione: descrizione ? String(descrizione) : null,
      luogo: luogo ? String(luogo) : null,
      inizio_utc: inizio,
      fine_utc: fine,
      fuso_origine: FUSO_ORIGINE,
      tutto_il_giorno: tuttoGiorno,
      id_esterno: idEsterno,
    })
  }

  // Eventi singoli nella finestra.
  for (const ev of singoli) {
    if (annullato(ev)) continue
    const s = ev.startDate
    if (s.compare(inizioFinestra) < 0 || s.compare(fineFinestra) > 0) continue
    spingi(s, ev.endDate, ev.summary, ev.description, ev.location, ev.uid)
  }

  // Ricorrenti: itera occorrenze nella finestra (EXDATE saltate in automatico).
  for (const m of master) {
    const it = m.iterator()
    let next: ICAL.Time | null
    let guard = 0
    while ((next = it.next()) && guard < 3000) {
      guard++
      if (next.compare(inizioFinestra) < 0) continue
      if (next.compare(fineFinestra) > 0) break
      const occ = m.getOccurrenceDetails(next)
      // Se l'occorrenza è un'eccezione annullata, saltala.
      if (occ.item && annullato(occ.item)) continue
      const idEsterno = `${m.uid}#${occ.recurrenceId ? occ.recurrenceId.toString() : next.toString()}`
      spingi(occ.startDate, occ.endDate, occ.item.summary, occ.item.description, occ.item.location, idEsterno)
    }
  }

  return out
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const urlSupabase = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!

  // Utente dal JWT del chiamante.
  const authHeader = req.headers.get('Authorization') ?? ''
  const clientUtente = createClient(urlSupabase, anon, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: erroreUtente,
  } = await clientUtente.auth.getUser()
  if (erroreUtente || !user) {
    return new Response(JSON.stringify({ errore: 'Non autenticato' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const service = createClient(urlSupabase, serviceRole)
  const quando = new Date().toISOString()

  // Il feed ICS di questo secret e' di UNA persona: importarlo nell'account di
  // chiunque chiami la funzione significherebbe riversare la sua agenda dentro
  // il calendario di un altro utente. La sync e' quindi un privilegio esplicito
  // (preferenze.sync_abilitato), falso per default alla registrazione: per
  // tutti gli altri account la funzione non fa nulla e non e' un errore.
  const { data: pref } = await service
    .from('preferenze')
    .select('sync_abilitato')
    .eq('utente_id', user.id)
    .single()
  if (!pref?.sync_abilitato) {
    return new Response(JSON.stringify({ ok: true, saltato: true, sorgenti: {} }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const icsUrl = Deno.env.get('ICS_LAVORO')
  if (!icsUrl) {
    return new Response(JSON.stringify({ errore: 'ICS_LAVORO non configurato' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const resp = await fetch(icsUrl)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const raw = await resp.text()
    const eventi = espandiICS(raw)
    console.log(`sync-calendari: espanse ${eventi.length} istanze per utente ${user.id}`)

    const { data, error } = await service.rpc('sostituisci_eventi_sorgente', {
      p_utente: user.id,
      p_origine: ORIGINE,
      p_eventi: eventi,
    })
    if (error) throw error

    return new Response(
      JSON.stringify({ ok: true, sorgenti: { [ORIGINE]: { conteggio: data ?? eventi.length, quando } } }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    // Fetch/parse fallito: NON cancelliamo nulla. Registriamo l'errore e basta.
    const messaggio = err instanceof Error ? err.message : String(err)
    console.error('sync-calendari: errore', messaggio)
    // Merge dell'errore in ultimo_sync senza toccare gli eventi.
    const { data: pref } = await service
      .from('preferenze')
      .select('ultimo_sync')
      .eq('utente_id', user.id)
      .single()
    const ultimo = (pref?.ultimo_sync ?? {}) as Record<string, unknown>
    ultimo[ORIGINE] = { ...(ultimo[ORIGINE] as object ?? {}), quando, errore: messaggio }
    await service.from('preferenze').update({ ultimo_sync: ultimo }).eq('utente_id', user.id)

    return new Response(
      JSON.stringify({ ok: false, sorgenti: { [ORIGINE]: { errore: messaggio, quando } } }),
      { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  }
})
