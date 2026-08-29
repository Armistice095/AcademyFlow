import { relations, sql } from 'drizzle-orm'
import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core'
import { generateId } from './id'
import type { TuitionTarget } from '@shared/types/settings.types'

/**
 * Schéma de base de données AcademyFlow — Drizzle ORM / SQLite.
 *
 * Conventions (ARCHITECTURE.md §12.1) :
 *  - Noms de tables SQL : UPPER_SNAKE_CASE pluriel (STUDENTS, TRANSACTIONS...)
 *  - Noms de colonnes SQL : snake_case
 *  - Variables TypeScript exportées : camelCase (students, transactions...)
 *
 * Conventions de données (ARCHITECTURE.md §4.2) :
 *  - IDs : UUID générés via `generateId()` (voir ./id.ts)
 *  - Montants : entiers, en unités FCFA (pas de décimales)
 *  - Horodatage : chaînes ISO 8601 UTC
 *  - Soft delete : `is_active` pour students / employees (BR-006)
 */

const nowIso = (): string => new Date().toISOString()

// ---------------------------------------------------------------------------
// USERS — Utilisateurs de l'application
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  'USERS',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    fullName: text('full_name').notNull(),
    /** Force le changement de mot de passe au prochain login (voir F-004.5). */
    mustChangePassword: integer('must_change_password', { mode: 'boolean' })
      .notNull()
      .default(true),
    /** Désactivation d'un compte sans suppression physique (Phase 9.4 — cohérent avec BR-006). */
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    lastLogin: text('last_login')
  },
  (table) => ({
    usernameUnique: uniqueIndex('users_username_unique').on(table.username)
  })
)

// ---------------------------------------------------------------------------
// SCHOOL_INFO — Informations de l'établissement (singleton)
// ---------------------------------------------------------------------------
/**
 * Table à ligne unique (id fixe, voir `SCHOOL_INFO_ID` dans settings.service.ts).
 * Utilisée pour personnaliser les documents administratifs générés
 * (certificats, attestations, reçus, rapports — Phases 6, 7, 9).
 *
 * Logo et cachet stockés en base (data URL base64) plutôt qu'en fichiers sur
 * disque : évite toute complexité de chemins de fichiers / CSP côté renderer,
 * et ce sont de petites images.
 */
export const schoolInfo = sqliteTable('SCHOOL_INFO', {
  id: text('id').primaryKey(),
  name: text('name').notNull().default(''),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  /** Data URL base64 (ex: "data:image/png;base64,..."). */
  logoDataUrl: text('logo_data_url'),
  /** Data URL base64 du cachet de l'établissement. */
  stampDataUrl: text('stamp_data_url'),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso)
})

// ---------------------------------------------------------------------------
// LICENSE — Licence d'utilisation (singleton, 1 clé = 1 poste)
// ---------------------------------------------------------------------------
/**
 * Table à ligne unique (id fixe, voir `LICENSE_ROW_ID` dans license.service.ts).
 *
 * Modèle retenu (voir discussion produit) : activation en ligne initiale
 * (MongoDB / API distante, hors périmètre de ce repo) puis fonctionnement
 * quotidien 100% hors-ligne grâce à un jeton signé mis en cache localement.
 *
 *  - `encryptedPayload` : blob chiffré (AES-256-GCM) contenant en clair
 *    { licenseKey, activatedAt, expiresAt, lastKnownDate, machineFingerprint }.
 *    `lastKnownDate` sert de cliquet anti-recul d'horloge (ne peut que
 *    progresser) — voir `license.service.ts::touchClockRatchet`.
 *  - `machineFingerprint` dupliqué en clair pour comparaison rapide, mais la
 *    valeur qui fait foi est celle contenue dans `encryptedPayload` (toute
 *    incohérence entre les deux = falsification détectée).
 *  - Pas de colonne `status` : le statut (active/readonly/invalid) est
 *    toujours recalculé à la volée, jamais mis en cache (évite un statut
 *    stale après modification manuelle du fichier SQLite).
 */
