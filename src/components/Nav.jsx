import { supabase } from '../supabaseClient'

const LINKS = [
  { key: 'teams', label: 'Teams' },
  { key: 'games', label: 'Games' },
  { key: 'stats', label: 'Leaders' },
]

export default function Nav({ view, setView }) {
  return (
    <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-line bg-panel">
      <div className="px-5 py-5 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-amber" />
        <span className="font-display text-2xl font-bold tracking-tight">Hoops Tracker</span>
      </div>
      <nav className="flex md:flex-col px-3 gap-1 pb-3 md:pb-0">
        {LINKS.map((l) => (
          <button
            key={l.key}
            onClick={() => setView(l.key)}
            className={`text-left px-3 py-2 rounded-md text-sm font-medium transition ${
              view === l.key
                ? 'bg-amber text-court'
                : 'text-chalkdim hover:text-chalk hover:bg-panel2'
            }`}
          >
            {l.label}
          </button>
        ))}
      </nav>
      <div className="hidden md:block absolute bottom-4 px-3 w-56">
        <button
          onClick={() => supabase.auth.signOut()}
          className="text-xs text-chalkdim hover:text-chalk px-3 py-2"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
