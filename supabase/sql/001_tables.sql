-- ============================================================================
-- Horizon — 001 : Tables
-- À exécuter dans Supabase Studio > SQL Editor, sur le même projet qu'Auréo/Méridien.
-- ============================================================================

create table if not exists public.assiduite_statuts_jour (
  id                          uuid primary key default gen_random_uuid(),
  agent_id                    uuid not null references public.profils(id) on delete cascade,
  planning_id                 uuid references public.plannings(id) on delete set null,
  date                        date not null,
  heure_prevue                time,
  heure_reelle                timestamptz,
  statut                      text not null check (statut in ('present', 'retard', 'absent_injustifie', 'absent_justifie')),
  motif_justification         text,
  commentaire_justification   text,
  justifie_par                uuid references public.profils(id),
  justifie_le                 timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),
  unique (agent_id, date)
);

comment on table public.assiduite_statuts_jour is
  'Statut d''assiduité calculé par agent et par jour (Horizon). Une ligne par agent planifié par jour.';

create index if not exists idx_assiduite_statuts_jour_date on public.assiduite_statuts_jour (date);
create index if not exists idx_assiduite_statuts_jour_agent on public.assiduite_statuts_jour (agent_id);
create index if not exists idx_assiduite_statuts_jour_statut on public.assiduite_statuts_jour (statut);

-- Maintient updated_at à jour automatiquement (utile pour le suivi des justifications a posteriori)
create or replace function public.horizon_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_assiduite_statuts_jour_updated_at on public.assiduite_statuts_jour;
create trigger trg_assiduite_statuts_jour_updated_at
  before update on public.assiduite_statuts_jour
  for each row execute function public.horizon_set_updated_at();


create table if not exists public.assiduite_notifications (
  id               uuid primary key default gen_random_uuid(),
  type             text not null check (type in ('absence_jour', 'retards_semaine')),
  agent_id         uuid not null references public.profils(id) on delete cascade,
  destinataire_id  uuid not null references public.profils(id) on delete cascade,
  date_reference   date not null,
  lu               boolean not null default false,
  created_at       timestamptz not null default now()
);

comment on table public.assiduite_notifications is
  'Une ligne par destinataire et par événement (absence du jour à 10h, seuil de retards hebdo dépassé).';

create index if not exists idx_assiduite_notifications_destinataire on public.assiduite_notifications (destinataire_id, lu);
create index if not exists idx_assiduite_notifications_agent on public.assiduite_notifications (agent_id, date_reference);

-- Évite de renotifier deux fois le même événement pour le même destinataire le même jour
create unique index if not exists uq_assiduite_notifications_dedupe
  on public.assiduite_notifications (type, agent_id, destinataire_id, date_reference);
