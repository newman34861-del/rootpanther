import type { ConnectionMethod, HelpLevel, Provider, SelectOption } from "@rootpanther/ui";
import { currentUser, sessionHistory } from "./account";
import { daysAgo, hoursAgo, minutesAgo } from "./time";

export interface Profile {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  country: string | null;
  handle: string | null;
  avatarUrl: string | null;
  initials: string;
  memberSince: string;
}

export const profile: Profile = {
  id: currentUser.id,
  name: currentUser.name,
  email: currentUser.email,
  emailVerified: true,
  country: "GB",
  handle: currentUser.handle ?? null,
  avatarUrl: null,
  initials: currentUser.initials,
  memberSince: daysAgo(214),
};

export const freshProfile: Profile = {
  ...profile,
  country: null,
  handle: null,
  memberSince: minutesAgo(6),
};

export const TAKEN_HANDLES = ["admin", "root", "onyx", "support", "rootpanther", "kali", "operator", "dana", "reyes", "h4x0r"];

const COUNTRY_CODES =
  "AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD GE GH GM GN GQ GR GT GW GY HK HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KR KW KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MO MR MT MU MV MW MX MY MZ NA NE NG NI NL NO NP NR NZ OM PA PE PG PH PK PL PR PS PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TW TZ UA UG US UY UZ VA VC VE VN VU WS XK YE ZA ZM ZW";

export const COUNTRIES: SelectOption[] = (() => {
  const names = new Intl.DisplayNames(["en-GB"], { type: "region" });
  return COUNTRY_CODES.split(" ")
    .map((code) => ({ value: code, label: names.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label, "en-GB"));
})();

export const accountFootprint = {
  labSessions: sessionHistory.length,
  proofs: 10,
  reports: 4,
  debriefs: 5,
  onyxConversations: 23,
};

export type TerminalTheme = "deep-space" | "high-contrast" | "paper";

export const TERMINAL_THEMES: { value: TerminalTheme; label: string }[] = [
  { value: "deep-space", label: "Deep Space" },
  { value: "high-contrast", label: "Deep Space, high contrast" },
  { value: "paper", label: "Paper" },
];

export interface EmailPreferences {
  sessionExpiry: boolean;
  debriefReady: boolean;
  newScenarios: boolean;
  billing: boolean;
}

export interface Preferences {
  helpDefault: HelpLevel;
  terminalFontSize: number;
  terminalTheme: TerminalTheme;
  email: EmailPreferences;
}

export const preferences: Preferences = {
  helpDefault: currentUser.helpDefault,
  terminalFontSize: 14,
  terminalTheme: "deep-space",
  email: { sessionExpiry: true, debriefReady: true, newScenarios: false, billing: true },
};

export type DeviceKind = "desktop" | "mobile" | "terminal";

export interface ActiveSession {
  id: string;
  device: string;
  kind: DeviceKind;
  location: string;
  ip: string;
  lastActive: string;
  current?: boolean;
}

export const activeSessions: ActiveSession[] = [
  { id: "aus_9Fq2Lx", device: "Chrome 129 on macOS 15", kind: "desktop", location: "London, United Kingdom", ip: "203.0.113.24", lastActive: minutesAgo(0), current: true },
  { id: "aus_8Tz4Wd", device: "Firefox 131 on Kali Linux", kind: "terminal", location: "London, United Kingdom", ip: "203.0.113.24", lastActive: hoursAgo(2) },
  { id: "aus_7Kc1Rb", device: "Safari on iOS 18", kind: "mobile", location: "Manchester, United Kingdom", ip: "2001:db8:4f1:9c00::2b", lastActive: daysAgo(3, 8) },
  { id: "aus_5Hn8Pe", device: "Edge 129 on Windows 11", kind: "desktop", location: "Amsterdam, Netherlands", ip: "198.51.100.77", lastActive: daysAgo(12, 14) },
];

export interface ConnectedAccount {
  provider: Provider;
  linked: boolean;
  account?: string;
  linkedAt?: string;
}

export const connectedAccounts: ConnectedAccount[] = [
  { provider: "google", linked: true, account: currentUser.email, linkedAt: daysAgo(214) },
  { provider: "microsoft", linked: false },
  { provider: "github", linked: true, account: "dreyes", linkedAt: daysAgo(130) },
];

export interface SecurityState {
  hasPassword: boolean;
  passwordChangedAt?: string;
  twoFactor: { enabled: boolean; enabledAt?: string; codesLeft?: number };
  sessions: ActiveSession[];
  accounts: ConnectedAccount[];
}

export const security: SecurityState = {
  hasPassword: true,
  passwordChangedAt: daysAgo(96),
  twoFactor: { enabled: true, enabledAt: daysAgo(61), codesLeft: 8 },
  sessions: activeSessions,
  accounts: connectedAccounts,
};

export const providerOnlySecurity: SecurityState = {
  hasPassword: false,
  twoFactor: { enabled: false },
  sessions: activeSessions.slice(0, 1),
  accounts: [
    { provider: "google", linked: false },
    { provider: "microsoft", linked: false },
    { provider: "github", linked: true, account: "dreyes", linkedAt: minutesAgo(6) },
  ],
};

const TOTP_SECRET = "2ZWE2RLRB75Y77ACF6ZPTGNQXEBIVNIQ";

export const totpSetup = {
  secret: TOTP_SECRET,
  otpauth: `otpauth://totp/Rootpanther:${encodeURIComponent(currentUser.email)}?secret=${TOTP_SECRET}&issuer=Rootpanther&algorithm=SHA1&digits=6&period=30`,
  rejectedCode: "000000",
};

export const recoveryCodes = ["s7es-8ywn", "6k38-63b4", "2ucg-nsfn", "7e2p-w4f2", "j8pc-u3zp", "24dv-a3bj", "n3mj-bfrw", "xa9t-eegv", "f75w-5qns", "3rbh-66z3"];

export const regeneratedCodes = ["gdj3-7rg4", "hsbt-u5yf", "6t65-btwr", "ruc4-h8z6", "726t-pjed", "29uy-6dz9", "ejs8-t88d", "h9vy-xx3a", "yyb2-zq8k", "p7hm-tykx"];

export type TeardownPolicy = "idle" | "leave" | "max-life";

export interface LabDefaults {
  connection: ConnectionMethod;
  teardown: TeardownPolicy;
  sshKey: string;
}

export const labDefaults: LabDefaults = {
  connection: currentUser.connectionDefault,
  teardown: "idle",
  sshKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBx4LwsGRmL4Y1X+zt1Bfpkl+hstUO29CLp3oVILf+3T dana@kali",
};

export const sessionLimits = {
  idleMinutes: 30,
  maxLifeHours: 4,
  leaveGraceMinutes: 5,
  warningMinutes: 2,
};

export const authMock = {
  email: currentUser.email,
  attemptsBeforeLock: 5,
  lockMinutes: 15,
  codeAttempts: 5,
  resendCooldown: 30,
  resetLinkMinutes: 30,
  verifyLinkHours: 24,
};

export const BREACHED_PASSWORDS = [
  "password1234",
  "password12345",
  "qwerty123456",
  "qwertyuiop12",
  "123456789012",
  "iloveyou1234",
  "welcome12345",
  "letmein12345",
  "administrator1",
  "changeme1234",
  "trustno1trustno1",
  "football1234",
  "baseball1234",
  "monkey123456",
  "sunshine1234",
  "princess1234",
  "abc123456789",
  "summer2026summer",
  "correcthorsebatterystaple",
  "offsecoscp123",
];
