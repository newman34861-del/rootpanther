import type { HelpLevel, OnyxCommand, OnyxMessageData, TechniqueFamily, TierCode } from "@rootpanther/ui";
import { daysAgo, hoursAgo, minutesAgo } from "./time";

export interface ChatContext {
  topic: string;
  ladder: number;
}

export interface ChatRequest {
  text: string;
  command?: OnyxCommand;
  level: HelpLevel;
  ctx: ChatContext;
}

export interface ChatReply {
  text: string;
  code?: string;
  hintStep?: { step: number; of: number };
  ctx?: Partial<ChatContext>;
}

export const HINT_STEPS = 4;

export const COMMAND_PROMPT: Record<OnyxCommand, string> = {
  hint: "Hint for the current blocker.",
  why: "Why does this step matter?",
  check: "Check my current approach.",
  stuck: "I am stuck.",
  explain: "Explain the last output.",
  methodology: "Where am I in the method?",
  teach: "Teach me this technique.",
  walkthrough: "Walk me through this step.",
  review: "Review my notes.",
  note: "Save the last command and output.",
};

export function hintReply(ladder: string[], level: HelpLevel, current: number, walkCode?: string): ChatReply {
  if (level === "shadow") {
    return { text: "Shadow answers direct methodology questions only, so there are no hints at this level. Raise the dial to Nudge or above." };
  }
  if (level === "nudge" && current >= 2) {
    return { text: "Nudge stops at hint 2 of 4. Raise the dial to Coach for the next hint on this blocker.", hintStep: { step: current, of: HINT_STEPS } };
  }
  if (current >= HINT_STEPS) {
    return {
      text: "That was the last hint for this blocker. Tell me what you tried after it, or raise the dial to Walkthrough for the concrete steps.",
      hintStep: { step: HINT_STEPS, of: HINT_STEPS },
      code: level === "walkthrough" ? walkCode : undefined,
    };
  }
  const step = current + 1;
  return { text: ladder[step - 1], hintStep: { step, of: HINT_STEPS }, ctx: { ladder: step }, code: level === "walkthrough" ? walkCode : undefined };
}

interface MentorTopic {
  match: RegExp;
  answer: string;
  why: string;
  teach: string;
  ladder?: string[];
  walk?: string;
  primer?: string;
}

const CREDS_LADDER = [
  "Before trying anything new, check the credential you already hold against every host and every service that accepts domain logons. Write down each result, failures included.",
  "Ask the domain what any user can see. Accounts with a service principal name and accounts that skip Kerberos pre-authentication are the two lists to build first.",
  "Collect BloodHound data and mark your user as owned. Look for paths from owned principals. If nothing comes back, check what your user and each of its groups can control.",
  "Last hint for this blocker: when no path exists, the missing piece is usually another credential. Re-read every share and file your user can reach for scripts and config backups.",
];

const CREDS_WALK = ["nmap -sV -p 88,135,389,445,1433,3389,5985 <subnet>", "whoami /groups", "net user <user> /domain"].join("\n");

const TOPICS: Record<string, MentorTopic> = {
  creds: {
    match: /\b(creds?|credentials?|next step|foothold|domain user)\b/i,
    answer:
      "Turn the credential into a table before you act on it. Record where it works on each host and service, what it can read in the directory, and which accounts look like service accounts.\n\nThen collect BloodHound data and ask one question: what is the shortest path from what I own to what I need?",
    why: "Every later step depends on knowing exactly where a credential works. Skipping the table is how people miss a remote logon that was available from the start.",
    teach: "A domain credential gives you read access to most of the directory. The useful reads are service principal names, pre-authentication flags, group memberships, permissions on objects and delegation settings. The BloodHound primer covers how to turn that data into a path.",
    ladder: CREDS_LADDER,
    walk: CREDS_WALK,
    primer: "bloodhound",
  },
  kerberoast: {
    match: /kerberoast|\bspn\b|\btgs\b|service ticket/i,
    answer:
      "Kerberoasting works because any domain user can request a service ticket for an account with an SPN, and part of that ticket is protected by a key derived from the account's password. The guessing happens offline, so the service never sees a failed logon.\n\nIf an account does not fall quickly, check the ticket's encryption type before spending more time. RC4 is weak, AES is not.",
    why: "Human-managed service accounts often have old, memorable passwords and broad rights. One weak service account can skip several hosts.",
    teach: "The service portion of a ticket is encrypted with the service account's key. For RC4 that key comes straight from the password, so a weak password means a weak ticket. AES keys are salted and slow to derive, which is why AES tickets resist offline guessing.",
    ladder: [
      "Check the encryption type recorded in the ticket. RC4 tickets are the realistic target. AES tickets usually are not, in lab time.",
      "Look at which SPN accounts are privileged before choosing one. A weak password on an unprivileged account does not move you forward.",
      "Check each candidate's password age. An account whose password has not changed in years is the one the scenario author expects you to notice.",
      "Last hint for this blocker: if your chosen account does not fall within your time box, it is probably not the intended path. Go back to BloodHound and compare the candidates' group memberships.",
    ],
    walk: ["(&(samAccountType=805306368)(servicePrincipalName=*))", "", "Attributes to read for each result:", "  memberOf, pwdLastSet, msDS-SupportedEncryptionTypes"].join("\n"),
    primer: "kerberoasting",
  },
  bloodhound: {
    match: /bloodhound|\bpath\b|\bedges?\b|genericwrite|genericall|writedacl|\bacl\b/i,
    answer:
      "Read a path left to right as a list of actions. MemberOf costs nothing. GenericWrite, WriteDacl and ForceChangePassword each mean one action you must perform and document.\n\nMark nodes as owned as you go, then look for paths from owned principals again.",
    why: "A path you cannot explain edge by edge is a path you cannot write up. Reading edges as actions keeps the report honest.",
    teach: "Edges fall into three groups: inherited (MemberOf), object control (GenericAll, GenericWrite, WriteDacl, WriteOwner, ForceChangePassword, AddMember) and access (AdminTo, CanPSRemote, CanRDP, HasSession). Only object control and access edges cost you an action.",
    primer: "bloodhound",
  },
  delegation: {
    match: /delegat|s4u|allowedtodelegate|rbcd/i,
    answer:
      "Check three attributes: TRUSTED_FOR_DELEGATION in userAccountControl for unconstrained, msDS-AllowedToDelegateTo for constrained, and msDS-AllowedToActOnBehalfOfOtherIdentity for resource-based. Each changes who an account can act as, and towards which service.",
    why: "Delegation lets one account act as another. Finding it early tells you which service account is worth more than it looks.",
    teach: "Constrained delegation rests on two Kerberos extensions. S4U2Self lets a service obtain a ticket to itself on behalf of a user. S4U2Proxy lets it forward that ticket to a service listed in msDS-AllowedToDelegateTo. Whoever controls the delegating account inherits that ability.",
    primer: "delegation",
  },
  pivot: {
    match: /pivot|ligolo|chisel|tunnel|internal subnet|socks/i,
    answer:
      "Treat a pivot as a route, not a tool. Write down which subnet sits behind which host, then prove reachability with one known port before scanning. Scan slowly through a tunnel: aggressive timing drops probes and reports open ports as filtered.",
    why: "Most lost time after a foothold comes from scanning an internal subnet badly and trusting the result.",
    teach: "A pivot gives you either a routed interface, where tools work unchanged, or a SOCKS proxy, where each tool must be pointed at the proxy and only TCP connect scans work. Choose based on how many tools you need to run through it.",
  },
  linux: {
    match: /linux|suid|sudo|cron|capabilit/i,
    answer:
      "Enumerate in this order: what you can run as someone else, what runs on a schedule, what is writable that something privileged reads, then credentials on disk. Most C1 and C2 hosts fall to the first two.",
    why: "Privilege escalation is mostly reading. A fixed order stops you from reaching for kernel issues before checking sudo rights.",
    teach: "SUID binaries, sudo rules and file capabilities all let you run code as another user. Many common binaries can start other programs, which is why a permissive rule on one is often equivalent to a root shell. Writable scripts called by root on a schedule are the next most common route.",
    ladder: [
      "Start with what your user can already run as someone else: sudo rules, SUID binaries and file capabilities.",
      "Look at what runs on a schedule. Jobs that call scripts you can write are common at C1 and C2.",
      "Check for credentials left on disk: application configs, shell history and backup archives. A reused password often skips the escalation entirely.",
      "Last hint for this blocker: for each SUID binary and sudo rule, ask whether that binary can start another program. If it can, that is your route.",
    ],
    walk: ["sudo -l", "find / -perm -4000 -type f 2>/dev/null", "getcap -r / 2>/dev/null", "cat /etc/crontab; ls -la /etc/cron.d"].join("\n"),
  },
  windows: {
    match: /windows|seimpersonate|potato|unquoted|service path|whoami \/priv/i,
    answer:
      "Start with your token. Privileges such as SeImpersonatePrivilege or SeBackupPrivilege often decide the route before you look at services. Then check services you can modify, unquoted service paths and stored credentials.",
    why: "Service accounts on Windows frequently hold impersonation privileges by design. Checking the token first saves an hour of service enumeration.",
    teach: "SeImpersonatePrivilege lets a process act with any token it can obtain a handle to. If a more privileged process can be made to authenticate to yours, that token becomes usable. The privilege only needs to be present, not enabled.",
  },
  report: {
    match: /report|notes?|document|screenshot|evidence|finding/i,
    answer:
      "A finding needs four parts: what is wrong, where it is, how you proved it with the exact command and output, and the fix. Capture evidence as you go with note in the lab. Reconstructing it afterwards is where most reports lose marks.",
    why: "The exam is scored on proofs and a report that reproduces them. A proof without a reproducible path is worth less than it looks.",
    teach: "Write each step as command, output and reason. The reason is the line most people skip, and it is the line a reviewer checks to see whether you understood the step or got lucky.",
  },
  exam: {
    match: /\bexam\b|time box|24 ?h|hours|plan my|schedule/i,
    answer:
      "Spend the first hour enumerating every host, not the first promising one. Time box each host at about 90 minutes before you rotate, and write notes before you move. Points come from proofs plus a report that reproduces them.",
    why: "Rotation stops one hard host from eating the whole run. Notes written at rotation are the cheapest report you will ever write.",
    teach: "Plan the run in blocks: enumeration of everything, the AD set while you are fresh, standalones in order of exposed attack surface, then a fixed report block. Granite and Obsidian simulate this with Onyx locked to Exam sim.",
  },
  asrep: {
    match: /as-?rep|preauth|pre-auth/i,
    answer:
      "Accounts with Kerberos pre-authentication disabled will answer an authentication request from anyone, and part of that answer is protected by the user's key. It needs only a username, which is why it works before you hold any credential.",
    why: "It is one of the few domain weaknesses you can find from a username list alone.",
    teach: "Pre-authentication proves you know the user's key before the KDC answers. With DONT_REQ_PREAUTH set, that proof is skipped, so the reply becomes something anyone can collect and guess against offline.",
    primer: "kerberoasting",
  },
};

