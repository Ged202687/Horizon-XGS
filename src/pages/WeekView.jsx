import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { useAuth } from '../context/AuthContext'
import { getWeeklyLateCounts } from '../lib/attendance'

// Lundi de la semaine en cours, au format YYYY-MM-DD
function currentWeekBounds() {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  const friday = new Date(monday)
  friday.setDate(monday.getDate() + 4)
  return [monday.toISOString().slice(0, 10), friday.toISOString().slice(0, 10)]
}

export default function WeekView() {
  const { profil } = useAuth()
  const navigate = useNavigate()
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [start, end] = currentWeekBounds()

  useEffect(() => {
    getWeeklyLateCounts(start, end)
      .then(setAgents)
      .finally(() => setLoading(false))
  }, [])

  return (
    <>
      <Header title="Rapport hebdomadaire" subtitle={`Semaine du ${start} au ${end}`} />
      <div className="content">
        <div className="surface full">
          <div className="panel-head">
            <h2>Retards cumulés</h2>
            <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>seuil d'alerte : 3</span>
          </div>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Chargement…</div>
          ) : (
            <table>
              <thead><tr><th>Agent</th><th>Retards cette semaine</th><th></th></tr></thead>
              <tbody>
                {agents.map((a) => (
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
