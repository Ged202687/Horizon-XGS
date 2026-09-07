import { useEffect, useState } from 'react'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import Donut from '../components/Donut'
import { useAuth } from '../context/AuthContext'
import { getAgentDailyStatus } from '../lib/attendance'
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

  return (
    <>
      <Header title={`Bonjour ${profil?.nom?.split(' ')[0] ?? ''} 👋`} subtitle="Votre assiduité, par journée" />
      <div className="content">
        <div className="scope-banner">🔒 Vue en lecture seule — votre assiduité personnelle</div>

        <div className="field" style={{ maxWidth: 200, marginBottom: 16 }}>
          <label>Journée consultée</label>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </div>

        <div className="bento">
          <Donut stats={stats} />
        </div>

        <div className="surface full">
          <div className="panel-head">
            <h2>Détail du {new Date(date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</h2>
          </div>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Chargement…</div>
          ) : !status ? (
            <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Aucun planning ce jour-là.</div>
          ) : (
            <table>
              <thead><tr><th>Prévu</th><th>Production</th><th>Statut</th><th>Motif</th></tr></thead>
              <tbody>
                <tr>
                  <td className="mono">{status.heurePrevue}</td>
                  <td className="mono">
                    {status.heureReelle ? new Date(status.heureReelle).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                  </td>
                  <td><StatusBadge statut={status.statut} /></td>
                  <td className="mono">{status.motifJustification ?? '—'}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}
