// Edge Function: google-sync
// Svuota `coda_google` (0013) scrivendo su Google Calendar. Una direzione sola:
// SmartCal e' la verita', Google e' lo specchio.
//
// La chiamano in due: il client subito dopo un salvataggio (ed e' quello che
// rende la cosa istantanea) e pg_cron ogni minuto (ed e' quello che la rende
// affidabile quando la scheda e' chiusa o la rete e' andata via).
//
// Non riceve parametri e non guarda chi la chiama: prende quello che trova in
// coda, che il trigger ha gia' filtrato per proprietario. Il contenuto da
// mandare lo rilegge dalla tabella al momento dell'invio, non dalla coda: cosi'
// cinque modifiche di fila diventano una chiamata sola con l'ultimo testo.
//
// Secrets richiesti: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const API = 'https://www.googleapis.com/calendar/v3/calendars'
const LOTTO = 60 // quanti elementi di coda per giro
const MAX_TENTATIVI = 5
// Quante chiamate a Google al massimo dentro una riconciliazione: oltre, la
// voce resta in coda e si continua al giro dopo. Gli eventi gia' allineati non
// contano, quindi il lavoro cala a ogni passata invece di ripetersi.
const MAX_RICONCILIA = 150

interface VoceCoda {
  id: number
  utente_id: string
  evento_id: string | null
  google_id: string | null
  azione: 'upsert' | 'delete'
  tentativi: number
}

interface RigaImportata {
  id: string
  id_esterno: string
  titolo: string
  descrizione: string | null
  luogo: string | null
  link_video: string | null
  inizio_utc: string
  fine_utc: string
  fuso_origine: string
  tutto_il_giorno: boolean
  google_id: string | null
}

interface RigaEvento {
  id: string
  titolo: string
  descrizione: string | null
  luogo: string | null
  link_video: string | null
  inizio_utc: string
  fine_utc: string
  fuso_origine: string
  tutto_il_giorno: boolean
  google_id: string | null
}

// Il corpo di un evento Google.
//
// Tutto-il-giorno: per convenzione di SmartCal inizio e fine sono mezzanotte
// UTC e la fine e' il giorno DOPO l'ultimo — che e' esattamente la fine
// esclusiva che si aspetta Google, quindi bastano le due date cosi' come sono.
//
// I promemoria li manda gia' SmartCal: lasciando quelli di default, ogni evento
// suonerebbe due volte.
function corpoGoogle(ev: RigaEvento) {
  const descrizione = [ev.descrizione, ev.link_video].filter(Boolean).join('\n\n')
  const base = {
    summary: ev.titolo,
    description: descrizione || undefined,
    location: ev.luogo ?? undefined,
    reminders: { useDefault: false, overrides: [] },
    // Il filo che lega la copia all'originale: serve a riconoscere, guardando
    // Google, che quell'evento arriva da qui.
    extendedProperties: { private: { smartcal: ev.id } },
  }
  if (ev.tutto_il_giorno) {
    return { ...base, start: { date: ev.inizio_utc.slice(0, 10) }, end: { date: ev.fine_utc.slice(0, 10) } }
  }
  return {
    ...base,
    start: { dateTime: ev.inizio_utc, timeZone: ev.fuso_origine },
    end: { dateTime: ev.fine_utc, timeZone: ev.fuso_origine },
  }
}

// L'id che un evento importato ha su Google. Deve essere sempre lo stesso a
// parita' di id_esterno, perche' e' l'unica cosa che sopravvive al cancella-e-
// riscrivi della sync ICS: e' cosi' che un evento distrutto e ricreato di qua
// resta lo stesso evento di la'. Google accetta id in base32hex (0-9, a-v), e
// l'esadecimale di uno SHA-256 ci sta dentro.
async function idDeterminato(utenteId: string, idEsterno: string): Promise<string> {
  const dati = new TextEncoder().encode(`${utenteId}|${idEsterno}`)
  const hash = await crypto.subtle.digest('SHA-256', dati)
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `sc${hex.slice(0, 40)}`
}

