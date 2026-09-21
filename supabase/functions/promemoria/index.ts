// Edge Function: promemoria
// Manda le notifiche push per gli eventi che stanno per iniziare.
//
// Chi la chiama: pg_cron, ogni minuto, con la service_role key come Bearer
// (vedi 0011_cron_promemoria.sql). Non la chiama mai il browser.
//
// Cosa fa, in ordine:
//   1) chiede a promemoria_da_inviare() cosa e' maturato — una riga per
//      (evento, dispositivo), perche' lo stesso account puo' avere il telefono
//      e il portatile e l'avviso deve arrivare a tutti e due;
//   2) manda la push a ciascun dispositivo;
//   3) cancella le sottoscrizioni che il push service dichiara morte (404/410:
//      app disinstallata, permesso revocato, browser ripulito);
//   4) segna l'evento come avvisato, ma SOLO se almeno una push e' arrivata a
//      destinazione: se il push service ha avuto un problema suo, al minuto
//      dopo ci riproviamo invece di perdere l'avviso.
//
// Secrets richiesti: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT.
// La chiave privata VAPID vive solo qui: e' quella che firma le push, e con
// quella in mano chiunque potrebbe mandare notifiche a nome dell'app.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

interface Riga {
  evento_id: string
  titolo: string
  luogo: string | null
  inizio_utc: string
  fuso: string
  link_video: string | null
  endpoint: string
  p256dh: string
  auth: string
}

// "fra 12 minuti" / "fra poco": l'ora esatta e' gia' nel corpo, qui serve il
// colpo d'occhio.
function fraQuanto(inizio: string): string {
  const min = Math.round((new Date(inizio).getTime() - Date.now()) / 60000)
  if (min <= 1) return 'fra poco'
  if (min < 60) return `fra ${min} minuti`
  const h = Math.round(min / 60)
  return h === 1 ? 'fra un\'ora' : `fra ${h} ore`
}

function orario(inizio: string, fuso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: fuso,
    }).format(new Date(inizio))
  } catch {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(
      new Date(inizio),
    )
  }
}

Deno.serve(async () => {
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:andrea.bosatelli@gmail.com'

  if (!pub || !priv) {
    return Response.json({ errore: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY non configurate' }, { status: 500 })
  }
  webpush.setVapidDetails(subject, pub, priv)

  const db = createClient(url, serviceRole)
  const { data, error } = await db.rpc('promemoria_da_inviare')
  if (error) return Response.json({ errore: error.message }, { status: 500 })

  const righe = (data as Riga[]) ?? []
  if (!righe.length) return Response.json({ inviate: 0, eventi: 0 })

  const riuscite = new Set<string>()
  const morte: string[] = []
  let inviate = 0

  await Promise.all(
    righe.map(async (r) => {
      const payload = JSON.stringify({
        titolo: r.titolo,
        corpo: [fraQuanto(r.inizio_utc), orario(r.inizio_utc, r.fuso), r.luogo].filter(Boolean).join(' · '),
        // Il tag fa sostituire l'avviso invece di impilarne due per lo stesso
        // evento, se per qualsiasi motivo ne partisse un secondo.
        tag: `evento-${r.evento_id}`,
        url: r.link_video ?? '/#/calendar',
      })
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload, {
          TTL: 600, // scaduto l'evento, una push in ritardo e' solo rumore
          urgency: 'high',
        })
        riuscite.add(r.evento_id)
        inviate++
      } catch (e) {
        const stato = (e as { statusCode?: number }).statusCode
        if (stato === 404 || stato === 410) morte.push(r.endpoint)
        else console.error('push fallita', stato, (e as Error).message)
      }
    }),
  )

  if (morte.length) await db.from('push_sottoscrizioni').delete().in('endpoint', morte)
  if (riuscite.size) {
    await db
      .from('eventi')
      .update({ promemoria_inviato_il: new Date().toISOString() })
      .in('id', [...riuscite])
  }
  if (inviate) {
    await db
      .from('push_sottoscrizioni')
      .update({ ultimo_uso: new Date().toISOString() })
      .in(
        'endpoint',
        righe.map((r) => r.endpoint).filter((e) => !morte.includes(e)),
      )
  }

  return Response.json({ inviate, eventi: riuscite.size, sottoscrizioni_rimosse: morte.length })
})