const DEFAULT_TOPIC: MentorTopic = {
  match: /$^/,
  answer: "Mentor mode has no live lab, so I answer from general methodology. Give me the host OS, the access you hold and the last two things you tried, and I will point at the gap.",
  why: "Without a lab I cannot see which step you are on. Tell me the host and the access you hold and I will explain why the next step matters.",
  teach: "Pick a technique and I will go deeper, or open a primer. Primers cover Kerberoasting, BloodHound paths and delegation at your tier.",
  ladder: CREDS_LADDER,
  walk: CREDS_WALK,
};

function looksPasted(text: string) {
  return text.includes("\n") && /(\$ |# |PS [A-Z]:\\|\[\*\]|\[\+\]|Nmap scan report|SMB\s)/.test(text);
}

export function mentorReply({ text, command, level, ctx }: ChatRequest): ChatReply {
  const topic = TOPICS[ctx.topic] ?? DEFAULT_TOPIC;
  const ladderTopic = topic.ladder ? topic : TOPICS.creds;

  if (!command) {
    if (looksPasted(text)) {
      return { text: "I can read pasted output, but in mentor mode I do not know which host it came from or what you expected to see. Tell me the command, the host and what you were testing." };
    }
    const hit = Object.entries(TOPICS).find(([, t]) => t.match.test(text));
    if (!hit) return { text: DEFAULT_TOPIC.answer };
    const [key, t] = hit;
    const nextLadder = t.ladder ? key : "creds";
    const currentLadder = topic.ladder ? ctx.topic : "creds";
    return { text: t.answer, ctx: { topic: key, ladder: nextLadder === currentLadder ? ctx.ladder : 0 } };
  }

  switch (command) {
    case "hint":
      return hintReply(ladderTopic.ladder!, level, ctx.ladder, ladderTopic.walk);
    case "why":
      return { text: topic.why };
    case "check":
      return { text: "There is no live lab in mentor mode, so I cannot check against real output. Paste the command and its output and say what you expected." };
    case "stuck":
      return { text: "Tell me three things: the host and its OS, the access you hold now, and the last two things you tried. Being stuck usually means one enumeration step was skipped, not that the technique is unknown." };
    case "explain":
      return { text: "Paste the output you want explained. I will go through it line by line and point at what matters for the next step." };
    case "methodology":
      return {
        text: "The order I hold you to:\n\n1. Enumerate every reachable host and service before acting on any of them.\n\n2. Turn each finding into a hypothesis and test the cheapest one first.\n\n3. After every new access, enumerate again from the new position.\n\n4. Record command, output and reason as you go.",
      };
    case "teach":
      return { text: topic.primer ? `${topic.teach}\n\nThe ${PRIMER_TITLE[topic.primer]} primer covers this in full.` : topic.teach };
    case "walkthrough":
      return { text: "Concrete steps for the current blocker. Replace the placeholders with your own values, run them in order and note what each one shows.", code: ladderTopic.walk };
    case "review":
      return { text: "Review checks a report draft for reproducibility. Open a report from Reports and run review there, or paste a finding here and I will check it has all four parts." };
    case "note":
      return { text: "Notes save terminal output to a report's evidence tray, so they need a running lab. In mentor mode, paste anything you want to keep into a report draft." };
    default:
      return { text: DEFAULT_TOPIC.answer };
  }
}

export const MENTOR_START: ChatContext = { topic: "creds", ladder: 1 };

export const mentorTranscript: OnyxMessageData[] = [
  { id: "m1", role: "system", text: "Mentor session started. Help level: Coach", at: minutesAgo(14) },
  {
    id: "m2",
    role: "you",
    text: "I have valid domain credentials on a practice set and no obvious next step. How do I avoid wandering?",
    at: minutesAgo(14),
  },
  { id: "m3", role: "onyx", text: TOPICS.creds.answer, at: minutesAgo(13) },
  { id: "m4", role: "you", text: COMMAND_PROMPT.hint, command: "hint", at: minutesAgo(9) },
  { id: "m5", role: "onyx", text: CREDS_LADDER[0], hintStep: { step: 1, of: HINT_STEPS }, at: minutesAgo(9) },
];

export const suggestedQuestions = [
  "How do I pick which Kerberoastable account to focus on?",
  "How should I read a BloodHound path before acting on it?",
  "What changes when an account is trusted for constrained delegation?",
  "How do I scan an internal subnet through a pivot without losing results?",
  "What should a finding in my report contain?",
  "How should I split 24 hours across an exam simulation?",
];

export type PrimerBlock =
  | { kind: "p"; text: string }
  | { kind: "code"; code: string; label?: string; prompt?: string }
  | { kind: "list"; items: string[] }
  | { kind: "note"; text: string };

export interface PrimerSection {
  id: string;
  title: string;
  blocks: PrimerBlock[];
}

export interface Primer {
  id: string;
  title: string;
  family: TechniqueFamily;
  tier: TierCode;
  minutes: number;
  progress: number;
  summary: string;
  scenarios?: string[];
  sections: PrimerSection[];
}

export const primers: Primer[] = [
  {
    id: "web-to-shell",
    title: "From web input to a foothold",
    family: "web-to-shell",
    tier: "C1",
    minutes: 8,
    progress: 1,
    summary: "Confirm an injection point, prove execution with evidence, and record it so it reproduces.",
    scenarios: ["halcyon", "lattice", "basalt"],
    sections: [
      {
        id: "confirm",
        title: "Confirm before you go further",
        blocks: [
          { kind: "p", text: "Every web foothold starts with a behaviour you can reproduce: a parameter that changes the response in a way the developer did not intend. Prove it with the smallest input that shows it, and keep the request." },
          { kind: "list", items: ["Command injection: a measurable side effect, such as a response that is delayed by a fixed amount.", "Template injection: an expression whose evaluated result differs from its text.", "File upload: a file that is stored where you can request it and is processed, not just downloaded."] },
        ],
      },
      {
        id: "evidence",
        title: "Capture the raw response",
        blocks: [
          { kind: "p", text: "The browser renders and sometimes rewrites what the server sent. Keep the raw request and response, because that is what a reviewer will reproduce." },
          { kind: "code", label: "Raw response with headers", prompt: "$", code: "curl -s -i \"http://<target>/<path>?<param>=<value>\"" },
        ],
      },
    ],
  },
  {
    id: "service-exploitation",
    title: "Matching services to known issues",
    family: "service-exploitation",
    tier: "C1",
    minutes: 7,
    progress: 1,
    summary: "Read a banner, pin the version, and judge a public advisory before acting on it.",
    scenarios: ["kestrel", "tamarack"],
    sections: [
      {
        id: "version",
        title: "Get an exact version",
        blocks: [
          { kind: "p", text: "A service name is not enough. You need the product, the version and ideally the build. Banners, HTTP headers, login pages and default files all leak it." },
          { kind: "code", label: "Version detection", prompt: "$", code: "nmap -sV -sC -p <ports> <target>" },
        ],
      },
      {
        id: "judge",
        title: "Read before you run",
        blocks: [{ kind: "p", text: "Public code is written for one environment. Read it, find what it assumes about paths, ports and versions, and decide whether those assumptions hold here. Note what it does to the service: some issues crash it and the lab must be reset." }],
      },
    ],
  },
  {
    id: "linux-privesc",
    title: "Linux privilege escalation order",
    family: "linux-privesc",
    tier: "C1",
    minutes: 10,
    progress: 1,
    summary: "A fixed enumeration order that finds sudo, SUID, scheduled job and credential routes first.",
    scenarios: ["halcyon", "basalt", "juniper"],
    sections: [
      {
        id: "order",
        title: "Enumerate in a fixed order",
        blocks: [
          { kind: "list", items: ["What can I run as someone else: sudo rules, SUID binaries, file capabilities.", "What runs on a schedule: cron, systemd timers.", "What is writable that something privileged reads: scripts, configs, PATH entries.", "What credentials are on disk: application configs, history, backups."] },
          { kind: "code", label: "First pass", prompt: "$", code: "sudo -l\nfind / -perm -4000 -type f 2>/dev/null\ngetcap -r / 2>/dev/null\ncat /etc/crontab" },
        ],
      },
      {
        id: "judge",
        title: "Judge each binary",
        blocks: [{ kind: "p", text: "For every SUID binary and sudo rule, ask whether the binary can start another program, read arbitrary files or write arbitrary files. Pagers, editors, interpreters and archive tools usually can." }],
      },
    ],
  },
  {
    id: "windows-privesc",
    title: "Windows privileges and services",
    family: "windows-privesc",
    tier: "C1",
    minutes: 11,
    progress: 0.35,
    summary: "Token privileges, modifiable services, unquoted paths and stored credentials.",
    scenarios: ["kestrel", "tamarack"],
    sections: [
      {
        id: "tokens",
        title: "Read your token first",
        blocks: [
          { kind: "p", text: "Your groups and privileges decide which routes exist. Service accounts often hold SeImpersonatePrivilege, and that alone is usually a route to SYSTEM." },
          { kind: "code", label: "Orientation", prompt: "PS>", code: "whoami /all\nsysteminfo\nGet-CimInstance Win32_Service | Select-Object Name, StartName, PathName" },
        ],
      },
      {
        id: "services",
        title: "Services you can change",
        blocks: [
          { kind: "p", text: "A service runs a binary as its configured account. If you can change the binary, its path or its configuration, your code runs as that account on the next start." },
          { kind: "list", items: ["Unquoted paths with spaces and a writable directory on the path.", "Service binaries writable by Users or Authenticated Users.", "Service permissions that allow configuration changes."] },
        ],
      },
    ],
  },
  {
    id: "kerberoasting",
    title: "Kerberoasting",
    family: "kerberoasting",
    tier: "C2",
    minutes: 9,
    progress: 1,
    summary: "Why service tickets for human-managed accounts become an offline password problem.",
    scenarios: ["meridian", "ironwood", "granite"],
    sections: [
      {
        id: "what",
        title: "What it is",
        blocks: [
          { kind: "p", text: "Any authenticated domain user can ask the KDC for a service ticket to any account that has a servicePrincipalName. Part of that ticket is encrypted with a key derived from the service account's password." },
          { kind: "p", text: "That makes the ticket an offline guessing target. The service never sees a connection and no failed logon is recorded, because nothing ever tries to log on." },
        ],
      },
      {
        id: "why",
        title: "Why it works",
        blocks: [
          { kind: "p", text: "Kerberos assumes a service key is long and random, which is true for computer accounts: their passwords are generated and rotated automatically. Service accounts managed by people break that assumption. Their passwords are set once, chosen to be remembered, and rarely rotated." },
          { kind: "note", text: "A ticket request is ordinary domain traffic. The request alone is not what defenders look for; the encryption type requested is." },
        ],
      },
      {
        id: "find",
        title: "Find candidates",
        blocks: [
          { kind: "p", text: "You want user accounts, not computers, with an SPN set. For each one, note its group memberships and when its password was last set. An old password on a privileged account is the candidate worth your time." },
          { kind: "code", label: "LDAP filter: user accounts with an SPN", code: "(&(samAccountType=805306368)(servicePrincipalName=*))" },
          { kind: "code", label: "Attributes to read for each result", code: "sAMAccountName\nservicePrincipalName\nmemberOf\npwdLastSet\nmsDS-SupportedEncryptionTypes" },
        ],
      },
      {
        id: "etype",
        title: "Encryption type decides the cost",
        blocks: [
          { kind: "p", text: "The ticket records which encryption type the KDC used. That one field tells you whether offline guessing is realistic in lab time." },
          { kind: "list", items: ["RC4 (etype 23): key derived directly from the password. Weak passwords fall quickly.", "AES128 and AES256 (etype 17 and 18): salted, slow to derive. Treat as out of reach unless the password is trivial.", "msDS-SupportedEncryptionTypes on the account shows which types it allows."] },
        ],
      },
      {
        id: "record",
        title: "What to write down",
        blocks: [{ kind: "list", items: ["The SPN and account, and how you found it.", "The encryption type of the ticket.", "How long recovery took and with what approach.", "Every place the recovered credential worked."] }],
      },
      {
        id: "defend",
        title: "How defenders close it",
        blocks: [{ kind: "p", text: "Group managed service accounts remove the human password entirely. Where that is not possible, long random passwords, AES-only encryption and alerting on RC4 service ticket requests make the attack slow and visible." }],
      },
    ],
  },
  {
    id: "bloodhound",
    title: "Reading BloodHound paths",
    family: "acl-abuse",
    tier: "C2",
    minutes: 12,
    progress: 0.6,
    summary: "Read a path as a list of actions, know which edges cost nothing, and avoid common misreads.",
    scenarios: ["meridian", "vesper"],
    sections: [
      {
        id: "model",
        title: "Nodes, edges and paths",
        blocks: [
          { kind: "p", text: "Nodes are users, groups, computers and domain objects. Edges are relationships an attacker can use. A path is a chain of edges from a principal you control to the one you need." },
          { kind: "p", text: "Read a path left to right. Each edge is either inherited, and costs nothing, or an action you must take and document." },
        ],
      },
      {
        id: "edges",
        title: "Edges you will meet at C2",
        blocks: [
          {
            kind: "list",
            items: [
              "MemberOf: you inherit the group's rights. No action.",
              "GenericAll: full control of the object.",
              "GenericWrite: write most attributes of the object.",
              "WriteDacl: rewrite the object's permissions.",
              "ForceChangePassword: reset the password without knowing the current one.",
              "AddMember: add any principal to the group.",
              "AdminTo and CanPSRemote: log on with admin rights or over WinRM.",
              "GetChanges plus GetChangesAll on the domain: replication rights.",
            ],
          },
        ],
      },
      {
        id: "example",
        title: "Reading a real path",
        blocks: [
          { kind: "code", label: "Shortest path from an owned user", code: "A.PATEL@CORP.LOCAL\n  └─ MemberOf ─► IT SUPPORT@CORP.LOCAL\n       └─ GenericWrite ─► SVC_BACKUP@CORP.LOCAL\n            └─ AdminTo ─► FS01.CORP.LOCAL" },
          { kind: "p", text: "Three edges, two actions. MemberOf is free. GenericWrite on SVC_BACKUP is the first action: taking control of that account. AdminTo is the second: logging on to FS01 as SVC_BACKUP. Your report needs both, with evidence." },
        ],
      },
      {
        id: "queries",
        title: "Queries worth running first",
        blocks: [
          { kind: "list", items: ["Shortest paths from owned principals to Domain Admins.", "Principals with replication rights on the domain.", "Kerberoastable users and their group memberships.", "Outbound object control for every principal you own."] },
          { kind: "code", label: "Cypher: owned users to Domain Admins", code: "MATCH p=shortestPath((u:User {owned:true})-[*1..]->(g:Group))\nWHERE g.name STARTS WITH 'DOMAIN ADMINS@'\nRETURN p" },
        ],
      },
      {
        id: "misreads",
        title: "Common misreads",
        blocks: [{ kind: "list", items: ["HasSession is a snapshot from collection time. Sessions end.", "A path through a computer you cannot reach from your foothold is not a path yet.", "Collection without session or local admin data has no AdminTo edges. Missing edges may just be uncollected.", "Mark nodes owned as you go, or shortest paths keep starting from the wrong place."] }],
      },
    ],
  },
  {
    id: "delegation",
    title: "Kerberos delegation",
    family: "delegation",
    tier: "C2",
    minutes: 14,
    progress: 0,
    summary: "Unconstrained, constrained and resource-based delegation, and what each one lets an account do.",
    scenarios: ["ironwood", "vesper"],
    sections: [
      {
        id: "problem",
        title: "The problem delegation solves",
        blocks: [{ kind: "p", text: "A front-end service sometimes needs to act as the user against a back end: a web application querying SQL Server with the user's identity. Delegation lets the front end obtain tickets on the user's behalf. There are three kinds, configured in three different places." }],
      },
      {
        id: "unconstrained",
        title: "Unconstrained delegation",
        blocks: [
          { kind: "p", text: "The account is trusted to receive users' ticket-granting tickets. Anyone who authenticates to a service on that host leaves a reusable ticket in its memory, so whoever controls the host can act as those users anywhere in the domain." },
          { kind: "code", label: "LDAP filter: accounts trusted for unconstrained delegation", code: "(userAccountControl:1.2.840.113556.1.4.803:=524288)" },
          { kind: "note", text: "Domain controllers have unconstrained delegation by design. Exclude them when you list candidates." },
        ],
      },
      {
        id: "constrained",
        title: "Constrained delegation",
        blocks: [
          { kind: "p", text: "msDS-AllowedToDelegateTo lists the services the account may delegate to. Two Kerberos extensions do the work. S4U2Self gets the service a ticket to itself on behalf of a user. S4U2Proxy exchanges that ticket for one to a listed service." },
          { kind: "p", text: "With protocol transition enabled, the service can act as a user who never authenticated to it at all. Accounts marked sensitive and members of Protected Users are excluded, which is why defenders put administrators there." },
          { kind: "code", label: "LDAP filter: accounts with constrained delegation", code: "(msDS-AllowedToDelegateTo=*)" },
        ],
      },
      {
        id: "rbcd",
        title: "Resource-based constrained delegation",
        blocks: [{ kind: "p", text: "Here the target decides who may delegate to it, through msDS-AllowedToActOnBehalfOfOtherIdentity on the target computer. Write access to that attribute is therefore as significant as delegation itself. The C3 primer covers it in full." }],
      },
      {
        id: "where",
        title: "Where to look first",
        blocks: [{ kind: "list", items: ["Service accounts you have just taken over: check msDS-AllowedToDelegateTo before anything else.", "Computers trusted for unconstrained delegation that are not domain controllers.", "Computer objects your principals can write to, for the resource-based variant."] }],
      },
    ],
  },
  {
    id: "token-privileges",
    title: "Windows token privileges",
    family: "local-privesc",
    tier: "C2",
    minutes: 8,
    progress: 0,
    summary: "Which Windows privileges matter for escalation and what each one implies.",
    scenarios: ["tamarack"],
    sections: [
      {
        id: "which",
        title: "Privileges that matter",
        blocks: [
          { kind: "list", items: ["SeImpersonatePrivilege: act with another process's token if you can obtain one.", "SeBackupPrivilege: read any file, regardless of its permissions.", "SeRestorePrivilege: write any file.", "SeDebugPrivilege: open any process.", "SeTakeOwnershipPrivilege: take ownership of any object."] },
          { kind: "code", label: "Read your privileges", prompt: "PS>", code: "whoami /priv" },
          { kind: "p", text: "A privilege listed as Disabled is still held. It only needs to be enabled before use." },
        ],
      },
    ],
  },
  {
    id: "pivoting",
    title: "Moving with credentials and pivots",
    family: "lateral-movement",
    tier: "C2",
    minutes: 10,
    progress: 0.2,
    summary: "Which logon types a credential allows, and how to reach an internal subnet through a foothold.",
    scenarios: ["meridian", "ironwood"],
    sections: [
      {
        id: "logons",
        title: "Logon types and what they need",
        blocks: [{ kind: "list", items: ["SMB with admin rights: remote administration of the host.", "WinRM (5985): Remote Management Users membership or local admin.", "RDP (3389): Remote Desktop Users. Interactive and visible to the user.", "MSSQL (1433): a database login, which may map to a domain account."] }],
      },
      {
        id: "pivot",
        title: "Reaching an internal subnet",
        blocks: [
          { kind: "p", text: "A routed pivot gives your attack box a path to the internal subnet, so your tools work unchanged. Prove reachability with one known port before scanning, and scan slowly." },
          { kind: "code", label: "Prove the route", prompt: "$", code: "ip route | grep 172.16\nnmap -Pn -p 445 <internal-target>" },
        ],
      },
    ],
  },
  {
    id: "replication",
    title: "Replication rights",
    family: "domain-dominance",
    tier: "C2",
    minutes: 7,
    progress: 0,
    summary: "Why replication rights on the domain object are equivalent to domain control.",
    scenarios: ["meridian"],
    sections: [
      {
        id: "rights",
        title: "The two rights",
        blocks: [
          { kind: "p", text: "Domain controllers replicate directory data, including secrets, with each other. Any principal holding both DS-Replication-Get-Changes and DS-Replication-Get-Changes-All on the domain object can ask for that same data." },
          { kind: "p", text: "That is why these rights sit at the end of so many BloodHound paths, and why defenders audit who holds them." },
          { kind: "note", text: "In a lab, take only what the objective needs. Your notes should not hold every user's secret." },
        ],
      },
    ],
  },
  {
    id: "rbcd",
    title: "Resource-based constrained delegation",
    family: "delegation",
    tier: "C3",
    minutes: 13,
    progress: 0,
    summary: "Why write access to a computer object can be as significant as delegation itself.",
    scenarios: ["vesper"],
    sections: [],
  },
  {
    id: "trusts",
    title: "Child and forest trusts",
    family: "trust-abuse",
    tier: "C3",
    minutes: 15,
    progress: 0,
    summary: "How trust direction, SID filtering and authentication scope decide what crosses a trust.",
    scenarios: ["cinder", "quarry"],
    sections: [],
  },
];

export const PRIMER_TITLE: Record<string, string> = Object.fromEntries(primers.map((p) => [p.id, p.title]));

export interface DrillQuestion {
  id: string;
  prompt: string;
  code?: string;
  options: string[];
  answer: number;
  explanation: string;
  monoOptions?: boolean;
}

export interface DrillSet {
  id: string;
  title: string;
  topic: string;
  minutes: number;
  best?: number;
  primer?: string;
  questions: DrillQuestion[];
}

export const drills: DrillSet[] = [
  {
    id: "hash-types",
    title: "Hash type identification",
    topic: "Password attacks",
    minutes: 6,
    best: 5,
    primer: "kerberoasting",
    questions: [
      {
        id: "h1",
        prompt: "A value starts with `$krb5tgs$23$`, followed by the account name and realm. What is it?",
        options: ["An NT hash", "A service ticket encrypted with RC4", "An AS-REP from an account without pre-authentication", "A NetNTLMv2 response"],
        answer: 1,
        explanation: "`krb5tgs` marks a service ticket and etype 23 is RC4.",
      },
      {
        id: "h2",
        prompt: "A value starts with `$krb5asrep$23$`. Which account setting made it collectable?",
        options: ["An SPN on the account", "Kerberos pre-authentication disabled", "Unconstrained delegation", "An expired password"],
        answer: 1,
        explanation: "AS-REP values come from accounts with DONT_REQ_PREAUTH set.",
      },
      {
        id: "h3",
        prompt: "From a SAM hive you have 32 hex characters per account, with no prefix and no salt. What are they?",
        options: ["MD5 digests", "NT hashes", "bcrypt hashes", "NetNTLMv2 responses"],
        answer: 1,
        explanation: "SAM and NTDS store unsalted NT hashes, 16 bytes shown as 32 hex characters.",
      },
      {
        id: "h4",
        prompt: "A captured value has the shape `user::DOMAIN:challenge:response:blob`. What is it?",
        options: ["An NT hash", "A NetNTLMv2 challenge-response", "A Kerberos TGT", "An md5crypt hash"],
        answer: 1,
        explanation: "User, domain, server challenge and a long response blob is the NetNTLMv2 format.",
      },
      {
        id: "h5",
        prompt: "An /etc/shadow entry begins with `$6$`. Which scheme is it?",
        options: ["md5crypt", "sha256crypt", "sha512crypt", "bcrypt"],
        answer: 2,
        monoOptions: false,
        explanation: "`$1$` is md5crypt, `$5$` sha256crypt, `$6$` sha512crypt.",
      },
      {
        id: "h6",
        prompt: "A web database stores values starting `$2y$10$`. What does the 10 mean?",
        options: ["The salt length", "The bcrypt cost factor", "The scheme version", "The password length"],
        answer: 1,
        explanation: "bcrypt records its cost as a power of two. Higher means slower to compute and to guess.",
      },
      {
        id: "h7",
        prompt: "Which of these is a challenge-response captured on the network, not a stored hash?",
        options: ["An NT hash from NTDS", "A sha512crypt entry", "A NetNTLMv2 value", "A bcrypt value"],
        answer: 2,
        explanation: "NetNTLMv2 is computed per authentication from a server challenge. The others are stored at rest.",
      },
      {
        id: "h8",
        prompt: "A service ticket starts with `$krb5tgs$18$`. What does that tell you about offline guessing?",
        options: ["It is fast, like RC4", "It is slow, because AES256 keys are salted and costly to derive", "It cannot be stored", "It is the same as an NT hash"],
        answer: 1,
        explanation: "Etype 18 is AES256. Expect it to be far slower than an RC4 ticket.",
      },
    ],
  },
  {
    id: "bloodhound-paths",
    title: "BloodHound path reading",
    topic: "ACL abuse",
    minutes: 8,
    best: 4,
    primer: "bloodhound",
    questions: [
      {
        id: "b1",
        prompt: "How many actions does this path need from you?",
        code: "A.PATEL ─MemberOf─► IT SUPPORT ─GenericWrite─► SVC_BACKUP ─AdminTo─► FS01",
        options: ["1", "2", "3", "4"],
        answer: 1,
        monoOptions: true,
        explanation: "MemberOf is inherited. Taking control of SVC_BACKUP is one action and logging on to FS01 is the second.",
      },
      {
        id: "b2",
        prompt: "Which edge is inherited and needs no action from you?",
        options: ["GenericWrite", "MemberOf", "ForceChangePassword", "AdminTo"],
        answer: 1,
        explanation: "MemberOf passes the group's rights to its members automatically.",
      },
      {
        id: "b3",
        prompt: "Which edge lets you reset a user's password without knowing the current one?",
        options: ["GenericRead", "ForceChangePassword", "HasSession", "CanRDP"],
        answer: 1,
        explanation: "ForceChangePassword is the User-Force-Change-Password extended right.",
      },
      {
        id: "b4",
        prompt: "What does a HasSession edge from FS01 to M.CHEN tell you?",
        options: ["M.CHEN is local admin on FS01", "M.CHEN was logged on to FS01 when data was collected", "M.CHEN can RDP to FS01", "FS01 is trusted to delegate to M.CHEN"],
        answer: 1,
        explanation: "HasSession is a snapshot from collection time. The session may be gone.",
      },
      {
        id: "b5",
        prompt: "Which pair of rights on the domain object grants replication of secrets?",
        options: ["GenericRead and WriteOwner", "GetChanges and GetChangesAll", "AddMember and ReadLAPSPassword", "AllowedToDelegate and AdminTo"],
        answer: 1,
        explanation: "Both replication rights together let a principal request directory secrets like a domain controller.",
      },
      {
        id: "b6",
        prompt: "The path runs through a computer on a subnet your foothold cannot reach. What is it worth right now?",
        options: ["Nothing until you have a route to that subnet", "The same as any other path", "More, because internal hosts are weaker", "It means BloodHound collection failed"],
        answer: 0,
        explanation: "A path is only usable from where you stand. Add the pivot to your plan first.",
      },
    ],
  },
  {
    id: "misconfig",
    title: "Spot the misconfiguration",
    topic: "Privilege escalation",
    minutes: 7,
    best: 6,
    primer: "linux-privesc",
    questions: [
      {
        id: "s1",
        prompt: "What is wrong with this sudoers rule?",
        code: "dana ALL=(root) NOPASSWD: /usr/bin/less /var/log/*",
        options: ["Nothing, the wildcard limits it to log files", "A pager can start other programs, so this grants root", "NOPASSWD only affects logging", "The rule is ignored because of the wildcard"],
        answer: 1,
        explanation: "Pagers can run commands, so root rights on one amount to root, whatever file it opens.",
      },
      {
        id: "s2",
        prompt: "This service runs as LocalSystem. What is the weakness?",
        code: "BINARY_PATH_NAME   : C:\\Program Files\\Acme Sync\\bin\\sync agent.exe\nSTART_TYPE         : 2   AUTO_START\nSERVICE_START_NAME : LocalSystem",
        options: ["The service starts automatically", "The path is unquoted and contains spaces", "LocalSystem services cannot be stopped", "The binary name contains a space, so it never starts"],
        answer: 1,
        explanation: "Windows tries each space-separated prefix of an unquoted path. A writable directory on it is the weakness.",
      },
      {
        id: "s3",
        prompt: "What do these two lines tell you?",
        code: "* * * * * root /opt/backup/run.sh\n-rwxrwxrwx 1 root root 214 Oct  2 03:10 /opt/backup/run.sh",
        options: ["The backup runs too often", "Any user can edit a script root runs every minute", "Only root can run the script", "The script is not executable"],
        answer: 1,
        explanation: "A world-writable script executed by root on a schedule hands root to anyone who edits it.",
      },
      {
        id: "s4",
        prompt: "You are a web application pool identity. What matters in this output?",
        code: "PRIVILEGES INFORMATION\n----------------------\nSeAssignPrimaryTokenPrivilege Replace a process level token    Disabled\nSeImpersonatePrivilege        Impersonate a client after auth   Enabled\nSeCreateGlobalPrivilege       Create global objects             Enabled",
        options: ["Nothing, these are default user privileges", "SeImpersonatePrivilege is a known route to SYSTEM", "SeCreateGlobalPrivilege lets you add users", "Disabled privileges cannot be used"],
        answer: 1,
        explanation: "Service identities hold SeImpersonatePrivilege by design, and it is one of the most common escalation routes.",
      },
      {
        id: "s5",
        prompt: "Why is this file interesting?",
        code: "-rwsr-xr-x 1 root root 224K Jan 12  2025 /usr/bin/find",
        options: ["It is larger than usual", "SUID root on a binary that can start other programs", "Only root can run it", "It was modified recently"],
        answer: 1,
        explanation: "find can launch other programs, so with the SUID bit set those programs run as root.",
      },
      {
        id: "s6",
        prompt: "What does this NFS export allow?",
        code: "/srv/share  *(rw,sync,no_root_squash)",
        options: ["Read-only access for everyone", "Remote root keeps root ownership on files it writes to the share", "Only local users can mount it", "Nothing, sync makes it safe"],
        answer: 1,
        explanation: "no_root_squash disables the mapping of remote root to nobody, so root-owned files can be planted on the share.",
      },
    ],
  },
  {
    id: "kerberos-tickets",
    title: "Kerberos ticket types",
    topic: "Kerberos",
    minutes: 6,
    primer: "delegation",
    questions: [
      {
        id: "k1",
        prompt: "Which key encrypts a ticket-granting ticket?",
        options: ["The user's key", "The krbtgt account's key", "The computer account's key", "The service account's key"],
        answer: 1,
        explanation: "Only the KDC needs to read a TGT, so it is encrypted with the krbtgt key.",
      },
      {
        id: "k2",
        prompt: "Which key encrypts the service portion of a service ticket?",
        options: ["The krbtgt key", "The user's key", "The service account's key", "A key chosen by the client"],
        answer: 2,
        explanation: "The service must decrypt it, so the KDC uses the service account's key. This is why Kerberoasting works.",
      },
      {
        id: "k3",
        prompt: "A golden ticket is a forged what?",
        options: ["Service ticket", "Ticket-granting ticket", "AS-REQ", "Unsigned PAC"],
        answer: 1,
        explanation: "Whoever holds the krbtgt key can mint TGTs, which is why that key is the most sensitive in the domain.",
      },
      {
        id: "k4",
        prompt: "A silver ticket is forged with which key?",
        options: ["The krbtgt key", "The target service account's key", "The user's key", "The domain controller's certificate"],
        answer: 1,
        explanation: "A silver ticket is a service ticket forged with the service's own key. The KDC is never involved.",
      },
      {
        id: "k5",
        prompt: "What does S4U2Self return?",
        options: ["A TGT for any user", "A service ticket to the requesting service on behalf of a user", "A ticket to any SPN in the domain", "The user's password hash"],
        answer: 1,
        explanation: "S4U2Self gives a service a ticket to itself as the named user. S4U2Proxy then forwards it.",
      },
      {
        id: "k6",
        prompt: "What does the PAC in a ticket carry?",
        options: ["The user's password hash", "The user's SIDs and group memberships, signed by the KDC", "The list of SPNs the user can reach", "The client's IP address"],
        answer: 1,
        explanation: "Services read authorisation data from the PAC, which is why its signatures matter.",
      },
    ],
  },
  {
    id: "ssti",
    title: "Template injection detection",
    topic: "Web to shell",
    minutes: 12,
    primer: "web-to-shell",
    questions: [
      {
        id: "t1",
        prompt: "An arithmetic expression you submit comes back evaluated in the raw server response. What does that establish?",
        options: ["The page has cross-site scripting", "The server evaluates template expressions in your input", "The page uses JavaScript", "Nothing yet"],
        answer: 1,
        explanation: "Evaluation in the raw response means your input reaches a server-side template engine.",
      },
      {
        id: "t2",
        prompt: "The browser shows the evaluated result, but the raw HTTP response contains your expression unchanged. What is happening?",
        options: ["Server-side injection", "Client-side template rendering", "A caching proxy", "A WAF rewriting the response"],
        answer: 1,
        explanation: "The server returned it unevaluated, so a front-end framework rendered it. That is a different bug class.",
      },
      {
        id: "t3",
        prompt: "Why identify the template engine before going further?",
        options: ["It does not matter", "Syntax and available objects differ by engine", "Only to name it in the report", "Engines all behave the same"],
        answer: 1,
        explanation: "Each engine has its own syntax and sandbox, so the next step depends on which one you face.",
      },
      {
        id: "t4",
        prompt: "What proves template injection in your report?",
        options: ["A screenshot of the rendered page", "The request, the input and the raw response showing evaluation", "The engine's version number", "A note that it worked"],
        answer: 1,
        explanation: "A reviewer needs to reproduce it. Request, input and raw response do that.",
      },
      {
        id: "t5",
        prompt: "Your input is evaluated only in a password reset email, not the page. Is that template injection?",
        options: ["No, emails are not templates", "Yes, in the mail template renderer", "Only if the page also evaluates it", "Only with a second account"],
        answer: 1,
        explanation: "Second-order injection is still injection. Test where your input is rendered, not just where it is stored.",
      },
    ],
  },
];

export interface PlaybookItem {
  id: string;
  text: string;
  command?: string;
}

export interface Playbook {
  id: string;
  title: string;
  when: string;
  groups: { title: string; items: PlaybookItem[] }[];
}

export const playbooks: Playbook[] = [
  {
    id: "linux-shell",
    title: "Just landed a shell on Linux",
    when: "A low-privileged shell on a Linux host, before you try to escalate.",
    groups: [
      {
        title: "Orient",
        items: [
          { id: "l1", text: "Record who and where you are", command: "id; hostname; ip -br a" },
          { id: "l2", text: "Note the OS and kernel", command: "cat /etc/os-release; uname -a" },
          { id: "l3", text: "Upgrade to a stable, interactive shell before doing anything long" },
        ],
      },
      {
        title: "Privilege paths",
        items: [
          { id: "l4", text: "List sudo rights", command: "sudo -l" },
          { id: "l5", text: "Find SUID binaries", command: "find / -perm -4000 -type f 2>/dev/null" },
          { id: "l6", text: "Find file capabilities", command: "getcap -r / 2>/dev/null" },
          { id: "l7", text: "Check scheduled jobs", command: "cat /etc/crontab; ls -la /etc/cron.d" },
          { id: "l8", text: "List listening services", command: "ss -tlnp" },
          { id: "l9", text: "Read application configs and backups for reused credentials" },
        ],
      },
      {
        title: "Before you move on",
        items: [
          { id: "l10", text: "Read local.txt with hostname and IP in the same output", command: "cat local.txt; hostname; ip -br a" },
          { id: "l11", text: "Save the foothold command and output to evidence with Ctrl+Shift+S" },
          { id: "l12", text: "Write one line on how you got the shell" },
        ],
      },
    ],
  },
  {
    id: "windows-shell",
    title: "Just landed a shell on Windows",
    when: "A shell or WinRM session on a Windows host, before you try to escalate.",
    groups: [
      {
        title: "Orient",
        items: [
          { id: "w1", text: "Read your token: groups and privileges", command: "whoami /all" },
          { id: "w2", text: "Record hostname and addresses", command: "hostname; ipconfig /all" },
          { id: "w3", text: "Check OS build and domain membership", command: "systeminfo" },
        ],
      },
      {
        title: "Privilege paths",
        items: [
          { id: "w4", text: "List services, their accounts and binary paths", command: "Get-CimInstance Win32_Service | Select-Object Name, StartName, PathName" },
          { id: "w5", text: "List stored credentials", command: "cmdkey /list" },
          { id: "w6", text: "List scheduled tasks and what they run", command: "schtasks /query /fo LIST /v" },
          { id: "w7", text: "List listening ports", command: "netstat -ano | findstr LISTENING" },
          { id: "w8", text: "Check for autologon and other credentials stored in the registry" },
        ],
      },
      {
        title: "Before you move on",
        items: [
          { id: "w9", text: "Read proof files with hostname and IP in the same output", command: "type proof.txt; hostname; ipconfig" },
          { id: "w10", text: "Save the command and output to evidence with Ctrl+Shift+S" },
          { id: "w11", text: "If domain joined, run the new credentials playbook" },
        ],
      },
    ],
  },
  {
    id: "domain-creds",
    title: "New domain credentials",
    when: "You just recovered a domain user's credential.",
    groups: [
      {
        title: "Where does it work",
        items: [
          { id: "d1", text: "List hosts and the services that accept domain logons", command: "nmap -sV -p 135,445,1433,3389,5985 <subnet>" },
          { id: "d2", text: "Test the credential against each of those services and record every result" },
          { id: "d3", text: "List the shares it can read and skim them for scripts and configs" },
        ],
      },
      {
        title: "What can it read",
        items: [
          { id: "d4", text: "Read the account's groups", command: "net user <user> /domain" },
          { id: "d5", text: "List user accounts with an SPN", command: "(&(samAccountType=805306368)(servicePrincipalName=*))" },
          { id: "d6", text: "List accounts without Kerberos pre-authentication", command: "(userAccountControl:1.2.840.113556.1.4.803:=4194304)" },
          { id: "d7", text: "Collect BloodHound data and mark the user as owned" },
          { id: "d8", text: "List accounts with delegation configured", command: "(msDS-AllowedToDelegateTo=*)" },
        ],
      },
      {
        title: "Record",
        items: [
          { id: "d9", text: "Add the credential to your table with its source and where it works" },
          { id: "d10", text: "Look for paths from owned principals again" },
        ],
      },
    ],
  },
  {
    id: "stuck-30",
    title: "Stuck for 30 minutes",
    when: "No progress for half an hour on the same host or step.",
    groups: [
      {
        title: "Stop and reset",
        items: [
          { id: "x1", text: "Write the current hypothesis in one sentence" },
          { id: "x2", text: "List what you tried and the exact result of each attempt" },
          { id: "x3", text: "Set a 20 minute box for the next step" },
        ],
      },
      {
        title: "Go back to enumeration",
        items: [
          { id: "x4", text: "Rerun a full TCP scan and compare it with your notes", command: "nmap -p- -oA full <target>" },
          { id: "x5", text: "Run a short UDP scan", command: "sudo nmap -sU --top-ports 50 <target>" },
          { id: "x6", text: "Read page sources and comments, not just rendered pages" },
          { id: "x7", text: "Try every credential you hold on every service" },
        ],
      },
      {
        title: "Ask for help well",
        items: [
          { id: "x8", text: "Use stuck in Onyx with the host, your access and the last two attempts" },
          { id: "x9", text: "Raise the help dial one step, not straight to Walkthrough" },
        ],
      },
    ],
  },
];

export interface HistoryEntry {
  id: string;
  at: string;
  context: { kind: "scenario"; scenarioId: string; label: string } | { kind: "mentor"; label: string };
  level: HelpLevel;
  messages: OnyxMessageData[];
}

function convo(prefix: string, start: string, lines: [OnyxMessageData["role"], string, Partial<OnyxMessageData>?][]): OnyxMessageData[] {
  const t0 = new Date(start).getTime();
  return lines.map(([role, text, extra], i) => ({ id: `${prefix}-${i}`, role, text, at: new Date(t0 + i * 90000).toISOString(), ...extra }));
}

export const history: HistoryEntry[] = [
  {
    id: "c-mer-2",
    at: minutesAgo(96),
    context: { kind: "scenario", scenarioId: "meridian", label: "Meridian" },
    level: "coach",
    messages: convo("c-mer-2", minutesAgo(96), [
      ["system", "Lab started. Help level: Coach"],
      ["you", "I have a shell on MER-WEB01 as j.harlow. What should I look at first for the domain?"],
      ["onyx", "Start with what the domain tells any authenticated user. Collect BloodHound data and note which accounts have SPNs or unusual permissions.\n\nWrite down the groups j.harlow belongs to before you move on."],
      ["system", "Proof recorded: proof.txt on MER-WEB01"],
      ["you", COMMAND_PROMPT.hint, { command: "hint" }],
      ["onyx", "You hold j.harlow. Before attacking any host, ask the domain which accounts run services. Accounts with an SPN are worth a closer look.", { hintStep: { step: 1, of: 4 } }],
    ]),
  },
  {
    id: "c-mentor-exam",
    at: hoursAgo(20),
    context: { kind: "mentor", label: "Mentor" },
    level: "teach",
    messages: convo("c-mentor-exam", hoursAgo(20), [
      ["you", "How should I split 24 hours across three standalones and an AD set?"],
      ["onyx", TOPICS.exam.answer],
      ["you", "Should I start with the AD set?"],
      ["onyx", "Most people do it while fresh because it is worth 40 points and the chain is long. Start it only after your first-hour enumeration, so a stall there does not cost you the standalones."],
    ]),
  },
  {
    id: "c-basalt",
    at: daysAgo(1, 19),
    context: { kind: "scenario", scenarioId: "basalt", label: "Basalt" },
    level: "coach",
    messages: convo("c-basalt", daysAgo(1, 19), [
      ["system", "Lab started. Help level: Coach"],
      ["you", "The dashboard reflects my input in the page title. Is that enough to call it template injection?"],
      ["onyx", "Not yet. Reflection proves the input reaches the page, not that a template engine evaluates it. Submit an expression whose result differs from its text and check the raw response."],
      ["you", "The raw response shows the expression evaluated."],
      ["onyx", "That is evaluation server side. Identify the engine next, because what follows depends on it. Keep that request for your report."],
      ["system", "Proof recorded: local.txt on BSL-01"],
      ["system", "Proof recorded: proof.txt on BSL-01"],
    ]),
  },
  {
    id: "c-mentor-pivot",
    at: daysAgo(3, 21),
    context: { kind: "mentor", label: "Mentor" },
    level: "coach",
    messages: convo("c-mentor-pivot", daysAgo(3, 21), [
      ["you", "When should I use a routed pivot instead of a SOCKS proxy?"],
      ["onyx", "Use a routed pivot when you want your tools to work unchanged against an internal subnet. Use a SOCKS proxy when you only need a few TCP tools and cannot add a route."],
      ["you", "My nmap through the tunnel shows everything filtered."],
      ["onyx", "Scan one known port with -Pn first to prove the route. Then lower the rate. Aggressive timing over a tunnel drops probes and reports open ports as filtered."],
    ]),
  },
  {
    id: "c-mer-1",
    at: daysAgo(3, 20),
    context: { kind: "scenario", scenarioId: "meridian", label: "Meridian" },
    level: "nudge",
    messages: convo("c-mer-1", daysAgo(3, 20), [
      ["system", "Lab started. Help level: Nudge"],
      ["you", "I found one account with an SPN but I am not getting anywhere with it."],
      ["onyx", "Check the encryption type recorded in the ticket first.", { hintStep: { step: 1, of: 4 } }],
      ["you", COMMAND_PROMPT.hint, { command: "hint" }],
      ["onyx", "Look at which SPN accounts are privileged before choosing one.", { hintStep: { step: 2, of: 4 } }],
      ["you", COMMAND_PROMPT.hint, { command: "hint" }],
      ["onyx", "Nudge stops at hint 2 of 4. Raise the dial to Coach for the next hint on this blocker.", { hintStep: { step: 2, of: 4 } }],
      ["system", "Session expired. Machines destroyed."],
    ]),
  },
  {
    id: "c-tamarack",
    at: daysAgo(4, 21),
    context: { kind: "scenario", scenarioId: "tamarack", label: "Tamarack" },
    level: "coach",
    messages: convo("c-tamarack", daysAgo(4, 21), [
      ["system", "Lab started. Help level: Coach"],
      ["you", "whoami /priv shows SeImpersonatePrivilege. Does that matter?"],
      ["onyx", "Usually, yes. It is one of the most common routes to SYSTEM for a service identity. Check the OS build next, because which approach works depends on it."],
      ["you", "Server 2022."],
      ["onyx", "Then research what applies to that build before acting. Record the privilege output now: it is the evidence that explains the escalation."],
    ]),
  },
  {
    id: "c-mentor-report",
    at: daysAgo(12, 18),
    context: { kind: "mentor", label: "Mentor" },
    level: "teach",
    messages: convo("c-mentor-report", daysAgo(12, 18), [
      ["you", "What should a finding in my report contain?"],
      ["onyx", TOPICS.report.answer],
      ["you", "Do screenshots count as evidence?"],
      ["onyx", "Yes, if the hostname and IP are visible with the proof. Text output is easier to verify, so keep both where you can."],
    ]),
  },
  {
    id: "c-kestrel",
    at: daysAgo(38, 19),
    context: { kind: "scenario", scenarioId: "kestrel", label: "Kestrel" },
    level: "coach",
    messages: convo("c-kestrel", daysAgo(38, 19), [
      ["system", "Lab started. Help level: Coach"],
      ["you", "The file transfer service banner shows a 2019 build. How do I check it without guessing?"],
      ["onyx", "Match the exact product and build against vendor advisories, then read any public code before you run it. Look for paths, ports and versions it assumes that may not hold here."],
      ["system", "Proof recorded: local.txt on KES-01"],
    ]),
  },
];
