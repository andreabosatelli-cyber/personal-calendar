// Edge Function: google-oauth
// Il giro di consenso con Google, in due passaggi sulla stessa URL:
//
//   ?avvia=<nonce>          -> 302 alla schermata di consenso di Google
//   ?code=…&state=<nonce>   -> Google rimanda qui il browser: si scambia il
//                              codice con un refresh token e lo si mette via
//
// Il nonce e' il biglietto emesso dalla RPC `google_oauth_avvia` all'utente
// autenticato (0013): Google torna indietro su una URL pubblica, senza il JWT,
// e senza biglietto non ci sarebbe modo di sapere di chi e' il consenso.
//
// DEPLOY: questa funzione va pubblicata con --no-verify-jwt, perche' la
// chiamata di ritorno la fa il browser per conto di Google e non porta nessun
// Authorization. A tenere in piedi la sicurezza e' il nonce: monouso, valido
// dieci minuti, legato a un utente solo.
//
// Secrets richiesti: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI
// (l'URL di questa funzione, identico a quello registrato su Google Cloud).

import { createClient } from 'npm:@supabase/supabase-js@2'

// UN SOLO PERMESSO, e il piu' stretto che esista per questo mestiere:
// `calendar.app.created` permette di creare calendari secondari e di gestire
// gli eventi solo dentro quelli. Non da' accesso al calendario principale ne'
// a quelli che esistevano prima.
//
// Non e' solo igiene: Google lo classifica come ambito NON sensibile, e questo
// e' cio' che permette all'app di uscire dallo stato "Test" senza passare da
// una verifica. In stato "Test" il consenso scadrebbe ogni 7 giorni.
//
// Niente `userinfo.email`: sapere con che indirizzo ti sei collegato non vale
// un permesso in piu' da chiedere. In Settings si mostra il nome del
// calendario, che e' l'informazione che serve davvero.
const SCOPE = 'https://www.googleapis.com/auth/calendar.app.created'

// Dove si puo' tornare a fine giro. Il valore arriva dalla riga del nonce, che
// l'ha scritta l'utente autenticato: qui si controlla solo che sia un indirizzo
// http(s) sensato, per non trasformare la funzione in un rimbalzo aperto.
function ritornoValido(u: string | null): string | null {
  if (!u) return null
  try {
    const url = new URL(u)
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null
    return url.origin
  } catch {
    return null
  }
}

function paginaEsito(messaggio: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Google Calendar</title>
     <body style="font-family:system-ui;padding:40px;line-height:1.5">${messaggio}</body>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID')
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET')
  const redirectUri = Deno.env.get('GOOGLE_REDIRECT_URI')
  if (!clientId || !clientSecret || !redirectUri) {
    return paginaEsito('Google is not configured on the server (missing secrets).')
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // ---- Passo 1: manda l'utente da Google ------------------------------------
  const avvia = url.searchParams.get('avvia')
  if (avvia) {
    const { data: biglietto } = await db
      .from('google_oauth_stato')
      .select('nonce, scadenza')
      .eq('nonce', avvia)
      .maybeSingle()
    if (!biglietto || new Date(biglietto.scadenza) < new Date()) {
      return paginaEsito('This link has expired. Go back to SmartCal and try connecting again.')
    }

    const consenso = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    consenso.searchParams.set('client_id', clientId)
    consenso.searchParams.set('redirect_uri', redirectUri)
    consenso.searchParams.set('response_type', 'code')
    consenso.searchParams.set('scope', SCOPE)
    // offline + consent: senza questi due Google non rilascia il refresh token,
    // e senza refresh token la sync smetterebbe di funzionare dopo un'ora.
    consenso.searchParams.set('access_type', 'offline')
    consenso.searchParams.set('prompt', 'consent')
    consenso.searchParams.set('state', avvia)
    return Response.redirect(consenso.toString(), 302)
  }

  // ---- Passo 2: Google rimanda indietro il browser --------------------------
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const errore = url.searchParams.get('error')

  if (errore) return paginaEsito(`Google refused the connection: ${errore}. You can close this tab.`)
  if (!code || !state) return paginaEsito('Nothing to do here.')

  const { data: biglietto } = await db
    .from('google_oauth_stato')
    .select('nonce, utente_id, scadenza, ritorno')
    .eq('nonce', state)
    .maybeSingle()
  if (!biglietto || new Date(biglietto.scadenza) < new Date()) {
    return paginaEsito('This connection request has expired. Go back to SmartCal and try again.')
  }
  // Monouso: speso o no, il biglietto non vale una seconda volta.
  await db.from('google_oauth_stato').delete().eq('nonce', state)

  const risposta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })
  const token = await risposta.json()
  if (!risposta.ok || !token.refresh_token) {
    const dettaglio = token.error_description ?? token.error ?? 'no refresh token returned'
    return paginaEsito(`Could not complete the connection: ${dettaglio}`)
  }

  // Il calendario dedicato non si crea qui: lo crea `google-sync` al primo giro
  // (0014), che e' il posto dove si parla con l'API di Google.
  const { error } = await db.from('google_account').upsert(
    {
      utente_id: biglietto.utente_id,
      refresh_token: token.refresh_token,
      abilitato: true,
      ultimo_errore: null,
    },
    { onConflict: 'utente_id' },
  )
  if (error) return paginaEsito(`Could not save the connection: ${error.message}`)

  const origine = ritornoValido(biglietto.ritorno)
  if (!origine) return paginaEsito('Google Calendar is connected. You can close this tab.')
  return Response.redirect(`${origine}/?google=ok#/settings`, 302)
})
