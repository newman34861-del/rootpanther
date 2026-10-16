import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  LoadingRegion,
  Page,
  PageHeader,
  PlanRequired,
  Skeleton,
  StatusDot,
  TabPanel,
  Tabs,
  Tag,
  formatDate,
  formatDuration,
  formatNumber,
  formatRelative,
  helpLabel,
  useMediaQuery,
  useToast,
} from "@rootpanther/ui";
import type { Column, ReportSummary } from "@rootpanther/ui";
import { debriefs, reports as seedReports } from "../../mock/reports";
import type { DebriefDetail } from "../../mock/reports";
import { useDataState } from "../../review/review";
import { NewReportModal } from "./NewReportModal";
import { STATUS_LABEL, STATUS_TONE } from "./model";
import "./reports.css";

type TabId = "reports" | "debriefs";

const REPORTS_ERROR = "The report service did not respond. Your drafts are saved and nothing was lost.";

const PLAN_INCLUDES = ["Report builder with house-style checks", "Onyx reviews for reproducibility", "Report exports in PDF and Markdown", "A debrief after every lab"];

function ReportActions({ report, onDuplicate, onDelete, onExport }: { report: ReportSummary; onDuplicate: () => void; onDelete: () => void; onExport: () => void }) {
  return (
    <DropdownMenu
      label={`Actions for ${report.title}`}
      width={200}
      trigger={(p) => <IconButton {...p} icon="more" label={`Actions for ${report.title}`} size="sm" tooltip={false} />}
      items={[
        { id: "open", label: "Open", icon: "document", to: `/reports/${report.id}` },
        { id: "dup", label: "Duplicate", icon: "copy", onSelect: onDuplicate },
        { id: "export", label: "Export", icon: "download", onSelect: onExport },
        { id: "sep", divider: true },
        { id: "delete", label: "Delete", icon: "trash", danger: true, onSelect: onDelete },
      ]}
    />
  );
}

interface RowHandlers {
  onDuplicate: (r: ReportSummary) => void;
  onDelete: (r: ReportSummary) => void;
  onExport: (r: ReportSummary) => void;
}

function ReportList({ rows, loading, handlers }: { rows: ReportSummary[]; loading: boolean; handlers: RowHandlers }) {
  if (loading) {
    return (
      <LoadingRegion label="Loading reports">
        <ul className="rl-list" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="rl-list__sk">
              <Skeleton width="64%" height={12} />
              <Skeleton width={90} height={20} radius="sm" />
              <Skeleton width="48%" height={10} />
            </li>
          ))}
        </ul>
      </LoadingRegion>
    );
  }
  return (
    <ul className="rl-list" aria-label="Your reports">
      {rows.map((r) => (
        <li key={r.id} className="rl-list__row">
          <div className="rl-list__main">
            <Link to={`/reports/${r.id}`} className="rl-title rl-list__title">
              {r.title}
            </Link>
            <span className="rl-tags">
              {r.scenarios.map((s) => (
                <Tag key={s}>{s}</Tag>
              ))}
            </span>
            <span className="rl-list__meta">
              <StatusDot tone={STATUS_TONE[r.status]} label={STATUS_LABEL[r.status]} size="sm" />
              <time dateTime={r.updatedAt}>Edited {formatRelative(r.updatedAt)}</time>
              <span>
                <span className="rp-mono rp-num">{formatNumber(r.wordCount)}</span> words
              </span>
            </span>
          </div>
          <ReportActions report={r} onDuplicate={() => handlers.onDuplicate(r)} onDelete={() => handlers.onDelete(r)} onExport={() => handlers.onExport(r)} />
        </li>
      ))}
    </ul>
  );
}