export const license = sqliteTable('LICENSE', {
  id: text('id').primaryKey(),
  /** Dupliqué en clair pour un contrôle rapide — la valeur de référence reste celle du payload chiffré. */
  machineFingerprint: text('machine_fingerprint').notNull(),
  /** Blob base64 (iv + authTag + ciphertext) — voir commentaire de la table. */
  encryptedPayload: text('encrypted_payload').notNull(),
  /** Dernière vérification en ligne réussie (resynchronisation opportuniste). `null` si jamais rejointe depuis l'activation. */
  lastVerifiedAt: text('last_verified_at'),
  /** Marque la fin de l'assistant d'onboarding (étapes 1 à 5 complétées ; l'étape 6 Google Drive est optionnelle). */
  onboardingCompletedAt: text('onboarding_completed_at'),
  createdAt: text('created_at').notNull().$defaultFn(nowIso),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso)
})

// ---------------------------------------------------------------------------
// SCHOOL_YEARS — Années scolaires
// ---------------------------------------------------------------------------
export const schoolYears = sqliteTable(
  'SCHOOL_YEARS',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    /** ex: "2025-2026" */
    label: text('label').notNull(),
    isCurrent: integer('is_current', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().$defaultFn(nowIso)
  },
  (table) => ({
    labelUnique: uniqueIndex('school_years_label_unique').on(table.label)
  })
)

// ---------------------------------------------------------------------------
// CLASSES — Classes de l'établissement
// ---------------------------------------------------------------------------
export const classes = sqliteTable(
  'CLASSES',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    /** ex: "CI", "CP", "6ème"... */
    name: text('name').notNull(),
    sortOrder: integer('sort_order').notNull().default(0)
  },
  (table) => ({
    nameUnique: uniqueIndex('classes_name_unique').on(table.name)
  })
)

// ---------------------------------------------------------------------------
// STUDENTS — Élèves
// ---------------------------------------------------------------------------
export const students = sqliteTable(
  'STUDENTS',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    /** BR-002 : généré automatiquement, unique, jamais réutilisé, jamais modifiable. */
    matricule: text('matricule').notNull(),
    photoPath: text('photo_path'),
    lastName: text('last_name').notNull(),
    firstName: text('first_name').notNull(),
    /** 'M' | 'F' */
    gender: text('gender').notNull(),
    dateOfBirth: text('date_of_birth').notNull(),
    placeOfBirth: text('place_of_birth'),
    nationality: text('nationality').notNull().default('Béninoise'),
    address: text('address'),
    /** Renseigné si l'élève est un transfert. */
    previousSchool: text('previous_school'),
    /** BR-006 : soft delete — jamais de suppression physique. */
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    updatedAt: text('updated_at').notNull().$defaultFn(nowIso),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' })
  },
  (table) => ({
    matriculeUnique: uniqueIndex('students_matricule_unique').on(table.matricule),
    nameIdx: index('students_name_idx').on(table.lastName, table.firstName)
  })
)

// ---------------------------------------------------------------------------
// GUARDIANS — Responsables / tuteurs
// ---------------------------------------------------------------------------
export const guardians = sqliteTable(
  'GUARDIANS',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    lastName: text('last_name').notNull(),
    firstName: text('first_name').notNull(),
    phone: text('phone').notNull(),
    profession: text('profession'),
    /** ex: "Père", "Mère", "Tuteur légal"... */
    relationship: text('relationship').notNull()
  },
  (table) => ({
    studentIdx: index('guardians_student_idx').on(table.studentId)
  })
)

// ---------------------------------------------------------------------------
// ENROLLMENTS — Inscriptions (élève x année scolaire x classe)
// ---------------------------------------------------------------------------
export const enrollments = sqliteTable(
  'ENROLLMENTS',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    studentId: text('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    schoolYearId: text('school_year_id')
      .notNull()
      .references(() => schoolYears.id, { onDelete: 'restrict' }),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'restrict' }),
    /** 'admis' | 'redoublant' */
    status: text('status').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso)
  },
  (table) => ({
    // BR-003 : un seul statut de progression par élève et par année scolaire.
    studentYearUnique: uniqueIndex('enrollments_student_year_unique').on(
      table.studentId,
      table.schoolYearId
    ),
    // Rapports "Par classe" (F-017 refonte) : résolution élèves ↔ classe pour
    // l'année en cours, appelée à chaque chargement des rapports filtrés.
    classYearIdx: index('enrollments_class_year_idx').on(table.classId, table.schoolYearId)
  })
)

