-- ============================================================================
-- Horizon — 004 : Planification (pg_cron)
-- pg_cron tourne en UTC sur Supabase — comme Abidjan est en GMT (UTC+0, pas de
-- changement d'heure), les horaires ci-dessous correspondent directement aux
-- horaires GMT cadrés avec Djadji, sans conversion à faire.
-- ============================================================================

create extension if not exists pg_cron with schema extensions;

-- 1) Absences du jour — tous les jours à 10h00
select cron.schedule(
  'horizon-check-absences-10h',
  '0 10 * * *',
  $$ select public.horizon_check_absences_10h(); $$
);

-- 2) Calcul du statut définitif du jour — tous les jours à 19h00
select cron.schedule(
  'horizon-calcul-jour',
  '0 19 * * *',
  $$ select public.horizon_calcul_jour(); $$
);

-- 3) Retards cumulés de la semaine — chaque lundi à 06h00
select cron.schedule(
  'horizon-check-retards-semaine',
  '0 6 * * 1',
  $$ select public.horizon_check_retards_semaine(); $$
);

-- ----------------------------------------------------------------------------
-- Vérifier les jobs planifiés :
--   select * from cron.job;
--
-- Voir l'historique d'exécution (utile pour déboguer) :
--   select * from cron.job_run_details order by start_time desc limit 20;
--
-- Déplanifier un job si besoin :
--   select cron.unschedule('horizon-check-absences-10h');
-- ----------------------------------------------------------------------------