function DebriefList({ items, loading }: { items: DebriefDetail[]; loading: boolean }) {
  if (loading) {
    return (
      <LoadingRegion label="Loading debriefs">
        <ul className="rl-deb" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i} className="rl-deb__sk">
              <div className="rl-deb__sk-main">
                <Skeleton width={140} height={12} />
                <Skeleton width="78%" height={10} />
              </div>
              <Skeleton width={180} height={10} />
            </li>
          ))}
        </ul>
      </LoadingRegion>
    );
  }
  return (
    <ul className="rl-deb">
      {items.map((d) => (
        <li key={d.id}>
          <Link to={`/reports/debriefs/${d.id}`} className="rl-deb__row">
            <span className="rl-deb__main">
              <span className="rl-deb__top">
                <span className="rl-deb__name">{d.scenarioName}</span>
                <time className="rl-deb__date" dateTime={d.date}>
                  {formatDate(d.date, { day: "numeric", month: "short", year: "numeric" })}
                </time>
              </span>
              <span className="rl-deb__headline">{d.headline}</span>
            </span>
            <span className="rl-deb__facts">
              <span className="rl-deb__fact">
                <span className="rl-deb__label">Help</span>
                <span className="rl-deb__value">{helpLabel(d.helpLevel)}</span>
              </span>
              <span className="rl-deb__fact">
                <span className="rl-deb__label">Duration</span>
                <span className="rl-deb__value rp-mono rp-num">{formatDuration(d.durationMin)}</span>
              </span>
            </span>
            <Icon name="chevron-right" size={15} className="rl-deb__go" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function ReportsPage() {
  const state = useDataState();
  const loading = state === "loading";
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const narrow = useMediaQuery("(max-width: 1023px)");
  const compact = useMediaQuery("(max-width: 1279px)");
  const tab: TabId = params.get("tab") === "debriefs" ? "debriefs" : "reports";
  const newOpen = params.get("new") === "1";

  const [rows, setRows] = useState<ReportSummary[]>(seedReports);
  const [pendingDelete, setPendingDelete] = useState<ReportSummary | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  const list = state === "empty" ? [] : rows;
  const debriefItems = state === "empty" ? [] : debriefs;

  function setTab(next: TabId) {
    const p = new URLSearchParams(params);
    if (next === "debriefs") p.set("tab", "debriefs");
    else p.delete("tab");
    setParams(p, { replace: true });
  }

  function setNew(open: boolean) {
    const p = new URLSearchParams(params);
    if (open) p.set("new", "1");
    else p.delete("new");
    setParams(p, { replace: true });
  }

  function duplicate(r: ReportSummary) {
    const copy: ReportSummary = { ...r, id: `${r.id}-copy-${Date.now().toString(36)}`, title: `${r.title} (copy)`, status: "draft", updatedAt: new Date().toISOString() };
    setRows((xs) => {
      const i = xs.findIndex((x) => x.id === r.id);
      return [...xs.slice(0, i + 1), copy, ...xs.slice(i + 1)];
    });
    toast.push({ title: "Report duplicated", detail: copy.title, tone: "primary" });
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const gone = pendingDelete;
    setRows((xs) => xs.filter((x) => x.id !== gone.id));
    setPendingDelete(null);
    toast.push({ title: "Report deleted", detail: gone.title });
  }

  const handlers: RowHandlers = { onDuplicate: duplicate, onDelete: setPendingDelete, onExport: (r) => navigate(`/reports/${r.id}?export=1`) };

  const allColumns: Column<ReportSummary>[] = [
    {
      id: "title",
      header: "Title",
      headerLabel: "Title",
      hideable: false,
      minWidth: 220,
      sortValue: (r) => r.title,
      cell: (r) => (
        <Link to={`/reports/${r.id}`} className="rl-title">
          {r.title}
        </Link>
      ),
      titleValue: (r) => r.title,
      truncate: true,
    },
    {
      id: "scenarios",
      header: "Scenarios",
      width: compact ? 200 : 240,
      cell: (r) => (
        <span className="rl-tags">
          {r.scenarios.map((s) => (
            <Tag key={s}>{s}</Tag>
          ))}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      width: 124,
      sortValue: (r) => ["draft", "complete", "exported"].indexOf(r.status),
      cell: (r) => <StatusDot tone={STATUS_TONE[r.status]} label={STATUS_LABEL[r.status]} size="sm" />,
    },
    {
      id: "edited",
      header: "Last edited",
      width: 124,
      sortValue: (r) => new Date(r.updatedAt).getTime(),
      cell: (r) => (
        <time dateTime={r.updatedAt} title={new Date(r.updatedAt).toLocaleString("en-GB")}>
          {formatRelative(r.updatedAt)}
        </time>
      ),
    },
    {
      id: "words",
      header: "Words",
      width: 96,
      align: "right",
      mono: true,
      sortValue: (r) => r.wordCount,
      cell: (r) => formatNumber(r.wordCount),
    },
    {
      id: "actions",
      header: <span className="rp-sr">Actions</span>,
      headerLabel: "Actions",
      hideable: false,
      width: 56,
      align: "right",
      cell: (r) => (
        <ReportActions
          report={r}
          onDuplicate={() => duplicate(r)}
          onDelete={() => setPendingDelete(r)}
          onExport={() => navigate(`/reports/${r.id}?export=1`)}
        />
      ),
    },
  ];
  const columns = compact ? allColumns.filter((c) => c.id !== "words") : allColumns;

  const sortedForList = [...list].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const emptyReports = (
    <EmptyState
      icon="document"
      title="No reports yet"
      action={
        <Button size="sm" iconLeft="plus" onClick={() => setNew(true)}>
          New report
        </Button>
      }
    >
      Start one from a lab you have attempted. Evidence you saved with <code>note</code> is ready to insert.
    </EmptyState>
  );

  const header = (
    <PageHeader
      title="Reports"
      actions={
        state !== "denied" && (
          <Button variant="primary" iconLeft="plus" onClick={() => setNew(true)}>
            New report
          </Button>
        )
      }
    />
  );

  if (state === "denied") {
    return (
      <Page width="full">
        {header}
        <Card padding="lg">
          <PlanRequired
            title="Your plan has lapsed. Existing reports are kept and can still be read."
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

  const tabs = (
    <Tabs<TabId>
      label="Reports and debriefs"
      idPrefix="rl"
      value={tab}
      onChange={setTab}
      items={[
        { id: "reports", label: "Reports", count: loading || state === "error" ? undefined : list.length },
        { id: "debriefs", label: "Debriefs", count: loading || state === "error" ? undefined : debriefItems.length },
      ]}
    />
  );

  return (
    <Page width="full" className="rl-page">
      {header}
      <div className="rl-body">
        {tabs}
        {tab === "reports" ? (
          <TabPanel id="reports" idPrefix="rl" className="rl-panel">
            {narrow ? (
              <Card padding="none" className="rl-listcard">
                {state === "error" ? (
                  <ErrorState title="Reports did not load" onRetry={() => setRetryKey((k) => k + 1)} compact>
                    {REPORTS_ERROR}
                  </ErrorState>
                ) : !loading && list.length === 0 ? (
                  emptyReports
                ) : (
                  <ReportList key={retryKey} rows={sortedForList} loading={loading} handlers={handlers} />
                )}
              </Card>
            ) : (
              <DataTable<ReportSummary>
                key={retryKey}
                caption="Your reports"
                columns={columns}
                rows={list}
                rowKey={(r) => r.id}
                defaultSort={{ id: "edited", dir: "desc" }}
                loading={loading}
                columnControls={false}
                error={
                  state === "error"
                    ? { title: "Reports did not load", detail: REPORTS_ERROR, onRetry: () => setRetryKey((k) => k + 1) }
                    : null
                }
                empty={emptyReports}
              />
            )}
          </TabPanel>
        ) : (
          <TabPanel id="debriefs" idPrefix="rl" className="rl-panel">
            <Card padding="none" className="rl-debcard">
              {state === "error" ? (
                <ErrorState title="Debriefs did not load" onRetry={() => setRetryKey((k) => k + 1)} compact>
                  The coaching service did not respond. Debriefs are generated after each lab and are not lost.
                </ErrorState>
              ) : !loading && debriefItems.length === 0 ? (
                <EmptyState
                  icon="chat"
                  title="No debriefs yet"
                  action={
                    <ButtonLink to="/catalogue" size="sm">
                      Browse scenarios
                    </ButtonLink>
                  }
                >
                  Onyx writes a debrief when each lab ends.
                </EmptyState>
              ) : (
                <DebriefList items={debriefItems} loading={loading} />
              )}
            </Card>
          </TabPanel>
        )}
      </div>
      <NewReportModal
        open={newOpen}
        onClose={() => setNew(false)}
        onCreate={() => {
          toast.push({ title: "Report created", detail: "Opened with the OSCP exam report template.", tone: "primary" });
          navigate("/reports/rep-meridian");
        }}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        destructive
        title="Delete report"
        confirmLabel="Delete report"
      >
        <p>
          <span className="rp-strong">{pendingDelete?.title}</span> and its {formatNumber(pendingDelete?.wordCount ?? 0)} words will be deleted. Evidence stays in your evidence tray.
        </p>
      </ConfirmDialog>
    </Page>
  );
}
