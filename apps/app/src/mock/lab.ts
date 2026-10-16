import type { HelpLevel, OnyxCommand, OnyxMessageData } from "@rootpanther/ui";
import { minutesAgo } from "./time";
import type { ChatContext, ChatReply, ChatRequest } from "./onyx";
import { COMMAND_PROMPT, hintReply, HINT_STEPS } from "./onyx";

export interface TerminalResult {
  output: string;
  proof?: { host: string; kind: "local" | "proof"; file: string; token: string };
}

const BANNER = [
  "Linux rp-attack 6.6.0-kali #1 SMP x86_64 GNU/Linux",
  "Kali rolling. Lab tunnel up on tun0 (10.13.37.6).",
  "Scope: meridian.local  10.13.37.0/24  172.16.20.0/24",
  "Type help for the commands wired into this shell.",
].join("\r\n");

export function connectBanner(): string {
  return `${BANNER}\r\n`;
}

const HELP = [
  "Wired commands in this practice shell:",
  "  nmap <target>            service scan of a Meridian host",
  "  nxc smb <target>         SMB check against a host",
  "  GetUserSPNs.py           list service accounts with an SPN",
  "  hashcat                  run the last requested crack job",
  "  evil-winrm -i <target>   open a WinRM session",
  "  whoami                   current identity",
  "  ip a                     tunnel interface",
  "  cat <file> / type <file> read a proof file",
  "  clear                    clear the screen",
].join("\r\n");

function block(lines: string[]): string {
  return lines.join("\r\n");
}

const NMAP_WEB = block([
  "Starting Nmap against 10.13.37.10",
  "Nmap scan report for MER-WEB01 (10.13.37.10)",
  "Host is up (0.013s latency).",
  "PORT     STATE SERVICE       VERSION",
  "80/tcp   open  http          Microsoft IIS httpd 10.0",
  "135/tcp  open  msrpc         Microsoft Windows RPC",
  "445/tcp  open  microsoft-ds  Windows Server 2019",
  "5985/tcp open  http          WinRM 2.0",
  "Service Info: OS: Windows; CPE: cpe:/o:microsoft:windows",
  "Nmap done. 1 host up, scanned in 7.41s",
]);

const NMAP_SQL = block([
  "Starting Nmap against 172.16.20.11",
  "Nmap scan report for MER-SQL01 (172.16.20.11)",
  "Host is up (0.028s latency, via tun0).",
  "PORT     STATE SERVICE       VERSION",
  "135/tcp  open  msrpc         Microsoft Windows RPC",
  "445/tcp  open  microsoft-ds  Windows Server 2019",
  "1433/tcp open  ms-sql-s      Microsoft SQL Server 2019",
  "5985/tcp open  http          WinRM 2.0",
  "Nmap done. 1 host up, scanned in 11.02s",
]);

const NMAP_DC = block([
  "Starting Nmap against 172.16.20.5",
  "Nmap scan report for MER-DC01 (172.16.20.5)",
  "Host is up (0.031s latency, via tun0).",
  "PORT    STATE SERVICE      VERSION",
  "53/tcp  open  domain       Simple DNS Plus",
  "88/tcp  open  kerberos-sec Microsoft Windows Kerberos",
  "389/tcp open  ldap         Microsoft Windows Active Directory LDAP",
  "445/tcp open  microsoft-ds Windows Server 2019",
  "636/tcp open  ldapssl",
  "Service Info: Host: MER-DC01; OS: Windows",
  "Nmap done. 1 host up, scanned in 12.88s",
]);

const NXC_WEB = block([
  "SMB  10.13.37.10  445  MER-WEB01  [*] Windows Server 2019 Build 17763 x64 (name:MER-WEB01) (domain:meridian.local) (signing:False) (SMBv1:False)",
  "SMB  10.13.37.10  445  MER-WEB01  [+] meridian.local\\j.harlow:[redacted] (Pwn3d!)",
  "SMB  10.13.37.10  445  MER-WEB01  [*] Enumerated shares",
  "SMB  10.13.37.10  445  MER-WEB01  Share       Permissions   Remark",
  "SMB  10.13.37.10  445  MER-WEB01  -----       -----------   ------",
  "SMB  10.13.37.10  445  MER-WEB01  ADMIN$      READ,WRITE     Remote Admin",
  "SMB  10.13.37.10  445  MER-WEB01  C$          READ,WRITE     Default share",
  "SMB  10.13.37.10  445  MER-WEB01  IPC$        READ           Remote IPC",
  "SMB  10.13.37.10  445  MER-WEB01  web_deploy  READ           Deployment staging",
]);

