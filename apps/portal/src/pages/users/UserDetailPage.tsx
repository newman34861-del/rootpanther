import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Avatar,
  Button,
  ButtonLink,
  Callout,
  Card,
  ConfirmDialog,
  CopyButton,
  DataTable,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  InvoiceStatusDot,
  KeyValue,
  LoadingRegion,
  Page,
  PageHeader,
  Skeleton,
  SkeletonText,
  StatusDot,
  Switch,
  Textarea,
  TierDot,
  Timeline,
  UsageMeter,
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatNumber,
  formatRelative,
  formatTime,
  helpLabel,
  useToast,
} from "@rootpanther/ui";
import type { Column, Invoice, ReportStatus, Tone } from "@rootpanther/ui";
import { firstOfNextMonth } from "../../mock/time";
import { OPERATORS, OUTCOME_META, PLANS, userDetail } from "../../mock/users";
import type { AuditEntry, Entitlement, PortalSession, SupportNote, UserDetail, UserReport } from "../../mock/users";
import { APP_URL } from "../../shell/PortalShell";
import { useDataState } from "../../review/review";
import { PlanLabel, UserStatusDot, isoDate, isoDateTime } from "./shared";
import "./users.css";

const ME = OPERATORS.priya;
const MY_IP = "203.0.113.24";
const STRIPE = "https://dashboard.stripe.com";

const REPORT_META: Record<ReportStatus, { label: string; tone: Tone; hollow?: boolean }> = {
  draft: { label: "Draft", tone: "neutral", hollow: true },
  complete: { label: "Complete", tone: "success" },
  exported: { label: "Exported", tone: "info" },
};

const AUDIT_ICON = { note: "note", entitlement: "key", billing: "receipt", security: "shield", impersonate: "user-check", trial: "calendar", account: "user" } as const;

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "subscription", label: "Subscription and invoices" },
  { id: "entitlements", label: "Entitlements" },
  { id: "sessions", label: "Lab sessions" },
  { id: "onyx", label: "Onyx usage" },
  { id: "reports", label: "Reports" },
  { id: "notes", label: "Support notes" },
  { id: "audit", label: "Admin audit" },
];

type Pending =
  | { kind: "entitlement"; ent: Entitlement; enable: boolean }
  | { kind: "trial"; days: 7 | 14 }
  | { kind: "comp" }
  | { kind: "refund"; invoice: Invoice }
  | { kind: "impersonate" }
  | { kind: "delete" };

const audit = (action: string, kind: AuditEntry["kind"], detail?: string, tone?: Tone): AuditEntry => ({
  id: `au-${Math.random().toString(36).slice(2, 9)}`,
  actor: ME.name,
  action,
  detail,
  ip: MY_IP,
  at: new Date().toISOString(),
  kind,
  tone,
});

function SectionCard({ id, title, meta, actions, children, padding }: { id: string; title: string; meta?: ReactNode; actions?: ReactNode; children: ReactNode; padding?: "none" | "md" }) {
  return (
    <Card id={id} className="ud-section" title={title} meta={meta} actions={actions} padding={padding}>
      {children}
    </Card>
  );
}

function sessionColumns(): Column<PortalSession>[] {
  return [
    {
      id: "scenario",
      header: "Scenario",
      hideable: false,
      width: 120,
      sortValue: (s) => s.scenario,
      titleValue: (s) => `${s.scenario}, ${s.id}`,
      cell: (s) => (
        <span className="ud-two">
          <span className="rp-strong">{s.scenario}</span>
          <span className="rp-mono ud-two__sub">{s.id}</span>
        </span>
      ),
    },
    {
      id: "tenant",
      header: "Tenant",
      width: 112,
      mono: true,
      cell: (s) => (s.outcome === "running" ? <Link to={`/fleet?tenant=${s.tenantId}`}>{s.tenantId}</Link> : s.tenantId),
    },
    { id: "region", header: "Region", width: 112, mono: true, defaultHidden: true, sortValue: (s) => s.region, cell: (s) => s.region },
    { id: "started", header: "Started", width: 144, mono: true, sortValue: (s) => s.startedAt, cell: (s) => isoDateTime(s.startedAt) },
    { id: "duration", header: "Duration", width: 96, align: "right", mono: true, defaultHidden: true, sortValue: (s) => s.durationMin, cell: (s) => (s.durationMin ? formatDuration(s.durationMin) : "0m") },
    { id: "hosts", header: "Hosts", width: 80, align: "right", mono: true, sortValue: (s) => s.hostsOwned / s.hostsTotal, cell: (s) => `${s.hostsOwned}/${s.hostsTotal}` },
    { id: "charged", header: "Charged", width: 92, align: "right", mono: true, sortValue: (s) => s.chargedHours, cell: (s) => `${s.chargedHours.toFixed(1)} h` },
    {
      id: "outcome",
      header: "Outcome",
      minWidth: 124,
      sortValue: (s) => s.outcome,
      cell: (s) => <StatusDot size="sm" tone={OUTCOME_META[s.outcome].tone} hollow={OUTCOME_META[s.outcome].hollow} label={OUTCOME_META[s.outcome].label} />,
    },
  ];
}

