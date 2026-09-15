import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import LogoSun from './LogoSun'

export default function Header({ title, subtitle }) {
  const { profil, signOut } = useAuth()
  const initials = profil ? profil.nom.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '—'
  const isAgent = profil?.role === 'agent'

  return (
    <div className="header">
      <div className="header-top">
        <div className="brand">
          <LogoSun />
          <div className="brand-text">Horizon</div>
        </div>
        <div className="header-right">
          <div className="who-avatar" title={profil?.role} onClick={signOut} style={{ cursor: 'pointer' }}>
            {initials}
          </div>
        </div>
      </div>
      <div className="greeting">
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="tabs">
        {isAgent ? (
          <>
            <NavLink to="/mon-jour" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>Jour</NavLink>
            <NavLink to="/mon-mois" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>Mois</NavLink>
          </>
        ) : (
          <>
            <NavLink to="/jour" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>Jour</NavLink>
            <NavLink to="/semaine" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>Semaine</NavLink>
            <NavLink to="/mois" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>Mois</NavLink>
          </>
        )}
      </div>
    </div>
  )
}
