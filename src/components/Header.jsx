import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const LogoSun = () => (
  <svg viewBox="0 0 48 48" fill="none">
    <rect width="48" height="48" rx="12" fill="rgba(255,255,255,.12)" />
    <circle cx="24" cy="24" r="9" stroke="#F0AE2A" strokeWidth="2.6" />
    <path d="M20.5 22.5c.7-1 2.3-1 3 0M24.5 22.5c.7-1 2.3-1 3 0" stroke="#F0AE2A" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M21 26.5c1 1.3 4 1.3 5 0" stroke="#F0AE2A" strokeWidth="1.8" strokeLinecap="round" />
    <g stroke="#F0AE2A" strokeWidth="2.4" strokeLinecap="round">
      <line x1="24" y1="8" x2="24" y2="11" />
      <line x1="24" y1="37" x2="24" y2="40" />
      <line x1="8" y1="24" x2="11" y2="24" />
      <line x1="37" y1="24" x2="40" y2="24" />
      <line x1="13" y1="13" x2="15.1" y2="15.1" />
      <line x1="32.9" y1="32.9" x2="35" y2="35" />
      <line x1="35" y1="13" x2="32.9" y2="15.1" />
      <line x1="15.1" y1="32.9" x2="13" y2="35" />
    </g>
  </svg>
)

export default function Header({ title, subtitle }) {
  const { profil, signOut } = useAuth()
  const initials = profil ? profil.nom.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '—'

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
        <NavLink to="/jour" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>Jour</NavLink>
        <NavLink to="/semaine" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>Semaine</NavLink>
        <NavLink to="/mois" className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}>Mois</NavLink>
      </div>
    </div>
  )
}
