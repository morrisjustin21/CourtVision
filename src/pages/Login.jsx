import { useState } from 'react'
import { supabase } from '../supabaseClient'
import Logo from '../components/Logo'

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
          <div className="flex justify-center mb-5">
            <Logo scale={1.6} />
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
