import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import Header from '../components/Header'
import Donut from '../components/Donut'
import TauxPresenceCard from '../components/TauxPresenceCard'
import TeamAgentFilter from '../components/TeamAgentFilter'
import { Chargement, EtatErreur, EtatVide } from '../components/Etats'
import { IconeTelecharger } from '../components/Icones'
import { getMonthlyReport, computeTauxPresence } from '../lib/attendance'
import { useAutoRefresh } from '../lib/useAutoRefresh'

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
  const [teamFilter, setTeamFilter] = useState('Toutes')
  const [agentFilter, setAgentFilter] = useState('')
  const [erreur, setErreur] = useState(null)
  const [start, end] = currentMonthBounds()

  function loadMonth(showLoading) {
    if (showLoading) setLoading(true)
    return getMonthlyReport(start, end)
      .then((r) => { setRows(r); setErreur(null) })
      .catch((e) => setErreur(e.message))
      .finally(() => {
        if (showLoading) setLoading(false)
      })
  }

  useEffect(() => {
    loadMonth(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Rafraîchissement automatique toutes les 30s — le mois en cours intègre la production du
  // jour même, qui évolue en continu. Silencieux : pas de ré-affichage du spinner.
  useAutoRefresh(() => loadMonth(false))

  const teams = useMemo(() => ['Toutes', ...new Set(rows.map((r) => r.equipe).filter(Boolean))], [rows])
  const teamRows = teamFilter === 'Toutes' ? rows : rows.filter((r) => r.equipe === teamFilter)
  const agentOptions = useMemo(
    () => [...teamRows].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    [teamRows]
  )
  const visibleRows = (agentFilter ? teamRows.filter((r) => r.agentId === agentFilter) : teamRows)
    .slice()
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))

  function handleTeamChange(t) {
    setTeamFilter(t)
    setAgentFilter('')
  }

  const stats = useMemo(
    () =>
      visibleRows.reduce(
        (acc, r) => ({
          present: acc.present + r.present,
          retard: acc.retard + r.retard,
          absentInj: acc.absentInj + r.absentInjustifie,
          absentJust: acc.absentJust + r.absentJustifie,
        }),
        { present: 0, retard: 0, absentInj: 0, absentJust: 0 }
      ),
    [visibleRows]
  )
  const tauxPresence = useMemo(
    () =>
      computeTauxPresence(
        visibleRows.reduce((sum, r) => sum + (r.tempsPresenceSecondes ?? 0), 0),
        visibleRows.reduce((sum, r) => sum + (r.tempsPrevuSecondes ?? 0), 0)
      ),
    [visibleRows]
  )

  function exportExcel() {
    const data = visibleRows.map((r) => ({
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
      body: visibleRows.map((r) => [r.nom, r.equipe ?? '—', `${r.tauxPresence}%`, r.retard, r.absentInjustifie, r.absentJustifie]),
      // Bleu nuit XGS (#000B53), comme l'en-tete de l'application.
      headStyles: { fillColor: [0, 11, 83] },
    })
    doc.save(`horizon-rapport-mensuel-${start}.pdf`)
  }

  return (
    <>
      <Header
        title="Rapport mensuel"
        eyebrow={new Date(start).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
        subtitle="Synthèse d'assiduité par agent et par équipe"
      />
      <div className="content">
        <div className="bento bento-2">
          <Donut stats={stats} />
          <TauxPresenceCard tauxPresence={tauxPresence} />
        </div>

        <div className="surface full">
          <div className="panel-head">
            <h2>Détail par agent</h2>
            <div className="panel-actions">
              <TeamAgentFilter
                teams={teams}
                teamFilter={teamFilter}
                onTeamChange={handleTeamChange}
                agents={agentOptions}
                agentFilter={agentFilter}
                onAgentChange={setAgentFilter}
              />
              <div className="filter-row">
                <button type="button" className="btn" onClick={exportExcel} disabled={!visibleRows.length}><IconeTelecharger /> Excel</button>
                <button type="button" className="btn btn-dark" onClick={exportPdf} disabled={!visibleRows.length}><IconeTelecharger /> PDF</button>
              </div>
            </div>
          </div>
          {loading ? (
            <Chargement />
          ) : erreur ? (
            <EtatErreur />
          ) : visibleRows.length === 0 ? (
            <EtatVide titre="Aucune donnée d'assiduité ce mois-ci." detail="Le rapport se remplit au fil des journées de production." />
          ) : (
            <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Agent</th><th>Équipe</th><th>Présence</th><th>Retards</th><th>Abs. inj.</th><th>Abs. just.</th></tr>
              </thead>
              <tbody>
                {visibleRows.map((r) => (
                  <tr key={r.agentId}>
                    <td>
                      <button type="button" className="agent-link agent-cell" onClick={() => navigate(`/agent/${r.agentId}`)}>
                        <span className="agent-avatar" aria-hidden="true">{r.nom.split(' ').map((w) => w[0]).slice(0, 2).join('')}</span>
                        <span className="agent-name">{r.nom}</span>
                      </button>
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
            </div>
          )}
        </div>
      </div>
    </>
  )
}
