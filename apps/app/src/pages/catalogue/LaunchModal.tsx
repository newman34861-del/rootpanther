import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  ButtonLink,
  Callout,
  HelpDial,
  HELP_LEVELS,
  Icon,
  Modal,
  RadioGroup,
  Spinner,
  cx,
  formatDate,
  formatDuration,
  formatNumber,
  useMediaQuery,
} from "@rootpanther/ui";
import type { ConnectionMethod, HelpLevel, Scenario } from "@rootpanther/ui";
import { activeSession, currentUser, usage } from "../../mock/account";

type Phase = "configure" | "provisioning" | "failed";
type StepState = "pending" | "active" | "done" | "failed";

const TENANT = "rp-t-4qmx9a";
const STEP_MS = 1100;
const MAX_LIFE_MIN = 240;
const FAIL_AT = 1;

interface Step {
  label: string;
  detail: string;
}

function buildSteps(s: Scenario, connection: ConnectionMethod): Step[] {
  return [
    { label: "Allocating tenant", detail: `${TENANT}, lab-uks` },
    { label: `Deploying ${s.hostCount} ${s.hostCount === 1 ? "host" : "hosts"}`, detail: s.hosts.map((h) => h.name).join(", ") },
    { label: "Verifying isolation", detail: "Egress blocked, tenant VLAN 3412" },
    { label: "Issuing OpenVPN certificates", detail: connection === "openvpn" ? "Client 10.13.37.201/32" : "Client for the hosted Kali" },
  ];
}

export interface LaunchModalProps {
  open: boolean;
  onClose: () => void;
  scenario: Scenario;
  labActive: boolean;
  startFailed?: boolean;
}

