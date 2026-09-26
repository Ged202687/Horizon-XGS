import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Donut from '../components/Donut'
import TauxPresenceCard from '../components/TauxPresenceCard'
import TeamAgentFilter from '../components/TeamAgentFilter'
import { Chargement, EtatErreur, EtatVide } from '../components/Etats'
import { useAuth } from '../context/AuthContext'
import { getWeeklyLateCounts, getMonthlyReport, computeTauxPresence } from '../lib/attendance'
import { useAutoRefresh } from '../lib/useAutoRefresh'

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

function jourMois(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export default function WeekView() {
  const { profil } = useAuth()
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [reportRows, setReportRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [teamFilter, setTeamFilter] = useState('Toutes')
  const [agentFilter, setAgentFilter] = useState('')
  const [erreur, setErreur] = useState(null)
  const [start, end] = currentWeekBounds()

  function loadWeek(showLoading) {
    if (showLoading) setLoading(true)
    const pending = getWeeklyLateCounts(start, end)
      .then((a) => { setAgents(a); setErreur(null) })
      .catch((e) => setErreur(e.message))

    // getMonthlyReport agrège par plage de dates arbitraire (pas seulement calendaire) —
    // réutilisée ici pour obtenir la répartition présence/retards/absences de la semaine et
    // pour peupler le filtre équipe/agent (roster complet, pas seulement les agents en retard).
    getMonthlyReport(start, end).then(setReportRows)

    if (showLoading) pending.finally(() => setLoading(false))
  }

  useEffect(() => {
    loadWeek(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rafraîchissement automatique toutes les 30s — la semaine en cours intègre la production du
  // jour même, qui évolue en continu. Silencieux : pas de ré-affichage du spinner.
  useAutoRefresh(() => loadWeek(false))

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
  const tauxPresence = computeTauxPresence(
    scopedReportRows.reduce((sum, r) => sum + (r.tempsPresenceSecondes ?? 0), 0),
    scopedReportRows.reduce((sum, r) => sum + (r.tempsPrevuSecondes ?? 0), 0)
  )

  const teamAgents = teamFilter === 'Toutes' ? agents : agents.filter((a) => a.equipe === teamFilter)
  const visibleAgents = (agentFilter ? teamAgents.filter((a) => a.agentId === agentFilter) : teamAgents)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  return (
    <>
      <Header title="Rapport hebdomadaire" subtitle={`Semaine du ${jourMois(start)} au ${jourMois(end)}`} />
      <div className="content">
        <div className="bento bento-2">
          <Donut stats={stats} />
          <TauxPresenceCard tauxPresence={tauxPresence} />
        </div>

        <div className="surface full">
          <div className="panel-head">
            <h2>Retards cumulés</h2>
            <div className="panel-actions">
              <span className="hint">Seuil d'alerte : 3 retards</span>
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
            <Chargement />
          ) : erreur ? (
            <EtatErreur />
          ) : visibleAgents.length === 0 ? (
            <EtatVide titre="Aucun retard cette semaine." detail="Les agents arrivés en retard au moins une fois apparaissent ici." />
          ) : (
            <div className="table-scroll">
            <table>
              <thead><tr><th>Agent</th><th>Retards cette semaine</th><th><span className="sr-only">Alerte</span></th></tr></thead>
              <tbody>
                {visibleAgents.map((a) => (
                  <tr key={a.agentId}>
                    <td>
                      <button type="button" className="agent-link agent-cell" onClick={() => navigate(`/agent/${a.agentId}`)}>
                        <span className="agent-avatar" aria-hidden="true">{a.nom.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                        <span className="agent-name">{a.nom}</span>
                      </button>
                    </td>
                    <td className="mono" style={{ fontWeight: 700, color: a.seuilDepasse ? 'var(--brick)' : 'var(--ink)' }}>{a.total}</td>
                    <td>{a.seuilDepasse && <span className="badge absent_injustifie">Seuil dépassé</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
