import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { app } from 'electron'
import { getDb } from '@main/database'
import { license } from '@main/database/schema'
import { computeMachineFingerprint } from './device-fingerprint'
import type {
  ActivateLicenseDTO,
  ActivateLicenseResult,
  LicenseStatus
} from '@shared/types/license.types'

/** Ligne unique (singleton), comme `SCHOOL_INFO_ID` dans settings.service.ts. */
const LICENSE_ROW_ID = 'singleton'

/**
 * Nombre de jours après `expiresAt` durant lesquels la licence reste
 * considérée `active` malgré l'échéance dépassée — absorbe les cas de
 * renouvellement payé juste à temps mais pas encore resynchronisé
 * localement (voir `resyncLicense`). Au-delà : mode lecture seule.
 */
const GRACE_PERIOD_DAYS = 3

/** Paliers d'alerte affichés dans l'UI avant expiration. */
const ALERT_THRESHOLDS_DAYS = { warning_15: 15, warning_7: 7, warning_1: 1 } as const

/**
 * Secret embarqué dans le binaire de l'application, combiné à l'empreinte
 * machine pour dériver la clé de chiffrement locale.
 *
 * ATTENTION — ceci n'est PAS un secret au sens cryptographique : le code
 * source (ou le binaire décompilé) d'une application Electron est
 * accessible à un attaquant déterminé, donc cette constante peut être
 * retrouvée. Son rôle est de hausser la barrière pour une modification
 * triviale du fichier SQLite (ex: éditeur SQLite grand public), pas de
 * résister à une rétro-ingénierie active du binaire. Une protection
 * anti-piratage réellement robuste nécessite une vérification côté serveur
 * périodique (voir `resyncLicense`), pas uniquement du stockage local.
 */
const APP_PEPPER = 'academyflow-license-v1'

/**
 * Clé de test acceptée uniquement en développement (`!app.isPackaged`), pour
 * pouvoir parcourir l'onboarding et l'application tant que le backend
 * d'activation (`LICENSE_API_URL`) n'est pas encore construit. Jamais
 * acceptée dans un build packagé, même si `LICENSE_API_URL` reste vide par
 * erreur — voir le garde `!app.isPackaged` dans `callRemoteActivation`.
 */
const DEV_BYPASS_LICENSE_KEY = 'AF-DEV0-TEST-0000-0000'
const DEV_BYPASS_VALIDITY_DAYS = 365

interface LicensePayload {
  licenseKey: string
  activatedAt: string
  expiresAt: string
  /** Cliquet anti-recul d'horloge : ne peut que progresser (voir `touchClockRatchet`). */
  lastKnownDate: string
  machineFingerprint: string
}

// ---------------------------------------------------------------------------
// Chiffrement local (AES-256-GCM)
// ---------------------------------------------------------------------------

function deriveKey(salt: Buffer, machineFingerprint: string): Buffer {
  return scryptSync(`${machineFingerprint}:${APP_PEPPER}`, salt, 32)
}

function encryptPayload(payload: LicensePayload): string {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = deriveKey(salt, payload.machineFingerprint)

  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf-8'),
    cipher.final()
  ])
  const authTag = cipher.getAuthTag()

  return [
    salt.toString('hex'),
    iv.toString('hex'),
    authTag.toString('hex'),
    ciphertext.toString('hex')
  ].join(':')
}

/** Retourne `null` si le blob est corrompu, falsifié, ou n'a pas été chiffré pour cette machine. */
function decryptPayload(blob: string, machineFingerprint: string): LicensePayload | null {
  try {
    const [saltHex, ivHex, authTagHex, ciphertextHex] = blob.split(':')
    if (!saltHex || !ivHex || !authTagHex || !ciphertextHex) return null

    const salt = Buffer.from(saltHex, 'hex')
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    const ciphertext = Buffer.from(ciphertextHex, 'hex')
    const key = deriveKey(salt, machineFingerprint)

    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf-8'
    )

    const payload = JSON.parse(plaintext) as LicensePayload

    // L'empreinte à l'intérieur du payload chiffré fait foi : toute
    // incohérence avec la machine courante (ex: fichier .db copié depuis un
    // autre poste) est traitée comme une licence invalide sur ce poste.
    if (payload.machineFingerprint !== machineFingerprint) return null

    return payload
  } catch {
    // Déchiffrement échoué (authTag invalide) = payload modifié manuellement.
    return null
  }
}

