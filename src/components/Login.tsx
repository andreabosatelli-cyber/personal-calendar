import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

// Gate di autenticazione email/password. Chiunque riceva il link puo'
// registrarsi: l'account nuovo parte vuoto e passa dall'onboarding.
export function Login() {
  const [modo, setModo] = useState<'accedi' | 'registrati'>('accedi')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errore, setErrore] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)

  async function invia(e: FormEvent) {
    e.preventDefault()
    setErrore(null)
    setMessaggio(null)
    setInCorso(true)
    try {
      if (modo === 'accedi') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        if (!data.session) {
          setMessaggio('Account created. If email confirmation is required, check your inbox and then sign in.')
          setModo('accedi')
        }
      }
    } catch (err) {
      setErrore(err instanceof Error ? err.message : 'Unexpected error')
    } finally {
      setInCorso(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center px-6" style={{ background: 'var(--sidebar)' }}>
      <form onSubmit={invia} className="card w-full max-w-[400px] p-8">
        <div className="mb-6 flex items-center gap-3">
          <img src="/icona-192.png" alt="" width={48} height={48} className="rounded-[14px]" />
          <div className="leading-tight">
            <h1 className="text-[23px] font-bold">SmartCal</h1>
            <p className="text-[12.5px]" style={{ color: 'var(--testo-2)' }}>
              Your time, unified.
            </p>
          </div>
        </div>

        <h2 className="text-[19px] font-bold">{modo === 'accedi' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="mb-6 mt-1 text-[14px]" style={{ color: 'var(--testo-2)' }}>
          {modo === 'accedi'
            ? 'Sign in to pick your calendar back up.'
            : 'Your calendar, your categories, your timezones.'}
        </p>

        <label className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
          Email
        </label>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="campo mb-4"
        />

        <label className="mb-1.5 block text-[12.5px] font-semibold" style={{ color: 'var(--testo-2)' }}>
          Password
        </label>
        <input
          type="password"
          autoComplete={modo === 'accedi' ? 'current-password' : 'new-password'}
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="campo mb-5"
        />

        {errore && (
          <p className="mb-3 text-[13px]" style={{ color: 'var(--errore)' }}>
            {errore}
          </p>
        )}
        {messaggio && (
          <p className="mb-3 text-[13px]" style={{ color: 'var(--cat-universita-fg)' }}>
            {messaggio}
          </p>
        )}

        <button type="submit" disabled={inCorso} className="btn-primario premibile h-[48px] w-full !text-[16px]">
          {inCorso ? '…' : modo === 'accedi' ? 'Sign in' : 'Sign up'}
        </button>

        <button
          type="button"
          onClick={() => {
            setModo(modo === 'accedi' ? 'registrati' : 'accedi')
            setErrore(null)
            setMessaggio(null)
          }}
          className="mt-3 h-[40px] w-full text-[13.5px] font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'var(--primario)' }}
        >
          {modo === 'accedi' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
