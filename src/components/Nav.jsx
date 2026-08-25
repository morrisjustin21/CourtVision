import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentSeason } from '../useCurrentSeason'
import Logo from './Logo'

const LINKS = [
  { key: 'teams', label: 'Teams' },
  { key: 'games', label: 'Games' },
  { key: 'tonight', label: "Tonight's Matchups" },
  { key: 'stats', label: 'Leaders' },
  { key: 'automation', label: 'Automation' },
]

const DEFAULT_SEASONS = ['2026-27', '2025-26']

function SeasonPill() {
  const { season, setSeason, loading } = useCurrentSeason()
  const [seasons, setSeasons] = useState(DEFAULT_SEASONS)

  useEffect(() => {
    async function loadSeasons() {
      const { data } = await supabase.from('games').select('season').not('season', 'is', null)
      const distinct = new Set([...DEFAULT_SEASONS, ...(data || []).map((g) => g.season)])
      setSeasons([...distinct].sort().reverse())
    }
    loadSeasons()
  }, [])

  if (loading) return null

  return (
    <select
      value={season || ''}
      onChange={(e) => setSeason(e.target.value)}
      className="bg-panel2 border border-line hover:border-red rounded-full px-3 py-1.5 text-xs font-semibold text-chalk focus:outline-none focus:border-red cursor-pointer shrink-0"
    >
      <option value="" disabled>Set current season</option>
      {seasons.map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}

export default function Nav({ view, setView }) {
  return (
    <div className="w-full border-b border-line bg-panel print:hidden">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-3 flex items-center gap-4 flex-wrap">
        <div className="shrink-0">
          <Logo scale={0.55} />
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto flex-nowrap">
          {LINKS.map((l) => (
            <button
              key={l.key}
              onClick={() => setView(l.key)}
              className={`whitespace-nowrap px-3 py-2 rounded-md text-sm font-medium transition ${
                view === l.key
                  ? 'bg-red text-white'
                  : 'text-chalkdim hover:text-chalk hover:bg-panel2'
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 ml-auto shrink-0">
          <SeasonPill />
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-xs text-chalkdim hover:text-chalk px-2 py-1"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
