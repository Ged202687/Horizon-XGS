import { useEffect, useState } from 'react'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import Donut from '../components/Donut'
import TauxPresenceCard from '../components/TauxPresenceCard'
import { Chargement, EtatVide } from '../components/Etats'
import { IconeCadenas } from '../components/Icones'
import { useAuth } from '../context/AuthContext'
import { getAgentDailyStatus, computeTauxPresence, formatDuration } from '../lib/attendance'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { supabase } from '../supabaseClient'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function MyDayView() {
  const { profil } = useAuth()
  const [date, setDate] = useState(todayISO())
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)

  function refresh() {
    getAgentDailyStatus(profil.id, date)
      .then(setStatus)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // Rafraîchissement automatique toutes les 30s — uniquement pour la journée en cours, la seule
  // dont l'état peut encore évoluer. Silencieux (refresh() ne touche pas l'indicateur de
  // chargement une fois le premier chargement terminé).
  useAutoRefresh(refresh, { enabled: date === todayISO() })

  // Se met à jour automatiquement si un admin/super_admin justifie une absence pendant que
  // l'agent consulte sa page (cf. supabase/sql/005 pour l'activation Realtime nécessaire).
  useEffect(() => {
    const channel = supabase
      .channel(`agent-jour-${profil.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assiduite_statuts_jour', filter: `agent_id=eq.${profil.id}` },
        refresh
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil.id, date])

  const stats = {
    present: status?.statut === 'present' ? 1 : 0,
    retard: status?.statut === 'retard' ? 1 : 0,
    absentInj: status?.statut === 'absent_injustifie' ? 1 : 0,
    absentJust: status?.statut === 'absent_justifie' ? 1 : 0,
  }
  const tauxPresence = computeTauxPresence(status?.tempsPresenceSecondes ?? 0, status?.tempsPrevuSecondes ?? 0)

  return (
    <>
      <Header title={`Bonjour ${profil?.nom?.split(' ')[0] ?? ''}`} subtitle="Votre assiduité, par journée" />
      <div className="content">
        <div className="scope-banner"><IconeCadenas /> Vue en lecture seule — votre assiduité personnelle</div>

        <div className="toolbar">
          <div className="field field-date">
            <label htmlFor="journee">Journée consultée</label>
            <input id="journee" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <div className="bento bento-2">
          <Donut stats={stats} />
          <TauxPresenceCard tauxPresence={tauxPresence} />
        </div>

        <div className="surface full">
          <div className="panel-head">
            <h2>Détail du {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          </div>
          {loading ? (
            <Chargement lignes={2} />
          ) : !status ? (
            <EtatVide titre="Aucun planning ce jour-là." detail="Vos créneaux viennent du planning Méridien." />
          ) : (
            <div className="table-scroll">
            <table>
              <thead><tr><th>Prévu</th><th>Production</th><th>Statut</th><th>Motif</th></tr></thead>
              <tbody>
                <tr>
                  <td className="mono">{status.heurePrevue?.slice(0, 5)}</td>
                  <td className="mono">
                    <div className="strong">{formatDuration(status.tempsPresenceSecondes)}</div>
                    {status.heureReelle && (
                      <div className="sub">
                        arrivée {new Date(status.heureReelle).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </td>
                  <td><StatusBadge statut={status.statut} /></td>
                  <td className="mono">{status.motifJustification ?? '—'}</td>
                </tr>
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