// ---------------------------------------------------------------------------
// Lecture / écriture de la ligne LICENSE
// ---------------------------------------------------------------------------

interface LicenseRow {
  encryptedPayload: string
  lastVerifiedAt: string | null
  onboardingCompletedAt: string | null
}

function getRow(): LicenseRow | null {
  const db = getDb()
  return db.select().from(license).where(eq(license.id, LICENSE_ROW_ID)).get() ?? null
}

function upsertRow(fields: {
  machineFingerprint: string
  encryptedPayload: string
  lastVerifiedAt?: string | null
  onboardingCompletedAt?: string | null
}): void {
  const db = getDb()
  const now = new Date().toISOString()
  const existing = getRow()

  if (existing) {
    db.update(license)
      .set({
        machineFingerprint: fields.machineFingerprint,
        encryptedPayload: fields.encryptedPayload,
        ...(fields.lastVerifiedAt !== undefined ? { lastVerifiedAt: fields.lastVerifiedAt } : {}),
        ...(fields.onboardingCompletedAt !== undefined
          ? { onboardingCompletedAt: fields.onboardingCompletedAt }
          : {}),
        updatedAt: now
      })
      .where(eq(license.id, LICENSE_ROW_ID))
      .run()
  } else {
    db.insert(license)
      .values({
        id: LICENSE_ROW_ID,
        machineFingerprint: fields.machineFingerprint,
        encryptedPayload: fields.encryptedPayload,
        lastVerifiedAt: fields.lastVerifiedAt ?? null,
        onboardingCompletedAt: fields.onboardingCompletedAt ?? null
      })
      .run()
  }
}

// ---------------------------------------------------------------------------
// API distante d'activation (MongoDB / backend — hors périmètre de ce repo)
// ---------------------------------------------------------------------------

interface RemoteVerificationResult {
  valid: boolean
  expiresAt?: string
  error?: string
}

/**
 * Appelle le backend d'activation (à implémenter séparément — voir
 * discussion produit : API + MongoDB stockant les clés vendues sur le site
 * officiel). URL configurable via `LICENSE_API_URL` (voir `config/env.ts`).
 *
 * Best-effort : toute erreur réseau (pas de connexion, timeout, backend
 * indisponible) est capturée et remontée comme `valid: false` avec un
 * message dédié, plutôt que de faire planter l'appelant — l'activation
 * initiale reste néanmoins volontairement bloquante (voir `activateLicense`),
 * contrairement aux resynchronisations ultérieures qui sont best-effort.
 */
