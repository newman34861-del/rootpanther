import type { Debrief, EvidenceItem, ReportSection, ReportSummary } from "@rootpanther/ui";
import { daysAgo, hoursAgo, minutesAgo } from "./time";

export const REDACTED_COMMAND = "[command redacted in sample data]";

export interface ReportStep {
  id: string;
  command: string;
  evidence: { kind: "output" | "screenshot"; text: string };
  explanation: string;
}

export interface ReportSectionContent {
  sectionId: string;
  prose?: string;
  steps?: ReportStep[];
}

export interface OnyxCritique {
  id: string;
  sectionId: string;
  stepId?: string;
  text: string;
}

export interface ReportDetail {
  summary: ReportSummary;
  candidate: string;
  hosts: string[];
  sections: ReportSection[];
  content: ReportSectionContent[];
  evidence: EvidenceItem[];
  critiques: OnyxCritique[];
}

export const reports: ReportSummary[] = [
  { id: "rep-meridian", title: "Meridian, internal assessment", scenarios: ["Meridian"], status: "draft", updatedAt: minutesAgo(2), wordCount: 1240 },
  { id: "rep-basalt", title: "Basalt, standalone report", scenarios: ["Basalt"], status: "complete", updatedAt: hoursAgo(23), wordCount: 1860 },
  { id: "rep-tamarack", title: "Tamarack, first attempt", scenarios: ["Tamarack"], status: "draft", updatedAt: daysAgo(4), wordCount: 420 },
  { id: "rep-kestrel", title: "Kestrel, standalone report", scenarios: ["Kestrel"], status: "exported", updatedAt: daysAgo(37), wordCount: 1530 },
  { id: "rep-halcyon", title: "Halcyon, standalone report", scenarios: ["Halcyon"], status: "exported", updatedAt: daysAgo(45), wordCount: 1310 },
  { id: "rep-practice", title: "Practice report, C1 standalones", scenarios: ["Halcyon", "Lattice", "Kestrel"], status: "complete", updatedAt: daysAgo(30), wordCount: 3920 },
];

function hostSections(prefix: string, host: string, states: [ReportSection["state"], ReportSection["state"], ReportSection["state"]]): ReportSection[] {
  return [
    { id: `${prefix}`, title: host, state: states.every((s) => s === "done") ? "done" : states.some((s) => s !== "empty") ? "draft" : "empty", host },
    { id: `${prefix}-foothold`, title: "Foothold", parentId: prefix, state: states[0], host },
    { id: `${prefix}-privesc`, title: "Privilege escalation", parentId: prefix, state: states[1], host },
    { id: `${prefix}-proof`, title: "Proof", parentId: prefix, state: states[2], host },
  ];
}

const basaltSections: ReportSection[] = [
  { id: "exec", title: "Executive summary", state: "done" },
  { id: "scope", title: "Scope", state: "done" },
  { id: "method", title: "Methodology", state: "done" },
  ...hostSections("bsl", "BSL-01", ["done", "done", "done"]),
  { id: "remediation", title: "Remediation", state: "done" },
  { id: "appendix", title: "Appendix: commands", state: "draft" },
];

const meridianSections: ReportSection[] = [
  { id: "exec", title: "Executive summary", state: "empty" },
  { id: "scope", title: "Scope", state: "done" },
  { id: "method", title: "Methodology", state: "draft" },
  ...hostSections("web", "MER-WEB01", ["done", "draft", "done"]),
  ...hostSections("sql", "MER-SQL01", ["draft", "empty", "empty"]),
  ...hostSections("dc", "MER-DC01", ["empty", "empty", "empty"]),
  { id: "remediation", title: "Remediation", state: "empty" },
  { id: "appendix", title: "Appendix: commands", state: "empty" },
];