// ---------------------------------------------------------------------------
// TUITION_SCHEDULES — Barèmes de frais (par classe x année scolaire)
// ---------------------------------------------------------------------------
export const tuitionSchedules = sqliteTable(
  'TUITION_SCHEDULES',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    classId: text('class_id')
      .notNull()
      .references(() => classes.id, { onDelete: 'cascade' }),
    schoolYearId: text('school_year_id')
      .notNull()
      .references(() => schoolYears.id, { onDelete: 'cascade' })
  },
  (table) => ({
    classYearUnique: uniqueIndex('tuition_schedules_class_year_unique').on(
      table.classId,
      table.schoolYearId
    )
  })
)

// ---------------------------------------------------------------------------
// TUITION_INSTALLMENTS — Tranches de frais de scolarité
// ---------------------------------------------------------------------------
export const tuitionInstallments = sqliteTable(
  'TUITION_INSTALLMENTS',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    scheduleId: text('schedule_id')
      .notNull()
      .references(() => tuitionSchedules.id, { onDelete: 'cascade' }),
    /** ex: "1ère tranche" */
    label: text('label').notNull(),
    /** Montant attendu, en FCFA. */
    amount: integer('amount').notNull(),
    dueDate: text('due_date').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    /**
     * 'tous' | 'nouveau' | 'ancien' — population concernée par cette tranche
     * (ex: une tranche "Frais d'inscription" peut ne concerner que les
     * nouveaux, en plus des tranches communes à tous). Calculé au moment du
     * compte de scolarité via `getEnrollmentHistoryStatus` (student.service).
     */
    appliesTo: text('applies_to').notNull().default('tous').$type<TuitionTarget>()
  },
  (table) => ({
    scheduleIdx: index('tuition_installments_schedule_idx').on(table.scheduleId)
  })
)

// ---------------------------------------------------------------------------
// TRANSACTIONS — Journal de caisse (entrées / sorties)
// ---------------------------------------------------------------------------
export const transactions = sqliteTable(
  'TRANSACTIONS',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    /** 'entry' | 'exit' */
    type: text('type').notNull(),
    /** BR-004 : frais d'inscription, scolarité, frais divers, don, autre recette
     *  (entrées) — dépense quotidienne, salaire, achat de fournitures, charge
     *  diverse (sorties). Voir shared/constants pour la liste exacte. */
    category: text('category').notNull(),
    description: text('description'),
    /** Montant, en FCFA (entier). */
    amount: integer('amount').notNull(),
    studentId: text('student_id').references(() => students.id, { onDelete: 'set null' }),
    installmentId: text('installment_id').references(() => tuitionInstallments.id, {
      onDelete: 'set null'
    }),
    employeeId: text('employee_id').references(() => employees.id, { onDelete: 'set null' }),
    /** 'validated' | 'cancelled' — BR-005 : jamais de suppression, uniquement marquage "annulée". */
    status: text('status').notNull().default('validated'),
    /** Référence l'opération d'annulation associée, le cas échéant. */
    cancelledByTxn: text('cancelled_by_txn'),
    /** Motif saisi par l'opérateur lors de l'annulation (BR-005 : conservé sur l'opération elle-même,
     *  aucune ligne supplémentaire n'est créée dans le journal). */
    cancelReason: text('cancel_reason'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** Année scolaire en cours au moment de l'enregistrement — permet de filtrer
     *  le journal de caisse par année scolaire (cohérent avec ENROLLMENTS). */
    schoolYearId: text('school_year_id').references(() => schoolYears.id, { onDelete: 'restrict' }),
    createdAt: text('created_at').notNull().$defaultFn(nowIso)
  },
  (table) => ({
    createdAtIdx: index('transactions_created_at_idx').on(table.createdAt),
    studentIdx: index('transactions_student_idx').on(table.studentId),
    typeIdx: index('transactions_type_idx').on(table.type),
    schoolYearIdx: index('transactions_school_year_idx').on(table.schoolYearId)
  })
)