const SPNS = block([
  "Impacket GetUserSPNs against meridian.local",
  "ServicePrincipalName          Name     MemberOf                           PasswordLastSet      Delegation",
  "----------------------------  -------  ---------------------------------  -------------------  ----------",
  "MSSQLSvc/MER-SQL01:1433        svc_sql  CN=SQL Admins,OU=Services,DC=...   2023-02-11 08:14:02  ",
  "HTTP/MER-WEB01                 svc_web  CN=Web,OU=Services,DC=meridian...  2025-09-30 02:22:17  ",
  "",
  "[+] 2 accounts with an SPN found. Requesting tickets.",
  "[+] Saved 2 tickets to tgs.meridian (encryption type RC4 for svc_sql, AES256 for svc_web).",
  "[*] svc_sql last changed its password over 3 years ago.",
]);

const HASHCAT = block([
  "hashcat against tgs.meridian  mode 13100 (Kerberos 5 TGS-REP, RC4)",
  "Session..........: rp-lab",
  "Status...........: Cracked",
  "Hash.Target......: svc_sql (MSSQLSvc/MER-SQL01)",
  "Recovered........: 1/2 (50%) accounts. svc_web is AES256 and did not fall.",
  "svc_sql password: [redacted, recorded to notes]",
  "Time.Started.....: 00:00:41",
]);

const WINRM_SQL = block([
  "Evil-WinRM shell against 172.16.20.11",
  "Info: Establishing connection to remote endpoint",
  "[+] Session opened as MERIDIAN\\svc_sql on MER-SQL01",
  "*Evil-WinRM* PS C:\\Users\\svc_sql\\Documents> ",
]);

const WHOAMI = block([
  "meridian\\j.harlow",
  "",
  "GROUP INFORMATION",
  "-----------------",
  "Everyone                  Well-known group",
  "BUILTIN\\Users             Alias",
  "MERIDIAN\\Web Developers   Group",
  "MERIDIAN\\Domain Users     Group",
]);

const IP_A = block([
  "4: tun0: <POINTOPOINT,MULTICAST,NOARP,UP,LOWER_UP> mtu 1420",
  "    inet 10.13.37.6/24 scope global tun0",
  "    valid_lft forever preferred_lft forever",
]);

const CAT_LOCAL: TerminalResult = {
  output: block([
    "4f9a1c7e2b8d6054a3f1e9c0b7d2a845",
    "",
    "hostname: MER-WEB01",
    "ip      : 10.13.37.10",
  ]),
  proof: { host: "mer-web01", kind: "local", file: "local.txt", token: "4f9a1c7e2b8d6054a3f1e9c0b7d2a845" },
};

const TYPE_PROOF_SQL: TerminalResult = {
  output: block([
    "e21b7740ac95d3860f1842bb9c05ad73",
    "",
    "hostname: MER-SQL01",
    "ip      : 172.16.20.11",
  ]),
  proof: { host: "mer-sql01", kind: "proof", file: "proof.txt", token: "e21b7740ac95d3860f1842bb9c05ad73" },
};

interface CommandSpec {
  match: RegExp;
  run: (arg: string) => TerminalResult;
}

