import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import StatusBadge from '../components/StatusBadge'
import Donut from '../components/Donut'
import TauxPresenceCard from '../components/TauxPresenceCard'
import TeamAgentFilter from '../components/TeamAgentFilter'
import JustifierDialog from '../components/JustifierDialog'
import { Chargement, EtatErreur, EtatVide } from '../components/Etats'
import { IconeCadenas } from '../components/Icones'
import { useAuth } from '../context/AuthContext'
import {
  getDailyView,
  getDailyRetardTrend,
  getMonthRetardTotal,
  getWeeklyLateCounts,
  justifyAbsence,
  computeTauxPresence,
  formatDuration,
} from '../lib/attendance'
import { useAutoRefresh } from '../lib/useAutoRefresh'

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
  const [selectedDate, setSelectedDate] = useState(todayISO())
  const [teamFilter, setTeamFilter] = useState('Toutes')
  const [agentFilter, setAgentFilter] = useState('')
  const [monthRetards, setMonthRetards] = useState(0)
  const [retardTrend, setRetardTrend] = useState([])
  const [agentsASurveiller, setAgentsASurveiller] = useState(0)
  const [erreur, setErreur] = useState(null)
  const [aJustifier, setAJustifier] = useState(null)

  const scopeTeam = profil?.role === 'coach' || profil?.role === 'superviseur' ? profil?.equipes?.nom : null
  const isToday = selectedDate === todayISO()

  function loadRows(showLoading) {
    if (showLoading) setLoading(true)
    return getDailyView(selectedDate)
      .then((r) => { setRows(r); setErreur(null) })
      .catch((e) => setErreur(e.message))
      .finally(() => {
        if (showLoading) setLoading(false)
      })
  }

  useEffect(() => {
    loadRows(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  // Rafraîchissement automatique toutes les 30s — uniquement pour la journée en cours, la seule
  // dont l'état peut encore évoluer (un jour passé ne change plus). Silencieux : pas de
  // ré-affichage du spinner de chargement à chaque tour.
  useAutoRefresh(() => loadRows(false), { enabled: isToday })

  function loadKpis() {
    const [monthStart, monthEnd] = currentMonthBounds()
    getMonthRetardTotal(monthStart, monthEnd).then(setMonthRetards)
    getDailyRetardTrend(10).then(setRetardTrend)

    const [weekStart, weekEnd] = currentWeekBounds()
    getWeeklyLateCounts(weekStart, weekEnd).then((agents) =>
      setAgentsASurveiller(agents.filter((a) => a.seuilDepasse).length)
    )
  }

  // KPI globales (mois/semaine en cours) — indépendantes de la journée consultée dans le tableau.
  useEffect(() => {
    loadKpis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useAutoRefresh(loadKpis)

  const scopedRows = scopeTeam ? rows.filter((r) => r.equipe === scopeTeam) : rows
  const teams = useMemo(() => ['Toutes', ...new Set(scopedRows.map((r) => r.equipe).filter(Boolean))], [scopedRows])
  const teamRows = teamFilter === 'Toutes' ? scopedRows : scopedRows.filter((r) => r.equipe === teamFilter)
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

  const stats = {
    present: visibleRows.filter((r) => r.statut === 'present').length,
    retard: visibleRows.filter((r) => r.statut === 'retard').length,
    absentInj: visibleRows.filter((r) => r.statut === 'absent_injustifie').length,
    absentJust: visibleRows.filter((r) => r.statut === 'absent_justifie').length,
  }
  const tauxPresence = computeTauxPresence(
    visibleRows.reduce((sum, r) => sum + (r.tempsPresenceSecondes ?? 0), 0),
    visibleRows.reduce((sum, r) => sum + (r.tempsPrevuSecondes ?? 0), 0)
  )
  // Lancée par la fenêtre de justification ; une erreur remonte à la fenêtre,
  // qui l'affiche sans perdre le motif tapé.
  async function handleJustify(row, motif) {
    await justifyAbsence({
      agentId: row.agentId,
      planningId: row.planningId,
      date: selectedDate,
      heurePrevue: row.heurePrevue,
      heureReelle: row.heureReelle,
      motif,
    })
    setRows((prev) => prev.map((r) => (r.agentId === row.agentId ? { ...r, statut: 'absent_justifie' } : r)))
    setAJustifier(null)
  }

  return (
    <>
      <Header
        title={`Bonjour ${profil?.nom?.split(' ')[0] ?? ''}`}
        subtitle={
          scopeTeam
            ? `Équipe ${scopeTeam}`
            : `${visibleRows.length} agents planifiés${isToday ? " aujourd'hui" : ` le ${new Date(selectedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}`
        }
      />
      <div className="content">
        {scopeTeam && (
          <div className="scope-banner"><IconeCadenas /> Vue en lecture seule, limitée à votre équipe : {scopeTeam}</div>
        )}

        <div className="toolbar">
          <div className="field field-date">
            <label htmlFor="journee">Journée consultée</label>
            <input
              id="journee"
              type="date"
              value={selectedDate}
              max={todayISO()}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        <div className="bento-4">
          <Donut stats={stats} />
          <TauxPresenceCard tauxPresence={tauxPresence} />

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
            <h2>Agents planifiés{isToday ? " aujourd'hui" : ` le ${new Date(selectedDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}</h2>
            <TeamAgentFilter
              teams={teams}
              teamFilter={teamFilter}
              onTeamChange={handleTeamChange}
              agents={agentOptions}
              agentFilter={agentFilter}
              onAgentChange={setAgentFilter}
            />
          </div>
          {loading ? (
            <Chargement />
          ) : erreur ? (
            <EtatErreur />
          ) : visibleRows.length === 0 ? (
            <EtatVide
              titre="Aucun agent planifié ce jour-là."
              detail="Les agents apparaissent ici dès qu'ils ont un créneau au planning Méridien."
            />
          ) : (
            <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Agent</th><th>Prévu</th><th>Production</th><th>Statut</th><th><span className="sr-only">Action</span></th></tr>
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
                    <td className="mono">{r.heurePrevue?.slice(0, 5)}</td>
                    <td className="mono">
                      <div className="strong">{formatDuration(r.tempsPresenceSecondes)}</div>
                      {r.heureReelle && (
                        <div className="sub">
                          arrivée {new Date(r.heureReelle).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </td>
                    <td><StatusBadge statut={r.statut} /></td>
                    <td>
                      {r.statut === 'absent_injustifie' && canEdit && (
                        <button type="button" className="btn" onClick={() => setAJustifier(r)}>Justifier</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
      {aJustifier && (
        <JustifierDialog
          agent={aJustifier.nom}
          onConfirm={(motif) => handleJustify(aJustifier, motif)}
          onClose={() => setAJustifier(null)}
        />
      )}
    </>
  )
}
