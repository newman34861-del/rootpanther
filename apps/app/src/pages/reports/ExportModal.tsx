import { useEffect, useMemo, useRef, useState } from "react";
import { Button, CodeBlock, Icon, Lockup, Modal, ProgressBar, SegmentedControl, Switch, cx, formatDate, formatNumber } from "@rootpanther/ui";
import type { ReportSection } from "@rootpanther/ui";
import type { ReportDetail, ReportStep } from "../../mock/reports";
import { appendixRows, exportCommand, isRedacted, sectionKind, slugify, stepIssues, toMarkdown } from "./model";
import type { ContentMap, ExportOptions } from "./model";

export type ExportFormat = "pdf" | "md";

const STEPS_PER_PAGE = 3;

function PaperCommand({ command, redact }: { command: string; redact: boolean }) {
  if (!command.trim()) return <div className="rb-paper__cmd is-missing">Missing command</div>;
  if (isRedacted(command)) {
    return (
      <div className="rb-paper__cmd is-redacted">
        <Icon name="lock" size={10} />
        {redact ? "[redacted: contains credentials]" : "Included in the export, hidden in this preview"}
      </div>
    );
  }
  return <div className="rb-paper__cmd">{command}</div>;
}

function PaperStep({ step, n, redact }: { step: ReportStep; n: number; redact: boolean }) {
  return (
    <div className="rb-paper__step">
      <div className="rb-paper__stepn">Step {n}</div>
      <PaperCommand command={step.command} redact={redact} />
      {step.evidence.kind === "screenshot" ? (
        <div className="rb-paper__shot">
          <Icon name="camera" size={11} />
          <span>{step.evidence.text || "Screenshot missing"}</span>
        </div>
      ) : step.evidence.text.trim() ? (
        <pre className="rb-paper__out">{step.evidence.text.split("\n").slice(0, 4).join("\n")}</pre>
      ) : (
        <div className="rb-paper__cmd is-missing">Missing evidence</div>
      )}
      {step.explanation.trim() && <p className="rb-paper__exp">{step.explanation}</p>}
    </div>
  );
}

function PageFrame({ n, caption, children, className }: { n: number; caption: string; children: React.ReactNode; className?: string }) {
  return (
    <figure className="rb-pagewrap">
      <div className={cx("rb-paper", className)} data-theme="light">
        {children}
        <span className="rb-paper__folio rp-mono">{n}</span>
      </div>
      <figcaption className="rb-pagewrap__cap">{caption}</figcaption>
    </figure>
  );
}

