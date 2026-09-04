import { supabase } from '../supabaseClient'

/**
 * Logique de calcul de l'assiduité, telle que cadrée avec Djadji (XGS) :
 *
 *  - "Présent"            : 1er statut "en_prod" du jour dans les 5 min après l'heure prévue (plannings.heure_debut)
 *  - "Retard"              : 1er statut "en_prod" du jour après cette fenêtre de tolérance
 *  - "Absence injustifiée" : agent planifié (heure_debut non NULL) mais aucun "en_prod" détecté sur toute la plage
 *  - "Absence justifiée"   : absence injustifiée requalifiée manuellement par un admin/super admin (motif + traçabilité)
 *
 * NB — les noms de colonnes ci-dessous (profils.nom, profils.role, profils.equipe_id, etc.) sont des HYPOTHÈSES
 * à vérifier/adapter contre le schéma réel de la table public.profils avant la mise en prod.
 */

const TOLERANCE_MINUTES = 5

function toMinutes(hhmmss) {
  if (!hhmmss) return null
  const [h, m] = hhmmss.split(':').map(Number)
  return h * 60 + m
}

/**
 * Récupère les plannings du jour (agents effectivement planifiés, heure_debut non NULL)
 * avec l'identité de l'agent et son équipe.
 */
export async function getPlanningsForDate(date) {
  const { data, error } = await supabase
    .from('plannings')
    .select(`
      id, agent_id, date, heure_debut, heure_fin,
      profils:agent_id ( id, nom, prenom, login, equipe_id,
        equipes:equipe_id ( id, nom, coach_id ) )
    `)
    .eq('date', date)
    .not('heure_debut', 'is', null)

  if (error) throw error
  return data
}

/**
 * Cherche le 1er passage en statut "en_prod" d'un agent sur une date donnée.
 */
export async function getFirstProdOfDay(agentId, date) {
  const dayStart = `${date}T00:00:00`
  const dayEnd = `${date}T23:59:59`

  const { data, error } = await supabase
    .from('statuts_historique')
    .select('debut')
    .eq('agent_id', agentId)
    .eq('statut', 'en_prod')
    .gte('debut', dayStart)
    .lte('debut', dayEnd)
    .order('debut', { ascending: true })
    .limit(1)

  if (error) throw error
  return data?.[0]?.debut ?? null
}

/**
 * Calcule le statut d'un agent pour un planning donné.
 */
export function computeStatus(heureDebutPrevue, premierEnProdISO) {
  if (!premierEnProdISO) {
    return { statut: 'absent_injustifie', heureReelle: null }
  }
  const prevueMin = toMinutes(heureDebutPrevue)
  const reelle = new Date(premierEnProdISO)
  const reelleMin = reelle.getHours() * 60 + reelle.getMinutes()

  const statut = reelleMin <= prevueMin + TOLERANCE_MINUTES ? 'present' : 'retard'
  return { statut, heureReelle: premierEnProdISO }
}

/**
 * Vue du jour : combine plannings + 1er passage en_prod pour chaque agent planifié.
 * Utilisée par l'écran "Jour". Pour la volumétrie de prod, préférer une fonction RPC
 * Postgres (SQL ci-dessous en commentaire) plutôt qu'une boucle côté client.
 */
export async function getDailyView(date) {
  const plannings = await getPlanningsForDate(date)

  const results = await Promise.all(
    plannings.map(async (p) => {
      const premierEnProd = await getFirstProdOfDay(p.agent_id, date)
      const { statut, heureReelle } = computeStatus(p.heure_debut, premierEnProd)
      return {
        agentId: p.agent_id,
        nom: `${p.profils?.prenom ?? ''} ${p.profils?.nom ?? ''}`.trim(),
        equipe: p.profils?.equipes?.nom ?? null,
        heurePrevue: p.heure_debut,
        heureReelle,
        statut,
      }
    })
  )

  return results
}

/*
  Équivalent SQL (à convertir en fonction RPC Postgres pour la prod / les cron jobs) :

  select
    p.agent_id,
    p.heure_debut,
    min(sh.debut) filter (where sh.statut = 'en_prod') as premiere_prise_poste
  from plannings p
  left join statuts_historique sh
    on sh.agent_id = p.agent_id
   and sh.debut::date = p.date
  where p.date = :date
    and p.heure_debut is not null
  group by p.agent_id, p.heure_debut;
*/

/**
 * Écrit (ou met à jour) le statut définitif du jour dans assiduite_statuts_jour.
 * Appelé par le cron horizon-calcul-jour (19h00 GMT).
 */
