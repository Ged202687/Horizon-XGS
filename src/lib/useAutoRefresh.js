import { useEffect, useRef } from 'react'

/**
 * Ré-exécute `callback` toutes les `intervalMs` (30s par défaut) tant que `enabled` est vrai —
 * pour que les vues reflètent la production en cours sans que l'utilisateur doive recharger la
 * page manuellement. N'appelle jamais `callback` au montage : le premier chargement reste à la
 * charge de l'appelant (généralement avec un indicateur de chargement, contrairement aux
 * rafraîchissements silencieux déclenchés ici).
 */
export function useAutoRefresh(callback, { intervalMs = 30000, enabled = true } = {}) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (!enabled) return
    const id = setInterval(() => callbackRef.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs, enabled])
}
