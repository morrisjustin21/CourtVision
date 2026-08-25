import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import ScoutingReport from './ScoutingReport'
import PlayerDevelopment from './PlayerDevelopment'
import AdditionalStats from './AdditionalStats'
import TeamSchedule from './TeamSchedule'
import TeamShotCharts from './TeamShotCharts'
import { useCurrentSeason } from '../useCurrentSeason'

const MATCHUP_SLOTS = 5

function emptyMatchupPlan() {
  return Array.from({ length: MATCHUP_SLOTS }, () => ({
    opponentPlayerId: '',
    defenderPlayerId: '',
    notes: '',
  }))
}

function normalizeMatchupPlan(raw) {
  const base = emptyMatchupPlan()
  if (!Array.isArray(raw)) return base
  return base.map((slot, i) => ({ ...slot, ...(raw[i] || {}) }))
}

export default function Teams() {
  const [teams, setTeams] = useState([])
  const [gameSeasonsByTeam, setGameSeasonsByTeam] = useState({}) // teamId -> Set of seasons
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [showNewTeam, setShowNewTeam] = useState(false)
  const { season: currentSeason, loading: seasonLoading } = useCurrentSeason()
  const [seasonFilter, setSeasonFilter] = useState(null)

  async function loadTeams() {
    setLoading(true)
    const [{ data: teamsData }, { data: gamesData }] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('games').select('home_team_id, away_team_id, season'),
    ])
    setTeams(teamsData || [])

    const byTeam = {}
    ;(gamesData || []).forEach((g) => {
      if (!g.season) return
      for (const teamId of [g.home_team_id, g.away_team_id]) {
        if (!byTeam[teamId]) byTeam[teamId] = new Set()
        byTeam[teamId].add(g.season)
      }
    })
    setGameSeasonsByTeam(byTeam)
    setLoading(false)
  }

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    if (!seasonLoading && seasonFilter === null) {
      setSeasonFilter(currentSeason || 'all')
    }
  }, [seasonLoading, currentSeason, seasonFilter])

  const seasons = [...new Set(Object.values(gameSeasonsByTeam).flatMap((s) => [...s]))].sort().reverse()

  // A team shows up when it's your own team, it has no games logged at all yet
  // (so newly-added teams don't just vanish), or it has a game in the selected
  // season. Otherwise it's an old opponent from a season you're not looking at.
  const visibleTeams =
    !seasonFilter || seasonFilter === 'all'
      ? teams
      : teams.filter((t) => {
          if (t.is_my_team) return true
          const teamSeasons = gameSeasonsByTeam[t.id]
          if (!teamSeasons) return true
          return teamSeasons.has(seasonFilter)
        })
  const hiddenCount = teams.length - visibleTeams.length

  if (selectedTeam) {
    return (
      <TeamDetail
        team={selectedTeam}
        onTeamUpdated={(updated) => setSelectedTeam(updated)}
        onBack={() => {
          setSelectedTeam(null)
          loadTeams()
        }}
      />
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
        <h1 className="font-display text-4xl font-bold">Teams</h1>
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
            onClick={() => setShowNewTeam(true)}
            className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90"
          >
            + Add team
          </button>
        </div>
      </div>
      {seasonFilter && seasonFilter !== 'all' && hiddenCount > 0 && (
        <p className="text-chalkdim text-xs mb-4">
          Showing teams for {seasonFilter}. {hiddenCount} team{hiddenCount === 1 ? '' : 's'} from other
          seasons {hiddenCount === 1 ? 'is' : 'are'} hidden —{' '}
          <button onClick={() => setSeasonFilter('all')} className="text-red hover:underline">
            show all seasons
          </button>
          .
        </p>
      )}
      <div className="mb-4" />

      {showNewTeam && (
        <TeamForm
          onCancel={() => setShowNewTeam(false)}
          onSaved={() => {
            setShowNewTeam(false)
            loadTeams()
          }}
        />
      )}

      {loading ? (
        <p className="text-chalkdim">Loading…</p>
      ) : visibleTeams.length === 0 ? (
        <div className="border border-dashed border-line rounded-lg p-10 text-center text-chalkdim">
          {teams.length === 0
            ? 'No teams yet. Add your first team to get started.'
            : `No teams for ${seasonFilter}. `}
          {teams.length > 0 && (
            <button onClick={() => setSeasonFilter('all')} className="text-red hover:underline">
              Show all seasons
            </button>
          )}
        </div>
      ) : (
        <DistrictGroups teams={visibleTeams} onSelect={setSelectedTeam} />
      )}
    </div>
  )
}

