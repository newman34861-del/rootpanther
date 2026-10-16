import type { Sql } from "postgres";

/**
 * The published catalogue, as content rather than as a migration.
 *
 * Kept out of drizzle/ on purpose. A migration runs once and is never revisited, which
 * is the wrong shape for content that gets corrected: fixing a typo in a scenario brief
 * would otherwise mean writing a second migration to undo the first. This is matched on
 * slug and replaced, so a content change is a re-run.
 */

interface SeedHost {
  key: string;
  name: string;
  ip: string;
  os: "windows" | "linux";
  role: string;
  exposure: "learner-facing" | "internal";
  ports?: number[];
  proofs?: string[];
}

interface SeedScenario {
  slug: string;
  name: string;
  type: "ad-set" | "standalone" | "exam-sim";
  tier: "C1" | "C2" | "C3" | "C4";
  objective: string;
  domain: string;
  os: "windows" | "linux" | "mixed";
  techniques: string[];
  estMinutes: number;
  difficulty: number;
  publishedDaysAgo: number;
  summary: string;
  teaches: string[];
  hosts: SeedHost[];
  links: { from: string; to: string; label?: string }[];
  credential?: { username: string; password: string };
  proofRequirements: string[];
  prerequisites: { label: string; kind: "scenario" | "primer"; ref: string }[];
}

const STANDALONE_PROOFS = [
  "local.txt read as a low-privileged user, with hostname and IP in the same screenshot",
  "proof.txt read as root or SYSTEM, with hostname and IP in the same screenshot",
];

const AD_PROOFS = [
  "local.txt on the foothold host",
  "proof.txt on each member server you compromise",
  "proof.txt on the domain controller, read as a Domain Admin",
];

const EXAM_PROOFS = [
  "Proofs scored per host: 10 points per standalone flag pair, 40 points for the AD set",
  "A report submitted within 24 hours of the run ending",
];

function examHosts(prefix: string, base: number): SeedHost[] {
  const lower = prefix.toLowerCase();
  return [
    { key: `${lower}-s1`, name: `${prefix}-S1`, ip: `10.13.37.${base}`, os: "linux", role: "Standalone target", exposure: "learner-facing" },
    { key: `${lower}-s2`, name: `${prefix}-S2`, ip: `10.13.37.${base + 1}`, os: "windows", role: "Standalone target", exposure: "learner-facing" },
    { key: `${lower}-s3`, name: `${prefix}-S3`, ip: `10.13.37.${base + 2}`, os: "linux", role: "Standalone target", exposure: "learner-facing" },
    { key: `${lower}-ms01`, name: `${prefix}-MS01`, ip: `10.13.37.${base + 3}`, os: "windows", role: "AD set foothold", exposure: "learner-facing" },
    { key: `${lower}-ms02`, name: `${prefix}-MS02`, ip: `172.16.${base}.12`, os: "windows", role: "AD set member", exposure: "internal" },
    { key: `${lower}-dc01`, name: `${prefix}-DC01`, ip: `172.16.${base}.5`, os: "windows", role: "AD set domain controller", exposure: "internal" },
  ];
}

function examLinks(prefix: string) {
  const lower = prefix.toLowerCase();
  return [
    { from: `${lower}-ms01`, to: `${lower}-ms02`, label: "pivot" },
    { from: `${lower}-ms02`, to: `${lower}-dc01` },
  ];
}

