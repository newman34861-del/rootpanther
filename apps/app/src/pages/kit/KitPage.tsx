import { useState } from "react";
import type { ReactNode } from "react";
import {
  ActivityFeed,
  Avatar,
  Badge,
  BarChart,
  Button,
  Callout,
  Card,
  Checkbox,
  ClawMark,
  CodeBlock,
  Combobox,
  CommandChips,
  ConfirmDialog,
  ConnectionCard,
  DataTable,
  Disclosure,
  DonutChart,
  Drawer,
  DropdownMenu,
  EmptyState,
  ErrorState,
  EvidenceTray,
  FunnelChart,
  Heatmap,
  HelpDial,
  Icon,
  IconButton,
  Input,
  InvoiceTable,
  KeyValue,
  KpiTile,
  LineChart,
  Lockup,
  Meter,
  Modal,
  OnyxPanel,
  Page,
  PageHeader,
  PlanCard,
  PlanRequired,
  Popover,
  ProgressBar,
  ProofBadge,
  RadioGroup,
  ReportOutline,
  ScenarioCard,
  ScenarioCardSkeleton,
  SecretField,
  SegmentedControl,
  Select,
  SessionTimer,
  Skeleton,
  SkeletonText,
  Slider,
  Spinner,
  StatusDot,
  Switch,
  Tabs,
  Tag,
  TargetChip,
  TechniqueTag,
  Textarea,
  TierDot,
  Timeline,
  Tooltip,
  TopologyDiagram,
  UsageMeter,
  iconNames,
  useToast,
} from "@rootpanther/ui";
import type { EvidenceItem, HelpLevel, OnyxMessageData, ReportSection, Tone } from "@rootpanther/ui";
import { activeSession, recentActivity, sessionHistory, usage } from "../../mock/account";
import { scenarioById, scenarios } from "../../mock/scenarios";
import { hoursAgo, minutesAgo } from "../../mock/time";
import "./kit.css";

const SECTIONS = ["Brand", "Buttons", "Inputs", "Choice", "Display", "Feedback", "Layout", "Data", "Charts", "Overlays", "Product", "Onyx", "Icons"];

function KitSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section id={title.toLowerCase()} className="kt-section" aria-labelledby={`kt-${title}`}>
      <h2 id={`kt-${title}`}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="kt-row">
      <div className="kt-row__label">{label}</div>
      <div className="kt-row__items">{children}</div>
    </div>
  );
}

const TONES: Tone[] = ["neutral", "primary", "success", "info", "med", "high", "crit", "premium"];

const OUTLINE: ReportSection[] = [
  { id: "s1", title: "Executive summary", state: "done" },
  { id: "s2", title: "Scope", state: "done" },
  { id: "s3", title: "Methodology", state: "draft" },
  { id: "s4", title: "MER-WEB01", state: "draft", host: "MER-WEB01" },
  { id: "s4a", title: "Foothold", parentId: "s4", state: "done" },
  { id: "s4b", title: "Privilege escalation", parentId: "s4", state: "draft" },
  { id: "s4c", title: "Proof", parentId: "s4", state: "empty" },
  { id: "s5", title: "Remediation", state: "empty" },
  { id: "s6", title: "Appendix: commands", state: "empty" },
];

const EVIDENCE: EvidenceItem[] = [
  { id: "e1", kind: "command", host: "MER-WEB01", command: "nmap -sV 172.16.20.11", output: "1433/tcp open  ms-sql-s  Microsoft SQL Server 2019\n5985/tcp open  http      Microsoft HTTPAPI 2.0", capturedAt: minutesAgo(48) },
  { id: "e2", kind: "note", host: "MER-WEB01", text: "svc_sql is in Remote Management Users on MER-SQL01.", capturedAt: minutesAgo(40), used: true },
  { id: "e3", kind: "proof", host: "MER-WEB01", text: "proof.txt recorded", capturedAt: minutesAgo(31) },
];

