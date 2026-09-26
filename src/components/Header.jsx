import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LogoSun from './LogoSun'
import SoleilFiligrane from './SoleilFiligrane'
import { IconeSortie } from './Icones'

const ROLES = {
  agent: 'Agent',
  coach: 'Coach',
  superviseur: 'Superviseur',
  admin: 'Administrateur',
  super_admin: 'Super administrateur',
  direction: 'Direction générale',
}

function onglet({ isActive }) {
  return 'tab' + (isActive ? ' active' : '')
}

export default function Header({ title, subtitle, eyebrow }) {
  const { profil, signOut } = useAuth()
  const initials = profil ? profil.nom.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '—'
  const isAgent = profil?.role === 'agent'
  const surtitre = eyebrow ?? new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <header className="header">
      <SoleilFiligrane />
      <div className="header-top">
        <div className="brand">
          <LogoSun />
          <div>
            <div className="brand-text">Horizon</div>
            <div className="brand-sub">Suivi d'assiduité · XGS</div>
          </div>
        </div>
        <div className="header-right">
          <div className="who">
            <div className="who-text">
              <div className="who-name">{profil?.nom}</div>
              <div className="who-role">{ROLES[profil?.role] ?? profil?.role}</div>
            </div>
            <div className="who-avatar" aria-hidden="true">{initials}</div>
          </div>
          <button type="button" className="btn-ghost" onClick={signOut} title="Se déconnecter">
            <IconeSortie />
            <span className="label">Se déconnecter</span>
          </button>
        </div>
      </div>
      <div className="greeting">
        {surtitre && <div className="eyebrow">{surtitre}</div>}
        <h1>{title?.trim()}<span className="point">.</span></h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <nav className="tabs" aria-label="Vues">
        {isAgent ? (
          <>
            <NavLink to="/mon-jour" className={onglet}>Jour</NavLink>
            <NavLink to="/mon-mois" className={onglet}>Mois</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/jour" className={onglet}>Jour</NavLink>
            <NavLink to="/semaine" className={onglet}>Semaine</NavLink>
            <NavLink to="/mois" className={onglet}>Mois</NavLink>
          </>
        )}
      </nav>
    </header>
  )
}