// ---------------------------------------------------------------------------
// RECEIPTS — Reçus de paiement
// ---------------------------------------------------------------------------
export const receipts = sqliteTable(
  'RECEIPTS',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    receiptNumber: text('receipt_number').notNull(),
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    amount: integer('amount').notNull(),
    createdAt: text('created_at').notNull().$defaultFn(nowIso),
    /** Nombre de réimpressions du reçu. */
    printCount: integer('print_count').notNull().default(0)
  },
  (table) => ({
    receiptNumberUnique: uniqueIndex('receipts_receipt_number_unique').on(table.receiptNumber),
    transactionUnique: uniqueIndex('receipts_transaction_unique').on(table.transactionId)
  })
)

// ---------------------------------------------------------------------------
// PRINTER_CONFIG — Configuration de l'imprimante thermique (singleton, Phase 9.2)
// ---------------------------------------------------------------------------
/**
 * Table à ligne unique (id fixe, voir `PRINTER_CONFIG_ID` dans
 * `printer-config.service.ts`). Une seule imprimante de reçus configurée à
 * la fois — cohérent avec le contexte mono-poste de l'application (voir
 * `auth.service.ts` pour la même convention côté session utilisateur).
 */
export const printerConfig = sqliteTable('PRINTER_CONFIG', {
  id: text('id').primaryKey(),
  /** Impression thermique activée. Si `false`, on bascule directement sur le fallback PDF. */
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  /** 'usb' | 'network' */
  connectionType: text('connection_type').notNull().default('network'),
  /** Chemin du port local (USB), ex: `\\.\COM3`. */
  devicePath: text('device_path'),
  /** Adresse IP/hôte (réseau). */
  host: text('host'),
  /** Port TCP (réseau) — 9100 par défaut (port RAW standard des imprimantes ESC/POS). */
  port: integer('port').notNull().default(9100),
  lastTestAt: text('last_test_at'),
  lastTestSuccess: integer('last_test_success', { mode: 'boolean' }),
  lastTestMessage: text('last_test_message'),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso)
})

// ---------------------------------------------------------------------------
// BACKUP_CONFIG — Configuration de la sauvegarde cloud Google Drive (singleton, Phase 9.3)
// ---------------------------------------------------------------------------
export const backupConfig = sqliteTable('BACKUP_CONFIG', {
  id: text('id').primaryKey(),
  connected: integer('connected', { mode: 'boolean' }).notNull().default(false),
  /** Adresse e-mail du compte Google connecté (affichage uniquement). */
  accountEmail: text('account_email'),
  /** Refresh token OAuth2, chiffré via `safeStorage` (Electron) — jamais en clair. */
  refreshTokenEncrypted: text('refresh_token_encrypted'),
  /** ID du dossier Google Drive "AcademyFlow — Sauvegardes", créé au premier export. */
  driveFolderId: text('drive_folder_id'),
  autoBackupEnabled: integer('auto_backup_enabled', { mode: 'boolean' }).notNull().default(false),
  /** Heure (0-23) de déclenchement de la sauvegarde automatique quotidienne. */
  autoBackupHour: integer('auto_backup_hour').notNull().default(2),
  lastBackupAt: text('last_backup_at'),
  /** 'success' | 'error' */
  lastBackupStatus: text('last_backup_status'),
  lastBackupMessage: text('last_backup_message'),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso)
})

// ---------------------------------------------------------------------------
// BACKUP_HISTORY — supprimée (Phase 9.3, correctif Drive = source de vérité).
// L'historique des sauvegardes n'est plus dupliqué localement : il est lu
// directement depuis Google Drive à chaque affichage (voir
// `backup.service.ts#listBackups`). Conserver une copie locale avait causé
// le bug d'origine (historique vide après réinitialisation de la base
// locale, alors que les fichiers restaient bien présents sur Drive). Voir
// la migration 0008 pour le `DROP TABLE` correspondant.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// EMPLOYEES — Personnel
// ---------------------------------------------------------------------------
export const employees = sqliteTable(
  'EMPLOYEES',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    lastName: text('last_name').notNull(),
    firstName: text('first_name').notNull(),
    /** Fonction occupée. */
    role: text('role').notNull(),
    phone: text('phone'),
    /** Salaire mensuel de référence, en FCFA. */
    monthlySalary: integer('monthly_salary').notNull(),
    /** Soft delete, comme pour les élèves (cohérent avec BR-006). */
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().$defaultFn(nowIso)
  },
  (table) => ({
    nameIdx: index('employees_name_idx').on(table.lastName, table.firstName)
  })
)

