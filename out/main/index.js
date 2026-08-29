"use strict";
const electron = require("electron");
const path = require("path");
const node_fs = require("node:fs");
const node_path = require("node:path");
const Database = require("better-sqlite3");
const betterSqlite3 = require("drizzle-orm/better-sqlite3");
const drizzleOrm = require("drizzle-orm");
const sqliteCore = require("drizzle-orm/sqlite-core");
const node_crypto = require("node:crypto");
const migrator = require("drizzle-orm/better-sqlite3/migrator");
const node_os = require("node:os");
const bcrypt = require("bcryptjs");
const nodeThermalPrinter = require("node-thermal-printer");
const dateFns = require("date-fns");
const locale = require("date-fns/locale");
const node_zlib = require("node:zlib");
const node_http = require("node:http");
const googleapis = require("googleapis");
const node_stream = require("node:stream");
const is = {
  dev: !electron.app.isPackaged
};
const platform = {
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
};
const electronApp = {
  setAppUserModelId(id) {
    if (platform.isWindows)
      electron.app.setAppUserModelId(is.dev ? process.execPath : id);
  },
  setAutoLaunch(auto) {
    if (platform.isLinux)
      return false;
    const isOpenAtLogin = () => {
      return electron.app.getLoginItemSettings().openAtLogin;
    };
    if (isOpenAtLogin() !== auto) {
      electron.app.setLoginItemSettings({ openAtLogin: auto });
      return isOpenAtLogin() === auto;
    } else {
      return true;
    }
  },
  skipProxy() {
    return electron.session.defaultSession.setProxy({ mode: "direct" });
  }
};
const optimizer = {
  watchWindowShortcuts(window, shortcutOptions) {
    if (!window)
      return;
    const { webContents } = window;
    const { escToCloseWindow = false, zoom = false } = shortcutOptions || {};
    webContents.on("before-input-event", (event, input) => {
      if (input.type === "keyDown") {
        if (!is.dev) {
          if (input.code === "KeyR" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "KeyI" && (input.alt && input.meta || input.control && input.shift)) {
            event.preventDefault();
          }
        } else {
          if (input.code === "F12") {
            if (webContents.isDevToolsOpened()) {
              webContents.closeDevTools();
            } else {
              webContents.openDevTools({ mode: "undocked" });
              console.log("Open dev tool...");
            }
          }
        }
        if (escToCloseWindow) {
          if (input.code === "Escape" && input.key !== "Process") {
            window.close();
            event.preventDefault();
          }
        }
        if (!zoom) {
          if (input.code === "Minus" && (input.control || input.meta))
            event.preventDefault();
          if (input.code === "Equal" && input.shift && (input.control || input.meta))
            event.preventDefault();
        }
      }
    });
  },
  registerFramelessWindowIpc() {
    electron.ipcMain.on("win:invoke", (event, action) => {
      const win = electron.BrowserWindow.fromWebContents(event.sender);
      if (win) {
        if (action === "show") {
          win.show();
        } else if (action === "showInactive") {
          win.showInactive();
        } else if (action === "min") {
          win.minimize();
        } else if (action === "max") {
          const isMaximized = win.isMaximized();
          if (isMaximized) {
            win.unmaximize();
          } else {
            win.maximize();
          }
        } else if (action === "close") {
          win.close();
        }
      }
    });
  }
};
const icon = path.join(__dirname, "../../resources/icon.png");
function loadEnvFile() {
  const candidates = electron.app.isPackaged ? [node_path.join(process.resourcesPath, ".env")] : [node_path.join(__dirname, "../../.env")];
  for (const path2 of candidates) {
    if (!node_fs.existsSync(path2)) continue;
    try {
      const content = node_fs.readFileSync(path2, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) continue;
        const key = trimmed.slice(0, separatorIndex).trim();
        let value = trimmed.slice(separatorIndex + 1).trim();
        if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
          value = value.slice(1, -1);
        }
        if (key && process.env[key] === void 0) {
          process.env[key] = value;
        }
      }
    } catch (error) {
      console.warn(`[config] Échec de la lecture de ${path2} :`, error);
    }
    return;
  }
}
function generateId() {
  return node_crypto.randomUUID();
}
const nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
const users = sqliteCore.sqliteTable(
  "USERS",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    username: sqliteCore.text("username").notNull(),
    passwordHash: sqliteCore.text("password_hash").notNull(),
    fullName: sqliteCore.text("full_name").notNull(),
    /** Force le changement de mot de passe au prochain login (voir F-004.5). */
    mustChangePassword: sqliteCore.integer("must_change_password", { mode: "boolean" }).notNull().default(true),
    /** Désactivation d'un compte sans suppression physique (Phase 9.4 — cohérent avec BR-006). */
    isActive: sqliteCore.integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso),
    lastLogin: sqliteCore.text("last_login")
  },
  (table) => ({
    usernameUnique: sqliteCore.uniqueIndex("users_username_unique").on(table.username)
  })
);
const schoolInfo = sqliteCore.sqliteTable("SCHOOL_INFO", {
  id: sqliteCore.text("id").primaryKey(),
  name: sqliteCore.text("name").notNull().default(""),
  address: sqliteCore.text("address"),
  phone: sqliteCore.text("phone"),
  email: sqliteCore.text("email"),
  /** Data URL base64 (ex: "data:image/png;base64,..."). */
  logoDataUrl: sqliteCore.text("logo_data_url"),
  /** Data URL base64 du cachet de l'établissement. */
  stampDataUrl: sqliteCore.text("stamp_data_url"),
  updatedAt: sqliteCore.text("updated_at").notNull().$defaultFn(nowIso)
});
const license = sqliteCore.sqliteTable("LICENSE", {
  id: sqliteCore.text("id").primaryKey(),
  /** Dupliqué en clair pour un contrôle rapide — la valeur de référence reste celle du payload chiffré. */
  machineFingerprint: sqliteCore.text("machine_fingerprint").notNull(),
  /** Blob base64 (iv + authTag + ciphertext) — voir commentaire de la table. */
  encryptedPayload: sqliteCore.text("encrypted_payload").notNull(),
  /** Dernière vérification en ligne réussie (resynchronisation opportuniste). `null` si jamais rejointe depuis l'activation. */
  lastVerifiedAt: sqliteCore.text("last_verified_at"),
  /** Marque la fin de l'assistant d'onboarding (étapes 1 à 5 complétées ; l'étape 6 Google Drive est optionnelle). */
  onboardingCompletedAt: sqliteCore.text("onboarding_completed_at"),
  createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso),
  updatedAt: sqliteCore.text("updated_at").notNull().$defaultFn(nowIso)
});
const schoolYears = sqliteCore.sqliteTable(
  "SCHOOL_YEARS",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    /** ex: "2025-2026" */
    label: sqliteCore.text("label").notNull(),
    isCurrent: sqliteCore.integer("is_current", { mode: "boolean" }).notNull().default(false),
    createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso)
  },
  (table) => ({
    labelUnique: sqliteCore.uniqueIndex("school_years_label_unique").on(table.label)
  })
);
const classes = sqliteCore.sqliteTable(
  "CLASSES",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    /** ex: "CI", "CP", "6ème"... */
    name: sqliteCore.text("name").notNull(),
    sortOrder: sqliteCore.integer("sort_order").notNull().default(0)
  },
  (table) => ({
    nameUnique: sqliteCore.uniqueIndex("classes_name_unique").on(table.name)
  })
);
const students = sqliteCore.sqliteTable(
  "STUDENTS",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    /** BR-002 : généré automatiquement, unique, jamais réutilisé, jamais modifiable. */
    matricule: sqliteCore.text("matricule").notNull(),
    photoPath: sqliteCore.text("photo_path"),
    lastName: sqliteCore.text("last_name").notNull(),
    firstName: sqliteCore.text("first_name").notNull(),
    /** 'M' | 'F' */
    gender: sqliteCore.text("gender").notNull(),
    dateOfBirth: sqliteCore.text("date_of_birth").notNull(),
    placeOfBirth: sqliteCore.text("place_of_birth"),
    nationality: sqliteCore.text("nationality").notNull().default("Béninoise"),
    address: sqliteCore.text("address"),
    /** Renseigné si l'élève est un transfert. */
    previousSchool: sqliteCore.text("previous_school"),
    /** BR-006 : soft delete — jamais de suppression physique. */
    isActive: sqliteCore.integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso),
    updatedAt: sqliteCore.text("updated_at").notNull().$defaultFn(nowIso),
    createdBy: sqliteCore.text("created_by").references(() => users.id, { onDelete: "set null" })
  },
  (table) => ({
    matriculeUnique: sqliteCore.uniqueIndex("students_matricule_unique").on(table.matricule),
    nameIdx: sqliteCore.index("students_name_idx").on(table.lastName, table.firstName)
  })
);
const guardians = sqliteCore.sqliteTable(
  "GUARDIANS",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    studentId: sqliteCore.text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    lastName: sqliteCore.text("last_name").notNull(),
    firstName: sqliteCore.text("first_name").notNull(),
    phone: sqliteCore.text("phone").notNull(),
    profession: sqliteCore.text("profession"),
    /** ex: "Père", "Mère", "Tuteur légal"... */
    relationship: sqliteCore.text("relationship").notNull()
  },
  (table) => ({
    studentIdx: sqliteCore.index("guardians_student_idx").on(table.studentId)
  })
);
const enrollments = sqliteCore.sqliteTable(
  "ENROLLMENTS",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    studentId: sqliteCore.text("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    schoolYearId: sqliteCore.text("school_year_id").notNull().references(() => schoolYears.id, { onDelete: "restrict" }),
    classId: sqliteCore.text("class_id").notNull().references(() => classes.id, { onDelete: "restrict" }),
    /** 'admis' | 'redoublant' */
    status: sqliteCore.text("status").notNull(),
    createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso)
  },
  (table) => ({
    // BR-003 : un seul statut de progression par élève et par année scolaire.
    studentYearUnique: sqliteCore.uniqueIndex("enrollments_student_year_unique").on(
      table.studentId,
      table.schoolYearId
    ),
    // Rapports "Par classe" (F-017 refonte) : résolution élèves ↔ classe pour
    // l'année en cours, appelée à chaque chargement des rapports filtrés.
    classYearIdx: sqliteCore.index("enrollments_class_year_idx").on(table.classId, table.schoolYearId)
  })
);
const tuitionSchedules = sqliteCore.sqliteTable(
  "TUITION_SCHEDULES",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    classId: sqliteCore.text("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    schoolYearId: sqliteCore.text("school_year_id").notNull().references(() => schoolYears.id, { onDelete: "cascade" })
  },
  (table) => ({
    classYearUnique: sqliteCore.uniqueIndex("tuition_schedules_class_year_unique").on(
      table.classId,
      table.schoolYearId
    )
  })
);
const tuitionInstallments = sqliteCore.sqliteTable(
  "TUITION_INSTALLMENTS",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    scheduleId: sqliteCore.text("schedule_id").notNull().references(() => tuitionSchedules.id, { onDelete: "cascade" }),
    /** ex: "1ère tranche" */
    label: sqliteCore.text("label").notNull(),
    /** Montant attendu, en FCFA. */
    amount: sqliteCore.integer("amount").notNull(),
    dueDate: sqliteCore.text("due_date").notNull(),
    sortOrder: sqliteCore.integer("sort_order").notNull().default(0),
    /**
     * 'tous' | 'nouveau' | 'ancien' — population concernée par cette tranche
     * (ex: une tranche "Frais d'inscription" peut ne concerner que les
     * nouveaux, en plus des tranches communes à tous). Calculé au moment du
     * compte de scolarité via `getEnrollmentHistoryStatus` (student.service).
     */
    appliesTo: sqliteCore.text("applies_to").notNull().default("tous").$type()
  },
  (table) => ({
    scheduleIdx: sqliteCore.index("tuition_installments_schedule_idx").on(table.scheduleId)
  })
);
const transactions = sqliteCore.sqliteTable(
  "TRANSACTIONS",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    /** 'entry' | 'exit' */
    type: sqliteCore.text("type").notNull(),
    /** BR-004 : frais d'inscription, scolarité, frais divers, don, autre recette
     *  (entrées) — dépense quotidienne, salaire, achat de fournitures, charge
     *  diverse (sorties). Voir shared/constants pour la liste exacte. */
    category: sqliteCore.text("category").notNull(),
    description: sqliteCore.text("description"),
    /** Montant, en FCFA (entier). */
    amount: sqliteCore.integer("amount").notNull(),
    studentId: sqliteCore.text("student_id").references(() => students.id, { onDelete: "set null" }),
    installmentId: sqliteCore.text("installment_id").references(() => tuitionInstallments.id, {
      onDelete: "set null"
    }),
    employeeId: sqliteCore.text("employee_id").references(() => employees.id, { onDelete: "set null" }),
    /** 'validated' | 'cancelled' — BR-005 : jamais de suppression, uniquement marquage "annulée". */
    status: sqliteCore.text("status").notNull().default("validated"),
    /** Référence l'opération d'annulation associée, le cas échéant. */
    cancelledByTxn: sqliteCore.text("cancelled_by_txn"),
    /** Motif saisi par l'opérateur lors de l'annulation (BR-005 : conservé sur l'opération elle-même,
     *  aucune ligne supplémentaire n'est créée dans le journal). */
    cancelReason: sqliteCore.text("cancel_reason"),
    userId: sqliteCore.text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    /** Année scolaire en cours au moment de l'enregistrement — permet de filtrer
     *  le journal de caisse par année scolaire (cohérent avec ENROLLMENTS). */
    schoolYearId: sqliteCore.text("school_year_id").references(() => schoolYears.id, { onDelete: "restrict" }),
    createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso)
  },
  (table) => ({
    createdAtIdx: sqliteCore.index("transactions_created_at_idx").on(table.createdAt),
    studentIdx: sqliteCore.index("transactions_student_idx").on(table.studentId),
    typeIdx: sqliteCore.index("transactions_type_idx").on(table.type),
    schoolYearIdx: sqliteCore.index("transactions_school_year_idx").on(table.schoolYearId)
  })
);
const receipts = sqliteCore.sqliteTable(
  "RECEIPTS",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    receiptNumber: sqliteCore.text("receipt_number").notNull(),
    transactionId: sqliteCore.text("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
    amount: sqliteCore.integer("amount").notNull(),
    createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso),
    /** Nombre de réimpressions du reçu. */
    printCount: sqliteCore.integer("print_count").notNull().default(0)
  },
  (table) => ({
    receiptNumberUnique: sqliteCore.uniqueIndex("receipts_receipt_number_unique").on(table.receiptNumber),
    transactionUnique: sqliteCore.uniqueIndex("receipts_transaction_unique").on(table.transactionId)
  })
);
const printerConfig = sqliteCore.sqliteTable("PRINTER_CONFIG", {
  id: sqliteCore.text("id").primaryKey(),
  /** Impression thermique activée. Si `false`, on bascule directement sur le fallback PDF. */
  enabled: sqliteCore.integer("enabled", { mode: "boolean" }).notNull().default(false),
  /** 'usb' | 'network' */
  connectionType: sqliteCore.text("connection_type").notNull().default("network"),
  /** Chemin du port local (USB), ex: `\\.\COM3`. */
  devicePath: sqliteCore.text("device_path"),
  /** Adresse IP/hôte (réseau). */
  host: sqliteCore.text("host"),
  /** Port TCP (réseau) — 9100 par défaut (port RAW standard des imprimantes ESC/POS). */
  port: sqliteCore.integer("port").notNull().default(9100),
  lastTestAt: sqliteCore.text("last_test_at"),
  lastTestSuccess: sqliteCore.integer("last_test_success", { mode: "boolean" }),
  lastTestMessage: sqliteCore.text("last_test_message"),
  updatedAt: sqliteCore.text("updated_at").notNull().$defaultFn(nowIso)
});
const backupConfig = sqliteCore.sqliteTable("BACKUP_CONFIG", {
  id: sqliteCore.text("id").primaryKey(),
  connected: sqliteCore.integer("connected", { mode: "boolean" }).notNull().default(false),
  /** Adresse e-mail du compte Google connecté (affichage uniquement). */
  accountEmail: sqliteCore.text("account_email"),
  /** Refresh token OAuth2, chiffré via `safeStorage` (Electron) — jamais en clair. */
  refreshTokenEncrypted: sqliteCore.text("refresh_token_encrypted"),
  /** ID du dossier Google Drive "AcademyFlow — Sauvegardes", créé au premier export. */
  driveFolderId: sqliteCore.text("drive_folder_id"),
  autoBackupEnabled: sqliteCore.integer("auto_backup_enabled", { mode: "boolean" }).notNull().default(false),
  /** Heure (0-23) de déclenchement de la sauvegarde automatique quotidienne. */
  autoBackupHour: sqliteCore.integer("auto_backup_hour").notNull().default(2),
  lastBackupAt: sqliteCore.text("last_backup_at"),
  /** 'success' | 'error' */
  lastBackupStatus: sqliteCore.text("last_backup_status"),
  lastBackupMessage: sqliteCore.text("last_backup_message"),
  updatedAt: sqliteCore.text("updated_at").notNull().$defaultFn(nowIso)
});
const employees = sqliteCore.sqliteTable(
  "EMPLOYEES",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    lastName: sqliteCore.text("last_name").notNull(),
    firstName: sqliteCore.text("first_name").notNull(),
    /** Fonction occupée. */
    role: sqliteCore.text("role").notNull(),
    phone: sqliteCore.text("phone"),
    /** Salaire mensuel de référence, en FCFA. */
    monthlySalary: sqliteCore.integer("monthly_salary").notNull(),
    /** Soft delete, comme pour les élèves (cohérent avec BR-006). */
    isActive: sqliteCore.integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso)
  },
  (table) => ({
    nameIdx: sqliteCore.index("employees_name_idx").on(table.lastName, table.firstName)
  })
);
const salaryPayments = sqliteCore.sqliteTable(
  "SALARY_PAYMENTS",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    employeeId: sqliteCore.text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    schoolYearId: sqliteCore.text("school_year_id").notNull().references(() => schoolYears.id, { onDelete: "restrict" }),
    /** 1-12 */
    month: sqliteCore.integer("month").notNull(),
    year: sqliteCore.integer("year").notNull(),
    /** BR-008 : lien obligatoire avec la sortie de caisse correspondante. */
    transactionId: sqliteCore.text("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
    paidAt: sqliteCore.text("paid_at").notNull().$defaultFn(nowIso)
  },
  (table) => ({
    // BR-009 : un même mois ne peut être marqué payé qu'une seule fois par employé.
    employeeMonthYearUnique: sqliteCore.uniqueIndex("salary_payments_employee_month_year_unique").on(
      table.employeeId,
      table.month,
      table.year
    ),
    transactionUnique: sqliteCore.uniqueIndex("salary_payments_transaction_unique").on(table.transactionId)
  })
);
const salaryAdvances = sqliteCore.sqliteTable(
  "SALARY_ADVANCES",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    employeeId: sqliteCore.text("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
    amount: sqliteCore.integer("amount").notNull(),
    reason: sqliteCore.text("reason"),
    /** Sortie de caisse créée au moment de l'octroi (BR-008, étendu aux avances). */
    transactionId: sqliteCore.text("transaction_id").notNull().references(() => transactions.id, { onDelete: "restrict" }),
    /** 'pending' (non remboursée) | 'deducted' (déduite d'une paie) | 'cancelled' (annulée par erreur de saisie). */
    status: sqliteCore.text("status").notNull().default("pending"),
    /** Paiement de salaire lors duquel l'avance a été déduite, une fois remboursée. */
    deductedInPaymentId: sqliteCore.text("deducted_in_payment_id").references(() => salaryPayments.id, {
      onDelete: "set null"
    }),
    userId: sqliteCore.text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso)
  },
  (table) => ({
    employeeIdx: sqliteCore.index("salary_advances_employee_idx").on(table.employeeId),
    statusIdx: sqliteCore.index("salary_advances_status_idx").on(table.status)
  })
);
const auditLog = sqliteCore.sqliteTable(
  "AUDIT_LOG",
  {
    id: sqliteCore.text("id").primaryKey().$defaultFn(generateId),
    userId: sqliteCore.text("user_id").notNull().references(() => users.id, { onDelete: "restrict" }),
    /** ex: "create", "update", "delete", "print", "cancel"... */
    action: sqliteCore.text("action").notNull(),
    /** ex: "student", "transaction", "employee"... */
    entityType: sqliteCore.text("entity_type").notNull(),
    entityId: sqliteCore.text("entity_id").notNull(),
    /** JSON sérialisé des changements (avant/après). */
    details: sqliteCore.text("details"),
    createdAt: sqliteCore.text("created_at").notNull().$defaultFn(nowIso)
  },
  (table) => ({
    entityIdx: sqliteCore.index("audit_log_entity_idx").on(table.entityType, table.entityId),
    createdAtIdx: sqliteCore.index("audit_log_created_at_idx").on(table.createdAt)
  })
);
const usersRelations = drizzleOrm.relations(users, ({ many }) => ({
  studentsCreated: many(students),
  transactions: many(transactions),
  auditLogEntries: many(auditLog)
}));
const schoolYearsRelations = drizzleOrm.relations(schoolYears, ({ many }) => ({
  enrollments: many(enrollments),
  tuitionSchedules: many(tuitionSchedules),
  salaryPayments: many(salaryPayments),
  transactions: many(transactions)
}));
const classesRelations = drizzleOrm.relations(classes, ({ many }) => ({
  enrollments: many(enrollments),
  tuitionSchedules: many(tuitionSchedules)
}));
const studentsRelations = drizzleOrm.relations(students, ({ one, many }) => ({
  createdByUser: one(users, { fields: [students.createdBy], references: [users.id] }),
  guardians: many(guardians),
  enrollments: many(enrollments),
  transactions: many(transactions)
}));
const guardiansRelations = drizzleOrm.relations(guardians, ({ one }) => ({
  student: one(students, { fields: [guardians.studentId], references: [students.id] })
}));
const enrollmentsRelations = drizzleOrm.relations(enrollments, ({ one }) => ({
  student: one(students, { fields: [enrollments.studentId], references: [students.id] }),
  schoolYear: one(schoolYears, {
    fields: [enrollments.schoolYearId],
    references: [schoolYears.id]
  }),
  class: one(classes, { fields: [enrollments.classId], references: [classes.id] })
}));
const tuitionSchedulesRelations = drizzleOrm.relations(tuitionSchedules, ({ one, many }) => ({
  class: one(classes, { fields: [tuitionSchedules.classId], references: [classes.id] }),
  schoolYear: one(schoolYears, {
    fields: [tuitionSchedules.schoolYearId],
    references: [schoolYears.id]
  }),
  installments: many(tuitionInstallments)
}));
const tuitionInstallmentsRelations = drizzleOrm.relations(tuitionInstallments, ({ one, many }) => ({
  schedule: one(tuitionSchedules, {
    fields: [tuitionInstallments.scheduleId],
    references: [tuitionSchedules.id]
  }),
  transactions: many(transactions)
}));
const transactionsRelations = drizzleOrm.relations(transactions, ({ one }) => ({
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
}));
const receiptsRelations = drizzleOrm.relations(receipts, ({ one }) => ({
  transaction: one(transactions, {
    fields: [receipts.transactionId],
    references: [transactions.id]
  })
}));
const employeesRelations = drizzleOrm.relations(employees, ({ many }) => ({
  transactions: many(transactions),
  salaryPayments: many(salaryPayments),
  salaryAdvances: many(salaryAdvances)
}));
const salaryPaymentsRelations = drizzleOrm.relations(salaryPayments, ({ one }) => ({
  employee: one(employees, { fields: [salaryPayments.employeeId], references: [employees.id] }),
  schoolYear: one(schoolYears, {
    fields: [salaryPayments.schoolYearId],
    references: [schoolYears.id]
  }),
  transaction: one(transactions, {
    fields: [salaryPayments.transactionId],
    references: [transactions.id]
  })
}));
const salaryAdvancesRelations = drizzleOrm.relations(salaryAdvances, ({ one }) => ({
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
}));
const auditLogRelations = drizzleOrm.relations(auditLog, ({ one }) => ({
  user: one(users, { fields: [auditLog.userId], references: [users.id] })
}));
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  auditLog,
  auditLogRelations,
  backupConfig,
  classes,
  classesRelations,
  employees,
  employeesRelations,
  enrollments,
  enrollmentsRelations,
  guardians,
  guardiansRelations,
  license,
  printerConfig,
  receipts,
  receiptsRelations,
  salaryAdvances,
  salaryAdvancesRelations,
  salaryPayments,
  salaryPaymentsRelations,
  schoolInfo,
  schoolYears,
  schoolYearsRelations,
  sql: drizzleOrm.sql,
  students,
  studentsRelations,
  transactions,
  transactionsRelations,
  tuitionInstallments,
  tuitionInstallmentsRelations,
  tuitionSchedules,
  tuitionSchedulesRelations,
  users,
  usersRelations
}, Symbol.toStringTag, { value: "Module" }));
let sqliteInstance;
let dbInstance;
function getDatabasePath() {
  const userDataPath = electron.app.getPath("userData");
  const dataDir = node_path.join(userDataPath, "data");
  node_fs.mkdirSync(dataDir, { recursive: true });
  return node_path.join(dataDir, "academyflow.db");
}
function createConnection() {
  const dbPath = getDatabasePath();
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("synchronous = NORMAL");
  const db = betterSqlite3.drizzle(sqlite, { schema });
  sqliteInstance = sqlite;
  dbInstance = db;
  return { sqlite, db };
}
function getDb() {
  if (!dbInstance) {
    throw new Error(
      "La base de données n'est pas initialisée. Appeler createConnection() au démarrage."
    );
  }
  return dbInstance;
}
function getSqlite() {
  if (!sqliteInstance) {
    throw new Error(
      "La base de données n'est pas initialisée. Appeler createConnection() au démarrage."
    );
  }
  return sqliteInstance;
}
function closeConnection() {
  sqliteInstance?.close();
  sqliteInstance = void 0;
  dbInstance = void 0;
}
function getMigrationsFolder() {
  if (electron.app.isPackaged) {
    return node_path.join(process.resourcesPath, "migrations");
  }
  return node_path.join(__dirname, "../../resources/migrations");
}
function runMigrations(db) {
  const migrationsFolder = getMigrationsFolder();
  if (!node_fs.existsSync(migrationsFolder)) {
    console.warn(
      `[database] Dossier de migrations introuvable (${migrationsFolder}). Exécutez "npm run db:generate" puis relancez l'application.`
    );
    return;
  }
  migrator.migrate(db, { migrationsFolder });
}
function initDatabase() {
  const { db } = createConnection();
  runMigrations(db);
  return db;
}
const IPC_CHANNELS = {
  /** Canal de test — validation du round-trip IPC en Phase 2. */
  system: {
    ping: "system:ping"
  },
  students: {
    create: "students:create",
    update: "students:update",
    delete: "students:delete",
    findById: "students:findById",
    search: "students:search",
    getStats: "students:getStats",
    listEnrollmentClassNames: "students:listEnrollmentClassNames",
    listByClass: "students:listByClass",
    addGuardian: "students:addGuardian",
    updateGuardian: "students:updateGuardian",
    deleteGuardian: "students:deleteGuardian",
    createEnrollment: "students:createEnrollment",
    getEnrollmentHistory: "students:getEnrollmentHistory",
    checkDuplicate: "students:checkDuplicate",
    promoteStudents: "students:promoteStudents",
    hasFinancialHistory: "students:hasFinancialHistory"
  },
  cashbox: {
    createEntry: "cashbox:createEntry",
    cancelTransaction: "cashbox:cancelTransaction",
    getJournal: "cashbox:getJournal",
    getStudentAccount: "cashbox:getStudentAccount",
    listArrears: "cashbox:listArrears",
    getReportV2: "cashbox:getReportV2",
    getTypeReport: "cashbox:getTypeReport",
    getReportByClass: "cashbox:getReportByClass",
    getReportByCashier: "cashbox:getReportByCashier",
    getReceipt: "cashbox:getReceipt",
    reprintReceipt: "cashbox:reprintReceipt",
    getBalance: "cashbox:getBalance",
    getStats: "cashbox:getStats"
  },
  personnel: {
    create: "personnel:create",
    update: "personnel:update",
    delete: "personnel:delete",
    list: "personnel:list",
    getById: "personnel:getById",
    markSalaryPaid: "personnel:markSalaryPaid",
    getSalaryStatus: "personnel:getSalaryStatus",
    getSalaryHistory: "personnel:getSalaryHistory",
    grantAdvance: "personnel:grantAdvance",
    cancelAdvance: "personnel:cancelAdvance",
    listAdvances: "personnel:listAdvances",
    getPendingAdvance: "personnel:getPendingAdvance"
  },
  settings: {
    getCurrentSchoolYear: "settings:getCurrentSchoolYear",
    listSchoolYears: "settings:listSchoolYears",
    createSchoolYear: "settings:createSchoolYear",
    setCurrentSchoolYear: "settings:setCurrentSchoolYear",
    getClasses: "settings:getClasses",
    createClass: "settings:createClass",
    updateClass: "settings:updateClass",
    deleteClass: "settings:deleteClass",
    getTuitionSchedule: "settings:getTuitionSchedule",
    saveTuitionSchedule: "settings:saveTuitionSchedule",
    getSchoolInfo: "settings:getSchoolInfo",
    updateSchoolInfo: "settings:updateSchoolInfo"
  },
  auth: {
    login: "auth:login",
    logout: "auth:logout",
    getCurrentUser: "auth:getCurrentUser",
    changePassword: "auth:changePassword",
    getUserById: "auth:getUserById",
    /** Gestion des comptes utilisateurs (Phase 9.4, onglet « Utilisateurs » des Paramètres). */
    listUsers: "auth:listUsers",
    createUser: "auth:createUser",
    updateUser: "auth:updateUser",
    setUserActive: "auth:setUserActive",
    resetPassword: "auth:resetPassword"
  },
  printer: {
    printReceipt: "printer:printReceipt",
    testConnection: "printer:testConnection",
    openPdf: "printer:openPdf",
    /** Ouvre tout fichier binaire déjà généré côté renderer (ex: export Excel) avec l'application par défaut du système. */
    openFile: "printer:openFile",
    /** Configuration de l'imprimante thermique (Phase 9.2). */
    getConfig: "printer:getConfig",
    updateConfig: "printer:updateConfig",
    getStatus: "printer:getStatus"
  },
  backup: {
    exportToCloud: "backup:exportToCloud",
    getLastBackup: "backup:getLastBackup",
    /** Sauvegarde cloud Google Drive (Phase 9.3). */
    getStatus: "backup:getStatus",
    listBackups: "backup:listBackups",
    restoreFromCloud: "backup:restoreFromCloud",
    connectGoogleAccount: "backup:connectGoogleAccount",
    disconnectGoogleAccount: "backup:disconnectGoogleAccount",
    updateSettings: "backup:updateSettings"
  },
  license: {
    getStatus: "license:getStatus",
    activate: "license:activate",
    resync: "license:resync",
    markOnboardingCompleted: "license:markOnboardingCompleted"
  },
  dashboard: {
    /** Agrégat complet du tableau de bord financier (F-019, Phase 9.1). */
    getStats: "dashboard:getStats"
  }
};
function registerSystemIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.system.ping, async () => {
    return "pong";
  });
}
function computeMachineFingerprint() {
  const macAddresses = Object.values(node_os.networkInterfaces()).flat().filter(
    (iface) => !!iface && !iface.internal && iface.mac !== "00:00:00:00:00:00"
  ).map((iface) => iface.mac).sort();
  const parts = [node_os.hostname(), node_os.platform(), node_os.arch(), ...macAddresses];
  return node_crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}
