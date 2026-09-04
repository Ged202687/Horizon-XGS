import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import { getAgentDayStatuses, getAgentProfile } from '../lib/attendance'

function currentMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
}

export default function AgentDetail() {
  const { agentId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [start, end] = currentMonthBounds()

  useEffect(() => {
    setLoading(true)
    Promise.all([getAgentProfile(agentId), getAgentDayStatuses(agentId, start, end)])
      .then(([p, d]) => { setProfile(p); setDays(d) })
      .finally(() => setLoading(false))
  }, [agentId])

  const stats = {
    present: days.filter((d) => d.statut === 'present').length,
    retard: days.filter((d) => d.statut === 'retard').length,
    absentInj: days.filter((d) => d.statut === 'absent_injustifie').length,
    absentJust: days.filter((d) => d.statut === 'absent_justifie').length,
  }
  const tauxPresence = days.length ? Math.round((stats.present / days.length) * 100) : 0

  return (
    <>
      <Header title="Fiche agent" subtitle={profile?.equipes?.nom ?? ''} />
      <div className="content">
        <div className="btn" style={{ display: 'inline-block', marginBottom: 16, cursor: 'pointer' }} onClick={() => navigate(-1)}>
          ← Retour
        </div>

        {loading || !profile ? (
          <div style={{ color: 'var(--ink-soft)' }}>Chargement…</div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--navy)', color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 19 }}>
                {profile.nom.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
              </div>
              <div>
                <h1 style={{ fontSize: 20, marginBottom: 3 }}>{profile.nom}</h1>
                <div style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>{profile.equipes?.nom}</div>
              </div>
            </div>

            <div className="bento">
              <div className="surface">
                <div className="kpi-label">Taux de présence (mois)</div>
                <div className="kpi-value" style={{ color: 'var(--sage)' }}>{tauxPresence}%</div>
              </div>
              <div className="surface">
                <div className="kpi-label">Retards (mois)</div>
                <div className="kpi-value">{stats.retard}</div>
              </div>
              <div className="surface">
                <div className="kpi-label">Absences inj. / just.</div>
                <div className="kpi-value">{stats.absentInj} / {stats.absentJust}</div>
              </div>
            </div>

            <div className="surface full">
              <div className="panel-head"><h2>Historique du mois</h2></div>
              <table>
                <thead><tr><th>Date</th><th>Prévu</th><th>Production</th><th>Statut</th><th>Motif</th></tr></thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.date}>
                      <td>{new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                      <td className="mono">{d.heure_prevue}</td>
                      <td className="mono">{d.heure_reelle ? new Date(d.heure_reelle).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      <td><StatusBadge statut={d.statut} /></td>
                      <td className="mono">{d.motif_justification ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
