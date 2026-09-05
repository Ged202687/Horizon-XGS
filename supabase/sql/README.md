# SQL Horizon — à exécuter dans Supabase Studio (SQL Editor)

Exécuter dans l'ordre, sur le projet Supabase d'Auréo/Méridien (même base) :

1. **`001_tables.sql`** — crée `assiduite_statuts_jour` et `assiduite_notifications`.
2. **`002_rls.sql`** — active Row Level Security et les policies de lecture/écriture par rôle
   (`super_admin`/`admin` : accès complet ; `coach`/`superviseur` : lecture limitée à leur
   équipe ; agent : lecture de son propre historique).
3. **`003_functions.sql`** — les 3 fonctions métier appelées par les tâches planifiées :
   `horizon_check_absences_10h()`, `horizon_calcul_jour()`, `horizon_check_retards_semaine()`.
4. **`004_cron.sql`** — active `pg_cron` et planifie les 3 tâches. **pg_cron tourne en UTC**,
   qui correspond directement à l'heure d'Abidjan (GMT, pas de changement d'heure) — aucune
   conversion nécessaire.
5. **`005_justification.sql`** — RPC `horizon_justifier_absence()` (permet à un admin/super_admin
   de justifier une absence immédiatement, même avant le passage du cron `horizon_calcul_jour`,
   sans policy INSERT à ouvrir) + active Realtime sur `assiduite_statuts_jour` (nécessaire pour
   que la session agent en lecture seule se mette à jour automatiquement).

## Hypothèses à vérifier avant exécution

- La fenêtre de tolérance "présent" (5 minutes) est codée en dur dans
  `horizon_calcul_jour()` — à ajuster si besoin dans le fichier avant exécution.
- `horizon_resolve_recipients()` remonte la chaîne `agent → équipe → coach → superviseur →
  admin`, plus tous les `super_admin` en diffusion large. Si un agent ou un coach n'a pas de
  superviseur/admin renseigné dans `profils`, ce maillon est simplement absent de la
  notification (pas d'erreur).
- Les fonctions sont `security definer` : elles s'exécutent avec les droits du propriétaire
  (généralement `postgres`), donc elles contournent RLS pour écrire — c'est voulu, pour que
  les tâches planifiées puissent insérer sans avoir besoin d'un rôle authentifié particulier.

## Test manuel avant d'attendre le prochain déclenchement planifié

```sql
select public.horizon_calcul_jour(current_date - 1); -- recalcule hier, par exemple
select public.horizon_check_absences_10h(current_date);
select public.horizon_check_retards_semaine();
```
