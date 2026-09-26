/**
 * Donut présence/retards/absences — carte "hero-kpi", identique sur les vues Jour, Semaine et Mois.
 * Répartition en JOURS (nombre de jours présent/retard/absence) — anneau et centre cohérents
 * entre eux. Le taux de présence au temps réel est une carte séparée (cf. TauxPresenceCard).
 */
export default function Donut({ stats }) {
  const somme = stats.present + stats.retard + stats.absentInj + stats.absentJust
  const total = somme || 1
  const pct = (n) => (n / total) * 100
  const a = pct(stats.present)
  const b = a + pct(stats.retard)
  const c = b + pct(stats.absentInj)
  // Chaque statut a son segment, absences justifiées comprises (gris ardoise) ;
  // sans donnée, l'anneau reste neutre plutôt que rouge.
  const donutStyle = {
    background: somme
      ? `conic-gradient(var(--sage) 0% ${a}%, var(--amber) ${a}% ${b}%, var(--brick) ${b}% ${c}%, var(--slate) ${c}% 100%)`
      : 'var(--line)',
  }

  return (
    <div className="surface hero-kpi">
      <div className="donut" style={donutStyle} role="img" aria-label={`${Math.round(a)} % de jours de présence`}>
        <div className="donut-inner">
          <div className="n">{Math.round(a)}%</div>
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
