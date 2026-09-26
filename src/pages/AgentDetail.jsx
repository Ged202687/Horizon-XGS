import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import { Chargement, EtatErreur, EtatVide } from '../components/Etats'
import { IconeRetour } from '../components/Icones'
import { getAgentDayStatuses, getAgentProfile, computeTauxPresence, formatDuration } from '../lib/attendance'

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
  const [erreur, setErreur] = useState(null)
  const [start, end] = currentMonthBounds()

  useEffect(() => {
    setLoading(true)
    setErreur(null)
    Promise.all([getAgentProfile(agentId), getAgentDayStatuses(agentId, start, end)])
      .then(([p, d]) => { setProfile(p); setDays(d) })
      .catch((e) => setErreur(e.message))
      .finally(() => setLoading(false))
  }, [agentId])

  const stats = {
    present: days.filter((d) => d.statut === 'present').length,
    retard: days.filter((d) => d.statut === 'retard').length,
    absentInj: days.filter((d) => d.statut === 'absent_injustifie').length,
    absentJust: days.filter((d) => d.statut === 'absent_justifie').length,
  }
  const tauxPresence = computeTauxPresence(
    days.reduce((sum, d) => sum + (d.temps_presence_secondes ?? 0), 0),
    days.reduce((sum, d) => sum + (d.temps_prevu_secondes ?? 0), 0)
  )

  return (
    <>
      <Header
        title={profile?.nom ?? 'Fiche agent'}
        eyebrow="Fiche agent"
        subtitle={profile?.equipes?.nom ? `Équipe ${profile.equipes.nom}` : ''}
      />
      <div className="content">
        <button type="button" className="btn back" onClick={() => navigate(-1)}>
          <IconeRetour /> Retour
        </button>

        {loading ? (
          <div className="surface"><Chargement lignes={4} /></div>
        ) : erreur ? (
          <div className="surface"><EtatErreur /></div>
        ) : !profile ? (
          <div className="surface"><EtatVide titre="Agent introuvable." detail="Ce profil n'existe plus ou n'est pas visible avec votre compte." /></div>
        ) : (
          <>
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
              {days.length === 0 ? (
                <EtatVide titre="Aucune journée planifiée ce mois-ci." />
              ) : (
              <div className="table-scroll">
              <table>
                <thead><tr><th>Date</th><th>Prévu</th><th>Production</th><th>Statut</th><th>Motif</th></tr></thead>
                <tbody>
                  {days.map((d) => (
                    <tr key={d.date}>
                      <td>{new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                      <td className="mono">{d.heure_prevue?.slice(0, 5)}</td>
                      <td className="mono">
                        <div className="strong">{formatDuration(d.temps_presence_secondes)}</div>
                        {d.heure_reelle && (
                          <div className="sub">
                            arrivée {new Date(d.heure_reelle).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </td>
                      <td><StatusBadge statut={d.statut} /></td>
                      <td className="mono">{d.motif_justification ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
