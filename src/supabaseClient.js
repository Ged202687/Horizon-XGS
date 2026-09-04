import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    'VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants — copiez .env.example vers .env et renseignez les valeurs du projet Supabase (le même que Auréo/Méridien).'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
