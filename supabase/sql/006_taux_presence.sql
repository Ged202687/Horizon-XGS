-- ============================================================================
-- Horizon — 006 : Taux de présence au temps réel
-- ============================================================================
--
-- Jusqu'ici, le "taux de présence" affiché (donut, rapport mensuel) était une
-- proportion de JOURS marqués "présent" — un agent arrivé dans les 5 minutes suivant
-- son heure prévue comptait pour un jour "présent" entier, quelle que soit la durée
-- réellement passée en production ensuite.
--
-- Nouveau calcul : temps réellement passé en_prod sur la journée (somme des périodes
-- statuts_historique.statut = 'en_prod', bornées à la date), divisé par le temps
-- nominal prévu au planning (heure_fin - heure_debut).
--
-- Important — ce que ce fichier NE change PAS : le statut quotidien catégoriel
-- (présent / retard / absence injustifiée / justifiée) reste calculé exactement comme
-- avant (heure d'arrivée ± 5 min de tolérance) — inchangé pour les notifications, le
-- bouton "Justifier" et les badges. Seul le pourcentage numérique de "taux de présence"
-- change de mode de calcul.

alter table public.assiduite_statuts_jour
  add column if not exists temps_presence_secondes integer,
  add column if not exists temps_prevu_secondes integer;

comment on column public.assiduite_statuts_jour.temps_presence_secondes is
  'Somme des durées en_prod (statuts_historique) sur la journée, en secondes.';
comment on column public.assiduite_statuts_jour.temps_prevu_secondes is
  'Durée nominale prévue au planning (heure_fin - heure_debut), en secondes.';

-- ----------------------------------------------------------------------------
-- horizon_calcul_jour — mise à jour : calcule aussi temps_presence_secondes et
-- temps_prevu_secondes, en plus du statut catégoriel (logique de statut inchangée).
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
  v_temps_presence integer;
  v_temps_prevu integer;
begin
  for r in
    select p.id as planning_id, p.agent_id, p.heure_debut, p.heure_fin
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

    -- Temps réellement passé en_prod ce jour-là : somme des périodes, bornée à
    -- now() pour une période encore ouverte (fin non renseignée) — pertinent
    -- seulement si p_date = aujourd'hui et le calcul tourne avant la fin du poste.
    select coalesce(sum(extract(epoch from (coalesce(sh.fin, now()) - sh.debut))), 0)::int
      into v_temps_presence
    from public.statuts_historique sh
    where sh.agent_id = r.agent_id
      and sh.statut = 'en_prod'
      and sh.debut::date = p_date;

    v_temps_prevu := case
      when r.heure_fin is not null and r.heure_fin > r.heure_debut
        then extract(epoch from (r.heure_fin - r.heure_debut))::int
      else null
    end;

    insert into public.assiduite_statuts_jour
      (agent_id, planning_id, date, heure_prevue, heure_reelle, statut,
       temps_presence_secondes, temps_prevu_secondes)
    values
      (r.agent_id, r.planning_id, p_date, r.heure_debut, v_premiere, v_statut,
       v_temps_presence, v_temps_prevu)
    on conflict (agent_id, date) do update
      set planning_id = excluded.planning_id,
          heure_prevue = excluded.heure_prevue,
          heure_reelle = excluded.heure_reelle,
          temps_presence_secondes = excluded.temps_presence_secondes,
          temps_prevu_secondes = excluded.temps_prevu_secondes,
          statut = case
            when public.assiduite_statuts_jour.statut = 'absent_justifie'
              then public.assiduite_statuts_jour.statut  -- ne jamais écraser une justification
            else excluded.statut
          end;
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Backfill (optionnel mais recommandé) : recalcule les jours déjà passés du mois en
-- cours pour qu'ils aient aussi temps_presence_secondes/temps_prevu_secondes, sans
-- quoi ils resteront à NULL (exclus du taux) jusqu'à leur prochain recalcul naturel.
-- À exécuter une fois après ce script, ajuster la date de départ si besoin.
-- ----------------------------------------------------------------------------
-- do $$
-- declare d date;
-- begin
--   for d in select generate_series(date_trunc('month', current_date)::date, current_date, interval '1 day')::date
--   loop
--     perform public.horizon_calcul_jour(d);
--   end loop;
-- end $$;
