import { formatDate } from "@rootpanther/ui";
import type { EvidenceItem, ReportSection, ReportStatus, Tone } from "@rootpanther/ui";
import { REDACTED_COMMAND } from "../../mock/reports";
import type { ReportDetail, ReportStep } from "../../mock/reports";

export const STATUS_TONE: Record<ReportStatus, Tone> = { draft: "primary", complete: "success", exported: "info" };
export const STATUS_LABEL: Record<ReportStatus, string> = { draft: "Draft", complete: "Complete", exported: "Exported" };

export interface SectionBody {
  prose?: string;
  steps?: ReportStep[];
}

export type ContentMap = Record<string, SectionBody>;

export type SectionKind = "prose" | "host" | "steps";

export function sectionKind(s: ReportSection): SectionKind {
  if (s.parentId) return "steps";
  if (s.host) return "host";
  return "prose";
}

export function sectionLabel(s: ReportSection): string {
  const kind = sectionKind(s);
  if (kind === "host") return `Findings: ${s.host}`;
  if (kind === "steps") return `${s.host}: ${s.title}`;
  return s.title;
}

export function findSection(sections: ReportSection[], param: string | null): ReportSection | undefined {
  if (!param) return undefined;
  const q = param.trim().toLowerCase();
  return (
    sections.find((s) => sectionLabel(s).toLowerCase() === q) ??
    sections.find((s) => sectionKind(s) === "host" && s.title.toLowerCase() === q) ??
    sections.find((s) => sectionKind(s) === "steps" && `${s.host} ${s.title}`.toLowerCase() === q) ??
    sections.find((s) => s.title.toLowerCase() === q)
  );
}

export function isRedacted(command: string): boolean {
  return command === REDACTED_COMMAND;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function sentenceCount(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return t.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/).filter(Boolean).length;
}

export type IssueField = "command" | "evidence" | "explanation";

export interface StepIssue {
  field: IssueField;
  text: string;
}

export function stepIssues(s: ReportStep): StepIssue[] {
  const out: StepIssue[] = [];
  if (!s.command.trim()) out.push({ field: "command", text: "Missing command. Record the exact command that produced this evidence." });
  if (!s.evidence.text.trim()) {
    out.push({ field: "evidence", text: s.evidence.kind === "screenshot" ? "Missing screenshot." : "Missing evidence. Paste the output the command produced." });
  }
  const n = sentenceCount(s.explanation);
  if (n === 0) out.push({ field: "explanation", text: "Missing explanation. Say what the evidence shows and why it matters." });
  else if (n > 2) out.push({ field: "explanation", text: `${n} sentences. Keep it to two, or split this into separate steps.` });
  return out;
}

export function stepsPassing(steps: ReportStep[]): number {
  return steps.filter((s) => stepIssues(s).length === 0).length;
}

export function stepFromEvidence(e: EvidenceItem, id: string): ReportStep {
  if (e.kind === "command") return { id, command: e.command ?? "", evidence: { kind: "output", text: e.output ?? "" }, explanation: "" };
  if (e.kind === "note") return { id, command: "", evidence: { kind: "output", text: "" }, explanation: e.text ?? "" };
  return { id, command: "", evidence: { kind: "screenshot", text: e.text ?? "" }, explanation: "" };
}

export function contentMap(r: ReportDetail): ContentMap {
  const map: ContentMap = {};
  for (const c of r.content) map[c.sectionId] = { prose: c.prose, steps: c.steps?.map((s) => ({ ...s, evidence: { ...s.evidence } })) };
  return map;
}

export function emptyContentMap(r: ReportDetail): ContentMap {
  const map: ContentMap = {};
  for (const s of r.sections) map[s.id] = sectionKind(s) === "prose" ? { prose: "" } : { steps: [] };
  return map;
}

export function hasBody(s: ReportSection, body: SectionBody | undefined): boolean {
  const kind = sectionKind(s);
  if (kind === "prose") return !!body?.prose?.trim();
  if (kind === "steps") return (body?.steps?.length ?? 0) > 0;
  return false;
}

