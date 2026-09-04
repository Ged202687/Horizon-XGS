import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
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

  return (
    <div className="screen">
      <div className="panel">
        <div className="brand">
          <div className="brand-text">Horizon</div>
        </div>
        <div className="panel-hero">
          <h1>Le suivi d'assiduité de vos équipes, en un coup d'œil.</h1>
          <p style={{ color: '#C7CBEB', fontSize: 14, lineHeight: 1.6 }}>
            Présence, retards et absences détectés automatiquement dès le passage en Production sur Auréo.
          </p>
        </div>
        <div style={{ fontSize: 11.5, color: '#8F94BC' }}>Xperience Global Services · Abidjan</div>
      </div>

      <div className="form-side">
        <form className="form-card" onSubmit={handleSubmit}>
          <h2 style={{ fontSize: 21, marginBottom: 6 }}>Connexion</h2>
          <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 30 }}>
            Utilisez votre identifiant Auréo habituel.
          </div>

          <div className="field">
            <label>Identifiant</label>
            <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="ex. s.alex" autoComplete="username" />
          </div>
          <div className="field">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && <div style={{ color: 'var(--brick)', fontSize: 12.5, marginBottom: 14 }}>{error}</div>}

          <button className="btn btn-dark" style={{ width: '100%', padding: 12 }} disabled={loading}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>

          <div style={{ fontSize: 12, color: 'var(--ink-soft)', textAlign: 'center', marginTop: 22 }}>
            Un seul compte pour Auréo, Méridien et Horizon.
          </div>
        </form>
      </div>
    </div>
  )
}
