import LogoSun from './LogoSun'
import { IconeAlerte, IconeCalendrier } from './Icones'

/** Lignes grisées pendant le premier chargement d'un tableau. */
export function Chargement({ lignes = 5 }) {
  return (
    <div className="skeleton" role="status" aria-label="Chargement">
      {Array.from({ length: lignes }, (_, i) => <div key={i} style={{ opacity: 1 - i * 0.14 }} />)}
    </div>
  )
}

/** Tableau sans ligne : on dit pourquoi, plutôt qu'un tableau vide. */
export function EtatVide({ titre, detail }) {
  return (
    <div className="etat">
      <div className="icone"><IconeCalendrier /></div>
      <strong>{titre}</strong>
      {detail && <span>{detail}</span>}
    </div>
  )
}

export function EtatErreur({ detail }) {
  return (
    <div className="etat erreur" role="alert">
      <div className="icone"><IconeAlerte /></div>
      <strong>Les données n'ont pas pu être chargées.</strong>
      <span>{detail || 'Vérifiez votre connexion, puis rechargez la page.'}</span>
    </div>
  )
}

/** Écran d'attente pendant la vérification de la session. */
export function EcranAttente() {
  return (
    <div className="ecran-attente" role="status" aria-label="Chargement">
      <LogoSun />
    </div>
  )
}
