import { useEffect, useState } from 'react'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import Donut from '../components/Donut'
import { useAuth } from '../context/AuthContext'
import { getAgentMonthlyStats } from '../lib/attendance'
import { useAutoRefresh } from '../lib/useAutoRefresh'
import { supabase } from '../supabaseClient'

function currentMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
}

export default function MyMonthView() {
  const { profil } = useAuth()
  const [start, end] = currentMonthBounds()
  const [stats, setStats] = useState({ present: 0, retard: 0, absentInj: 0, absentJust: 0 })
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)

  function refresh() {
    getAgentMonthlyStats(profil.id, start, end)
      .then(({ stats, days }) => {
        setStats(stats)
        setDays(days)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rafraîchissement automatique toutes les 30s — le mois en cours intègre la production du
  // jour même. Silencieux (refresh() ne touche pas l'indicateur de chargement une fois le
  // premier chargement terminé).
  useAutoRefresh(refresh)

  // Se met à jour automatiquement si un admin/super_admin justifie une absence pendant que
  // l'agent consulte sa page (cf. supabase/sql/005 pour l'activation Realtime nécessaire).
  useEffect(() => {
    const channel = supabase
      .channel(`agent-mois-${profil.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assiduite_statuts_jour', filter: `agent_id=eq.${profil.id}` },
        refresh
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profil.id])

  return (
    <>
      <Header title="Rapport mensuel" subtitle={`Votre assiduité — ${profil?.equipes?.nom ?? ''}`} />
      <div className="content">
        <div className="scope-banner">🔒 Vue en lecture seule — votre assiduité personnelle</div>

        <div className="bento">
          <Donut stats={stats} />
        </div>

        <div className="surface full">
          <div className="panel-head"><h2>Historique du mois</h2></div>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Chargement…</div>
          ) : (
            <table>
              <thead><tr><th>Date</th><th>Prévu</th><th>Production</th><th>Statut</th><th>Motif</th></tr></thead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.date}>
                    <td>{new Date(d.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
                    <td className="mono">{d.heurePrevue}</td>
                    <td className="mono">
                      {d.heureReelle ? new Date(d.heureReelle).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td><StatusBadge statut={d.statut} /></td>
                    <td className="mono">{d.motifJustification ?? '—'}</td>
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
