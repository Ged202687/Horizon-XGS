const LABELS = {
  present: 'Présent',
  retard: 'Retard',
  absent_injustifie: 'Absence inj.',
  absent_justifie: 'Absence just.',
}

export default function StatusBadge({ statut }) {
  return <span className={`badge ${statut}`}>{LABELS[statut] ?? statut}</span>
}
