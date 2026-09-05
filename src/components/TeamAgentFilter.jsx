/**
 * Filtre équipe (pills) + sélecteur agent, partagé par les vues Jour/Semaine/Mois — sélectionner
 * un agent affiche uniquement sa ligne au lieu de faire défiler toute la liste.
 */
export default function TeamAgentFilter({ teams, teamFilter, onTeamChange, agents, agentFilter, onAgentChange }) {
  return (
    <div className="filter-row">
      {teams.length > 1 && (
        <div className="pill-row">
          {teams.map((t) => (
            <div key={t} className={`pill${teamFilter === t ? ' on' : ''}`} onClick={() => onTeamChange(t)}>
              {t}
            </div>
          ))}
        </div>
      )}
      <select className="select" value={agentFilter} onChange={(e) => onAgentChange(e.target.value)}>
        <option value="">Tous les agents</option>
        {agents.map((a) => (
          <option key={a.agentId} value={a.agentId}>{a.nom}</option>
        ))}
      </select>
    </div>
  )
}
