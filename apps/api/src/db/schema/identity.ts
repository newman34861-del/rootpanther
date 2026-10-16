import { boolean, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * Every account is an organisation, including a single learner. A personal org of one
 * costs nothing now and is what lets team seats be sold later without a data migration.
 */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").notNull(),
    name: text("name").notNull(),
    personal: boolean("personal").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => ({
    publicIdKey: uniqueIndex("organizations_public_id_key").on(t.publicId),
  }),
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    publicId: text("public_id").notNull(),
    email: text("email").notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    pendingEmail: text("pending_email"),
    name: text("name").notNull(),
    handle: text("handle"),
    country: text("country"),
    avatarUrl: text("avatar_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
    /** Deletion is scheduled, not immediate, so the learner has a window to cancel. */
    deletionScheduledFor: timestamp("deletion_scheduled_for", { withTimezone: true }),
  },
  (t) => ({
    emailKey: uniqueIndex("users_email_key").on(t.email),
    handleKey: uniqueIndex("users_handle_key").on(t.handle),
    publicIdKey: uniqueIndex("users_public_id_key").on(t.publicId),
  }),
);

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("learner"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgUserKey: uniqueIndex("memberships_org_user_key").on(t.orgId, t.userId),
    userIdx: index("memberships_user_idx").on(t.userId),
  }),
);

/** Password credentials are separate from users so a provider-only account simply has none. */
export const credentials = pgTable(
  "credentials",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    accountLabel: text("account_label"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerKey: uniqueIndex("oauth_provider_account_key").on(t.provider, t.providerAccountId),
    userIdx: index("oauth_user_idx").on(t.userId),
  }),
);

export const totpSecrets = pgTable("totp_secrets", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  enabledAt: timestamp("enabled_at", { withTimezone: true }),
});

export const recoveryCodes = pgTable(
  "recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
  },
  (t) => ({ userIdx: index("recovery_codes_user_idx").on(t.userId) }),
);

/** One row per signed-in browser. Revoking a session is deleting its row. */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    device: text("device"),
    kind: text("kind"),
    location: text("location"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set when an operator is acting as this user, so the UI can show the banner. */
    impersonatedBy: uuid("impersonated_by").references(() => users.id),
  },
  (t) => ({
    tokenKey: uniqueIndex("auth_sessions_token_key").on(t.tokenHash),
    userIdx: index("auth_sessions_user_idx").on(t.userId),
  }),
);

export const emailTokens = pgTable(
  "email_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: text("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => ({
    tokenKey: uniqueIndex("email_tokens_token_key").on(t.tokenHash),
    userPurposeIdx: index("email_tokens_user_purpose_idx").on(t.userId, t.purpose),
  }),
);

/**
 * Settings that belong to the person rather than the organisation, which is why neither
 * of these carries org_id. A learner who later joins a team keeps their own help level,
 * terminal size and SSH key.
 */
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  helpDefault: text("help_default").notNull().default("nudge"),
  terminalFontSize: integer("terminal_font_size").notNull().default(14),
  terminalTheme: text("terminal_theme").notNull().default("deep-space"),
  emailSessionExpiry: boolean("email_session_expiry").notNull().default(true),
  emailDebriefReady: boolean("email_debrief_ready").notNull().default(true),
  emailNewScenarios: boolean("email_new_scenarios").notNull().default(false),
  emailBilling: boolean("email_billing").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const labDefaults = pgTable("lab_defaults", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  connection: text("connection").notNull().default("openvpn"),
  teardown: text("teardown").notNull().default("idle"),
  sshKey: text("ssh_key"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Lockout state is per identifier, so an unknown email cannot be used to probe accounts. */
export const loginAttempts = pgTable(
  "login_attempts",
  {
    identifier: text("identifier").primaryKey(),
    failures: integer("failures").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);