function PdfPreview({ report, sections, content, opts, date }: { report: ReportDetail; sections: ReportSection[]; content: ContentMap; opts: ExportOptions; date: string }) {
  const roots = sections.filter((s) => !s.parentId && (opts.appendix || s.id !== "appendix"));
  const hostIndex = roots.findIndex((s) => sectionKind(s) === "host");
  const host = roots[hostIndex];
  const subsections = host ? sections.filter((s) => s.parentId === host.id) : [];

  const blocks: { sub: ReportSection; steps: { step: ReportStep; n: number }[] }[] = [];
  let shown = 0;
  let remaining = 0;
  for (const sub of subsections) {
    const steps = content[sub.id]?.steps ?? [];
    const room = Math.max(0, STEPS_PER_PAGE - shown);
    const take = steps.slice(0, room);
    remaining += steps.length - take.length;
    if (take.length || (shown < STEPS_PER_PAGE && steps.length === 0)) blocks.push({ sub, steps: take.map((step, i) => ({ step, n: i + 1 })) });
    shown += take.length;
  }

  const appx = appendixRows(sections, content);
  const totalSteps = sections.reduce((n, s) => n + (content[s.id]?.steps?.length ?? 0), 0);
  const findingsPage = 3;
  const appendixPage = findingsPage + Math.max(1, Math.ceil(totalSteps / STEPS_PER_PAGE)) + 1;

  return (
    <div className="rb-pages">
      <PageFrame n={1} caption="Page 1, cover" className="rb-cover">
        <div className="rb-cover__band">
          <Lockup size="sm" className="rb-cover__lockup" />
          <div className="rb-cover__titles">
            <span className="rb-cover__eyebrow">Penetration test report</span>
            <span className="rb-cover__title">{report.summary.title}</span>
          </div>
        </div>
        <dl className="rb-cover__facts">
          <div>
            <dt>Candidate</dt>
            <dd>{report.candidate}</dd>
          </div>
          <div>
            <dt>Date</dt>
            <dd>{date}</dd>
          </div>
          <div>
            <dt>Scenarios</dt>
            <dd>{report.summary.scenarios.join(", ")}</dd>
          </div>
          <div>
            <dt>Hosts</dt>
            <dd className="rp-mono">{report.hosts.join(", ")}</dd>
          </div>
        </dl>
        <div className="rb-cover__foot">
          <span>Prepared in the Rootpanther lab environment</span>
          <span>Confidential</span>
        </div>
      </PageFrame>

      {host && (
        <PageFrame n={findingsPage} caption={`Page ${findingsPage}, findings for ${host.host}`}>
          <div className="rb-paper__run">
            <span>{report.summary.title}</span>
            <span>{report.candidate}</span>
          </div>
          <div className="rb-paper__h1">
            {hostIndex + 1}. Findings: <span className="rp-mono">{host.host}</span>
          </div>
          {blocks.map((b, bi) => (
            <div key={b.sub.id} className="rb-paper__sub">
              <div className="rb-paper__h2">
                {hostIndex + 1}.{subsections.indexOf(b.sub) + 1} {b.sub.title}
              </div>
              {b.steps.length === 0 ? (
                <p className="rb-paper__none">No steps written.</p>
              ) : (
                b.steps.map(({ step, n }) => <PaperStep key={step.id} step={step} n={n} redact={opts.redact} />)
              )}
              {bi === blocks.length - 1 && remaining > 0 && <p className="rb-paper__cont">Continues on page {findingsPage + 1}</p>}
            </div>
          ))}
        </PageFrame>
      )}

      {opts.appendix && (
        <PageFrame n={appendixPage} caption={`Page ${appendixPage}, command appendix`}>
          <div className="rb-paper__run">
            <span>{report.summary.title}</span>
            <span>{report.candidate}</span>
          </div>
          <div className="rb-paper__h1">{roots.length}. Appendix: commands</div>
          {appx.length === 0 ? (
            <p className="rb-paper__none">No commands recorded yet.</p>
          ) : (
            <ol className="rb-paper__appx">
              {appx.slice(0, 14).map((r, i) => (
                <li key={i}>
                  <span className="rb-paper__appxhost rp-mono">{r.host}</span>
                  <span className={cx("rb-paper__appxcmd rp-mono", isRedacted(r.command) && "is-redacted")}>{exportCommand(r.command, opts.redact)}</span>
                </li>
              ))}
            </ol>
          )}
        </PageFrame>
      )}
    </div>
  );
}

export interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  report: ReportDetail;
  sections: ReportSection[];
  content: ContentMap;
  onExported: (format: ExportFormat, filename: string) => void;
}

