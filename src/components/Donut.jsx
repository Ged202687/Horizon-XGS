/**
 * Donut présence/retards/absences — carte "hero-kpi", identique sur les vues Jour, Semaine et Mois.
 *
 * Les tranches de l'anneau et la légende restent une répartition en JOURS (nombre de jours
 * présent/retard/absence) — inchangé. Le nombre au centre, lui, est le taux de présence au
 * temps réel (temps passé en production / temps prévu au planning, cf. computeTauxPresence
 * dans attendance.js) : passer `tauxPresence` pour l'afficher ; à défaut, on retombe sur
 * l'ancien calcul (proportion de jours "présent") pour ne rien casser côté appelant.
 */
export default function Donut({ stats, tauxPresence }) {
  const total = stats.present + stats.retard + stats.absentInj + stats.absentJust || 1
  const pctPresent = tauxPresence ?? Math.round((stats.present / total) * 100)
  const pctRetard = Math.round((stats.retard / total) * 100)
  const pctPresentJours = Math.round((stats.present / total) * 100)
  const donutStyle = {
    background: `conic-gradient(var(--sage) 0% ${pctPresentJours}%, var(--amber) ${pctPresentJours}% ${pctPresentJours + pctRetard}%, var(--brick) ${pctPresentJours + pctRetard}% 100%)`,
  }

  return (
    <div className="surface hero-kpi">
      <div className="donut" style={donutStyle}>
        <div className="donut-inner">
          <div className="n">{pctPresent}%</div>
          <div className="l">PRÉSENCE</div>
        </div>
      </div>
      <div className="hero-legend">
        <div className="legend-row"><span className="sw" style={{ background: 'var(--sage)' }} />Présents<b>{stats.present}</b></div>
        <div className="legend-row"><span className="sw" style={{ background: 'var(--amber)' }} />Retards<b>{stats.retard}</b></div>
        <div className="legend-row"><span className="sw" style={{ background: 'var(--brick)' }} />Absences inj.<b>{stats.absentInj}</b></div>
        <div className="legend-row"><span className="sw" style={{ background: 'var(--slate)' }} />Absences just.<b>{stats.absentJust}</b></div>
      </div>
    </div>
  )
}
