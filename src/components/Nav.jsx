import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentSeason } from '../useCurrentSeason'
import Logo from './Logo'

const LINKS = [
  { key: 'teams', label: 'Teams' },
  { key: 'games', label: 'Games' },
  { key: 'stats', label: 'Leaders' },
  { key: 'automation', label: 'Automation' },
]

function SeasonPill() {
  const { season, setSeason, loading } = useCurrentSeason()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [seasons, setSeasons] = useState([])

  useEffect(() => {
    async function loadSeasons() {
      const { data } = await supabase.from('games').select('season').not('season', 'is', null)
      const distinct = [...new Set((data || []).map((g) => g.season))].sort().reverse()
      setSeasons(distinct)
    }
    loadSeasons()
  }, [])

  if (loading) return null

  if (editing) {
    return (
      <div className="px-5 pb-4">
        <input
          autoFocus
          list="nav-season-suggestions"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              setSeason(draft.trim())
              setEditing(false)
            }
            if (e.key === 'Escape') setEditing(false)
          }}
          placeholder="2026-27"
          className="w-full bg-panel2 border border-red rounded-md px-2.5 py-1.5 text-sm focus:outline-none"
        />
        <datalist id="nav-season-suggestions">
          {seasons.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <div className="flex gap-2 mt-1.5">
          <button
            onClick={() => {
              if (draft.trim()) setSeason(draft.trim())
              setEditing(false)
            }}
            className="text-xs bg-red text-white font-semibold rounded px-2.5 py-1"
          >
            Set
          </button>
          <button onClick={() => setEditing(false)} className="text-xs text-chalkdim hover:text-chalk">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-5 pb-4">
      <button
        onClick={() => {
          setDraft(season || '')
          setEditing(true)
        }}
        className="w-full flex items-center justify-between bg-panel2 border border-line hover:border-red rounded-full px-3 py-1.5 text-xs font-semibold"
      >
        <span className={season ? 'text-chalk' : 'text-chalkdim'}>
          {season || 'Set current season'}
        </span>
        <span className="text-chalkdim">▾</span>
      </button>
    </div>
  )
}

export default function Nav({ view, setView }) {
  return (
    <div className="w-full md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-line bg-panel print:hidden">
      <div className="px-5 pt-6 pb-5 flex justify-center">
        <Logo scale={0.8} />
      </div>

      <SeasonPill />

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