// L'impronta di quello che abbiamo mandato: se non cambia, non c'e' niente da
// richiedere a Google.
async function impronta(corpo: unknown): Promise<string> {
  const dati = new TextEncoder().encode(JSON.stringify(corpo))
  const hash = await crypto.subtle.digest('SHA-256', dati)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

// Il calendario dedicato. SmartCal scrive solo qui dentro: l'ambito
// `calendar.app.created` non da' accesso a nient'altro, quindi il calendario
// principale di Google resta intoccabile per costruzione, non per buona
// educazione. Su Google appare come un calendario a se', che si accende, si
// spegne e si colora per conto suo.
async function assicuraCalendario(
  db: SupabaseClient,
  utenteId: string,
  token: string,
  fuso: string,
): Promise<{ id: string; nome: string }> {
  const r = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      summary: 'SmartCal',
      description: 'Events mirrored from SmartCal. Edit them in SmartCal: changes made here are not sent back.',
      timeZone: fuso,
    }),
  })
  const dati = await r.json()
  if (!r.ok || !dati.id) {
    throw new Error(`could not create the SmartCal calendar: ${dati.error?.message ?? r.status}`)
  }
  const id = dati.id as string
  const nome = (dati.summary as string) ?? 'SmartCal'
  await db.from('google_account').update({ calendario_id: id, calendario_nome: nome }).eq('utente_id', utenteId)
  return { id, nome }
}

// Un access token dura un'ora: si ricava dal refresh token a ogni giro invece
// di tenerlo da parte, che per un lotto di sessanta elementi e' una chiamata in
// piu' e un pezzo di stato in meno.
async function accessToken(refresh: string, id: string, secret: string): Promise<string> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refresh,
      client_id: id,
      client_secret: secret,
      grant_type: 'refresh_token',
    }),
  })
  const j = await r.json()
  if (!r.ok || !j.access_token) {
    throw new Error(`${j.error ?? 'token'}: ${j.error_description ?? 'could not refresh the Google token'}`)
  }
  return j.access_token as string
}

