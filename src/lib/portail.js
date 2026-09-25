// Horizon ouvert depuis le portail XGS (portail/horizon/...) plutot qu'a sa
// propre adresse.
//
// Le portail et les outils sont alors a la meme adresse : la session Supabase,
// gardee sous sa cle standard, est partagee. La connexion et la deconnexion
// se font sur le portail, qui renvoie ensuite vers Horizon.
export const SOUS_PORTAIL =
  typeof window !== 'undefined' && /^\/horizon(\/|$)/.test(window.location.pathname)

// Prefixe des adresses d'Horizon pour le routeur : /horizon sous le portail,
// rien a sa propre adresse.
export const BASE_ROUTEUR = SOUS_PORTAIL ? '/horizon' : undefined

// Page de connexion du portail, avec retour a l'accueil d'Horizon une fois
// connecte.
export function allerAuPortail() {
  window.location.replace(`/?retour=${encodeURIComponent('/horizon/')}`)
}
