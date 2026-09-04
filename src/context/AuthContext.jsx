import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const AuthContext = createContext(null)

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
    // TODO: adapter la clé de jointure (user_id / auth_id ?) au schéma réel de public.profils
    supabase
      .from('profils')
      .select('id, nom, prenom, login, role, equipe_id, equipes:equipe_id ( id, nom )')
      .eq('auth_id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!error) setProfil(data)
      })
  }, [session])

  async function signIn(login, password) {
    // Si l'authentification Supabase est basée sur l'email plutôt que le login Auréo,
    // adapter ici (ex. résoudre l'email associé au login via une requête, ou signInWithPassword direct).
    return supabase.auth.signInWithPassword({ email: login, password })
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