async function callRemoteActivation(
  licenseKey: string,
  machineFingerprint: string
): Promise<RemoteVerificationResult> {
  if (!app.isPackaged && licenseKey.trim().toUpperCase() === DEV_BYPASS_LICENSE_KEY) {
    console.warn(
      `[license] Clé de test développeur utilisée (${DEV_BYPASS_LICENSE_KEY}) — activation locale sans ` +
        'appel réseau. Ne fonctionne jamais dans un build packagé.'
    )
    const expiresAt = new Date(
      Date.now() + DEV_BYPASS_VALIDITY_DAYS * 24 * 60 * 60 * 1000
    ).toISOString()
    return { valid: true, expiresAt }
  }

  const apiUrl = process.env.LICENSE_API_URL
  if (!apiUrl) {
    return {
      valid: false,
      error: 'Serveur de licence non configuré (LICENSE_API_URL manquant).'
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)

    const response = await fetch(`${apiUrl}/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey, machineFingerprint }),
      signal: controller.signal
    })
    clearTimeout(timeout)

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      return {
        valid: false,
        error: body?.error ?? 'Clé de licence invalide ou déjà utilisée sur un autre poste.'
      }
    }

    const body = (await response.json()) as { expiresAt: string }
    return { valid: true, expiresAt: body.expiresAt }
  } catch {
    return {
      valid: false,
      error:
        'Impossible de joindre le serveur de licence. Vérifiez votre connexion Internet et réessayez.'
    }
  }
}

// ---------------------------------------------------------------------------
// API publique du service
// ---------------------------------------------------------------------------

/**
 * Active une licence (étape 1 de l'onboarding). Nécessite une connexion
 * Internet — c'est le seul moment de l'usage quotidien où c'est le cas
 * (voir `resyncLicense` pour les revérifications ultérieures, best-effort).
 */
export async function activateLicense(dto: ActivateLicenseDTO): Promise<ActivateLicenseResult> {
  const licenseKey = dto.licenseKey.trim()
  if (!licenseKey) {
    return { success: false, status: evaluateLicense(), error: 'La clé de licence est requise.' }
  }

  const machineFingerprint = computeMachineFingerprint()
  const result = await callRemoteActivation(licenseKey, machineFingerprint)

  if (!result.valid || !result.expiresAt) {
    return { success: false, status: evaluateLicense(), error: result.error }
  }

  const now = new Date().toISOString()
  const payload: LicensePayload = {
    licenseKey,
    activatedAt: now,
    expiresAt: result.expiresAt,
    lastKnownDate: now,
    machineFingerprint
  }

  upsertRow({
    machineFingerprint,
    encryptedPayload: encryptPayload(payload),
    lastVerifiedAt: now
  })

  // Pas de logAction ici : AUDIT_LOG.user_id référence USERS avec une
  // contrainte NOT NULL (voir schema.ts) — aucun utilisateur n'existe
  // encore à ce stade de l'onboarding (l'activation de la licence est
  // l'étape 1, avant la création du compte admin à l'étape 3). Un simple
  // log console suffit pour un événement système non attribuable à un
  // utilisateur réel.
  console.log(`[license] Licence activée, expire le ${result.expiresAt}.`)

  return { success: true, status: evaluateLicense() }
}

/**
 * Cliquet anti-recul d'horloge — à appeler une fois au démarrage de l'app
 * (`main/index.ts`), avant tout affichage. Ne fait rien si aucune licence
 * n'est activée. Détecte une horloge système reculée par rapport à la
 * dernière date connue et journalise l'anomalie (l'écran affichera alors
 * un statut `invalid` via `evaluateLicense`, qui compare également les deux
 * dates — ce n'est pas cette fonction qui décide du statut, uniquement qui
 * fait progresser/valide le cliquet stocké).
 */
export function touchClockRatchet(): void {
  const row = getRow()
  if (!row) return

  const machineFingerprint = computeMachineFingerprint()
  const payload = decryptPayload(row.encryptedPayload, machineFingerprint)
  if (!payload) return // Falsifié ou autre machine — `evaluateLicense` le signalera comme `invalid`.

  const now = new Date()
  const lastKnown = new Date(payload.lastKnownDate)

  if (now.getTime() < lastKnown.getTime()) {
    // Pas de logAction (voir commentaire dans `activateLicense`) : ce
    // contrôle s'exécute à chaque démarrage, potentiellement avant toute
    // authentification, et 'system' n'est jamais un USERS.id valide.
    console.warn(
      `[license] Recul d'horloge détecté : horloge système à ${now.toISOString()}, ` +
        `dernière date connue ${payload.lastKnownDate}.`
    )
    return // Ne fait PAS progresser le cliquet : le payload stocké garde son ancienne date, plus fiable.
  }

  const updated: LicensePayload = { ...payload, lastKnownDate: now.toISOString() }
  upsertRow({ machineFingerprint, encryptedPayload: encryptPayload(updated) })
}

