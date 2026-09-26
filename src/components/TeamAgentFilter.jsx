/**
 * Filtre équipe (pills) + sélecteur agent, partagé par les vues Jour/Semaine/Mois — sélectionner
 * un agent affiche uniquement sa ligne au lieu de faire défiler toute la liste.
 */
export default function TeamAgentFilter({ teams, teamFilter, onTeamChange, agents, agentFilter, onAgentChange }) {
  return (
    <div className="filter-row">
      {teams.length > 1 && (
        <div className="pill-row" role="group" aria-label="Équipe">
          {teams.map((t) => (
            <button
              type="button"
              key={t}
              className={`pill${teamFilter === t ? ' on' : ''}`}
              aria-pressed={teamFilter === t}
              onClick={() => onTeamChange(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <select className="select" aria-label="Agent" value={agentFilter} onChange={(e) => onAgentChange(e.target.value)}>
        <option value="">Tous les agents</option>
        {agents.map((a) => (
          <option key={a.agentId} value={a.agentId}>{a.nom}</option>
        ))}
      </select>
    </div>
  )
}