const TRANSCRIPT: OnyxMessageData[] = [
  { id: "m1", role: "you", text: "I have svc_sql's TGS hash. hashcat finished with no result on rockyou.", at: minutesAgo(9) },
  { id: "m2", role: "onyx", command: "hint", hintStep: { step: 2, of: 4 }, text: "The wordlist is fine. Look at how the password policy on meridian.local shapes likely passwords, then let a rule do the work.", at: minutesAgo(8) },
  { id: "m3", role: "system", text: "Help level changed to Teach. Recorded.", at: minutesAgo(5) },
];

export default function KitPage() {
  const toast = useToast();
  const [btnLoading, setBtnLoading] = useState(false);
  const [check, setCheck] = useState(true);
  const [sw, setSw] = useState(true);
  const [slider, setSlider] = useState(14);
  const [seg, setSeg] = useState<"day" | "week" | "month">("week");
  const [radio, setRadio] = useState<"browser" | "openvpn">("openvpn");
  const [combo, setCombo] = useState<string | null>("meridian");
  const [level, setLevel] = useState<HelpLevel>("coach");
  const [tab, setTab] = useState<"one" | "two" | "three">("one");
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [section, setSection] = useState("s4b");
  const [selected, setSelected] = useState<string[]>([]);
  const meridian = scenarioById("meridian")!;

  return (
    <Page width="full">
      <PageHeader title="Component kit" meta={<span>Every primitive in <code>@rootpanther/ui</code>, rendered from props. Review tooling, not part of the product.</span>} />
      <div className="kt">
        <nav className="kt-index" aria-label="Kit sections">
          {SECTIONS.map((s) => (
            <a key={s} href={`#${s.toLowerCase()}`}>
              {s}
            </a>
          ))}
        </nav>
        <div className="kt-body">
          <KitSection title="Brand">
            <Row label="Lockup">
              <Lockup size="lg" />
              <Lockup size="md" badge="PORTAL" />
              <Lockup size="lg" tagline="OSCP lab training" />
            </Row>
            <Row label="Mark">
              <ClawMark size={16} />
              <ClawMark size={24} />
              <ClawMark size={32} />
              <ClawMark size={64} />
              <ClawMark size={96} />
            </Row>
          </KitSection>

          <KitSection title="Buttons">
            <Row label="Variants">
              <Button variant="primary" iconLeft="play">
                Launch Meridian
              </Button>
              <Button variant="secondary">View brief</Button>
              <Button variant="quiet">Cancel</Button>
              <Button variant="destructive" iconLeft="power">
                End session
              </Button>
              <Button variant="danger">Delete report</Button>
            </Row>
            <Row label="Sizes and states">
              <Button size="sm">Small</Button>
              <Button>Medium</Button>
              <Button size="lg">Large</Button>
              <Button
                loading={btnLoading}
                onClick={() => {
                  setBtnLoading(true);
                  window.setTimeout(() => setBtnLoading(false), 1600);
                }}
              >
                {btnLoading ? "Saving" : "Click to load"}
              </Button>
              <Button disabled>Disabled</Button>
            </Row>
            <Row label="Icon buttons">
              <IconButton icon="copy" label="Copy" />
              <IconButton icon="download" label="Download" variant="secondary" />
              <IconButton icon="bell" label="Notifications" badge={3} />
              <IconButton icon="more" label="More" size="sm" />
              <IconButton icon="trash" label="Delete" disabled />
            </Row>
          </KitSection>

          <KitSection title="Inputs">
            <div className="kt-grid">
              <Input label="Email" placeholder="you@example.com" autoComplete="email" />
              <Input label="Search" icon="search" placeholder="Search scenarios" />
              <Input label="Tunnel address" mono defaultValue="10.13.37.201/32" hint="Assigned per session." />
              <Input label="Password" type="password" defaultValue="hunter2" error="At least 12 characters." />
              <Input label="Disabled" disabled defaultValue="Read only" />
              <Select label="Region" options={[{ value: "uks", label: "UK South" }, { value: "weu", label: "West Europe" }]} />
              <Combobox label="Scenario" value={combo} onChange={setCombo} options={scenarios.map((s) => ({ value: s.id, label: s.name }))} />
              <Slider label="Terminal font size" min={11} max={18} value={slider} onChange={setSlider} format={(v) => `${v}px`} />
            </div>
            <Textarea label="Explanation" defaultValue="Requested a service ticket for svc_sql and cracked it offline with a rule-based attack." hint="One or two sentences." />
          </KitSection>

          <KitSection title="Choice">
            <Row label="Checkbox and switch">
              <Checkbox label="Include command appendix" checked={check} onChange={(e) => setCheck(e.target.checked)} />
              <Checkbox label="Indeterminate" indeterminate checked={false} onChange={() => undefined} />
              <Checkbox label="Disabled" disabled />
              <Switch checked={sw} onChange={setSw} label="Debrief ready emails" description="Sent when Onyx finishes a debrief." />
            </Row>
            <Row label="Segmented">
              <SegmentedControl label="Range" value={seg} onChange={setSeg} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
            </Row>
            <RadioGroup
              name="kit-conn"
              legend="Connection"
              layout="cards"
              value={radio}
              onChange={setRadio}
              options={[
                { value: "browser", label: "In-browser terminal", description: "Hosted Kali. No setup." },
                { value: "openvpn", label: "Your own Kali", description: "OpenVPN tunnel into the lab." },
              ]}
            />
          </KitSection>

          <KitSection title="Display">
            <Row label="Status">
              {TONES.map((t) => (
                <StatusDot key={t} tone={t} label={t} />
              ))}
              <StatusDot hollow label="Not reached" />
            </Row>
            <Row label="Tags and badges">
              <Tag>Kerberoasting</Tag>
              <Tag mono>10.13.37.10</Tag>
              <Tag onRemove={() => undefined} removeLabel="Remove filter">
                Tier C2
              </Tag>
              <Badge>AD SET</Badge>
              <Badge tone="premium">Recommended</Badge>
              <Badge tone="crit">Failed</Badge>
            </Row>
            <Row label="Tiers">
              <TierDot tier="C1" />
              <TierDot tier="C2" />
              <TierDot tier="C3" />
              <TierDot tier="C4" />
              <TechniqueTag technique="delegation" to="/catalogue?technique=delegation" />
            </Row>
            <Row label="Avatar and tooltip">
              <Avatar initials="DR" size={24} />
              <Avatar initials="DR" size={32} />
              <Avatar initials="PS" size={40} />
              <Tooltip content="Tooltips open on hover and focus">
                <Button size="sm" variant="secondary">
                  Hover or focus
                </Button>
              </Tooltip>
            </Row>
            <Row label="Progress">
              <div className="kt-w">
                <ProgressBar value={64} label="Exam readiness" showValue marker={75} />
              </div>
              <div className="kt-w">
                <Meter value={0.6} label="Kerberoasting" />
              </div>
              <div className="kt-w">
                <Meter value={1} verified label="Web to shell" />
              </div>
            </Row>
            <KeyValue
              columns={4}
              items={[
                { label: "Domain", value: "meridian.local", mono: true },
                { label: "Objective", value: "Domain Admin" },
                { label: "Hosts", value: "3", mono: true },
                { label: "Estimate", value: "~4h" },
              ]}
            />
          </KitSection>

          <KitSection title="Feedback">
            <div className="kt-grid">
              <Callout tone="info" title="Labs are ephemeral">
                Machines are destroyed when the session ends. Notes, proofs and reports stay on your account.
              </Callout>
              <Callout tone="med" title="Idle shutdown in 4 minutes" action={<Button size="sm">I am here</Button>} />
              <Callout tone="crit" title="Provisioning failed">
                No lab hours were charged.
              </Callout>
              <Callout tone="success" title="Proof recorded" />
            </div>
            <Row label="Loading">
              <Spinner />
              <Spinner size={20} />
              <div className="kt-w">
                <SkeletonText lines={3} />
              </div>
              <Skeleton width={120} height={36} radius="md" />
              <Button size="sm" onClick={() => toast.push({ title: "Report exported", detail: "basalt-report.pdf", tone: "success" })}>
                Show toast
              </Button>
            </Row>
            <div className="kt-grid kt-grid--3">
              <Card padding="none">
                <EmptyState icon="flask" title="No labs yet" action={<Button size="sm">Browse scenarios</Button>}>
                  Launch your first scenario.
                </EmptyState>
              </Card>
              <Card padding="none">
                <ErrorState title="Sessions did not load" onRetry={() => undefined} reference="req_8f2c1a">
                  The lab service did not respond.
                </ErrorState>
              </Card>
              <Card padding="none">
                <PlanRequired title="Exam simulations need a plan" plan="Practitioner" includes={["60 lab hours a month", "Exam simulations"]} action={<Button size="sm" variant="primary">See plans</Button>} />
              </Card>
            </div>
          </KitSection>

          <KitSection title="Layout">
            <Card title="Card title" meta="meta" actions={<IconButton icon="more" label="More" size="sm" />} footer={<span>Footer</span>}>
              <Tabs label="Example tabs" value={tab} onChange={setTab} items={[{ id: "one", label: "Overview" }, { id: "two", label: "Hosts", count: 3 }, { id: "three", label: "History" }]} />
              <div style={{ marginTop: 16 }}>
                <Disclosure title="Connection never completes" meta="OpenVPN">
                  <p>Check that UDP 1194 is allowed outbound on your network.</p>
                </Disclosure>
                <Disclosure title="Terminal disconnects">
                  <p>The terminal reconnects automatically up to five times.</p>
                </Disclosure>
              </div>
            </Card>
          </KitSection>

          <KitSection title="Data">
            <DataTable
              caption="Session history"
              columns={[
                { id: "scenario", header: "Scenario", cell: (r) => r.scenarioName, sortValue: (r) => r.scenarioName, width: 200 },
                { id: "start", header: "Started", cell: (r) => new Date(r.startedAt).toLocaleDateString("en-GB"), sortValue: (r) => r.startedAt, width: 140 },
                { id: "dur", header: "Duration", cell: (r) => `${r.durationMin}m`, sortValue: (r) => r.durationMin, mono: true, align: "right", width: 120 },
                { id: "owned", header: "Hosts owned", cell: (r) => `${r.hostsOwned}/${r.hostsTotal}`, mono: true, width: 130 },
                { id: "charged", header: "Charged", cell: (r) => `${r.chargedHours.toFixed(1)} h`, mono: true, align: "right", width: 110 },
              ]}
              rows={sessionHistory}
              rowKey={(r) => r.id}
              pageSize={5}
              selectable
              selected={selected}
              onSelectionChange={setSelected}
              bulkActions={() => (
                <Button size="sm" variant="secondary">
                  Export
                </Button>
              )}
              toolbar={<Input icon="search" inputSize="sm" placeholder="Filter" />}
            />
            <div className="kt-grid kt-grid--4">
              <KpiTile label="MRR" value="$48,215" delta={{ value: 6.2, good: "up", period: "vs last 30d" }} spark={[30, 32, 31, 35, 37, 40, 42, 48]} href="/billing" />
              <KpiTile label="Logo churn" value="3.1" unit="%" delta={{ value: -0.4, good: "down" }} spark={[4, 3.8, 3.6, 3.5, 3.1]} />
              <KpiTile label="Concurrent labs" value="37" secondary="Peak today 52" />
              <KpiTile label="Loading" value="" loading />
            </div>
            <div className="kt-grid">
              <Card title="Timeline">
                <Timeline label="Activity" items={recentActivity.map((a) => ({ id: a.id, title: a.title, detail: a.detail, at: a.at, tone: a.tone, icon: "flag" }))} />
              </Card>
              <Card title="Activity feed">
                <ActivityFeed label="Activity" items={recentActivity} />
              </Card>
            </div>
          </KitSection>

          <KitSection title="Charts">
            <div className="kt-grid">
              <Card title="Line">
                <LineChart
                  label="Latency"
                  x={["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]}
                  series={[
                    { id: "p50", label: "p50", values: [420, 410, 455, 430, 400, 390, 415] },
                    { id: "p95", label: "p95", values: [1200, 1150, 1380, 1290, 1100, 1050, 1180], tone: "chart-2" },
                  ]}
                  threshold={{ value: 1500, label: "SLO 1.5s" }}
                  yFormat={(v) => `${Math.round(v)}ms`}
                />
              </Card>
              <Card title="Stacked bars">
                <BarChart
                  label="MRR by plan"
                  stacked
                  x={["May", "Jun", "Jul", "Aug", "Sep", "Oct"]}
                  series={[
                    { id: "m", label: "Monthly", values: [21, 24, 27, 29, 31, 33] },
                    { id: "a", label: "Annual", values: [6, 7, 8, 9, 10, 11], tone: "chart-2" },
                    { id: "t", label: "Team", values: [1, 2, 2, 3, 3, 4], tone: "chart-3" },
                  ]}
                  yFormat={(v) => `$${v}k`}
                />
              </Card>
              <Card title="Donut">
                <DonutChart
                  label="Help level"
                  slices={[
                    { id: "a", label: "Exam sim", value: 8, tone: "chart-3" },
                    { id: "b", label: "Coach", value: 46 },
                    { id: "c", label: "Teach", value: 31, tone: "chart-2" },
                    { id: "d", label: "Walkthrough", value: 15, tone: "premium" },
                  ]}
                  center={<span className="rp-mono rp-strong">1,240</span>}
                />
              </Card>
              <Card title="Funnel">
                <FunnelChart
                  label="Conversion"
                  steps={[
                    { id: "v", label: "Visitors", value: 41200 },
                    { id: "s", label: "Signups", value: 3120 },
                    { id: "t", label: "Trials", value: 1480 },
                    { id: "p", label: "Paid", value: 612 },
                  ]}
                />
              </Card>
            </div>
            <Card title="Heatmap">
              <Heatmap
                label="Retention"
                columns={["M0", "M1", "M2", "M3", "M4", "M5"]}
                rows={[
                  { label: "May", meta: "214", values: [100, 72, 61, 55, 51, 48] },
                  { label: "Jun", meta: "246", values: [100, 75, 63, 57, 52, null] },
                  { label: "Jul", meta: "268", values: [100, 77, 66, 58, null, null] },
                ]}
              />
            </Card>
          </KitSection>

          <KitSection title="Overlays">
            <Row label="Triggers">
              <Button onClick={() => setModal(true)}>Modal</Button>
              <Button onClick={() => setDrawer(true)}>Drawer</Button>
              <Button variant="destructive" onClick={() => setConfirm(true)}>
                Typed confirm
              </Button>
              <Popover trigger={(p) => <Button {...p}>Popover</Button>} width={260} label="Example popover">
                <div style={{ padding: 14 }}>Popovers close on Escape and outside click.</div>
              </Popover>
              <DropdownMenu
                label="Actions"
                trigger={(p) => (
                  <Button {...p} iconRight="chevron-down">
                    Menu
                  </Button>
                )}
                items={[
                  { id: "o", label: "Open", icon: "external" },
                  { id: "d", label: "Duplicate", icon: "copy", kbd: "D" },
                  { id: "s", divider: true },
                  { id: "x", label: "Delete", icon: "trash", danger: true },
                ]}
              />
            </Row>
            <Modal open={modal} onClose={() => setModal(false)} title="Extend session" footer={<><Button variant="quiet" onClick={() => setModal(false)}>Cancel</Button><Button variant="primary" onClick={() => setModal(false)}>Extend by 30 minutes</Button></>}>
              <p>The session will end at 23:42. This uses 0.5 of your remaining 18.5 lab hours.</p>
            </Modal>
            <Drawer open={drawer} onClose={() => setDrawer(false)} title="rp-t-4qmx9a" meta="Meridian · uksouth">
              <CodeBlock tone="terminal" code={"21:02:11 tenant provisioned\n21:02:48 isolation verified\n21:03:02 openvpn client connected"} label="Logs" />
            </Drawer>
            <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={() => setConfirm(false)} title="Delete report" confirmLabel="Delete report" destructive requireText="basalt">
              <p>This permanently deletes the Basalt report and its exports.</p>
            </ConfirmDialog>
          </KitSection>

          <KitSection title="Product">
            <div className="kt-grid kt-grid--3">
              <ScenarioCard scenario={meridian} href="/catalogue/meridian" />
              <ScenarioCard scenario={scenarioById("tamarack")!} href="/catalogue/tamarack" />
              <ScenarioCardSkeleton />
            </div>
            <Card title="Topology">
              <TopologyDiagram hosts={activeSession.hosts} links={meridian.links} label="Meridian topology" />
            </Card>
            <Row label="Session">
              {activeSession.hosts.map((h) => (
                <TargetChip key={h.id} host={h} onClick={() => undefined} />
              ))}
              <SessionTimer seconds={8280} />
              <SessionTimer seconds={600} />
              <SessionTimer seconds={90} />
              <ProofBadge kind="local" captured />
              <ProofBadge kind="proof" captured={false} />
            </Row>
            <div className="kt-grid">
              <Card title="Usage">
                <UsageMeter usedHours={usage.usedHours} allowanceHours={usage.allowanceHours} resetsOn={usage.resetsOn} />
              </Card>
              <Card title="Secrets and code">
                <div className="rp-stack" style={{ ["--gap" as string]: "10px" }}>
                  <SecretField label="Password" value="Autumn#2026" />
                  <CodeBlock prompt="$" code="sudo openvpn rootpanther-lab.ovpn" />
                </div>
              </Card>
            </div>
            <div className="kt-grid">
              <ConnectionCard method="browser" sessionActive onOpenTerminal={() => undefined} />
              <ConnectionCard method="openvpn" isDefault test="connected" lastSeen="12s ago" endpoint="lab-uks.rootpanther.net:1194" tunnelAddress="10.13.37.201/32" onDownload={() => undefined} onTest={() => undefined} sessionActive />
            </div>
            <div className="kt-grid kt-grid--3">
              <Card padding="sm">
                <ReportOutline sections={OUTLINE} selectedId={section} onSelect={setSection} />
              </Card>
              <Card padding="sm">
                <EvidenceTray items={EVIDENCE} onInsert={() => undefined} hosts={["MER-WEB01", "MER-SQL01"]} />
              </Card>
              <PlanCard
                interval="month"
                plan={{ id: "p", name: "Practitioner", priceMonthly: 49, priceAnnualMonthly: 40.83, priceAnnualTotal: 490, currency: "USD", summary: "Every scenario, every Onyx level.", features: ["Every AD set and standalone", "Exam simulations", "Report exports"], labHours: 60, recommended: true, ctaLabel: "Start 7-day trial" }}
                action={<Button variant="primary">Start 7-day trial</Button>}
              />
            </div>
            <InvoiceTable
              invoices={[
                { id: "i1", number: "INV-2026-0918", date: hoursAgo(24 * 14), amount: 49, currency: "USD", status: "paid", description: "Practitioner, monthly" },
                { id: "i2", number: "INV-2026-0818", date: hoursAgo(24 * 44), amount: 49, currency: "USD", status: "paid", description: "Practitioner, monthly" },
              ]}
              onDownload={() => undefined}
            />
          </KitSection>

          <KitSection title="Onyx">
            <HelpDial value={level} onChange={setLevel} />
            <div className="kt-grid">
              <div className="kt-onyx">
                <OnyxPanel level={level} onLevelChange={setLevel} messages={TRANSCRIPT} onSend={() => undefined} onCommand={() => undefined} groundedTo="Meridian" compact />
              </div>
              <div className="kt-onyx">
                <OnyxPanel level={level} onLevelChange={setLevel} messages={TRANSCRIPT} onSend={() => undefined} onCommand={() => undefined} connection="reconnecting" reconnectAttempt={2} onReconnect={() => undefined} compact />
              </div>
            </div>
            <CommandChips onCommand={() => undefined} />
          </KitSection>

          <KitSection title="Icons">
            <div className="kt-icons">
              {iconNames.map((n) => (
                <div key={n} className="kt-icon">
                  <Icon name={n} size={18} />
                  <span className="rp-mono">{n}</span>
                </div>
              ))}
            </div>
          </KitSection>
        </div>
      </div>
    </Page>
  );
}
