import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const STAT_FIELDS = [
  { key: 'points', label: 'PTS' },
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

export default function Games() {
  const [games, setGames] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewGame, setShowNewGame] = useState(false)
  const [selectedGame, setSelectedGame] = useState(null)

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-4xl font-bold">Games</h1>
        <button
          onClick={() => setShowNewGame(true)}
          className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90"
          disabled={teams.length < 2}
          title={teams.length < 2 ? 'Add at least 2 teams first' : ''}
        >
          + Log game
        </button>
      </div>

      {teams.length < 2 && (
        <p className="text-chalkdim text-sm mb-6">Add at least two teams before logging a game.</p>
      )}

      {showNewGame && (
        <NewGameForm
          teams={teams}
          onCancel={() => setShowNewGame(false)}
          onCreated={() => {
            setShowNewGame(false)
            loadAll()
          }}
        />
      )}

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : games.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          No games logged yet.
        </div>
      ) : (
        <div className="space-y-2">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGame(g)}
              className="w-full text-left bg-panel border border-line rounded-lg px-5 py-4 hover:border-red transition flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <span className="text-xs text-chalkdim w-24 shrink-0">{g.game_date}</span>
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

function NewGameForm({ teams, onCancel, onCreated }) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [homeTeamId, setHomeTeamId] = useState('')
  const [awayTeamId, setAwayTeamId] = useState('')
  const [homeScore, setHomeScore] = useState('')
  const [awayScore, setAwayScore] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (homeTeamId === awayTeamId) {
      setError('Home and away team must be different.')
      return
    }
    setError('')
    setSaving(true)
    await supabase.from('games').insert({
      game_date: date,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_score: homeScore ? parseInt(homeScore, 10) : null,
      away_score: awayScore ? parseInt(awayScore, 10) : null,
    })
    setSaving(false)
    onCreated()
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
          onChange={(e) => setDate(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
        />
      </div>
      <div />
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Away team</label>
        <select
          required
          value={awayTeamId}
          onChange={(e) => setAwayTeamId(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
        >
          <option value="">Select team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Home team</label>
        <select
          required
          value={homeTeamId}
          onChange={(e) => setHomeTeamId(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
        >
          <option value="">Select team</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>
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
          {saving ? 'Saving…' : 'Save game'}
        </button>
      </div>
    </form>
  )
}

function GameDetail({ game, onBack }) {
  const [homeRoster, setHomeRoster] = useState([])
  const [awayRoster, setAwayRoster] = useState([])
  const [statsByPlayer, setStatsByPlayer] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingIds, setSavingIds] = useState({})

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

  async function handleImportFile(file, side, roster, teamId) {
    setImporting((p) => ({ ...p, [side]: true }))
    const text = await file.text()
    const rows = parseHudlBoxScore(text)

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

  return (
    <div>
      <button onClick={onBack} className="text-sm text-chalkdim hover:text-chalk mb-4">
        ← All games
      </button>
      <h1 className="font-display text-4xl font-bold mb-1">
        {game.away_team?.name} @ {game.home_team?.name}
      </h1>
      <p className="text-chalkdim text-sm mb-6">{game.game_date}</p>

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
}) {
  const fileInputId = `hudl-import-${side}`
  const unmatchedRows = unmatched[side] || []

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm">
          {label}
        </h3>
        <label
          htmlFor={fileInputId}
          className="text-xs bg-panel2 border border-line hover:border-red text-chalk rounded-md px-3 py-1.5 cursor-pointer"
        >
          {importing[side] ? 'Importing…' : 'Import Hudl file'}
        </label>
        <input
          id={fileInputId}
          type="file"
          accept=".txt,.csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleImportFile(file, side, roster, teamId)
            e.target.value = ''
          }}
        />
      </div>

      {unmatchedRows.length > 0 && (
        <div className="bg-panel2 border border-red/40 rounded-lg p-4 mb-3 space-y-2">
          <p className="text-xs text-chalkdim">
            These jersey numbers from the file don't match anyone on this roster yet. Name them to add the player and save their stats:
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
