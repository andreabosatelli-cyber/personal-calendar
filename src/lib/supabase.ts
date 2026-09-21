import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Fallire rumorosamente in dev: senza queste due variabili l'auth non parte.
  // NB: qui va SOLO la anon key. La service_role key non tocca mai il client
  //     (vive nei Secrets della Edge Function) — vedi brief §4.
  throw new Error(
    'Mancano VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example in .env.local e compilale.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'personal-calendar-auth',
  },
})
