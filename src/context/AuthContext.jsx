import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * Auréo n'utilise PAS le SDK @supabase/supabase-js pour l'auth — il appelle directement
 * l'API GoTrue (auth/v1) en REST. On reproduit exactement le même flux ici pour rester
 * compatible avec les comptes existants (mêmes tables, même logique de login) :
 *
 *  1. RPC publique `email_from_login(p_login)` — résout le login saisi (ex. "s.sery")
 *     en email interne (ex. "s.sery@aureo.internal"). Appelée avec le rôle anonyme.
 *  2. POST auth/v1/token?grant_type=password avec cet email — authentification classique.
 *  3. profils.id = auth.users.id (confirmé dans App.jsx d'Auréo, ligne ~230) — on peut
 *     donc récupérer le profil directement par l'id de l'utilisateur authentifié.
 */
async function supaAuth(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.msg || data.error || "Erreur d'authentification")
  return data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profil, setProfil] = useState(null) // ligne public.profils correspondante (rôle, équipe, nom...)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session?.user) {
      setProfil(null)
      return
    }
    // Confirmé dans le code Auréo : profils.id = auth.users.id (l'id de l'utilisateur authentifié).
    supabase
      .from('profils')
      .select('id, matricule, nom, login, role, actif, equipe_id, superviseur_id, admin_id, equipes:equipe_id ( id, nom, coach_id )')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!error) setProfil(data)
      })
  }, [session])

  async function signIn(login, password) {
    // Même flux que Auréo : résolution login -> email via la RPC publique, puis
    // authentification classique par email/mot de passe auprès de GoTrue.
    const { data: email, error: rpcError } = await supabase.rpc('email_from_login', { p_login: login.trim() })
    if (rpcError || !email) {
      return { error: rpcError || new Error('Identifiant inconnu.') }
    }
    try {
      const data = await supaAuth('token?grant_type=password', { email, password })
      // Réutilise le SDK pour la suite de la session (rafraîchissement de token, etc.)
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      if (setErr) return { error: setErr }
      return { error: null }
    } catch (e) {
      return { error: e }
    }
  }

  async function signOut() {
    return supabase.auth.signOut()
  }

  const canEdit = profil?.role === 'admin' || profil?.role === 'super_admin'

  return (
    <AuthContext.Provider value={{ session, profil, loading, canEdit, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
