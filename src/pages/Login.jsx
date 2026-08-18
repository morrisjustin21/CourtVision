import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-2">
            <svg width="14" height="14" viewBox="0 0 18 18" className="text-red shrink-0">
              <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
              <line x1="9" y1="0.5" x2="9" y2="3.5" stroke="currentColor" strokeWidth="1.4" />
              <line x1="9" y1="14.5" x2="9" y2="17.5" stroke="currentColor" strokeWidth="1.4" />
              <line x1="0.5" y1="9" x2="3.5" y2="9" stroke="currentColor" strokeWidth="1.4" />
              <line x1="14.5" y1="9" x2="17.5" y2="9" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="9" cy="9" r="1.3" fill="currentColor" />
            </svg>
            <span className="text-xs tracking-[0.2em] text-chalkdim uppercase">CourtVision</span>
          </div>
          <h1 className="font-display text-5xl font-bold tracking-tight">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-panel border border-line rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-chalk focus:border-red outline-none"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-chalk focus:border-red outline-none"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-alert text-sm border border-alert/30 bg-alert/10 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red text-white font-semibold rounded-md py-2.5 hover:bg-red/90 transition disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-chalkdim text-center mt-6">
          Accounts are created manually in Supabase — there's no public sign-up.
        </p>
      </div>
    </div>
  )
}