// ---------------------------------------------------------------------------
// SALARY_PAYMENTS — Paiements de salaire (suivi mensuel)
// ---------------------------------------------------------------------------
export const salaryPayments = sqliteTable(
  'SALARY_PAYMENTS',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    schoolYearId: text('school_year_id')
      .notNull()
      .references(() => schoolYears.id, { onDelete: 'restrict' }),
    /** 1-12 */
    month: integer('month').notNull(),
    year: integer('year').notNull(),
    /** BR-008 : lien obligatoire avec la sortie de caisse correspondante. */
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    paidAt: text('paid_at').notNull().$defaultFn(nowIso)
  },
  (table) => ({
    // BR-009 : un même mois ne peut être marqué payé qu'une seule fois par employé.
    employeeMonthYearUnique: uniqueIndex('salary_payments_employee_month_year_unique').on(
      table.employeeId,
      table.month,
      table.year
    ),
    transactionUnique: uniqueIndex('salary_payments_transaction_unique').on(table.transactionId)
  })
)

// ---------------------------------------------------------------------------
// SALARY_ADVANCES — Avances sur salaire
// ---------------------------------------------------------------------------
/**
 * Avance sur salaire accordée à un employé. Distincte de `SALARY_PAYMENTS` :
 * une avance n'est pas le paiement d'un mois donné, mais une sortie de caisse
 * anticipée qui sera intégralement déduite du prochain salaire versé
 * (BR-010). Un employé ne peut avoir qu'une seule avance 'pending' à la fois
 * (contrôle applicatif dans `personnel.service.ts` — on ne cumule pas les
 * avances non remboursées, cohérent avec la règle « remboursement en une
 * fois sur la prochaine paie »).
 */
export const salaryAdvances = sqliteTable(
  'SALARY_ADVANCES',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    employeeId: text('employee_id')
      .notNull()
      .references(() => employees.id, { onDelete: 'cascade' }),
    amount: integer('amount').notNull(),
    reason: text('reason'),
    /** Sortie de caisse créée au moment de l'octroi (BR-008, étendu aux avances). */
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'restrict' }),
    /** 'pending' (non remboursée) | 'deducted' (déduite d'une paie) | 'cancelled' (annulée par erreur de saisie). */
    status: text('status').notNull().default('pending'),
    /** Paiement de salaire lors duquel l'avance a été déduite, une fois remboursée. */
    deductedInPaymentId: text('deducted_in_payment_id').references(() => salaryPayments.id, {
      onDelete: 'set null'
    }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: text('created_at').notNull().$defaultFn(nowIso)
  },
  (table) => ({
    employeeIdx: index('salary_advances_employee_idx').on(table.employeeId),
    statusIdx: index('salary_advances_status_idx').on(table.status)
  })
)

// ---------------------------------------------------------------------------
// AUDIT_LOG — Journal d'audit
// ---------------------------------------------------------------------------
export const auditLog = sqliteTable(
  'AUDIT_LOG',
  {
    id: text('id').primaryKey().$defaultFn(generateId),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    /** ex: "create", "update", "delete", "print", "cancel"... */
    action: text('action').notNull(),
    /** ex: "student", "transaction", "employee"... */
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    /** JSON sérialisé des changements (avant/après). */
    details: text('details'),
    createdAt: text('created_at').notNull().$defaultFn(nowIso)
  },
  (table) => ({
    entityIdx: index('audit_log_entity_idx').on(table.entityType, table.entityId),
    createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt)
  })
)

// ---------------------------------------------------------------------------
// Relations (pour l'API de requêtage relationnel de Drizzle)
// ---------------------------------------------------------------------------

export const usersRelations = relations(users, ({ many }) => ({
  studentsCreated: many(students),
  transactions: many(transactions),
  auditLogEntries: many(auditLog)
}))

