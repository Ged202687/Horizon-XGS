-- ============================================================================
-- Horizon — 005 : Justification immédiate + Realtime
-- ============================================================================

-- Aucune policy INSERT n'existe sur assiduite_statuts_jour pour les rôles authentifiés
-- (cf. 002_rls.sql : seul horizon_calcul_jour(), en SECURITY DEFINER, peut insérer). Avant le
-- passage de ce cron (19h00 GMT), la ligne du jour même n'existe donc pas encore — un admin qui
-- justifie une absence "en direct" avant cette heure ne peut pas s'appuyer sur un UPDATE.
--
-- Cette fonction couvre les deux cas (ligne déjà présente ou non) via un upsert exécuté en
-- SECURITY DEFINER (contourne RLS comme les autres fonctions métier), en vérifiant elle-même le
-- rôle de l'appelant.
--
-- IMPORTANT (sécurité) : coalesce(horizon_my_role(), '') — un appel non authentifié (ou dont le
-- rôle ne se résout pas) donne horizon_my_role() = NULL ; "NULL not in (...)" s'évalue à NULL,
-- que PL/pgSQL traite comme faux dans un IF (l'exception ne serait alors jamais levée). Le
-- coalesce force une valeur non NULL pour que la vérification rejette bien ce cas.
create or replace function public.horizon_justifier_absence(
  p_agent_id uuid,
  p_planning_id uuid,
  p_date date,
  p_heure_prevue time,
  p_heure_reelle timestamptz,
  p_motif text,
  p_commentaire text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(horizon_my_role(), '') not in ('admin', 'super_admin') then
    raise exception 'Non autorisé';
  end if;

  insert into public.assiduite_statuts_jour
    (agent_id, planning_id, date, heure_prevue, heure_reelle, statut,
     motif_justification, commentaire_justification, justifie_par, justifie_le)
  values
    (p_agent_id, p_planning_id, p_date, p_heure_prevue, p_heure_reelle, 'absent_justifie',
     p_motif, p_commentaire, auth.uid(), now())
  on conflict (agent_id, date) do update
    set statut = 'absent_justifie',
        motif_justification = excluded.motif_justification,
        commentaire_justification = excluded.commentaire_justification,
        justifie_par = excluded.justifie_par,
        justifie_le = excluded.justifie_le;
end;
$$;

-- Retire le droit d'exécution accordé par défaut à PUBLIC (comportement Postgres standard pour
-- toute nouvelle fonction) avant de l'accorder explicitement, et seulement aux utilisateurs
-- authentifiés — surtout pas à `anon`, qui n'a pas de compte du tout.
revoke execute on function public.horizon_justifier_absence(uuid, uuid, date, time, timestamptz, text, text)
  from public;
grant execute on function public.horizon_justifier_absence(uuid, uuid, date, time, timestamptz, text, text)
  to authenticated;

-- ----------------------------------------------------------------------------
-- Realtime : nécessaire pour que la session agent (lecture seule) se mette à jour
-- automatiquement quand un admin/super_admin justifie une absence.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'assiduite_statuts_jour'
  ) then
    alter publication supabase_realtime add table public.assiduite_statuts_jour;
  end if;
end $$;