const basaltContent: ReportSectionContent[] = [
  {
    sectionId: "exec",
    prose:
      "One host was in scope. An internal operations dashboard rendered user input as a template, which gave remote code execution as the web service account. A binary with a privileged Linux capability then allowed full control of the host. Both issues have direct fixes and no compensating controls were in place.",
  },
  {
    sectionId: "scope",
    prose: "Host BSL-01 at 10.13.37.33 (basalt.lab), reached over the Rootpanther lab tunnel. Testing ran for 1 hour 58 minutes. No other hosts or services were in scope.",
  },
  {
    sectionId: "method",
    prose:
      "Service enumeration, then manual review of each web endpoint, then local enumeration after the foothold. Each finding below is written as reproducible steps: the command, the evidence it produced, and why it matters.",
  },
  {
    sectionId: "bsl-foothold",
    steps: [
      {
        id: "b1",
        command: "nmap -sV -p- 10.13.37.33",
        evidence: { kind: "output", text: "22/tcp   open  ssh    OpenSSH 9.2p1 Debian\n80/tcp   open  http   nginx 1.22.1\n8080/tcp open  http   Werkzeug 2.3.7 (Python 3.11)" },
        explanation: "A full port scan found SSH, nginx and a Python development server on 8080. The Werkzeug banner pointed to a Flask application.",
      },
      {
        id: "b2",
        command: "curl -s http://10.13.37.33:8080/status",
        evidence: { kind: "output", text: "<h1>Ops dashboard</h1> Welcome back, guest" },
        explanation: "The dashboard echoes the display name passed in the query string. This is the input tested in the next step.",
      },
      {
        id: "b3",
        command: REDACTED_COMMAND,
        evidence: { kind: "screenshot", text: "Dashboard showing an evaluated expression instead of the literal name" },
        explanation: "The name field was evaluated as a template expression, which confirms server-side template injection.",
      },
      {
        id: "b4",
        command: REDACTED_COMMAND,
        evidence: { kind: "output", text: "uid=1001(dashboard) gid=1001(dashboard) groups=1001(dashboard)" },
        explanation: "Code execution was obtained as the dashboard service account.",
      },
    ],
  },
  {
    sectionId: "bsl-privesc",
    steps: [
      {
        id: "b5",
        command: "getcap -r / 2>/dev/null",
        evidence: { kind: "output", text: "/usr/bin/ping cap_net_raw=ep\n/opt/tools/backup-helper cap_setuid=ep" },
        explanation: "A custom backup helper carried the setuid capability, which lets it change its user ID to root.",
      },
      {
        id: "b6",
        command: REDACTED_COMMAND,
        evidence: { kind: "output", text: "uid=0(root) gid=1001(dashboard) groups=1001(dashboard)" },
        explanation: "Using the capability gave a root shell.",
      },
    ],
  },
  {
    sectionId: "bsl-proof",
    steps: [
      {
        id: "b7",
        command: "hostname; ip -4 addr show eth0 | grep inet; cat /root/proof.txt",
        evidence: { kind: "screenshot", text: "Terminal showing hostname BSL-01, 10.13.37.33 and proof.txt [value recorded]" },
        explanation: "proof.txt was read as root with the hostname and IP address in the same screenshot.",
      },
    ],
  },
  {
    sectionId: "remediation",
    prose:
      "Render user input as data, never as a template, and remove the development server from production. Remove cap_setuid from /opt/tools/backup-helper and run the backup task from a scheduled job owned by root instead.",
  },
  {
    sectionId: "appendix",
    prose: "Every command used in this report, in order, with the host it ran against.",
  },
];

