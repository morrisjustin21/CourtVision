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
    <div className="px-5 pb-4">
      <select
        value={season || ''}
        onChange={(e) => setSeason(e.target.value)}
        className="w-full bg-panel2 border border-line hover:border-red rounded-full px-3 py-1.5 text-xs font-semibold text-chalk focus:outline-none focus:border-red cursor-pointer"
      >
        <option value="" disabled>Set current season</option>
        {seasons.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
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
