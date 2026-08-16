# resources/migrations/

Dossier généré par `npm run db:generate` (drizzle-kit), à partir du schéma
`src/main/database/schema.ts`. Contient les fichiers `.sql` de migration et
le journal `meta/_journal.json` de Drizzle.

**Ne pas éditer manuellement.** Après toute modification de `schema.ts`,
relancer `npm run db:generate` pour produire une nouvelle migration, puis
relancer l'application (`npm run dev`) — elle est appliquée automatiquement
au démarrage (voir `src/main/database/migrate.ts`).

Ce README est remplacé par les fichiers générés lors du premier
`npm run db:generate` — c'est normal.