const meridianContent: ReportSectionContent[] = [
  { sectionId: "exec", prose: "" },
  {
    sectionId: "scope",
    prose: "Three hosts in the meridian.local domain: MER-WEB01 (10.13.37.10), MER-SQL01 (172.16.20.11) and MER-DC01 (172.16.20.5). The assessment started from an assumed-breach domain user. Internal hosts were reached through MER-WEB01.",
  },
  {
    sectionId: "method",
    prose: "Domain enumeration from the assumed-breach account, then attack path analysis, then",
  },
  {
    sectionId: "web-foothold",
    steps: [
      {
        id: "m1",
        command: "nmap -sV 10.13.37.10",
        evidence: { kind: "output", text: "80/tcp   open  http     Microsoft IIS httpd 10.0\n445/tcp  open  microsoft-ds\n5985/tcp open  http     Microsoft HTTPAPI 2.0 (WinRM)" },
        explanation: "IIS, SMB and WinRM were exposed on the tunnel-facing host.",
      },
      {
        id: "m2",
        command: REDACTED_COMMAND,
        evidence: { kind: "output", text: "Session opened on MER-WEB01 as MERIDIAN\\j.harlow" },
        explanation: "The assumed-breach account could log in over WinRM because it is in Remote Management Users on this host.",
      },
    ],
  },
  {
    sectionId: "web-privesc",
    steps: [
      {
        id: "m3",
        command: "whoami /priv",
        evidence: { kind: "output", text: "SeImpersonatePrivilege  Impersonate a client after authentication  Enabled" },
        explanation: "",
      },
      {
        id: "m4",
        command: "",
        evidence: { kind: "output", text: "nt authority\\system" },
        explanation: "Escalated to SYSTEM. Then dumped the local cache, found svc_sql, reused it on the SQL host and confirmed access before moving on to the domain controller.",
      },
    ],
  },
  {
    sectionId: "web-proof",
    steps: [
      {
        id: "m5",
        command: "hostname; ipconfig | findstr IPv4; type C:\\Users\\Administrator\\Desktop\\proof.txt",
        evidence: { kind: "screenshot", text: "PowerShell showing MER-WEB01, 10.13.37.10 and proof.txt [value recorded]" },
        explanation: "proof.txt was read as SYSTEM with hostname and IP in the same screenshot.",
      },
    ],
  },
  {
    sectionId: "sql-foothold",
    steps: [
      {
        id: "m6",
        command: REDACTED_COMMAND,
        evidence: { kind: "output", text: "1 account with a service principal name: svc_sql (MSSQLSvc/mer-sql01.meridian.local:1433)" },
        explanation: "svc_sql was the only service account with an SPN.",
      },
    ],
  },
];

const meridianEvidence: EvidenceItem[] = [
  { id: "ev1", kind: "command", host: "MER-WEB01", command: "nmap -sV 10.13.37.10", output: "80/tcp   open  http     Microsoft IIS httpd 10.0\n445/tcp  open  microsoft-ds\n5985/tcp open  http     Microsoft HTTPAPI 2.0", capturedAt: minutesAgo(98), used: true },
  { id: "ev2", kind: "note", host: "MER-WEB01", text: "j.harlow is in Remote Management Users on MER-WEB01 only.", capturedAt: minutesAgo(91), used: true },
  { id: "ev3", kind: "command", host: "MER-WEB01", command: "whoami /priv", output: "SeImpersonatePrivilege  Enabled\nSeChangeNotifyPrivilege Enabled", capturedAt: minutesAgo(76), used: true },
  { id: "ev4", kind: "screenshot", host: "MER-WEB01", text: "proof.txt with hostname and IP", capturedAt: minutesAgo(31), used: true },
  { id: "ev5", kind: "proof", host: "MER-WEB01", text: "proof.txt [value recorded]", capturedAt: minutesAgo(31) },
  { id: "ev6", kind: "command", host: "MER-SQL01", command: "nmap -sV 172.16.20.11", output: "1433/tcp open  ms-sql-s  Microsoft SQL Server 2019\n5985/tcp open  http      Microsoft HTTPAPI 2.0", capturedAt: minutesAgo(24) },
  { id: "ev7", kind: "note", host: "MER-SQL01", text: "svc_sql has GenericWrite on the user m.cole according to the domain graph. Check before trying the DC.", capturedAt: minutesAgo(18) },
  { id: "ev8", kind: "command", host: "MER-SQL01", command: "net group \"Domain Admins\" /domain", output: "Members\nAdministrator  m.cole", capturedAt: minutesAgo(12) },
];