export function liveSections(sections: ReportSection[], content: ContentMap, overrides: Record<string, ReportSection["state"]>): ReportSection[] {
  const leaf = sections.map((s) => {
    if (sectionKind(s) === "host") return s;
    if (overrides[s.id]) return { ...s, state: overrides[s.id] };
    const filled = hasBody(s, content[s.id]);
    if (!filled) return { ...s, state: "empty" as const };
    return s.state === "empty" ? { ...s, state: "draft" as const } : s;
  });
  return leaf.map((s) => {
    if (sectionKind(s) !== "host") return s;
    const kids = leaf.filter((k) => k.parentId === s.id);
    const state: ReportSection["state"] = kids.every((k) => k.state === "done") ? "done" : kids.some((k) => k.state !== "empty") ? "draft" : "empty";
    return { ...s, state };
  });
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function savedLabel(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.round(diff / 60000);
  if (min < 1) return "Saved just now";
  if (min < 60) return `Saved ${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `Saved ${h} h ago`;
  return `Saved ${formatDate(iso, { day: "numeric", month: "short" })}`;
}

export interface ExportOptions {
  appendix: boolean;
  redact: boolean;
}

export const REDACTED_LABEL = "Redacted, contains credentials";
export const HIDDEN_LABEL = "Hidden in preview, contains credentials";

export function exportCommand(command: string, redact: boolean): string {
  if (!isRedacted(command)) return command;
  return redact ? "[redacted: contains credentials]" : "[hidden in preview: contains credentials]";
}

export interface AppendixRow {
  host: string;
  section: string;
  command: string;
}

export function appendixRows(sections: ReportSection[], content: ContentMap): AppendixRow[] {
  const rows: AppendixRow[] = [];
  for (const s of sections) {
    if (sectionKind(s) !== "steps") continue;
    for (const step of content[s.id]?.steps ?? []) {
      if (step.command.trim()) rows.push({ host: s.host ?? "", section: s.title, command: step.command });
    }
  }
  return rows;
}

export function toMarkdown(r: ReportDetail, sections: ReportSection[], content: ContentMap, opts: ExportOptions, date: string): string {
  const out: string[] = [
    `# ${r.summary.title}`,
    "",
    `- Candidate: ${r.candidate}`,
    `- Date: ${date}`,
    `- Scenarios: ${r.summary.scenarios.join(", ")}`,
    `- Hosts: ${r.hosts.join(", ")}`,
  ];
  const roots = sections.filter((s) => !s.parentId && (opts.appendix || s.id !== "appendix"));
  roots.forEach((s, i) => {
    const n = i + 1;
    if (sectionKind(s) === "host") {
      out.push("", `## ${n}. Findings: ${s.host}`);
      sections
        .filter((c) => c.parentId === s.id)
        .forEach((c, k) => {
          out.push("", `### ${n}.${k + 1} ${c.title}`);
          const steps = content[c.id]?.steps ?? [];
          if (steps.length === 0) out.push("", "_No steps yet._");
          steps.forEach((step, j) => {
            out.push("", `#### Step ${j + 1}`, "", "```", step.command.trim() ? exportCommand(step.command, opts.redact) : "[missing command]", "```", "");
            if (step.evidence.kind === "screenshot") out.push(`![${step.evidence.text || "Screenshot"}](evidence/${step.id}.png)`);
            else out.push("```text", step.evidence.text || "[missing evidence]", "```");
            if (step.explanation.trim()) out.push("", step.explanation.trim());
          });
        });
      return;
    }
    out.push("", `## ${n}. ${s.title}`, "", content[s.id]?.prose?.trim() || "_Not written yet._");
    if (s.id === "appendix") {
      const rows = appendixRows(sections, content);
      if (rows.length) out.push("", ...rows.map((row, k) => `${k + 1}. ${row.host}, ${row.section}: \`${exportCommand(row.command, opts.redact)}\``));
    }
  });
  return out.join("\n");
}
