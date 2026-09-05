import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Header from '../components/Header'
import Donut from '../components/Donut'
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

  const stats = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          present: acc.present + r.present,
          retard: acc.retard + r.retard,
          absentInj: acc.absentInj + r.absentInjustifie,
          absentJust: acc.absentJust + r.absentJustifie,
        }),
        { present: 0, retard: 0, absentInj: 0, absentJust: 0 }
      ),
    [rows]
  )

  function exportExcel() {
    const data = rows.map((r) => ({
      Agent: r.nom,
      Équipe: r.equipe ?? '',
      'Présence (%)': r.tauxPresence,
      Retards: r.retard,
      'Abs. injustifiées': r.absentInjustifie,
      'Abs. justifiées': r.absentJustifie,
    }))
    const sheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Rapport mensuel')
    XLSX.writeFile(workbook, `horizon-rapport-mensuel-${start}.xlsx`)
  }

  function exportPdf() {
    const doc = new jsPDF()
    doc.setFontSize(14)
    doc.text('Rapport mensuel — Assiduité', 14, 16)
    doc.setFontSize(10)
    doc.setTextColor(120)
    doc.text(`Période du ${start} au ${end}`, 14, 22)
    autoTable(doc, {
      startY: 28,
      head: [['Agent', 'Équipe', 'Présence', 'Retards', 'Abs. inj.', 'Abs. just.']],
      body: rows.map((r) => [r.nom, r.equipe ?? '—', `${r.tauxPresence}%`, r.retard, r.absentInjustifie, r.absentJustifie]),
      headStyles: { fillColor: [20, 26, 61] },
    })
    doc.save(`horizon-rapport-mensuel-${start}.pdf`)
  }

  return (
    <>
      <Header title="Rapport mensuel" subtitle="Synthèse d'assiduité par agent et par équipe" />
      <div className="content">
        <div className="bento">
          <Donut stats={stats} />
        </div>

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
