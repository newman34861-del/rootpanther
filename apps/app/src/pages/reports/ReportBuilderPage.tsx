import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  ErrorState,
  EvidenceTray,
  LoadingRegion,
  Page,
  PageHeader,
  PlanRequired,
  ReportOutline,
  Select,
  Skeleton,
  SkeletonText,
  StatusDot,
  useMediaQuery,
  useToast,
} from "@rootpanther/ui";
import type { EvidenceItem, ReportSection, ReportStatus } from "@rootpanther/ui";
import { reportById } from "../../mock/reports";
import type { OnyxCritique, ReportDetail, ReportStep } from "../../mock/reports";
import { useDataState } from "../../review/review";
import type { DataState } from "../../review/review";
import { ExportModal } from "./ExportModal";
import { OnyxReview } from "./OnyxReview";
import type { ReviewNote } from "./OnyxReview";
import { SectionEditor } from "./SectionEditor";
import type { FocusRequest } from "./SectionEditor";
import { STATUS_LABEL, STATUS_TONE, contentMap, emptyContentMap, findSection, liveSections, savedLabel, sectionKind, sectionLabel, stepFromEvidence, stepIssues } from "./model";
import type { ContentMap } from "./model";
import "./builder.css";

const PLAN_INCLUDES = ["Report builder with house-style checks", "Onyx reviews for reproducibility", "Report exports in PDF and Markdown", "A debrief after every lab"];

// A step note counts as resolved only once the learner has edited that step and it passes house style.
function noteResolved(c: OnyxCritique, content: ContentMap, initial: ContentMap, sections: ReportSection[]): boolean {
  const s = sections.find((x) => x.id === c.sectionId);
  if (!s) return true;
  if (c.stepId) {
    const step = content[c.sectionId]?.steps?.find((x) => x.id === c.stepId);
    if (!step) return true;
    const before = initial[c.sectionId]?.steps?.find((x) => x.id === c.stepId);
    return JSON.stringify(step) !== JSON.stringify(before) && stepIssues(step).length === 0;
  }
  return s.state === "done";
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

function EditorSkeleton() {
  return (
    <LoadingRegion label="Loading section">
      <div className="rb-editor rp-card is-skeleton" aria-hidden="true">
        <div className="rb-editor__head">
          <div className="rb-editor__titles">
            <Skeleton width={180} height={18} />
            <Skeleton width={120} height={10} style={{ marginTop: 10 }} />
          </div>
          <Skeleton width={120} height={32} radius="md" />
        </div>
        <div className="rb-editor__body">
          <Skeleton height={40} radius="md" />
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="rb-step is-skeleton">
              <div className="rb-step__head">
                <Skeleton width={24} height={24} radius="sm" />
                <Skeleton width={60} height={12} />
              </div>
              <div className="rb-step__body">
                <Skeleton height={36} radius="md" />
                <Skeleton height={76} radius="md" />
                <SkeletonText lines={2} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </LoadingRegion>
  );
}

function PaneError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <ErrorState title={`${what} did not load`} onRetry={onRetry} compact>
      Your report is saved. Nothing you wrote was lost.
    </ErrorState>
  );
}

