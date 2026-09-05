import { supabase } from '../supabaseClient'

/**
 * Logique de calcul de l'assiduité, telle que cadrée avec Djadji (XGS) :
 *
 *  - "Présent"            : 1er statut "en_prod" du jour dans les 5 min après l'heure prévue (plannings.heure_debut)
 *  - "Retard"              : 1er statut "en_prod" du jour après cette fenêtre de tolérance
 *  - "Absence injustifiée" : agent planifié (heure_debut non NULL) mais aucun "en_prod" détecté sur toute la plage
 *  - "Absence justifiée"   : absence injustifiée requalifiée manuellement par un admin/super admin (motif + traçabilité)
 *
 * NB — le schéma réel de public.profils a été vérifié : identité en un seul champ `nom`
 * (pas de `prenom` séparé), rôle en texte libre (`agent`, `coach`, `superviseur`, `admin`,
 * `super_admin`), `equipe_id` / `superviseur_id` / `admin_id` en uuid.
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
/**
 * Récupère les plannings du jour (agents effectivement planifiés, heure_debut non NULL)
 * avec l'identité de l'agent et son équipe.
 *
 * IMPORTANT : plannings.agent_id référence public.profils_planning (la table d'identité
 * propre à Méridien : nom_complet, matricule, equipe_id, superviseur_id — PAS public.profils
 * d'Auréo directement, même si les deux partagent probablement le même id). Confirmé en
 * production : joindre "profils:agent_id(nom, ...)" échoue avec
 * "column profils_planning_1.nom does not exist", PostgREST résolvant l'alias vers la vraie
 * cible de la contrainte de clé étrangère (profils_planning), pas vers le nom de l'alias choisi.
 */
