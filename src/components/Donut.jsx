/**
 * Donut présence/retards/absences — carte "hero-kpi", identique sur les vues Jour, Semaine et Mois.
 */
export default function Donut({ stats }) {
  const total = stats.present + stats.retard + stats.absentInj + stats.absentJust || 1
  const pctPresent = Math.round((stats.present / total) * 100)
  const pctRetard = Math.round((stats.retard / total) * 100)
  const donutStyle = {
    background: `conic-gradient(var(--sage) 0% ${pctPresent}%, var(--amber) ${pctPresent}% ${pctPresent + pctRetard}%, var(--brick) ${pctPresent + pctRetard}% 100%)`,
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
