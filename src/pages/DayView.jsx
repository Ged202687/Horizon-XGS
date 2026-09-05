import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import Donut from '../components/Donut'
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
  const [teamFilter, setTeamFilter] = useState('Toutes')
  const [monthRetards, setMonthRetards] = useState(0)
  const [retardTrend, setRetardTrend] = useState([])
  const [agentsASurveiller, setAgentsASurveiller] = useState(0)

  const scopeTeam = profil?.role === 'coach' || profil?.role === 'superviseur' ? profil?.equipes?.nom : null

  useEffect(() => {
    getDailyView(todayISO())
      .then(setRows)
      .finally(() => setLoading(false))

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
  const visibleRows = teamFilter === 'Toutes' ? scopedRows : scopedRows.filter((r) => r.equipe === teamFilter)

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
        title={`Bonjour ${profil?.nom?.split(' ')[0] ?? ''} 👋`}
        subtitle={scopeTeam ? `Équipe ${scopeTeam}` : `${new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} — ${visibleRows.length} agents planifiés aujourd'hui`}
      />
      <div className="content">
        {scopeTeam && (
          <div className="scope-banner">🔒 Vue en lecture seule, limitée à votre équipe : {scopeTeam}</div>
        )}

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
            <h2>Agents planifiés aujourd'hui</h2>
            {teams.length > 1 && (
              <div className="pill-row">
                {teams.map((t) => (
                  <div key={t} className={`pill${teamFilter === t ? ' on' : ''}`} onClick={() => setTeamFilter(t)}>
                    {t}
                  </div>
                ))}
              </div>
            )}
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