export const CATALOGUE: SeedScenario[] = [
  {
    slug: "meridian",
    name: "Meridian",
    type: "ad-set",
    tier: "C2",
    objective: "Domain Admin",
    domain: "meridian.local",
    os: "windows",
    techniques: ["kerberoasting", "acl-abuse", "lateral-movement", "domain-dominance"],
    estMinutes: 240,
    difficulty: 3,
    publishedDaysAgo: 40,
    summary:
      "A three-host domain behind an IIS foothold. Service accounts with weak passwords and a misdelegated ACL lead to the domain controller.",
    teaches: [
      "Enumerate a domain from a low-privileged foothold with BloodHound and LDAP queries",
      "Request and crack service tickets for accounts with SPNs",
      "Abuse GenericWrite on a user object to take over an account",
      "Pivot through a member server to reach the internal subnet",
      "Extract domain credentials once you hold replication rights",
    ],
    hosts: [
      { key: "mer-web01", name: "MER-WEB01", ip: "10.13.37.10", os: "windows", role: "IIS web server, domain member", exposure: "learner-facing", ports: [80, 135, 445, 5985], proofs: ["local", "proof"] },
      { key: "mer-sql01", name: "MER-SQL01", ip: "172.16.20.11", os: "windows", role: "SQL Server 2019, domain member", exposure: "internal", ports: [135, 445, 1433, 5985] },
      { key: "mer-dc01", name: "MER-DC01", ip: "172.16.20.5", os: "windows", role: "Domain controller", exposure: "internal", ports: [53, 88, 135, 389, 445, 636] },
    ],
    links: [
      { from: "mer-web01", to: "mer-sql01", label: "pivot" },
      { from: "mer-sql01", to: "mer-dc01" },
    ],
    credential: { username: "MERIDIAN\\j.harlow", password: "Autumn#2026" },
    proofRequirements: AD_PROOFS,
    prerequisites: [
      { label: "Kerberoasting primer", kind: "primer", ref: "kerberoasting" },
      { label: "Reading BloodHound paths", kind: "primer", ref: "bloodhound" },
    ],
  },
  {
    slug: "tamarack",
    name: "Tamarack",
    type: "standalone",
    tier: "C2",
    objective: "SYSTEM",
    domain: "tamarack.lab",
    os: "windows",
    techniques: ["service-exploitation", "windows-privesc"],
    estMinutes: 150,
    difficulty: 2,
    publishedDaysAgo: 30,
    summary: "A monitoring agent with an authenticated RCE, then SeImpersonatePrivilege.",
    teaches: [
      "Recover credentials from a configuration backup",
      "Exploit an authenticated RCE",
      "Abuse SeImpersonatePrivilege",
    ],
    hosts: [
      { key: "tmk-01", name: "TMK-01", ip: "10.13.37.36", os: "windows", role: "Windows Server 2022", exposure: "learner-facing", ports: [80, 135, 445, 3389, 5985] },
    ],
    links: [],
    proofRequirements: STANDALONE_PROOFS,
    prerequisites: [],
  },
  {
    slug: "granite",
    name: "Granite",
    type: "exam-sim",
    tier: "C2",
    objective: "70 points in 23h 45m",
    domain: "granite.exam",
    os: "mixed",
    techniques: [
      "web-to-shell",
      "service-exploitation",
      "linux-privesc",
      "windows-privesc",
      "kerberoasting",
      "lateral-movement",
    ],
    estMinutes: 1425,
    difficulty: 3,
    publishedDaysAgo: 70,
    summary:
      "Three standalone hosts and a three-host AD set, scored like the exam. Onyx is locked to Exam sim for the full run.",
    teaches: [
      "Plan time across six hosts",
      "Document as you go under a deadline",
      "Recover from a dead end without losing an hour",
    ],
    hosts: examHosts("GRN", 90),
    links: examLinks("GRN"),
    proofRequirements: EXAM_PROOFS,
    prerequisites: [
      { label: "Meridian", kind: "scenario", ref: "meridian" },
      { label: "Tamarack", kind: "scenario", ref: "tamarack" },
    ],
  },
  {
    slug: "obsidian",
    name: "Obsidian",
    type: "exam-sim",
    tier: "C3",
    objective: "70 points in 23h 45m",
    domain: "obsidian.exam",
    os: "mixed",
    techniques: [
      "web-to-shell",
      "service-exploitation",
      "windows-privesc",
      "linux-privesc",
      "acl-abuse",
      "delegation",
      "lateral-movement",
    ],
    estMinutes: 1425,
    difficulty: 4,
    publishedDaysAgo: 25,
    summary: "A harder full simulation. The AD set needs an ACL chain and delegation abuse to finish.",
    teaches: [
      "Sustain methodology across a long run",
      "Prioritise hosts by expected points",
      "Write a report that would pass review",
    ],
    hosts: examHosts("OBS", 80),
    links: examLinks("OBS"),
    proofRequirements: EXAM_PROOFS,
    prerequisites: [{ label: "Granite", kind: "scenario", ref: "granite" }],
  },
];

