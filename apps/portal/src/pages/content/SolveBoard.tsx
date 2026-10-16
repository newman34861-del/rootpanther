import { Button, Callout, DataTable, EmptyState, StatusDot, formatDateTime, formatRelative } from "@rootpanther/ui";
import type { Column } from "@rootpanther/ui";
import { ciSchedule } from "../../mock/content";
import type { ContentScenario, SolveRun } from "../../mock/content";
import { SolveDot, secs } from "./common";

interface Props {
  rows: ContentScenario[];
  loading: boolean;
  empty: boolean;
  running: string[];
  onRun: (s: ContentScenario) => void;
  onRunAll: () => void;
}

function RunStrip({ runs, name, version }: { runs: SolveRun[]; name: string; version: string }) {
  const ordered = [...runs].reverse();
  const fails = runs.filter((r) => r.result === "fail").length;
  return (
    <span
      className="cn-strip"
      role="img"
      aria-label={`${name}, last ${runs.length} runs: ${runs.length - fails} passed, ${fails} failed. Most recent ${runs[0]?.result === "fail" ? "failed" : "passed"}.`}
    >
      {ordered.map((r) => (
        <span
          key={r.id}
          className={`cn-strip__run is-${r.result}${r.version !== version ? " is-old" : ""}`}
          title={`${r.id}, ${r.version}, ${r.result === "pass" ? "passed" : "failed"}, ${formatDateTime(r.at)}, ${secs(r.durationSec)}`}
        />
      ))}
    </span>
  );
}

function Checks({ s }: { s: ContentScenario }) {
  const t = s.solveTest;
  if (t.result === "not-run") return <span className="cn-dim">Not run on {s.version}</span>;
  return (
    <span className="cn-checks">
      <span className={t.solvable ? "is-ok" : "is-bad"}>{t.solvable ? "Solvable" : "Not solvable"}</span>
      <span className={t.shortcutFree ? "is-ok" : "is-bad"}>{t.shortcutFree ? "No shortcut" : "Shortcut found"}</span>
    </span>
  );
}

export function SolveBoard({ rows, loading, empty, running, onRun, onRunAll }: Props) {
  const failing = rows.filter((s) => s.solveTest.result === "fail");
  const columns: Column<ContentScenario>[] = [
    {
      id: "name",
      header: "Scenario",
      minWidth: 150,
      hideable: false,
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="cn-solvename">
          <span className="rp-strong">{s.name}</span>
          <span className="rp-mono cn-dim">{s.solveTest.version}</span>
        </span>
      ),
    },
    {
      id: "result",
      header: "Latest run",
      width: 120,
      sortValue: (s) => (s.solveTest.result === "fail" ? 0 : s.solveTest.result === "not-run" ? 1 : 2),
      cell: (s) => (running.includes(s.id) ? <StatusDot tone="info" size="sm" label="Running" /> : <SolveDot result={s.solveTest.result} />),
    },
    { id: "checks", header: "Proofs", width: 208, cell: (s) => <Checks s={s} /> },
    { id: "history", header: "Last 12 runs", width: 164, cell: (s) => <RunStrip runs={s.solveTest.runs} name={s.name} version={s.version} /> },
    {
      id: "dur",
      header: "Duration",
      width: 112,
      align: "right",
      mono: true,
      sortValue: (s) => s.solveTest.durationSec ?? 0,
      cell: (s) => (s.solveTest.durationSec ? secs(s.solveTest.durationSec) : <span className="cn-dim">None</span>),
    },
    {
      id: "at",
      header: "Finished",
      width: 108,
      sortValue: (s) => s.solveTest.at ?? "",
      cell: (s) =>
        s.solveTest.at ? (
          <span className="rp-mono rp-num" title={formatDateTime(s.solveTest.at)}>
            {formatRelative(s.solveTest.at)}
          </span>
        ) : (
          <span className="cn-dim">Never</span>
        ),
    },
    {
      id: "ship",
      header: "Publish",
      width: 116,
      sortValue: (s) => (s.solveTest.result === "pass" ? 1 : 0),
      cell: (s) => (s.solveTest.result === "pass" ? <span className="cn-ship is-yes">Can publish</span> : <span className="cn-ship is-no">Blocked</span>),
    },
    {
      id: "run",
      header: <span className="rp-sr">Run</span>,
      headerLabel: "Run now",
      width: 116,
      align: "right",
      hideable: false,
      cell: (s) => (
        <Button size="sm" variant="secondary" iconLeft="play" loading={running.includes(s.id)} onClick={() => onRun(s)} aria-label={`Run solve-test for ${s.name}`}>
          Run now
        </Button>
      ),
    },
  ];

  return (
    <>
      {!loading && !empty && (
        <div className="cn-cirule">
          <span className="cn-cirule__text">
            A scenario ships only when the automated solver reaches every proof and the shortcut scan finds no unintended path. A failing or missing run blocks publishing of that
            version.
          </span>
          <span className="cn-cirule__next">
            Nightly run <span className="rp-mono rp-num">{formatRelative(ciSchedule.nextRunAt)}</span>
          </span>
        </div>
      )}
      {!loading &&
        !empty &&
        failing.map((s) => (
          <Callout
            key={s.id}
            tone="crit"
            role="status"
            title={
              <>
                {s.name} <span className="rp-mono">{s.solveTest.version}</span> does not ship
              </>
            }
          >
            {s.solveTest.failure}{" "}
            {s.status === "published" ? (
              <>New launches are paused until a run passes. Labs already running are not affected.</>
            ) : (
              <>
                The live version <span className="rp-mono">{s.liveVersion}</span> is unaffected.
              </>
            )}
          </Callout>
        ))}
      <DataTable
        caption="Solve-test CI results by scenario"
        className="cn-t cn-t--solve"
        columns={columns}
        rows={empty ? [] : rows}
        rowKey={(s) => s.id}
        loading={loading}
        density="compact"
        pageSize={25}
        columnControls={false}
        defaultSort={{ id: "result", dir: "asc" }}
        rowClassName={(s) => (s.solveTest.result === "fail" ? "is-failing" : undefined)}
        toolbar={
          !loading && !empty ? (
            <div className="cn-solvebar">
              <span className="cn-legend">
                <span className="cn-strip__run is-pass" aria-hidden="true" /> Pass
                <span className="cn-strip__run is-fail" aria-hidden="true" /> Fail
                <span className="cn-strip__run is-pass is-old" aria-hidden="true" /> Earlier version
                <span className="cn-legend__note">Oldest to newest. Hover a run for its version, time and duration.</span>
              </span>
              <Button size="sm" variant="secondary" iconLeft="refresh" onClick={onRunAll} disabled={running.length > 0}>
                Run all
              </Button>
            </div>
          ) : undefined
        }
        empty={
          <EmptyState
            icon="check-circle"
            title="No solve-test runs yet"
            compact
            action={
              <Button size="sm" iconLeft="play" onClick={onRunAll}>
                Run all now
              </Button>
            }
          >
            The nightly CI job runs every scenario at 03:00.
          </EmptyState>
        }
      />
    </>
  );
}
