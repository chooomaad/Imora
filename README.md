# Imora — إيمورا

**La plateforme immobilière de référence en Mauritanie.** Achat, location, investissement, visites 360° / 3D, IA, leads et commissions.

Monorepo :

| Dossier | Contenu |
|---|---|
| `apps/web` | Next.js 15 (App Router) · TypeScript · Tailwind v4 · next-intl (FR / AR RTL) · MapLibre · Three.js |
| `apps/mobile` | Expo SDK 57 · Expo Router · React Native Maps · même i18n et mêmes RPC que le web |
| `packages/shared` | Types du domaine, schéma Zod des filtres, formatage MRU, géographie, **traductions FR/AR** |
| `supabase/migrations` | Schéma PostgreSQL complet (PostGIS, pgvector), RLS, fonctions métier, stockage |
| `supabase/functions` | Edge Functions Deno : `ai-search`, `image-search`, `ai-vision`, `embed-properties`, `notify-push` |
| `supabase/seed.sql` | Données **DÉMO** (≈60 biens, agences, promoteur, visite 360° complète) |
| `supabase/tests` | Test de la base sur PGlite (Postgres WASM) : migrations + seed + 41 vérifications RPC/RLS |

## Démarrage

```bash
npm install

# 1. Supabase (projet hébergé ou local avec Docker)
npx supabase link --project-ref <ref>
npx supabase db push                 # migrations
npx supabase db reset --linked       # ⚠ dev uniquement : réapplique migrations + seed DÉMO
npm run sync:edge                    # copie domain/filters/geo partagés pour Deno
npx supabase functions deploy ai-search image-search ai-vision embed-properties notify-push
npx supabase secrets set ANTHROPIC_API_KEY=... VOYAGE_API_KEY=... CRON_SECRET=... WEBHOOK_SECRET=...

# 2. Web
cp apps/web/.env.example apps/web/.env.local   # URL + clé anon Supabase
npm run dev                                    # http://localhost:3000

# 3. Mobile
cp apps/mobile/.env.example apps/mobile/.env
npm run dev:mobile
```

Comptes de démonstration (seed) : `client@`, `owner1@`, `baraka@` (agence), `agent@`, `promoteur@`, `admin@demo.imora.mr`, mot de passe `ImoraDemo2026!`. Pour les afficher sur la page de connexion : `NEXT_PUBLIC_SHOW_DEMO_ACCOUNTS=true`.

Après le seed, appelez une fois `embed-properties` (en tant qu'admin, ou avec l'en-tête `x-cron-secret`) pour calculer les embeddings. Ils alimentent la recherche par photo et les recommandations sémantiques.

## Vérifications

```bash
npm run typecheck     # web + mobile + shared
npm run lint
npm run build         # build de production web
npm run check:i18n    # parité des clés FR/AR
npm run check:edge    # deno check des Edge Functions
npm run test:db       # migrations + seed + 41 vérifications RPC/RLS sur PGlite
```

## Sécurité (résumé)

- **RLS sur toutes les tables.** Le public ne voit que les biens `published`. Les écritures sensibles (rôles, leads, commissions, vérifications, visites, transactions) passent par des fonctions `SECURITY DEFINER` qui revérifient `auth.uid()`.
- **Le rôle n'est jamais pris du frontend.** Tout compte est créé en `client`. `choose_role()` n'accepte que les rôles auto-attribuables. `agent` est attribué par une agence et `admin` manuellement.
- **Les numéros de téléphone ne sont jamais publics** : `profile_contacts` est privé, et les colonnes téléphone des agences et promoteurs sont retirées des rôles API. Seul `reveal_contact()` les renvoie, après confirmation ; il enregistre un `phone_reveal` + lead et applique une limite quotidienne.
- **Coordonnées exactes privées** si le propriétaire le demande : décalage déterministe d'environ 150 m côté public.
- **Documents dans un bucket privé**, accès réservé aux gestionnaires du bien et aux admins. Pièces jointes de messagerie dans un bucket privé, réservé aux participants (URLs signées).
- **Clés IA uniquement dans les secrets des Edge Functions.** Le modèle ne touche jamais la base : sa sortie JSON (sorties structurées) est validée par le schéma Zod partagé avant toute requête.
- **Suggestions IA (description, pièces, équipements) toujours en attente.** Le propriétaire accepte, modifie ou refuse.

## État par phase

| Phase | Statut |
|---|---|
| 1. Architecture, design system, auth, DB, RLS, accueil, explorer, détail, profils | ✅ |
| 2. Carte PostGIS + clustering, favoris, recherches sauvegardées (notifications), visites, numéro propriétaire, leads | ✅ |
| 3. Visite 360° (Three.js, hotspots, gyroscope, WebXR, plein écran), plan 2D synchronisé, mesures, 3D Libre (maquette générée depuis le plan, ou GLB), Tour Builder en 8 étapes | ✅ |
| 4. Recherche IA naturelle, IA Vision (suggestions validées), recherche par photo (pgvector), recommandations (signaux utilisateur + embeddings) | ✅ code. ⚠ non exécuté sans clés API |
| 5. Pages agence et promoteur/projets, investissement (indicatif), estimation par comparables, statistiques pro | ✅ |
| 6. Transactions à double confirmation, commissions configurables (%, fixe, fraction du loyer), paiements de commission, admin (KPIs, modération, vérifications, signalements, règles, utilisateurs, paramètres) | ✅ |
| Abonnements | Schéma + plans + KPIs. ⏳ Pas encore de connecteur de paiement (Bankily / Masrvi / Sedad) |
| Mobile | Onglets, accueil + IA, explorer, carte, détail (numéro, visite, WhatsApp), visites 3D (moteur web embarqué), push Expo. ⏳ Espace pro et admin : web uniquement pour l'instant |

## Notes

- **Logo** : reproduit en SVG d'après les maquettes (`apps/web/src/components/Logo.tsx`). À remplacer par le fichier officiel.
- **Médias de démo** : photos Unsplash et panoramas Poly Haven (CC0), hotlinkés. Ils sont **marqués DÉMO** dans l'interface.
- **Cartes** : tuiles OpenFreeMap (sans clé). `NEXT_PUBLIC_MAP_STYLE_URL` permet de passer à MapTiler/Mapbox.
- **Anglais** : ajouter `en` dans `apps/web/src/i18n/routing.ts` et `packages/shared/src/i18n/en.json`.