const SPECS: CommandSpec[] = [
  { match: /^help$/i, run: () => ({ output: HELP }) },
  { match: /^whoami/i, run: () => ({ output: WHOAMI }) },
  { match: /^ip a$|^ip addr/i, run: () => ({ output: IP_A }) },
  {
    match: /^nmap\b/i,
    run: (arg) => {
      if (/172\.16\.20\.5|mer-dc01/i.test(arg)) return { output: NMAP_DC };
      if (/172\.16\.20\.11|mer-sql01/i.test(arg)) return { output: NMAP_SQL };
      if (/10\.13\.37\.10|mer-web01/i.test(arg)) return { output: NMAP_WEB };
      return { output: "nmap: specify a Meridian host, for example nmap 10.13.37.10 (MER-WEB01)." };
    },
  },
  { match: /^nxc\s+smb\b|^crackmapexec\s+smb\b/i, run: () => ({ output: NXC_WEB }) },
  { match: /getuserspns/i, run: () => ({ output: SPNS }) },
  { match: /^hashcat\b/i, run: () => ({ output: HASHCAT }) },
  {
    match: /evil-winrm/i,
    run: (arg) => (/172\.16\.20\.5|mer-dc01/i.test(arg) ? { output: "Evil-WinRM: svc_sql cannot log on to MER-DC01. You need a credential with rights there." } : { output: WINRM_SQL }),
  },
  { match: /^cat\b.*local\.txt/i, run: () => CAT_LOCAL },
  { match: /^(type|cat)\b.*proof\.txt/i, run: () => TYPE_PROOF_SQL },
  { match: /^clear$/i, run: () => ({ output: "\u0000clear" }) },
];

export function runCommand(line: string): TerminalResult {
  const trimmed = line.trim();
  if (!trimmed) return { output: "" };
  const spec = SPECS.find((s) => s.match.test(trimmed));
  if (spec) return spec.run(trimmed);
  const name = trimmed.split(/\s+/)[0];
  return { output: `${name}: command not found in the practice shell. Type help for the wired commands.` };
}

export const SUGGESTED_COMMANDS = ["nmap 10.13.37.10", "nxc smb 10.13.37.10", "GetUserSPNs.py", "whoami", "help"];

const LAB_LADDER = [
  "You have a shell on MER-WEB01 and valid domain credentials. Before touching the internal subnet, ask the domain which accounts run services. The SPN list is the first thing to pull.",
  "Two accounts have an SPN. Look at the encryption type and the password age, not just the name. One of them has not changed its password in years.",
  "svc_sql uses RC4 and an old password, so its service ticket is the realistic target. Once you recover it, test where svc_sql can log on across the internal subnet.",
  "Last hint for this blocker: svc_sql is in SQL Admins and can reach MER-SQL01 over WinRM. That is your pivot off the foothold. From there, enumerate the domain again from the new position.",
];

const LAB_WALK = ["Enumerate service accounts, then focus on the weakest:", "  GetUserSPNs.py meridian.local/j.harlow -dc-ip 172.16.20.5", "  (note the encryption type and pwdLastSet for each result)", "", "Test where the recovered account can log on:", "  nxc winrm 172.16.20.0/24 -u svc_sql -p '<password>'"].join("\n");

interface LabTopic {
  match: RegExp;
  answer: string;
  why: string;
  teach: string;
}

const LAB_TOPICS: Record<string, LabTopic> = {
  foothold: {
    match: /\b(next|foothold|start|domain|where|spn|service)\b/i,
    answer:
      "You are on MER-WEB01 as j.harlow with domain credentials. The objective is Domain Admin on meridian.local, so the question is how to reach MER-DC01 at 172.16.20.5, which you cannot touch directly yet.\n\nStart by asking the domain which accounts run services. One weak service account is usually the pivot off this foothold.",
    why: "MER-DC01 is on the internal subnet behind MER-SQL01. You need a credential that can move you inward, and a service account with a weak password is the most common way to get one here.",
    teach: "Meridian is a three-host domain: MER-WEB01 is your foothold, MER-SQL01 is the pivot, MER-DC01 is the goal. svc_sql has an SPN, an old password and membership of SQL Admins, which is why it sits on the intended path. The Kerberoasting primer covers the technique in full.",
  },
  sql: {
    match: /sql|winrm|pivot|svc_sql|172\.16/i,
    answer:
      "svc_sql can log on to MER-SQL01 over WinRM. Open a session there and enumerate the domain again from inside the internal subnet, because MER-DC01 is reachable from MER-SQL01 but not from your foothold.",
    why: "Each new position changes what you can see. From MER-SQL01 you are inside 172.16.20.0/24 and can query the domain controller directly.",
    teach: "A pivot is a routing problem first. MER-SQL01 sits on both the learner-facing and internal subnets, so a session there gives you reach to MER-DC01. From the new host, re-run your domain enumeration rather than assuming it matches the foothold view.",
  },
  dc: {
    match: /\bdc\b|domain controller|mer-dc01|dcsync|replication|domain admin/i,
    answer:
      "Reaching MER-DC01 is the objective, not the starting point. Get onto MER-SQL01 first, enumerate the domain from there, and look for a principal with rights over the domain object. Replication rights are the usual end of this path.",
    why: "Domain Admin here comes from object permissions you find in BloodHound, not from attacking the DC directly. The last edge is commonly replication rights on the domain.",
    teach: "The replication rights primer explains why DS-Replication-Get-Changes and its -All pair are equivalent to domain control. Confirm who holds them in BloodHound before you try to use them.",
  },
};