export function ExportModal({ open, onClose, report, sections, content, onExported }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>("pdf");
  const [opts, setOpts] = useState<ExportOptions>({ appendix: true, redact: true });
  const [progress, setProgress] = useState<number | null>(null);
  const timer = useRef<number>();
  const date = formatDate(new Date().toISOString(), { day: "numeric", month: "long", year: "numeric" });
  const filename = `${slugify(report.summary.title)}.${format === "pdf" ? "pdf" : "md"}`;

  useEffect(() => {
    if (!open) {
      window.clearInterval(timer.current);
      setProgress(null);
    }
  }, [open]);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const markdown = useMemo(() => (format === "md" ? toMarkdown(report, sections, content, opts, date) : ""), [format, report, sections, content, opts, date]);

  const allSteps = sections.flatMap((s) => content[s.id]?.steps ?? []);
  const redactable = allSteps.filter((s) => isRedacted(s.command)).length;
  const failing = allSteps.filter((s) => stepIssues(s).length > 0).length;
  const done = sections.filter((s) => s.state === "done").length;
  const exporting = progress !== null;

  function start() {
    setProgress(0);
    const began = Date.now();
    timer.current = window.setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - began) / 1300) * 100));
      setProgress(p);
      if (p >= 100) {
        window.clearInterval(timer.current);
        window.setTimeout(() => onExported(format, filename), 160);
      }
    }, 80);
  }

  return (
    <Modal
      open={open}
      onClose={() => !exporting && onClose()}
      dismissable={!exporting}
      title="Preview and export"
      size="xl"
      className="rb-export"
      bodyClassName="rb-export__body"
      footer={
        <div className="rb-export__foot">
          {exporting ? (
            <div className="rb-export__progress" role="status">
              <ProgressBar value={progress ?? 0} size="sm" label={progress === 100 ? "Export ready" : format === "pdf" ? "Rendering pages" : "Writing Markdown"} />
            </div>
          ) : (
            <span className="rb-export__file rp-mono">{filename}</span>
          )}
          <div className="rb-export__btns">
            <Button variant="quiet" onClick={onClose} disabled={exporting}>
              Cancel
            </Button>
            <Button variant="primary" iconLeft="download" onClick={start} loading={exporting}>
              {exporting ? "Exporting" : format === "pdf" ? "Export PDF" : "Export Markdown"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="rb-export__grid">
        <div className="rb-export__opts">
          <div className="rb-export__group">
            <span className="rb-export__label">
              Format
            </span>
            <SegmentedControl<ExportFormat>
              label="Format"
              value={format}
              onChange={setFormat}
              block
              options={[
                { value: "pdf", label: "PDF" },
                { value: "md", label: "Markdown" },
              ]}
            />
          </div>
          <div className="rb-export__group">
            <span className="rb-export__label">Options</span>
            <div className="rb-export__switches">
              <Switch checked={opts.appendix} onChange={(v) => setOpts((o) => ({ ...o, appendix: v }))} label="Include command appendix" description="Every command in order, with its host." size="sm" />
              <Switch
                checked={opts.redact}
                onChange={(v) => setOpts((o) => ({ ...o, redact: v }))}
                label="Redact credentials"
                description={`Replaces ${redactable} ${redactable === 1 ? "command" : "commands"} marked as containing credentials.`}
                size="sm"
              />
            </div>
          </div>
          <div className="rb-export__group">
            <span className="rb-export__label">Readiness</span>
            <ul className="rb-export__ready">
              <li>
                <Icon name="layers" size={14} />
                <span>
                  <span className="rp-mono rp-num rp-strong">
                    {done}/{sections.length}
                  </span>{" "}
                  sections complete
                </span>
              </li>
              <li className={cx(failing > 0 && "is-warn")}>
                <Icon name={failing > 0 ? "warning" : "check"} size={14} />
                <span>
                  {failing > 0 ? (
                    <>
                      <span className="rp-mono rp-num rp-strong">{failing}</span> {failing === 1 ? "step fails" : "steps fail"} house style. {failing === 1 ? "It exports" : "They export"} as written.
                    </>
                  ) : (
                    `All ${formatNumber(allSteps.length)} steps pass house style`
                  )}
                </span>
              </li>
            </ul>
          </div>
        </div>
        <div className="rb-export__preview" aria-label={`${format === "pdf" ? "PDF" : "Markdown"} preview`} role="region" tabIndex={0}>
          {format === "pdf" ? (
            <PdfPreview report={report} sections={sections} content={content} opts={opts} date={date} />
          ) : (
            <CodeBlock code={markdown} label={filename} wrap className="rb-md" />
          )}
        </div>
      </div>
    </Modal>
  );
}
