import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import { useAuth } from '../context/AuthContext'
import { getDailyView, justifyAbsence } from '../lib/attendance'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

export default function DayView() {
  const { profil, canEdit } = useAuth()
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const scopeTeam = profil?.role === 'coach' || profil?.role === 'superviseur' ? profil?.equipes?.nom : null

  useEffect(() => {
    getDailyView(todayISO())
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  const visibleRows = scopeTeam ? rows.filter((r) => r.equipe === scopeTeam) : rows
  const stats = {
    present: visibleRows.filter((r) => r.statut === 'present').length,
    retard: visibleRows.filter((r) => r.statut === 'retard').length,
    absentInj: visibleRows.filter((r) => r.statut === 'absent_injustifie').length,
    absentJust: visibleRows.filter((r) => r.statut === 'absent_justifie').length,
  }

  async function handleJustify(row) {
    const motif = window.prompt(`Motif de justification pour ${row.nom} :`)
    if (!motif) return
    await justifyAbsence({ statutJourId: row.statutJourId, motif, userId: profil.id })
    setRows((prev) => prev.map((r) => (r.agentId === row.agentId ? { ...r, statut: 'absent_justifie' } : r)))
  }

  return (
    <>
      <Header
        title={`Bonjour ${profil?.prenom ?? ''} 👋`}
        subtitle={scopeTeam ? `Équipe ${scopeTeam}` : `${visibleRows.length} agents planifiés aujourd'hui`}
      />
      <div className="content">
        {scopeTeam && (
          <div className="scope-banner">🔒 Vue en lecture seule, limitée à votre équipe : {scopeTeam}</div>
        )}

        <div className="bento">
          <div className="surface">
            <div className="kpi-label">Présents</div>
            <div className="kpi-value" style={{ color: 'var(--sage)' }}>{stats.present}</div>
          </div>
          <div className="surface">
            <div className="kpi-label">Retards</div>
            <div className="kpi-value" style={{ color: 'var(--amber)' }}>{stats.retard}</div>
          </div>
          <div className="surface">
            <div className="kpi-label">Absences injustifiées</div>
            <div className="kpi-value" style={{ color: 'var(--brick)' }}>{stats.absentInj}</div>
          </div>
        </div>

        <div className="surface full">
          <div className="panel-head">
            <h2>Agents planifiés aujourd'hui</h2>
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