const REPORT_COLUMNS: Column<UserReport>[] = [
  { id: "title", header: "Title", minWidth: 200, truncate: true, sortValue: (r) => r.title, cell: (r) => r.title },
  { id: "status", header: "Status", width: 112, sortValue: (r) => r.status, cell: (r) => <StatusDot size="sm" tone={REPORT_META[r.status].tone} hollow={REPORT_META[r.status].hollow} label={REPORT_META[r.status].label} /> },
  { id: "words", header: "Words", width: 92, align: "right", mono: true, sortValue: (r) => r.words, cell: (r) => formatNumber(r.words) },
  { id: "updated", header: "Updated", width: 112, mono: true, sortValue: (r) => r.updatedAt, titleValue: (r) => isoDateTime(r.updatedAt), cell: (r) => formatRelative(r.updatedAt) },
];

function DetailSkeleton() {
  return (
    <LoadingRegion label="Loading account">
      <div className="ud-head-sk" aria-hidden="true">
        <Skeleton width={120} height={10} />
        <Skeleton width={220} height={22} style={{ marginTop: 14 }} />
        <Skeleton width={420} height={12} style={{ marginTop: 12 }} />
      </div>
      <div className="ud-layout">
        <div className="ud-main">
          {[180, 260, 220, 300].map((h, i) => (
            <div key={i} className="rp-card ud-sk-card" aria-hidden="true">
              <div className="ud-sk-card__head">
                <Skeleton width={140} height={12} />
              </div>
              <div className="ud-sk-card__body">
                <SkeletonText lines={Math.round(h / 60)} />
              </div>
            </div>
          ))}
        </div>
        <aside className="ud-aside">
          <div className="rp-card ud-sk-card" aria-hidden="true">
            <div className="ud-sk-card__body">
              <Skeleton width="50%" height={10} />
              <Skeleton width="70%" height={22} style={{ marginTop: 10 }} />
              <SkeletonText lines={6} />
            </div>
          </div>
        </aside>
      </div>
    </LoadingRegion>
  );
}

function HelpBars({ help }: { help: UserDetail["onyx"]["help"] }) {
  const max = Math.max(...help.map((h) => h.share));
  return (
    <ul className="ud-help" aria-label="Help dial distribution, share of Onyx messages">
      {help.map((h) => (
        <li key={h.level} className="ud-help__row">
          <span className="ud-help__label">{helpLabel(h.level)}</span>
          <span className="ud-help__track" aria-hidden="true">
            <span className="ud-help__bar" style={{ width: `${(h.share / max) * 100}%` }} />
          </span>
          <span className="ud-help__val rp-mono rp-num">{h.share.toFixed(1)}%</span>
        </li>
      ))}
    </ul>
  );
}

