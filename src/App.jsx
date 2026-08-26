import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Teams from './pages/Teams'
import Games from './pages/Games'
import Leaders from './pages/Leaders'
import Automation from './pages/Automation'
import TonightsMatchups from './pages/TonightsMatchups'
import NeedsStats from './pages/NeedsStats'
import Nav from './components/Nav'

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading
  const [view, setView] = useState('dashboard')

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
    <div className="min-h-screen flex flex-col">
      <Nav view={view} setView={setView} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-5 py-6 md:px-8 md:py-8">
        {view === 'dashboard' && <Dashboard setView={setView} />}
        {view === 'teams' && <Teams />}
        {view === 'games' && <Games />}
        {view === 'needsstats' && <NeedsStats />}
        {view === 'tonight' && <TonightsMatchups />}
        {view === 'stats' && <Leaders />}
        {view === 'automation' && <Automation />}
      </main>
    </div>
  )
}