export async function upsertStatutJour({ agentId, planningId, date, heurePrevue, heureReelle, statut }) {
  const { error } = await supabase.from('assiduite_statuts_jour').upsert(
    {
      agent_id: agentId,
      planning_id: planningId,
      date,
      heure_prevue: heurePrevue,
      heure_reelle: heureReelle,
      statut,
    },
    { onConflict: 'agent_id,date' }
  )
  if (error) throw error
}

/**
 * Requalifie une absence injustifiée en absence justifiée (admin / super admin uniquement —
 * la restriction de rôle doit aussi être appliquée côté RLS sur la table).
 */
export async function justifyAbsence({ statutJourId, motif, commentaire, userId }) {
  const { error } = await supabase
    .from('assiduite_statuts_jour')
    .update({
      statut: 'absent_justifie',
      motif_justification: motif,
      commentaire_justification: commentaire ?? null,
      justifie_par: userId,
      justifie_le: new Date().toISOString(),
    })
    .eq('id', statutJourId)

  if (error) throw error
}

/**
 * Compte les retards de la semaine par agent — utilisé par l'écran "Semaine"
 * et par le cron horizon-check-retards-semaine.
 */
export async function getWeeklyLateCounts(weekStartDate, weekEndDate) {
  const { data, error } = await supabase
    .from('assiduite_statuts_jour')
    .select('agent_id, date, statut, profils:agent_id ( nom, prenom, equipe_id )')
    .eq('statut', 'retard')
    .gte('date', weekStartDate)
    .lte('date', weekEndDate)

  if (error) throw error

  const byAgent = {}
  for (const row of data) {
    byAgent[row.agent_id] ??= { agentId: row.agent_id, nom: `${row.profils?.prenom ?? ''} ${row.profils?.nom ?? ''}`.trim(), dates: [] }
    byAgent[row.agent_id].dates.push(row.date)
  }
  return Object.values(byAgent).map((a) => ({ ...a, total: a.dates.length, seuilDepasse: a.dates.length > 3 }))
}

/**
 * Synthèse mensuelle par agent — écran "Mois" + export PDF/Excel.
 */
export async function getMonthlyReport(monthStartDate, monthEndDate) {
  const { data, error } = await supabase
    .from('assiduite_statuts_jour')
    .select('agent_id, statut, profils:agent_id ( nom, prenom, equipe_id, equipes:equipe_id ( nom ) )')
    .gte('date', monthStartDate)
    .lte('date', monthEndDate)

  if (error) throw error

  const byAgent = {}
  for (const row of data) {
    const id = row.agent_id
    byAgent[id] ??= {
      agentId: id,
      nom: `${row.profils?.prenom ?? ''} ${row.profils?.nom ?? ''}`.trim(),
      equipe: row.profils?.equipes?.nom ?? null,
      present: 0, retard: 0, absentInjustifie: 0, absentJustifie: 0, total: 0,
    }
    byAgent[id].total += 1
    if (row.statut === 'present') byAgent[id].present += 1
    if (row.statut === 'retard') byAgent[id].retard += 1
    if (row.statut === 'absent_injustifie') byAgent[id].absentInjustifie += 1
    if (row.statut === 'absent_justifie') byAgent[id].absentJustifie += 1
  }

  return Object.values(byAgent).map((a) => ({
    ...a,
    tauxPresence: a.total ? Math.round((a.present / a.total) * 100) : 0,
  }))
}

/**
 * Notifications non lues pour l'utilisateur courant.
 */
export async function getNotifications(userId) {
  const { data, error } = await supabase
    .from('assiduite_notifications')
    .select('id, type, agent_id, date_reference, lu, created_at, profils:agent_id ( nom, prenom )')
    .eq('destinataire_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error
  return data
}

/**
 * Détail jour par jour d'un agent sur une période — utilisé par la fiche agent
 * (calendrier + tableau d'historique).
 */
export async function getAgentDayStatuses(agentId, startDate, endDate) {
  const { data, error } = await supabase
    .from('assiduite_statuts_jour')
    .select('date, statut, heure_prevue, heure_reelle, motif_justification')
    .eq('agent_id', agentId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: false })

  if (error) throw error
  return data
}

export async function getAgentProfile(agentId) {
  const { data, error } = await supabase
    .from('profils')
    .select('id, nom, prenom, equipe_id, equipes:equipe_id ( id, nom, coach_id )')
    .eq('id', agentId)
    .single()

  if (error) throw error
  return data
}

export async function markNotificationRead(notificationId) {
  const { error } = await supabase
    .from('assiduite_notifications')
    .update({ lu: true })
    .eq('id', notificationId)
  if (error) throw error
}
