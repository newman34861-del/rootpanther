import { useMemo, useState } from "react";
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  DropdownMenu,
  EmptyState,
  Icon,
  IconButton,
  Input,
  SCENARIO_TYPE_LABEL,
  TECHNIQUE_LABEL,
  TechniqueTag,
  TierDot,
  Tooltip,
  formatDate,
  formatDateTime,
  formatNumber,
  useToast,
} from "@rootpanther/ui";
import type { Column } from "@rootpanther/ui";
import { CONTENT_STATUS_LABEL, PHASES, groundingScore, liveVersionOf } from "../../mock/content";
import type { ContentScenario, ContentStatus } from "../../mock/content";
import { isolation, tenants } from "../../mock/fleet";
import { ContentStatusDot, SolveDot } from "./common";

const REPO = "https://github.com/rootpanther/scenarios/tree/main";

interface Props {
  rows: ContentScenario[];
  loading: boolean;
  empty: boolean;
  selected: string | null;
  onSelect: (slug: string) => void;
  onChange: (id: string, patch: Partial<ContentScenario>) => void;
  onRunSolve: (s: ContentScenario) => void;
}

function blockReason(s: ContentScenario): string | null {
  if (s.solveTest.result === "fail") return `Solve-test failing on ${s.version}`;
  if (s.solveTest.result === "not-run") return `No solve-test run on ${s.version}`;
  if (s.solveTest.version !== s.version) return `Last pass was on ${s.solveTest.version}, not ${s.version}`;
  return null;
}

function runningLabs(s: ContentScenario) {
  return tenants.filter((t) => t.scenarioId === s.id && t.state !== "failed" && t.state !== "tearing-down").length;
}

function Checklist({ s }: { s: ContentScenario }) {
  const iso = isolation.find((r) => r.scenarioId === s.id);
  const isoOk = iso ? Object.values(iso.results).every((r) => r.pass) : false;
  const g = groundingScore(s);
  const missing = PHASES.filter((p) => s.grounding[p.id].applicable && (!s.grounding[p.id].opener || s.grounding[p.id].hints === 0));
  return (
    <ul className="cn-check">
      <li>
        <Icon name="check" size={14} className="is-ok" />
        <span>
          Solve-test passed on <span className="rp-mono">{s.version}</span>
          {s.solveTest.at && <span className="cn-check__sub rp-mono rp-num">{formatDateTime(s.solveTest.at)}</span>}
        </span>
      </li>
      <li>
        <Icon name={isoOk ? "check" : "warning"} size={14} className={isoOk ? "is-ok" : "is-warn"} />
        <span>{isoOk ? "Isolation checks passed on the current template" : "Isolation checks not passing on the current template"}</span>
      </li>
      <li>
        <Icon name={missing.length ? "warning" : "check"} size={14} className={missing.length ? "is-warn" : "is-ok"} />
        <span>
          Onyx grounding{" "}
          <span className="rp-mono rp-num">
            {g.done} of {g.total}
          </span>
          {missing.length > 0 && <>, gaps in {missing.map((p) => p.label.toLowerCase()).join(", ")}. Onyx answers ungrounded there.</>}
        </span>
      </li>
    </ul>
  );
}

