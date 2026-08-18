import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [showNewTeam, setShowNewTeam] = useState(false)

  async function loadTeams() {
    setLoading(true)
    const { data } = await supabase.from('teams').select('*').order('name')
    setTeams(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadTeams()
  }, [])

  if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        onBack={() => {
          setSelectedTeam(null)
          loadTeams()
        }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display text-4xl font-bold">Teams</h1>
        <button
          onClick={() => setShowNewTeam(true)}
          className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90"
        >
          + Add team
        </button>
      </div>

      {showNewTeam && (
        <NewTeamForm
          onCancel={() => setShowNewTeam(false)}
          onCreated={() => {
            setShowNewTeam(false)
            loadTeams()
          }}
        />
      )}

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : teams.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          No teams yet. Add your first team to get started.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTeam(t)}
              className="text-left bg-panel border border-line rounded-lg p-5 hover:border-red transition group"
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: t.color || '#E31B23' }}
                />
                {t.is_my_team && (
                  <span className="text-[10px] uppercase tracking-wide text-red border border-red/40 rounded-full px-2 py-0.5">
                    My team
                  </span>
                )}
              </div>
              <h3 className="font-display text-2xl font-semibold group-hover:text-red transition">
                {t.name}
              </h3>
              <p className="text-chalkdim text-sm mt-1">
                {[t.league, t.division].filter(Boolean).join(' · ') || 'No league set'}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NewTeamForm({ onCancel, onCreated }) {
  const [name, setName] = useState('')
  const [league, setLeague] = useState('')
  const [division, setDivision] = useState('')
  const [isMyTeam, setIsMyTeam] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('teams').insert({
      name,
      league: league || null,
      division: division || null,
      is_my_team: isMyTeam,
    })
    setSaving(false)
    onCreated()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-panel border border-line rounded-lg p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <div className="sm:col-span-2">
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Team name</label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
          placeholder="Thunder"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">League</label>
        <input
          value={league}
          onChange={(e) => setLeague(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
          placeholder="Rec league, AAU, etc."
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Division</label>
        <input
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-chalkdim sm:col-span-2">
        <input type="checkbox" checked={isMyTeam} onChange={(e) => setIsMyTeam(e.target.checked)} />
        This is my team
      </label>
      <div className="sm:col-span-2 flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm text-chalkdim hover:text-chalk px-4 py-2">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90 disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save team'}
        </button>
      </div>
    </form>
  )
}

function TeamDetail({ team, onBack }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewPlayer, setShowNewPlayer] = useState(false)
  const [name, setName] = useState('')
  const [jersey, setJersey] = useState('')
  const [position, setPosition] = useState('')

  async function loadPlayers() {
    setLoading(true)
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', team.id)
      .order('jersey_number')
    setPlayers(data || [])
    setLoading(false)
  }

  useEffect(() => {
    loadPlayers()
  }, [])

  async function addPlayer(e) {
    e.preventDefault()
    await supabase.from('players').insert({
      team_id: team.id,
      name,
      jersey_number: jersey ? parseInt(jersey, 10) : null,
      position: position || null,
    })
    setName('')
    setJersey('')
    setPosition('')
    setShowNewPlayer(false)
    loadPlayers()
  }

  async function removePlayer(id) {
    await supabase.from('players').delete().eq('id', id)
    loadPlayers()
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-chalkdim hover:text-chalk mb-4">
        ← All teams
      </button>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-4xl font-bold">{team.name}</h1>
          <p className="text-chalkdim text-sm mt-1">
            {[team.league, team.division].filter(Boolean).join(' · ') || 'No league set'}
          </p>
        </div>
        <button
          onClick={() => setShowNewPlayer(true)}
          className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90"
        >
          + Add player
        </button>
      </div>

      {showNewPlayer && (
        <form
          onSubmit={addPlayer}
          className="bg-panel border border-line rounded-lg p-5 mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
        >
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">#</label>
            <input
              type="number"
              value={jersey}
              onChange={(e) => setJersey(e.target.value)}
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Position</label>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="G / F / C"
              className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
            />
          </div>
          <div className="sm:col-span-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewPlayer(false)}
              className="text-sm text-chalkdim hover:text-chalk px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90"
            >
              Save player
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : players.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          No players on this roster yet.
        </div>
      ) : (
        <div className="bg-panel border border-line rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-chalkdim text-xs uppercase tracking-wide border-b border-line">
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Name</th>
                <th className="text-left px-4 py-3 font-medium">Position</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 stat-figure text-chalkdim">{p.jersey_number ?? '—'}</td>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-chalkdim">{p.position ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => removePlayer(p.id)}
                      className="text-xs text-chalkdim hover:text-alert"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
