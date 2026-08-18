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
        <svg width="18" height="18" viewBox="0 0 18 18" className="text-red shrink-0">
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" strokeWidth="1.4" fill="none" />
          <line x1="9" y1="0.5" x2="9" y2="3.5" stroke="currentColor" strokeWidth="1.4" />
          <line x1="9" y1="14.5" x2="9" y2="17.5" stroke="currentColor" strokeWidth="1.4" />
          <line x1="0.5" y1="9" x2="3.5" y2="9" stroke="currentColor" strokeWidth="1.4" />
          <line x1="14.5" y1="9" x2="17.5" y2="9" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="9" cy="9" r="1.3" fill="currentColor" />
        </svg>
        <span className="font-display text-2xl font-bold tracking-tight">
          COURT<span className="text-red">VISION</span>
        </span>
      </div>
      <nav className="flex md:flex-col px-3 gap-1 pb-3 md:pb-0">
        {LINKS.map((l) => (
          <button
            key={l.key}
            onClick={() => setView(l.key)}
            className={`text-left px-3 py-2 rounded-md text-sm font-medium transition ${
              view === l.key
                ? 'bg-red text-white'
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
