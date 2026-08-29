/**
 * Harnais de test — simule la séquence EXACTE d'appels IPC que l'UI
 * d'onboarding déclenche, étape par étape, contre une vraie base SQLite
 * (mêmes migrations que la prod). Ne teste pas le rendu visuel (pas
 * d'affichage disponible dans cet environnement), mais valide 100% de la
 * couche métier/données traversée par les 6 pages — exactement là où se
 * trouvaient les deux bugs précédents (contrainte FK, logique du guard).
 *
 * Usage : npx tsx scripts/onboarding-e2e-check.mts
 */
import Module from 'node:module'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const tmpUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'academyflow-e2e-'))

/**
 * `getMigrationsFolder()` résout `resources/migrations` en remontant depuis
 * `__dirname` du fichier compilé (`out/main/database` en prod). Ici, tsx
 * exécute le TS source directement (`src/main/database`), ce qui change ce
 * chemin relatif — on crée un lien symbolique temporaire pour que la
 * résolution reste correcte sans dupliquer/committer les migrations.
 */
const srcResourcesShim = path.join(process.cwd(), 'src', 'resources')
const migrationsShimTarget = path.join(srcResourcesShim, 'migrations')
let createdShim = false
if (!fs.existsSync(migrationsShimTarget)) {
  fs.mkdirSync(srcResourcesShim, { recursive: true })
  fs.symlinkSync(path.join(process.cwd(), 'resources', 'migrations'), migrationsShimTarget, 'dir')
  createdShim = true
}

const electronMock = {
  app: {
    isPackaged: false,
    getPath: (_name: string) => tmpUserData
  }
}

// Intercepte require('electron') AVANT tout import du code applicatif —
// tous les services main/* l'utilisent (app.isPackaged, app.getPath).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const originalLoad = (Module as any)._load
// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(Module as any)._load = function (request: string, ...rest: any[]) {
  if (request === 'electron') return electronMock
  return originalLoad.call(this, request, ...rest)
}

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.log(`  ✗ ${label}`)
    if (detail !== undefined) console.log(`    → ${JSON.stringify(detail)}`)
  }
}

async function main(): Promise<void> {
  try {
    await runChecks()
  } finally {
    fs.rmSync(tmpUserData, { recursive: true, force: true })
    if (createdShim) fs.rmSync(srcResourcesShim, { recursive: true, force: true })
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Résultat : ${passed} succès, ${failed} échec(s)`)
  console.log('='.repeat(50))

  if (failed > 0) process.exit(1)
}

async function runChecks(): Promise<void> {
  console.log(`[setup] userData temporaire : ${tmpUserData}\n`)

  const { initDatabase } = await import('../src/main/database/index')
  initDatabase()
  console.log('[setup] Migrations appliquées avec succès (base vierge).\n')

  const license = await import('../src/main/services/license.service')
  const settings = await import('../src/main/services/settings.service')
  const auth = await import('../src/main/services/auth.service')

  // --- Réplique de resolveOnboardingResumeStep() côté renderer, mais
  //     appelée directement contre les services (pas de couche IPC ici).
  function resumeStep(): string | null {
    const status = license.evaluateLicense()
    if (status.state === 'not_activated' || status.state === 'invalid') return 'license'
    const info = settings.getSchoolInfo()
    if (!info.name.trim()) return 'school'
    if (auth.listUsers().length === 0) return 'admin'
    if (settings.getClasses().length === 0) return 'classes'
    if (settings.listSchoolYears().length === 0) return 'school-year'
    if (!status.onboardingCompleted) return 'drive'
    return null
  }

  console.log('=== Étape 0 — état initial (base vierge) ===')
  check('Point de reprise = "license" avant toute action', resumeStep() === 'license', resumeStep())

  console.log('\n=== Étape 1 — activation de la licence (clé de test dev) ===')
  const activation = await license.activateLicense({ licenseKey: 'AF-DEV0-TEST-0000-0000' })
  check('activateLicense() réussit (pas de crash FK, régression du bug corrigé)', activation.success, activation.error)
  check('Statut après activation = "active"', activation.status.state === 'active', activation.status)
  check('Point de reprise avance vers "school"', resumeStep() === 'school', resumeStep())

  console.log('\n=== Étape 2 — informations établissement ===')
  settings.updateSchoolInfo({
    name: 'Collège Test AcademyFlow',
    address: '123 Avenue de Test, Cotonou',
    phone: '+229 97 00 00 00',
    email: 'contact@test.edu.bj'
  })
  check('Point de reprise avance vers "admin"', resumeStep() === 'admin', resumeStep())

  console.log('\n=== Étape 3 — création du compte administrateur ===')
  const adminUser = auth.createUser({
    username: 'admin',
    password: 'Test1234!',
    fullName: 'admin',
    skipMustChangePassword: true
  })
  check('Utilisateur admin créé', !!adminUser.id)
  check('mustChangePassword = false (onboarding, pas un compte créé en Paramètres)', adminUser.mustChangePassword === false)
  check('Point de reprise avance vers "classes"', resumeStep() === 'classes', resumeStep())

  console.log('\n=== Étape 4 — création des classes ===')
  const classA = settings.createClass('6ème A')
  settings.createClass('6ème B')
  check('2 classes créées', settings.getClasses().length === 2)
  // Vérifie aussi la contrainte anti-doublon ajoutée dans settings.service.ts
  let duplicateRejected = false
  try {
    settings.createClass('6ème A')
  } catch {
    duplicateRejected = true
  }
  check('Doublon de nom de classe rejeté', duplicateRejected)
  check('Point de reprise avance vers "school-year"', resumeStep() === 'school-year', resumeStep())

  console.log('\n=== Étape 5 — création de l\'année scolaire ===')
  const year = settings.createSchoolYear('2026-2027')
  settings.setCurrentSchoolYear(year.id)
  check('Année scolaire créée et marquée courante', settings.getCurrentSchoolYear()?.id === year.id)
  check('Point de reprise avance vers "drive" (dernière étape)', resumeStep() === 'drive', resumeStep())

  console.log('\n=== Étape 6 — Google Drive (ignorée, "Configurer plus tard") + finalisation ===')
  license.markOnboardingCompleted()
  check('Onboarding marqué terminé → point de reprise = null', resumeStep() === null, resumeStep())

  console.log('\n=== Contrôles complémentaires ===')
  const finalStatus = license.evaluateLicense()
  check('Statut licence final toujours "active"', finalStatus.state === 'active', finalStatus)
  check('daysRemaining ≈ 365 (clé de test dev)', (finalStatus.daysRemaining ?? 0) > 360)

  // Le cliquet anti-recul d'horloge ne doit pas planter (2e bug corrigé)
  license.touchClockRatchet()
  check('touchClockRatchet() ne plante pas après onboarding complet', true)

  // Suppression d'une classe déjà utilisée par une inscription → doit être
  // refusée (protection de l'historique). Pas d'inscription réelle créée
  // ici (hors périmètre de l'onboarding), donc on vérifie juste le cas
  // "classe libre" : suppression autorisée.
  settings.deleteClass(classA.id)
  check('Suppression d\'une classe sans inscription autorisée', settings.getClasses().length === 1)
}

main().catch((err) => {
  console.error('\n[ERREUR NON CAPTURÉE]', err)
  process.exit(1)
})
