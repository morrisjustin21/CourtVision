import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { useCurrentSeason } from '../useCurrentSeason'
import { parseShotChartPdf } from '../shotChartParser'

const STAT_FIELDS = [
  { key: 'points', label: 'PTS' },
  { key: 'two_made', label: '2PM' },
  { key: 'two_att', label: '2PA' },
  { key: 'three_made', label: '3PM' },
  { key: 'three_att', label: '3PA' },
  { key: 'ft_made', label: 'FTM' },
  { key: 'ft_att', label: 'FTA' },
  { key: 'oreb', label: 'OREB' },
  { key: 'dreb', label: 'DREB' },
  { key: 'rebounds', label: 'REB' },
  { key: 'assists', label: 'AST' },
  { key: 'steals', label: 'STL' },
  { key: 'blocks', label: 'BLK' },
  { key: 'turnovers', label: 'TO' },
  { key: 'fouls', label: 'PF' },
  { key: 'minutes', label: 'MIN' },
]

// Hudl's exported box score is pipe-delimited: a game-id line, a header line,
// then one line per player keyed by jersey number (no player names included).
// Maps Hudl's column names to this app's stat fields.
const HUDL_COLUMN_MAP = {
  Points: 'points',
  TwoPointsMade: 'two_made',
  TwoPointAttempts: 'two_att',
  ThreePointsMade: 'three_made',
  ThreePointAttempts: 'three_att',
  FreeThrowsMade: 'ft_made',
  FreeThrowAttempts: 'ft_att',
  OffensiveRebounds: 'oreb',
  DefensiveRebounds: 'dreb',
  Rebounds: 'rebounds',
  Assists: 'assists',
  Steals: 'steals',
  BlockedShots: 'blocks',
  Turnovers: 'turnovers',
  PersonalFouls: 'fouls',
}

function parseHudlBoxScore(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 3) return []
  const header = lines[1].split('|')
  const jerseyIdx = header.indexOf('Jersey')
  if (jerseyIdx === -1) return []

  const fieldIdx = {}
  Object.entries(HUDL_COLUMN_MAP).forEach(([hudlKey, ourKey]) => {
    const idx = header.indexOf(hudlKey)
    if (idx !== -1) fieldIdx[ourKey] = idx
  })

  return lines.slice(2).map((line) => {
    const cols = line.split('|')
    const jersey = parseInt(cols[jerseyIdx], 10)
    const stats = {}
    Object.entries(fieldIdx).forEach(([ourKey, idx]) => {
      stats[ourKey] = parseInt(cols[idx], 10) || 0
    })
    return { jersey, stats }
  }).filter((row) => !Number.isNaN(row.jersey))
}

// Parses a single CSV line, respecting double-quoted fields that may
// themselves contain commas (e.g. "Tavon Washington , LHSOK").
function parseCsvLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      result.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result.map((s) => s.trim())
}

// Some stat-report CSV exports (e.g. "All Athletes — Averages" reports)
// include a title line, then a wide header row with several duplicate/blank
// spacer columns. Player names are included, formatted "Name , TeamAbbrev".
// Oddly, the points-scored column in these reports is labeled "PF" rather
// than personal fouls — personal fouls live in a separate "FOUL" column.
function parseReportCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  let header = null
  let headerIdx = -1
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const fields = parseCsvLine(lines[i])
    if (fields.includes('Athletes') && fields.includes('#')) {
      header = fields
      headerIdx = i
      break
    }
  }
  if (!header) return []

  const col = (name) => header.indexOf(name)
  const jerseyIdx = col('#')
  const athleteIdx = col('Athletes')
  const pointsIdx = col('PF')
  const twoMadeIdx = col('2FGM')
  const twoAttIdx = col('2FGA')
  const threeMadeIdx = col('3FGM')
  const threeAttIdx = col('3FGA')
  const ftMadeIdx = col('FTM')
  const ftAttIdx = col('FTA')
  const orebIdx = col('OREB')
  const drebIdx = col('DREB')
  const rebIdx = col('REB')
  const astIdx = col('AST')
  const toIdx = col('TO')
  const stlIdx = col('STL')
  const blkIdx = col('BLK')
  const foulIdx = col('FOUL')
  const minsIdx = col('MINS')

  function num(v) {
    const n = parseInt(String(v ?? '').replace('%', '').trim(), 10)
    return Number.isNaN(n) ? 0 : n
  }

  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i])
    if (fields.length < header.length) continue
    const jersey = parseInt(fields[jerseyIdx], 10)
    if (Number.isNaN(jersey)) continue
    const namePart = (fields[athleteIdx] || '').split(',')[0].trim()
    const suggestedName = namePart && namePart.toLowerCase() !== 'unknown' ? namePart : null
    rows.push({
      jersey,
      suggestedName,
      stats: {
        points: num(fields[pointsIdx]),
        two_made: num(fields[twoMadeIdx]),
        two_att: num(fields[twoAttIdx]),
        three_made: num(fields[threeMadeIdx]),
        three_att: num(fields[threeAttIdx]),
        ft_made: num(fields[ftMadeIdx]),
        ft_att: num(fields[ftAttIdx]),
        oreb: num(fields[orebIdx]),
        dreb: num(fields[drebIdx]),
        rebounds: num(fields[rebIdx]),
        assists: num(fields[astIdx]),
        turnovers: num(fields[toIdx]),
        steals: num(fields[stlIdx]),
        blocks: num(fields[blkIdx]),
        fouls: num(fields[foulIdx]),
        minutes: num(fields[minsIdx]),
      },
    })
  }
  return rows
}

