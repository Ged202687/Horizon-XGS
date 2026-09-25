/**
 * Taux de présence au temps réel — carte séparée du donut (cf. Donut.jsx) pour éviter toute
 * confusion entre les deux pourcentages : temps effectivement passé en production sur la
 * période / temps nominal prévu au planning Méridien (voir computeTauxPresence dans
 * attendance.js). N'affecte pas le statut quotidien (présent/retard/absence).
 */
export default function TauxPresenceCard({ tauxPresence }) {
  return (
    <div className="surface kpi-small">
      <div className="kpi-label">Taux de présence (temps réel)</div>
      <div className="kpi-value" style={{ color: 'var(--sage)' }}>{tauxPresence}%</div>
      <div className="kpi-trend" style={{ color: 'var(--ink-soft)' }}>Temps travaillé / temps prévu au planning</div>
    </div>
  )
}