/**
 * Resynchronisation opportuniste — à appeler en arrière-plan au démarrage
 * (best-effort, jamais bloquant, échoue silencieusement sans connexion).
 * Récupère une éventuelle nouvelle date d'expiration côté serveur suite à
 * un renouvellement d'abonnement payé sur le site officiel.
 */
export async function resyncLicense(): Promise<void> {
  const row = getRow()
  if (!row) return

  const machineFingerprint = computeMachineFingerprint()
  const payload = decryptPayload(row.encryptedPayload, machineFingerprint)
  if (!payload) return

  const result = await callRemoteActivation(payload.licenseKey, machineFingerprint)
  if (!result.valid || !result.expiresAt) return // Best-effort : silencieux en cas d'échec réseau.

  const now = new Date().toISOString()
  const updated: LicensePayload = { ...payload, expiresAt: result.expiresAt, lastKnownDate: now }
  upsertRow({ machineFingerprint, encryptedPayload: encryptPayload(updated), lastVerifiedAt: now })
}

function computeAlertLevel(daysRemaining: number): LicenseStatus['alertLevel'] {
  if (daysRemaining <= ALERT_THRESHOLDS_DAYS.warning_1) return 'warning_1'
  if (daysRemaining <= ALERT_THRESHOLDS_DAYS.warning_7) return 'warning_7'
  if (daysRemaining <= ALERT_THRESHOLDS_DAYS.warning_15) return 'warning_15'
  return 'none'
}

/**
 * Calcule le statut courant — toujours dérivé à la volée (voir commentaire
 * de la table `LICENSE` dans schema.ts), jamais lu depuis un champ mis en
 * cache. Fonction pure (pas d'écriture en base, pas d'appel réseau).
 */
export function evaluateLicense(): LicenseStatus {
  const row = getRow()
  if (!row) {
    return {
      state: 'not_activated',
      expiresAt: null,
      daysRemaining: null,
      alertLevel: 'none',
      lastVerifiedAt: null,
      onboardingCompleted: false
    }
  }

  const machineFingerprint = computeMachineFingerprint()
  const payload = decryptPayload(row.encryptedPayload, machineFingerprint)
  const onboardingCompleted = row.onboardingCompletedAt !== null

  if (!payload) {
    return {
      state: 'invalid',
      expiresAt: null,
      daysRemaining: null,
      alertLevel: 'none',
      lastVerifiedAt: row.lastVerifiedAt,
      onboardingCompleted
    }
  }

  const now = new Date()
  const lastKnown = new Date(payload.lastKnownDate)
  if (now.getTime() < lastKnown.getTime()) {
    // Recul d'horloge non résolu par `touchClockRatchet` (ex: fonction pas
    // encore appelée ce lancement-ci) — on ne fait pas confiance à `now`.
    return {
      state: 'invalid',
      expiresAt: null,
      daysRemaining: null,
      alertLevel: 'none',
      lastVerifiedAt: row.lastVerifiedAt,
      onboardingCompleted
    }
  }

  const expiresAt = new Date(payload.expiresAt)
  const msPerDay = 24 * 60 * 60 * 1000
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay)
  const graceDeadline = new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * msPerDay)

  const state: LicenseStatus['state'] =
    now.getTime() <= graceDeadline.getTime() ? 'active' : 'readonly'

  return {
    state,
    expiresAt: payload.expiresAt,
    daysRemaining,
    alertLevel: state === 'active' ? computeAlertLevel(daysRemaining) : 'none',
    lastVerifiedAt: row.lastVerifiedAt,
    onboardingCompleted
  }
}

/** Marque l'onboarding comme terminé (appelé à la fin de l'étape 5, l'étape 6 Google Drive étant optionnelle). */
export function markOnboardingCompleted(): void {
  const row = getRow()
  if (!row) {
    throw new Error('Impossible de terminer la configuration : aucune licence activée.')
  }

  const db = getDb()
  db.update(license)
    .set({ onboardingCompletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    .where(eq(license.id, LICENSE_ROW_ID))
    .run()
}