// Auto-detects which box score format a file is in and parses it accordingly.
function parseBoxScoreFile(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines[1] && lines[1].split('|').includes('Jersey')) {
    return { format: 'hudl', rows: parseHudlBoxScore(text) }
  }
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (parseCsvLine(lines[i]).includes('Athletes')) {
      return { format: 'csv', rows: parseReportCsv(text) }
    }
  }
  return { format: 'unknown', rows: [] }
}

// Basketball seasons usually span two calendar years (e.g. a game in
// Nov 2025 and a game in Feb 2026 are both part of the "2025-26" season).
// This guesses a sensible default; the season field is always editable.
function guessSeason(dateStr) {
  if (!dateStr) return ''
  const [year, month] = dateStr.split('-').map(Number)
  if (month >= 7) return `${year}-${String(year + 1).slice(2)}`
  return `${year - 1}-${String(year).slice(2)}`
}

export default function Games() {
  const [games, setGames] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewGame, setShowNewGame] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)
  const [seasonFilter, setSeasonFilter] = useState(null)
  const { season: currentSeason, loading: seasonLoading } = useCurrentSeason()

  async function loadAll() {
    setLoading(true)
    const [{ data: gamesData }, { data: teamsData }] = await Promise.all([
      supabase
        .from('games')
        .select('*, home_team:home_team_id(id,name,color), away_team:away_team_id(id,name,color)')
        .order('game_date', { ascending: false }),
      supabase.from('teams').select('*').order('name'),
    ])
    setGames(gamesData || [])
    setTeams(teamsData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!seasonLoading && seasonFilter === null) {
      setSeasonFilter(currentSeason || 'all')
    }
  }, [seasonLoading, currentSeason, seasonFilter])

  const seasons = [...new Set(games.map((g) => g.season).filter(Boolean))].sort().reverse()
  const filteredGames =
    !seasonFilter || seasonFilter === 'all' ? games : games.filter((g) => g.season === seasonFilter)

  if (selectedGame) {
    return (
      <GameDetail
        game={selectedGame}
        onBack={() => {
          setSelectedGame(null)
          loadAll()
        }}
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="font-display text-4xl font-bold">Games</h1>
        <div className="flex items-center gap-2">
          {seasons.length > 0 && (
            <select
              value={seasonFilter || 'all'}
              onChange={(e) => setSeasonFilter(e.target.value)}
              className="bg-panel2 border border-line rounded-md px-3 py-2 text-sm focus:border-red outline-none"
            >
              <option value="all">All seasons</option>
              {seasons.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => setShowNewGame(true)}
            className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90"
            disabled={teams.length < 2}
            title={teams.length < 2 ? 'Add at least 2 teams first' : ''}
          >
            + Log game
          </button>
        </div>
      </div>

      {teams.length < 2 && (
        <p className="text-chalkdim text-sm mb-6">Add at least two teams before logging a game.</p>
      )}

      {showNewGame && (
        <GameForm
          teams={teams}
          seasons={seasons}
          onCancel={() => setShowNewGame(false)}
          onSaved={() => {
            setShowNewGame(false)
            loadAll()
          }}
          onTeamCreated={(newTeam) =>
            setTeams((prev) => [...prev, newTeam].sort((a, b) => a.name.localeCompare(b.name)))
          }
        />
      )}

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : filteredGames.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          {games.length === 0 ? 'No games logged yet.' : 'No games in this season.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredGames.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGame(g)}
              className="w-full text-left bg-panel border border-line rounded-lg px-5 py-4 hover:border-red transition flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <span className="text-xs text-chalkdim w-24 shrink-0">{g.game_date}</span>
                {g.season && (
                  <span className="text-[10px] uppercase tracking-wide text-chalkdim border border-line rounded-full px-2 py-0.5 shrink-0">
                    {g.season}
                  </span>
                )}
                <span className="font-medium">{g.away_team?.name}</span>
                <span className="stat-figure font-display text-xl font-bold">
                  {g.away_score ?? '–'}
                </span>
                <span className="text-chalkdim">@</span>
                <span className="stat-figure font-display text-xl font-bold">
                  {g.home_score ?? '–'}
                </span>
                <span className="font-medium">{g.home_team?.name}</span>
              </div>
              <span className="text-xs text-chalkdim">Enter stats →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function GameForm({ teams, seasons = [], game, onCancel, onSaved, onTeamCreated }) {
  const [date, setDate] = useState(game?.game_date || new Date().toISOString().slice(0, 10))
  const [season, setSeason] = useState(game?.season || guessSeason(game?.game_date || new Date().toISOString().slice(0, 10)))
  const [homeTeamId, setHomeTeamId] = useState(game?.home_team_id || '')
  const [awayTeamId, setAwayTeamId] = useState(game?.away_team_id || '')
  const [homeScore, setHomeScore] = useState(game?.home_score ?? '')
  const [awayScore, setAwayScore] = useState(game?.away_score ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newTeamFor, setNewTeamFor] = useState(null) // null | 'home' | 'away'
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamLeague, setNewTeamLeague] = useState('')
  const [newTeamIsMyTeam, setNewTeamIsMyTeam] = useState(false)
  const [savingNewTeam, setSavingNewTeam] = useState(false)
  const [newTeamError, setNewTeamError] = useState('')

  function handleTeamSelect(side, value) {
    if (value === '__new__') {
      setNewTeamFor(side)
      setNewTeamName('')
      setNewTeamLeague('')
      setNewTeamIsMyTeam(false)
      setNewTeamError('')
    } else {
      if (side === 'home') setHomeTeamId(value)
      else setAwayTeamId(value)
    }
  }

  async function handleCreateTeam() {
    if (!newTeamName.trim()) {
      setNewTeamError('Team name is required.')
      return
    }
    setSavingNewTeam(true)
    const { data, error: insertError } = await supabase
      .from('teams')
      .insert({
        name: newTeamName.trim(),
        league: newTeamLeague || null,
        is_my_team: newTeamIsMyTeam,
      })
      .select()
      .single()
    setSavingNewTeam(false)
    if (insertError || !data) {
      setNewTeamError("Couldn't create that team. Try again.")
      return
    }
    onTeamCreated?.(data)
    if (newTeamFor === 'home') setHomeTeamId(data.id)
    else setAwayTeamId(data.id)
    setNewTeamFor(null)
  }

  function handleDateChange(value) {
    setDate(value)
    // Only auto-fill season if the user hasn't already typed a custom one.
    if (!season || season === guessSeason(date)) {
      setSeason(guessSeason(value))
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (homeTeamId === awayTeamId) {
      setError('Home and away team must be different.')
      return
    }
    setError('')
    setSaving(true)
    const payload = {
      game_date: date,
      season: season || null,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_score: homeScore === '' ? null : parseInt(homeScore, 10),
      away_score: awayScore === '' ? null : parseInt(awayScore, 10),
    }
    let result
    if (game) {
      result = await supabase.from('games').update(payload).eq('id', game.id).select().single()
    } else {
      result = await supabase.from('games').insert(payload).select().single()
    }
    setSaving(false)
    onSaved(result.data)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-panel border border-line rounded-lg p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Date</label>
        <input
          type="date"
          required
          value={date}
          onChange={(e) => handleDateChange(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Season</label>
        <input
          list="season-suggestions"
          value={season}
          onChange={(e) => setSeason(e.target.value)}
          placeholder="2025-26"
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
        />
        <datalist id="season-suggestions">
          {seasons.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Away team</label>
        <select
          required
          disabled={!!game}
          value={awayTeamId}
          onChange={(e) => handleTeamSelect('away', e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none disabled:opacity-60"
        >
          <option value="">Select team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
          {!game && <option value="__new__">+ Add new team…</option>}
        </select>
        {newTeamFor === 'away' && (
          <NewTeamInlineForm
            name={newTeamName}
            setName={setNewTeamName}
            league={newTeamLeague}
            setLeague={setNewTeamLeague}
            isMyTeam={newTeamIsMyTeam}
            setIsMyTeam={setNewTeamIsMyTeam}
            saving={savingNewTeam}
            error={newTeamError}
            onSave={handleCreateTeam}
            onCancel={() => setNewTeamFor(null)}
          />
        )}
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Home team</label>
        <select
          required
          disabled={!!game}
          value={homeTeamId}
          onChange={(e) => handleTeamSelect('home', e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none disabled:opacity-60"
        >
          <option value="">Select team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
          {!game && <option value="__new__">+ Add new team…</option>}
        </select>
        {newTeamFor === 'home' && (
          <NewTeamInlineForm
            name={newTeamName}
            setName={setNewTeamName}
            league={newTeamLeague}
            setLeague={setNewTeamLeague}
            isMyTeam={newTeamIsMyTeam}
            setIsMyTeam={setNewTeamIsMyTeam}
            saving={savingNewTeam}
            error={newTeamError}
            onSave={handleCreateTeam}
            onCancel={() => setNewTeamFor(null)}
          />
        )}
      </div>
      {game && (
        <p className="text-xs text-chalkdim sm:col-span-2 -mt-2">
          Teams can't be changed after a game is created, since box scores are already tied to each roster.
        </p>
      )}
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Away score (optional)</label>
        <input
          type="number"
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none stat-figure"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Home score (optional)</label>
        <input
          type="number"
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none stat-figure"
        />
      </div>

      {error && <p className="text-alert text-sm sm:col-span-2">{error}</p>}

      <div className="sm:col-span-2 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-sm text-chalkdim hover:text-chalk px-4 py-2">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : game ? 'Save changes' : 'Save game'}
        </button>
      </div>
    </form>
  )
}

function NewTeamInlineForm({
  name,
  setName,
  league,
  setLeague,
  isMyTeam,
  setIsMyTeam,
  saving,
  error,
  onSave,
  onCancel,
}) {
  return (
    <div className="mt-2 bg-panel2 border border-red/40 rounded-md p-3 space-y-2">
      <input
        autoFocus
        placeholder="New team name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full bg-panel border border-line rounded-md px-2.5 py-1.5 text-sm focus:border-red outline-none"
      />
      <input
        placeholder="League (optional)"
        value={league}
        onChange={(e) => setLeague(e.target.value)}
        className="w-full bg-panel border border-line rounded-md px-2.5 py-1.5 text-sm focus:border-red outline-none"
      />
      <label className="flex items-center gap-2 text-xs text-chalkdim">
        <input type="checkbox" checked={isMyTeam} onChange={(e) => setIsMyTeam(e.target.checked)} />
        This is my team
      </label>
      {error && <p className="text-alert text-xs">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="text-xs text-chalkdim hover:text-chalk px-2 py-1">
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="bg-red text-white font-semibold text-xs rounded-md px-3 py-1.5 hover:bg-red/90 disabled:opacity-60"
        >
          {saving ? 'Adding…' : 'Add team'}
        </button>
      </div>
    </div>
  )
}

const CHECKLIST_ITEMS = [
  { key: 'shot_chart_reviewed', label: 'Shot chart reviewed' },
  { key: 'matchups_set', label: 'Starting 5 matchups set' },
  { key: 'report_printed', label: 'Scouting report printed' },
  { key: 'roster_confirmed', label: 'Roster confirmed' },
]

function PreGameChecklist({ checklist, onToggle }) {
  const items = checklist || {}
  const doneCount = CHECKLIST_ITEMS.filter((item) => items[item.key]).length

  return (
    <div className="bg-panel border border-line rounded-lg p-4 mb-6 print:hidden">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display text-sm font-semibold text-chalkdim uppercase tracking-wide">
          Pre-Game Checklist
        </h3>
        <span className="text-xs text-chalkdim stat-figure">
          {doneCount}/{CHECKLIST_ITEMS.length}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {CHECKLIST_ITEMS.map((item) => (
          <label key={item.key} className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={!!items[item.key]}
              onChange={() => onToggle(item.key)}
              className="cursor-pointer"
            />
            <span className={items[item.key] ? 'text-chalkdim line-through' : 'text-chalk'}>
              {item.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

function QuarterScores({ game, onSaved }) {
  const existing = game.quarter_scores
  const [expanded, setExpanded] = useState(!!existing)
  const [scores, setScores] = useState(() => {
    if (!existing) return { home: ['', '', '', ''], away: ['', '', '', ''] }
    const normalize = (arr) => (arr || ['', '', '', '']).map((v) => (v == null ? '' : v))
    return { home: normalize(existing.home), away: normalize(existing.away) }
  })
  const [saving, setSaving] = useState(false)

  function updateQuarter(side, index, value) {
    setScores((prev) => {
      const updated = { ...prev, [side]: [...prev[side]] }
      updated[side][index] = value
      return updated
    })
  }

  function total(side) {
    return scores[side].reduce((sum, v) => sum + (parseInt(v, 10) || 0), 0)
  }

  async function save() {
    setSaving(true)
    const cleaned = {
      home: scores.home.map((v) => (v === '' ? null : parseInt(v, 10))),
      away: scores.away.map((v) => (v === '' ? null : parseInt(v, 10))),
    }
    await supabase.from('games').update({ quarter_scores: cleaned }).eq('id', game.id)
    setSaving(false)
    onSaved(cleaned)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-chalkdim hover:text-chalk mb-6 print:hidden"
      >
        + Add quarter-by-quarter scoring
      </button>
    )
  }

  const homeTotal = total('home')
  const awayTotal = total('away')
  const homeMismatch = game.home_score != null && homeTotal > 0 && homeTotal !== game.home_score
  const awayMismatch = game.away_score != null && awayTotal > 0 && awayTotal !== game.away_score

  return (
    <div className="bg-panel border border-line rounded-lg p-4 mb-6 print:hidden">
      <h3 className="font-display text-sm font-semibold text-chalkdim uppercase tracking-wide mb-3">
        Quarter-by-Quarter Scoring
      </h3>
      <div className="overflow-x-auto">
        <table className="text-sm min-w-[420px]">
          <thead>
            <tr className="text-chalkdim text-xs uppercase tracking-wide">
              <th className="text-left pr-3 pb-2 font-medium">Team</th>
              {['Q1', 'Q2', 'Q3', 'Q4'].map((q) => (
                <th key={q} className="px-2 pb-2 font-medium text-center">{q}</th>
              ))}
              <th className="px-2 pb-2 font-medium text-center">Total</th>
            </tr>
          </thead>
          <tbody>
            {[
              { side: 'away', label: game.away_team?.name, mismatch: awayMismatch, total: awayTotal },
              { side: 'home', label: game.home_team?.name, mismatch: homeMismatch, total: homeTotal },
            ].map((row) => (
              <tr key={row.side} className="border-t border-line">
                <td className="pr-3 py-2 font-medium whitespace-nowrap">{row.label}</td>
                {[0, 1, 2, 3].map((i) => (
                  <td key={i} className="px-1 py-2">
                    <input
                      type="number"
                      value={scores[row.side][i]}
                      onChange={(e) => updateQuarter(row.side, i, e.target.value)}
                      className="w-14 bg-panel2 border border-line rounded-md px-2 py-1 text-center focus:border-red outline-none"
                    />
                  </td>
                ))}
                <td className="px-2 py-2 text-center stat-figure font-bold">
                  {row.total}
                  {row.mismatch && (
                    <span className="block text-[10px] text-alert font-normal normal-case">
                      ≠ final ({row.side === 'home' ? game.home_score : game.away_score})
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        onClick={save}
        disabled={saving}
        className="mt-3 bg-red text-white font-semibold text-xs rounded-md px-4 py-1.5 hover:bg-red/90 disabled:opacity-60"
      >
        {saving ? 'Saving…' : 'Save quarter scores'}
      </button>
    </div>
  )
}

function TravelLogistics({ game, onSaved }) {
  const hasExisting = !!(game.travel_departure_time || game.travel_address || game.travel_notes)
  const [expanded, setExpanded] = useState(hasExisting)
  const [departureTime, setDepartureTime] = useState(game.travel_departure_time || '')
  const [address, setAddress] = useState(game.travel_address || '')
  const [notes, setNotes] = useState(game.travel_notes || '')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(null)

  async function save() {
    setSaving(true)
    const payload = {
      travel_departure_time: departureTime || null,
      travel_address: address || null,
      travel_notes: notes || null,
    }
    await supabase.from('games').update(payload).eq('id', game.id)
    setSaving(false)
    setSavedAt(new Date())
    onSaved(payload)
  }

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="text-xs text-chalkdim hover:text-chalk mb-6 print:hidden"
      >
        + Add travel logistics
      </button>
    )
  }

  return (
    <div className="bg-panel border border-line rounded-lg p-4 mb-6 print:hidden">
      <h3 className="font-display text-sm font-semibold text-chalkdim uppercase tracking-wide mb-3">
        Travel Logistics
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">
            Departure time
          </label>
          <input
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            placeholder="e.g. Bus leaves 4:30 PM"
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm focus:border-red outline-none"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">
            Arrival address
          </label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Gym address"
            className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm focus:border-red outline-none"
          />
        </div>
      </div>
      <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">
        Notes
      </label>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Bus number, parking, meal stop, uniform reminders…"
        className="w-full bg-panel2 border border-line rounded-md px-3 py-2 text-sm focus:border-red outline-none resize-y mb-3"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="bg-red text-white font-semibold text-xs rounded-md px-4 py-1.5 hover:bg-red/90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save travel logistics'}
        </button>
        {savedAt && !saving && (
          <span className="text-xs text-chalkdim">Saved {savedAt.toLocaleTimeString()}</span>
        )}
      </div>
    </div>
  )
}

function GameDetail({ game: initialGame, onBack }) {
  const [game, setGame] = useState(initialGame)
  const [homeRoster, setHomeRoster] = useState([])
  const [awayRoster, setAwayRoster] = useState([])
  const [statsByPlayer, setStatsByPlayer] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState({})
  const [showEditGame, setShowEditGame] = useState(false)
  const [deletingGame, setDeletingGame] = useState(false)

  async function deleteGame() {
    const label = `${game.away_team?.name || 'Away'} @ ${game.home_team?.name || 'Home'} (${game.game_date})`
    const confirmed = window.confirm(
      `Delete this game — ${label}? This also deletes every box score entered for it. This can't be undone.`
    )
    if (!confirmed) return
    setDeletingGame(true)
    await supabase.from('games').delete().eq('id', game.id)
    setDeletingGame(false)
    onBack()
  }

  async function toggleChecklistItem(key) {
    const current = game.checklist || {}
    const updated = { ...current, [key]: !current[key] }
    setGame((g) => ({ ...g, checklist: updated }))
    await supabase.from('games').update({ checklist: updated }).eq('id', game.id)
  }

  async function loadData() {
    setLoading(true)
    const [{ data: home }, { data: away }, { data: stats }] = await Promise.all([
      supabase.from('players').select('*').eq('team_id', game.home_team_id).order('jersey_number'),
      supabase.from('players').select('*').eq('team_id', game.away_team_id).order('jersey_number'),
      supabase.from('player_game_stats').select('*').eq('game_id', game.id),
    ])
    setHomeRoster(home || [])
    setAwayRoster(away || [])
    const map = {}
    ;(stats || []).forEach((s) => {
      map[s.player_id] = s
    })
    setStatsByPlayer(map)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  function updateField(playerId, field, value) {
    setStatsByPlayer((prev) => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] || {}),
        [field]: value === '' ? '' : parseInt(value, 10),
      },
    }))
  }

  async function saveRow(playerId) {
    setSavingIds((p) => ({ ...p, [playerId]: true }))
    const row = statsByPlayer[playerId] || {}
    const payload = { game_id: game.id, player_id: playerId }
    STAT_FIELDS.forEach((f) => {
      payload[f.key] = row[f.key] === '' || row[f.key] == null ? 0 : row[f.key]
    })
    await supabase.from('player_game_stats').upsert(payload, { onConflict: 'game_id,player_id' })
    setSavingIds((p) => ({ ...p, [playerId]: false }))
  }

  async function saveStatsForPlayer(playerId, stats) {
    const payload = { game_id: game.id, player_id: playerId }
    STAT_FIELDS.forEach((f) => {
      payload[f.key] = stats[f.key] ?? 0
    })
    await supabase.from('player_game_stats').upsert(payload, { onConflict: 'game_id,player_id' })
    setStatsByPlayer((prev) => ({ ...prev, [playerId]: payload }))
  }

  const [unmatched, setUnmatched] = useState({ home: [], away: [] })
  const [newNames, setNewNames] = useState({})
  const [importing, setImporting] = useState({})
  const [importError, setImportError] = useState({})

  async function handleImportFile(file, side, roster, teamId) {
    setImporting((p) => ({ ...p, [side]: true }))
    setImportError((p) => ({ ...p, [side]: null }))
    const text = await file.text()
    const { format, rows } = parseBoxScoreFile(text)

    if (format === 'unknown') {
      setImportError((p) => ({ ...p, [side]: "Couldn't recognize this file's format." }))
      setImporting((p) => ({ ...p, [side]: false }))
      return
    }

    const stillUnmatched = []
    for (const row of rows) {
      const player = roster.find((p) => p.jersey_number === row.jersey)
      if (player) {
        await saveStatsForPlayer(player.id, row.stats)
      } else {
        stillUnmatched.push(row)
      }
    }
    setUnmatched((p) => ({ ...p, [side]: stillUnmatched }))
    setNewNames((prev) => {
      const next = { ...prev }
      stillUnmatched.forEach((row) => {
        if (row.suggestedName) next[`${side}-${row.jersey}`] = row.suggestedName
      })
      return next
    })
    setImporting((p) => ({ ...p, [side]: false }))
  }

  async function addUnmatchedPlayer(side, teamId, row, setRoster) {
    const name = newNames[`${side}-${row.jersey}`]
    if (!name) return
    const { data } = await supabase
      .from('players')
      .insert({ team_id: teamId, name, jersey_number: row.jersey })
      .select()
      .single()
    if (!data) return
    setRoster((prev) => [...prev, data].sort((a, b) => (a.jersey_number ?? 0) - (b.jersey_number ?? 0)))
    await saveStatsForPlayer(data.id, row.stats)
    setUnmatched((p) => ({ ...p, [side]: p[side].filter((r) => r.jersey !== row.jersey) }))
  }

  const [clearing, setClearing] = useState({})

  async function clearStatsForSide(side, roster, teamName) {
    if (roster.length === 0) return
    const confirmed = window.confirm(
      `Clear all box score stats for ${teamName || 'this team'} in this game? This can't be undone.`
    )
    if (!confirmed) return
    setClearing((p) => ({ ...p, [side]: true }))
    const playerIds = roster.map((p) => p.id)
    await supabase.from('player_game_stats').delete().eq('game_id', game.id).in('player_id', playerIds)
    setStatsByPlayer((prev) => {
      const next = { ...prev }
      playerIds.forEach((id) => delete next[id])
      return next
    })
    setUnmatched((p) => ({ ...p, [side]: [] }))
    setImportError((p) => ({ ...p, [side]: null }))
    setClearing((p) => ({ ...p, [side]: false }))
  }

  const [shotChartImporting, setShotChartImporting] = useState({})
  const [shotChartError, setShotChartError] = useState({})
  const [shotChartUnmatched, setShotChartUnmatched] = useState({})
  const [shotChartSaved, setShotChartSaved] = useState({})

  async function handleShotChartImport(file, side, roster) {
    setShotChartImporting((p) => ({ ...p, [side]: true }))
    setShotChartError((p) => ({ ...p, [side]: null }))
    setShotChartUnmatched((p) => ({ ...p, [side]: [] }))
    setShotChartSaved((p) => ({ ...p, [side]: false }))
    try {
      const { players, debug } = await parseShotChartPdf(file)

      if (players.length === 0) {
        setShotChartError((p) => ({
          ...p,
          [side]: `Couldn't find any player shot data. Diagnostics — pages: ${debug.pages}, words extracted: ${debug.totalWords}, jersey numbers found: ${debug.jerseyTokens}, player names found: ${debug.namesFound}, percentages found: ${debug.pctWordsTotal}, fractions found: ${debug.fracWordsTotal}, zones matched: ${debug.zonesMatchedTotal}. First words seen: ${debug.sampleWords.map((w) => `"${w}"`).join(', ')}`,
        }))
        setShotChartImporting((p) => ({ ...p, [side]: false }))
        return
      }

      const unmatchedJerseys = []
      const dbErrors = []
      let savedCount = 0

      for (const p of players) {
        const player = roster.find((r) => r.jersey_number === p.jersey)
        if (!player) {
          if (p.jersey != null) unmatchedJerseys.push(p.jersey)
          continue
        }
        for (const z of p.zones) {
          const { error } = await supabase.from('player_shot_zones').upsert(
            {
              game_id: game.id,
              player_id: player.id,
              zone: z.zoneId,
              made: z.made,
              attempted: z.attempted,
            },
            { onConflict: 'game_id,player_id,zone' }
          )
          if (error) {
            dbErrors.push(error.message)
          } else {
            savedCount += 1
          }
        }
      }

      setShotChartUnmatched((p) => ({ ...p, [side]: unmatchedJerseys }))

      if (dbErrors.length > 0) {
        const uniqueMessages = [...new Set(dbErrors)]
        setShotChartError((p) => ({
          ...p,
          [side]: `Saved ${savedCount} of ${savedCount + dbErrors.length} zone entries. Errors: ${uniqueMessages.join('; ')}`,
        }))
      } else if (savedCount === 0) {
        setShotChartError((p) => ({
          ...p,
          [side]: 'Players were found in the PDF, but none matched a jersey number on this roster.',
        }))
      } else {
        setShotChartSaved((p) => ({ ...p, [side]: true }))
      }
    } catch (err) {
      setShotChartError((p) => ({ ...p, [side]: `Couldn't read that shot chart PDF: ${err.message || err}` }))
    }
    setShotChartImporting((p) => ({ ...p, [side]: false }))
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-chalkdim hover:text-chalk mb-4">
        ← All games
      </button>

      {showEditGame ? (
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold mb-3 text-chalkdim uppercase tracking-wide text-sm">
            Edit game
          </h1>
          <GameForm
            teams={[game.home_team, game.away_team].filter(Boolean)}
            game={game}
            onCancel={() => setShowEditGame(false)}
            onSaved={(updated) => {
              setShowEditGame(false)
              if (updated) setGame((g) => ({ ...g, ...updated }))
            }}
          />
        </div>
      ) : (
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="font-display text-4xl font-bold mb-1">
              {game.away_team?.name} @ {game.home_team?.name}
            </h1>
            <p className="text-chalkdim text-sm flex items-center gap-2">
              {game.game_date}
              {game.season && (
                <span className="text-[10px] uppercase tracking-wide text-chalkdim border border-line rounded-full px-2 py-0.5">
                  {game.season}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowEditGame(true)}
              className="bg-panel2 border border-line text-chalk font-medium text-sm rounded-md px-4 py-2 hover:border-red"
            >
              Edit game
            </button>
            <button
              onClick={deleteGame}
              disabled={deletingGame}
              className="bg-panel2 border border-alert/40 text-alert font-medium text-sm rounded-md px-4 py-2 hover:border-alert disabled:opacity-60"
            >
              {deletingGame ? 'Deleting…' : 'Delete game'}
            </button>
          </div>
        </div>
      )}

      {!showEditGame && (
        <TravelLogistics
          game={game}
          onSaved={(updates) => setGame((g) => ({ ...g, ...updates }))}
        />
      )}

      {!showEditGame && <PreGameChecklist checklist={game.checklist} onToggle={toggleChecklistItem} />}

      {!showEditGame && (
        <QuarterScores
          game={game}
          onSaved={(quarter_scores) => setGame((g) => ({ ...g, quarter_scores }))}
        />
      )}

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : (
        <>
          <RosterTable
            roster={awayRoster}
            setRoster={setAwayRoster}
            teamId={game.away_team_id}
            side="away"
            label={game.away_team?.name}
            statsByPlayer={statsByPlayer}
            updateField={updateField}
            saveRow={saveRow}
            savingIds={savingIds}
            unmatched={unmatched}
            importing={importing}
            newNames={newNames}
            setNewNames={setNewNames}
            handleImportFile={handleImportFile}
            addUnmatchedPlayer={addUnmatchedPlayer}
            importError={importError}
            onClearStats={() => clearStatsForSide('away', awayRoster, game.away_team?.name)}
            clearing={clearing}
            onImportShotChart={(file) => handleShotChartImport(file, 'away', awayRoster)}
            shotChartImporting={shotChartImporting}
            shotChartError={shotChartError}
            shotChartUnmatched={shotChartUnmatched}
            shotChartSaved={shotChartSaved}
          />
          <RosterTable
            roster={homeRoster}
            setRoster={setHomeRoster}
            teamId={game.home_team_id}
            side="home"
            label={game.home_team?.name}
            statsByPlayer={statsByPlayer}
            updateField={updateField}
            saveRow={saveRow}
            savingIds={savingIds}
            unmatched={unmatched}
            importing={importing}
            newNames={newNames}
            setNewNames={setNewNames}
            handleImportFile={handleImportFile}
            addUnmatchedPlayer={addUnmatchedPlayer}
            importError={importError}
            onClearStats={() => clearStatsForSide('home', homeRoster, game.home_team?.name)}
            clearing={clearing}
            onImportShotChart={(file) => handleShotChartImport(file, 'home', homeRoster)}
            shotChartImporting={shotChartImporting}
            shotChartError={shotChartError}
            shotChartUnmatched={shotChartUnmatched}
            shotChartSaved={shotChartSaved}
          />
        </>
      )}
    </div>
  )
}

function RosterTable({
  roster,
  setRoster,
  teamId,
  side,
  label,
  statsByPlayer,
  updateField,
  saveRow,
  savingIds,
  unmatched,
  importing,
  newNames,
  setNewNames,
  handleImportFile,
  addUnmatchedPlayer,
  importError,
  onClearStats,
  clearing,
  onImportShotChart,
  shotChartImporting,
  shotChartError,
  shotChartUnmatched,
  shotChartSaved,
}) {
  const fileInputId = `box-score-import-${side}`
  const shotChartInputId = `shot-chart-import-${side}`
  const unmatchedRows = unmatched[side] || []
  const error = importError?.[side]
  const hasAnyStats = roster.some((p) => statsByPlayer[p.id])
  const shotChartUnmatchedJerseys = shotChartUnmatched?.[side] || []

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm">
          {label}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {hasAnyStats && (
            <button
              onClick={onClearStats}
              disabled={clearing?.[side]}
              className="text-xs bg-panel2 border border-alert/40 hover:border-alert text-alert rounded-md px-3 py-1.5 disabled:opacity-60"
            >
              {clearing?.[side] ? 'Clearing…' : 'Clear stats'}
            </button>
          )}
          <label
            htmlFor={fileInputId}
            className="text-xs bg-panel2 border border-line hover:border-red text-chalk rounded-md px-3 py-1.5 cursor-pointer"
          >
            {importing[side] ? 'Importing…' : 'Import box score file'}
          </label>
          <label
            htmlFor={shotChartInputId}
            className="text-xs bg-panel2 border border-line hover:border-red text-chalk rounded-md px-3 py-1.5 cursor-pointer"
          >
            {shotChartImporting?.[side] ? 'Importing…' : 'Import shot chart PDF'}
          </label>
        </div>
        <input
          id={shotChartInputId}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onImportShotChart(file)
            e.target.value = ''
          }}
        />
        <input
          id={fileInputId}
          type="file"
          accept=".txt,.csv,text/plain,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file, side, roster, teamId)
            e.target.value = ''
          }}
        />
      </div>

      {error && (
        <p className="text-alert text-xs mb-3">{error}</p>
      )}

      {shotChartError?.[side] && (
        <p className="text-alert text-xs mb-3">{shotChartError[side]}</p>
      )}

      {shotChartSaved?.[side] && !shotChartImporting?.[side] && (
        <p className="text-chalkdim text-xs mb-3">
          Shot chart imported.
          {shotChartUnmatchedJerseys.length > 0 && (
            <>
              {' '}Jersey number{shotChartUnmatchedJerseys.length === 1 ? '' : 's'}{' '}
              {shotChartUnmatchedJerseys.map((j) => `#${j}`).join(', ')} didn't match anyone on this
              roster, so that data wasn't saved — add {shotChartUnmatchedJerseys.length === 1 ? 'that player' : 'those players'} first, then re-import.
            </>
          )}
        </p>
      )}

      {unmatchedRows.length > 0 && (
        <div className="bg-panel2 border border-red/40 rounded-lg p-4 mb-3 space-y-2">
          <p className="text-xs text-chalkdim">
            These jersey numbers from the file don't match anyone on this roster yet. Confirm or edit the name, then add the player and save their stats:
          </p>
          {unmatchedRows.map((row) => (
            <div key={row.jersey} className="flex items-center gap-2">
              <span className="stat-figure text-sm w-10 shrink-0">#{row.jersey}</span>
              <input
                placeholder="Player name"
                value={newNames[`${side}-${row.jersey}`] || ''}
                onChange={(e) =>
                  setNewNames((p) => ({ ...p, [`${side}-${row.jersey}`]: e.target.value }))
                }
                className="flex-1 bg-panel border border-line rounded-md px-3 py-1.5 text-sm focus:border-red outline-none"
              />
              <button
                onClick={() => addUnmatchedPlayer(side, teamId, row, setRoster)}
                className="text-xs bg-red text-white font-semibold rounded-md px-3 py-1.5 hover:bg-red/90"
              >
                Add & save
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="bg-panel border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-chalkdim text-xs uppercase tracking-wide border-b border-line">
              <th className="text-left px-3 py-2 font-medium">Player</th>
              {STAT_FIELDS.map((f) => (
                <th key={f.key} className="px-2 py-2 font-medium text-center">{f.label}</th>
              ))}
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p) => {
              const row = statsByPlayer[p.id] || {}
              return (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">
                    {p.jersey_number != null && (
                      <span className="text-chalkdim stat-figure mr-1.5">#{p.jersey_number}</span>
                    )}
                    {p.name}
                  </td>
                  {STAT_FIELDS.map((f) => (
                    <td key={f.key} className="px-1 py-1.5">
                      <input
                        type="number"
                        value={row[f.key] ?? ''}
                        onChange={(e) => updateField(p.id, f.key, e.target.value)}
                        className="w-14 bg-panel2 border border-line rounded px-1.5 py-1 text-center stat-figure focus:border-red outline-none"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right">
                    <button
                      onClick={() => saveRow(p.id)}
                      className="text-xs text-red hover:text-red/80"
                    >
                      {savingIds[p.id] ? 'Saving…' : 'Save'}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
