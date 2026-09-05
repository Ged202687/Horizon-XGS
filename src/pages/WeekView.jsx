import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Donut from '../components/Donut'
import TeamAgentFilter from '../components/TeamAgentFilter'
import { useAuth } from '../context/AuthContext'
import { getWeeklyLateCounts, getMonthlyReport } from '../lib/attendance'

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

export default function WeekView() {
  const { profil } = useAuth()
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [reportRows, setReportRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState('Toutes')
  const [agentFilter, setAgentFilter] = useState('')
  const [start, end] = currentWeekBounds()

  useEffect(() => {
    getWeeklyLateCounts(start, end)
      .then(setAgents)
      .finally(() => setLoading(false))

    // getMonthlyReport agrège par plage de dates arbitraire (pas seulement calendaire) —
    // réutilisée ici pour obtenir la répartition présence/retards/absences de la semaine et
    // pour peupler le filtre équipe/agent (roster complet, pas seulement les agents en retard).
    getMonthlyReport(start, end).then(setReportRows)
  }, [])

  const teams = useMemo(() => ['Toutes', ...new Set(reportRows.map((r) => r.equipe).filter(Boolean))], [reportRows])
  const teamReportRows = teamFilter === 'Toutes' ? reportRows : reportRows.filter((r) => r.equipe === teamFilter)
  const agentOptions = useMemo(
    () => [...teamReportRows].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [teamReportRows]
  )

  function handleTeamChange(t) {
    setTeamFilter(t)
    setAgentFilter('')
  }

  const scopedReportRows = agentFilter ? teamReportRows.filter((r) => r.agentId === agentFilter) : teamReportRows
  const stats = scopedReportRows.reduce(
    (acc, r) => ({
      present: acc.present + r.present,
      retard: acc.retard + r.retard,
      absentInj: acc.absentInj + r.absentInjustifie,
      absentJust: acc.absentJust + r.absentJustifie,
    }),
    { present: 0, retard: 0, absentInj: 0, absentJust: 0 }
  )

  const teamAgents = teamFilter === 'Toutes' ? agents : agents.filter((a) => a.equipe === teamFilter)
  const visibleAgents = (agentFilter ? teamAgents.filter((a) => a.agentId === agentFilter) : teamAgents)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  return (
    <>
      <Header title="Rapport hebdomadaire" subtitle={`Semaine du ${start} au ${end}`} />
      <div className="content">
        <div className="bento">
          <Donut stats={stats} />
        </div>

        <div className="surface full">
          <div className="panel-head">
            <h2>Retards cumulés</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>seuil d'alerte : 3</span>
              <TeamAgentFilter
                teams={teams}
                teamFilter={teamFilter}
                onTeamChange={handleTeamChange}
                agents={agentOptions}
                agentFilter={agentFilter}
                onAgentChange={setAgentFilter}
              />
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Chargement…</div>
          ) : (
            <table>
              <thead><tr><th>Agent</th><th>Retards cette semaine</th><th></th></tr></thead>
              <tbody>
                {visibleAgents.map((a) => (
                  <tr key={a.agentId}>
                    <td className="agent-link" onClick={() => navigate(`/agent/${a.agentId}`)}>
                      <div className="agent-cell">
                        <div className="agent-avatar">{a.nom.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                        <div className="agent-name">{a.nom}</div>
                      </div>
                    </td>
                    <td className="mono" style={{ fontWeight: 700, color: a.seuilDepasse ? 'var(--brick)' : 'var(--ink)' }}>{a.total}</td>
                    <td>{a.seuilDepasse && <span className="badge absent_injustifie">Seuil dépassé</span>}</td>
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
