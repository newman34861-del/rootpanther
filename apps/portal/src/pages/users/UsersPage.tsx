import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Button,
  ButtonLink,
  Card,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Input,
  Page,
  PageHeader,
  Select,
  StatusDot,
  TierDot,
  TIER_NAMES,
  TIER_ORDER,
  formatMoney,
  formatNumber,
  formatRelative,
  useToast,
} from "@rootpanther/ui";
import type { Column, SortState, TierCode } from "@rootpanther/ui";
import { PLANS, PLAN_ORDER, STATUS_META, STATUS_ORDER, userCounts, users } from "../../mock/users";
import { PlanLabel, UserStatusDot, downloadCsv, isoDate, isoDateTime } from "./shared";
import type { PlanId, UserRecord, UserStatus } from "../../mock/users";
import { useDataState } from "../../review/review";
import "./users.css";

const PAGE_SIZE = 25;

const csvName = (suffix = "") => `rootpanther-users${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;

const COLUMNS: Column<UserRecord>[] = [
  {
    id: "account",
    header: "Account",
    hideable: false,
    minWidth: 200,
    sortValue: (u) => u.email,
    titleValue: (u) => `${u.name}, ${u.email}`,
    cell: (u) => (
      <div className="us-acct">
        <Link to={`/users/${u.id}`} className="us-acct__email rp-mono">
          {u.email}
        </Link>
        <span className="us-acct__name">{u.name}</span>
      </div>
    ),
  },
  { id: "id", header: "User id", width: 124, mono: true, defaultHidden: true, sortValue: (u) => u.id, cell: (u) => u.id },
  { id: "plan", header: "Plan", width: 136, sortValue: (u) => PLAN_ORDER.indexOf(u.plan), cell: (u) => <PlanLabel plan={u.plan} /> },
  { id: "status", header: "Status", width: 108, sortValue: (u) => STATUS_ORDER.indexOf(u.status), cell: (u) => <UserStatusDot status={u.status} /> },
  { id: "tier", header: "Tier", headerLabel: "Path tier", width: 84, sortValue: (u) => u.tier, cell: (u) => <TierDot tier={u.tier} display="code" size="sm" /> },
  { id: "country", header: "Country", width: 92, mono: true, defaultHidden: true, sortValue: (u) => u.country, cell: (u) => u.country },
  {
    id: "signup",
    header: "Signed up",
    width: 120,
    mono: true,
    sortValue: (u) => u.signupAt,
    titleValue: (u) => isoDateTime(u.signupAt),
    cell: (u) => isoDate(u.signupAt),
  },
  {
    id: "last",
    header: "Last active",
    width: 124,
    mono: true,
    sortValue: (u) => u.lastActiveAt,
    titleValue: (u) => isoDateTime(u.lastActiveAt),
    cell: (u) => formatRelative(u.lastActiveAt),
  },
  {
    id: "hours",
    header: "Lab hours",
    width: 116,
    align: "right",
    mono: true,
    sortValue: (u) => u.labHours,
    cell: (u) => <span className={u.labHours ? "us-fig" : undefined}>{u.labHours.toFixed(1)}</span>,
  },
  {
    id: "ltv",
    header: "LTV",
    width: 116,
    align: "right",
    mono: true,
    sortValue: (u) => u.ltv,
    cell: (u) => <span className={u.ltv ? "us-fig" : undefined}>{formatMoney(u.ltv, "USD", 2)}</span>,
  },
];

function useFilters() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const plan = (PLAN_ORDER as string[]).includes(params.get("plan") ?? "") ? (params.get("plan") as PlanId) : "";
  const status = (STATUS_ORDER as string[]).includes(params.get("status") ?? "") ? (params.get("status") as UserStatus) : "";
  const tier = (TIER_ORDER as string[]).includes(params.get("tier") ?? "") ? (params.get("tier") as TierCode) : "";
  function set(key: string, value: string) {
    const p = new URLSearchParams(params);
    if (value) p.set(key, value);
    else p.delete(key);
    setParams(p, { replace: true });
  }
  function clear() {
    const p = new URLSearchParams(params);
    ["q", "plan", "status", "tier"].forEach((k) => p.delete(k));
    setParams(p, { replace: true });
  }
  return { q, plan, status, tier, set, clear, params, setParams, active: !!(q || plan || status || tier) };
}

function matches(u: UserRecord, q: string) {
  if (!q) return true;
  const s = q.trim().toLowerCase();
  return u.email.toLowerCase().includes(s) || u.name.toLowerCase().includes(s) || u.id.toLowerCase().includes(s);
}

export default function UsersPage() {
  const state = useDataState();
  const navigate = useNavigate();
  const toast = useToast();
  const f = useFilters();
  const [sort, setSort] = useState<SortState>({ id: "signup", dir: "desc" });
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extending, setExtending] = useState(false);
  const exported = useRef(false);

  const loading = state === "loading";
  const source = state === "empty" ? [] : users;

  const filtered = useMemo(() => {
    const rows = source.filter((u) => matches(u, f.q) && (!f.plan || u.plan === f.plan) && (!f.status || u.status === f.status) && (!f.tier || u.tier === f.tier));
    const col = COLUMNS.find((c) => c.id === sort.id);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      const r = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? r : -r;
    });
  }, [source, f.q, f.plan, f.status, f.tier, sort]);

  useEffect(() => setPage(1), [f.q, f.plan, f.status, f.tier]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function exportRows(rows: UserRecord[], suffix = "") {
    const name = csvName(suffix);
    downloadCsv(rows, name);
    toast.push({ title: `Exported ${formatNumber(rows.length)} ${rows.length === 1 ? "user" : "users"}`, detail: name, tone: "success" });
  }

  useEffect(() => {
    if (f.params.get("export") !== "1") {
      exported.current = false;
      return;
    }
    if (state !== "default" || exported.current) return;
    exported.current = true;
    exportRows(filtered, f.active ? "-filtered" : "");
    const p = new URLSearchParams(f.params);
    p.delete("export");
    f.setParams(p, { replace: true });
  });

  const selectedRows = users.filter((u) => selected.includes(u.id));
  const selectedTrials = selectedRows.filter((u) => u.status === "trial");

  if (state === "denied") {
    return (
      <Page width="full">
        <PageHeader title="Users" />
        <Card>
          <EmptyState
            icon="lock"
            title="Users needs the owner or support role"
            action={
              <ButtonLink to="/" size="sm">
                Back to Overview
              </ButtonLink>
            }
          >
            Account records include personal data. Your role is finance, which can see aggregate figures only. An owner can change roles in System.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const toolbar = (
    <div className="us-filters">
      <Input
        type="search"
        icon="search"
        inputSize="sm"
        aria-label="Search users"
        placeholder="Email, name or user id"
        value={f.q}
        onChange={(e) => f.set("q", e.target.value)}
        wrapperClassName="us-search"
      />
      <Select
        selectSize="sm"
        aria-label="Plan"
        value={f.plan}
        onChange={(e) => f.set("plan", e.target.value)}
        options={[{ value: "", label: "All plans" }, ...PLAN_ORDER.map((p) => ({ value: p, label: PLANS[p].label }))]}
      />
      <Select
        selectSize="sm"
        aria-label="Status"
        value={f.status}
        onChange={(e) => f.set("status", e.target.value)}
        options={[{ value: "", label: "All statuses" }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_META[s].label }))]}
      />
      <Select
        selectSize="sm"
        aria-label="Path tier"
        value={f.tier}
        onChange={(e) => f.set("tier", e.target.value)}
        options={[{ value: "", label: "All tiers" }, ...TIER_ORDER.map((t) => ({ value: t, label: `${t} ${TIER_NAMES[t]}` }))]}
      />
      {f.active && (
        <Button variant="quiet" size="sm" iconLeft="x" onClick={f.clear}>
          Clear
        </Button>
      )}
    </div>
  );

  return (
    <Page width="full">
      <PageHeader
        title="Users"
        meta={
          loading || state === "error" ? undefined : (
            <>
              <span>
                <span className="rp-mono rp-num rp-strong">{formatNumber(source.length)}</span> accounts
              </span>
              {STATUS_ORDER.map((s) => (
                <span key={s} className="us-count">
                  <StatusDot tone={STATUS_META[s].tone} hollow={STATUS_META[s].hollow} size="sm" />
                  <span className="rp-mono rp-num rp-strong">{state === "empty" ? 0 : userCounts[s]}</span> {STATUS_META[s].label.toLowerCase()}
                </span>
              ))}
            </>
          )
        }
        actions={
          <Button iconLeft="download" onClick={() => exportRows(filtered, f.active ? "-filtered" : "")} disabled={state !== "default" || filtered.length === 0}>
            Export CSV
          </Button>
        }
      />
      <DataTable
        caption={`Users${f.active ? ", filtered" : ""}. Select a row to open the account.`}
        columns={COLUMNS}
        rows={shown}
        rowKey={(u) => u.id}
        sort={sort}
        onSortChange={(s) => {
          setSort(s);
          setPage(1);
        }}
        page={current}
        pageSize={PAGE_SIZE}
        total={filtered.length}
        onPageChange={setPage}
        selectable
        selected={selected}
        onSelectionChange={setSelected}
        loading={loading}
        error={
          state === "error"
            ? { title: "Users did not load", detail: "The accounts service timed out after 10 seconds. No account data was changed.", onRetry: () => window.location.reload() }
            : null
        }
        onRowClick={(u) => navigate(`/users/${u.id}`)}
        toolbar={toolbar}
        className={shown.length ? "us-table" : undefined}
        bulkActions={() => (
          <div className="us-bulk">
            <Button size="sm" iconLeft="download" onClick={() => exportRows(selectedRows, "-selected")}>
              Export
            </Button>
            <Button
              size="sm"
              iconLeft="copy"
              onClick={() => {
                navigator.clipboard?.writeText(selectedRows.map((u) => u.email).join("\n")).catch(() => undefined);
                toast.push({ title: `Copied ${selectedRows.length} ${selectedRows.length === 1 ? "email" : "emails"}` });
              }}
            >
              Copy emails
            </Button>
            <Button
              size="sm"
              iconLeft="calendar"
              disabled={selectedTrials.length === 0}
              onClick={() => setExtendOpen(true)}
              title={selectedTrials.length === 0 ? "No trial accounts selected" : undefined}
            >
              Extend trial
              {selectedTrials.length > 0 && <span className="rp-mono rp-num us-bulk__n">{selectedTrials.length}</span>}
            </Button>
          </div>
        )}
        empty={
          state === "empty" ? (
            <EmptyState
              icon="users"
              title="No accounts yet"
              action={
                <ButtonLink to="/" size="sm">
                  Open Overview
                </ButtonLink>
              }
            >
              Accounts appear here when learners sign up on rootpanther.com.
            </EmptyState>
          ) : (
            <EmptyState
              icon="search"
              title="No users match these filters"
              action={
                <Button size="sm" onClick={f.clear}>
                  Clear filters
                </Button>
              }
            >
              {f.q ? (
                <>
                  Nothing matches <span className="rp-mono rp-strong">{f.q}</span> with the current plan, status and tier.
                </>
              ) : (
                "Widen the plan, status or tier filter."
              )}
            </EmptyState>
          )
        }
      />
      <ConfirmDialog
        open={extendOpen}
        onClose={() => setExtendOpen(false)}
        loading={extending}
        title={`Extend ${selectedTrials.length} ${selectedTrials.length === 1 ? "trial" : "trials"} by 7 days`}
        confirmLabel="Extend by 7 days"
        onConfirm={() => {
          setExtending(true);
          window.setTimeout(() => {
            setExtending(false);
            setExtendOpen(false);
            toast.push({
              title: `${selectedTrials.length} ${selectedTrials.length === 1 ? "trial" : "trials"} extended by 7 days`,
              detail: "Each extension is in the account audit log.",
              tone: "success",
            });
            setSelected([]);
          }, 600);
        }}
      >
        <p>
          Trial end dates move 7 days later and the learners are emailed the new date.{" "}
          {selectedRows.length - selectedTrials.length > 0 && <>{selectedRows.length - selectedTrials.length} selected accounts are not on trial and are skipped.</>}
        </p>
        <ul className="us-confirmlist">
          {selectedTrials.slice(0, 5).map((u) => (
            <li key={u.id} className="rp-mono">
              {u.email}
            </li>
          ))}
          {selectedTrials.length > 5 && <li>and {selectedTrials.length - 5} more</li>}
        </ul>
      </ConfirmDialog>
    </Page>
  );
}
