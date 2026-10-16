import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Button,
  ButtonLink,
  ConfirmDialog,
  Icon,
  IconButton,
  OnyxPanel,
  ProofBadge,
  SessionTimer,
  TargetChip,
  TopologyDiagram,
  UiLink,
  formatTime,
  useCountdown,
  useHotkey,
  useToast,
} from "@rootpanther/ui";
import type { Host } from "@rootpanther/ui";
import type { TerminalState } from "@rootpanther/ui/terminal";
import { activeSession } from "../../mock/account";
import { scenarioById } from "../../mock/scenarios";
import { LAB_HELP_DEFAULT, LAB_START, labReply, labTranscript } from "../../mock/lab";
import type { TerminalResult } from "../../mock/lab";
import { useOnyxChat } from "../onyx/onyxChat";
import { LabTerminal } from "./LabTerminal";
import type { LabTerminalHandle } from "./LabTerminal";
import "./lab.css";

const meridian = scenarioById("meridian")!;
const FONT_SIZES = [11, 12, 13, 14, 16, 18];

interface CapturedProof {
  host: string;
  file: string;
  at: string;
}

interface TabDef {
  id: string;
  label: string;
}

type ReviewPhase = "default" | "loading" | "error" | "empty";

function initialTermState(phase: ReviewPhase, expiring: boolean): TerminalState {
  if (phase === "empty") return "ended";
  if (phase === "loading") return "connecting";
  if (phase === "error") return "reconnecting";
  return expiring ? "connected" : "connecting";
}

