# Horizon — Suivi d'assiduité (XGS)

Application interne XGS de suivi d'assiduité des agents, basée sur le passage en statut
**Production** dans Auréo. Stack : React (Vite) + Supabase + Cloudflare Pages — même stack
que Auréo et Méridien, même base Supabase.

## 1. Mise en route locale

```bash
npm install
cp .env.example .env
# renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY (projet Supabase de Auréo/Méridien)
npm run dev
```

## 2. Ce qu'il reste à câbler avant la prod

Ce scaffold pose la structure et la logique de requêtes (`src/lib/attendance.js`), mais
plusieurs points doivent être vérifiés/complétés avant mise en production :

- **Schéma `public.profils`** — confirmé :
  - `id` (uuid), `matricule`, `nom` (nom complet en un seul champ, pas de `prenom` séparé),
    `login`, `role` (text : `agent`, `coach`, `super_admin`, probablement aussi `superviseur`
    et `admin`), `actif`, `equipe_id` → `equipes`, `superviseur_id`, `admin_id`, `created_at`,
    `doit_changer_mdp`.
- **Authentification** — résolue en clonant le repo GitHub d'Auréo (`Ged202687/aureo-app`) :
  Auréo n'utilise pas le SDK `@supabase/supabase-js` pour l'auth mais appelle directement
  l'API GoTrue en REST. Le flux exact, reproduit dans `AuthContext.jsx` :
  1. RPC publique **`email_from_login(p_login)`** — résout le login saisi (ex. `s.sery`) en
     email interne, appelée avec le rôle anonyme (donc accessible avant connexion).
  2. `POST auth/v1/token?grant_type=password` avec cet email — authentification classique.
  3. **`profils.id = auth.users.id`** (confirmé dans le code source d'Auréo) — le profil est
     donc récupéré directement par l'id de l'utilisateur authentifié.
  - Rôles confirmés (texte libre dans `profils.role`) : `super_admin`, `admin`, `superviseur`,
    `coach`, `agent`.
- **Nouvelles tables Supabase** à créer (cf. cadrage) — **SQL prêt à l'emploi dans
  `supabase/sql/`** (voir `supabase/sql/README.md` pour l'ordre d'exécution) :
  - `assiduite_statuts_jour` (agent_id, planning_id, date, heure_prevue, heure_reelle, statut,
    motif_justification, commentaire_justification, justifie_par, justifie_le, created_at)
  - `assiduite_notifications` (type, agent_id, destinataire_id, date_reference, lu, created_at)
- **RLS (Row Level Security)** sur ces deux tables : lecture limitée à l'équipe pour
  coach/superviseur, écriture réservée à admin/super_admin sur `assiduite_statuts_jour`.
  **Déjà écrit dans `supabase/sql/002_rls.sql`.**
- **3 tâches planifiées**, implémentées en SQL/pg_cron (cohérent avec le style Auréo, tout en
  RPC Postgres plutôt qu'en Edge Functions) — **déjà écrites dans `supabase/sql/003_functions.sql`
  et `supabase/sql/004_cron.sql`** :
  - `horizon_check_absences_10h()` — 10h00 GMT, quotidien
  - `horizon_calcul_jour()` — 19h00 GMT, quotidien
  - `horizon_check_retards_semaine()` — lundi 06h00 GMT, hebdomadaire
- **Export PDF / Excel** de l'écran Mois (`src/pages/MonthView.jsx`) : non implémenté, prévoir
  une librairie (ex. `jspdf` pour le PDF, `xlsx`/SheetJS pour Excel).

## 3. Déploiement — GitHub → Cloudflare Pages

### a. Pousser le code sur GitHub

```bash
cd horizon-app
git init
git add .
git commit -m "Initial commit — scaffold Horizon"
git branch -M main
git remote add origin https://github.com/<votre-compte>/horizon.git
git push -u origin main
```

### b. Connecter le repo à Cloudflare Pages

1. Dans le dashboard Cloudflare → **Workers & Pages** → **Create application** → **Pages** →
   **Connect to Git**.
2. Sélectionner le repo `horizon`.
3. Paramètres de build :
   - **Framework preset** : `Vite`
   - **Build command** : `npm run build`
   - **Build output directory** : `dist`
4. **Variables d'environnement** (Settings → Environment variables), à renseigner pour
   Production et Preview :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. **Deploy**. Le fichier `public/_redirects` (`/* /index.html 200`) est déjà en place pour que
   le routage React (react-router) fonctionne correctement sur Cloudflare Pages.

### c. Domaine

Une fois le premier déploiement réussi, associer un sous-domaine dédié (ex.
`horizon.xgs-ci.com` ou équivalent) depuis l'onglet **Custom domains** de Cloudflare Pages —
à voir avec toi selon la convention déjà utilisée pour Auréo/Méridien.

## 4. Structure du projet

```
horizon-app/
├── public/
│   └── _redirects          # SPA fallback pour Cloudflare Pages
├── src/
│   ├── components/         # Header, StatusBadge…
│   ├── context/
│   │   └── AuthContext.jsx # session + rôle + équipe
│   ├── lib/
│   │   └── attendance.js   # toutes les requêtes Supabase + calcul de statut
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── DayView.jsx
│   │   ├── WeekView.jsx
│   │   ├── MonthView.jsx
│   │   └── AgentDetail.jsx
│   ├── styles/global.css   # design system Horizon (navy/or)
│   ├── App.jsx              # routage
│   └── main.jsx
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```