export async function getPlanningsForDate(date) {
  const { data, error } = await supabase
    .from('plannings')
    .select(`
      id, agent_id, date, heure_debut, heure_fin,
      profils_planning:agent_id ( id, nom_complet, equipe_id,
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
        nom: p.profils_planning?.nom_complet ?? '',
        equipe: p.profils_planning?.equipes?.nom ?? null,
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
 *
 * assiduite_statuts_jour n'est peuplée pour une date donnée qu'après le passage du cron
 * horizon_calcul_jour (19h00 GMT) — si la plage couvre aujourd'hui, la ligne du jour n'existe
 * donc pas encore la majeure partie de la journée. On exclut la ligne d'aujourd'hui si elle
 * existe déjà (cron déjà passé) et on la recalcule systématiquement en direct via
 * getDailyView(), pour ne jamais la compter deux fois tout en restant à jour avant 19h.
 */
export async function getWeeklyLateCounts(weekStartDate, weekEndDate) {
  const { data, error } = await supabase
    .from('assiduite_statuts_jour')
    .select('agent_id, date, statut, profils:agent_id ( nom, equipe_id, equipes:equipe_id ( nom ) )')
    .eq('statut', 'retard')
    .gte('date', weekStartDate)
    .lte('date', weekEndDate)

  if (error) throw error

  const today = new Date().toISOString().slice(0, 10)
  const includesToday = today >= weekStartDate && today <= weekEndDate

  const byAgent = {}
  for (const row of data) {
    if (includesToday && row.date === today) continue
    byAgent[row.agent_id] ??= { agentId: row.agent_id, nom: row.profils?.nom ?? '', equipe: row.profils?.equipes?.nom ?? null, dates: [] }
    byAgent[row.agent_id].dates.push(row.date)
  }

  if (includesToday) {
    const liveToday = await getDailyView(today)
    for (const r of liveToday) {
      if (r.statut !== 'retard') continue
      byAgent[r.agentId] ??= { agentId: r.agentId, nom: r.nom, equipe: r.equipe, dates: [] }
      byAgent[r.agentId].dates.push(today)
    }
  }

  return Object.values(byAgent).map((a) => ({ ...a, total: a.dates.length, seuilDepasse: a.dates.length > 3 }))
}

/**
 * Synthèse par agent sur une plage de dates arbitraire (pas seulement calendaire — utilisée
 * aussi bien pour la semaine que pour le mois) — écran "Mois" + export PDF/Excel, et donuts
 * Semaine/Mois.
 *
 * Même limitation que getWeeklyLateCounts : assiduite_statuts_jour n'a pas encore la ligne du
 * jour tant que le cron horizon_calcul_jour (19h00 GMT) n'est pas passé. Si la plage inclut
 * aujourd'hui, on exclut sa ligne éventuelle et on calcule sa contribution en direct via
 * getDailyView(), pour que Semaine/Mois reflètent la production en cours comme le fait déjà
 * la vue Jour, sans jamais compter aujourd'hui deux fois.
 */
export async function getMonthlyReport(monthStartDate, monthEndDate) {
  const { data, error } = await supabase
    .from('assiduite_statuts_jour')
    .select('agent_id, date, statut, profils:agent_id ( nom, equipe_id, equipes:equipe_id ( nom ) )')
    .gte('date', monthStartDate)
    .lte('date', monthEndDate)

  if (error) throw error

  const today = new Date().toISOString().slice(0, 10)
  const includesToday = today >= monthStartDate && today <= monthEndDate

  const byAgent = {}
  function ensure(id, nom, equipe) {
    byAgent[id] ??= { agentId: id, nom, equipe, present: 0, retard: 0, absentInjustifie: 0, absentJustifie: 0, total: 0 }
    return byAgent[id]
  }

  for (const row of data) {
    if (includesToday && row.date === today) continue
    const a = ensure(row.agent_id, row.profils?.nom ?? '', row.profils?.equipes?.nom ?? null)
    a.total += 1
    if (row.statut === 'present') a.present += 1
    if (row.statut === 'retard') a.retard += 1
    if (row.statut === 'absent_injustifie') a.absentInjustifie += 1
    if (row.statut === 'absent_justifie') a.absentJustifie += 1
  }

  if (includesToday) {
    const liveToday = await getDailyView(today)
    for (const r of liveToday) {
      const a = ensure(r.agentId, r.nom, r.equipe)
      a.total += 1
      if (r.statut === 'present') a.present += 1
      if (r.statut === 'retard') a.retard += 1
      if (r.statut === 'absent_injustifie') a.absentInjustifie += 1
      // les requalifications "absent_justifie" du jour même ne sont possibles qu'une fois la
      // ligne écrite par le cron — non représentées dans le calcul en direct.
    }
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
    .select('id, type, agent_id, date_reference, lu, created_at, profils:agent_id ( nom )')
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
/**
 * Nombre total de statuts "retard" sur une période (mois en cours) — carte KPI de la vue du jour.
 * Le filtrage par équipe pour coach/superviseur est déjà appliqué automatiquement par les
 * policies RLS sur assiduite_statuts_jour — pas besoin de le refaire ici côté client.
 *
 * Même limitation que getMonthlyReport/getWeeklyLateCounts : la ligne du jour même n'existe
 * dans assiduite_statuts_jour qu'après le cron horizon_calcul_jour (19h00 GMT). Si la période
 * inclut aujourd'hui, on l'exclut du count et on ajoute sa contribution en direct via
 * getDailyView(), pour rester cohérent avec les vues Semaine/Mois.
 */
export async function getMonthRetardTotal(monthStartDate, monthEndDate) {
  const today = new Date().toISOString().slice(0, 10)
  const includesToday = today >= monthStartDate && today <= monthEndDate

  let query = supabase
    .from('assiduite_statuts_jour')
    .select('id', { count: 'exact', head: true })
    .eq('statut', 'retard')
    .gte('date', monthStartDate)
    .lte('date', monthEndDate)

  if (includesToday) query = query.neq('date', today)

  const { count, error } = await query
  if (error) throw error

  let total = count ?? 0
  if (includesToday) {
    const liveToday = await getDailyView(today)
    total += liveToday.filter((r) => r.statut === 'retard').length
  }
  return total
}

/**
 * Nombre de retards par jour sur les N derniers jours — alimente le sparkline de la vue du jour.
 * Le dernier point (aujourd'hui) est toujours recalculé en direct via getDailyView() : sa ligne
 * n'existe pas encore dans assiduite_statuts_jour avant le passage du cron horizon_calcul_jour
 * (19h00 GMT).
 */
export async function getDailyRetardTrend(days = 10) {
  const end = new Date()
  const start = new Date()
  start.setDate(end.getDate() - (days - 1))
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const { data, error } = await supabase
    .from('assiduite_statuts_jour')
    .select('date, statut')
    .eq('statut', 'retard')
    .neq('date', endDate)
    .gte('date', startDate)
    .lte('date', endDate)

  if (error) throw error

  const byDate = {}
  for (const row of data) byDate[row.date] = (byDate[row.date] ?? 0) + 1

  const liveToday = await getDailyView(endDate)
  byDate[endDate] = liveToday.filter((r) => r.statut === 'retard').length

  const series = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const key = d.toISOString().slice(0, 10)
    series.push({ date: key, count: byDate[key] ?? 0 })
  }
  return series
}

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
    .select('id, nom, equipe_id, equipes:equipe_id ( id, nom, coach_id )')
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