const basaltEvidence: EvidenceItem[] = [
  { id: "bv1", kind: "command", host: "BSL-01", command: "nmap -sV -p- 10.13.37.33", output: "22/tcp   open  ssh\n80/tcp   open  http   nginx 1.22.1\n8080/tcp open  http   Werkzeug 2.3.7", capturedAt: daysAgo(1, 19), used: true },
  { id: "bv2", kind: "command", host: "BSL-01", command: "curl -s http://10.13.37.33:8080/status", output: "<h1>Ops dashboard</h1> Welcome back, guest", capturedAt: daysAgo(1, 19), used: true },
  { id: "bv3", kind: "screenshot", host: "BSL-01", text: "Template expression evaluated in the name field", capturedAt: daysAgo(1, 19), used: true },
  { id: "bv4", kind: "command", host: "BSL-01", command: "getcap -r / 2>/dev/null", output: "/usr/bin/ping cap_net_raw=ep\n/opt/tools/backup-helper cap_setuid=ep", capturedAt: daysAgo(1, 20), used: true },
  { id: "bv5", kind: "note", host: "BSL-01", text: "backup-helper is not in any package. Custom binary, owned by root.", capturedAt: daysAgo(1, 20) },
  { id: "bv6", kind: "proof", host: "BSL-01", text: "local.txt [value recorded]", capturedAt: daysAgo(1, 20), used: true },
  { id: "bv7", kind: "proof", host: "BSL-01", text: "proof.txt [value recorded]", capturedAt: daysAgo(1, 20), used: true },
];

const meridianCritiques: OnyxCritique[] = [
  { id: "c1", sectionId: "web-privesc", stepId: "m3", text: "This step has a command and evidence but no explanation. Say why SeImpersonatePrivilege matters on this host in one sentence." },
  { id: "c2", sectionId: "web-privesc", stepId: "m4", text: "This step is not reproducible: which command produced this output? Record the command on its own line, then split the rest into separate steps. It currently covers four actions." },
  { id: "c3", sectionId: "method", text: "The methodology stops mid-sentence. Finish it before export, or the reviewer will read it as unfinished work." },
  { id: "c4", sectionId: "exec", text: "The executive summary is empty. Write it last, in three or four sentences a non-technical reader can follow." },
];

const basaltCritiques: OnyxCritique[] = [
  { id: "c5", sectionId: "bsl-foothold", stepId: "b3", text: "The screenshot shows the result but not the request. Add the request to the evidence so a reviewer can reproduce the confirmation." },
  { id: "c6", sectionId: "appendix", text: "The appendix should list every command in order. Three commands from the foothold section are missing." },
];

const details: Record<string, ReportDetail> = {
  "rep-basalt": {
    summary: reports.find((r) => r.id === "rep-basalt")!,
    candidate: "Dana Reyes",
    hosts: ["BSL-01"],
    sections: basaltSections,
    content: basaltContent,
    evidence: basaltEvidence,
    critiques: basaltCritiques,
  },
  "rep-meridian": {
    summary: reports.find((r) => r.id === "rep-meridian")!,
    candidate: "Dana Reyes",
    hosts: ["MER-WEB01", "MER-SQL01", "MER-DC01"],
    sections: meridianSections,
    content: meridianContent,
    evidence: meridianEvidence,
    critiques: meridianCritiques,
  },
};

