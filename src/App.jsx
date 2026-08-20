import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Teams from './pages/Teams'
import Games from './pages/Games'
import Leaders from './pages/Leaders'
import Automation from './pages/Automation'
import Nav from './components/Nav'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [view, setView] = useState('teams')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center text-chalkdim">
        Loading…
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative">
      <Nav view={view} setView={setView} />
      <main className="flex-1 px-5 py-6 md:px-8 md:py-8 max-w-5xl">
        {view === 'teams' && <Teams />}
        {view === 'games' && <Games />}
        {view === 'stats' && <Leaders />}
        {view === 'automation' && <Automation />}
      </main>
      <button
        onClick={() => supabase.auth.signOut()}
        className="md:hidden fixed bottom-4 right-4 text-xs bg-panel border border-line text-chalkdim px-3 py-2 rounded-full"
      >
        Sign out
      </button>
    </div>
  )
}
