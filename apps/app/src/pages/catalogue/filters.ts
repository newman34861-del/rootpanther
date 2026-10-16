import { SCENARIO_TYPE_LABEL, TECHNIQUE_LABEL, TIER_NAMES, TIER_ORDER } from "@rootpanther/ui";
import type { Scenario, TechniqueFamily, TierCode } from "@rootpanther/ui";

export type GroupId = "type" | "tier" | "technique" | "os" | "status" | "duration" | "hosts";
export type SortId = "recommended" | "newest" | "difficulty" | "duration";

export interface FilterOption {
  value: string;
  text: string;
  tier?: TierCode;
  match: (s: Scenario) => boolean;
}

export interface FilterGroup {
  id: GroupId;
  label: string;
  tagLabel: string;
  options: FilterOption[];
}

export const TECHNIQUE_ORDER: TechniqueFamily[] = [
  "web-to-shell",
  "service-exploitation",
  "linux-privesc",
  "windows-privesc",
  "local-privesc",
  "kerberoasting",
  "acl-abuse",
  "delegation",
  "lateral-movement",
  "domain-dominance",
  "trust-abuse",
];

export const GROUPS: FilterGroup[] = [
  {
    id: "type",
    label: "Type",
    tagLabel: "Type",
    options: [
      { value: "ad-set", text: "AD set", match: (s) => s.type === "ad-set" },
      { value: "standalone", text: "Standalone", match: (s) => s.type === "standalone" },
      { value: "exam-sim", text: "Exam simulation", match: (s) => s.type === "exam-sim" },
    ],
  },
  {
    id: "tier",
    label: "Path tier",
    tagLabel: "Tier",
    options: TIER_ORDER.map((t) => ({ value: t, text: `${t} ${TIER_NAMES[t]}`, tier: t, match: (s: Scenario) => s.tier === t })),
  },
  {
    id: "technique",
    label: "Technique family",
    tagLabel: "Technique",
    options: TECHNIQUE_ORDER.map((t) => ({ value: t, text: TECHNIQUE_LABEL[t], match: (s: Scenario) => s.techniques.includes(t) })),
  },
  {
    id: "os",
    label: "OS",
    tagLabel: "OS",
    options: [
      { value: "windows", text: "Windows", match: (s) => s.os === "windows" },
      { value: "linux", text: "Linux", match: (s) => s.os === "linux" },
      { value: "mixed", text: "Mixed", match: (s) => s.os === "mixed" },
    ],
  },
  {
    id: "status",
    label: "Status",
    tagLabel: "Status",
    options: [
      { value: "not-started", text: "Not started", match: (s) => s.status === "not-started" },
      { value: "in-progress", text: "In progress", match: (s) => s.status === "in-progress" },
      { value: "completed", text: "Completed", match: (s) => s.status === "completed" },
    ],
  },
  {
    id: "duration",
    label: "Duration",
    tagLabel: "Duration",
    options: [
      { value: "under-2h", text: "Under 2h", match: (s) => s.estMinutes < 120 },
      { value: "2h-4h", text: "2h to 4h", match: (s) => s.estMinutes >= 120 && s.estMinutes <= 240 },
      { value: "over-4h", text: "Over 4h", match: (s) => s.estMinutes > 240 },
    ],
  },
  {
    id: "hosts",
    label: "Host count",
    tagLabel: "Hosts",
    options: [
      { value: "1", text: "1 host", match: (s) => s.hostCount === 1 },
      { value: "2-3", text: "2 to 3 hosts", match: (s) => s.hostCount >= 2 && s.hostCount <= 3 },
      { value: "4-plus", text: "4 or more", match: (s) => s.hostCount >= 4 },
    ],
  },
];

export const SORTS: { value: SortId; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "newest", label: "Newest" },
  { value: "difficulty", label: "Difficulty, lowest first" },
  { value: "duration", label: "Duration, shortest first" },
];

export type Selection = Record<GroupId, string[]>;

export function readSelection(params: URLSearchParams): Selection {
  const out = {} as Selection;
  for (const g of GROUPS) {
    const allowed = g.options.map((o) => o.value);
    out[g.id] = (params.get(g.id) ?? "").split(",").filter((v, i, all) => allowed.includes(v) && all.indexOf(v) === i);
  }
  return out;
}

export function readSort(params: URLSearchParams): SortId {
  const v = params.get("sort");
  return SORTS.some((s) => s.value === v) ? (v as SortId) : "recommended";
}

function searchText(s: Scenario): string {
  return [s.name, s.domain, s.objective, s.summary, SCENARIO_TYPE_LABEL[s.type], s.tier, TIER_NAMES[s.tier], ...s.techniques.map((t) => TECHNIQUE_LABEL[t])].join(" ").toLowerCase();
}

export function matches(s: Scenario, sel: Selection, q: string, except?: GroupId): boolean {
  for (const g of GROUPS) {
    if (g.id === except) continue;
    const vals = sel[g.id];
    if (vals.length && !g.options.some((o) => vals.includes(o.value) && o.match(s))) return false;
  }
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length) {
    const text = searchText(s);
    if (!terms.every((t) => text.includes(t))) return false;
  }
  return true;
}

export function sortScenarios(list: Scenario[], sort: SortId, userTier: TierCode): Scenario[] {
  const tierIdx = (t: TierCode) => TIER_ORDER.indexOf(t);
  const rank = (s: Scenario) => {
    if (s.recommended) return 0;
    if (s.status === "in-progress") return 1;
    if (s.status === "not-started") return s.tier === userTier ? 2 : 3;
    return 4;
  };
  const byName = (a: Scenario, b: Scenario) => a.name.localeCompare(b.name);
  const sorted = [...list];
  switch (sort) {
    case "newest":
      return sorted.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    case "difficulty":
      return sorted.sort((a, b) => a.difficulty - b.difficulty || tierIdx(a.tier) - tierIdx(b.tier) || byName(a, b));
    case "duration":
      return sorted.sort((a, b) => a.estMinutes - b.estMinutes || byName(a, b));
    default:
      return sorted.sort(
        (a, b) =>
          rank(a) - rank(b) ||
          Math.abs(tierIdx(a.tier) - tierIdx(userTier)) - Math.abs(tierIdx(b.tier) - tierIdx(userTier)) ||
          tierIdx(a.tier) - tierIdx(b.tier) ||
          byName(a, b),
      );
  }
}
