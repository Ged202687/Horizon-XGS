/**
 * Petites icones au trait (style lucide), dessinees ici pour ne pas ajouter de
 * dependance. Elles prennent la couleur du texte (currentColor) et leur taille
 * vient du CSS.
 */
function Icone({ children }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export const IconeCadenas = () => (
  <Icone><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Icone>
)
export const IconeRetour = () => (
  <Icone><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></Icone>
)
export const IconeTelecharger = () => (
  <Icone><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></Icone>
)
export const IconeSortie = () => (
  <Icone><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></Icone>
)
export const IconeCalendrier = () => (
  <Icone><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></Icone>
)
export const IconeAlerte = () => (
  <Icone><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></Icone>
)
