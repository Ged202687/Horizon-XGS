-- ============================================================================
-- Horizon — 003 : Fonctions métier (appelées par les tâches planifiées, cf. 004)
-- ============================================================================

-- Résout la chaîne de destinataires d'une notification pour un agent donné :
-- coach de son équipe, superviseur de ce coach, admin de ce superviseur,
-- + tous les super_admin (diffusion large, comme cadré avec Djadji).
create or replace function public.horizon_resolve_recipients(p_agent_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  with agent as (
    select equipe_id from public.profils where id = p_agent_id
  ),
  coach as (
    select e.coach_id from public.equipes e join agent a on a.equipe_id = e.id
  ),
  sup as (
    select c.superviseur_id from public.profils c join coach on c.id = coach.coach_id
  ),
  adm as (
    select s.admin_id from public.profils s join sup on s.id = sup.superviseur_id
  )
  select coach_id from coach where coach_id is not null
  union
  select superviseur_id from sup where superviseur_id is not null
  union
  select admin_id from adm where admin_id is not null
  union
  select id from public.profils where role = 'super_admin';
$$;


-- ----------------------------------------------------------------------------
-- 1) horizon_check_absences_10h — quotidien, 10h00 (cf. 004, pg_cron tourne en UTC = GMT)
--    Agents planifiés aujourd'hui sans aucun passage "en_prod" détecté à l'heure d'exécution.
-- ----------------------------------------------------------------------------
create or replace function public.horizon_check_absences_10h(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  recipient uuid;
begin
  for r in
    select p.agent_id
    from public.plannings p
    where p.date = p_date
      and p.heure_debut is not null
      and not exists (
        select 1 from public.statuts_historique sh
        where sh.agent_id = p.agent_id
          and sh.statut = 'en_prod'
          and sh.debut::date = p_date
      )
  loop
    for recipient in select * from public.horizon_resolve_recipients(r.agent_id)
    loop
      insert into public.assiduite_notifications (type, agent_id, destinataire_id, date_reference)
      values ('absence_jour', r.agent_id, recipient, p_date)
      on conflict (type, agent_id, destinataire_id, date_reference) do nothing;
    end loop;
  end loop;
end;
$$;


-- ----------------------------------------------------------------------------
-- 2) horizon_calcul_jour — quotidien, 19h00 GMT
--    Calcule le statut définitif (présent / retard / absent_injustifié) de chaque agent
--    planifié ce jour, à partir du 1er passage "en_prod" détecté dans statuts_historique.
--    Ne touche jamais une ligne déjà "absent_justifie" (justification manuelle antérieure).
-- ----------------------------------------------------------------------------
create or replace function public.horizon_calcul_jour(p_date date default current_date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_premiere timestamptz;
  v_statut text;
begin
  for r in
    select p.id as planning_id, p.agent_id, p.heure_debut
    from public.plannings p
    where p.date = p_date
      and p.heure_debut is not null
  loop
    select min(sh.debut) into v_premiere
    from public.statuts_historique sh
    where sh.agent_id = r.agent_id
      and sh.statut = 'en_prod'
      and sh.debut::date = p_date;

    if v_premiere is null then
      v_statut := 'absent_injustifie';
    -- NB : suppose que le fuseau de la session (UTC) correspond à l'heure d'Abidjan (GMT, pas de DST).
    elsif v_premiere::time <= (r.heure_debut + interval '5 minutes') then
      v_statut := 'present';
    else
      v_statut := 'retard';
    end if;

    insert into public.assiduite_statuts_jour (agent_id, planning_id, date, heure_prevue, heure_reelle, statut)
    values (r.agent_id, r.planning_id, p_date, r.heure_debut, v_premiere, v_statut)
    on conflict (agent_id, date) do update
      set planning_id = excluded.planning_id,
          heure_prevue = excluded.heure_prevue,
          heure_reelle = excluded.heure_reelle,
          statut = case
            when public.assiduite_statuts_jour.statut = 'absent_justifie'
              then public.assiduite_statuts_jour.statut  -- ne jamais écraser une justification
            else excluded.statut
          end;
  end loop;
end;
$$;


-- ----------------------------------------------------------------------------
-- 3) horizon_check_retards_semaine — hebdomadaire, lundi 06h00 GMT
--    Compte les statuts "retard" de la semaine écoulée (assiduite_statuts_jour, déjà calculée
--    quotidiennement par horizon_calcul_jour) et notifie au-delà de 3.
--    Semaine = lundi à dimanche (production 7j/7, pas seulement en semaine).
-- ----------------------------------------------------------------------------
create or replace function public.horizon_check_retards_semaine(
  p_week_start date default (date_trunc('week', current_date))::date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_week_end date := p_week_start + 6; -- lundi + 6 jours = dimanche
  r record;
  recipient uuid;
begin
  for r in
    select agent_id, count(*) as total
    from public.assiduite_statuts_jour
    where statut = 'retard'
      and date between p_week_start and v_week_end
    group by agent_id
    having count(*) > 3
  loop
    for recipient in select * from public.horizon_resolve_recipients(r.agent_id)
    loop
      insert into public.assiduite_notifications (type, agent_id, destinataire_id, date_reference)
      values ('retards_semaine', r.agent_id, recipient, p_week_start)
      on conflict (type, agent_id, destinataire_id, date_reference) do nothing;
    end loop;
  end loop;
end;
$$;