function LeftStrip({
  hosts,
  selectedId,
  onSelect,
  proofs,
  onRecordProof,
  collapsed,
  onToggle,
}: {
  hosts: Host[];
  selectedId: string;
  onSelect: (id: string) => void;
  proofs: CapturedProof[];
  onRecordProof: (host: Host, file: "local.txt" | "proof.txt") => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const host = hosts.find((h) => h.id === selectedId) ?? hosts[0];
  const required: ("local.txt" | "proof.txt")[] = host.exposure === "learner-facing" ? ["local.txt", "proof.txt"] : ["proof.txt"];

  return (
    <div className={collapsed ? "lv-left is-collapsed" : "lv-left"}>
      <div className="lv-panelhead">
        <span className="lv-panelhead__title">Host</span>
        <IconButton
          icon={collapsed ? "panel-right" : "panel-left"}
          label={collapsed ? "Expand host panel" : "Collapse host panel"}
          size="sm"
          onClick={onToggle}
        />
      </div>
      <div className="lv-left__scroll">
        <div>
          <div className="lv-hostsel__name rp-mono">{host.name}</div>
          <div className="lv-hostsel__role">{host.role}</div>
          <div className="lv-kv">
            <div className="lv-kv__row">
              <span className="lv-kv__k">IP</span>
              <span className="lv-kv__v rp-mono">{host.ip}</span>
            </div>
            <div className="lv-kv__row">
              <span className="lv-kv__k">OS</span>
              <span className="lv-kv__v">{host.os === "windows" ? "Windows" : "Linux"}</span>
            </div>
            <div className="lv-kv__row">
              <span className="lv-kv__k">Exposure</span>
              <span className="lv-kv__v">{host.exposure === "learner-facing" ? "Reachable" : "Internal"}</span>
            </div>
          </div>
        </div>

        <div>
          <span className="lv-section__label">Open ports</span>
          {host.ports && host.ports.length > 0 ? (
            <div className="lv-ports">
              {host.ports.map((p) => (
                <span key={p} className="lv-port">
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <p className="lv-left__empty">None discovered yet. Scan this host to populate its ports.</p>
          )}
        </div>

        <div>
          <span className="lv-section__label">Proofs</span>
          <div className="lv-proofs">
            {required.map((file) => {
              const captured = proofs.find((p) => p.host === host.id && p.file === file);
              const kind = file === "local.txt" ? "local" : "proof";
              return (
                <div key={file} className="lv-proofrow">
                  <ProofBadge kind={kind} captured={!!captured} at={captured?.at} />
                  {captured ? (
                    <span className="lv-proofrow__when rp-mono">{captured.at}</span>
                  ) : (
                    <button type="button" className="rp-link rp-small lv-proofrow__when" onClick={() => onRecordProof(host, file)}>
                      Record proof
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <span className="lv-section__label">Topology</span>
          <div className="lv-topo">
            <TopologyDiagram hosts={hosts} links={meridian.links} label="Meridian topology" compact selectedId={host.id} onSelect={onSelect} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LabView() {
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const phase = (params.get("state") as ReviewPhase) ?? "default";
  const expiringParam = params.get("phase") === "expiring";
  const knownSession = sessionId === activeSession.id;

  const [termState, setTermState] = useState<TerminalState>(() => initialTermState(phase, expiringParam));
  const [reconnectAttempt, setReconnectAttempt] = useState(1);
  const [expiring, setExpiring] = useState(expiringParam);
  const [ended, setEnded] = useState(phase === "empty");
  const [confirmEnd, setConfirmEnd] = useState(false);

  const [hosts, setHosts] = useState<Host[]>(() => meridian.hosts.map((h) => ({ ...h })));
  const [selectedHost, setSelectedHost] = useState(hosts[0].id);
  const [proofs, setProofs] = useState<CapturedProof[]>([{ host: "mer-web01", file: "proof.txt", at: formatTime(activeSession.startedAt) }]);
  const [pendingProof, setPendingProof] = useState<{ host: string; file: string; token: string } | null>(null);

  const [tabs, setTabs] = useState<TabDef[]>([{ id: "t1", label: "kali 1" }]);
  const [activeTab, setActiveTab] = useState("t1");
  const [fontIdx, setFontIdx] = useState(2);
  const [search, setSearch] = useState("");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [lastRun, setLastRun] = useState<{ line: string; output: string } | null>(null);

  const termHandles = useRef<Record<string, LabTerminalHandle | null>>({});
  const tabSeq = useRef(1);

  const baseRemaining = (activeSession.maxLifeMin - activeSession.elapsedMin) * 60;
  const remaining = useCountdown(expiring ? 118 : baseRemaining, !ended);

  const chat = useOnyxChat({
    initialMessages: labTranscript,
    initialLevel: LAB_HELP_DEFAULT,
    initialCtx: LAB_START,
    respond: labReply,
    onNote: () => saveNote(),
  });

  // Connection lifecycle driven by the review state.
  useEffect(() => {
    if (phase === "empty") {
      setEnded(true);
      setTermState("ended");
      return;
    }
    if (phase === "loading") {
      setTermState("connecting");
      return;
    }
    if (phase === "error") {
      setTermState("reconnecting");
      setReconnectAttempt(1);
      let n = 1;
      const tick = window.setInterval(() => {
        n += 1;
        if (n > 5) {
          window.clearInterval(tick);
          setTermState("disconnected");
        } else {
          setReconnectAttempt(n);
        }
      }, 1400);
      return () => window.clearInterval(tick);
    }
    const t = window.setTimeout(() => setTermState("connected"), 1100);
    return () => window.clearTimeout(t);
  }, [phase]);

  const saveNote = useCallback(() => {
    const run = lastRunRef.current;
    if (!run) {
      toast.push({ title: "Run a command first", detail: "There is nothing to save to evidence yet." });
      return;
    }
    toast.push({
      title: "Saved to evidence",
      detail: `${run.line} on ${hostsRef.current.find((h) => h.id === selectedHostRef.current)?.name ?? "the host"}`,
      tone: "success",
      action: { label: "Open report", onClick: () => navigate("/reports/rep-meridian") },
    });
  }, [navigate, toast]);

  // Keep refs fresh for the note hotkey and Onyx note command.
  const lastRunRef = useRef(lastRun);
  lastRunRef.current = lastRun;
  const hostsRef = useRef(hosts);
  hostsRef.current = hosts;
  const selectedHostRef = useRef(selectedHost);
  selectedHostRef.current = selectedHost;

  useHotkey({ key: "s", meta: true, shift: true }, (e) => {
    if (ended) return;
    e.preventDefault();
    saveNote();
  });

  function recordProof(hostId: string, file: string, at: string) {
    setProofs((prev) => (prev.some((p) => p.host === hostId && p.file === file) ? prev : [...prev, { host: hostId, file, at }]));
    setHosts((prev) =>
      prev.map((h) => {
        if (h.id !== hostId) return h;
        const kind = file === "local.txt" ? "local" : "proof";
        const owned = file === "proof.txt" ? true : h.owned;
        return { ...h, owned, proofs: Array.from(new Set([...(h.proofs ?? []), kind])) };
      }),
    );
  }

  const onResult = useCallback((line: string, result: TerminalResult) => {
    setLastRun({ line, output: result.output });
    if (result.proof && !proofsRef.current.some((p) => p.host === result.proof!.host && p.file === result.proof!.file)) {
      setPendingProof({ host: result.proof.host, file: result.proof.file, token: result.proof.token });
    }
  }, []);
  const proofsRef = useRef(proofs);
  proofsRef.current = proofs;

  function confirmPendingProof() {
    if (!pendingProof) return;
    recordProof(pendingProof.host, pendingProof.file, formatTime(new Date().toISOString()));
    const host = hosts.find((h) => h.id === pendingProof.host);
    setSelectedHost(pendingProof.host);
    toast.push({ title: `Proof recorded on ${host?.name ?? "host"}`, detail: pendingProof.file, tone: "success" });
    setPendingProof(null);
  }

  function addTab() {
    tabSeq.current += 1;
    const id = `t${tabSeq.current}`;
    setTabs((prev) => [...prev, { id, label: `kali ${prev.length + 1}` }]);
    setActiveTab(id);
  }
  function closeTab(id: string) {
    setTabs((prev) => {
      if (prev.length === 1) return prev;
      const next = prev.filter((t) => t.id !== id);
      if (activeTab === id) setActiveTab(next[next.length - 1].id);
      return next;
    });
    delete termHandles.current[id];
  }

  function runSearch(dir: 1 | -1) {
    const h = termHandles.current[activeTab];
    if (!h || !search.trim()) return;
    if (dir === 1) h.findNext(search);
    else h.findPrevious(search);
  }

  function endSession() {
    setConfirmEnd(false);
    setEnded(true);
    setTermState("ended");
    toast.push({ title: "Session ended", detail: "The Meridian machines are being destroyed.", tone: "neutral" });
  }

  const owned = hosts.filter((h) => h.owned).length;
  const idleLeft = params.get("phase") === "idle" ? 4 : activeSession.idleLimitMin - activeSession.idleMin;
  const idleApproaching = idleLeft <= 10 && !ended;

  const endedView = (
    <div className="lv-ended">
      <span className="lv-ended__icon">
        <Icon name="power" size={22} />
      </span>
      <div className="lv-ended__title">Session ended</div>
      <p className="lv-ended__text">
        The Meridian machines have been destroyed. Your progress, notes, proofs and report are kept. You captured {owned} of {hosts.length} hosts in this run.
      </p>
      <div className="lv-ended__actions">
        <ButtonLink to="/reports/debriefs/deb-meridian-1" variant="primary" iconLeft="chat">
          Read the debrief
        </ButtonLink>
        <ButtonLink to="/labs" variant="secondary" iconLeft="arrow-left">
          Back to Labs
        </ButtonLink>
      </div>
    </div>
  );

  if (!knownSession) {
    return (
      <div className="lv-root">
        <div className="lv-topbar">
          <UiLink to="/labs" className="lv-back">
            <Icon name="arrow-left" size={14} />
            Labs
          </UiLink>
        </div>
        <div className="lv-small-only" style={{ display: "flex" }}>
          <div className="lv-toosmall">
            <span className="lv-toosmall__icon">
              <Icon name="alert-circle" size={22} />
            </span>
            <div className="lv-toosmall__title">Session not found</div>
            <p className="lv-toosmall__text">
              The session <span className="rp-mono">{sessionId}</span> is not running. It may have ended and had its machines destroyed, or the link is wrong. Your progress, notes and reports are kept.
            </p>
            <div className="lv-toosmall__actions">
              <ButtonLink to="/labs" variant="primary" iconLeft="arrow-left">
                Back to Labs
              </ButtonLink>
              <ButtonLink to="/catalogue/meridian#brief" variant="secondary">
                Browse scenarios
              </ButtonLink>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lv-root">
      <div className="lv-topbar">
        <UiLink to="/labs" className="lv-back">
          <Icon name="arrow-left" size={14} />
          Labs
        </UiLink>
        <div className="lv-scenario">
          <span className="lv-scenario__name">{meridian.name}</span>
          <span className="lv-scenario__obj">
            <Icon name="target" size={12} />
            {meridian.objective}
            <span className="rp-mono" style={{ marginLeft: 6 }}>
              {meridian.domain}
            </span>
          </span>
        </div>
        <div className="lv-targets" role="group" aria-label="Hosts">
          {hosts.map((h) => (
            <TargetChip key={h.id} host={h} active={selectedHost === h.id} onClick={() => setSelectedHost(h.id)} />
          ))}
        </div>
        <div className="lv-topbar__right">
          {idleApproaching && (
            <span className="lv-idle">
              <Icon name="clock" size={13} />
              Idle shutdown in {idleLeft} min
            </span>
          )}
          {!ended && <SessionTimer seconds={remaining} />}
          <Button variant="destructive" size="sm" iconLeft="power" onClick={() => setConfirmEnd(true)} disabled={ended}>
            End session
          </Button>
        </div>
      </div>

      {expiring && !ended && (
        <div className="lv-expiring" role="alert">
          <Icon name="warning" size={16} />
          <span className="lv-expiring__text">
            This session ends in under 2 minutes. Extend it to keep your machines, or it shuts down and the hosts are destroyed.
          </span>
          <Button
            size="sm"
            variant="secondary"
            iconLeft="refresh"
            onClick={() => {
              setExpiring(false);
              toast.push({ title: "Session extended by 60 minutes", tone: "success" });
            }}
          >
            Extend 60 minutes
          </Button>
        </div>
      )}

      <div className={`lv-body${leftCollapsed ? " is-left-collapsed" : ""}${rightCollapsed ? " is-right-collapsed" : ""}`}>
        <LeftStrip
          hosts={hosts}
          selectedId={selectedHost}
          onSelect={setSelectedHost}
          proofs={proofs}
          onRecordProof={(h, f) => {
            recordProof(h.id, f, formatTime(new Date().toISOString()));
            toast.push({ title: `Proof recorded on ${h.name}`, detail: f, tone: "success" });
          }}
          collapsed={leftCollapsed}
          onToggle={() => setLeftCollapsed((v) => !v)}
        />

        <div className="lv-main">
          <div className="lv-tabbar" role="tablist" aria-label="Terminal sessions">
            {tabs.map((t) => (
              <span key={t.id} className={activeTab === t.id ? "lv-tab is-on" : "lv-tab"}>
                <button type="button" role="tab" aria-selected={activeTab === t.id} className="rp-link" style={{ color: "inherit" }} onClick={() => setActiveTab(t.id)}>
                  <span className="rp-mono">{t.label}</span>
                </button>
                {tabs.length > 1 && (
                  <button type="button" className="lv-tab__close" aria-label={`Close ${t.label}`} onClick={() => closeTab(t.id)}>
                    <Icon name="x" size={12} />
                  </button>
                )}
              </span>
            ))}
            <button type="button" className="lv-tabadd" aria-label="New terminal tab" onClick={addTab} disabled={ended}>
              <Icon name="plus" size={15} />
            </button>
          </div>

          <div className="lv-toolbar" role="toolbar" aria-label="Terminal controls">
            <div className="lv-search">
              <Icon name="search" size={13} />
              <input
                value={search}
                placeholder="Search scrollback"
                aria-label="Search terminal scrollback"
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    runSearch(e.shiftKey ? -1 : 1);
                  }
                }}
              />
              <span className="lv-search__nav">
                <button type="button" className="lv-search__btn" aria-label="Previous match" disabled={!search.trim()} onClick={() => runSearch(-1)}>
                  <Icon name="chevron-up" size={14} />
                </button>
                <button type="button" className="lv-search__btn" aria-label="Next match" disabled={!search.trim()} onClick={() => runSearch(1)}>
                  <Icon name="chevron-down" size={14} />
                </button>
              </span>
            </div>
            <div className="lv-fontctl" role="group" aria-label="Font size">
              <button type="button" className="lv-fontctl__btn" aria-label="Smaller font" disabled={fontIdx === 0} onClick={() => setFontIdx((i) => Math.max(0, i - 1))}>
                <Icon name="minus" size={13} />
              </button>
              <span className="lv-fontctl__val rp-num">{FONT_SIZES[fontIdx]}px</span>
              <button type="button" className="lv-fontctl__btn" aria-label="Larger font" disabled={fontIdx === FONT_SIZES.length - 1} onClick={() => setFontIdx((i) => Math.min(FONT_SIZES.length - 1, i + 1))}>
                <Icon name="plus" size={13} />
              </button>
            </div>
            <IconButton
              icon="copy"
              label="Copy selection"
              size="sm"
              onClick={() => toast.push({ title: "Selection copied", detail: "Terminal selection copied to the clipboard." })}
            />
            <div className="lv-toolbar__spacer" />
            <button type="button" className="lv-notebtn" onClick={saveNote} disabled={ended}>
              <Icon name="note" size={14} />
              Note
              <kbd>Ctrl+Shift+S</kbd>
            </button>
          </div>

          <div className="lv-terms">
            {ended ? (
              endedView
            ) : (
              tabs.map((t) => (
                <div key={t.id} className="lv-termslot" hidden={activeTab !== t.id}>
                  {pendingProof && activeTab === t.id && (
                    <div className="lv-proofbanner" role="status">
                      <Icon name="flag" size={16} />
                      <span className="lv-proofbanner__text">
                        Proof found: <span className="lv-proofbanner__file rp-mono">{pendingProof.file}</span> on {hosts.find((h) => h.id === pendingProof.host)?.name}
                      </span>
                      <Button size="sm" variant="secondary" iconLeft="flag" onClick={confirmPendingProof}>
                        Record proof
                      </Button>
                      <IconButton icon="x" label="Dismiss" size="sm" onClick={() => setPendingProof(null)} />
                    </div>
                  )}
                  <LabTerminal
                    state={termState}
                    fontSize={FONT_SIZES[fontIdx]}
                    active={activeTab === t.id}
                    reconnectAttempt={reconnectAttempt}
                    onReconnect={() => {
                      setTermState("connecting");
                      window.setTimeout(() => setTermState("connected"), 900);
                    }}
                    onResult={onResult}
                    termRef={(h) => (termHandles.current[t.id] = h)}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        <div className={rightCollapsed ? "lv-right is-collapsed" : "lv-right"}>
          {rightCollapsed ? (
            <div className="lv-rail">
              <IconButton icon="panel-left" label="Expand Onyx" size="sm" onClick={() => setRightCollapsed(false)} />
              <span className="lv-rail__dot" aria-hidden="true" />
              <span className="lv-rail__label">ONYX</span>
            </div>
          ) : (
            <OnyxPanel
              compact
              level={chat.level}
              onLevelChange={chat.setLevel}
              messages={chat.messages}
              onSend={chat.send}
              onCommand={chat.runCommand}
              groundedTo={`${meridian.name} · ${meridian.domain}`}
              connection={ended ? "offline" : chat.busy ? "streaming" : "ready"}
              headerActions={<IconButton icon="panel-right" label="Collapse Onyx" size="sm" onClick={() => setRightCollapsed(true)} />}
            />
          )}
        </div>
      </div>

      <div className="lv-small-only">
        <div className="lv-toosmall">
          <span className="lv-toosmall__icon">
            <Icon name="monitor" size={22} />
          </span>
          <div className="lv-toosmall__title">The lab view needs a wider window</div>
          <p className="lv-toosmall__text">
            The terminal, host detail and Onyx need at least 1280px of width to work side by side. Widen this window, or open the labs list to manage the session from there.
          </p>
          <div className="lv-toosmall__actions">
            <ButtonLink to="/labs" variant="primary" iconLeft="arrow-left">
              Open Labs
            </ButtonLink>
            <Button variant="secondary" onClick={() => document.querySelector<HTMLElement>(".lv-small-only")?.style.setProperty("display", "none")}>
              Continue anyway
            </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={endSession}
        title="End this session"
        confirmLabel="End session"
        destructive
      >
        <p>The Meridian machines are destroyed when the session ends. Your progress, notes, proofs and report are kept.</p>
        <p style={{ marginTop: 10 }}>You have captured {owned} of {hosts.length} hosts. Starting Meridian again provisions fresh machines.</p>
      </ConfirmDialog>
    </div>
  );
}