export async function seedCatalogue(client: Sql): Promise<number> {
  for (const s of CATALOGUE) {
    const publishedAt = new Date(Date.now() - s.publishedDaysAgo * 86_400_000).toISOString();
    await client.begin(async (tx) => {
      const [row] = await tx<{ id: string }[]>`
        insert into scenarios (
          slug, name, type, tier, objective, domain, os, est_minutes, host_count,
          difficulty, summary, status, published_at, updated_at
        ) values (
          ${s.slug}, ${s.name}, ${s.type}, ${s.tier}, ${s.objective}, ${s.domain}, ${s.os},
          ${s.estMinutes}, ${s.hosts.length}, ${s.difficulty}, ${s.summary}, 'published',
          ${publishedAt}, now()
        )
        on conflict (slug) do update set
          name = excluded.name,
          type = excluded.type,
          tier = excluded.tier,
          objective = excluded.objective,
          domain = excluded.domain,
          os = excluded.os,
          est_minutes = excluded.est_minutes,
          host_count = excluded.host_count,
          difficulty = excluded.difficulty,
          summary = excluded.summary,
          status = excluded.status,
          published_at = excluded.published_at,
          updated_at = now()
        returning id
      `;
      const id = row.id;

      // Replaced rather than merged. A technique removed from the brief has to disappear
      // from the facets too, and an upsert on its own would leave it behind.
      await tx`delete from scenario_techniques where scenario_id = ${id}`;
      await tx`delete from scenario_teaches where scenario_id = ${id}`;
      await tx`delete from scenario_proof_requirements where scenario_id = ${id}`;
      await tx`delete from scenario_prerequisites where scenario_id = ${id}`;
      await tx`delete from scenario_links where scenario_id = ${id}`;
      await tx`delete from scenario_hosts where scenario_id = ${id}`;
      await tx`delete from scenario_credentials where scenario_id = ${id}`;

      for (const technique of s.techniques) {
        await tx`insert into scenario_techniques (scenario_id, technique) values (${id}, ${technique})`;
      }
      for (const [i, text] of s.teaches.entries()) {
        await tx`insert into scenario_teaches (scenario_id, position, text) values (${id}, ${i}, ${text})`;
      }
      for (const [i, text] of s.proofRequirements.entries()) {
        await tx`insert into scenario_proof_requirements (scenario_id, position, text) values (${id}, ${i}, ${text})`;
      }
      for (const [i, p] of s.prerequisites.entries()) {
        await tx`
          insert into scenario_prerequisites (scenario_id, position, label, kind, ref)
          values (${id}, ${i}, ${p.label}, ${p.kind}, ${p.ref})
        `;
      }
      for (const [i, h] of s.hosts.entries()) {
        await tx`
          insert into scenario_hosts (
            scenario_id, host_key, position, name, ip, os, role, exposure, ports, proofs
          ) values (
            ${id}, ${h.key}, ${i}, ${h.name}, ${h.ip}, ${h.os}, ${h.role}, ${h.exposure},
            ${h.ports ?? []}, ${h.proofs ?? []}
          )
        `;
      }
      for (const l of s.links) {
        await tx`
          insert into scenario_links (scenario_id, from_key, to_key, label)
          values (${id}, ${l.from}, ${l.to}, ${l.label ?? null})
        `;
      }
      if (s.credential) {
        await tx`
          insert into scenario_credentials (scenario_id, username, password)
          values (${id}, ${s.credential.username}, ${s.credential.password})
        `;
      }
    });
  }
  return CATALOGUE.length;
}