export function Inventory({ rows, loading, empty, selected, onSelect, onChange, onRunSolve }: Props) {
  const toast = useToast();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | ContentStatus>("");
  const [publish, setPublish] = useState<ContentScenario | null>(null);
  const [unpublish, setUnpublish] = useState<ContentScenario | null>(null);

  const counts = useMemo(() => {
    const c: Record<ContentStatus, number> = { draft: 0, "in-review": 0, published: 0, retired: 0 };
    rows.forEach((r) => c[r.status]++);
    return c;
  }, [rows]);
  const shown = rows.filter((r) => (!status || r.status === status) && (!q || r.name.toLowerCase().includes(q.trim().toLowerCase())));

  const columns: Column<ContentScenario>[] = [
    {
      id: "name",
      header: "Scenario",
      width: 120,
      hideable: false,
      sortValue: (s) => s.name,
      cell: (s) => (
        <button type="button" className="cn-name" onClick={() => onSelect(s.slug)} aria-label={`${s.name}, show randomisation config`}>
          {s.name}
        </button>
      ),
    },
    { id: "type", header: "Type", width: 108, sortValue: (s) => s.type, cell: (s) => <Badge>{SCENARIO_TYPE_LABEL[s.type]}</Badge> },
    { id: "tier", header: "Tier", width: 76, sortValue: (s) => s.tier, cell: (s) => <TierDot tier={s.tier} display="code" size="sm" /> },
    {
      id: "tech",
      header: "Techniques",
      minWidth: 220,
      cell: (s) => {
        const fit = TECHNIQUE_LABEL[s.techniques[0]].length + (TECHNIQUE_LABEL[s.techniques[1]]?.length ?? 0) > 26 ? 1 : 2;
        const extra = s.techniques.slice(fit);
        return (
          <span className="cn-tags">
            {s.techniques.slice(0, fit).map((t) => (
              <TechniqueTag key={t} technique={t} />
            ))}
            {extra.length > 0 && (
              <Tooltip content={extra.map((t) => TECHNIQUE_LABEL[t]).join(", ")}>
                <span className="rp-tag rp-tag--more" tabIndex={0} aria-label={`${extra.length} more: ${extra.map((t) => TECHNIQUE_LABEL[t]).join(", ")}`}>
                  +{extra.length}
                </span>
              </Tooltip>
            )}
          </span>
        );
      },
    },
    {
      id: "version",
      header: "Version",
      width: 116,
      sortValue: (s) => s.version,
      cell: (s) => {
        const live = liveVersionOf(s);
        return (
          <span className="cn-ver">
            <span className="rp-mono">{s.version}</span>
            {live && live !== s.version && <span className="cn-ver__live rp-mono">live {live}</span>}
          </span>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      width: 116,
      sortValue: (s) => ["in-review", "draft", "published", "retired"].indexOf(s.status),
      cell: (s) => <ContentStatusDot status={s.status} />,
    },
    {
      id: "solve",
      header: "Solve-test",
      width: 148,
      sortValue: (s) => (s.solveTest.result === "fail" ? 0 : s.solveTest.result === "not-run" ? 1 : 2),
      cell: (s) => (
        <span className="cn-solve">
          <SolveDot result={s.solveTest.result} />
          <span className="cn-solve__at rp-mono rp-num">{s.solveTest.at ? formatDate(s.solveTest.at, { day: "numeric", month: "short" }) : `on ${s.version}`}</span>
        </span>
      ),
    },
    {
      id: "learners",
      header: "Learners",
      width: 108,
      align: "right",
      mono: true,
      sortValue: (s) => s.learnersInProgress,
      cell: (s) => (s.learnersInProgress ? formatNumber(s.learnersInProgress) : <span className="cn-dim">0</span>),
    },
    {
      id: "actions",
      header: <span className="rp-sr">Actions</span>,
      headerLabel: "Actions",
      width: 132,
      align: "right",
      hideable: false,
      cell: (s) => {
        const blocked = blockReason(s);
        const canPublish = s.status === "in-review" || s.status === "draft" || s.status === "retired";
        return (
          <div className="cn-rowactions">
            {canPublish &&
              (blocked ? (
                <a href="#solve-tests" className="cn-blocked" title={blocked}>
                  <Icon name="lock" size={13} />
                  Blocked
                  <span className="rp-sr">, {blocked}</span>
                </a>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => setPublish(s)}>
                  {s.status === "retired" ? "Republish" : "Publish"}
                </Button>
              ))}
            <DropdownMenu
              label={`Actions for ${s.name}`}
              width={232}
              items={[
                { id: "rand", label: "Randomisation config", icon: "sliders", onSelect: () => onSelect(s.slug) },
                { id: "solve", label: "Run solve-test now", icon: "play", onSelect: () => onRunSolve(s) },
                { id: "repo", label: "Open source in repo", icon: "external", to: `${REPO}/${s.slug}`, external: true },
                ...(s.status === "published" || liveVersionOf(s)
                  ? [
                      { id: "d", divider: true },
                      { id: "unpub", label: "Unpublish", icon: "x-circle" as const, danger: true, onSelect: () => setUnpublish(s) },
                    ]
                  : []),
              ]}
              trigger={(p) => <IconButton {...p} icon="more" size="sm" label={`Actions for ${s.name}`} />}
            />
          </div>
        );
      },
    },
  ];

  const statusOrder: ("" | ContentStatus)[] = ["", "published", "in-review", "draft", "retired"];

  return (
    <>
      <DataTable
        caption="Scenario inventory"
        className="cn-t cn-t--inv"
        columns={columns}
        rows={empty ? [] : shown}
        rowKey={(s) => s.id}
        loading={loading}
        density="compact"
        pageSize={25}
        rowClassName={(s) => (s.slug === selected ? "is-selected" : s.solveTest.result === "fail" ? "is-failing" : undefined)}
        defaultSort={{ id: "status", dir: "asc" }}
        toolbar={
          <div className="cn-filters">
            <div className="cn-statefilter" role="radiogroup" aria-label="Status">
              {statusOrder.map((k) => (
                <button key={k || "all"} type="button" role="radio" aria-checked={status === k} className={`cn-chip${status === k ? " is-on" : ""}`} onClick={() => setStatus(k)}>
                  {k ? CONTENT_STATUS_LABEL[k] : "All"}
                  {!loading && !empty && <span className="cn-chip__n rp-mono rp-num">{k ? counts[k] : rows.length}</span>}
                </button>
              ))}
            </div>
            <Input
              icon="search"
              inputSize="sm"
              placeholder="Filter by name"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Filter scenarios by name"
              wrapperClassName="cn-search"
            />
          </div>
        }
        footerNote={
          loading || empty ? undefined : (
            <>Learners counts accounts with the scenario in progress on its live version. Publishing needs a passing solve-test on the exact version.</>
          )
        }
        empty={
          empty ? (
            <EmptyState
              icon="layers"
              title="No scenarios in the content repository"
              compact
              action={
                <Button size="sm" variant="secondary" iconLeft="external" onClick={() => window.open(`${REPO}/_template`, "_blank", "noopener")}>
                  Open scenario template
                </Button>
              }
            >
              Scenarios appear here once their manifest is merged to main.
            </EmptyState>
          ) : (
            <EmptyState icon="search" title="No scenarios match these filters" compact />
          )
        }
      />
      <ConfirmDialog
        open={!!publish}
        onClose={() => setPublish(null)}
        title={publish ? `Publish ${publish.name} ${publish.version}` : "Publish"}
        confirmLabel={publish ? (publish.learnersInProgress ? `Publish to ${formatNumber(publish.learnersInProgress)} learners` : "Publish") : "Publish"}
        onConfirm={() => {
          const s = publish!;
          setPublish(null);
          onChange(s.id, { status: "published", liveVersion: s.version });
          toast.push({
            title: `${s.name} ${s.version} published`,
            detail: `New launches use ${s.version}. ${s.learnersInProgress} learners in progress were notified.`,
            tone: "info",
          });
        }}
      >
        {publish && (
          <>
            <p>
              {liveVersionOf(publish) && liveVersionOf(publish) !== publish.version ? (
                <>
                  Replaces <span className="rp-mono rp-strong">{liveVersionOf(publish)}</span> for new launches.{" "}
                </>
              ) : (
                <>Adds {publish.name} to the catalogue for every plan with lab access. </>
              )}
              <span className="rp-mono rp-strong">{formatNumber(publish.learnersInProgress)}</span> learners have {publish.name} in progress
              {runningLabs(publish) > 0 && (
                <>
                  , <span className="rp-mono rp-strong">{runningLabs(publish)}</span> with a lab running now that keeps its current version until it ends
                </>
              )}
              . Progress, proofs and reports carry over.
            </p>
            <Checklist s={publish} />
          </>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={!!unpublish}
        onClose={() => setUnpublish(null)}
        destructive
        title={unpublish ? `Unpublish ${unpublish.name}` : "Unpublish"}
        confirmLabel={unpublish ? `Unpublish for ${formatNumber(unpublish.learnersInProgress)} learners` : "Unpublish"}
        onConfirm={() => {
          const s = unpublish!;
          setUnpublish(null);
          onChange(s.id, { status: "retired", liveVersion: undefined });
          toast.push({ title: `${s.name} unpublished`, detail: `Removed from the catalogue. ${s.learnersInProgress} learners in progress were notified.`, tone: "neutral" });
        }}
      >
        {unpublish && (
          <p>
            Removes {unpublish.name} <span className="rp-mono">{liveVersionOf(unpublish)}</span> from the catalogue.{" "}
            <span className="rp-mono rp-strong">{formatNumber(unpublish.learnersInProgress)}</span> learners have it in progress and cannot launch it again until it is republished.{" "}
            {runningLabs(unpublish) > 0 && (
              <>
                <span className="rp-mono rp-strong">{runningLabs(unpublish)}</span> {runningLabs(unpublish) === 1 ? "lab is" : "labs are"} running now and{" "}
                {runningLabs(unpublish) === 1 ? "continues" : "continue"} until {runningLabs(unpublish) === 1 ? "it ends" : "they end"}.{" "}
              </>
            )}
            Progress, proofs and reports are kept.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
