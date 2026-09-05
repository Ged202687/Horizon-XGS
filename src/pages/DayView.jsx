import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import Donut from '../components/Donut'
import TeamAgentFilter from '../components/TeamAgentFilter'
import { useAuth } from '../context/AuthContext'
import {
  getDailyView,
  getDailyRetardTrend,
  getMonthRetardTotal,
  getWeeklyLateCounts,
  justifyAbsence,
} from '../lib/attendance'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function currentMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
}
// Lundi → dimanche de la semaine en cours (production 7j/7, pas seulement en semaine).
function currentWeekBounds() {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)]
}

function Sparkline({ series }) {
  const max = Math.max(...series.map((s) => s.count), 1)
  return (
    <div className="spark">
      {series.map((s, i) => (
        <div
          key={s.date}
          className={i === series.length - 1 ? 'hi' : ''}
          style={{ height: `${Math.max((s.count / max) * 100, 6)}%` }}
          title={`${s.date} : ${s.count}`}
        />
      ))}
    </div>
  )
}

export default function DayView() {
  const { profil, canEdit } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [teamFilter, setTeamFilter] = useState('Toutes')
  const [agentFilter, setAgentFilter] = useState('')
  const [monthRetards, setMonthRetards] = useState(0)
  const [retardTrend, setRetardTrend] = useState([])
  const [agentsASurveiller, setAgentsASurveiller] = useState(0)

  const scopeTeam = profil?.role === 'coach' || profil?.role === 'superviseur' ? profil?.equipes?.nom : null
  const isToday = selectedDate === todayISO()

  useEffect(() => {
    setLoading(true)
    getDailyView(selectedDate)
      .then(setRows)
      .finally(() => setLoading(false))
  }, [selectedDate])

  // KPI globales (mois/semaine en cours) — indépendantes de la journée consultée dans le tableau.
  useEffect(() => {
    const [monthStart, monthEnd] = currentMonthBounds()
    getMonthRetardTotal(monthStart, monthEnd).then(setMonthRetards)
    getDailyRetardTrend(10).then(setRetardTrend)

    const [weekStart, weekEnd] = currentWeekBounds()
    getWeeklyLateCounts(weekStart, weekEnd).then((agents) =>
      setAgentsASurveiller(agents.filter((a) => a.seuilDepasse).length)
    )
  }, [])

  const scopedRows = scopeTeam ? rows.filter((r) => r.equipe === scopeTeam) : rows
  const teams = useMemo(() => ['Toutes', ...new Set(scopedRows.map((r) => r.equipe).filter(Boolean))], [scopedRows])
  const teamRows = teamFilter === 'Toutes' ? scopedRows : scopedRows.filter((r) => r.equipe === teamFilter)
  const agentOptions = useMemo(
    () => [...teamRows].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [teamRows]
  )
  const visibleRows = (agentFilter ? teamRows.filter((r) => r.agentId === agentFilter) : teamRows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  function handleTeamChange(t) {
    setTeamFilter(t)
    setAgentFilter('')
  }

  const stats = {
    present: visibleRows.filter((r) => r.statut === 'present').length,
    retard: visibleRows.filter((r) => r.statut === 'retard').length,
    absentInj: visibleRows.filter((r) => r.statut === 'absent_injustifie').length,
    absentJust: visibleRows.filter((r) => r.statut === 'absent_justifie').length,
  }
  async function handleJustify(row) {
    const motif = window.prompt(`Motif de justification pour ${row.nom} :`)
    if (!motif) return
    try {
      await justifyAbsence({
        agentId: row.agentId,
        planningId: row.planningId,
        date: selectedDate,
        heurePrevue: row.heurePrevue,
        heureReelle: row.heureReelle,
        motif,
      })
      setRows((prev) => prev.map((r) => (r.agentId === row.agentId ? { ...r, statut: 'absent_justifie' } : r)))
    } catch (e) {
      window.alert(`Échec de la justification : ${e.message}`)
    }
  }

  return (
    <>
      <Header
        title={`Bonjour ${profil?.nom?.split(' ')[0] ?? ''} 👋`}
        subtitle={
          scopeTeam
            ? `Équipe ${scopeTeam}`
            : `${new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — ${visibleRows.length} agents planifiés${isToday ? " aujourd'hui" : ''}`
        }
      />
      <div className="content">
        {scopeTeam && (
          <div className="scope-banner">🔒 Vue en lecture seule, limitée à votre équipe : {scopeTeam}</div>
        )}

        <div className="field" style={{ maxWidth: 200, marginBottom: 16 }}>
          <label>Journée consultée</label>
          <input
            type="date"
            value={selectedDate}
            max={todayISO()}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>

        <div className="bento">
          <Donut stats={stats} />

          <div className="surface kpi-small">
            <div className="kpi-label">Retards ce mois</div>
            <div className="kpi-value">{monthRetards}</div>
            {retardTrend.length > 0 && <Sparkline series={retardTrend} />}
          </div>

          <div className="surface kpi-small">
            <div className="kpi-label">Agents à surveiller</div>
            <div className="kpi-value">{agentsASurveiller}</div>
            <div className="kpi-trend down">&gt; 3 retards cette semaine</div>
          </div>
        </div>

        <div className="surface full">
          <div className="panel-head">
            <h2>Agents planifiés{isToday ? " aujourd'hui" : ` le ${new Date(selectedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}</h2>
            <TeamAgentFilter
              teams={teams}
              teamFilter={teamFilter}
              onTeamChange={handleTeamChange}
              agents={agentOptions}
              agentFilter={agentFilter}
              onAgentChange={setAgentFilter}
            />
          </div>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Chargement…</div>
          ) : (
            <table>
              <thead>
                <tr><th>Agent</th><th>Prévu</th><th>Production</th><th>Statut</th><th></th></tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.agentId}>
                    <td className="agent-link" onClick={() => navigate(`/agent/${r.agentId}`)}>
                      <div className="agent-cell">
                        <div className="agent-avatar">{r.nom.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                        <div className="agent-name">{r.nom}</div>
                      </div>
                    </td>
                    <td className="mono">{r.heurePrevue}</td>
                    <td className="mono">{r.heureReelle ? new Date(r.heureReelle).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                    <td><StatusBadge statut={r.statut} /></td>
                    <td>
                      {r.statut === 'absent_injustifie' && canEdit && (
                        <button className="btn" onClick={() => handleJustify(r)}>Justifier</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