function Builder({ report, state }: { report: ReportDetail; state: DataState }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const wide = useMediaQuery("(min-width: 1280px)");
  const phone = useMediaQuery("(max-width: 767px)");
  const now = useNow(30000);

  const [initial] = useState<ContentMap>(() => (state === "empty" ? emptyContentMap(report) : contentMap(report)));
  const [content, setContent] = useState<ContentMap>(initial);
  const [overrides, setOverrides] = useState<Record<string, ReportSection["state"]>>({});
  const [evidence, setEvidence] = useState<EvidenceItem[]>(() => (state === "empty" ? [] : report.evidence));
  const [status, setStatus] = useState<ReportStatus>(report.summary.status);
  const [savedAt, setSavedAt] = useState(report.summary.updatedAt);
  const [failed, setFailed] = useState(state === "error");
  const [trayOpen, setTrayOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewedAt, setReviewedAt] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(params.get("export") === "1");
  const [dragging, setDragging] = useState(false);
  const [focus, setFocus] = useState<FocusRequest | null>(null);
  const [pendingRemove, setPendingRemove] = useState<{ step: ReportStep; index: number } | null>(null);
  const [announce, setAnnounce] = useState("");
  const seq = useRef(0);

  const loading = state === "loading";
  const sections = useMemo(() => liveSections(report.sections, content, overrides), [report.sections, content, overrides]);
  const selected = findSection(sections, params.get("section")) ?? sections.find((s) => sectionKind(s) === "steps" && s.state !== "done" && (content[s.id]?.steps?.length ?? 0) > 0) ?? sections[0];
  const trayInline = wide;

  useEffect(() => {
    function end() {
      setDragging(false);
    }
    function start(e: DragEvent) {
      if (e.dataTransfer && Array.from(e.dataTransfer.types).includes("application/x-rp-evidence")) setDragging(true);
    }
    document.addEventListener("dragstart", start);
    document.addEventListener("dragend", end);
    document.addEventListener("drop", end);
    return () => {
      document.removeEventListener("dragstart", start);
      document.removeEventListener("dragend", end);
      document.removeEventListener("drop", end);
    };
  }, []);

  useEffect(() => {
    if (!params.get("export")) return;
    const p = new URLSearchParams(params);
    p.delete("export");
    setParams(p, { replace: true });
  }, [params, setParams]);

  function touch(next?: ReportStatus) {
    setSavedAt(new Date().toISOString());
    if (next) setStatus(next);
    else if (status === "exported" || status === "complete") setStatus("draft");
  }

  function select(id: string, f?: Omit<FocusRequest, "nonce">) {
    const s = sections.find((x) => x.id === id);
    if (!s) return;
    const p = new URLSearchParams(params);
    p.set("section", sectionLabel(s));
    setParams(p, { replace: true });
    setFocus(f ? { ...f, nonce: Date.now() } : null);
  }

  function setSteps(steps: ReportStep[], msg?: string) {
    setContent((c) => ({ ...c, [selected.id]: { ...c[selected.id], steps } }));
    setOverrides((o) => {
      if (o[selected.id] !== "done") return o;
      const rest = { ...o };
      delete rest[selected.id];
      return rest;
    });
    if (msg) setAnnounce(msg);
    touch();
  }

  function newStepId() {
    seq.current += 1;
    return `new-${seq.current}`;
  }

  function insert(item: EvidenceItem) {
    const kind = sectionKind(selected);
    if (kind === "host") {
      toast.push({ title: "Pick a subsection first", detail: `Open Foothold, Privilege escalation or Proof under ${selected.host} to insert evidence.` });
      return;
    }
    if (kind === "prose") {
      const text = item.kind === "command" ? item.command ?? "" : item.text ?? "";
      setContent((c) => {
        const prev = c[selected.id]?.prose ?? "";
        return { ...c, [selected.id]: { ...c[selected.id], prose: prev.trim() ? `${prev.trimEnd()}\n\n${text}` : text } };
      });
      setEvidence((xs) => xs.map((x) => (x.id === item.id ? { ...x, used: true } : x)));
      setAnnounce(`Inserted into ${selected.title}`);
      setFocus({ nonce: Date.now() });
      setTrayOpen(false);
      touch();
      return;
    }
    const step = stepFromEvidence(item, newStepId());
    const steps = content[selected.id]?.steps ?? [];
    setSteps([...steps, step], `Inserted as step ${steps.length + 1} in ${selected.title}`);
    setEvidence((xs) => xs.map((x) => (x.id === item.id ? { ...x, used: true } : x)));
    setTrayOpen(false);
    window.setTimeout(() => setFocus({ stepId: step.id, nonce: Date.now(), edit: true }), 0);
  }

  function addStep() {
    const step: ReportStep = { id: newStepId(), command: "", evidence: { kind: "output", text: "" }, explanation: "" };
    const steps = content[selected.id]?.steps ?? [];
    setSteps([...steps, step], `Step ${steps.length + 1} added`);
    window.setTimeout(() => setFocus({ stepId: step.id, nonce: Date.now(), edit: true }), 0);
  }

  function confirmRemove() {
    if (!pendingRemove) return;
    const steps = content[selected.id]?.steps ?? [];
    setSteps(
      steps.filter((s) => s.id !== pendingRemove.step.id),
      `Step ${pendingRemove.index + 1} removed`,
    );
    setPendingRemove(null);
  }

  function toggleDone() {
    const done = selected.state === "done";
    const next = { ...overrides, [selected.id]: done ? ("draft" as const) : ("done" as const) };
    const allDone = liveSections(report.sections, content, next).every((s) => s.state === "done");
    setOverrides(next);
    setAnnounce(done ? `${selected.title} reopened` : allDone ? "Every section is complete. The report is marked complete." : `${selected.title} marked complete`);
    touch(allDone ? "complete" : "draft");
  }

  function runReview() {
    setReviewing(true);
    setReviewOpen(true);
    window.setTimeout(() => {
      setReviewing(false);
      setReviewedAt(new Date().toISOString());
    }, 1100);
  }

  const notes: ReviewNote[] = state === "empty" ? [] : report.critiques.map((c) => ({ ...c, resolved: noteResolved(c, content, initial, sections) }));
  const openNotes = notes.filter((n) => !n.resolved).length;

  function goToCritique(c: OnyxCritique) {
    setReviewOpen(false);
    window.setTimeout(() => select(c.sectionId, { stepId: c.stepId }), 0);
  }

  const outlineSelect = (
    <Select
      aria-label="Section"
      value={selected.id}
      onChange={(e) => select(e.target.value)}
      options={sections.map((s) => ({
        value: s.id,
        label: `${sectionLabel(s)}${s.state === "done" ? ", complete" : s.state === "draft" ? ", draft" : ""}`,
      }))}
    />
  );

  const tray = failed ? (
    <PaneError what="Evidence" onRetry={() => setFailed(false)} />
  ) : (
    <EvidenceTray items={evidence} onInsert={insert} hosts={report.hosts} loading={loading} />
  );

  const editor = loading ? (
    <EditorSkeleton />
  ) : failed ? (
    <Card>
      <PaneError what="This section" onRetry={() => setFailed(false)} />
    </Card>
  ) : (
    <SectionEditor
      key={selected.id}
      section={selected}
      sections={sections}
      content={content}
      notes={notes}
      dragging={dragging}
      focus={focus}
      trayInline={trayInline}
      evidenceCount={evidence.length}
      onOpenTray={() => setTrayOpen(true)}
      onSelect={(id) => select(id, {})}
      onProse={(v) => {
        setContent((c) => ({ ...c, [selected.id]: { ...c[selected.id], prose: v } }));
        touch();
      }}
      onSteps={setSteps}
      onAddStep={addStep}
      onRequestRemove={(step, index) => {
        const empty = !step.command.trim() && !step.evidence.text.trim() && !step.explanation.trim();
        if (empty) {
          const steps = content[selected.id]?.steps ?? [];
          setSteps(
            steps.filter((s) => s.id !== step.id),
            `Step ${index + 1} removed`,
          );
        } else setPendingRemove({ step, index });
      }}
      onDropEvidence={(id) => {
        const item = evidence.find((e) => e.id === id);
        if (item) insert(item);
      }}
      onToggleDone={toggleDone}
      onCritique={() => setReviewOpen(true)}
    />
  );

  const hostCount = report.hosts.length;
  const meta = (
    <>
      <StatusDot tone={STATUS_TONE[status]} label={STATUS_LABEL[status]} size="sm" />
      <span>{report.summary.scenarios.join(", ")}</span>
      <span>
        <span className="rp-mono rp-num">{hostCount}</span> {hostCount === 1 ? "host" : "hosts"}
      </span>
      {!loading && <span aria-live="polite">{savedLabel(savedAt, now)}</span>}
    </>
  );

  return (
    <Page width="full" className="rb-page">
      <PageHeader
        crumbs={[{ label: "Reports", to: "/reports" }, { label: report.summary.title }]}
        title={report.summary.title}
        meta={meta}
        actions={
          <>
            <Button iconLeft="chat" onClick={runReview} disabled={loading || failed}>
              Ask Onyx to review
              {openNotes > 0 && (
                <span className="rb-count rp-mono rp-num" aria-label={`${openNotes} open notes`}>
                  {openNotes}
                </span>
              )}
            </Button>
            <Button variant="primary" iconLeft="download" onClick={() => setExportOpen(true)} disabled={loading || failed}>
              Preview and export
            </Button>
          </>
        }
      />

      <div className={wide ? "rb-layout is-wide" : "rb-layout"}>
        {phone ? (
          <div className="rb-outline-select">{loading ? <Skeleton height={36} radius="md" /> : failed ? null : outlineSelect}</div>
        ) : (
          <aside className="rb-outline" aria-label="Outline">
            {failed ? <PaneError what="The outline" onRetry={() => setFailed(false)} /> : <ReportOutline sections={sections} selectedId={selected.id} onSelect={(id) => select(id)} loading={loading} />}
          </aside>
        )}
        <div className="rb-main">{editor}</div>
        {trayInline && <div className="rb-tray">{tray}</div>}
      </div>

      {!trayInline && (
        <Drawer open={trayOpen} onClose={() => setTrayOpen(false)} title="Evidence" meta={`Inserts into ${sectionLabel(selected)}`} width={360}>
          {tray}
        </Drawer>
      )}

      <OnyxReview
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        reviewing={reviewing}
        reviewedAt={reviewedAt}
        notes={notes}
        sections={sections}
        content={content}
        onGo={goToCritique}
        onRerun={runReview}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        report={report}
        sections={sections}
        content={content}
        onExported={(format, filename) => {
          setExportOpen(false);
          touch("exported");
          toast.push({
            title: format === "pdf" ? "PDF exported" : "Markdown exported",
            detail: filename,
            tone: "info",
            action: { label: "All reports", onClick: () => navigate("/reports") },
          });
        }}
      />

      <ConfirmDialog
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        onConfirm={confirmRemove}
        destructive
        title={`Remove step ${(pendingRemove?.index ?? 0) + 1}`}
        confirmLabel="Remove step"
      >
        <p>The command, evidence and explanation in this step will be removed. Evidence in the tray is not affected.</p>
      </ConfirmDialog>

      <div className="rp-sr" aria-live="polite">
        {announce}
      </div>
    </Page>
  );
}

export default function ReportBuilderPage() {
  const { id = "" } = useParams();
  const state = useDataState();
  const report = reportById(id);

  if (!report) {
    return (
      <Page width="narrow">
        <EmptyState
          icon="document"
          title="No report with this ID"
          action={
            <ButtonLink to="/reports" variant="secondary" iconLeft="arrow-left">
              All reports
            </ButtonLink>
          }
        >
          <span className="rp-mono">{id}</span> was deleted or never existed.
        </EmptyState>
      </Page>
    );
  }

  if (state === "denied") {
    return (
      <Page width="full">
        <PageHeader crumbs={[{ label: "Reports", to: "/reports" }, { label: report.summary.title }]} title={report.summary.title} />
        <Card padding="lg">
          <PlanRequired
            title="Editing and export need an active plan. This report is kept as written."
            plan="Practitioner"
            includes={PLAN_INCLUDES}
            action={
              <ButtonLink to="/billing" variant="primary" iconLeft="refresh">
                Reactivate for $49 / month
              </ButtonLink>
            }
          />
        </Card>
      </Page>
    );
  }

  return <Builder key={`${id}:${state}`} report={report} state={state} />;
}