const LICENSE_ROW_ID = "singleton";
const GRACE_PERIOD_DAYS = 3;
const ALERT_THRESHOLDS_DAYS = { warning_15: 15, warning_7: 7, warning_1: 1 };
const APP_PEPPER = "academyflow-license-v1";
const DEV_BYPASS_LICENSE_KEY = "AF-DEV0-TEST-0000-0000";
const DEV_BYPASS_VALIDITY_DAYS = 365;
function deriveKey(salt, machineFingerprint) {
  return node_crypto.scryptSync(`${machineFingerprint}:${APP_PEPPER}`, salt, 32);
}
function encryptPayload(payload) {
  const salt = node_crypto.randomBytes(16);
  const iv = node_crypto.randomBytes(12);
  const key = deriveKey(salt, payload.machineFingerprint);
  const cipher = node_crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf-8"),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return [
    salt.toString("hex"),
    iv.toString("hex"),
    authTag.toString("hex"),
    ciphertext.toString("hex")
  ].join(":");
}
function decryptPayload(blob, machineFingerprint) {
  try {
    const [saltHex, ivHex, authTagHex, ciphertextHex] = blob.split(":");
    if (!saltHex || !ivHex || !authTagHex || !ciphertextHex) return null;
    const salt = Buffer.from(saltHex, "hex");
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const ciphertext = Buffer.from(ciphertextHex, "hex");
    const key = deriveKey(salt, machineFingerprint);
    const decipher = node_crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      "utf-8"
    );
    const payload = JSON.parse(plaintext);
    if (payload.machineFingerprint !== machineFingerprint) return null;
    return payload;
  } catch {
    return null;
  }
}
function getRow() {
  const db = getDb();
  return db.select().from(license).where(drizzleOrm.eq(license.id, LICENSE_ROW_ID)).get() ?? null;
}
function upsertRow(fields) {
  const db = getDb();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const existing = getRow();
  if (existing) {
    db.update(license).set({
      machineFingerprint: fields.machineFingerprint,
      encryptedPayload: fields.encryptedPayload,
      ...fields.lastVerifiedAt !== void 0 ? { lastVerifiedAt: fields.lastVerifiedAt } : {},
      ...fields.onboardingCompletedAt !== void 0 ? { onboardingCompletedAt: fields.onboardingCompletedAt } : {},
      updatedAt: now
    }).where(drizzleOrm.eq(license.id, LICENSE_ROW_ID)).run();
  } else {
    db.insert(license).values({
      id: LICENSE_ROW_ID,
      machineFingerprint: fields.machineFingerprint,
      encryptedPayload: fields.encryptedPayload,
      lastVerifiedAt: fields.lastVerifiedAt ?? null,
      onboardingCompletedAt: fields.onboardingCompletedAt ?? null
    }).run();
  }
}
async function callRemoteActivation(licenseKey, machineFingerprint) {
  if (!electron.app.isPackaged && licenseKey.trim().toUpperCase() === DEV_BYPASS_LICENSE_KEY) {
    console.warn(
      `[license] Clé de test développeur utilisée (${DEV_BYPASS_LICENSE_KEY}) — activation locale sans appel réseau. Ne fonctionne jamais dans un build packagé.`
    );
    const expiresAt = new Date(
      Date.now() + DEV_BYPASS_VALIDITY_DAYS * 24 * 60 * 60 * 1e3
    ).toISOString();
    return { valid: true, expiresAt };
  }
  const apiUrl = process.env.LICENSE_API_URL;
  if (!apiUrl) {
    return {
      valid: false,
      error: "Serveur de licence non configuré (LICENSE_API_URL manquant)."
    };
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1e4);
    const response = await fetch(`${apiUrl}/activate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ licenseKey, machineFingerprint }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!response.ok) {
      const body2 = await response.json().catch(() => null);
      return {
        valid: false,
        error: body2?.error ?? "Clé de licence invalide ou déjà utilisée sur un autre poste."
      };
    }
    const body = await response.json();
    return { valid: true, expiresAt: body.expiresAt };
  } catch {
    return {
      valid: false,
      error: "Impossible de joindre le serveur de licence. Vérifiez votre connexion Internet et réessayez."
    };
  }
}
async function activateLicense(dto) {
  const licenseKey = dto.licenseKey.trim();
  if (!licenseKey) {
    return { success: false, status: evaluateLicense(), error: "La clé de licence est requise." };
  }
  const machineFingerprint = computeMachineFingerprint();
  const result = await callRemoteActivation(licenseKey, machineFingerprint);
  if (!result.valid || !result.expiresAt) {
    return { success: false, status: evaluateLicense(), error: result.error };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const payload = {
    licenseKey,
    activatedAt: now,
    expiresAt: result.expiresAt,
    lastKnownDate: now,
    machineFingerprint
  };
  upsertRow({
    machineFingerprint,
    encryptedPayload: encryptPayload(payload),
    lastVerifiedAt: now
  });
  console.log(`[license] Licence activée, expire le ${result.expiresAt}.`);
  return { success: true, status: evaluateLicense() };
}
function touchClockRatchet() {
  const row = getRow();
  if (!row) return;
  const machineFingerprint = computeMachineFingerprint();
  const payload = decryptPayload(row.encryptedPayload, machineFingerprint);
  if (!payload) return;
  const now = /* @__PURE__ */ new Date();
  const lastKnown = new Date(payload.lastKnownDate);
  if (now.getTime() < lastKnown.getTime()) {
    console.warn(
      `[license] Recul d'horloge détecté : horloge système à ${now.toISOString()}, dernière date connue ${payload.lastKnownDate}.`
    );
    return;
  }
  const updated = { ...payload, lastKnownDate: now.toISOString() };
  upsertRow({ machineFingerprint, encryptedPayload: encryptPayload(updated) });
}
async function resyncLicense() {
  const row = getRow();
  if (!row) return;
  const machineFingerprint = computeMachineFingerprint();
  const payload = decryptPayload(row.encryptedPayload, machineFingerprint);
  if (!payload) return;
  const result = await callRemoteActivation(payload.licenseKey, machineFingerprint);
  if (!result.valid || !result.expiresAt) return;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updated = { ...payload, expiresAt: result.expiresAt, lastKnownDate: now };
  upsertRow({ machineFingerprint, encryptedPayload: encryptPayload(updated), lastVerifiedAt: now });
}
function computeAlertLevel(daysRemaining) {
  if (daysRemaining <= ALERT_THRESHOLDS_DAYS.warning_1) return "warning_1";
  if (daysRemaining <= ALERT_THRESHOLDS_DAYS.warning_7) return "warning_7";
  if (daysRemaining <= ALERT_THRESHOLDS_DAYS.warning_15) return "warning_15";
  return "none";
}
function evaluateLicense() {
  const row = getRow();
  if (!row) {
    return {
      state: "not_activated",
      expiresAt: null,
      daysRemaining: null,
      alertLevel: "none",
      lastVerifiedAt: null,
      onboardingCompleted: false
    };
  }
  const machineFingerprint = computeMachineFingerprint();
  const payload = decryptPayload(row.encryptedPayload, machineFingerprint);
  const onboardingCompleted = row.onboardingCompletedAt !== null;
  if (!payload) {
    return {
      state: "invalid",
      expiresAt: null,
      daysRemaining: null,
      alertLevel: "none",
      lastVerifiedAt: row.lastVerifiedAt,
      onboardingCompleted
    };
  }
  const now = /* @__PURE__ */ new Date();
  const lastKnown = new Date(payload.lastKnownDate);
  if (now.getTime() < lastKnown.getTime()) {
    return {
      state: "invalid",
      expiresAt: null,
      daysRemaining: null,
      alertLevel: "none",
      lastVerifiedAt: row.lastVerifiedAt,
      onboardingCompleted
    };
  }
  const expiresAt = new Date(payload.expiresAt);
  const msPerDay = 24 * 60 * 60 * 1e3;
  const daysRemaining = Math.ceil((expiresAt.getTime() - now.getTime()) / msPerDay);
  const graceDeadline = new Date(expiresAt.getTime() + GRACE_PERIOD_DAYS * msPerDay);
  const state = now.getTime() <= graceDeadline.getTime() ? "active" : "readonly";
  return {
    state,
    expiresAt: payload.expiresAt,
    daysRemaining,
    alertLevel: state === "active" ? computeAlertLevel(daysRemaining) : "none",
    lastVerifiedAt: row.lastVerifiedAt,
    onboardingCompleted
  };
}
function markOnboardingCompleted() {
  const row = getRow();
  if (!row) {
    throw new Error("Impossible de terminer la configuration : aucune licence activée.");
  }
  const db = getDb();
  db.update(license).set({ onboardingCompletedAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(license.id, LICENSE_ROW_ID)).run();
}
function registerLicenseIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.license.getStatus, async () => {
    return evaluateLicense();
  });
  electron.ipcMain.handle(IPC_CHANNELS.license.activate, async (_event, dto) => {
    return activateLicense(dto);
  });
  electron.ipcMain.handle(IPC_CHANNELS.license.resync, async () => {
    await resyncLicense();
    return evaluateLicense();
  });
  electron.ipcMain.handle(IPC_CHANNELS.license.markOnboardingCompleted, async () => {
    markOnboardingCompleted();
    return evaluateLicense();
  });
}
const MATRICULE_LENGTH = 8;
const MATRICULE_START = 10000001;
const UPCOMING_DUE_WINDOW_DAYS = 7;
const CASH_EVOLUTION_MONTHS_BACK = 12;
const MONTH_LABELS_FR = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre"
];
function generateMatricule() {
  const db = getDb();
  const [row] = db.select({ max: drizzleOrm.sql`max(cast(${students.matricule} as integer))` }).from(students).all();
  const nextValue = row?.max != null && row.max >= MATRICULE_START ? row.max + 1 : MATRICULE_START;
  const matricule = String(nextValue);
  if (matricule.length !== MATRICULE_LENGTH) {
    throw new Error(
      `Impossible de générer un matricule à ${MATRICULE_LENGTH} chiffres : séquence épuisée (${matricule}).`
    );
  }
  return matricule;
}
function logAction(params) {
  const db = getDb();
  db.insert(auditLog).values({
    userId: params.userId,
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details !== void 0 ? JSON.stringify(params.details) : null
  }).run();
}
function listRecent(limit = 10) {
  const db = getDb();
  const rows = db.select({
    id: auditLog.id,
    userId: auditLog.userId,
    userFullName: users.fullName,
    action: auditLog.action,
    entityType: auditLog.entityType,
    entityId: auditLog.entityId,
    details: auditLog.details,
    createdAt: auditLog.createdAt
  }).from(auditLog).innerJoin(users, drizzleOrm.eq(users.id, auditLog.userId)).orderBy(drizzleOrm.desc(auditLog.createdAt)).limit(limit).all();
  return rows.map((row) => ({
    ...row,
    details: row.details ? JSON.parse(row.details) : null
  }));
}
const DEFAULT_PAGE_SIZE$1 = 20;
function toGuardian(row) {
  return {
    id: row.id,
    studentId: row.studentId,
    lastName: row.lastName,
    firstName: row.firstName,
    phone: row.phone,
    profession: row.profession,
    relationship: row.relationship
  };
}
function getGuardiansForStudent(studentId) {
  const db = getDb();
  return db.select().from(guardians).where(drizzleOrm.eq(guardians.studentId, studentId)).all().map(toGuardian);
}
function requireCurrentSchoolYearId$1() {
  const db = getDb();
  const year = db.select({ id: schoolYears.id }).from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get();
  if (!year) {
    throw new Error(
      "Aucune année scolaire active. Configurez-en une dans Paramètres avant d'inscrire un élève."
    );
  }
  return year.id;
}
function toStudent(row) {
  return {
    id: row.id,
    matricule: row.matricule,
    photoPath: row.photoPath,
    lastName: row.lastName,
    firstName: row.firstName,
    gender: row.gender,
    dateOfBirth: row.dateOfBirth,
    placeOfBirth: row.placeOfBirth,
    nationality: row.nationality,
    address: row.address,
    previousSchool: row.previousSchool,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy: row.createdBy
  };
}
function getEnrollmentHistoryStatus(studentId, schoolYearId) {
  const db = getDb();
  const studentEnrollments = db.select({ schoolYearId: enrollments.schoolYearId, label: schoolYears.label }).from(enrollments).innerJoin(schoolYears, drizzleOrm.eq(schoolYears.id, enrollments.schoolYearId)).where(drizzleOrm.eq(enrollments.studentId, studentId)).orderBy(schoolYears.label).all();
  if (studentEnrollments.length === 0) return "nouveau";
  const targetIndex = studentEnrollments.findIndex((e) => e.schoolYearId === schoolYearId);
  if (targetIndex === -1) {
    const targetLabel = db.select({ label: schoolYears.label }).from(schoolYears).where(drizzleOrm.eq(schoolYears.id, schoolYearId)).get();
    if (!targetLabel) return "nouveau";
    return studentEnrollments.some((e) => e.label < targetLabel.label) ? "ancien" : "nouveau";
  }
  return targetIndex === 0 ? "nouveau" : "ancien";
}
function getOverallHistoryStatus(studentId) {
  const db = getDb();
  const count = db.select({ count: drizzleOrm.sql`count(*)` }).from(enrollments).where(drizzleOrm.eq(enrollments.studentId, studentId)).get();
  return (count?.count ?? 0) > 1 ? "ancien" : "nouveau";
}
function batchGetEnrollmentHistoryStatus(studentIds, schoolYearId) {
  const db = getDb();
  const result = /* @__PURE__ */ new Map();
  if (studentIds.length === 0) return result;
  const rows = db.select({ studentId: enrollments.studentId, label: schoolYears.label }).from(enrollments).innerJoin(schoolYears, drizzleOrm.eq(schoolYears.id, enrollments.schoolYearId)).where(drizzleOrm.inArray(enrollments.studentId, studentIds)).all();
  const firstLabelByStudent = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const current = firstLabelByStudent.get(row.studentId);
    if (!current || row.label < current) firstLabelByStudent.set(row.studentId, row.label);
  }
  const targetYear = db.select({ label: schoolYears.label }).from(schoolYears).where(drizzleOrm.eq(schoolYears.id, schoolYearId)).get();
  for (const studentId of studentIds) {
    const firstLabel = firstLabelByStudent.get(studentId);
    result.set(
      studentId,
      !firstLabel || firstLabel >= (targetYear?.label ?? "") ? "nouveau" : "ancien"
    );
  }
  return result;
}
function checkDuplicate(firstName, lastName, schoolYearId) {
  const db = getDb();
  const match = db.select({ id: students.id }).from(students).innerJoin(enrollments, drizzleOrm.eq(enrollments.studentId, students.id)).where(
    drizzleOrm.and(
      drizzleOrm.eq(enrollments.schoolYearId, schoolYearId),
      drizzleOrm.sql`lower(${students.firstName}) = lower(${firstName})`,
      drizzleOrm.sql`lower(${students.lastName}) = lower(${lastName})`,
      drizzleOrm.eq(students.isActive, true)
    )
  ).get();
  return match ? findById(match.id) : null;
}
function create$1(data) {
  const db = getDb();
  if (!data.guardians || data.guardians.length === 0) {
    throw new Error("Au moins un responsable est requis.");
  }
  const schoolYearId = requireCurrentSchoolYearId$1();
  const duplicate = checkDuplicate(data.firstName, data.lastName, schoolYearId);
  if (duplicate) {
    throw new Error(
      `Une fiche existe déjà pour ${data.firstName} ${data.lastName} pour cette année scolaire (matricule ${duplicate.matricule}).`
    );
  }
  const targetClass = db.select({ id: classes.id }).from(classes).where(drizzleOrm.eq(classes.id, data.classId)).get();
  if (!targetClass) {
    throw new Error("Classe introuvable.");
  }
  const studentId = generateId();
  const matricule = generateMatricule();
  db.transaction((tx) => {
    tx.insert(students).values({
      id: studentId,
      matricule,
      photoPath: data.photoPath ?? null,
      lastName: data.lastName,
      firstName: data.firstName,
      gender: data.gender,
      dateOfBirth: data.dateOfBirth,
      placeOfBirth: data.placeOfBirth ?? null,
      nationality: data.nationality ?? "Béninoise",
      address: data.address ?? null,
      previousSchool: data.previousSchool ?? null,
      createdBy: data.createdBy
    }).run();
    tx.insert(guardians).values(
      data.guardians.map((g) => ({
        id: generateId(),
        studentId,
        lastName: g.lastName,
        firstName: g.firstName,
        phone: g.phone,
        profession: g.profession ?? null,
        relationship: g.relationship
      }))
    ).run();
    tx.insert(enrollments).values({
      id: generateId(),
      studentId,
      schoolYearId,
      classId: data.classId,
      // Un élève créé pour la première fois est toujours 'admis' — le
      // redoublement est une décision de passage de classe (F-004/F-005),
      // qui ne peut concerner qu'une inscription *suivante*.
      status: "admis"
    }).run();
  });
  logAction({
    userId: data.createdBy,
    action: "create",
    entityType: "student",
    entityId: studentId
  });
  const created = findById(studentId);
  if (!created) throw new Error("Échec de la récupération de l'élève après création.");
  return created;
}
function update$1(id, data, userId) {
  const db = getDb();
  const existing = db.select({ id: students.id }).from(students).where(drizzleOrm.eq(students.id, id)).get();
  if (!existing) {
    throw new Error("Élève introuvable.");
  }
  db.update(students).set({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(students.id, id)).run();
  logAction({ userId, action: "update", entityType: "student", entityId: id, details: data });
  const updated = findById(id);
  if (!updated) throw new Error("Échec de la récupération de l'élève après mise à jour.");
  return updated;
}
function softDelete$1(id, userId) {
  const db = getDb();
  const existing = db.select({ id: students.id }).from(students).where(drizzleOrm.eq(students.id, id)).get();
  if (!existing) {
    throw new Error("Élève introuvable.");
  }
  db.update(students).set({ isActive: false, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(students.id, id)).run();
  logAction({ userId, action: "delete", entityType: "student", entityId: id });
}
function hasFinancialHistory(studentId) {
  const db = getDb();
  const row = db.select({ id: transactions.id }).from(transactions).where(drizzleOrm.eq(transactions.studentId, studentId)).get();
  return !!row;
}
function findById(id) {
  const db = getDb();
  const row = db.select().from(students).where(drizzleOrm.eq(students.id, id)).get();
  if (!row) return null;
  return {
    ...toStudent(row),
    guardians: getGuardiansForStudent(id),
    historyStatus: getOverallHistoryStatus(id)
  };
}
function getCurrentClassName(studentId) {
  const db = getDb();
  const currentYear = db.select({ id: schoolYears.id }).from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get();
  if (!currentYear) return null;
  const row = db.select({ className: classes.name }).from(enrollments).innerJoin(classes, drizzleOrm.eq(classes.id, enrollments.classId)).where(drizzleOrm.and(drizzleOrm.eq(enrollments.studentId, studentId), drizzleOrm.eq(enrollments.schoolYearId, currentYear.id))).get();
  return row?.className ?? null;
}
function listEnrollmentClassNames(schoolYearId) {
  const db = getDb();
  const rows = db.select({ studentId: enrollments.studentId, className: classes.name }).from(enrollments).innerJoin(classes, drizzleOrm.eq(classes.id, enrollments.classId)).where(drizzleOrm.eq(enrollments.schoolYearId, schoolYearId)).all();
  const map = {};
  for (const row of rows) {
    map[row.studentId] = row.className;
  }
  return map;
}
function search(query) {
  const db = getDb();
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : DEFAULT_PAGE_SIZE$1;
  const conditions = [drizzleOrm.eq(students.isActive, true)];
  if (query.query && query.query.trim()) {
    const term = `%${query.query.trim()}%`;
    conditions.push(
      drizzleOrm.or(
        drizzleOrm.like(students.lastName, term),
        drizzleOrm.like(students.firstName, term),
        drizzleOrm.like(students.matricule, term)
      )
    );
  }
  let classNameByStudentId = null;
  if (query.schoolYearId) {
    const enrollmentRows = db.select({
      studentId: enrollments.studentId,
      classId: enrollments.classId,
      className: classes.name
    }).from(enrollments).innerJoin(classes, drizzleOrm.eq(classes.id, enrollments.classId)).where(drizzleOrm.eq(enrollments.schoolYearId, query.schoolYearId)).all();
    classNameByStudentId = new Map(enrollmentRows.map((r) => [r.studentId, r.className]));
    if (query.classId) {
      const allowedIds = new Set(
        enrollmentRows.filter((r) => r.classId === query.classId).map((r) => r.studentId)
      );
      if (allowedIds.size === 0) {
        return { items: [], total: 0, page, pageSize };
      }
      classNameByStudentId = new Map([...classNameByStudentId].filter(([id]) => allowedIds.has(id)));
    }
  }
  const rows = db.select().from(students).where(drizzleOrm.and(...conditions)).orderBy(students.lastName, students.firstName).all().filter((row) => !classNameByStudentId || classNameByStudentId.has(row.id));
  const total = rows.length;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  const historyStatusById = query.schoolYearId ? batchGetEnrollmentHistoryStatus(
    paged.map((r) => r.id),
    query.schoolYearId
  ) : null;
  return {
    items: paged.map((row) => ({
      ...toStudent(row),
      className: classNameByStudentId?.get(row.id) ?? null,
      historyStatus: historyStatusById?.get(row.id)
    })),
    total,
    page,
    pageSize
  };
}
function getCurrentSchoolYearIdOrNull$1() {
  const db = getDb();
  const year = db.select({ id: schoolYears.id }).from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get();
  return year?.id ?? null;
}
function getPreviousSchoolYearId(schoolYearId) {
  const db = getDb();
  const years = db.select({ id: schoolYears.id }).from(schoolYears).orderBy(schoolYears.label).all();
  const index = years.findIndex((y) => y.id === schoolYearId);
  if (index <= 0) return null;
  return years[index - 1].id;
}
function computeStatsGrowthPct(current, previous) {
  if (previous === 0) return null;
  return (current - previous) / previous * 100;
}
const EMPTY_COUNTS = { total: 0, nouveaux: 0, anciens: 0, male: 0, female: 0 };
function countStudents(schoolYearId, classId) {
  const db = getDb();
  const conditions = [drizzleOrm.eq(enrollments.schoolYearId, schoolYearId), drizzleOrm.eq(students.isActive, true)];
  if (classId) conditions.push(drizzleOrm.eq(enrollments.classId, classId));
  const rows = db.select({ studentId: students.id, gender: students.gender }).from(enrollments).innerJoin(students, drizzleOrm.eq(students.id, enrollments.studentId)).where(drizzleOrm.and(...conditions)).all();
  const historyStatusById = batchGetEnrollmentHistoryStatus(
    rows.map((r) => r.studentId),
    schoolYearId
  );
  let nouveaux = 0;
  let male = 0;
  let female = 0;
  for (const row of rows) {
    if (historyStatusById.get(row.studentId) === "nouveau") nouveaux += 1;
    if (row.gender === "M") male += 1;
    else if (row.gender === "F") female += 1;
  }
  return { total: rows.length, nouveaux, anciens: rows.length - nouveaux, male, female };
}
function getStats$2(query = {}) {
  const schoolYearId = query.schoolYearId ?? getCurrentSchoolYearIdOrNull$1();
  const current = schoolYearId ? countStudents(schoolYearId, query.classId) : EMPTY_COUNTS;
  const previousSchoolYearId = schoolYearId ? getPreviousSchoolYearId(schoolYearId) : null;
  const previous = previousSchoolYearId ? countStudents(previousSchoolYearId, query.classId) : EMPTY_COUNTS;
  const trend2 = (curr, prev) => ({
    current: curr,
    previous: prev,
    growthPct: computeStatsGrowthPct(curr, prev)
  });
  return {
    total: trend2(current.total, previous.total),
    anciens: trend2(current.anciens, previous.anciens),
    nouveaux: trend2(current.nouveaux, previous.nouveaux),
    male: {
      count: current.male,
      percentage: current.total > 0 ? current.male / current.total * 100 : 0
    },
    female: {
      count: current.female,
      percentage: current.total > 0 ? current.female / current.total * 100 : 0
    }
  };
}
function listByClass(classId, schoolYearId) {
  const db = getDb();
  const rows = db.select({ student: students }).from(enrollments).innerJoin(students, drizzleOrm.eq(students.id, enrollments.studentId)).where(
    drizzleOrm.and(
      drizzleOrm.eq(enrollments.classId, classId),
      drizzleOrm.eq(enrollments.schoolYearId, schoolYearId),
      drizzleOrm.eq(students.isActive, true)
    )
  ).orderBy(students.lastName, students.firstName).all();
  const historyStatusById = batchGetEnrollmentHistoryStatus(
    rows.map((r) => r.student.id),
    schoolYearId
  );
  return rows.map(({ student: row }) => ({
    ...toStudent(row),
    historyStatus: historyStatusById.get(row.id)
  }));
}
function getHistory(studentId) {
  const db = getDb();
  const rows = db.select({
    enrollment: enrollments,
    className: classes.name,
    schoolYearLabel: schoolYears.label
  }).from(enrollments).innerJoin(classes, drizzleOrm.eq(classes.id, enrollments.classId)).innerJoin(schoolYears, drizzleOrm.eq(schoolYears.id, enrollments.schoolYearId)).where(drizzleOrm.eq(enrollments.studentId, studentId)).orderBy(schoolYears.label).all();
  return rows.map(({ enrollment, className, schoolYearLabel }) => ({
    ...enrollment,
    status: enrollment.status,
    className,
    schoolYearLabel
  }));
}
function createEnrollment(data) {
  const db = getDb();
  const existing = db.select({ id: enrollments.id }).from(enrollments).where(
    drizzleOrm.and(
      drizzleOrm.eq(enrollments.studentId, data.studentId),
      drizzleOrm.eq(enrollments.schoolYearId, data.schoolYearId)
    )
  ).get();
  if (existing) {
    throw new Error("BR-003 : cet élève a déjà un statut de progression pour cette année scolaire.");
  }
  const id = generateId();
  db.insert(enrollments).values({
    id,
    studentId: data.studentId,
    schoolYearId: data.schoolYearId,
    classId: data.classId,
    status: data.status
  }).run();
  return { id, ...data, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function promoteStudents(data) {
  const db = getDb();
  if (data.sourceSchoolYearId === data.targetSchoolYearId) {
    throw new Error("L'année scolaire cible doit être différente de l'année source.");
  }
  if (data.decisions.length === 0) {
    throw new Error("Aucune décision à appliquer.");
  }
  return db.transaction((tx) => {
    const allClasses = tx.select().from(classes).orderBy(classes.sortOrder).all();
    let promoted = 0;
    let repeated = 0;
    for (const decision of data.decisions) {
      const sourceEnrollment = tx.select().from(enrollments).where(
        drizzleOrm.and(
          drizzleOrm.eq(enrollments.studentId, decision.studentId),
          drizzleOrm.eq(enrollments.schoolYearId, data.sourceSchoolYearId)
        )
      ).get();
      if (!sourceEnrollment) {
        throw new Error(
          `Élève ${decision.studentId} : aucune inscription trouvée pour l'année source.`
        );
      }
      const alreadyEnrolled = tx.select({ id: enrollments.id }).from(enrollments).where(
        drizzleOrm.and(
          drizzleOrm.eq(enrollments.studentId, decision.studentId),
          drizzleOrm.eq(enrollments.schoolYearId, data.targetSchoolYearId)
        )
      ).get();
      if (alreadyEnrolled) {
        throw new Error(
          `BR-003 : l'élève ${decision.studentId} a déjà une inscription pour l'année scolaire cible.`
        );
      }
      let targetClassId;
      if (decision.decision === "promote") {
        const currentIndex = allClasses.findIndex((c) => c.id === sourceEnrollment.classId);
        const nextClass = currentIndex >= 0 ? allClasses[currentIndex + 1] : void 0;
        if (!nextClass) {
          throw new Error(
            `Élève ${decision.studentId} : pas de classe supérieure disponible (fin de cursus).`
          );
        }
        targetClassId = nextClass.id;
        promoted += 1;
      } else {
        targetClassId = sourceEnrollment.classId;
        repeated += 1;
      }
      tx.insert(enrollments).values({
        id: generateId(),
        studentId: decision.studentId,
        schoolYearId: data.targetSchoolYearId,
        classId: targetClassId,
        status: decision.decision === "promote" ? "admis" : "redoublant"
      }).run();
    }
    return { promoted, repeated };
  });
}
function addGuardian(studentId, data) {
  const db = getDb();
  const id = generateId();
  db.insert(guardians).values({
    id,
    studentId,
    lastName: data.lastName,
    firstName: data.firstName,
    phone: data.phone,
    profession: data.profession ?? null,
    relationship: data.relationship
  }).run();
  return {
    id,
    studentId,
    lastName: data.lastName,
    firstName: data.firstName,
    phone: data.phone,
    profession: data.profession ?? null,
    relationship: data.relationship
  };
}
function updateGuardian(guardianId, data) {
  const db = getDb();
  db.update(guardians).set(data).where(drizzleOrm.eq(guardians.id, guardianId)).run();
  const row = db.select().from(guardians).where(drizzleOrm.eq(guardians.id, guardianId)).get();
  if (!row) throw new Error("Responsable introuvable.");
  return toGuardian(row);
}
function deleteGuardian(guardianId) {
  const db = getDb();
  db.delete(guardians).where(drizzleOrm.eq(guardians.id, guardianId)).run();
}
const MIN_PASSWORD_LENGTH = 6;
let currentSessionUserId = null;
function toAuthUser(row) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    mustChangePassword: row.mustChangePassword
  };
}
function login(username, password) {
  const db = getDb();
  const user = db.select().from(users).where(drizzleOrm.eq(users.username, username)).get();
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    throw new Error("Identifiant ou mot de passe incorrect.");
  }
  if (!user.isActive) {
    throw new Error("Ce compte a été désactivé. Contactez un administrateur.");
  }
  currentSessionUserId = user.id;
  db.update(users).set({ lastLogin: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(users.id, user.id)).run();
  logAction({ userId: user.id, action: "login", entityType: "user", entityId: user.id });
  return toAuthUser(user);
}
function logout() {
  if (currentSessionUserId) {
    logAction({
      userId: currentSessionUserId,
      action: "logout",
      entityType: "user",
      entityId: currentSessionUserId
    });
  }
  currentSessionUserId = null;
}
function getCurrentSession() {
  return currentSessionUserId ? { userId: currentSessionUserId } : null;
}
function getCurrentUser() {
  if (!currentSessionUserId) return null;
  const db = getDb();
  const user = db.select().from(users).where(drizzleOrm.eq(users.id, currentSessionUserId)).get();
  if (!user) {
    currentSessionUserId = null;
    return null;
  }
  return toAuthUser(user);
}
function getUserById(userId) {
  const db = getDb();
  const user = db.select().from(users).where(drizzleOrm.eq(users.id, userId)).get();
  return user ? toAuthUser(user) : null;
}
function changePassword(userId, oldPassword, newPassword) {
  const db = getDb();
  const user = db.select().from(users).where(drizzleOrm.eq(users.id, userId)).get();
  if (!user) {
    throw new Error("Utilisateur introuvable.");
  }
  if (!bcrypt.compareSync(oldPassword, user.passwordHash)) {
    throw new Error("Mot de passe actuel incorrect.");
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `Le nouveau mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`
    );
  }
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  db.update(users).set({ passwordHash, mustChangePassword: false }).where(drizzleOrm.eq(users.id, userId)).run();
  logAction({ userId, action: "change_password", entityType: "user", entityId: userId });
}
function createUser(data) {
  const db = getDb();
  const existing = db.select({ id: users.id }).from(users).where(drizzleOrm.eq(users.username, data.username)).get();
  if (existing) {
    throw new Error("Ce nom d'utilisateur est déjà utilisé.");
  }
  if (data.password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`);
  }
  const id = generateId();
  const passwordHash = bcrypt.hashSync(data.password, 10);
  const mustChangePassword = !data.skipMustChangePassword;
  db.insert(users).values({
    id,
    username: data.username,
    passwordHash,
    fullName: data.fullName,
    mustChangePassword
  }).run();
  return { id, username: data.username, fullName: data.fullName, mustChangePassword };
}
function toUserAccount(row) {
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    isActive: row.isActive,
    mustChangePassword: row.mustChangePassword,
    createdAt: row.createdAt,
    lastLogin: row.lastLogin
  };
}
function listUsers() {
  const db = getDb();
  return db.select().from(users).orderBy(users.fullName).all().map(toUserAccount);
}
function updateUser(userId, data) {
  const db = getDb();
  const existing = db.select().from(users).where(drizzleOrm.eq(users.id, userId)).get();
  if (!existing) {
    throw new Error("Utilisateur introuvable.");
  }
  if (data.username !== void 0 && data.username !== existing.username) {
    const trimmed = data.username.trim();
    if (!trimmed) {
      throw new Error("Le nom d'utilisateur ne peut pas être vide.");
    }
    const conflict = db.select({ id: users.id }).from(users).where(drizzleOrm.eq(users.username, trimmed)).get();
    if (conflict) {
      throw new Error("Ce nom d'utilisateur est déjà utilisé.");
    }
  }
  db.update(users).set({
    ...data.fullName !== void 0 ? { fullName: data.fullName.trim() } : {},
    ...data.username !== void 0 ? { username: data.username.trim() } : {}
  }).where(drizzleOrm.eq(users.id, userId)).run();
  const updated = db.select().from(users).where(drizzleOrm.eq(users.id, userId)).get();
  if (!updated) throw new Error("Utilisateur introuvable après mise à jour.");
  logAction({ userId, action: "update", entityType: "user", entityId: userId });
  return toUserAccount(updated);
}
function setUserActive(userId, isActive) {
  const db = getDb();
  const existing = db.select().from(users).where(drizzleOrm.eq(users.id, userId)).get();
  if (!existing) {
    throw new Error("Utilisateur introuvable.");
  }
  if (!isActive) {
    const activeCount = db.select({ id: users.id }).from(users).where(drizzleOrm.eq(users.isActive, true)).all().length;
    if (activeCount <= 1 && existing.isActive) {
      throw new Error("Impossible de désactiver le dernier compte actif.");
    }
  }
  db.update(users).set({ isActive }).where(drizzleOrm.eq(users.id, userId)).run();
  logAction({
    userId,
    action: isActive ? "activate" : "deactivate",
    entityType: "user",
    entityId: userId
  });
  const updated = db.select().from(users).where(drizzleOrm.eq(users.id, userId)).get();
  if (!updated) throw new Error("Utilisateur introuvable après mise à jour.");
  return toUserAccount(updated);
}
function resetPassword(userId) {
  const db = getDb();
  const existing = db.select({ id: users.id }).from(users).where(drizzleOrm.eq(users.id, userId)).get();
  if (!existing) {
    throw new Error("Utilisateur introuvable.");
  }
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = bcrypt.hashSync(temporaryPassword, 10);
  db.update(users).set({ passwordHash, mustChangePassword: true }).where(drizzleOrm.eq(users.id, userId)).run();
  logAction({ userId, action: "reset_password", entityType: "user", entityId: userId });
  return { temporaryPassword };
}
function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let password = "";
  for (let i = 0; i < 10; i++) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return password;
}
function requireCurrentUserId$2() {
  const session = getCurrentSession();
  if (!session) throw new Error("Aucune session active.");
  return session.userId;
}
function registerStudentsIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.students.create, async (_event, data) => {
    return create$1({ ...data, createdBy: requireCurrentUserId$2() });
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.students.update,
    async (_event, id, data) => {
      return update$1(id, data, requireCurrentUserId$2());
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.students.delete, async (_event, id) => {
    softDelete$1(id, requireCurrentUserId$2());
  });
  electron.ipcMain.handle(IPC_CHANNELS.students.findById, async (_event, id) => {
    return findById(id);
  });
  electron.ipcMain.handle(IPC_CHANNELS.students.search, async (_event, query) => {
    return search(query);
  });
  electron.ipcMain.handle(IPC_CHANNELS.students.getStats, async (_event, query) => {
    return getStats$2(query);
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.students.listEnrollmentClassNames,
    async (_event, schoolYearId) => {
      return listEnrollmentClassNames(schoolYearId);
    }
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.students.listByClass,
    async (_event, classId, schoolYearId) => {
      return listByClass(classId, schoolYearId);
    }
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.students.addGuardian,
    async (_event, studentId, data) => {
      return addGuardian(studentId, data);
    }
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.students.updateGuardian,
    async (_event, guardianId, data) => {
      return updateGuardian(guardianId, data);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.students.deleteGuardian, async (_event, guardianId) => {
    deleteGuardian(guardianId);
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.students.createEnrollment,
    async (_event, data) => {
      return createEnrollment(data);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.students.getEnrollmentHistory, async (_event, studentId) => {
    return getHistory(studentId);
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.students.checkDuplicate,
    async (_event, firstName, lastName, schoolYearId) => {
      return checkDuplicate(firstName, lastName, schoolYearId);
    }
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.students.promoteStudents,
    async (_event, data) => {
      return promoteStudents(data);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.students.hasFinancialHistory, async (_event, studentId) => {
    return hasFinancialHistory(studentId);
  });
}
const RECEIPT_PREFIX = "REC";
const RECEIPT_SEQUENCE_LENGTH = 6;
function generateReceiptNumber(date = /* @__PURE__ */ new Date()) {
  const db = getDb();
  const year = date.getFullYear();
  const prefix = `${RECEIPT_PREFIX}-${year}-`;
  const existing = db.select({ receiptNumber: receipts.receiptNumber }).from(receipts).where(drizzleOrm.like(receipts.receiptNumber, `${prefix}%`)).all();
  let maxSequence = 0;
  for (const row of existing) {
    const seq = Number.parseInt(row.receiptNumber.slice(prefix.length), 10);
    if (!Number.isNaN(seq) && seq > maxSequence) maxSequence = seq;
  }
  return `${prefix}${String(maxSequence + 1).padStart(RECEIPT_SEQUENCE_LENGTH, "0")}`;
}
function insertReceipt(tx, transactionId, amount) {
  const id = generateId();
  const receiptNumber = generateReceiptNumber();
  const createdAt = (/* @__PURE__ */ new Date()).toISOString();
  tx.insert(receipts).values({ id, receiptNumber, transactionId, amount, createdAt, printCount: 0 }).run();
  return { id, receiptNumber, transactionId, amount, createdAt, printCount: 0 };
}
function getReceiptByTransaction(transactionId) {
  const db = getDb();
  const row = db.select().from(receipts).where(drizzleOrm.eq(receipts.transactionId, transactionId)).get();
  return row ?? null;
}
function getReceiptById(receiptId) {
  const db = getDb();
  const row = db.select().from(receipts).where(drizzleOrm.eq(receipts.id, receiptId)).get();
  return row ?? null;
}
function incrementPrintCount(transactionId) {
  const db = getDb();
  const existing = getReceiptByTransaction(transactionId);
  if (!existing) {
    throw new Error("Reçu introuvable pour cette opération.");
  }
  db.update(receipts).set({ printCount: drizzleOrm.sql`${receipts.printCount} + 1` }).where(drizzleOrm.eq(receipts.transactionId, transactionId)).run();
  const updated = getReceiptByTransaction(transactionId);
  if (!updated) throw new Error("Échec de la mise à jour du compteur de réimpression.");
  return updated;
}
function getCurrentSchoolYearId() {
  const db = getDb();
  const year = db.select({ id: schoolYears.id }).from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get();
  return year?.id ?? null;
}
function getCurrentEnrollment(studentId, schoolYearId) {
  const db = getDb();
  return db.select({ classId: enrollments.classId, className: classes.name }).from(enrollments).innerJoin(classes, drizzleOrm.eq(classes.id, enrollments.classId)).where(drizzleOrm.and(drizzleOrm.eq(enrollments.studentId, studentId), drizzleOrm.eq(enrollments.schoolYearId, schoolYearId))).get();
}
function computeAccount(studentId, classId, schoolYearId) {
  const db = getDb();
  const schedule = db.select({ id: tuitionSchedules.id }).from(tuitionSchedules).where(
    drizzleOrm.and(drizzleOrm.eq(tuitionSchedules.classId, classId), drizzleOrm.eq(tuitionSchedules.schoolYearId, schoolYearId))
  ).get();
  if (!schedule) {
    return { studentId, installments: [], totalExpected: 0, totalPaid: 0, balance: 0 };
  }
  const installmentRows = db.select().from(tuitionInstallments).where(drizzleOrm.eq(tuitionInstallments.scheduleId, schedule.id)).orderBy(tuitionInstallments.sortOrder).all();
  const historyStatus = getEnrollmentHistoryStatus(studentId, schoolYearId);
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const lines = installmentRows.map((installment) => {
    const payments = db.select({ amount: transactions.amount }).from(transactions).where(
      drizzleOrm.and(
        drizzleOrm.eq(transactions.installmentId, installment.id),
        drizzleOrm.eq(transactions.studentId, studentId),
        drizzleOrm.eq(transactions.type, "entry"),
        drizzleOrm.eq(transactions.status, "validated")
      )
    ).all();
    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const isLate = installment.dueDate < today && paidAmount < installment.amount;
    const appliesTo = installment.appliesTo;
    const isRelevant = appliesTo === "tous" || appliesTo === historyStatus || paidAmount > 0;
    if (!isRelevant) return null;
    return {
      installmentId: installment.id,
      label: installment.label,
      dueDate: installment.dueDate,
      expectedAmount: installment.amount,
      paidAmount,
      status: isLate ? "en_arriere" : "a_jour",
      appliesTo
    };
  }).filter((line) => line !== null);
  const totalExpected = lines.reduce((sum, l) => sum + l.expectedAmount, 0);
  const totalPaid = lines.reduce((sum, l) => sum + l.paidAmount, 0);
  return {
    studentId,
    installments: lines,
    totalExpected,
    totalPaid,
    balance: totalExpected - totalPaid
  };
}
function getStudentAccount(studentId) {
  const schoolYearId = getCurrentSchoolYearId();
  if (!schoolYearId) {
    return { studentId, installments: [], totalExpected: 0, totalPaid: 0, balance: 0 };
  }
  const enrollment = getCurrentEnrollment(studentId, schoolYearId);
  if (!enrollment) {
    return { studentId, installments: [], totalExpected: 0, totalPaid: 0, balance: 0 };
  }
  return computeAccount(studentId, enrollment.classId, schoolYearId);
}
function getArrearsStudents() {
  const db = getDb();
  const schoolYearId = getCurrentSchoolYearId();
  if (!schoolYearId) return [];
  const activeEnrollments = db.select({
    studentId: enrollments.studentId,
    classId: enrollments.classId,
    className: classes.name,
    matricule: students.matricule,
    lastName: students.lastName,
    firstName: students.firstName
  }).from(enrollments).innerJoin(classes, drizzleOrm.eq(classes.id, enrollments.classId)).innerJoin(students, drizzleOrm.eq(students.id, enrollments.studentId)).where(drizzleOrm.and(drizzleOrm.eq(enrollments.schoolYearId, schoolYearId), drizzleOrm.eq(students.isActive, true))).all();
  const result = [];
  for (const row of activeEnrollments) {
    const account = computeAccount(row.studentId, row.classId, schoolYearId);
    const lateInstallmentsCount = account.installments.filter(
      (l) => l.status === "en_arriere"
    ).length;
    if (lateInstallmentsCount > 0) {
      result.push({
        ...account,
        matricule: row.matricule,
        studentName: `${row.lastName} ${row.firstName}`,
        className: row.className,
        lateInstallmentsCount
      });
    }
  }
  return result;
}
function getGlobalRecoveryStats() {
  const db = getDb();
  const schoolYearId = getCurrentSchoolYearId();
  if (!schoolYearId) return { totalExpected: 0, totalPaid: 0 };
  const activeEnrollments = db.select({ studentId: enrollments.studentId, classId: enrollments.classId }).from(enrollments).innerJoin(students, drizzleOrm.eq(students.id, enrollments.studentId)).where(drizzleOrm.and(drizzleOrm.eq(enrollments.schoolYearId, schoolYearId), drizzleOrm.eq(students.isActive, true))).all();
  let totalExpected = 0;
  let totalPaid = 0;
  for (const row of activeEnrollments) {
    const account = computeAccount(row.studentId, row.classId, schoolYearId);
    totalExpected += account.totalExpected;
    totalPaid += account.totalPaid;
  }
  return { totalExpected, totalPaid };
}
const CASH_ENTRY_CATEGORIES = [
  "frais_inscription",
  "scolarite",
  "frais_divers",
  "don",
  "autre_recette"
];
const CASH_EXIT_CATEGORIES = [
  "depense_quotidienne",
  "salaire",
  "avance_salaire",
  "achat_fournitures",
  "charge_diverse"
];
const CASH_CATEGORY_LABELS = {
  frais_inscription: "Frais d'inscription",
  scolarite: "Scolarité",
  frais_divers: "Frais divers",
  don: "Don",
  autre_recette: "Autre recette",
  depense_quotidienne: "Dépense quotidienne",
  salaire: "Salaire",
  avance_salaire: "Avance sur salaire",
  achat_fournitures: "Achat de fournitures",
  charge_diverse: "Charge diverse"
};
const DEFAULT_PAGE_SIZE = 25;
const CATEGORIES_REQUIRING_STUDENT = ["frais_inscription", "scolarite"];
function toTransaction(row) {
  return {
    id: row.id,
    type: row.type,
    category: row.category,
    description: row.description,
    amount: row.amount,
    studentId: row.studentId,
    installmentId: row.installmentId,
    employeeId: row.employeeId,
    status: row.status,
    cancelledByTxn: row.cancelledByTxn,
    cancelReason: row.cancelReason,
    userId: row.userId,
    schoolYearId: row.schoolYearId,
    createdAt: row.createdAt
  };
}
function getCurrentSchoolYearIdOrNull() {
  const db = getDb();
  const year = db.select({ id: schoolYears.id }).from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get();
  return year?.id ?? null;
}
function todayRange(now) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return { from: start.toISOString(), to: end.toISOString() };
}
function createEntry(data) {
  if (data.type !== "entry") {
    throw new Error('createEntry ne traite que les opérations de type "entry".');
  }
  if (!CASH_ENTRY_CATEGORIES.includes(data.category)) {
    throw new Error("Catégorie invalide pour une entrée de caisse.");
  }
  if (CATEGORIES_REQUIRING_STUDENT.includes(data.category) && !data.studentId) {
    throw new Error("Un élève doit être sélectionné pour cette catégorie d'entrée.");
  }
  if (data.category === "scolarite" && !data.installmentId) {
    throw new Error("Une tranche de scolarité doit être sélectionnée pour ce paiement.");
  }
  if (data.amount <= 0) {
    throw new Error("Le montant doit être positif.");
  }
  const db = getDb();
  const transactionId = generateId();
  const schoolYearId = getCurrentSchoolYearIdOrNull();
  const result = db.transaction((tx) => {
    tx.insert(transactions).values({
      id: transactionId,
      type: "entry",
      category: data.category,
      description: data.description ?? null,
      amount: data.amount,
      studentId: data.studentId ?? null,
      installmentId: data.installmentId ?? null,
      employeeId: data.employeeId ?? null,
      status: "validated",
      userId: data.userId,
      schoolYearId
    }).run();
    const receipt = insertReceipt(tx, transactionId, data.amount);
    return receipt;
  });
  logAction({
    userId: data.userId,
    action: "create",
    entityType: "transaction",
    entityId: transactionId
  });
  const row = db.select().from(transactions).where(drizzleOrm.eq(transactions.id, transactionId)).get();
  if (!row) throw new Error("Échec de la récupération de l'entrée après création.");
  return { transaction: toTransaction(row), receipt: result };
}
function createExit(data) {
  if (data.type !== "exit") {
    throw new Error('createExit ne traite que les opérations de type "exit".');
  }
  if (!CASH_EXIT_CATEGORIES.includes(data.category)) {
    throw new Error("Catégorie invalide pour une sortie de caisse.");
  }
  if (data.amount <= 0) {
    throw new Error("Le montant doit être positif.");
  }
  const db = getDb();
  const transactionId = generateId();
  const schoolYearId = getCurrentSchoolYearIdOrNull();
  db.insert(transactions).values({
    id: transactionId,
    type: "exit",
    category: data.category,
    description: data.description ?? null,
    amount: data.amount,
    studentId: data.studentId ?? null,
    installmentId: data.installmentId ?? null,
    employeeId: data.employeeId ?? null,
    status: "validated",
    userId: data.userId,
    schoolYearId
  }).run();
  logAction({
    userId: data.userId,
    action: "create",
    entityType: "transaction",
    entityId: transactionId
  });
  const row = db.select().from(transactions).where(drizzleOrm.eq(transactions.id, transactionId)).get();
  if (!row) throw new Error("Échec de la récupération de la sortie après création.");
  return toTransaction(row);
}
function createTransaction(data) {
  return data.type === "entry" ? createEntry(data) : createExit(data);
}
function cancelTransaction(transactionId, reason, userId) {
  if (!reason.trim()) {
    throw new Error("Un motif d'annulation est requis.");
  }
  const db = getDb();
  const original = db.select().from(transactions).where(drizzleOrm.eq(transactions.id, transactionId)).get();
  if (!original) {
    throw new Error("Opération introuvable.");
  }
  if (original.status === "cancelled") {
    throw new Error("Cette opération a déjà été annulée.");
  }
  db.update(transactions).set({ status: "cancelled", cancelReason: reason.trim() }).where(drizzleOrm.eq(transactions.id, transactionId)).run();
  logAction({
    userId,
    action: "cancel",
    entityType: "transaction",
    entityId: transactionId,
    details: { reason: reason.trim() }
  });
  const updated = db.select().from(transactions).where(drizzleOrm.eq(transactions.id, transactionId)).get();
  if (!updated) throw new Error("Échec de la récupération de l'opération après annulation.");
  return toTransaction(updated);
}
function getTransactionById(transactionId) {
  const db = getDb();
  const row = db.select().from(transactions).where(drizzleOrm.eq(transactions.id, transactionId)).get();
  return row ? toTransaction(row) : null;
}
function getJournal(filters) {
  const db = getDb();
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const pageSize = filters.pageSize && filters.pageSize > 0 ? filters.pageSize : DEFAULT_PAGE_SIZE;
  const balanceAfterByTxnId = /* @__PURE__ */ new Map();
  const allRows = db.select().from(transactions).orderBy(transactions.createdAt, transactions.id).all();
  let running = 0;
  for (const row of allRows) {
    if (row.status === "validated") {
      running += row.type === "entry" ? row.amount : -row.amount;
    }
    balanceAfterByTxnId.set(row.id, running);
  }
  const conditions = [];
  if (filters.schoolYearId) conditions.push(drizzleOrm.eq(transactions.schoolYearId, filters.schoolYearId));
  if (filters.type) conditions.push(drizzleOrm.eq(transactions.type, filters.type));
  if (filters.category) conditions.push(drizzleOrm.eq(transactions.category, filters.category));
  if (filters.userId) conditions.push(drizzleOrm.eq(transactions.userId, filters.userId));
  if (filters.studentId) conditions.push(drizzleOrm.eq(transactions.studentId, filters.studentId));
  if (filters.dateFrom) conditions.push(drizzleOrm.gte(transactions.createdAt, filters.dateFrom));
  if (filters.dateTo) conditions.push(drizzleOrm.lte(transactions.createdAt, filters.dateTo));
  if (filters.classId) {
    const studentIds = getStudentIdsForClass(filters.classId);
    conditions.push(
      studentIds.length > 0 ? drizzleOrm.inArray(transactions.studentId, studentIds) : drizzleOrm.eq(transactions.id, "")
    );
  }
  let studentIdsMatchingQuery = null;
  if (filters.query && filters.query.trim()) {
    const term = `%${filters.query.trim()}%`;
    const matchingStudents = db.select({ id: students.id }).from(students).where(drizzleOrm.or(drizzleOrm.like(students.lastName, term), drizzleOrm.like(students.firstName, term))).all();
    studentIdsMatchingQuery = matchingStudents.map((s) => s.id);
    const textCondition = drizzleOrm.or(
      drizzleOrm.like(transactions.description, term),
      studentIdsMatchingQuery.length > 0 ? drizzleOrm.or(...studentIdsMatchingQuery.map((id) => drizzleOrm.eq(transactions.studentId, id))) : void 0
    );
    if (textCondition) conditions.push(textCondition);
  }
  const rows = db.select().from(transactions).where(conditions.length > 0 ? drizzleOrm.and(...conditions) : void 0).orderBy(drizzleOrm.desc(transactions.createdAt)).all();
  const total = rows.length;
  const paged = rows.slice((page - 1) * pageSize, page * pageSize);
  return {
    items: paged.map((row) => ({
      ...toTransaction(row),
      balanceAfter: balanceAfterByTxnId.get(row.id) ?? 0
    })),
    total,
    page,
    pageSize
  };
}
function getBalance(schoolYearId) {
  const db = getDb();
  const conditions = [drizzleOrm.eq(transactions.status, "validated")];
  if (schoolYearId) conditions.push(drizzleOrm.eq(transactions.schoolYearId, schoolYearId));
  const rows = db.select({ type: transactions.type, amount: transactions.amount }).from(transactions).where(drizzleOrm.and(...conditions)).all();
  return rows.reduce((sum, row) => sum + (row.type === "entry" ? row.amount : -row.amount), 0);
}
function getStats$1(schoolYearId) {
  const db = getDb();
  const { from, to } = todayRange(/* @__PURE__ */ new Date());
  const balance = getBalance();
  const todayConditions = [
    drizzleOrm.eq(transactions.status, "validated"),
    drizzleOrm.gte(transactions.createdAt, from),
    drizzleOrm.lte(transactions.createdAt, to)
  ];
  if (schoolYearId) todayConditions.push(drizzleOrm.eq(transactions.schoolYearId, schoolYearId));
  const todayRows = db.select({ type: transactions.type, amount: transactions.amount }).from(transactions).where(drizzleOrm.and(...todayConditions)).all();
  let todayEntries = 0;
  let todayExits = 0;
  for (const row of todayRows) {
    if (row.type === "entry") todayEntries += row.amount;
    else todayExits += row.amount;
  }
  return { balance, todayEntries, todayExits };
}
function getBalanceBefore(beforeDate) {
  const db = getDb();
  const rows = db.select({ type: transactions.type, amount: transactions.amount }).from(transactions).where(drizzleOrm.and(drizzleOrm.eq(transactions.status, "validated"), drizzleOrm.lt(transactions.createdAt, beforeDate))).all();
  return rows.reduce((sum, row) => sum + (row.type === "entry" ? row.amount : -row.amount), 0);
}
function computeGrowthPct$1(current, previous) {
  if (previous === 0) return null;
  return (current - previous) / previous * 100;
}
function getStudentIdsForClass(classId) {
  const db = getDb();
  const currentYear = db.select({ id: schoolYears.id }).from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get();
  if (!currentYear) return [];
  const rows = db.select({ studentId: enrollments.studentId }).from(enrollments).where(drizzleOrm.and(drizzleOrm.eq(enrollments.classId, classId), drizzleOrm.eq(enrollments.schoolYearId, currentYear.id))).all();
  return rows.map((r) => r.studentId);
}
function getPreviousPeriod(from, to) {
  const fromDate = /* @__PURE__ */ new Date(`${from}T00:00:00.000Z`);
  const toDate = /* @__PURE__ */ new Date(`${to}T00:00:00.000Z`);
  const durationMs = toDate.getTime() - fromDate.getTime();
  const prevTo = new Date(fromDate.getTime() - 24 * 60 * 60 * 1e3);
  const prevFrom = new Date(prevTo.getTime() - durationMs);
  return {
    prevFrom: prevFrom.toISOString().slice(0, 10),
    prevTo: prevTo.toISOString().slice(0, 10)
  };
}
function buildReportConditions(from, to, filters) {
  const conditions = [
    drizzleOrm.eq(transactions.status, "validated"),
    drizzleOrm.gte(transactions.createdAt, from),
    drizzleOrm.lte(transactions.createdAt, `${to}T23:59:59.999Z`)
  ];
  if (filters.category) conditions.push(drizzleOrm.eq(transactions.category, filters.category));
  if (filters.userId) conditions.push(drizzleOrm.eq(transactions.userId, filters.userId));
  if (filters.classId) {
    const studentIds = getStudentIdsForClass(filters.classId);
    conditions.push(
      studentIds.length > 0 ? drizzleOrm.inArray(transactions.studentId, studentIds) : drizzleOrm.eq(transactions.id, "")
    );
  }
  return conditions;
}
function getPeriodTotals(from, to, filters) {
  const db = getDb();
  const rows = db.select({ type: transactions.type, amount: transactions.amount }).from(transactions).where(drizzleOrm.and(...buildReportConditions(from, to, filters))).all();
  let totalEntries = 0;
  let totalExits = 0;
  for (const row of rows) {
    if (row.type === "entry") totalEntries += row.amount;
    else totalExits += row.amount;
  }
  return { totalEntries, totalExits, transactionCount: rows.length };
}
function getReportV2(filters) {
  const db = getDb();
  const { from, to } = filters;
  const rows = db.select().from(transactions).where(drizzleOrm.and(...buildReportConditions(from, to, filters))).all();
  let totalEntries = 0;
  let totalExits = 0;
  const entriesByCategory = {};
  const byDate = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const category = row.category;
    const date = row.createdAt.slice(0, 10);
    const point = byDate.get(date) ?? { entries: 0, exits: 0 };
    if (row.type === "entry") {
      totalEntries += row.amount;
      entriesByCategory[category] = (entriesByCategory[category] ?? 0) + row.amount;
      point.entries += row.amount;
    } else {
      totalExits += row.amount;
      point.exits += row.amount;
    }
    byDate.set(date, point);
  }
  const totalEntriesForBreakdown = Object.values(entriesByCategory).reduce(
    (sum, v) => sum + (v ?? 0),
    0
  );
  const byCategory = Object.entries(entriesByCategory).map(([category, amount]) => ({
    category,
    amount: amount ?? 0,
    percentage: totalEntriesForBreakdown > 0 ? (amount ?? 0) / totalEntriesForBreakdown * 100 : 0
  })).sort((a, b) => b.amount - a.amount);
  const timeSeries = Array.from(byDate.entries()).map(([date, point]) => ({ date, ...point })).sort((a, b) => a.date.localeCompare(b.date));
  const { prevFrom, prevTo } = getPreviousPeriod(from, to);
  const previous = getPeriodTotals(prevFrom, prevTo, filters);
  const netBalance = totalEntries - totalExits;
  const previousNetBalance = previous.totalEntries - previous.totalExits;
  const totalArrears = getArrearsStudents().reduce((sum, student) => sum + student.balance, 0);
  const kpis = {
    totalEntries,
    totalExits,
    netBalance,
    transactionCount: rows.length,
    totalArrears,
    totalEntriesChangePct: computeGrowthPct$1(totalEntries, previous.totalEntries),
    totalExitsChangePct: computeGrowthPct$1(totalExits, previous.totalExits),
    netBalanceChangePct: computeGrowthPct$1(netBalance, previousNetBalance),
    transactionCountChangePct: computeGrowthPct$1(rows.length, previous.transactionCount),
    // Pas d'historique des arriérés disponible pour l'instant — on n'affiche pas
    // de variation plutôt que de bricoler une fausse donnée (voir plan §1.2.5).
    totalArrearsChangePct: null
  };
  return {
    from,
    to,
    openingBalance: getBalanceBefore(from),
    kpis,
    byCategory,
    timeSeries
  };
}
function getTypeReport(filters, type) {
  const db = getDb();
  const { from, to } = filters;
  const rows = db.select().from(transactions).where(drizzleOrm.and(drizzleOrm.eq(transactions.type, type), ...buildReportConditions(from, to, filters))).all();
  let total = 0;
  const byCategoryMap = {};
  const byDate = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const category = row.category;
    const date = row.createdAt.slice(0, 10);
    total += row.amount;
    byCategoryMap[category] = (byCategoryMap[category] ?? 0) + row.amount;
    byDate.set(date, (byDate.get(date) ?? 0) + row.amount);
  }
  const byCategory = Object.entries(byCategoryMap).map(([category, amount]) => ({
    category,
    amount: amount ?? 0,
    percentage: total > 0 ? (amount ?? 0) / total * 100 : 0
  })).sort((a, b) => b.amount - a.amount);
  const timeSeries = Array.from(byDate.entries()).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
  const { prevFrom, prevTo } = getPreviousPeriod(from, to);
  const previousRows = db.select({ amount: transactions.amount }).from(transactions).where(drizzleOrm.and(drizzleOrm.eq(transactions.type, type), ...buildReportConditions(prevFrom, prevTo, filters))).all();
  const previousTotal = previousRows.reduce((sum, row) => sum + row.amount, 0);
  return {
    type,
    total,
    totalChangePct: computeGrowthPct$1(total, previousTotal),
    transactionCount: rows.length,
    transactionCountChangePct: computeGrowthPct$1(rows.length, previousRows.length),
    byCategory,
    timeSeries
  };
}
function getReportByClass(filters) {
  const db = getDb();
  const currentYear = db.select({ id: schoolYears.id }).from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get();
  const studentToClass = /* @__PURE__ */ new Map();
  if (currentYear) {
    const enrollmentRows = db.select({ studentId: enrollments.studentId, classId: classes.id, className: classes.name }).from(enrollments).innerJoin(classes, drizzleOrm.eq(classes.id, enrollments.classId)).where(drizzleOrm.eq(enrollments.schoolYearId, currentYear.id)).all();
    for (const row of enrollmentRows)
      studentToClass.set(row.studentId, { classId: row.classId, className: row.className });
  }
  const conditions = [
    drizzleOrm.eq(transactions.status, "validated"),
    drizzleOrm.gte(transactions.createdAt, filters.from),
    drizzleOrm.lte(transactions.createdAt, `${filters.to}T23:59:59.999Z`)
  ];
  if (filters.category) conditions.push(drizzleOrm.eq(transactions.category, filters.category));
  if (filters.userId) conditions.push(drizzleOrm.eq(transactions.userId, filters.userId));
  const rows = db.select({
    type: transactions.type,
    amount: transactions.amount,
    studentId: transactions.studentId
  }).from(transactions).where(drizzleOrm.and(...conditions)).all();
  const UNASSIGNED_KEY = "__unassigned__";
  const byClass = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const match = row.studentId ? studentToClass.get(row.studentId) : void 0;
    const key = match?.classId ?? UNASSIGNED_KEY;
    const entry = byClass.get(key) ?? {
      classId: key,
      className: match?.className ?? "Non affecté",
      totalEntries: 0,
      totalExits: 0,
      netBalance: 0,
      transactionCount: 0
    };
    if (row.type === "entry") entry.totalEntries += row.amount;
    else entry.totalExits += row.amount;
    entry.netBalance = entry.totalEntries - entry.totalExits;
    entry.transactionCount += 1;
    byClass.set(key, entry);
  }
  return Array.from(byClass.values()).sort((a, b) => b.netBalance - a.netBalance);
}
function getReportByCashier(filters) {
  const db = getDb();
  const conditions = [
    drizzleOrm.eq(transactions.status, "validated"),
    drizzleOrm.gte(transactions.createdAt, filters.from),
    drizzleOrm.lte(transactions.createdAt, `${filters.to}T23:59:59.999Z`)
  ];
  if (filters.category) conditions.push(drizzleOrm.eq(transactions.category, filters.category));
  if (filters.classId) {
    const studentIds = getStudentIdsForClass(filters.classId);
    conditions.push(
      studentIds.length > 0 ? drizzleOrm.inArray(transactions.studentId, studentIds) : drizzleOrm.eq(transactions.id, "")
    );
  }
  const rows = db.select({ type: transactions.type, amount: transactions.amount, userId: transactions.userId }).from(transactions).where(drizzleOrm.and(...conditions)).all();
  const cashierNames = new Map(
    db.select({ id: users.id, fullName: users.fullName }).from(users).all().map((u) => [u.id, u.fullName])
  );
  const byCashier = /* @__PURE__ */ new Map();
  for (const row of rows) {
    const entry = byCashier.get(row.userId) ?? {
      userId: row.userId,
      cashierName: cashierNames.get(row.userId) ?? "Utilisateur inconnu",
      totalEntries: 0,
      totalExits: 0,
      netBalance: 0,
      transactionCount: 0
    };
    if (row.type === "entry") entry.totalEntries += row.amount;
    else entry.totalExits += row.amount;
    entry.netBalance = entry.totalEntries - entry.totalExits;
    entry.transactionCount += 1;
    byCashier.set(row.userId, entry);
  }
  return Array.from(byCashier.values()).sort((a, b) => b.transactionCount - a.transactionCount);
}
function requireCurrentUserId$1() {
  const session = getCurrentSession();
  if (!session) throw new Error("Aucune session active.");
  return session.userId;
}
function registerCashboxIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.cashbox.createEntry, async (_event, data) => {
    const result = createTransaction({ ...data, userId: requireCurrentUserId$1() });
    return "transaction" in result ? result.transaction : result;
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.cashbox.cancelTransaction,
    async (_event, transactionId, reason) => {
      return cancelTransaction(transactionId, reason, requireCurrentUserId$1());
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.cashbox.getJournal, async (_event, filters) => {
    return getJournal(filters);
  });
  electron.ipcMain.handle(IPC_CHANNELS.cashbox.getStudentAccount, async (_event, studentId) => {
    return getStudentAccount(studentId);
  });
  electron.ipcMain.handle(IPC_CHANNELS.cashbox.listArrears, async () => {
    return getArrearsStudents();
  });
  electron.ipcMain.handle(IPC_CHANNELS.cashbox.getReportV2, async (_event, filters) => {
    return getReportV2(filters);
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.cashbox.getTypeReport,
    async (_event, filters, type) => {
      return getTypeReport(filters, type);
    }
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.cashbox.getReportByClass,
    async (_event, filters) => {
      return getReportByClass(filters);
    }
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.cashbox.getReportByCashier,
    async (_event, filters) => {
      return getReportByCashier(filters);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.cashbox.getReceipt, async (_event, transactionId) => {
    return getReceiptByTransaction(transactionId);
  });
  electron.ipcMain.handle(IPC_CHANNELS.cashbox.reprintReceipt, async (_event, transactionId) => {
    return incrementPrintCount(transactionId);
  });
  electron.ipcMain.handle(IPC_CHANNELS.cashbox.getBalance, async (_event, schoolYearId) => {
    return getBalance(schoolYearId);
  });
  electron.ipcMain.handle(IPC_CHANNELS.cashbox.getStats, async (_event, schoolYearId) => {
    return getStats$1(schoolYearId);
  });
}
function toEmployee(row) {
  return {
    id: row.id,
    lastName: row.lastName,
    firstName: row.firstName,
    role: row.role,
    phone: row.phone,
    monthlySalary: row.monthlySalary,
    isActive: row.isActive,
    createdAt: row.createdAt
  };
}
function toSalaryPayment(row) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    schoolYearId: row.schoolYearId,
    month: row.month,
    year: row.year,
    transactionId: row.transactionId,
    paidAt: row.paidAt
  };
}
function toSalaryAdvance(row) {
  return {
    id: row.id,
    employeeId: row.employeeId,
    amount: row.amount,
    reason: row.reason,
    transactionId: row.transactionId,
    status: row.status,
    deductedInPaymentId: row.deductedInPaymentId,
    createdAt: row.createdAt
  };
}
function requireCurrentSchoolYearId() {
  const db = getDb();
  const year = db.select({ id: schoolYears.id }).from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get();
  if (!year) {
    throw new Error(
      "Aucune année scolaire active. Configurez-en une dans Paramètres avant d'enregistrer un paiement de salaire."
    );
  }
  return year.id;
}
function validateEmployeeInput(data) {
  if (data.lastName !== void 0 && !data.lastName.trim()) {
    throw new Error("Le nom est requis.");
  }
  if (data.firstName !== void 0 && !data.firstName.trim()) {
    throw new Error("Le prénom est requis.");
  }
  if (data.role !== void 0 && !data.role.trim()) {
    throw new Error("La fonction est requise.");
  }
  if (data.monthlySalary !== void 0 && data.monthlySalary <= 0) {
    throw new Error("Le salaire mensuel doit être positif.");
  }
}
function create(data) {
  validateEmployeeInput(data);
  const db = getDb();
  const id = generateId();
  db.insert(employees).values({
    id,
    lastName: data.lastName.trim(),
    firstName: data.firstName.trim(),
    role: data.role.trim(),
    phone: data.phone?.trim() || null,
    monthlySalary: data.monthlySalary
  }).run();
  logAction({ userId: data.userId, action: "create", entityType: "employee", entityId: id });
  const row = db.select().from(employees).where(drizzleOrm.eq(employees.id, id)).get();
  if (!row) throw new Error("Échec de la récupération de l'employé après création.");
  return toEmployee(row);
}
function update(id, data, userId) {
  validateEmployeeInput(data);
  const db = getDb();
  const existing = db.select().from(employees).where(drizzleOrm.eq(employees.id, id)).get();
  if (!existing) throw new Error("Employé introuvable.");
  db.update(employees).set({
    ...data.lastName !== void 0 && { lastName: data.lastName.trim() },
    ...data.firstName !== void 0 && { firstName: data.firstName.trim() },
    ...data.role !== void 0 && { role: data.role.trim() },
    ...data.phone !== void 0 && { phone: data.phone?.trim() || null },
    ...data.monthlySalary !== void 0 && { monthlySalary: data.monthlySalary }
  }).where(drizzleOrm.eq(employees.id, id)).run();
  logAction({ userId, action: "update", entityType: "employee", entityId: id, details: data });
  const row = db.select().from(employees).where(drizzleOrm.eq(employees.id, id)).get();
  if (!row) throw new Error("Échec de la récupération de l'employé après modification.");
  return toEmployee(row);
}
function softDelete(id, userId) {
  const db = getDb();
  const existing = db.select().from(employees).where(drizzleOrm.eq(employees.id, id)).get();
  if (!existing) throw new Error("Employé introuvable.");
  db.update(employees).set({ isActive: false }).where(drizzleOrm.eq(employees.id, id)).run();
  logAction({ userId, action: "deactivate", entityType: "employee", entityId: id });
}
function listAll(includeInactive = false) {
  const db = getDb();
  const rows = db.select().from(employees).where(includeInactive ? void 0 : drizzleOrm.eq(employees.isActive, true)).orderBy(employees.lastName, employees.firstName).all();
  return rows.map(toEmployee);
}
function getById(id) {
  const db = getDb();
  const row = db.select().from(employees).where(drizzleOrm.eq(employees.id, id)).get();
  return row ? toEmployee(row) : null;
}
function paySalary(employeeId, month, year, userId) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Le mois doit être compris entre 1 et 12.");
  }
  if (!Number.isInteger(year) || year < 2e3) {
    throw new Error("Année invalide.");
  }
  const db = getDb();
  const employee = db.select().from(employees).where(drizzleOrm.eq(employees.id, employeeId)).get();
  if (!employee) throw new Error("Employé introuvable.");
  if (!employee.isActive) throw new Error("Impossible de payer un employé désactivé.");
  const alreadyPaid = db.select().from(salaryPayments).where(
    drizzleOrm.and(
      drizzleOrm.eq(salaryPayments.employeeId, employeeId),
      drizzleOrm.eq(salaryPayments.month, month),
      drizzleOrm.eq(salaryPayments.year, year)
    )
  ).get();
  if (alreadyPaid) {
    throw new Error(
      `Le salaire de ${employee.firstName} ${employee.lastName} pour cette période a déjà été marqué payé (BR-009).`
    );
  }
  const pendingAdvance = db.select().from(salaryAdvances).where(drizzleOrm.and(drizzleOrm.eq(salaryAdvances.employeeId, employeeId), drizzleOrm.eq(salaryAdvances.status, "pending"))).get();
  const grossAmount = employee.monthlySalary;
  const advanceAmount = pendingAdvance?.amount ?? 0;
  if (advanceAmount > grossAmount) {
    throw new Error(
      `L'avance en attente (${advanceAmount} FCFA) dépasse le salaire mensuel de ${employee.firstName} ${employee.lastName} (${grossAmount} FCFA). Contactez un administrateur pour régulariser la situation avant de payer ce salaire.`
    );
  }
  const netAmount = grossAmount - advanceAmount;
  const schoolYearId = requireCurrentSchoolYearId();
  const transactionId = generateId();
  const paymentId = generateId();
  const monthLabel = String(month).padStart(2, "0");
  const advanceNote = pendingAdvance ? ` (net après déduction avance de ${advanceAmount} FCFA)` : "";
  db.transaction((tx) => {
    tx.insert(transactions).values({
      id: transactionId,
      type: "exit",
      category: "salaire",
      description: `Salaire ${monthLabel}/${year} — ${employee.firstName} ${employee.lastName} (${employee.role})${advanceNote}`,
      amount: netAmount,
      employeeId,
      status: "validated",
      userId,
      schoolYearId
    }).run();
    tx.insert(salaryPayments).values({
      id: paymentId,
      employeeId,
      schoolYearId,
      month,
      year,
      transactionId
    }).run();
    if (pendingAdvance) {
      tx.update(salaryAdvances).set({ status: "deducted", deductedInPaymentId: paymentId }).where(drizzleOrm.eq(salaryAdvances.id, pendingAdvance.id)).run();
    }
  });
  logAction({
    userId,
    action: "paySalary",
    entityType: "employee",
    entityId: employeeId,
    details: {
      month,
      year,
      transactionId,
      grossAmount,
      netAmount,
      deductedAdvanceId: pendingAdvance?.id ?? null
    }
  });
  const row = db.select().from(salaryPayments).where(drizzleOrm.eq(salaryPayments.id, paymentId)).get();
  if (!row) throw new Error("Échec de la récupération du paiement après création.");
  return {
    ...toSalaryPayment(row),
    grossAmount,
    netAmount,
    deductedAdvance: pendingAdvance ? toSalaryAdvance({
      ...pendingAdvance,
      status: "deducted",
      deductedInPaymentId: paymentId
    }) : null
  };
}
function getSalaryStatus(month, year) {
  const db = getDb();
  const activeEmployees = db.select().from(employees).where(drizzleOrm.eq(employees.isActive, true)).orderBy(employees.lastName, employees.firstName).all();
  const payments = db.select().from(salaryPayments).where(drizzleOrm.and(drizzleOrm.eq(salaryPayments.month, month), drizzleOrm.eq(salaryPayments.year, year))).all();
  const paymentByEmployeeId = new Map(payments.map((p) => [p.employeeId, p]));
  const pendingAdvances = db.select().from(salaryAdvances).where(drizzleOrm.eq(salaryAdvances.status, "pending")).all();
  const pendingAdvanceByEmployeeId = new Map(pendingAdvances.map((a) => [a.employeeId, a]));
  return activeEmployees.map((emp) => {
    const payment = paymentByEmployeeId.get(emp.id);
    return {
      employee: toEmployee(emp),
      month,
      year,
      isPaid: Boolean(payment),
      paymentId: payment?.id,
      paidAt: payment?.paidAt,
      pendingAdvanceAmount: pendingAdvanceByEmployeeId.get(emp.id)?.amount
    };
  });
}
function getSalaryHistory(employeeId) {
  const db = getDb();
  const rows = db.select({
    id: salaryPayments.id,
    month: salaryPayments.month,
    year: salaryPayments.year,
    paidAt: salaryPayments.paidAt,
    transactionId: salaryPayments.transactionId,
    amount: transactions.amount
  }).from(salaryPayments).innerJoin(transactions, drizzleOrm.eq(salaryPayments.transactionId, transactions.id)).where(drizzleOrm.eq(salaryPayments.employeeId, employeeId)).all();
  return rows.sort((a, b) => b.year - a.year || b.month - a.month);
}
function grantAdvance(data) {
  if (!Number.isInteger(data.amount) || data.amount <= 0) {
    throw new Error("Le montant de l'avance doit être un nombre entier positif.");
  }
  const db = getDb();
  const employee = db.select().from(employees).where(drizzleOrm.eq(employees.id, data.employeeId)).get();
  if (!employee) throw new Error("Employé introuvable.");
  if (!employee.isActive) {
    throw new Error("Impossible d’accorder une avance à un employé désactivé.");
  }
  const existingPending = db.select().from(salaryAdvances).where(
    drizzleOrm.and(drizzleOrm.eq(salaryAdvances.employeeId, data.employeeId), drizzleOrm.eq(salaryAdvances.status, "pending"))
  ).get();
  if (existingPending) {
    throw new Error(
      `${employee.firstName} ${employee.lastName} a déjà une avance de ${existingPending.amount} FCFA en attente de remboursement. Elle sera déduite automatiquement de son prochain salaire ; une nouvelle avance ne peut pas être accordée avant.`
    );
  }
  if (data.amount > employee.monthlySalary) {
    throw new Error(
      `L'avance (${data.amount} FCFA) ne peut pas dépasser le salaire mensuel de l'employé (${employee.monthlySalary} FCFA).`
    );
  }
  const transactionId = generateId();
  const advanceId = generateId();
  const reason = data.reason?.trim() || null;
  const schoolYearId = requireCurrentSchoolYearId();
  db.transaction((tx) => {
    tx.insert(transactions).values({
      id: transactionId,
      type: "exit",
      category: "avance_salaire",
      description: `Avance sur salaire — ${employee.firstName} ${employee.lastName} (${employee.role})${reason ? ` — ${reason}` : ""}`,
      amount: data.amount,
      employeeId: data.employeeId,
      status: "validated",
      userId: data.userId,
      schoolYearId
    }).run();
    tx.insert(salaryAdvances).values({
      id: advanceId,
      employeeId: data.employeeId,
      amount: data.amount,
      reason,
      transactionId,
      status: "pending",
      userId: data.userId
    }).run();
  });
  logAction({
    userId: data.userId,
    action: "grantAdvance",
    entityType: "employee",
    entityId: data.employeeId,
    details: { amount: data.amount, reason, transactionId }
  });
  const row = db.select().from(salaryAdvances).where(drizzleOrm.eq(salaryAdvances.id, advanceId)).get();
  if (!row) throw new Error("Échec de la récupération de l'avance après création.");
  return toSalaryAdvance(row);
}
function cancelAdvance(id, userId) {
  const db = getDb();
  const advance = db.select().from(salaryAdvances).where(drizzleOrm.eq(salaryAdvances.id, id)).get();
  if (!advance) throw new Error("Avance introuvable.");
  if (advance.status !== "pending") {
    throw new Error("Seule une avance en attente de remboursement peut être annulée.");
  }
  db.transaction((tx) => {
    tx.update(salaryAdvances).set({ status: "cancelled" }).where(drizzleOrm.eq(salaryAdvances.id, id)).run();
    tx.update(transactions).set({
      status: "cancelled",
      cancelReason: "Annulation de l'avance sur salaire associée"
    }).where(drizzleOrm.eq(transactions.id, advance.transactionId)).run();
  });
  logAction({
    userId,
    action: "cancelAdvance",
    entityType: "employee",
    entityId: advance.employeeId
  });
}
function listAdvances(employeeId) {
  const db = getDb();
  const rows = db.select().from(salaryAdvances).where(drizzleOrm.eq(salaryAdvances.employeeId, employeeId)).all();
  return rows.map(toSalaryAdvance).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
function getPendingAdvance(employeeId) {
  const db = getDb();
  const row = db.select().from(salaryAdvances).where(drizzleOrm.and(drizzleOrm.eq(salaryAdvances.employeeId, employeeId), drizzleOrm.eq(salaryAdvances.status, "pending"))).get();
  return row ? toSalaryAdvance(row) : null;
}
function requireCurrentUserId() {
  const session = getCurrentSession();
  if (!session) throw new Error("Aucune session active.");
  return session.userId;
}
function registerPersonnelIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.personnel.create, async (_event, data) => {
    return create({ ...data, userId: requireCurrentUserId() });
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.personnel.update,
    async (_event, id, data) => {
      return update(id, data, requireCurrentUserId());
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.personnel.delete, async (_event, id) => {
    softDelete(id, requireCurrentUserId());
  });
  electron.ipcMain.handle(IPC_CHANNELS.personnel.list, async () => {
    return listAll();
  });
  electron.ipcMain.handle(IPC_CHANNELS.personnel.getById, async (_event, id) => {
    return getById(id);
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.personnel.markSalaryPaid,
    async (_event, employeeId, month, year) => {
      return paySalary(employeeId, month, year, requireCurrentUserId());
    }
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.personnel.getSalaryStatus,
    async (_event, month, year) => {
      return getSalaryStatus(month, year);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.personnel.getSalaryHistory, async (_event, employeeId) => {
    return getSalaryHistory(employeeId);
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.personnel.grantAdvance,
    async (_event, data) => {
      return grantAdvance({ ...data, userId: requireCurrentUserId() });
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.personnel.cancelAdvance, async (_event, id) => {
    cancelAdvance(id, requireCurrentUserId());
  });
  electron.ipcMain.handle(IPC_CHANNELS.personnel.listAdvances, async (_event, employeeId) => {
    return listAdvances(employeeId);
  });
  electron.ipcMain.handle(IPC_CHANNELS.personnel.getPendingAdvance, async (_event, employeeId) => {
    return getPendingAdvance(employeeId);
  });
}
const SCHOOL_YEAR_LABEL_PATTERN = /^(\d{4})-(\d{4})$/;
const MIN_YEAR = 1900;
const MAX_YEAR = 2200;
function validateSchoolYearLabel(rawLabel) {
  const label = rawLabel.trim();
  if (!label) {
    return { valid: false, error: "Le libellé de l'année scolaire est requis." };
  }
  const match = SCHOOL_YEAR_LABEL_PATTERN.exec(label);
  if (!match) {
    return { valid: false, error: "Le libellé doit suivre le format AAAA-AAAA, ex: 2027-2028." };
  }
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear !== startYear + 1) {
    return {
      valid: false,
      error: `La seconde année doit suivre la première (ex: ${startYear}-${startYear + 1}).`
    };
  }
  if (startYear < MIN_YEAR || startYear > MAX_YEAR) {
    return { valid: false, error: `L'année doit être comprise entre ${MIN_YEAR} et ${MAX_YEAR}.` };
  }
  return { valid: true };
}
function getCurrentSchoolYear$1() {
  const db = getDb();
  return db.select().from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get() ?? null;
}
function listSchoolYears() {
  const db = getDb();
  return db.select().from(schoolYears).orderBy(schoolYears.label).all();
}
function createSchoolYear(label) {
  const db = getDb();
  const trimmed = label.trim();
  const validation = validateSchoolYearLabel(trimmed);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  const existing = db.select({ id: schoolYears.id }).from(schoolYears).where(drizzleOrm.eq(schoolYears.label, trimmed)).get();
  if (existing) {
    throw new Error(`L'année scolaire "${trimmed}" existe déjà.`);
  }
  const id = generateId();
  db.insert(schoolYears).values({ id, label: trimmed, isCurrent: false }).run();
  return { id, label: trimmed, isCurrent: false, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
}
function setCurrentSchoolYear(yearId) {
  const db = getDb();
  const target = db.select().from(schoolYears).where(drizzleOrm.eq(schoolYears.id, yearId)).get();
  if (!target) {
    throw new Error("Année scolaire introuvable.");
  }
  db.transaction((tx) => {
    tx.update(schoolYears).set({ isCurrent: false }).where(drizzleOrm.eq(schoolYears.isCurrent, true)).run();
    tx.update(schoolYears).set({ isCurrent: true }).where(drizzleOrm.eq(schoolYears.id, yearId)).run();
  });
  return { ...target, isCurrent: true };
}
function getClasses() {
  const db = getDb();
  return db.select().from(classes).orderBy(classes.sortOrder).all();
}
function createClass(name) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Le nom de la classe est requis.");
  }
  const db = getDb();
  const existing = getClasses();
  if (existing.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`La classe « ${trimmed} » existe déjà.`);
  }
  const nextSortOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0;
  const id = generateId();
  db.insert(classes).values({ id, name: trimmed, sortOrder: nextSortOrder }).run();
  return { id, name: trimmed, sortOrder: nextSortOrder };
}
function updateClass(id, name) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Le nom de la classe est requis.");
  }
  const db = getDb();
  const existing = getClasses();
  if (existing.some((c) => c.id !== id && c.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`La classe « ${trimmed} » existe déjà.`);
  }
  db.update(classes).set({ name: trimmed }).where(drizzleOrm.eq(classes.id, id)).run();
  const updated = existing.find((c) => c.id === id);
  if (!updated) throw new Error("Classe introuvable.");
  return { ...updated, name: trimmed };
}
function deleteClass(id) {
  const db = getDb();
  const hasEnrollments = db.select({ id: enrollments.id }).from(enrollments).where(drizzleOrm.eq(enrollments.classId, id)).get();
  if (hasEnrollments) {
    throw new Error(
      "Impossible de supprimer cette classe : des élèves y sont ou y ont été inscrits."
    );
  }
  db.delete(tuitionSchedules).where(drizzleOrm.eq(tuitionSchedules.classId, id)).run();
  db.delete(classes).where(drizzleOrm.eq(classes.id, id)).run();
}
function getTuitionSchedule(classId, schoolYearId) {
  const db = getDb();
  const schedule = db.select().from(tuitionSchedules).where(
    drizzleOrm.and(drizzleOrm.eq(tuitionSchedules.classId, classId), drizzleOrm.eq(tuitionSchedules.schoolYearId, schoolYearId))
  ).get();
  if (!schedule) return null;
  const installments = db.select().from(tuitionInstallments).where(drizzleOrm.eq(tuitionInstallments.scheduleId, schedule.id)).orderBy(tuitionInstallments.sortOrder).all();
  const paidInstallmentIds = installmentIdsWithValidatedPayments(installments.map((i) => i.id));
  return {
    ...schedule,
    installments: installments.map((i) => ({ ...i, hasPayments: paidInstallmentIds.has(i.id) }))
  };
}
function installmentIdsWithValidatedPayments(installmentIds) {
  if (installmentIds.length === 0) return /* @__PURE__ */ new Set();
  const db = getDb();
  const rows = db.select({ installmentId: transactions.installmentId }).from(transactions).where(
    drizzleOrm.and(
      drizzleOrm.inArray(transactions.installmentId, installmentIds),
      drizzleOrm.eq(transactions.type, "entry"),
      drizzleOrm.eq(transactions.status, "validated")
    )
  ).all();
  return new Set(rows.map((r) => r.installmentId).filter((id) => id !== null));
}
function saveTuitionSchedule(data) {
  const db = getDb();
  if (data.installments.length === 0) {
    throw new Error("Au moins une tranche est requise.");
  }
  const VALID_TARGETS = /* @__PURE__ */ new Set(["tous", "nouveau", "ancien"]);
  for (const installment of data.installments) {
    if (!installment.label.trim()) throw new Error("Chaque tranche doit avoir un libellé.");
    if (installment.amount <= 0) throw new Error("Le montant de chaque tranche doit être positif.");
    if (!installment.dueDate) throw new Error("Chaque tranche doit avoir une date d'échéance.");
    if (!VALID_TARGETS.has(installment.appliesTo)) {
      throw new Error(`« Concerné » invalide pour la tranche "${installment.label}".`);
    }
  }
  db.transaction((tx) => {
    let schedule = tx.select({ id: tuitionSchedules.id }).from(tuitionSchedules).where(
      drizzleOrm.and(
        drizzleOrm.eq(tuitionSchedules.classId, data.classId),
        drizzleOrm.eq(tuitionSchedules.schoolYearId, data.schoolYearId)
      )
    ).get();
    if (!schedule) {
      const id = generateId();
      tx.insert(tuitionSchedules).values({ id, classId: data.classId, schoolYearId: data.schoolYearId }).run();
      schedule = { id };
    }
    const existingInstallments = tx.select({ id: tuitionInstallments.id }).from(tuitionInstallments).where(drizzleOrm.eq(tuitionInstallments.scheduleId, schedule.id)).all();
    const existingIds = new Set(existingInstallments.map((i) => i.id));
    const incomingIds = new Set(
      data.installments.filter((i) => i.id && existingIds.has(i.id)).map((i) => i.id)
    );
    const idsToDelete = [...existingIds].filter((id) => !incomingIds.has(id));
    if (idsToDelete.length > 0) {
      const paidIds = installmentIdsWithValidatedPayments(idsToDelete);
      if (paidIds.size > 0) {
        const paidLabels = tx.select({ label: tuitionInstallments.label }).from(tuitionInstallments).where(drizzleOrm.inArray(tuitionInstallments.id, [...paidIds])).all().map((r) => r.label);
        throw new Error(
          `Impossible de supprimer la/les tranche(s) "${paidLabels.join(", ")}" : des paiements y sont déjà enregistrés.`
        );
      }
      tx.delete(tuitionInstallments).where(drizzleOrm.inArray(tuitionInstallments.id, idsToDelete)).run();
    }
    data.installments.forEach((installment, index) => {
      const sortOrder = installment.sortOrder ?? index;
      if (installment.id && existingIds.has(installment.id)) {
        tx.update(tuitionInstallments).set({
          label: installment.label.trim(),
          amount: installment.amount,
          dueDate: installment.dueDate,
          sortOrder,
          appliesTo: installment.appliesTo
        }).where(drizzleOrm.eq(tuitionInstallments.id, installment.id)).run();
      } else {
        tx.insert(tuitionInstallments).values({
          id: generateId(),
          scheduleId: schedule.id,
          label: installment.label.trim(),
          amount: installment.amount,
          dueDate: installment.dueDate,
          sortOrder,
          appliesTo: installment.appliesTo
        }).run();
      }
    });
    return schedule.id;
  });
  const result = getTuitionSchedule(data.classId, data.schoolYearId);
  if (!result) {
    throw new Error("Barème introuvable après sauvegarde.");
  }
  return result;
}
function getInstallmentLabel(installmentId) {
  const db = getDb();
  const row = db.select({ label: tuitionInstallments.label }).from(tuitionInstallments).where(drizzleOrm.eq(tuitionInstallments.id, installmentId)).get();
  return row?.label ?? null;
}
const SCHOOL_INFO_ID = "singleton";
function getSchoolInfo() {
  const db = getDb();
  let row = db.select().from(schoolInfo).where(drizzleOrm.eq(schoolInfo.id, SCHOOL_INFO_ID)).get();
  if (!row) {
    db.insert(schoolInfo).values({ id: SCHOOL_INFO_ID, name: "" }).run();
    row = db.select().from(schoolInfo).where(drizzleOrm.eq(schoolInfo.id, SCHOOL_INFO_ID)).get();
  }
  if (!row) {
    throw new Error("Impossible de créer la ligne singleton SCHOOL_INFO.");
  }
  return {
    name: row.name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    logoDataUrl: row.logoDataUrl,
    stampDataUrl: row.stampDataUrl,
    updatedAt: row.updatedAt
  };
}
function updateSchoolInfo(data) {
  const db = getDb();
  getSchoolInfo();
  db.update(schoolInfo).set({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(schoolInfo.id, SCHOOL_INFO_ID)).run();
  return getSchoolInfo();
}
function registerSettingsIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.settings.getCurrentSchoolYear, async () => {
    return getCurrentSchoolYear$1();
  });
  electron.ipcMain.handle(IPC_CHANNELS.settings.listSchoolYears, async () => {
    return listSchoolYears();
  });
  electron.ipcMain.handle(IPC_CHANNELS.settings.createSchoolYear, async (_event, label) => {
    return createSchoolYear(label);
  });
  electron.ipcMain.handle(IPC_CHANNELS.settings.setCurrentSchoolYear, async (_event, yearId) => {
    return setCurrentSchoolYear(yearId);
  });
  electron.ipcMain.handle(IPC_CHANNELS.settings.getClasses, async () => {
    return getClasses();
  });
  electron.ipcMain.handle(IPC_CHANNELS.settings.createClass, async (_event, name) => {
    return createClass(name);
  });
  electron.ipcMain.handle(IPC_CHANNELS.settings.updateClass, async (_event, id, name) => {
    return updateClass(id, name);
  });
  electron.ipcMain.handle(IPC_CHANNELS.settings.deleteClass, async (_event, id) => {
    return deleteClass(id);
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.settings.getTuitionSchedule,
    async (_event, classId, yearId) => {
      return getTuitionSchedule(classId, yearId);
    }
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.settings.saveTuitionSchedule,
    async (_event, data) => {
      return saveTuitionSchedule(data);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.settings.getSchoolInfo, async () => {
    return getSchoolInfo();
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.settings.updateSchoolInfo,
    async (_event, data) => {
      return updateSchoolInfo(data);
    }
  );
}
function registerAuthIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.auth.login, async (_event, username, password) => {
    return login(username, password);
  });
  electron.ipcMain.handle(IPC_CHANNELS.auth.logout, async () => {
    logout();
  });
  electron.ipcMain.handle(IPC_CHANNELS.auth.getCurrentUser, async () => {
    return getCurrentUser();
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.auth.changePassword,
    async (_event, oldPassword, newPassword) => {
      const session = getCurrentSession();
      if (!session) {
        throw new Error("Aucune session active.");
      }
      changePassword(session.userId, oldPassword, newPassword);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.auth.getUserById, async (_event, userId) => {
    return getUserById(userId);
  });
  electron.ipcMain.handle(IPC_CHANNELS.auth.listUsers, async () => {
    return listUsers();
  });
  electron.ipcMain.handle(IPC_CHANNELS.auth.createUser, async (_event, data) => {
    return createUser(data);
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.auth.updateUser,
    async (_event, userId, data) => {
      return updateUser(userId, data);
    }
  );
  electron.ipcMain.handle(
    IPC_CHANNELS.auth.setUserActive,
    async (_event, userId, isActive) => {
      return setUserActive(userId, isActive);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.auth.resetPassword, async (_event, userId) => {
    return resetPassword(userId);
  });
}
const PRINTER_CONFIG_ID = "singleton";
function toPrinterConfig(row) {
  return {
    enabled: row.enabled,
    connectionType: row.connectionType,
    devicePath: row.devicePath,
    host: row.host,
    port: row.port,
    lastTestAt: row.lastTestAt,
    lastTestSuccess: row.lastTestSuccess,
    lastTestMessage: row.lastTestMessage
  };
}
function getPrinterConfig() {
  const db = getDb();
  let row = db.select().from(printerConfig).where(drizzleOrm.eq(printerConfig.id, PRINTER_CONFIG_ID)).get();
  if (!row) {
    db.insert(printerConfig).values({ id: PRINTER_CONFIG_ID }).run();
    row = db.select().from(printerConfig).where(drizzleOrm.eq(printerConfig.id, PRINTER_CONFIG_ID)).get();
  }
  if (!row) {
    throw new Error("Impossible de créer la ligne singleton PRINTER_CONFIG.");
  }
  return toPrinterConfig(row);
}
function updatePrinterConfig(data) {
  const db = getDb();
  getPrinterConfig();
  if (data.connectionType === "network" && data.host !== void 0 && !data.host?.trim()) {
    throw new Error("L'adresse de l'imprimante réseau est requise.");
  }
  if (data.connectionType === "usb" && data.devicePath !== void 0 && !data.devicePath?.trim()) {
    throw new Error("Le port de l'imprimante USB est requis (ex: \\\\.\\COM3).");
  }
  if (data.port !== void 0 && (data.port <= 0 || data.port > 65535)) {
    throw new Error("Le port TCP doit être compris entre 1 et 65535.");
  }
  db.update(printerConfig).set({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(printerConfig.id, PRINTER_CONFIG_ID)).run();
  return getPrinterConfig();
}
function recordTestResult(success, message) {
  const db = getDb();
  getPrinterConfig();
  db.update(printerConfig).set({
    lastTestAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastTestSuccess: success,
    lastTestMessage: message
  }).where(drizzleOrm.eq(printerConfig.id, PRINTER_CONFIG_ID)).run();
  return getPrinterConfig();
}
function formatAmount(amount) {
  return `${amount.toLocaleString("fr-FR")} F CFA`;
}
function formatDateTime(iso) {
  return dateFns.format(new Date(iso), "d MMM yyyy 'à' HH:mm", { locale: locale.fr });
}
function decodePngLogo(logoDataUrl) {
  if (!logoDataUrl) return null;
  const match = /^data:image\/png;base64,(.+)$/i.exec(logoDataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], "base64");
  } catch {
    return null;
  }
}
async function buildReceiptTicket(printer, data, schoolInfo2) {
  printer.clear();
  const logoBuffer = decodePngLogo(schoolInfo2.logoDataUrl);
  if (logoBuffer) {
    try {
      printer.alignCenter();
      await printer.printImageBuffer(logoBuffer);
    } catch (error) {
      console.warn("[printing] Logo non imprimé (ignoré) :", error);
    }
  }
  printer.alignCenter();
  printer.bold(true);
  printer.setTextDoubleHeight();
  printer.println(schoolInfo2.name || "Établissement scolaire");
  printer.setTextNormal();
  printer.bold(false);
  if (schoolInfo2.address) printer.println(schoolInfo2.address);
  if (schoolInfo2.phone) printer.println(`Tél : ${schoolInfo2.phone}`);
  printer.drawLine();
  printer.alignCenter();
  printer.bold(true);
  printer.println("REÇU DE PAIEMENT");
  printer.bold(false);
  printer.println(`N° ${data.receiptNumber}`);
  printer.println(formatDateTime(data.createdAt));
  printer.drawLine();
  printer.alignLeft();
  if (data.studentName) {
    printer.leftRight("Élève", data.studentName);
    if (data.matricule) printer.leftRight("Matricule", data.matricule);
    if (data.className) printer.leftRight("Classe", data.className);
  }
  printer.leftRight("Type de frais", data.categoryLabel);
  if (data.installmentLabel) printer.leftRight("Tranche", data.installmentLabel);
  if (data.description) printer.println(`Motif : ${data.description}`);
  printer.drawLine();
  printer.alignCenter();
  printer.bold(true);
  printer.setTextDoubleHeight();
  printer.println(formatAmount(data.amount));
  printer.setTextNormal();
  printer.bold(false);
  printer.drawLine();
  printer.alignLeft();
  printer.println(`Opérateur : ${data.operatorName}`);
  if (data.printCopyLabel) {
    printer.alignCenter();
    printer.println(data.printCopyLabel);
  }
  printer.newLine();
  printer.alignCenter();
  printer.println("Merci pour votre confiance");
  printer.newLine();
  printer.cut();
}
function buildTestTicket(printer, schoolInfo2) {
  printer.clear();
  printer.alignCenter();
  printer.bold(true);
  printer.println(schoolInfo2.name || "AcademyFlow");
  printer.bold(false);
  printer.drawLine();
  printer.println("Test de connexion imprimante");
  printer.println(formatDateTime((/* @__PURE__ */ new Date()).toISOString()));
  printer.drawLine();
  printer.println("Si ce ticket s'imprime correctement,");
  printer.println("la configuration est opérationnelle.");
  printer.newLine();
  printer.cut();
}
function buildInterfaceString(config) {
  if (config.connectionType === "network") {
    if (!config.host?.trim()) {
      throw new Error("L'adresse de l'imprimante réseau n'est pas configurée.");
    }
    return `tcp://${config.host.trim()}:${config.port}`;
  }
  if (!config.devicePath?.trim()) {
    throw new Error("Le port de l'imprimante USB n'est pas configuré (ex: \\\\.\\COM3).");
  }
  return config.devicePath.trim();
}
function createPrinterInstance(config) {
  return new nodeThermalPrinter.ThermalPrinter({
    type: nodeThermalPrinter.PrinterTypes.EPSON,
    interface: buildInterfaceString(config),
    // PC858 : jeu de caractères Latin étendu (accents français) le plus
    // largement supporté par les imprimantes ESC/POS génériques.
    characterSet: nodeThermalPrinter.CharacterSet.PC858_EURO,
    removeSpecialCharacters: false,
    width: 42,
    options: { timeout: 5e3 }
  });
}
async function testPrinterConnection(config, schoolInfo2) {
  const printer = createPrinterInstance(config);
  const connected = await printer.isPrinterConnected();
  if (!connected) {
    throw new Error(
      config.connectionType === "network" ? `Imprimante injoignable à l'adresse ${config.host}:${config.port}.` : `Imprimante introuvable sur le port ${config.devicePath}.`
    );
  }
  buildTestTicket(printer, schoolInfo2);
  await printer.execute();
}
async function printReceiptTicket(config, data, schoolInfo2) {
  const printer = createPrinterInstance(config);
  await buildReceiptTicket(printer, data, schoolInfo2);
  await printer.execute();
}
function registerPrinterIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.printer.openPdf, async (_event, base64, fileName) => {
    const buffer = Buffer.from(base64, "base64");
    const pdfDir = node_path.join(electron.app.getPath("temp"), "academyflow-pdf");
    node_fs.mkdirSync(pdfDir, { recursive: true });
    const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = node_path.join(pdfDir, safeFileName);
    node_fs.writeFileSync(filePath, buffer);
    const error = await electron.shell.openPath(filePath);
    if (error) {
      throw new Error(`Échec de l'ouverture du PDF : ${error}`);
    }
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.printer.openFile,
    async (_event, base64, fileName) => {
      const buffer = Buffer.from(base64, "base64");
      const dir = node_path.join(electron.app.getPath("temp"), "academyflow-exports");
      node_fs.mkdirSync(dir, { recursive: true });
      const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = node_path.join(dir, safeFileName);
      node_fs.writeFileSync(filePath, buffer);
      const error = await electron.shell.openPath(filePath);
      if (error) {
        throw new Error(`Échec de l'ouverture du fichier : ${error}`);
      }
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.printer.getConfig, async () => {
    return getPrinterConfig();
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.printer.updateConfig,
    async (_event, data) => {
      return updatePrinterConfig(data);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.printer.getStatus, async () => {
    const config = getPrinterConfig();
    return {
      connected: config.enabled && config.lastTestSuccess === true,
      name: config.connectionType === "network" ? config.host ?? void 0 : config.devicePath ?? void 0
    };
  });
  electron.ipcMain.handle(IPC_CHANNELS.printer.testConnection, async () => {
    const config = getPrinterConfig();
    const schoolInfo2 = getSchoolInfo();
    try {
      await testPrinterConnection(config, schoolInfo2);
      recordTestResult(true, null);
      return {
        connected: true,
        name: config.connectionType === "network" ? config.host ?? void 0 : config.devicePath ?? void 0
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Échec de la connexion à l'imprimante.";
      recordTestResult(false, message);
      return { connected: false };
    }
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.printer.printReceipt,
    async (_event, receiptId) => {
      const config = getPrinterConfig();
      if (!config.enabled) {
        return {
          success: false,
          message: "Impression thermique désactivée — utilisation du reçu PDF."
        };
      }
      try {
        const receipt = getReceiptById(receiptId);
        if (!receipt) throw new Error("Reçu introuvable.");
        const transaction = getTransactionById(receipt.transactionId);
        if (!transaction) throw new Error("Opération introuvable pour ce reçu.");
        const student = transaction.studentId ? findById(transaction.studentId) : null;
        const className = transaction.studentId ? getCurrentClassName(transaction.studentId) : null;
        const installmentLabel = transaction.installmentId ? getInstallmentLabel(transaction.installmentId) : null;
        const operator = getUserById(transaction.userId);
        const schoolInfo2 = getSchoolInfo();
        await printReceiptTicket(
          config,
          {
            receiptNumber: receipt.receiptNumber,
            createdAt: receipt.createdAt,
            studentName: student ? `${student.lastName} ${student.firstName}` : null,
            matricule: student?.matricule ?? null,
            className,
            categoryLabel: CASH_CATEGORY_LABELS[transaction.category],
            installmentLabel,
            description: transaction.description,
            amount: transaction.amount,
            operatorName: operator?.fullName ?? "—",
            printCopyLabel: receipt.printCount > 0 ? `Copie n° ${receipt.printCount + 1}` : null
          },
          schoolInfo2
        );
        incrementPrintCount(transaction.id);
        return { success: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Échec de l'impression thermique.";
        return { success: false, message };
      }
    }
  );
}
const BACKUP_CONFIG_ID = "singleton";
function ensureRow() {
  const db = getDb();
  let row = db.select().from(backupConfig).where(drizzleOrm.eq(backupConfig.id, BACKUP_CONFIG_ID)).get();
  if (!row) {
    db.insert(backupConfig).values({ id: BACKUP_CONFIG_ID }).run();
    row = db.select().from(backupConfig).where(drizzleOrm.eq(backupConfig.id, BACKUP_CONFIG_ID)).get();
  }
  if (!row) {
    throw new Error("Impossible de créer la ligne singleton BACKUP_CONFIG.");
  }
  return row;
}
function getRawBackupConfig() {
  return ensureRow();
}
function getBackupStatus$1() {
  const row = ensureRow();
  return {
    connected: row.connected,
    accountEmail: row.accountEmail,
    autoBackupEnabled: row.autoBackupEnabled,
    autoBackupHour: row.autoBackupHour,
    lastBackupAt: row.lastBackupAt,
    lastBackupStatus: row.lastBackupStatus,
    lastBackupMessage: row.lastBackupMessage
  };
}
function updateBackupSettings$1(data) {
  ensureRow();
  if (data.autoBackupHour !== void 0 && (data.autoBackupHour < 0 || data.autoBackupHour > 23)) {
    throw new Error("L'heure de sauvegarde automatique doit être comprise entre 0 et 23.");
  }
  const db = getDb();
  db.update(backupConfig).set({ ...data, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(backupConfig.id, BACKUP_CONFIG_ID)).run();
  return getBackupStatus$1();
}
function setConnectedAccount(accountEmail, refreshTokenEncrypted) {
  ensureRow();
  const db = getDb();
  db.update(backupConfig).set({
    connected: true,
    accountEmail,
    refreshTokenEncrypted,
    // Un nouveau compte peut ne pas avoir accès à l'ancien dossier — recréé au prochain export.
    driveFolderId: null,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).where(drizzleOrm.eq(backupConfig.id, BACKUP_CONFIG_ID)).run();
}
function disconnectAccount() {
  ensureRow();
  const db = getDb();
  db.update(backupConfig).set({
    connected: false,
    accountEmail: null,
    refreshTokenEncrypted: null,
    driveFolderId: null,
    autoBackupEnabled: false,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).where(drizzleOrm.eq(backupConfig.id, BACKUP_CONFIG_ID)).run();
}
function setDriveFolderId(folderId) {
  const db = getDb();
  db.update(backupConfig).set({ driveFolderId: folderId, updatedAt: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(backupConfig.id, BACKUP_CONFIG_ID)).run();
}
function recordBackupResult(status, message) {
  ensureRow();
  const db = getDb();
  db.update(backupConfig).set({
    lastBackupAt: (/* @__PURE__ */ new Date()).toISOString(),
    lastBackupStatus: status,
    lastBackupMessage: message,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString()
  }).where(drizzleOrm.eq(backupConfig.id, BACKUP_CONFIG_ID)).run();
}
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email"
];
const LOOPBACK_TIMEOUT_MS = 5 * 60 * 1e3;
function getOAuthCredentials() {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Configuration Google Drive manquante sur ce poste. Un administrateur doit renseigner GOOGLE_DRIVE_CLIENT_ID et GOOGLE_DRIVE_CLIENT_SECRET (voir .env.example à la racine du projet)."
    );
  }
  return { clientId, clientSecret };
}
function buildResponsePage(title, message) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;text-align:center;padding:64px 24px;color:#1e293b}</style>
</head><body><h2>${title}</h2><p>${message}</p></body></html>`;
}
async function runLoopbackAuthorization() {
  const { clientId, clientSecret } = getOAuthCredentials();
  const pkceHelper = new googleapis.google.auth.OAuth2();
  const { codeVerifier, codeChallenge } = await pkceHelper.generateCodeVerifierAsync();
  return new Promise((resolve, reject) => {
    let settled = false;
    let redirectUri = "";
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Délai d'autorisation dépassé (5 minutes) — veuillez réessayer."));
    }, LOOPBACK_TIMEOUT_MS);
    function cleanup() {
      clearTimeout(timeout);
      server.close();
    }
    function settle(fn) {
      if (settled) return;
      settled = true;
      fn();
    }
    async function exchangeCode(code) {
      try {
        const client = new googleapis.google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const { tokens } = await client.getToken({ code, codeVerifier });
        if (!tokens.refresh_token) {
          throw new Error(
            "Google n'a pas renvoyé de jeton de rafraîchissement. Révoquez l'accès existant sur myaccount.google.com/permissions puis réessayez."
          );
        }
        client.setCredentials(tokens);
        const email = await resolveAccountEmail(client);
        settle(() => resolve({ refreshToken: tokens.refresh_token, accountEmail: email }));
      } catch (error) {
        settle(
          () => reject(
            error instanceof Error ? error : new Error("Échec de l'échange du code d'autorisation.")
          )
        );
      }
    }
    const server = node_http.createServer((req, res) => {
      if (!req.url || !req.url.startsWith("/oauth2callback")) {
        res.writeHead(404).end();
        return;
      }
      const url = new URL(req.url, "http://127.0.0.1");
      const code = url.searchParams.get("code");
      const errorParam = url.searchParams.get("error");
      if (errorParam) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(
          buildResponsePage(
            "Connexion annulée",
            "Vous pouvez fermer cette fenêtre et revenir à AcademyFlow."
          )
        );
        cleanup();
        settle(() => reject(new Error("Autorisation refusée par l'utilisateur.")));
        return;
      }
      if (!code) {
        res.writeHead(400).end();
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(
        buildResponsePage(
          "Connexion réussie",
          "Vous pouvez fermer cette fenêtre et revenir à AcademyFlow."
        )
      );
      cleanup();
      void exchangeCode(code);
    });
    server.on("error", (error) => {
      cleanup();
      settle(() => reject(error));
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      redirectUri = `http://127.0.0.1:${port}/oauth2callback`;
      const authClient = new googleapis.google.auth.OAuth2(clientId, clientSecret, redirectUri);
      const authUrl = authClient.generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: SCOPES,
        code_challenge_method: "S256",
        code_challenge: codeChallenge
      });
      electron.shell.openExternal(authUrl).catch((error) => {
        cleanup();
        settle(
          () => reject(
            error instanceof Error ? error : new Error("Impossible d'ouvrir le navigateur système.")
          )
        );
      });
    });
  });
}
async function resolveAccountEmail(client) {
  const oauth2 = googleapis.google.oauth2({ auth: client, version: "v2" });
  const { data } = await oauth2.userinfo.get();
  if (!data.email) {
    throw new Error("Impossible de résoudre l'adresse e-mail du compte Google connecté.");
  }
  return data.email;
}
const BACKUP_FOLDER_NAME = "AcademyFlow — Sauvegardes";
function encryptRefreshToken(token) {
  if (electron.safeStorage.isEncryptionAvailable()) {
    return `enc:${electron.safeStorage.encryptString(token).toString("base64")}`;
  }
  console.warn(
    "[backup] Chiffrement système indisponible — jeton Google Drive stocké sans chiffrement."
  );
  return `plain:${token}`;
}
function decryptRefreshToken(stored) {
  if (stored.startsWith("enc:")) {
    return electron.safeStorage.decryptString(Buffer.from(stored.slice(4), "base64"));
  }
  if (stored.startsWith("plain:")) {
    return stored.slice(6);
  }
  throw new Error("Jeton Google Drive illisible — merci de reconnecter le compte.");
}
function getAuthorizedClient() {
  const { clientId, clientSecret } = getOAuthCredentials();
  const config = getRawBackupConfig();
  if (!config.connected || !config.refreshTokenEncrypted) {
    throw new Error("Aucun compte Google Drive connecté. Rendez-vous dans Paramètres > Sauvegarde.");
  }
  const client = new googleapis.google.auth.OAuth2(clientId, clientSecret);
  client.setCredentials({ refresh_token: decryptRefreshToken(config.refreshTokenEncrypted) });
  return client;
}
function getDriveClient() {
  return googleapis.google.drive({ version: "v3", auth: getAuthorizedClient() });
}
async function ensureBackupFolder(drive) {
  const config = getRawBackupConfig();
  if (config.driveFolderId) {
    try {
      const existing = await drive.files.get({ fileId: config.driveFolderId, fields: "id,trashed" });
      if (existing.data.id && !existing.data.trashed) {
        return existing.data.id;
      }
    } catch {
    }
  }
  const found = await drive.files.list({
    q: `name = '${BACKUP_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id, createdTime)",
    orderBy: "createdTime",
    pageSize: 1
  });
  const existingFolderId = found.data.files?.[0]?.id;
  if (existingFolderId) {
    setDriveFolderId(existingFolderId);
    return existingFolderId;
  }
  const created = await drive.files.create({
    requestBody: { name: BACKUP_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" },
    fields: "id"
  });
  const folderId = created.data.id;
  if (!folderId) {
    throw new Error("Échec de la création du dossier de sauvegardes sur Google Drive.");
  }
  setDriveFolderId(folderId);
  return folderId;
}
async function listBackupFiles(drive, folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, size, createdTime)",
    orderBy: "createdTime desc",
    pageSize: 50
  });
  return (res.data.files ?? []).filter((f) => f.id && f.name).map((f) => ({
    driveFileId: f.id,
    fileName: f.name,
    sizeBytes: f.size ? Number(f.size) : 0,
    createdAt: f.createdTime ?? (/* @__PURE__ */ new Date()).toISOString()
  }));
}
async function uploadBackupFile(drive, folderId, fileName, content) {
  const res = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: "application/gzip", body: node_stream.Readable.from(content) },
    fields: "id"
  });
  if (!res.data.id) {
    throw new Error("Échec de l'envoi de la sauvegarde vers Google Drive.");
  }
  return { driveFileId: res.data.id };
}
async function downloadBackupFile(drive, driveFileId) {
  const res = await drive.files.get(
    { fileId: driveFileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(res.data);
}
async function deleteBackupFile(drive, driveFileId) {
  await drive.files.delete({ fileId: driveFileId });
}
const MAX_BACKUPS_RETAINED = 7;
const SCHEDULER_CHECK_INTERVAL_MS = 15 * 60 * 1e3;
function toHistoryEntry(file) {
  return {
    id: file.driveFileId,
    fileName: file.fileName,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt
  };
}
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
function getBackupStatus() {
  return getBackupStatus$1();
}
function updateBackupSettings(data) {
  return updateBackupSettings$1(data);
}
async function listBackups() {
  const drive = getDriveClient();
  const folderId = await ensureBackupFolder(drive);
  const files = await listBackupFiles(drive, folderId);
  return files.map(toHistoryEntry);
}
async function getLastBackup() {
  const [latest] = await listBackups();
  return latest ? { fileName: latest.fileName, createdAt: latest.createdAt, sizeBytes: latest.sizeBytes } : null;
}
async function connectGoogleAccount() {
  const { refreshToken, accountEmail } = await runLoopbackAuthorization();
  setConnectedAccount(accountEmail, encryptRefreshToken(refreshToken));
  return getBackupStatus$1();
}
function disconnectGoogleAccount() {
  disconnectAccount();
  return getBackupStatus$1();
}
async function rotateOldBackups(drive, folderId) {
  const files = await listBackupFiles(drive, folderId);
  const toDelete = files.slice(MAX_BACKUPS_RETAINED);
  if (toDelete.length === 0) return;
  for (const file of toDelete) {
    try {
      await deleteBackupFile(drive, file.driveFileId);
    } catch (error) {
      console.warn(
        `[backup] Échec de la suppression distante de ${file.fileName} (ignoré) :`,
        error
      );
    }
  }
}
async function exportToCloud() {
  try {
    const drive = getDriveClient();
    const folderId = await ensureBackupFolder(drive);
    getSqlite().pragma("wal_checkpoint(TRUNCATE)");
    const dbBuffer = node_zlib.gzipSync(node_fs.readFileSync(getDatabasePath()));
    const fileName = `academyflow_${dateFns.format(/* @__PURE__ */ new Date(), "yyyy-MM-dd_HHmmss")}.db.gz`;
    await uploadBackupFile(drive, folderId, fileName, dbBuffer);
    await rotateOldBackups(drive, folderId);
    const message = `Sauvegarde envoyée (${formatBytes(dbBuffer.length)}).`;
    recordBackupResult("success", message);
    return { success: true, fileName };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec de la sauvegarde cloud.";
    recordBackupResult("error", message);
    return { success: false, message };
  }
}
async function restoreFromCloud(backupId) {
  try {
    const drive = getDriveClient();
    let gzipped;
    try {
      gzipped = await downloadBackupFile(drive, backupId);
    } catch (error) {
      const status = error?.code ?? error?.status;
      if (status === 404) {
        throw new Error("Cette sauvegarde n'existe plus sur Google Drive.");
      }
      throw error;
    }
    const restoredDb = node_zlib.gunzipSync(gzipped);
    const dbPath = getDatabasePath();
    const localBackupsDir = node_path.join(node_path.dirname(dbPath), "backups");
    node_fs.mkdirSync(localBackupsDir, { recursive: true });
    const safetyCopyName = `pre-restore_${dateFns.format(/* @__PURE__ */ new Date(), "yyyy-MM-dd_HHmmss")}.db`;
    node_fs.copyFileSync(dbPath, node_path.join(localBackupsDir, safetyCopyName));
    closeConnection();
    node_fs.writeFileSync(dbPath, restoredDb);
    for (const suffix of ["-wal", "-shm"]) {
      const sidecarPath = `${dbPath}${suffix}`;
      if (node_fs.existsSync(sidecarPath)) node_fs.rmSync(sidecarPath);
    }
    setTimeout(() => {
      electron.app.relaunch();
      electron.app.exit(0);
    }, 800);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Échec de la restauration.";
    return { success: false, message };
  }
}
let schedulerHandle = null;
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
async function runAutoBackupIfDue() {
  const status = getBackupStatus$1();
  if (!status.connected || !status.autoBackupEnabled) return;
  const now = /* @__PURE__ */ new Date();
  if (now.getHours() !== status.autoBackupHour) return;
  if (status.lastBackupAt && isSameDay(new Date(status.lastBackupAt), now)) return;
  console.info("[backup] Déclenchement de la sauvegarde automatique quotidienne.");
  await exportToCloud();
}
function initAutoBackupScheduler() {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    runAutoBackupIfDue().catch(
      (error) => console.error("[backup] Échec de la sauvegarde automatique :", error)
    );
  }, SCHEDULER_CHECK_INTERVAL_MS);
}
function stopAutoBackupScheduler() {
  if (schedulerHandle) {
    clearInterval(schedulerHandle);
    schedulerHandle = null;
  }
}
function registerBackupIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.backup.getStatus, async () => {
    return getBackupStatus();
  });
  electron.ipcMain.handle(
    IPC_CHANNELS.backup.updateSettings,
    async (_event, data) => {
      return updateBackupSettings(data);
    }
  );
  electron.ipcMain.handle(IPC_CHANNELS.backup.connectGoogleAccount, async () => {
    return connectGoogleAccount();
  });
  electron.ipcMain.handle(IPC_CHANNELS.backup.disconnectGoogleAccount, async () => {
    return disconnectGoogleAccount();
  });
  electron.ipcMain.handle(IPC_CHANNELS.backup.exportToCloud, async () => {
    return exportToCloud();
  });
  electron.ipcMain.handle(IPC_CHANNELS.backup.getLastBackup, async () => {
    return getLastBackup();
  });
  electron.ipcMain.handle(IPC_CHANNELS.backup.listBackups, async () => {
    return listBackups();
  });
  electron.ipcMain.handle(IPC_CHANNELS.backup.restoreFromCloud, async (_event, backupId) => {
    return restoreFromCloud(backupId);
  });
}
function pad(n) {
  return String(n).padStart(2, "0");
}
function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function monthRange(year, monthIndex0) {
  const from = `${year}-${pad(monthIndex0 + 1)}-01`;
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  const toExclusiveEnd = `${year}-${pad(monthIndex0 + 1)}-${pad(lastDay)}T23:59:59.999Z`;
  return { from, toExclusiveEnd };
}
function shiftMonth(year, monthIndex0, delta) {
  const total = year * 12 + monthIndex0 + delta;
  return { year: Math.floor(total / 12), monthIndex0: (total % 12 + 12) % 12 };
}
function computeGrowthPct(current, previous) {
  if (previous === 0) return null;
  return (current - previous) / previous * 100;
}
function trend(current, previous, compareLabel) {
  return { current, previous, growthPct: computeGrowthPct(current, previous), compareLabel };
}
function getCurrentSchoolYear() {
  const db = getDb();
  const year = db.select({ id: schoolYears.id, label: schoolYears.label, createdAt: schoolYears.createdAt }).from(schoolYears).where(drizzleOrm.eq(schoolYears.isCurrent, true)).get();
  return year ?? null;
}
function computeKpis(now, schoolYear) {
  const db = getDb();
  const currentMonth = monthRange(now.getFullYear(), now.getMonth());
  const prev = shiftMonth(now.getFullYear(), now.getMonth(), -1);
  const previousMonth = monthRange(prev.year, prev.monthIndex0);
  const studentStats = getStats$2();
  const studentsEnrolled = trend(
    studentStats.total.current,
    studentStats.total.previous,
    "vs année dernière"
  );
  const schoolYearId = schoolYear?.id ?? null;
  const txnConditions = [
    drizzleOrm.eq(transactions.status, "validated"),
    drizzleOrm.gte(transactions.createdAt, previousMonth.from)
  ];
  if (schoolYearId) txnConditions.push(drizzleOrm.eq(transactions.schoolYearId, schoolYearId));
  const validatedTxns = db.select({
    type: transactions.type,
    amount: transactions.amount,
    createdAt: transactions.createdAt
  }).from(transactions).where(drizzleOrm.and(...txnConditions)).all();
  const sumFor = (type, from, to) => validatedTxns.filter((t) => t.type === type && t.createdAt >= from && t.createdAt <= to).reduce((sum, t) => sum + t.amount, 0);
  const entriesCurrent = sumFor("entry", currentMonth.from, currentMonth.toExclusiveEnd);
  const entriesPrevious = sumFor("entry", previousMonth.from, previousMonth.toExclusiveEnd);
  const exitsCurrent = sumFor("exit", currentMonth.from, currentMonth.toExclusiveEnd);
  const exitsPrevious = sumFor("exit", previousMonth.from, previousMonth.toExclusiveEnd);
  const activeEmployees = db.select({ createdAt: employees.createdAt }).from(employees).where(drizzleOrm.eq(employees.isActive, true)).all();
  const personnelCurrent = activeEmployees.length;
  const personnelBoundary = schoolYear?.createdAt ?? null;
  const personnelPrevious = personnelBoundary ? activeEmployees.filter((e) => e.createdAt <= personnelBoundary).length : 0;
  return {
    studentsEnrolled,
    cashEntries: trend(entriesCurrent, entriesPrevious, "vs mois précédent"),
    cashExits: trend(exitsCurrent, exitsPrevious, "vs mois précédent"),
    personnel: trend(personnelCurrent, personnelPrevious, "vs année dernière"),
    // Solde de caisse réel : cumulé toutes années confondues (une caisse
    // physique ne se remet pas à zéro au changement d'année scolaire).
    cashBalance: getBalance(),
    asOf: now.toISOString()
  };
}
function computeCashEvolution(now, schoolYearId, monthsBack = CASH_EVOLUTION_MONTHS_BACK) {
  const db = getDb();
  const start = shiftMonth(now.getFullYear(), now.getMonth(), -(monthsBack - 1));
  const rangeStart = monthRange(start.year, start.monthIndex0).from;
  const conditions = [drizzleOrm.eq(transactions.status, "validated"), drizzleOrm.gte(transactions.createdAt, rangeStart)];
  if (schoolYearId) conditions.push(drizzleOrm.eq(transactions.schoolYearId, schoolYearId));
  const rows = db.select({
    type: transactions.type,
    amount: transactions.amount,
    createdAt: transactions.createdAt
  }).from(transactions).where(drizzleOrm.and(...conditions)).all();
  const points = [];
  for (let i = 0; i < monthsBack; i++) {
    const { year, monthIndex0 } = shiftMonth(
      now.getFullYear(),
      now.getMonth(),
      -(monthsBack - 1) + i
    );
    const { from, toExclusiveEnd } = monthRange(year, monthIndex0);
    const inMonth = rows.filter((r) => r.createdAt >= from && r.createdAt <= toExclusiveEnd);
    points.push({
      month: `${year}-${pad(monthIndex0 + 1)}`,
      label: MONTH_LABELS_FR[monthIndex0].slice(0, 1).toUpperCase() + MONTH_LABELS_FR[monthIndex0].slice(1, 4),
      entries: inMonth.filter((r) => r.type === "entry").reduce((sum, r) => sum + r.amount, 0),
      exits: inMonth.filter((r) => r.type === "exit").reduce((sum, r) => sum + r.amount, 0)
    });
  }
  return points;
}
function computeCategoryBreakdown(now, schoolYearId) {
  const db = getDb();
  const { from, toExclusiveEnd } = monthRange(now.getFullYear(), now.getMonth());
  const conditions = [
    drizzleOrm.eq(transactions.status, "validated"),
    drizzleOrm.eq(transactions.type, "entry"),
    drizzleOrm.gte(transactions.createdAt, from),
    drizzleOrm.lte(transactions.createdAt, toExclusiveEnd)
  ];
  if (schoolYearId) conditions.push(drizzleOrm.eq(transactions.schoolYearId, schoolYearId));
  const rows = db.select({ category: transactions.category, amount: transactions.amount }).from(transactions).where(drizzleOrm.and(...conditions)).all();
  const byCategory = /* @__PURE__ */ new Map();
  for (const row of rows) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
  }
  const total = Array.from(byCategory.values()).reduce((sum, v) => sum + v, 0);
  return Array.from(byCategory.entries()).map(([category, amount]) => ({
    category,
    label: CASH_CATEGORY_LABELS[category] ?? category,
    amount,
    percentage: total > 0 ? amount / total * 100 : 0
  })).sort((a, b) => b.amount - a.amount);
}
function computeClassStats(schoolYearId) {
  const db = getDb();
  if (!schoolYearId) return [];
  const allClasses = db.select().from(classes).orderBy(classes.sortOrder).all();
  const rows = db.select({ classId: enrollments.classId }).from(enrollments).innerJoin(students, drizzleOrm.eq(students.id, enrollments.studentId)).where(drizzleOrm.and(drizzleOrm.eq(enrollments.schoolYearId, schoolYearId), drizzleOrm.eq(students.isActive, true))).all();
  const countByClass = /* @__PURE__ */ new Map();
  for (const row of rows) {
    countByClass.set(row.classId, (countByClass.get(row.classId) ?? 0) + 1);
  }
  return allClasses.map((cls) => ({
    classId: cls.id,
    className: cls.name,
    studentCount: countByClass.get(cls.id) ?? 0
  })).filter((cls) => cls.studentCount > 0);
}
function computeTopExpenses(now, schoolYearId, limit = 5) {
  const db = getDb();
  const { from, toExclusiveEnd } = monthRange(now.getFullYear(), now.getMonth());
  const conditions = [
    drizzleOrm.eq(transactions.status, "validated"),
    drizzleOrm.eq(transactions.type, "exit"),
    drizzleOrm.gte(transactions.createdAt, from),
    drizzleOrm.lte(transactions.createdAt, toExclusiveEnd)
  ];
  if (schoolYearId) conditions.push(drizzleOrm.eq(transactions.schoolYearId, schoolYearId));
  const rows = db.select({ category: transactions.category, amount: transactions.amount }).from(transactions).where(drizzleOrm.and(...conditions)).all();
  const byCategory = /* @__PURE__ */ new Map();
  for (const row of rows) {
    byCategory.set(row.category, (byCategory.get(row.category) ?? 0) + row.amount);
  }
  return Array.from(byCategory.entries()).map(([category, amount]) => ({
    category,
    label: CASH_CATEGORY_LABELS[category] ?? category,
    amount
  })).sort((a, b) => b.amount - a.amount).slice(0, limit);
}
function describeActivity(entry) {
  const db = getDb();
  if (entry.entityType === "transaction" && entry.action === "create") {
    const txn = db.select({
      type: transactions.type,
      amount: transactions.amount,
      category: transactions.category
    }).from(transactions).where(drizzleOrm.eq(transactions.id, entry.entityId)).get();
    if (!txn) return null;
    const isEntry = txn.type === "entry";
    return {
      kind: isEntry ? "cash_entry" : "cash_exit",
      title: isEntry ? "Paiement enregistré" : "Dépense enregistrée",
      description: `${CASH_CATEGORY_LABELS[txn.category] ?? txn.category} — par ${entry.userFullName}`,
      amount: txn.amount
    };
  }
  if (entry.entityType === "transaction" && entry.action === "cancel") {
    const txn = db.select({ amount: transactions.amount }).from(transactions).where(drizzleOrm.eq(transactions.id, entry.entityId)).get();
    return {
      kind: "cash_cancelled",
      title: "Opération annulée",
      description: `Annulation par ${entry.userFullName}`,
      amount: txn?.amount ?? null
    };
  }
  if (entry.entityType === "student" && entry.action === "create") {
    const student = db.select({
      firstName: students.firstName,
      lastName: students.lastName,
      matricule: students.matricule
    }).from(students).where(drizzleOrm.eq(students.id, entry.entityId)).get();
    if (!student) return null;
    return {
      kind: "student_enrolled",
      title: "Nouvel élève inscrit",
      description: `${student.lastName} ${student.firstName} — matricule ${student.matricule}`,
      amount: null
    };
  }
  if (entry.entityType === "employee" && entry.action === "paySalary") {
    const employee = db.select({ firstName: employees.firstName, lastName: employees.lastName }).from(employees).where(drizzleOrm.eq(employees.id, entry.entityId)).get();
    if (!employee) return null;
    const details = entry.details;
    return {
      kind: "salary_paid",
      title: "Salaire versé",
      description: `${employee.lastName} ${employee.firstName} — par ${entry.userFullName}`,
      amount: details?.amount ?? null
    };
  }
  if (entry.entityType === "user" && entry.action === "login") {
    return {
      kind: "user_login",
      title: "Utilisateur connecté",
      description: entry.userFullName,
      amount: null
    };
  }
  return {
    kind: "other",
    title: `${entry.action} — ${entry.entityType}`,
    description: entry.userFullName,
    amount: null
  };
}
function computeRecentActivity(limit = 5) {
  const entries = listRecent(limit);
  const items = [];
  for (const entry of entries) {
    const described = describeActivity(entry);
    if (!described) continue;
    items.push({ id: entry.id, createdAt: entry.createdAt, ...described });
  }
  return items;
}
function computeAlerts(now, schoolYearId) {
  const db = getDb();
  const alerts = [];
  const arrears = getArrearsStudents();
  if (arrears.length > 0) {
    alerts.push({
      id: "arrears",
      severity: "warning",
      title: "Paiements en attente",
      description: `${arrears.length} élève${arrears.length > 1 ? "s" : ""} avec des arriérés de paiement`,
      link: "/cashbox/reports"
    });
  }
  if (schoolYearId) {
    const todayKey = toDateKey(now);
    const windowEnd = new Date(now);
    windowEnd.setDate(windowEnd.getDate() + UPCOMING_DUE_WINDOW_DAYS);
    const windowEndKey = toDateKey(windowEnd);
    const upcoming = db.select({ dueDate: tuitionInstallments.dueDate }).from(tuitionInstallments).innerJoin(tuitionSchedules, drizzleOrm.eq(tuitionSchedules.id, tuitionInstallments.scheduleId)).where(
      drizzleOrm.and(
        drizzleOrm.eq(tuitionSchedules.schoolYearId, schoolYearId),
        drizzleOrm.gte(tuitionInstallments.dueDate, todayKey),
        drizzleOrm.lte(tuitionInstallments.dueDate, windowEndKey)
      )
    ).all();
    if (upcoming.length > 0) {
      alerts.push({
        id: "upcoming-due",
        severity: "info",
        title: "Échéances à venir",
        description: `${upcoming.length} échéance${upcoming.length > 1 ? "s" : ""} dans les ${UPCOMING_DUE_WINDOW_DAYS} prochains jours`,
        link: "/settings"
      });
    }
  }
  const salaryStatus = getSalaryStatus(now.getMonth() + 1, now.getFullYear());
  const unpaidCount = salaryStatus.filter((s) => !s.isPaid).length;
  if (unpaidCount > 0) {
    alerts.push({
      id: "unpaid-salaries",
      severity: "warning",
      title: "Salaires du mois en attente",
      description: `${unpaidCount} salaire${unpaidCount > 1 ? "s" : ""} non encore versé${unpaidCount > 1 ? "s" : ""} ce mois-ci`,
      link: "/personnel/salaries"
    });
  }
  return alerts;
}
function getStats() {
  const now = /* @__PURE__ */ new Date();
  const schoolYear = getCurrentSchoolYear();
  const schoolYearId = schoolYear?.id ?? null;
  const recoveryStats = getGlobalRecoveryStats();
  const rate = recoveryStats.totalExpected > 0 ? recoveryStats.totalPaid / recoveryStats.totalExpected * 100 : 0;
  return {
    kpis: computeKpis(now, schoolYear),
    cashEvolution: computeCashEvolution(now, schoolYearId),
    categoryBreakdown: computeCategoryBreakdown(now, schoolYearId),
    classStats: computeClassStats(schoolYearId),
    recoveryRate: {
      rate,
      totalExpected: recoveryStats.totalExpected,
      totalPaid: recoveryStats.totalPaid
    },
    topExpenses: computeTopExpenses(now, schoolYearId),
    recentActivity: computeRecentActivity(),
    alerts: computeAlerts(now, schoolYearId)
  };
}
function registerDashboardIpcHandlers() {
  electron.ipcMain.handle(IPC_CHANNELS.dashboard.getStats, async () => {
    return getStats();
  });
}
function registerAllIpcHandlers() {
  registerSystemIpcHandlers();
  registerLicenseIpcHandlers();
  registerStudentsIpcHandlers();
  registerCashboxIpcHandlers();
  registerPersonnelIpcHandlers();
  registerSettingsIpcHandlers();
  registerAuthIpcHandlers();
  registerPrinterIpcHandlers();
  registerBackupIpcHandlers();
  registerDashboardIpcHandlers();
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  electronApp.setAppUserModelId("com.academyflow.app");
  electron.app.on("browser-window-created", (_, window) => {
    optimizer.watchWindowShortcuts(window);
  });
  loadEnvFile();
  try {
    initDatabase();
  } catch (error) {
    console.error("[database] Échec de l'initialisation de la base de données :", error);
  }
  touchClockRatchet();
  registerAllIpcHandlers();
  initAutoBackupScheduler();
  resyncLicense().catch((error) => {
    console.warn("[license] Resynchronisation au démarrage échouée (hors-ligne ?) :", error);
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  stopAutoBackupScheduler();
  closeConnection();
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