function shellDetail(id: string): ReportDetail | undefined {
  const summary = reports.find((r) => r.id === id);
  if (!summary) return undefined;
  const host = summary.scenarios[0] === "Kestrel" ? "KES-01" : summary.scenarios[0] === "Halcyon" ? "HAL-01" : summary.scenarios[0] === "Tamarack" ? "TMK-01" : "HAL-01";
  const done = summary.status !== "draft";
  return {
    summary,
    candidate: "Dana Reyes",
    hosts: [host],
    sections: [
      { id: "exec", title: "Executive summary", state: done ? "done" : "empty" },
      { id: "scope", title: "Scope", state: "done" },
      { id: "method", title: "Methodology", state: done ? "done" : "draft" },
      ...hostSections("h1", host, done ? ["done", "done", "done"] : ["draft", "empty", "empty"]),
      { id: "remediation", title: "Remediation", state: done ? "done" : "empty" },
      { id: "appendix", title: "Appendix: commands", state: done ? "done" : "empty" },
    ],
    content: [{ sectionId: "scope", prose: `Single host ${host}, reached over the lab tunnel.` }],
    evidence: [],
    critiques: [],
  };
}

export function reportById(id: string): ReportDetail | undefined {
  return details[id] ?? shellDetail(id);
}

export interface DebriefDetail extends Debrief {
  helpChange?: string;
  missedDetail: { text: string; why: string }[];
  reportId?: string;
}