function DistrictGroups({ teams, onSelect }) {
  const groups = {}
  teams.forEach((t) => {
    const key = t.district?.trim() || 'No district set'
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  })
  const districtNames = Object.keys(groups).sort((a, b) => {
    if (a === 'No district set') return 1
    if (b === 'No district set') return -1
    return a.localeCompare(b, undefined, { numeric: true })
  })

  return (
    <div className="space-y-8">
      {districtNames.map((district) => (
        <div key={district}>
          <h2 className="font-display text-xl font-semibold text-chalkdim uppercase tracking-wide text-sm mb-3">
            {district}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups[district].map((t) => (
              <TeamCard key={t.id} team={t} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function TeamCard({ team: t, onSelect }) {
  return (
    <button
      onClick={() => onSelect(t)}
      className="text-left bg-panel border border-line rounded-lg p-5 hover:border-red transition group"
    >
      <div className="flex items-center justify-between mb-3">
        {t.logo_url ? (
          <img src={t.logo_url} alt="" className="w-8 h-8 rounded object-contain" />
        ) : (
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: t.color || '#E31B23' }}
          />
        )}
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
  )
}
function TeamForm({ team, onCancel, onSaved }) {
  const [name, setName] = useState(team?.name || '')
  const [league, setLeague] = useState(team?.league || '')
  const [division, setDivision] = useState(team?.division || '')
  const [district, setDistrict] = useState(team?.district || '')
  const [isMyTeam, setIsMyTeam] = useState(team?.is_my_team || false)
  const [ossaaScheduleUrl, setOssaaScheduleUrl] = useState(team?.ossaa_schedule_url || '')
  const [logoUrl, setLogoUrl] = useState(team?.logo_url || '')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoError, setLogoError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleLogoSelect(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !team) return
    setLogoError('')
    setUploadingLogo(true)
    const ext = file.name.split('.').pop()
    const path = `${team.id}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('team-logos').upload(path, file, { upsert: true })
    if (error) {
      setLogoError("Couldn't upload that image. Try a smaller file or a different format.")
    } else {
      const { data } = supabase.storage.from('team-logos').getPublicUrl(path)
      setLogoUrl(data.publicUrl)
    }
    setUploadingLogo(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      name,
      league: league || null,
      division: division || null,
      district: district || null,
      is_my_team: isMyTeam,
      ossaa_schedule_url: ossaaScheduleUrl || null,
      logo_url: logoUrl || null,
    }
    let result
    if (team) {
      result = await supabase.from('teams').update(payload).eq('id', team.id).select().single()
    } else {
      result = await supabase.from('teams').insert(payload).select().single()
    }
    setSaving(false)
    onSaved(result.data)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-panel border border-line rounded-lg p-5 mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
    >
      <div className="sm:col-span-2">
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">Team logo</label>
        {team ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg bg-panel2 border border-line flex items-center justify-center overflow-hidden shrink-0">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-full h-full object-contain" />
              ) : (
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: team?.color || '#E31B23' }} />
              )}
            </div>
            <div>
              <label className="text-xs bg-panel2 border border-line hover:border-red text-chalk rounded-md px-3 py-1.5 cursor-pointer inline-block">
                {uploadingLogo ? 'Uploading…' : logoUrl ? 'Change logo' : 'Upload logo'}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} disabled={uploadingLogo} />
              </label>
              {logoUrl && (
                <button
                  type="button"
                  onClick={() => setLogoUrl('')}
                  className="text-xs text-chalkdim hover:text-alert ml-3"
                >
                  Remove
                </button>
              )}
              {logoError && <p className="text-alert text-xs mt-1.5">{logoError}</p>}
            </div>
          </div>
        ) : (
          <p className="text-xs text-chalkdim">Save the team first, then edit it to add a logo.</p>
        )}
      </div>
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
      <div>
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">District</label>
        <input
          value={district}
          onChange={(e) => setDistrict(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
          placeholder="District 2"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="block text-xs uppercase tracking-wide text-chalkdim mb-1.5">
          OSSAA schedule URL (optional)
        </label>
        <input
          value={ossaaScheduleUrl}
          onChange={(e) => setOssaaScheduleUrl(e.target.value)}
          className="w-full bg-panel2 border border-line rounded-md px-3 py-2 focus:border-red outline-none"
          placeholder="https://ossaarankings.com/Default.aspx?sel=ssch&sc=188&t=182360"
        />
        <p className="text-xs text-chalkdim mt-1">
          If set, this team's results are checked automatically once a day (see the Automation page).
        </p>
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
          {saving ? 'Saving…' : team ? 'Save changes' : 'Save team'}
        </button>
      </div>
    </form>
  )
}

function TeamDetail({ team, onBack, onTeamUpdated }) {
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewPlayer, setShowNewPlayer] = useState(false)
  const [showEditTeam, setShowEditTeam] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState(null)
  const [editDraft, setEditDraft] = useState({ name: '', jersey_number: '', position: '' })
  const [name, setName] = useState('')
  const [jersey, setJersey] = useState('')
  const [position, setPosition] = useState('')
  const [tab, setTab] = useState('roster')
  const [notes, setNotes] = useState(team.scouting_notes || '')
  const [offenseNotes, setOffenseNotes] = useState(team.offense_notes || '')
  const [defenseNotes, setDefenseNotes] = useState(team.defense_notes || '')
  const [keysToVictory, setKeysToVictory] = useState(team.keys_to_victory || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [savedAt, setSavedAt] = useState(null)
  const [matchupPlan, setMatchupPlan] = useState(normalizeMatchupPlan(team.matchup_plan))
  const [savingMatchup, setSavingMatchup] = useState(false)
  const [matchupSavedAt, setMatchupSavedAt] = useState(null)
  const [myTeamRoster, setMyTeamRoster] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [record, setRecord] = useState(null)

  useEffect(() => {
    async function loadRecord() {
      const { data } = await supabase
        .from('games')
        .select('home_team_id, away_team_id, home_score, away_score')
        .or(`home_team_id.eq.${team.id},away_team_id.eq.${team.id}`)
      let wins = 0
      let losses = 0
      ;(data || []).forEach((g) => {
        const isHome = g.home_team_id === team.id
        const us = isHome ? g.home_score : g.away_score
        const them = isHome ? g.away_score : g.home_score
        if (us == null || them == null) return
        if (us > them) wins += 1
        else if (them > us) losses += 1
      })
      setRecord({ wins, losses })
    }
    loadRecord()
  }, [team.id])

  async function saveNotes() {
    setSavingNotes(true)
    await supabase
      .from('teams')
      .update({
        scouting_notes: notes,
        offense_notes: offenseNotes,
        defense_notes: defenseNotes,
        keys_to_victory: keysToVictory,
      })
      .eq('id', team.id)
    setSavingNotes(false)
    setSavedAt(new Date())
  }

  async function saveMatchupPlan() {
    setSavingMatchup(true)
    await supabase.from('teams').update({ matchup_plan: matchupPlan }).eq('id', team.id)
    setSavingMatchup(false)
    setMatchupSavedAt(new Date())
  }

  useEffect(() => {
    if (team.is_my_team) return
    async function loadMyRoster() {
      const { data: myTeam } = await supabase
        .from('teams')
        .select('id')
        .eq('is_my_team', true)
        .limit(1)
        .maybeSingle()
      if (!myTeam) {
        setMyTeamRoster([])
        return
      }
      const { data: roster } = await supabase
        .from('players')
        .select('*')
        .eq('team_id', myTeam.id)
        .order('jersey_number')
      setMyTeamRoster(roster || [])
    }
    loadMyRoster()
  }, [team.id, team.is_my_team])

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

  function startEditPlayer(p) {
    setEditingPlayerId(p.id)
    setEditDraft({
      name: p.name,
      jersey_number: p.jersey_number ?? '',
      position: p.position ?? '',
    })
  }

  async function saveEditPlayer(id) {
    await supabase
      .from('players')
      .update({
        name: editDraft.name,
        jersey_number: editDraft.jersey_number === '' ? null : parseInt(editDraft.jersey_number, 10),
        position: editDraft.position || null,
      })
      .eq('id', id)
    setEditingPlayerId(null)
    loadPlayers()
  }

  if (selectedPlayer) {
    return (
      <PlayerDevelopment
        player={selectedPlayer}
        team={team}
        onBack={() => setSelectedPlayer(null)}
        onPlayerUpdated={(updated) => {
          setSelectedPlayer(updated)
          setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        }}
      />
    )
  }

  return (
    <div>
      <button onClick={onBack} className="text-sm text-chalkdim hover:text-chalk mb-4 print:hidden">
        ← All teams
      </button>

      {showEditTeam ? (
        <div className="mb-6">
          <h1 className="font-display text-2xl font-semibold mb-3 text-chalkdim uppercase tracking-wide text-sm">
            Edit team
          </h1>
          <TeamForm
            team={team}
            onCancel={() => setShowEditTeam(false)}
            onSaved={(updated) => {
              setShowEditTeam(false)
              if (updated) onTeamUpdated(updated)
            }}
          />
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6 print:hidden">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-4xl font-bold">{team.name}</h1>
              {record && (record.wins > 0 || record.losses > 0) && (
                <span className="text-sm font-semibold stat-figure text-chalkdim border border-line rounded-full px-3 py-1">
                  {record.wins}-{record.losses}
                </span>
              )}
            </div>
            <p className="text-chalkdim text-sm mt-1">
              {[team.league, team.division].filter(Boolean).join(' · ') || 'No league set'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowEditTeam(true)}
              className="bg-panel2 border border-line text-chalk font-medium text-sm rounded-md px-4 py-2 hover:border-red"
            >
              Edit team
            </button>
            {tab === 'roster' && (
              <button
                onClick={() => setShowNewPlayer(true)}
                className="bg-red text-white font-semibold text-sm rounded-md px-4 py-2 hover:bg-red/90"
              >
                + Add player
              </button>
            )}
          </div>
        </div>
      )}

      {!showEditTeam && (
        <div className="flex gap-1 bg-panel border border-line rounded-md p-1 mb-6 w-fit print:hidden">
          {[
            { key: 'roster', label: 'Roster' },
            { key: 'schedule', label: 'Schedule' },
            { key: 'scouting', label: 'Scouting Report' },
            { key: 'shotcharts', label: 'Shot Charts' },
            { key: 'additional', label: 'Additional Stats' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-xs font-medium px-3 py-1.5 rounded ${
                tab === t.key ? 'bg-red text-white' : 'text-chalkdim hover:text-chalk'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'scouting' && !showEditTeam && (
        <ScoutingReport
          team={team}
          notes={notes}
          setNotes={setNotes}
          offenseNotes={offenseNotes}
          setOffenseNotes={setOffenseNotes}
          defenseNotes={defenseNotes}
          setDefenseNotes={setDefenseNotes}
          keysToVictory={keysToVictory}
          setKeysToVictory={setKeysToVictory}
          onSaveNotes={saveNotes}
          savingNotes={savingNotes}
          savedAt={savedAt}
          opponentRoster={players}
          myTeamRoster={myTeamRoster}
          matchupPlan={matchupPlan}
          setMatchupPlan={setMatchupPlan}
          onSaveMatchup={saveMatchupPlan}
          savingMatchup={savingMatchup}
          matchupSavedAt={matchupSavedAt}
        />
      )}

      {tab === 'schedule' && !showEditTeam && <TeamSchedule team={team} />}

      {tab === 'shotcharts' && !showEditTeam && <TeamShotCharts team={team} />}

      {tab === 'additional' && !showEditTeam && <AdditionalStats team={team} />}

      {tab === 'roster' && !showEditTeam && (
        <>
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
              {players.map((p) =>
                editingPlayerId === p.id ? (
                  <tr key={p.id} className="border-b border-line last:border-0 bg-panel2">
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        value={editDraft.jersey_number}
                        onChange={(e) => setEditDraft((d) => ({ ...d, jersey_number: e.target.value }))}
                        className="w-14 bg-panel border border-line rounded px-2 py-1 stat-figure focus:border-red outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editDraft.name}
                        onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))}
                        className="w-full bg-panel border border-line rounded px-2 py-1 focus:border-red outline-none"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={editDraft.position}
                        onChange={(e) => setEditDraft((d) => ({ ...d, position: e.target.value }))}
                        placeholder="G / F / C"
                        className="w-full bg-panel border border-line rounded px-2 py-1 focus:border-red outline-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button
                        onClick={() => saveEditPlayer(p.id)}
                        className="text-xs text-red font-medium hover:text-red/80 mr-3"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingPlayerId(null)}
                        className="text-xs text-chalkdim hover:text-chalk"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 stat-figure text-chalkdim">{p.jersey_number ?? '—'}</td>
                    <td className="px-4 py-3 font-medium">
                      <button
                        onClick={() => setSelectedPlayer(p)}
                        className="hover:text-red text-left"
                      >
                        {p.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-chalkdim">{p.position ?? '—'}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => setSelectedPlayer(p)}
                        className="text-xs text-chalkdim hover:text-red mr-3"
                      >
                        Dev Report
                      </button>
                      <button
                        onClick={() => startEditPlayer(p)}
                        className="text-xs text-chalkdim hover:text-chalk mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removePlayer(p.id)}
                        className="text-xs text-chalkdim hover:text-alert"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </div>
  )
}
