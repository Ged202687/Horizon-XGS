import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import { getMonthlyReport } from '../lib/attendance'

function currentMonthBounds() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)]
}

export default function MonthView() {
  const navigate = useNavigate()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [start, end] = currentMonthBounds()

  useEffect(() => {
    getMonthlyReport(start, end)
      .then(setRows)
      .finally(() => setLoading(false))
  }, [])

  // Export PDF/Excel : brancher ici une lib (ex. sheetjs pour Excel, jspdf pour PDF)
  // en réutilisant `rows` — non implémenté dans ce scaffold de base.
  function exportExcel() { window.alert('Export Excel — à implémenter (ex. SheetJS).') }
  function exportPdf() { window.alert('Export PDF — à implémenter (ex. jsPDF).') }

  return (
    <>
      <Header title="Rapport mensuel" subtitle="Synthèse d'assiduité par agent et par équipe" />
      <div className="content">
        <div className="surface full">
          <div className="panel-head">
            <h2>Détail par agent</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={exportExcel}>↓ Excel</button>
              <button className="btn btn-dark" onClick={exportPdf}>↓ PDF</button>
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 20, color: 'var(--ink-soft)' }}>Chargement…</div>
          ) : (
            <table>
              <thead>
                <tr><th>Agent</th><th>Équipe</th><th>Présence</th><th>Retards</th><th>Abs. inj.</th><th>Abs. just.</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.agentId}>
                    <td className="agent-link" onClick={() => navigate(`/agent/${r.agentId}`)}>
                      <div className="agent-cell">
                        <div className="agent-avatar">{r.nom.split(' ').map((w) => w[0]).slice(0, 2).join('')}</div>
                        <div className="agent-name">{r.nom}</div>
                      </div>
                    </td>
                    <td className="mono">{r.equipe}</td>
                    <td className="mono" style={{ color: 'var(--sage)', fontWeight: 700 }}>{r.tauxPresence}%</td>
                    <td className="mono">{r.retard}</td>
                    <td className="mono" style={{ color: r.absentInjustifie > 0 ? 'var(--brick)' : 'var(--ink-soft)', fontWeight: r.absentInjustifie > 0 ? 700 : 400 }}>{r.absentInjustifie}</td>
                    <td className="mono">{r.absentJustifie}</td>
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