async function chiamaGoogle(
  token: string,
  calendario: string,
  metodo: 'POST' | 'PATCH' | 'DELETE',
  idEvento: string | null,
  corpo?: unknown,
): Promise<{ ok: boolean; stato: number; dati: Record<string, unknown> }> {
  const url = `${API}/${encodeURIComponent(calendario)}/events${idEvento ? `/${encodeURIComponent(idEvento)}` : ''}`
  const r = await fetch(url, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  // Una DELETE riuscita non restituisce nulla da leggere.
  const dati = r.status === 204 ? {} : await r.json().catch(() => ({}))
  return { ok: r.ok, stato: r.status, dati }
}

// La riconciliazione degli eventi IMPORTATI.
//
// Non si insegue la singola riga perche' la sync ICS le distrugge tutte a ogni
// giro: si confronta quello che c'e' adesso con quello che risulta gia' mandato
// (`google_importati`). Chi non e' cambiato non costa niente, chi e' sparito dal
// feed sparisce anche di la'.
async function riconcilia(
  db: SupabaseClient,
  utenteId: string,
  token: string,
  calendario: string,
): Promise<{ fatto: boolean; parziale?: boolean; errore?: string }> {
  // Cosa c'e' da mandare: gli importati da oggi in avanti.
  const { data: futuri, error: e1 } = await db
    .from('eventi')
    .select('id, id_esterno, titolo, descrizione, luogo, link_video, inizio_utc, fine_utc, fuso_origine, tutto_il_giorno, google_id')
    .eq('utente_id', utenteId)
    .not('id_esterno', 'is', null)
    .eq('stato', 'confermato')
    .gte('fine_utc', new Date().toISOString())
    .order('inizio_utc', { ascending: true })
  if (e1) return { fatto: false, errore: e1.message }

  // Cosa esiste ancora, a qualsiasi data. Serve per le cancellazioni: un evento
  // diventato passato non e' un evento sparito, e non va tolto da Google.
  const { data: tutti, error: e2 } = await db
    .from('eventi')
    .select('id_esterno')
    .eq('utente_id', utenteId)
    .not('id_esterno', 'is', null)
  if (e2) return { fatto: false, errore: e2.message }
  const vivi = new Set((tutti as { id_esterno: string }[]).map((r) => r.id_esterno))

  const { data: mandati } = await db
    .from('google_importati')
    .select('id_esterno, google_id, impronta')
    .eq('utente_id', utenteId)
  const gia = new Map(
    ((mandati as { id_esterno: string; google_id: string; impronta: string }[]) ?? []).map((r) => [r.id_esterno, r]),
  )

  let chiamate = 0

  for (const ev of (futuri as RigaImportata[]) ?? []) {
    if (chiamate >= MAX_RICONCILIA) return { fatto: false, parziale: true }

    const corpo = corpoGoogle(ev)
    const firma = await impronta(corpo)
    const prec = gia.get(ev.id_esterno)
    // Identico a quello che abbiamo gia' mandato: nessuna chiamata.
    if (prec && prec.impronta === firma) continue

    const gid = prec?.google_id ?? (await idDeterminato(utenteId, ev.id_esterno))
    let idFinale: string | null = null

    const patch = await chiamaGoogle(token, calendario, 'PATCH', gid, corpo)
    chiamate++
    if (patch.ok) {
      idFinale = gid
    } else if (patch.stato === 404 || patch.stato === 410) {
      // Non c'e' ancora (o e' stato tolto a mano): lo si crea con l'id
      // deterministico, cosi' due giri sovrapposti non fanno due eventi.
      const creato = await chiamaGoogle(token, calendario, 'POST', null, { ...corpo, id: gid })
      chiamate++
      if (creato.ok) {
        idFinale = gid
      } else if (creato.stato === 409) {
        // Id gia' usato da un evento che Google non lascia riscrivere: si
        // ricomincia da capo con un id suo.
        const alt = await chiamaGoogle(token, calendario, 'POST', null, corpo)
        chiamate++
        if (!alt.ok) return { fatto: false, errore: `import insert ${alt.stato}` }
        idFinale = (alt.dati.id as string) ?? null
      } else {
        return { fatto: false, errore: `import insert ${creato.stato}` }
      }
    } else {
      return { fatto: false, errore: `import patch ${patch.stato}` }
    }

    if (!idFinale) continue
    await db.from('google_importati').upsert(
      { utente_id: utenteId, id_esterno: ev.id_esterno, google_id: idFinale, impronta: firma, visto_il: new Date().toISOString() },
      { onConflict: 'utente_id,id_esterno' },
    )
  }

  // Sparito dal feed: va tolto anche di la'.
  for (const [idEsterno, riga] of gia) {
    if (vivi.has(idEsterno)) continue
    if (chiamate >= MAX_RICONCILIA) return { fatto: false, parziale: true }
    const r = await chiamaGoogle(token, calendario, 'DELETE', riga.google_id)
    chiamate++
    if (!r.ok && r.stato !== 404 && r.stato !== 410) return { fatto: false, errore: `import delete ${r.stato}` }
    await db.from('google_importati').delete().eq('utente_id', utenteId).eq('id_esterno', idEsterno)
  }

  return { fatto: true }
}

// Elabora una voce di coda. Torna true se e' stata sistemata (e la voce va
// tolta), false se va lasciata li' per il prossimo giro.
async function elabora(
  db: SupabaseClient,
  voce: VoceCoda,
  token: string,
  calendario: string,
): Promise<{ fatto: boolean; parziale?: boolean; errore?: string }> {
  if (voce.azione === 'reconcile') {
    return await riconcilia(db, voce.utente_id, token, calendario)
  }

  if (voce.azione === 'delete') {
    if (!voce.google_id) return { fatto: true }
    const r = await chiamaGoogle(token, calendario, 'DELETE', voce.google_id)
    // Gia' sparito di la' = niente da fare, non un errore.
    if (r.ok || r.stato === 404 || r.stato === 410) return { fatto: true }
    return { fatto: false, errore: `delete ${r.stato}` }
  }

  const { data } = await db
    .from('eventi')
    .select('id, titolo, descrizione, luogo, link_video, inizio_utc, fine_utc, fuso_origine, tutto_il_giorno, google_id')
    .eq('id', voce.evento_id!)
    .maybeSingle()
  // Cancellato nel frattempo: la sua riga di delete e' gia' in coda per conto
  // suo, qui non resta niente da mandare.
  if (!data) return { fatto: true }

  const ev = data as RigaEvento
  const corpo = corpoGoogle(ev)

  if (ev.google_id) {
    const r = await chiamaGoogle(token, calendario, 'PATCH', ev.google_id, corpo)
    if (r.ok) return { fatto: true }
    // Se di la' non c'e' piu' (cancellato a mano su Google), lo si ricrea.
    if (r.stato !== 404 && r.stato !== 410) return { fatto: false, errore: `patch ${r.stato}` }
  }

  const creato = await chiamaGoogle(token, calendario, 'POST', null, corpo)
  if (!creato.ok) return { fatto: false, errore: `insert ${creato.stato}` }

  const nuovoId = creato.dati.id as string | undefined
  if (nuovoId) {
    // Questa scrittura ripassa dal trigger, che la riconosce come "nessun campo
    // importante e' cambiato" e non riaccoda niente (0013).
    await db.from('eventi').update({ google_id: nuovoId }).eq('id', ev.id)
  }
  return { fatto: true }
}

Deno.serve(async () => {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  if (!clientId || !clientSecret) {
    return Response.json({ errore: 'Google non configurato' }, { status: 500 })
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: coda } = await db
    .from('coda_google')
    .select('id, utente_id, evento_id, google_id, azione, tentativi')
    .lt('tentativi', MAX_TENTATIVI)
    .order('id', { ascending: true })
    .limit(LOTTO)

  const voci = (coda as VoceCoda[]) ?? []
  if (!voci.length) return Response.json({ fatti: 0, falliti: 0 })

  // Una connessione a Google per utente, non per evento.
  const perUtente = new Map<string, VoceCoda[]>()
  for (const v of voci) {
    const l = perUtente.get(v.utente_id) ?? []
    l.push(v)
    perUtente.set(v.utente_id, l)
  }

  let fatti = 0
  let falliti = 0

  for (const [utenteId, lista] of perUtente) {
    const { data: acc } = await db
      .from('google_account')
      .select('refresh_token, calendario_id, abilitato')
      .eq('utente_id', utenteId)
      .maybeSingle()

    // Scollegato del tutto: quello che aveva in sospeso non ha piu' un posto
    // dove andare.
    if (!acc) {
      await db.from('coda_google').delete().in('id', lista.map((v) => v.id))
      continue
    }
    // In pausa (o fermato da un errore di credenziali): la coda si lascia dov'e'
    // senza consumare tentativi, e riprende da sola quando si riattiva.
    if (!acc.abilitato) continue

    let token: string
    try {
      token = await accessToken(acc.refresh_token as string, clientId, clientSecret)
    } catch (e) {
      // Consenso revocato dall'utente su Google, o credenziali cambiate: non e'
      // un errore da ritentare a vuoto ogni minuto. Si ferma e lo si dice.
      const messaggio = e instanceof Error ? e.message : 'token error'
      await db
        .from('google_account')
        .update({ abilitato: false, ultimo_errore: messaggio })
        .eq('utente_id', utenteId)
      falliti += lista.length
      continue
    }

    // Al primo giro il calendario non c'e' ancora: lo si crea e ci si scrive
    // l'id, cosi' esiste una volta sola per account.
    let calendario = acc.calendario_id as string | null
    if (!calendario) {
      try {
        const { data: pref } = await db
          .from('preferenze')
          .select('fuso_base')
          .eq('utente_id', utenteId)
          .maybeSingle()
        const creato = await assicuraCalendario(db, utenteId, token, (pref?.fuso_base as string) || 'UTC')
        calendario = creato.id
      } catch (e) {
        const messaggio = e instanceof Error ? e.message : 'calendar error'
        await db.from('google_account').update({ ultimo_errore: messaggio }).eq('utente_id', utenteId)
        falliti += lista.length
        continue
      }
    }

    let fallitiUtente = 0
    for (const voce of lista) {
      let esito: { fatto: boolean; parziale?: boolean; errore?: string }
      try {
        esito = await elabora(db, voce, token, calendario)
      } catch (e) {
        esito = { fatto: false, errore: e instanceof Error ? e.message : 'unexpected' }
      }

      // Riconciliazione arrivata a meta': non e' un errore, e non deve
      // consumare tentativi. La voce resta, e il giro dopo riparte da dove il
      // lavoro e' rimasto — che nel frattempo si e' accorciato.
      if (esito.parziale) continue

      if (esito.fatto) {
        await db.from('coda_google').delete().eq('id', voce.id)
        fatti++
      } else {
        await db
          .from('coda_google')
          .update({ tentativi: voce.tentativi + 1, errore: esito.errore ?? null })
          .eq('id', voce.id)
        falliti++
        fallitiUtente++
      }
    }

    await db
      .from('google_account')
      .update({
        ultimo_sync: new Date().toISOString(),
        ultimo_errore: fallitiUtente ? `${fallitiUtente} event(s) could not be synced` : null,
      })
      .eq('utente_id', utenteId)
  }

  return Response.json({ fatti, falliti })
})