export const LAB_START: ChatContext = { topic: "foothold", ladder: 1 };

export function labReply({ text, command, level, ctx }: ChatRequest): ChatReply {
  const topic = LAB_TOPICS[ctx.topic] ?? LAB_TOPICS.foothold;

  if (!command) {
    const hit = Object.entries(LAB_TOPICS).find(([, t]) => t.match.test(text));
    if (hit) {
      const [key, t] = hit;
      return { text: t.answer, ctx: { topic: key, ladder: key === ctx.topic ? ctx.ladder : 0 } };
    }
    if (text.includes("\n")) {
      return { text: "I can see that output. Tell me what you expected from it and I will point at the next step for Meridian." };
    }
    return { text: "I am grounded to Meridian. Ask about the foothold, the pivot to MER-SQL01, or reaching MER-DC01, and I will keep it specific to these hosts." };
  }

  switch (command) {
    case "hint":
      return hintReply(LAB_LADDER, level, ctx.ladder, LAB_WALK);
    case "why":
      return { text: topic.why };
    case "check":
      return { text: "Tell me the host you are on and what you just ran. On this foothold the check I apply is whether you have pulled the SPN list and read the encryption types before moving on." };
    case "stuck":
      return { text: "You hold j.harlow on MER-WEB01. If you are stuck, you have almost certainly not enumerated service accounts yet, or not acted on svc_sql. Pull the SPN list and look at the password ages." };
    case "explain":
      return { text: "Paste the output you want explained, or run the command again. For the SPN list, the fields that matter are the encryption type and PasswordLastSet, not the account name." };
    case "methodology":
      return { text: "On Meridian you are at step: enumerate the domain from the foothold. You have local.txt and proof.txt on MER-WEB01. Next is a service account to pivot to MER-SQL01, then the domain controller from there." };
    case "teach":
      return { text: topic.teach };
    case "walkthrough":
      return { text: "Concrete steps for the current blocker on Meridian. Replace the password placeholder with what you recover.", code: LAB_WALK };
    case "review":
      return { text: "Your Meridian report has local.txt and proof.txt on MER-WEB01 recorded. Each needs the command and the screenshot with hostname and IP. Use note after the next proof so it lands in the evidence tray." };
    case "note":
      return { text: "Saved the last command and its output to the Meridian evidence tray." };
    default:
      return { text: LAB_TOPICS.foothold.answer };
  }
}

export const labTranscript: OnyxMessageData[] = [
  { id: "l1", role: "system", text: "Grounded to Meridian. Help level: Coach", at: minutesAgo(101) },
  { id: "l2", role: "you", text: "Shell on MER-WEB01 as j.harlow. Objective is Domain Admin. What is the path?", at: minutesAgo(100) },
  { id: "l3", role: "onyx", text: LAB_TOPICS.foothold.answer, at: minutesAgo(100) },
  { id: "l4", role: "system", text: "Proof recorded: proof.txt on MER-WEB01", at: minutesAgo(71) },
  { id: "l5", role: "you", text: COMMAND_PROMPT.hint, command: "hint", at: minutesAgo(40) },
  { id: "l6", role: "onyx", text: LAB_LADDER[0], hintStep: { step: 1, of: HINT_STEPS }, at: minutesAgo(40) },
];

export const LAB_HELP_DEFAULT: HelpLevel = "coach";

export type { OnyxCommand };
