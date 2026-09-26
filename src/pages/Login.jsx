import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { SOUS_PORTAIL, allerAuPortail } from '../lib/portail'
import LogoSun from '../components/LogoSun'
import SoleilFiligrane from '../components/SoleilFiligrane'

export default function Login() {
  const { signIn, session, loading: chargementSession } = useAuth()
  const navigate = useNavigate()
  const [login, setLogin] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn(login, password)
    setLoading(false)
    if (error) {
      setError("Identifiant ou mot de passe incorrect.")
      return
    }
    navigate('/jour')
  }

  // Sous le portail : pas d'ecran de connexion propre a Horizon. Deja
  // connecte, on va a l'accueil ; sinon, c'est le portail qui connecte, puis
  // renvoie ici.
  useEffect(() => {
    if (SOUS_PORTAIL && !chargementSession && !session) allerAuPortail()
  }, [chargementSession, session])
  if (SOUS_PORTAIL) return session ? <Navigate to="/" replace /> : null

  return (
    <div className="screen">
      <div className="panel">
        <SoleilFiligrane />
        <div className="login-brand">
          <LogoSun />
          <div className="login-brand-text">Horizon</div>
        </div>
        <div className="panel-hero">
          <h1>Le suivi d'assiduité de vos équipes, en un coup d'œil<span className="point">.</span></h1>
          <p>Présence, retards et absences détectés automatiquement dès le passage en Production sur Auréo.</p>
        </div>
        <div className="panel-foot">Xperience Global Services · Abidjan</div>
      </div>

      <div className="form-side">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2>Connexion</h2>
          <div className="intro">Utilisez votre identifiant Auréo habituel.</div>

          <div className="field">
            <label htmlFor="login">Identifiant</label>
            <input id="login" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="ex. s.alex" autoComplete="username" />
          </div>
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <div aria-live="polite">
            {error && <div className="message-erreur" style={{ marginTop: 0, marginBottom: 14 }}>{error}</div>}
          </div>

          <button className="btn btn-sun btn-block" disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>

          <div className="pied">Un seul compte pour Auréo, Méridien, Mon Salaire et Horizon.</div>
        </form>
      </div>
    </div>
  )
}