export const schoolYearsRelations = relations(schoolYears, ({ many }) => ({
  enrollments: many(enrollments),
  tuitionSchedules: many(tuitionSchedules),
  salaryPayments: many(salaryPayments),
  transactions: many(transactions)
}))

export const classesRelations = relations(classes, ({ many }) => ({
  enrollments: many(enrollments),
  tuitionSchedules: many(tuitionSchedules)
}))

export const studentsRelations = relations(students, ({ one, many }) => ({
  createdByUser: one(users, { fields: [students.createdBy], references: [users.id] }),
  guardians: many(guardians),
  enrollments: many(enrollments),
  transactions: many(transactions)
}))

export const guardiansRelations = relations(guardians, ({ one }) => ({
  student: one(students, { fields: [guardians.studentId], references: [students.id] })
}))

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
  student: one(students, { fields: [enrollments.studentId], references: [students.id] }),
  schoolYear: one(schoolYears, {
    fields: [enrollments.schoolYearId],
    references: [schoolYears.id]
  }),
  class: one(classes, { fields: [enrollments.classId], references: [classes.id] })
}))

export const tuitionSchedulesRelations = relations(tuitionSchedules, ({ one, many }) => ({
  class: one(classes, { fields: [tuitionSchedules.classId], references: [classes.id] }),
  schoolYear: one(schoolYears, {
    fields: [tuitionSchedules.schoolYearId],
    references: [schoolYears.id]
  }),
  installments: many(tuitionInstallments)
}))

export const tuitionInstallmentsRelations = relations(tuitionInstallments, ({ one, many }) => ({
  schedule: one(tuitionSchedules, {
    fields: [tuitionInstallments.scheduleId],
    references: [tuitionSchedules.id]
  }),
  transactions: many(transactions)
}))

export const transactionsRelations = relations(transactions, ({ one }) => ({
  student: one(students, { fields: [transactions.studentId], references: [students.id] }),
  installment: one(tuitionInstallments, {
    fields: [transactions.installmentId],
    references: [tuitionInstallments.id]
  }),
  employee: one(employees, { fields: [transactions.employeeId], references: [employees.id] }),
  user: one(users, { fields: [transactions.userId], references: [users.id] }),
  schoolYear: one(schoolYears, {
    fields: [transactions.schoolYearId],
    references: [schoolYears.id]
  }),
  receipt: one(receipts, { fields: [transactions.id], references: [receipts.transactionId] }),
  salaryPayment: one(salaryPayments, {
    fields: [transactions.id],
    references: [salaryPayments.transactionId]
  })
}))

export const receiptsRelations = relations(receipts, ({ one }) => ({
  transaction: one(transactions, {
    fields: [receipts.transactionId],
    references: [transactions.id]
  })
}))

export const employeesRelations = relations(employees, ({ many }) => ({
  transactions: many(transactions),
  salaryPayments: many(salaryPayments),
  salaryAdvances: many(salaryAdvances)
}))

export const salaryPaymentsRelations = relations(salaryPayments, ({ one }) => ({
  employee: one(employees, { fields: [salaryPayments.employeeId], references: [employees.id] }),
  schoolYear: one(schoolYears, {
    fields: [salaryPayments.schoolYearId],
    references: [schoolYears.id]
  }),
  transaction: one(transactions, {
    fields: [salaryPayments.transactionId],
    references: [transactions.id]
  })
}))

export const salaryAdvancesRelations = relations(salaryAdvances, ({ one }) => ({
  employee: one(employees, { fields: [salaryAdvances.employeeId], references: [employees.id] }),
  transaction: one(transactions, {
    fields: [salaryAdvances.transactionId],
    references: [transactions.id]
  }),
  deductedInPayment: one(salaryPayments, {
    fields: [salaryAdvances.deductedInPaymentId],
    references: [salaryPayments.id]
  }),
  user: one(users, { fields: [salaryAdvances.userId], references: [users.id] })
}))

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  user: one(users, { fields: [auditLog.userId], references: [users.id] })
}))

// Ré-export du helper `sql` pour usage éventuel dans les services (defaults SQL bruts).
export { sql }