function EntitlementRow({ ent, onToggle }: { ent: Entitlement; onToggle: (v: boolean) => void }) {
  let source: ReactNode = <span className="ud-ent__src">Not included</span>;
  if (ent.source === "plan") source = <span className="ud-ent__src">Included in plan</span>;
  if (ent.source === "granted")
    source = (
      <span className="ud-ent__src is-override">
        Granted by {ent.grantedBy}, {formatDate(ent.grantedAt!, { day: "numeric", month: "short" })}
      </span>
    );
  if (ent.source === "revoked")
    source = (
      <span className="ud-ent__src is-override">
        Revoked by {ent.grantedBy}, {formatDate(ent.grantedAt!, { day: "numeric", month: "short" })}
      </span>
    );
  return (
    <li className="ud-ent">
      <div className="ud-ent__text">
        <span className="ud-ent__label">{ent.label}</span>
        <span className="ud-ent__detail">{ent.detail}</span>
      </div>
      {source}
      <Switch checked={ent.enabled} onChange={onToggle} size="sm" id={`ent-${ent.id}`} />
      <label htmlFor={`ent-${ent.id}`} className="rp-sr">
        {ent.label}
      </label>
    </li>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const state = useDataState();
  const navigate = useNavigate();
  const toast = useToast();
  const base = useMemo(() => userDetail(id), [id]);
  const empty = state === "empty";

  const [invoices, setInvoices] = useState<Invoice[]>(() => base?.invoices ?? []);
  const [ents, setEnts] = useState<Entitlement[]>(() => base?.entitlements ?? []);
  const [notes, setNotes] = useState<SupportNote[]>(() => base?.notes ?? []);
  const [log, setLog] = useState<AuditEntry[]>(() => base?.audit ?? []);
  const [trialEnds, setTrialEnds] = useState(base?.user.trialEndsAt);
  const [credit, setCredit] = useState(0);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);

  const sessionCols = useMemo(sessionColumns, []);

  if (state === "denied") {
    return (
      <Page width="full">
        <PageHeader title="Account" crumbs={[{ label: "Users", to: "/users" }, { label: "Account" }]} />
        <Card>
          <EmptyState icon="lock" title="Account records need the owner or support role" action={<ButtonLink to="/" size="sm">Back to Overview</ButtonLink>}>
            Profiles, invoices and support notes contain personal data. Your role is finance. An owner can change roles in System.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  if (state === "error") {
    return (
      <Page width="full">
        <PageHeader title="Account" crumbs={[{ label: "Users", to: "/users" }, { label: id ?? "Account" }]} />
        <Card>
          <ErrorState title="This account did not load" onRetry={() => window.location.reload()} reference="req_7c20d4">
            The accounts service timed out after 10 seconds. No changes were made to <span className="rp-mono">{id}</span>.
          </ErrorState>
        </Card>
      </Page>
    );
  }

  if (state === "loading") {
    return (
      <Page width="full">
        <DetailSkeleton />
      </Page>
    );
  }

  if (!base) {
    return (
      <Page width="full">
        <PageHeader title="Account not found" crumbs={[{ label: "Users", to: "/users" }, { label: "Not found" }]} />
        <Card>
          <EmptyState icon="search" title="No account with this id" action={<ButtonLink to="/users" size="sm" iconLeft="arrow-left">All users</ButtonLink>}>
            <span className="rp-mono rp-strong">{id}</span> does not exist or was deleted. Deleted accounts are listed in the System audit log.
          </EmptyState>
        </Card>
      </Page>
    );
  }

  const u = base.user;
  const plan = PLANS[u.plan];
  const paying = u.plan !== "free" && u.status !== "lapsed";
  const monthlyValue = empty || !paying || u.status === "trial" ? 0 : u.plan === "practitioner-annual" ? plan.price / 12 : plan.price;
  const sessions = empty ? [] : u.sessions;
  const shownInvoices = empty ? [] : invoices;
  const onyx = base.onyx;
  const reports = empty ? [] : base.reports;
  const shownNotes = empty ? [] : notes;
  const auditItems = empty ? [] : log;
  const periodHours = empty ? 0 : u.labHours;
  const ltv = invoices.filter((i) => i.status === "paid").reduce((a, i) => a + i.amount, 0);

  function act(entry: AuditEntry, toastTitle: string, toastDetail?: ReactNode) {
    setLog((l) => [entry, ...l]);
    toast.push({ title: toastTitle, detail: toastDetail, tone: "success" });
  }

  function confirm() {
    if (!pending) return;
    const p = pending;
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      setPending(null);
      if (p.kind === "entitlement") {
        const source: Entitlement["source"] = p.enable ? (p.ent.source === "revoked" ? "plan" : "granted") : p.ent.source === "plan" || p.ent.source === "revoked" ? "revoked" : "none";
        setEnts((xs) => xs.map((e) => (e.id === p.ent.id ? { ...e, enabled: p.enable, source, grantedBy: ME.name, grantedAt: new Date().toISOString() } : e)));
        act(audit(`${p.enable ? "Granted" : "Revoked"} ${p.ent.label.toLowerCase()}`, "entitlement", undefined, p.enable ? "primary" : "med"), `${p.ent.label} ${p.enable ? "granted" : "revoked"}`, u.email);
      } else if (p.kind === "trial") {
        const next = new Date(new Date(trialEnds ?? new Date().toISOString()).getTime() + p.days * 86400000).toISOString();
        setTrialEnds(next);
        act(audit(`Extended trial by ${p.days} days`, "trial", `New end ${isoDate(next)}`, "primary"), `Trial extended by ${p.days} days`, `Ends ${isoDate(next)}`);
      } else if (p.kind === "comp") {
        setCredit((c) => c + plan.price);
        act(audit("Comped one month", "billing", `${formatMoney(plan.price, "USD", 2)} credit on the Stripe balance`, "primary"), "One month comped", `${formatMoney(plan.price, "USD", 2)} credit applied to the next invoice`);
      } else if (p.kind === "refund") {
        setInvoices((xs) => xs.map((i) => (i.id === p.invoice.id ? { ...i, status: "refunded" } : i)));
        act(audit(`Refunded ${p.invoice.number}`, "billing", `${formatMoney(p.invoice.amount, "USD", 2)} to ${base!.paymentMethod}`, "info"), `Refund issued for ${p.invoice.number}`, `${formatMoney(p.invoice.amount, "USD", 2)} returns to the card in 5 to 10 business days`);
      } else if (p.kind === "impersonate") {
        const at = new Date().toISOString();
        setImpersonating(at);
        setLog((l) => [audit("Started impersonation session", "impersonate", "Learner app, banner shown", "high"), ...l]);
        toast.push({
          title: `Impersonating ${u.name}`,
          tone: "high",
          duration: 9000,
          detail: (
            <a href={APP_URL} target="_blank" rel="noopener noreferrer" className="ud-extlink">
              Open the learner app
              <Icon name="external" size={12} />
              <span className="rp-sr">(opens in a new tab)</span>
            </a>
          ),
        });
      } else if (p.kind === "delete") {
        toast.push({ title: "Account deleted", detail: `${u.email}. The deletion is in the System audit log.`, tone: "neutral" });
        navigate("/users");
      }
    }, 550);
  }

  function endImpersonation() {
    setImpersonating(null);
    act(audit("Ended impersonation session", "impersonate"), "Impersonation ended", "The learner banner is removed on their next request.");
  }

  function addNote() {
    const text = draft.trim();
    if (!text) return;
    const n: SupportNote = { id: `note-${Date.now()}`, author: ME, text, at: new Date().toISOString() };
    setNotes((xs) => [n, ...xs]);
    setDraft("");
    act(audit("Added a support note", "note"), "Note added", "Visible to operators only.");
  }

  const latest = auditItems[0];
  const invoiceCols: Column<Invoice>[] = [
    { id: "date", header: "Date", width: 112, mono: true, sortValue: (i) => i.date, cell: (i) => isoDate(i.date) },
    {
      id: "number",
      header: "Invoice",
      minWidth: 160,
      sortValue: (i) => i.number,
      titleValue: (i) => `${i.number}, ${i.description}`,
      cell: (i) => (
        <span className="ud-two">
          <span className="rp-mono ud-two__main">{i.number}</span>
          <span className="ud-two__sub">{i.description}</span>
        </span>
      ),
    },
    { id: "amount", header: "Amount", width: 104, align: "right", mono: true, sortValue: (i) => i.amount, cell: (i) => formatMoney(i.amount, "USD", 2) },
    { id: "status", header: "Status", width: 112, sortValue: (i) => i.status, cell: (i) => <InvoiceStatusDot status={i.status} /> },
    {
      id: "actions",
      header: <span className="rp-sr">Actions</span>,
      headerLabel: "Actions",
      width: 116,
      align: "right",
      cell: (i) => (
        <span className="ud-invact">
          {i.status === "paid" && (
            <Button size="sm" variant="quiet" onClick={() => setPending({ kind: "refund", invoice: i })} aria-label={`Refund ${i.number}`}>
              Refund
            </Button>
          )}
          <IconButton icon="download" size="sm" label={`Download ${i.number} PDF`} onClick={() => toast.push({ title: `${i.number}.pdf downloaded` })} />
        </span>
      ),
    },
  ];

  const charged = sessions.filter((x) => new Date(x.startedAt) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).reduce((a, x) => a + x.chargedHours, 0);
  const failedFree = sessions.filter((x) => x.outcome === "failed-provision").length;

  const header = (
    <PageHeader
      crumbs={[{ label: "Users", to: "/users" }, { label: u.name }]}
      title={
        <span className="ud-title">
          <Avatar initials={u.initials} size={40} />
          <span className="ud-title__text">
            <span>{u.name}</span>
            <span className="ud-title__email rp-mono">
              {u.email}
              <CopyButton value={u.email} label="Copy email" />
            </span>
          </span>
        </span>
      }
      meta={
        <>
          <UserStatusDot status={u.status} size="md" />
          <PlanLabel plan={u.plan} />
          <TierDot tier={u.tier} size="sm" />
          <span className="ud-meta-id rp-mono">
            {u.id}
            <CopyButton value={u.id} label="Copy user id" />
          </span>
        </>
      }
      actions={
        <>
          <Button iconLeft="user-check" onClick={() => setPending({ kind: "impersonate" })} disabled={!!impersonating}>
            Impersonate
          </Button>
          <Button variant="destructive" iconLeft="trash" onClick={() => setPending({ kind: "delete" })}>
            Delete
          </Button>
        </>
      }
    />
  );

  const trialActive = u.status === "trial";

  return (
    <Page width="full" className="ud-page">
      {header}
      {impersonating && (
        <Callout
          tone="high"
          icon="user-check"
          role="status"
          title={`Impersonating ${u.name} since ${formatTime(impersonating)}`}
          action={
            <div className="ud-imp-actions">
              <ButtonLink to={APP_URL} external size="sm">
                Learner app
              </ButtonLink>
              <Button size="sm" variant="quiet" onClick={endImpersonation}>
                End session
              </Button>
            </div>
          }
        >
          The learner sees a banner naming you on every page until you end the session. Actions you take are attributed to you.
        </Callout>
      )}
      <div className="ud-layout">
        <aside className="ud-aside" aria-label="Account summary">
          <div className="rp-card ud-summary">
            <dl className="ud-sumfigs">
              <div>
                <dt>MRR</dt>
                <dd className="rp-mono rp-num">{formatMoney(monthlyValue, "USD", 2)}</dd>
              </div>
              <div>
                <dt>LTV</dt>
                <dd className="rp-mono rp-num">{formatMoney(empty ? 0 : ltv, "USD", 2)}</dd>
              </div>
            </dl>
            <div className="ud-summary__usage">
              <UsageMeter usedHours={periodHours} allowanceHours={60} resetsOn={firstOfNextMonth()} label="Lab hours" compact />
            </div>
            <dl className="ud-sumlist">
              <div>
                <dt>{trialActive ? "Trial ends" : "Renews"}</dt>
                <dd className="rp-mono rp-num">{trialActive && trialEnds ? isoDate(trialEnds) : base.renewsAt ? isoDate(base.renewsAt) : "Not renewing"}</dd>
              </div>
              <div>
                <dt>Payment method</dt>
                <dd className="rp-mono">{base.paymentMethod ?? "None"}</dd>
              </div>
              {credit > 0 && (
                <div>
                  <dt>Balance</dt>
                  <dd className="rp-mono rp-num">{formatMoney(credit, "USD", 2)} credit</dd>
                </div>
              )}
              <div>
                <dt>Two-factor</dt>
                <dd>{u.twoFactor ? <StatusDot tone="success" size="sm" label="Enabled" /> : <StatusDot tone="neutral" hollow size="sm" label="Off" />}</dd>
              </div>
              <div>
                <dt>Last active</dt>
                <dd className="rp-mono rp-num" title={isoDateTime(u.lastActiveAt)}>
                  {formatRelative(u.lastActiveAt)}
                </dd>
              </div>
            </dl>
            {latest && (
              <a href="#audit" className="ud-lastact">
                <span className="rp-eyebrow">Last admin action</span>
                <span className="ud-lastact__text">{latest.action}</span>
                <span className="ud-lastact__meta">
                  {latest.actor}, <span className="rp-mono rp-num">{formatRelative(latest.at)}</span>
                </span>
              </a>
            )}
          </div>
          <nav className="ud-toc" aria-label="Sections">
            <ul>
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <div className="ud-main">
          <SectionCard id="profile" title="Profile">
            <KeyValue
              columns={3}
              items={[
                { label: "User id", value: u.id, mono: true },
                { label: "Email", value: u.email, mono: true },
                { label: "Handle", value: u.handle, mono: true },
                { label: "Signed up", value: isoDateTime(u.signupAt), mono: true },
                { label: "Country", value: u.country, mono: true },
                { label: "Default lab region", value: u.region, mono: true },
                { label: "Path tier", value: <TierDot tier={u.tier} size="sm" /> },
                { label: "Team", value: u.team ?? "None", mono: !!u.team },
                { label: "Stripe customer", value: u.stripeCustomer, mono: true },
              ]}
            />
          </SectionCard>

          <SectionCard
            id="subscription"
            title="Subscription and invoices"
            padding="none"
            actions={
              <ButtonLink to={`${STRIPE}/customers/${u.stripeCustomer}`} external size="sm" variant="quiet">
                View in Stripe
              </ButtonLink>
            }
          >
            <div className="ud-sub">
              <KeyValue
                columns={4}
                className="ud-subkv"
                items={[
                  { label: "Subscription", value: base.subscriptionId ?? "None", mono: true },
                  { label: "Plan", value: <PlanLabel plan={u.plan} /> },
                  { label: "Price", value: plan.price ? `${formatMoney(plan.price, "USD", 2)} / ${plan.interval}` : "Free", mono: true },
                  { label: "Status", value: <UserStatusDot status={u.status} /> },
                ]}
              />
            </div>
            {u.status === "past-due" && (
              <div className="ud-sub__callout">
                <Callout tone="high" title="Payment failed, retry 2 of 4">
                  Next retry in 3 days. Lab launching stays on during the 14 day grace period.
                </Callout>
              </div>
            )}
            <DataTable
              caption={`Invoices for ${u.email}`}
              columns={invoiceCols}
              rows={shownInvoices}
              rowKey={(i) => i.id}
              density="compact"
              columnControls={false}
              defaultSort={{ id: "date", dir: "desc" }}
              className="ud-flush"
              empty={
                <EmptyState compact icon="receipt" title="No invoices">
                  {u.status === "trial" ? `The first invoice is raised when the trial ends on ${trialEnds ? isoDate(trialEnds) : "conversion"}.` : "This account has never been billed."}
                </EmptyState>
              }
            />
          </SectionCard>

          <SectionCard id="entitlements" title="Entitlements" padding="none">
            <ul className="ud-ents" aria-label="Feature entitlements">
              {ents.map((e) => (
                <EntitlementRow key={e.id} ent={e} onToggle={(v) => setPending({ kind: "entitlement", ent: e, enable: v })} />
              ))}
            </ul>
            <div className="ud-adjust">
              <div className="ud-adjust__item">
                <div className="ud-adjust__text">
                  <span className="ud-ent__label">Extend trial</span>
                  <span className="ud-ent__detail">
                    {trialActive && trialEnds ? (
                      <>
                        Ends <span className="rp-mono rp-num">{isoDate(trialEnds)}</span>
                      </>
                    ) : (
                      "Not on trial"
                    )}
                  </span>
                </div>
                <div className="ud-adjust__btns">
                  <Button size="sm" disabled={!trialActive} onClick={() => setPending({ kind: "trial", days: 7 })}>
                    +7 days
                  </Button>
                  <Button size="sm" disabled={!trialActive} onClick={() => setPending({ kind: "trial", days: 14 })}>
                    +14 days
                  </Button>
                </div>
              </div>
              <div className="ud-adjust__item">
                <div className="ud-adjust__text">
                  <span className="ud-ent__label">Comp a month</span>
                  <span className="ud-ent__detail">{paying ? `${formatMoney(plan.price, "USD", 2)} credit on the next invoice` : "No active paid plan"}</span>
                </div>
                <div className="ud-adjust__btns">
                  <Button size="sm" iconLeft="receipt" disabled={!paying || trialActive} onClick={() => setPending({ kind: "comp" })}>
                    Comp month
                  </Button>
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard id="sessions" title="Lab sessions" meta={sessions.length ? <span className="rp-mono rp-num">{sessions.length} total</span> : undefined} padding="none">
            <DataTable
              caption={`Lab sessions for ${u.email}`}
              columns={sessionCols}
              rows={sessions}
              rowKey={(s) => s.id}
              density="compact"
              defaultSort={{ id: "started", dir: "desc" }}
              pageSize={8}
              className="ud-flush ud-sessions"
              toolbar={
                sessions.length ? (
                  <span className="ud-tabnote">
                    <span className="rp-mono rp-num rp-strong">{charged.toFixed(1)} h</span> charged this period
                    {failedFree > 0 && (
                      <>
                        <span className="ud-tabnote__sep" aria-hidden="true" />
                        <span className="rp-mono rp-num rp-strong">{failedFree}</span> failed {failedFree === 1 ? "launch" : "launches"}, not charged
                      </>
                    )}
                  </span>
                ) : undefined
              }
              empty={
                <EmptyState compact icon="flask" title="No lab sessions">
                  {u.plan === "free" ? "The free plan has no lab access." : "Sessions appear when the learner launches a scenario."}
                </EmptyState>
              }
            />
          </SectionCard>

          <SectionCard id="onyx" title="Onyx usage" meta="This period" actions={<Link to={`/onyx?user=${u.id}`} className="ud-more">Onyx Ops<Icon name="arrow-right" size={13} /></Link>}>
            {empty || onyx.tokens === 0 ? (
              <EmptyState compact icon="chat" title="No Onyx usage this period">
                Usage appears when the learner asks Onyx a question inside a lab.
              </EmptyState>
            ) : (
              <div className="ud-onyx">
                <div className="ud-onyx__stats">
                  <KeyValue
                    columns={2}
                    items={[
                      { label: "Tokens", value: formatNumber(onyx.tokens), mono: true },
                      { label: "Cost", value: formatMoney(onyx.cost, "USD", 2), mono: true },
                      { label: "Messages", value: formatNumber(onyx.messages), mono: true },
                      { label: "Labs with Onyx", value: formatNumber(onyx.sessionsWithOnyx), mono: true },
                    ]}
                  />
                </div>
                <div className="ud-onyx__help">
                  <div className="ud-subhead">Help dial</div>
                  <HelpBars help={onyx.help} />
                </div>
                <div className="ud-onyx__flags">
                  <div className="ud-subhead">
                    Flagged conversations <span className="rp-mono rp-num">{onyx.flagged.length}</span>
                  </div>
                  {onyx.flagged.length === 0 ? (
                    <p className="ud-none">None this period.</p>
                  ) : (
                    <ul className="ud-flags">
                      {onyx.flagged.map((fl) => (
                        <li key={fl.id}>
                          <div className="ud-flags__head">
                            <Link to={`/onyx?conversation=${fl.id}`} className="rp-mono ud-flags__id">
                              {fl.id}
                            </Link>
                            <span className="ud-flags__scn">{fl.scenario}</span>
                            <StatusDot size="sm" tone={fl.status === "open" ? "med" : "success"} label={fl.status === "open" ? "Open" : "Reviewed"} />
                          </div>
                          <p className="ud-flags__reason">{fl.reason}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard id="reports" title="Reports" meta={reports.length ? <span className="rp-mono rp-num">{reports.length} written</span> : undefined} padding="none">
            <DataTable
              caption={`Reports written by ${u.email}`}
              columns={REPORT_COLUMNS}
              rows={reports}
              rowKey={(r) => r.id}
              density="compact"
              columnControls={false}
              defaultSort={{ id: "updated", dir: "desc" }}
              className="ud-flush"
              empty={
                <EmptyState compact icon="document" title="No reports">
                  Reports are written in the learner app after a lab.
                </EmptyState>
              }
            />
          </SectionCard>

          <SectionCard id="notes" title="Support notes" meta={shownNotes.length ? <span className="rp-mono rp-num">{shownNotes.length}</span> : undefined}>
            <form
              className="ud-noteform"
              onSubmit={(e) => {
                e.preventDefault();
                addNote();
              }}
            >
              <Textarea label="Add a note" hint="Visible to operators only. Written to the audit log." value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={2000} />
              <div className="ud-noteform__foot">
                <span className="rp-mono rp-num ud-noteform__count">{draft.length}/2000</span>
                <Button type="submit" size="sm" disabled={!draft.trim()}>
                  Add note
                </Button>
              </div>
            </form>
            {shownNotes.length === 0 ? (
              <p className="ud-none ud-notes-empty">No notes on this account.</p>
            ) : (
              <ul className="ud-notes">
                {shownNotes.map((n) => (
                  <li key={n.id} className="ud-note">
                    <Avatar initials={n.author.initials} size={28} />
                    <div className="ud-note__body">
                      <div className="ud-note__head">
                        <span className="rp-strong">{n.author.name}</span>
                        <time dateTime={n.at} className="rp-mono rp-num">
                          {isoDateTime(n.at)}
                        </time>
                      </div>
                      <p>{n.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard id="audit" title="Admin audit" meta="Append-only" actions={<Link to={`/system?actor=&target=${u.id}#audit`} className="ud-more">System audit log<Icon name="arrow-right" size={13} /></Link>}>
            {auditItems.length === 0 ? (
              <EmptyState compact icon="checklist" title="No admin actions">
                Grants, refunds, impersonation and notes on this account are recorded here.
              </EmptyState>
            ) : (
              <div aria-live="polite">
                <Timeline
                  label={`Admin actions on ${u.email}`}
                  absoluteTime={formatDateTime}
                  items={auditItems.map((a) => ({
                    id: a.id,
                    title: a.action,
                    detail: (
                      <>
                        <span className="ud-audit__who">
                          <span>{a.actor}</span>
                          {a.ip && <span className="rp-mono">{a.ip}</span>}
                          <span className="rp-mono rp-num">{isoDateTime(a.at)}</span>
                        </span>
                        {a.detail && <span className="ud-audit__detail">{a.detail}</span>}
                      </>
                    ),
                    at: a.at,
                    tone: a.tone,
                    icon: AUDIT_ICON[a.kind],
                  }))}
                />
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <ConfirmDialog
        open={pending?.kind === "impersonate"}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={busy}
        title={`Impersonate ${u.name}`}
        confirmLabel="Start session"
      >
        <p>
          You will use the learner app as <span className="rp-mono rp-strong">{u.email}</span>.
        </p>
        <ul className="ud-bullets">
          <li>The learner sees a persistent banner naming you on every page until you end the session.</li>
          <li>The session start, end and every action you take are written to this account's audit log.</li>
          <li>Payment methods and the account password cannot be changed while impersonating.</li>
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === "delete"}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={busy}
        destructive
        requireText={u.email}
        title={`Delete ${u.name}`}
        confirmLabel="Delete account"
      >
        <p>This permanently deletes the account and cannot be undone.</p>
        <ul className="ud-bullets">
          <li>Progress, proofs, reports, Onyx history and support notes are erased.</li>
          <li>{base.subscriptionId ? "The Stripe subscription is cancelled now, without a refund." : "There is no subscription to cancel."}</li>
          <li>Invoices are kept for 7 years for tax records.</li>
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === "refund"}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={busy}
        destructive
        title={pending?.kind === "refund" ? `Refund ${pending.invoice.number}` : "Refund"}
        confirmLabel={pending?.kind === "refund" ? `Refund ${formatMoney(pending.invoice.amount, "USD", 2)}` : "Refund"}
      >
        {pending?.kind === "refund" && (
          <>
            <p>
              Refunds <span className="rp-mono rp-strong">{formatMoney(pending.invoice.amount, "USD", 2)}</span> to <span className="rp-mono">{base.paymentMethod}</span> through Stripe. Funds return in 5 to 10 business days.
            </p>
            <p>The subscription and lab access are not changed. The refund is written to the audit log.</p>
          </>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === "entitlement"}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={busy}
        destructive={pending?.kind === "entitlement" && !pending.enable}
        title={pending?.kind === "entitlement" ? `${pending.enable ? "Grant" : "Revoke"} ${pending.ent.label.toLowerCase()}` : "Entitlement"}
        confirmLabel={pending?.kind === "entitlement" ? (pending.enable ? "Grant" : "Revoke") : "Confirm"}
      >
        {pending?.kind === "entitlement" && (
          <p>
            {pending.enable ? "Grants" : "Revokes"} <span className="rp-strong">{pending.ent.label}</span> ({pending.ent.detail.toLowerCase()}) for <span className="rp-mono">{u.email}</span>, effective on their next request.{" "}
            {pending.enable ? "It stays until revoked, including after plan changes." : pending.ent.source === "plan" ? "This overrides the plan until granted again." : ""}
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === "trial"}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        loading={busy}
        title={pending?.kind === "trial" ? `Extend trial by ${pending.days} days` : "Extend trial"}
        confirmLabel="Extend trial"
      >
        {pending?.kind === "trial" && trialEnds && (
          <p>
            The trial end moves from <span className="rp-mono rp-strong">{isoDate(trialEnds)}</span> to{" "}
            <span className="rp-mono rp-strong">{isoDate(new Date(new Date(trialEnds).getTime() + pending.days * 86400000).toISOString())}</span>. The learner is emailed the new date and is not charged until then.
          </p>
        )}
      </ConfirmDialog>

      <ConfirmDialog open={pending?.kind === "comp"} onClose={() => setPending(null)} onConfirm={confirm} loading={busy} title="Comp one month" confirmLabel={`Credit ${formatMoney(plan.price, "USD", 2)}`}>
        <p>
          Adds a <span className="rp-mono rp-strong">{formatMoney(plan.price, "USD", 2)}</span> credit to the Stripe customer balance. The invoice on{" "}
          <span className="rp-mono">{base.renewsAt ? isoDate(base.renewsAt) : "the next renewal"}</span> is covered. Access and the renewal date do not change.
        </p>
      </ConfirmDialog>
    </Page>
  );
}
