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

- **Schéma `public.profils`** : les colonnes `role`, `equipe_id`, `auth_id`, `nom`, `prenom`
  utilisées dans `AuthContext.jsx` et `attendance.js` sont des hypothèses — à faire correspondre
  au schéma réel (cf. table déjà utilisée par Auréo/Méridien).
- **Nouvelles tables Supabase** à créer (cf. cadrage) :
  - `assiduite_statuts_jour` (agent_id, planning_id, date, heure_prevue, heure_reelle, statut,
    motif_justification, commentaire_justification, justifie_par, justifie_le, created_at)
  - `assiduite_notifications` (type, agent_id, destinataire_id, date_reference, lu, created_at)
- **RLS (Row Level Security)** sur ces deux tables : lecture limitée à l'équipe pour
  coach/superviseur, écriture réservée à admin/super_admin sur `assiduite_statuts_jour`.
- **3 tâches planifiées** (Supabase Edge Functions + `pg_cron`, ou Scheduled Triggers Supabase) :
  - `horizon-check-absences-10h` — 10h00 GMT, quotidien
  - `horizon-calcul-jour` — 19h00 GMT, quotidien
  - `horizon-check-retards-semaine` — lundi 06h00 GMT, hebdomadaire

  La requête SQL de référence pour le calcul quotidien est documentée en commentaire dans
  `src/lib/attendance.js` (fonction `getDailyView`) — à convertir en fonction RPC Postgres
  appelée par les Edge Functions plutôt que la version client (boucle) utilisée ici pour le
  scaffold.
- **Export PDF / Excel** de l'écran Mois (`src/pages/MonthView.jsx`) : non implémenté, prévoir
  une librairie (ex. `jspdf` pour le PDF, `xlsx`/SheetJS pour Excel).
- **Connexion** : `AuthContext.signIn` suppose une auth Supabase par email — à adapter si
  Auréo/Méridien utilisent un identifiant `login` différent de l'email (résolution login → email,
  ou fonction d'auth custom).

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