export function LaunchModal({ open, onClose, scenario: s, labActive, startFailed }: LaunchModalProps) {
  const navigate = useNavigate();
  const narrow = useMediaQuery("(max-width: 767px)");
  const examLocked = s.type === "exam-sim";
  const [connection, setConnection] = useState<ConnectionMethod>(currentUser.connectionDefault);
  const [help, setHelp] = useState<HelpLevel>(examLocked ? "exam-sim" : currentUser.helpDefault);
  const [phase, setPhase] = useState<Phase>("configure");
  const [progress, setProgress] = useState(0);
  const timers = useRef<number[]>([]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const steps = buildSteps(s, connection);
  const remaining = Math.max(0, usage.allowanceHours - usage.usedHours);
  const estHours = s.estMinutes / 60;
  const shortOfHours = estHours > remaining;
  const replacing = labActive && s.id !== activeSession.scenarioId;

  function clearTimers() {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
  }

  useEffect(() => {
    if (!open) {
      clearTimers();
      return;
    }
    setConnection(currentUser.connectionDefault);
    setHelp(examLocked ? "exam-sim" : currentUser.helpDefault);
    if (startFailed) {
      setPhase("failed");
      setProgress(FAIL_AT);
    } else {
      setPhase("configure");
      setProgress(0);
    }
  }, [open, startFailed, examLocked]);

  useEffect(() => clearTimers, []);

  function run() {
    clearTimers();
    setPhase("provisioning");
    setProgress(0);
    steps.forEach((_, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setProgress(i + 1);
          if (i === steps.length - 1) {
            timers.current.push(window.setTimeout(() => navigate(`/lab/${activeSession.id}`), 500));
          }
        }, STEP_MS * (i + 1)),
      );
    });
  }

  useEffect(() => {
    if (phase !== "configure") headingRef.current?.focus();
  }, [phase]);

  function stepState(i: number): StepState {
    if (phase === "failed") return i < progress ? "done" : i === progress ? "failed" : "pending";
    if (phase === "provisioning") return i < progress ? "done" : i === progress ? "active" : "pending";
    return "pending";
  }

  const provisioningFooter =
    phase === "provisioning" ? (
      <>
        <span className="sd-launch__footnote">Usually under 90 seconds. Lab hours start when the hosts are reachable.</span>
        <Button
          variant="quiet"
          onClick={() => {
            clearTimers();
            setPhase("configure");
            setProgress(0);
          }}
        >
          Cancel launch
        </Button>
      </>
    ) : phase === "failed" ? (
      <>
        <Button variant="quiet" onClick={onClose}>
          Close
        </Button>
        <Button variant="primary" iconLeft="refresh" onClick={() => run()}>
          Retry launch
        </Button>
      </>
    ) : (
      <>
        <Button variant="quiet" onClick={onClose}>
          Cancel
        </Button>
        <Button variant="primary" iconLeft="play" onClick={() => run()}>
          Launch {s.name}
        </Button>
      </>
    );

  return (
    <Modal
      open={open}
      onClose={onClose}
      dismissable={phase !== "provisioning"}
      title={phase === "configure" ? `Launch ${s.name}` : phase === "failed" ? `${s.name} did not provision` : `Provisioning ${s.name}`}
      size="lg"
      icon={phase === "failed" ? "alert-circle" : undefined}
      tone={phase === "failed" ? "crit" : undefined}
      footer={provisioningFooter}
      bodyClassName="sd-launch"
    >
      {phase === "configure" ? (
        <div className="sd-launch__form">
          {replacing && (
            <Callout tone="med" title={`${activeSession.scenarioName} is running`}>
              One lab runs at a time. Launching {s.name} ends {activeSession.scenarioName} and destroys its machines. Its progress, notes and proofs stay on your account.
            </Callout>
          )}

          <RadioGroup<ConnectionMethod>
            name="sd-connection"
            legend="Connection"
            layout="cards"
            value={connection}
            onChange={setConnection}
            options={[
              {
                value: "browser",
                label: (
                  <span className="sd-launch__opt">
                    In-browser terminal{currentUser.connectionDefault === "browser" && <span className="sd-launch__default">Default</span>}
                  </span>
                ),
                description: "Hosted Kali in the lab view. No setup.",
              },
              {
                value: "openvpn",
                label: (
                  <span className="sd-launch__opt">
                    Your Kali over OpenVPN{currentUser.connectionDefault === "openvpn" && <span className="sd-launch__default">Default</span>}
                  </span>
                ),
                description: "Uses your existing rootpanther-lab.ovpn. No new download.",
              },
            ]}
          />

          <div className="sd-launch__field">
            <div className="sd-launch__labelrow">
              <span className="rp-field__label" id="sd-help-label">
                Onyx help level
              </span>
              <span className="sd-launch__hint">{examLocked ? "Locked for exam simulations" : "Changes during the lab are recorded"}</span>
            </div>
            <HelpDial value={help} onChange={setHelp} compact={narrow} label="Onyx help level for this lab" disabledLevels={examLocked ? HELP_LEVELS.filter((l) => l.id !== "exam-sim").map((l) => l.id) : []} />
          </div>

          <div className="sd-launch__hours">
            <div className="sd-launch__hour">
              <span className="sd-launch__k">Lab hours left</span>
              <span className="sd-launch__v rp-mono rp-num">
                {formatNumber(remaining, 1)} <span className="sd-launch__unit">of {usage.allowanceHours} h</span>
              </span>
            </div>
            <div className="sd-launch__hour">
              <span className="sd-launch__k">Estimated time</span>
              <span className="sd-launch__v rp-mono rp-num">{formatDuration(s.estMinutes)}</span>
            </div>
            <div className="sd-launch__hour">
              <span className="sd-launch__k">Session limit</span>
              <span className="sd-launch__v rp-mono rp-num">
                {examLocked ? formatDuration(s.estMinutes) : `${MAX_LIFE_MIN / 60}h`} <span className="sd-launch__unit">{examLocked ? "fixed" : "extendable"}</span>
              </span>
            </div>
            <div className="sd-launch__hour">
              <span className="sd-launch__k">Allowance resets</span>
              <span className="sd-launch__v rp-num">{formatDate(usage.resetsOn, { day: "numeric", month: "short" })}</span>
            </div>
          </div>

          {shortOfHours && (
            <Callout tone="med" title={`This run needs about ${formatDuration(s.estMinutes)}`}>
              You have {formatNumber(remaining, 1)} h left this period. The session stops when the allowance runs out unless you add hours on{" "}
              <ButtonLink to="/billing" variant="quiet" size="sm" className="sd-inline-link">
                Billing
              </ButtonLink>
              .
            </Callout>
          )}

          <Callout tone="info" icon="info" title="Machines are destroyed when the session ends">
            Progress, notes, proofs and reports stay on your account.
            {s.status === "in-progress" && s.history ? ` Your last attempt captured ${s.history.proofsCaptured} of ${s.history.proofsTotal} proofs; those are kept and the new session starts on fresh machines.` : ""}
          </Callout>

        </div>
      ) : (
        <div className="sd-prov">
          <h3 ref={headingRef} tabIndex={-1} className="rp-sr">
            {phase === "failed" ? "Provisioning failed" : "Provisioning"}
          </h3>
          <ol className="sd-prov__steps" aria-label="Provisioning steps">
            {steps.map((st, i) => {
              const state = stepState(i);
              return (
                <li key={st.label} className={cx("sd-prov__step", `is-${state}`)} aria-current={state === "active" ? "step" : undefined}>
                  <span className="sd-prov__icon" aria-hidden="true">
                    {state === "done" ? <Icon name="check" size={14} strokeWidth={2.25} /> : state === "active" ? <Spinner size={14} /> : state === "failed" ? <Icon name="x" size={14} strokeWidth={2.25} /> : <span className="sd-prov__pending" />}
                  </span>
                  <span className="sd-prov__text">
                    <span className="sd-prov__label">{st.label}</span>
                    <span className="sd-prov__detail rp-mono">{state === "failed" ? `${s.hosts[Math.min(1, s.hosts.length - 1)].name} failed its health check after 180 s` : st.detail}</span>
                  </span>
                  <span className="sd-prov__state">
                    {state === "done" ? "Done" : state === "active" ? "Running" : state === "failed" ? "Failed" : phase === "failed" ? "Not run" : "Waiting"}
                    <span className="rp-sr">: {st.label}</span>
                  </span>
                </li>
              );
            })}
          </ol>
          <p className="rp-sr" role="status" aria-live="polite">
            {phase === "failed" ? "Provisioning failed. No lab hours were charged." : progress >= steps.length ? "Lab ready. Opening the lab view." : `${steps[progress]?.label ?? ""}`}
          </p>
          {phase === "failed" ? (
            <Callout tone="crit" title="No lab hours were charged" role="alert">
              The deployment was rolled back and the tenant released. Retry usually lands on a healthy host pool. If it fails again, report it from Labs with reference <span className="rp-mono">prov_8Kd2Lq</span>.
            </Callout>
          ) : (
            <div className="sd-prov__summary">
              <span>
                <Icon name={connection === "openvpn" ? "network" : "monitor"} size={14} />
                {connection === "openvpn" ? "OpenVPN" : "In-browser terminal"}
              </span>
              <span>
                <Icon name="chat" size={14} />
                Onyx: {HELP_LEVELS.find((l) => l.id === help)?.label}
              </span>
              <span className="rp-mono">{TENANT}</span>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
