# AcademyFlow

Application de gestion administrative et financière pour établissements scolaires (Bénin).
Electron + Vite + React + TypeScript + Tailwind CSS v4 + shadcn/ui.

## État du projet

**Phase 0 — Initialisation du projet** ✅
**Phase 1 — Base de données et ORM** ✅
**Phase 2 — Infrastructure IPC et services de base** ✅
**Phase 3 — Layout UI et Design System** ✅
**Phase 4 — Authentification** ✅
**Phase 5 — Module Paramètres** ✅ *(+ ajout Informations de l'établissement)*
**Phase 6 — Module Élèves** ✅

Inscription complète (formulaire multi-sections, détection de doublons en temps réel,
matricule auto-généré), liste avec recherche/filtres/export, fiche élève éditable
(infos, parcours scolaire, responsables), passage de classe atomique (promotion/
redoublement), génération de 4 documents PDF (attestation, certificat, fiche, liste
de classe) ouverts dans la visionneuse système.
Voir `implementation_plan.md` (fourni séparément) pour le détail des phases suivantes.

> **Pas de nouvelle migration requise** pour cette phase (aucune colonne/table ajoutée).

> **Note sur le matricule élève** : le format a été revu pendant la Phase 3 — c'est
> désormais un identifiant numérique séquentiel à 8 chiffres (ex: `10052724`), et non
> plus `AF-2026-00001` comme proposé initialement en Phase 2. `matricule.service.ts`
> et `formatMatricule()` sont alignés sur ce format.

## Prérequis

- Node.js ≥ 20 (Node 22 LTS recommandé — évite les problèmes de compilation native sur Windows)
- npm ≥ 10

## Installation

```bash
npm install
```

> Note : `better-sqlite3` compile un module natif au moment de l'installation.
> Sur Windows, utilisez de préférence Node 22 LTS (binaire précompilé disponible).
> Si npm tente malgré tout de compiler depuis les sources, assurez-vous d'avoir
> Visual Studio Build Tools (charge "Desktop development with C++") et Python 3.11/3.12
> (Python 3.13+ ne fournit plus `distutils`, requis par node-gyp — `pip install --upgrade setuptools`
> peut suffire à le restaurer).

## Base de données — première utilisation

Après `npm install`, générez la migration initiale à partir du schéma :

```bash
npm run db:generate
```

Cela crée les fichiers `.sql` dans `resources/migrations/`. Ils sont ensuite appliqués
**automatiquement** à chaque lancement de l'app (`npm run dev`), avant l'ouverture de la fenêtre.

Au premier lancement, la base est créée dans `%APPDATA%/AcademyFlow/data/academyflow.db`,
avec :
- Les classes du système béninois (CI → Tle)
- La première année scolaire (calculée automatiquement, ex: "2025-2026")
- Un compte administrateur : `admin` / `admin123` (changement obligatoire au premier login — Phase 4)

Pour explorer visuellement les données :

```bash
npm run rebuild:node    # recompile better-sqlite3 pour Node standard (une seule fois par session)
npm run db:studio
```

> ⚠️ **Piège classique avec `better-sqlite3` + Electron** : le module natif ne peut être compilé
> que pour **un seul runtime à la fois** — soit Node standard, soit Electron (ABI différentes).
> `npm install` (via le hook `postinstall`) le compile pour **Electron**, ce qui est nécessaire
> pour `npm run dev`. Mais `drizzle-kit studio` tourne sous **Node standard** et a besoin de
> l'autre compilation. D'où le workflow :
>
> ```bash
> npm run rebuild:node       # avant d'utiliser db:studio ou db:generate avec une vraie connexion
> npm run db:studio
> # Ctrl+C pour fermer Drizzle Studio, puis :
> npm run rebuild:electron   # avant de relancer npm run dev
> npm run dev
> ```
>
> `npm run db:generate` seul (sans connexion à une base existante) fonctionne généralement
> sans souci quel que soit l'état de compilation, car il ne fait que lire le schéma.

> `db:studio` et `db:generate` utilisent un fichier `academyflow.dev.db` local (racine du projet,
> ignoré par git), distinct de la vraie base de l'application. Si vous voulez inspecter les données
> réelles de l'app avec Drizzle Studio, copiez temporairement `%APPDATA%/AcademyFlow/data/academyflow.db`
> vers `academyflow.dev.db` à la racine du projet.

Si vous modifiez `src/main/database/schema.ts`, relancez `npm run db:generate` pour créer
une nouvelle migration, puis `npm run dev` — elle sera appliquée automatiquement.

## Développement

```bash
npm run dev
```

Ouvre la fenêtre Electron avec le contenu React (hot reload actif).

## Vérifications

```bash
npm run typecheck   # Vérification TypeScript (main + renderer)
npm run lint        # ESLint
npm run format      # Prettier (écrit les corrections)
```

## Build

```bash
npm run build        # Build de production (sans packaging)
npm run package       # Build + packaging Windows (.exe NSIS) via electron-builder
```

L'installateur est généré dans `dist/`.

## Structure du projet

```
src/
├── main/            # Process principal Electron
│   ├── database/
│   │   ├── connection.ts   # Ouverture SQLite + pragmas (WAL, foreign_keys)
│   │   ├── schema.ts        # Schéma Drizzle complet (13 tables)
│   │   ├── migrate.ts        # Application auto des migrations au démarrage
│   │   ├── seed.ts           # Données initiales (classes, année scolaire, admin)
│   │   ├── id.ts              # Génération d'identifiants
│   │   └── index.ts           # initDatabase() — point d'entrée du module
│   ├── ipc/
│   │   ├── register-all.ts   # Enregistrement centralisé de tous les handlers
│   │   ├── system.ipc.ts      # Canal system:ping (validation IPC)
│   │   ├── auth.ipc.ts         # login, logout, getCurrentUser, changePassword
│   │   ├── settings.ipc.ts      # Années scolaires, classes, barèmes, établissement
│   │   ├── students.ipc.ts       # Inscription, recherche, parcours, passage de classe
│   │   ├── printer.ipc.ts         # openPdf (visionneuse système) — thermique en Phase 9
│   │   └── *.ipc.ts                 # Squelettes restants (cashbox, personnel)
│   ├── services/
│   │   ├── audit.service.ts      # Traçabilité des actions (AUDIT_LOG)
│   │   ├── matricule.service.ts   # Génération de matricules uniques (BR-002)
│   │   ├── auth.service.ts         # Login, session en mémoire, changement de mot de passe
│   │   ├── settings.service.ts      # Années scolaires, classes, barèmes, établissement
│   │   └── student.service.ts        # CRUD élève, recherche, parcours, passage de classe
│   └── index.ts
├── preload/         # Scripts preload (contextBridge)
│   ├── index.ts       # Implémentation complète, organisée par domaine
│   ├── index.d.ts
│   └── api.d.ts        # Déclaration typée de window.api (7 domaines)
├── renderer/         # Application React (UI)
│   ├── assets/
│   ├── components/
│   │   ├── ui/            # Composants shadcn/ui (+ ConfirmDialog générique)
│   │   ├── layout/          # AppShell, Header, TopNav, Breadcrumbs, AuthGuard, PlaceholderPage
│   │   ├── auth/              # ChangePasswordDialog
│   │   ├── forms/            # FormField, MoneyInput, DatePickerField, SearchInput, ImageUpload
│   │   └── data-table/        # DataTable générique (tri + pagination), Toolbar
│   ├── hooks/               # useDebounce, useStudents
│   ├── stores/               # auth.store, settings.store, students.store (Zustand)
│   ├── lib/                  # cn, use-toast, ipc, formatters, validators (Zod), pdf
│   ├── pdf/                   # Templates @react-pdf/renderer (attestation, certificat,
│   │                             fiche élève, liste de classe) + styles/en-tête partagés
│   ├── pages/
│   │   ├── settings/           # SettingsPage (onglets), SchoolYearPage, TuitionFeesPage, SchoolInfoPage
│   │   ├── students/            # Liste, inscription, fiche détail, passage de classe
│   │   └── ...                    # auth, dashboard, cashbox, personnel
│   ├── styles/                 # globals.css (design system)
│   ├── App.tsx                  # Routing (HashRouter, AuthGuard, 14 routes)
│   ├── main.tsx
│   └── index.html
└── shared/           # Types et constantes partagés main/renderer
    ├── types/          # student, transaction, personnel, settings, common
    ├── constants/       # categories.ts (BR-004), defaults.ts
    └── ipc-channels.ts  # Noms des canaux IPC (source unique)

resources/
├── icon.png / icon.ico   # Icônes de l'application
└── migrations/            # Migrations SQL générées par drizzle-kit (packagées)
```

## Design System

- Police principale : **Inter** — police numérique (montants, matricules) : **JetBrains Mono**
- Palette définie dans `src/renderer/styles/globals.css` (variables CSS + tokens shadcn/ui,
  nuances de marque exposées comme utilitaires : `bg-primary-50`, `from-accent-400`...)
- Couleur d'accent principale : rose/corail `#F43F5E` (inspirée du logo) — accent secondaire turquoise `#06B6D4`
- Animations (`animate-in`, `fade-in-0`...) via `tw-animate-css`, compatible Tailwind v4

## Comptes de test

- **admin** / `admin123` (changement de mot de passe obligatoire au premier login)

## Prochaine étape

**Phase 7 — Module Caisse** (journal des opérations, reçus, comptes de scolarité,
rapports, gestion des arriérés).
