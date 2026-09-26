import { useEffect, useRef, useState } from 'react'

/**
 * Saisie du motif de justification d'une absence, à la place de window.prompt :
 * même geste, mais l'erreur éventuelle s'affiche dans la fenêtre, sans perdre le
 * motif tapé. Échap ou un clic sur le voile ferment sans rien enregistrer.
 */
export default function JustifierDialog({ agent, onConfirm, onClose }) {
  const [motif, setMotif] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState(null)
  const champ = useRef(null)

  useEffect(() => { champ.current?.focus() }, [])
  useEffect(() => {
    const touche = (e) => { if (e.key === 'Escape' && !envoi) onClose() }
    window.addEventListener('keydown', touche)
    return () => window.removeEventListener('keydown', touche)
  }, [envoi, onClose])

  async function valider(e) {
    e.preventDefault()
    if (!motif.trim()) return
    setEnvoi(true)
    setErreur(null)
    try {
      await onConfirm(motif.trim())
    } catch (err) {
      setErreur(`Échec de la justification : ${err.message}`)
      setEnvoi(false)
    }
  }

  return (
    <div className="voile" onMouseDown={(e) => { if (e.target === e.currentTarget && !envoi) onClose() }}>
      <form className="dialogue" role="dialog" aria-modal="true" aria-labelledby="justifier-titre" onSubmit={valider}>
        <h2 id="justifier-titre">Justifier l'absence</h2>
        <div className="hint">{agent}</div>
        <label htmlFor="justifier-motif" className="kpi-label" style={{ display: 'block' }}>Motif</label>
        <textarea
          id="justifier-motif"
          ref={champ}
          value={motif}
          onChange={(e) => setMotif(e.target.value)}
          placeholder="ex. certificat médical transmis au coach"
        />
        <div aria-live="polite">{erreur && <div className="message-erreur">{erreur}</div>}</div>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose} disabled={envoi}>Annuler</button>
          <button type="submit" className="btn btn-dark" disabled={envoi || !motif.trim()}>
            {envoi ? 'Enregistrement…' : 'Justifier'}
          </button>
        </div>
      </form>
    </div>
  )
}