export const debriefs: DebriefDetail[] = [
  {
    id: "deb-basalt",
    sessionId: "ses_3Lr8Kc",
    scenarioId: "basalt",
    scenarioName: "Basalt",
    date: daysAgo(1, 21),
    headline: "Privilege escalation found quickly, but your notes skip how you confirmed template injection.",
    intendedPath: [
      "Enumerate every port. The dashboard on 8080 is the only custom code on the host.",
      "Test each reflected input for template evaluation before trying anything heavier.",
      "Turn template evaluation into code execution as the dashboard account.",
      "Enumerate Linux capabilities, not only SUID bits.",
      "Use the custom binary's capability to become root and read proof.txt.",
    ],
    didWell: [
      "Full port scan before any web testing, so the 8080 service was not missed.",
      "Checked capabilities within ten minutes of the foothold.",
      "Proof screenshot shows hostname, IP and proof.txt together, as the exam requires.",
    ],
    missed: [],
    missedDetail: [
      { text: "The report shows the evaluated result but not the request that produced it.", why: "A reviewer cannot reproduce a step without the exact input. On the exam this costs points even when the flag is valid." },
      { text: "Twenty minutes went into directory brute forcing on port 80 before looking at 8080.", why: "The banner already pointed to a Python application. Reading banners first saves time on every host." },
    ],
    drillNext: [
      { label: "Drill: spot the template injection, 12 minutes", href: "/onyx/drills?drill=misconfig" },
      { label: "Playbook: you just landed a shell on Linux", href: "/onyx/playbooks" },
      { label: "Next scenario: Tamarack", href: "/catalogue/tamarack" },
    ],
    helpLevel: "coach",
    durationMin: 118,
    reportId: "rep-basalt",
  },
  {
    id: "deb-meridian-1",
    sessionId: "ses_3Kc1Zt",
    scenarioId: "meridian",
    scenarioName: "Meridian",
    date: daysAgo(3, 23),
    headline: "Good foothold and local escalation. The session expired while you were enumerating the domain by hand.",
    intendedPath: [
      "Use the assumed-breach account to map the domain and its attack paths before touching other hosts.",
      "Find the one service account with a service principal name and recover its password offline.",
      "Follow the write permission that account holds over a Domain Admin user.",
      "Pivot through MER-SQL01 to reach the domain controller.",
      "Read proof.txt on MER-DC01 as a Domain Admin.",
    ],
    didWell: [
      "Confirmed WinRM access for the assumed-breach account in the first fifteen minutes.",
      "Escalated to SYSTEM on MER-WEB01 and captured both proofs with clean screenshots.",
      "Raised the help level deliberately when stuck instead of guessing.",
    ],
    missed: [],
    missedDetail: [
      { text: "Domain enumeration was done host by host instead of with a graph of the whole domain.", why: "The path to Domain Admin runs through a permission, not a host. A graph shows it in minutes; manual queries took most of the session." },
      { text: "No notes were captured between 21:40 and 22:55.", why: "Without notes, the work in that window cannot go into the report, and you will repeat it next attempt." },
    ],
    drillNext: [
      { label: "Primer: reading domain attack paths", href: "/onyx/primers?primer=bloodhound" },
      { label: "Drill: read the attack path, 15 minutes", href: "/onyx/drills?drill=bloodhound" },
      { label: "Resume Meridian", href: "/catalogue/meridian" },
    ],
    helpLevel: "teach",
    helpChange: "Coach, raised to Teach at 21:14",
    durationMin: 186,
    reportId: "rep-meridian",
  },
  {
    id: "deb-kestrel",
    sessionId: "ses_2Zx4Lm",
    scenarioId: "kestrel",
    scenarioName: "Kestrel",
    date: daysAgo(38, 21),
    headline: "Clean second attempt. You adapted the public exploit instead of running it blind.",
    intendedPath: [
      "Identify the file transfer service and its exact version from the banner.",
      "Match the version to a public advisory and read the exploit before running it.",
      "Find the unquoted service path during local enumeration.",
      "Restart the service to gain SYSTEM and read proof.txt.",
    ],
    didWell: ["Read and edited the public exploit before use.", "Documented every step as you went.", "Finished in 96 minutes."],
    missed: [],
    missedDetail: [{ text: "The remediation section recommends a patch but not the service path fix.", why: "Each finding needs its own remediation. Reviewers check for a one-to-one match." }],
    drillNext: [{ label: "Next scenario: Tamarack", href: "/catalogue/tamarack" }],
    helpLevel: "nudge",
    durationMin: 96,
    reportId: "rep-kestrel",
  },
  {
    id: "deb-halcyon",
    sessionId: "ses_2Ra3Ce",
    scenarioId: "halcyon",
    scenarioName: "Halcyon",
    date: daysAgo(46, 21),
    headline: "Solid first standalone. Stabilise your shell earlier next time.",
    intendedPath: ["Find the upload form and test what the filter actually checks.", "Get a shell as the web user and stabilise it.", "Find the writable script that root runs on a schedule.", "Read proof.txt as root."],
    didWell: ["Tested the upload filter methodically.", "Found the scheduled task through process monitoring."],
    missed: [],
    missedDetail: [{ text: "Two reverse shells were lost before you stabilised one.", why: "An unstable shell drops on the first interactive command. Stabilising first saves time on every Linux host." }],
    drillNext: [{ label: "Playbook: you just landed a shell on Linux", href: "/onyx/playbooks" }],
    helpLevel: "coach",
    durationMin: 74,
    reportId: "rep-halcyon",
  },
  {
    id: "deb-lattice",
    sessionId: "ses_2Mk5Vb",
    scenarioId: "lattice",
    scenarioName: "Lattice",
    date: daysAgo(60, 20),
    headline: "Fast and tidy. No report was written for this run.",
    intendedPath: ["Confirm command injection in the network utility page.", "Get a shell as the web user.", "Review sudo rights and escape the allowed pager.", "Read proof.txt as root."],
    didWell: ["Confirmed injection with a harmless command before anything else.", "Checked sudo rights first after the foothold."],
    missed: [],
    missedDetail: [{ text: "No report was started.", why: "Short labs are the cheapest place to build the documentation habit." }],
    drillNext: [{ label: "Start a report for Lattice", href: "/reports?new=1" }],
    helpLevel: "shadow",
    durationMin: 52,
  },
];

for (const d of debriefs) d.missed = d.missedDetail.map((m) => m.text);

export function debriefById(id: string): DebriefDetail | undefined {
  return debriefs.find((d) => d.id === id);
}

export const HOUSE_STYLE = [
  "One step is one command, one piece of evidence and one or two sentences.",
  "Put the command on its own line, exactly as you ran it.",
  "Evidence is the output that command produced, or a screenshot of it.",
  "Explain what the evidence shows and why it matters. Nothing else.",
];
