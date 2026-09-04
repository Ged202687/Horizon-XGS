-- ============================================================================
-- Horizon — 002 : Fonctions de périmètre + RLS
-- ============================================================================

-- Rôle de l'utilisateur courant (profils.id = auth.users.id, confirmé côté Auréo)
create or replace function public.horizon_my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profils where id = auth.uid();
$$;

-- Équipes visibles par l'utilisateur courant selon son rôle :
--  - coach       : son unique équipe (equipes.coach_id = moi)
--  - superviseur : les équipes des coachs qu'il supervise (coach.superviseur_id = moi)
-- Non utilisée pour admin/super_admin, qui voient tout (cf. policies plus bas).
create or replace function public.horizon_my_team_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.equipes where coach_id = auth.uid()
  union
  select e.id
  from public.equipes e
  join public.profils c on c.id = e.coach_id
  where c.superviseur_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- assiduite_statuts_jour
-- ----------------------------------------------------------------------------
alter table public.assiduite_statuts_jour enable row level security;

drop policy if exists "select assiduite_statuts_jour" on public.assiduite_statuts_jour;
create policy "select assiduite_statuts_jour"
  on public.assiduite_statuts_jour
  for select
  using (
    horizon_my_role() in ('admin', 'super_admin')
    or (
      horizon_my_role() in ('coach', 'superviseur')
      and agent_id in (
        select id from public.profils where equipe_id in (select horizon_my_team_ids())
      )
    )
    or agent_id = auth.uid()  -- un agent voit son propre historique
  );

-- Seule la justification (statut -> absent_justifie + motif) est modifiable, et uniquement
-- par admin/super_admin. La contrainte sur les colonnes modifiables est gérée côté application
-- (attendance.js ne touche jamais heure_reelle/statut hors justification) ; RLS garde le rôle.
drop policy if exists "update assiduite_statuts_jour" on public.assiduite_statuts_jour;
create policy "update assiduite_statuts_jour"
  on public.assiduite_statuts_jour
  for update
  using (horizon_my_role() in ('admin', 'super_admin'))
  with check (horizon_my_role() in ('admin', 'super_admin'));

-- Aucune policy INSERT pour les rôles authentifiés : l'écriture initiale des statuts du jour
-- se fait uniquement via la fonction horizon_calcul_jour() (SECURITY DEFINER, cf. 003), qui
-- contourne RLS en tant que propriétaire de la fonction — pas besoin d'ouvrir INSERT ici.

-- ----------------------------------------------------------------------------
-- assiduite_notifications
-- ----------------------------------------------------------------------------
alter table public.assiduite_notifications enable row level security;

drop policy if exists "select assiduite_notifications" on public.assiduite_notifications;
create policy "select assiduite_notifications"
  on public.assiduite_notifications
  for select
  using (destinataire_id = auth.uid());

-- Marquer comme lue : uniquement sa propre notification, uniquement le champ `lu`
-- (la vérification que seul `lu` change se fait côté application ; RLS garde le périmètre).
drop policy if exists "update assiduite_notifications" on public.assiduite_notifications;
create policy "update assiduite_notifications"
  on public.assiduite_notifications
  for update
  using (destinataire_id = auth.uid())
  with check (destinataire_id = auth.uid());

-- Pas de policy INSERT : les notifications sont créées uniquement par les fonctions cron
-- (SECURITY DEFINER, cf. 003).
