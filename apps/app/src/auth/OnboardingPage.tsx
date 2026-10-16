import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Badge, Button, ButtonLink, Icon, SCENARIO_TYPE_LABEL, TIER_NAMES, TIER_ORDER, TierDot, TechniqueTag, cx, formatDuration, readStorage, writeStorage } from "@rootpanther/ui";
import type { ConnectionMethod, Scenario, TierCode } from "@rootpanther/ui";
import { scenarioById } from "../mock/scenarios";
import { AuthLayout } from "./AuthLayout";
import { ChoiceCard } from "./parts";

const TIER_DESC: Record<TierCode, string> = {
  C1: "New to OSCP-style work. Single hosts, enumeration discipline, first privilege escalations.",
  C2: "Comfortable on standalone boxes. Ready for small AD sets, Kerberoasting and pivoting.",
  C3: "Working through AD chains. ACL abuse, delegation and multi-hop pivots.",
  C4: "Exam-ready. Forest trusts, certificate abuse and full timed simulations.",
};

const PICKS: Record<TierCode, { id: string; reason: string }[]> = {
  C1: [
    { id: "lattice", reason: "Command injection to sudo abuse. The shortest full chain." },
    { id: "halcyon", reason: "Upload filter bypass, then a writable cron script." },
    { id: "kestrel", reason: "Public exploit, then an unquoted service path on Windows." },
  ],
  C2: [
    { id: "basalt", reason: "Standalone warm-up: template injection and a capability binary." },
    { id: "meridian", reason: "Your first AD set. Kerberoasting into an ACL edge." },
    { id: "ironwood", reason: "Constrained delegation on a three-host domain." },
  ],
  C3: [
    { id: "harrow", reason: "Insecure deserialization and DLL search order on Windows." },
    { id: "vesper", reason: "ACL chain into resource-based constrained delegation." },
    { id: "cinder", reason: "Child domain to forest root over a parent-child trust." },
  ],
  C4: [
    { id: "quarry", reason: "Certificate template abuse, then a partner forest trust." },
    { id: "obsidian", reason: "Full 23 h 45 m simulation with an ACL and delegation AD set." },
    { id: "cinder", reason: "Trust abuse refresher before the exam simulation." },
  ],
};

const STEPS = ["Declare your Path", "How you connect", "First lab"] as const;
const DRAFT_KEY = "rp-onboarding";

interface Draft {
  tier: TierCode;
  connection: ConnectionMethod;
  lab: string | null;
}

function parseStep(raw: string | null): 1 | 2 | 3 {
  return raw === "2" ? 2 : raw === "3" ? 3 : 1;
}

function StepIndicator({ step }: { step: number }) {
  return (
    <ol className="ob-steps" aria-label="Setup progress">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const state = n < step ? "done" : n === step ? "current" : "todo";
        return (
          <li key={label} className={cx("ob-steps__item", `is-${state}`)} aria-current={state === "current" ? "step" : undefined}>
            <span className="ob-steps__num rp-mono" aria-hidden="true">
              {state === "done" ? <Icon name="check" size={12} strokeWidth={2.5} /> : n}
            </span>
            <span className="ob-steps__label">
              {label}
              <span className="rp-sr">{state === "done" ? ", done" : state === "current" ? ", current step" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TierStep({ value, onChange }: { value: TierCode; onChange: (t: TierCode) => void }) {
  return (
    <fieldset className="ob-fieldset">
      <legend className="rp-sr">Path tier</legend>
      <div className="ob-grid ob-grid--2">
        {TIER_ORDER.map((t) => (
          <ChoiceCard
            key={t}
            name="tier"
            value={t}
            checked={value === t}
            onSelect={() => onChange(t)}
            title={<TierDot tier={t} />}
            description={TIER_DESC[t]}
          />
        ))}
      </div>
    </fieldset>
  );
}

function ConnectStep({ value, onChange }: { value: ConnectionMethod; onChange: (c: ConnectionMethod) => void }) {
  return (
    <fieldset className="ob-fieldset">
      <legend className="rp-sr">Default connection method</legend>
      <div className="ob-grid ob-grid--2">
        <ChoiceCard
          name="connection"
          value="browser"
          checked={value === "browser"}
          onSelect={() => onChange("browser")}
          title={
            <>
              <Icon name="monitor" size={16} />
              In-browser terminal
            </>
          }
          description="Hosted Kali in the lab view, next to Onyx. Nothing to install."
        >
          <ul className="ob-facts">
            <li>Kali rolling with the standard toolset</li>
            <li>tmux, scrollback search, copy and paste</li>
            <li>Home directory kept between sessions</li>
          </ul>
        </ChoiceCard>
        <ChoiceCard
          name="connection"
          value="openvpn"
          checked={value === "openvpn"}
          onSelect={() => onChange("openvpn")}
          title={
            <>
              <Icon name="network" size={16} />
              Your own Kali over OpenVPN
            </>
          }
          description="Your tools and config. Download a .ovpn per session and run sudo openvpn to connect."
        >
          <ul className="ob-facts">
            <li>
              Needs <span className="rp-mono">openvpn</span> on your machine
            </li>
            <li>One config per session, rotated on launch</li>
            <li>Browser terminal stays available as a fallback</li>
          </ul>
        </ChoiceCard>
      </div>
    </fieldset>
  );
}

function LabStep({ tier, value, onChange }: { tier: TierCode; value: string | null; onChange: (id: string) => void }) {
  const picks = PICKS[tier].map((p) => ({ ...p, scenario: scenarioById(p.id) })).filter((p): p is { id: string; reason: string; scenario: Scenario } => !!p.scenario);
  return (
    <fieldset className="ob-fieldset">
      <legend className="rp-sr">First lab</legend>
      <div className="ob-labs">
        {picks.map(({ id, reason, scenario: s }) => (
          <ChoiceCard
            key={id}
            name="lab"
            value={id}
            checked={value === id}
            onSelect={() => onChange(id)}
            className="ob-lab"
            title={
              <>
                {s.name}
                <Badge>{SCENARIO_TYPE_LABEL[s.type]}</Badge>
              </>
            }
            aside={<TierDot tier={s.tier} display="code" size="sm" />}
            description={reason}
          >
            <span className="ob-lab__meta">
              <span className="ob-lab__fact">
                <Icon name="target" size={13} />
                {s.objective}
              </span>
              <span className="ob-lab__fact rp-mono rp-num">
                {s.hostCount} {s.hostCount === 1 ? "host" : "hosts"}
              </span>
              <span className="ob-lab__fact rp-mono rp-num">~{formatDuration(s.estMinutes)}</span>
              <span className="ob-lab__tags">
                {s.techniques.slice(0, 3).map((t) => (
                  <TechniqueTag key={t} technique={t} />
                ))}
              </span>
            </span>
          </ChoiceCard>
        ))}
      </div>
    </fieldset>
  );
}

export default function OnboardingPage() {
  const [params, setParams] = useSearchParams();
  const step = parseStep(params.get("step"));
  const [draft, setDraft] = useState<Draft>(() => readStorage<Draft>(DRAFT_KEY, { tier: "C2", connection: "browser", lab: null }));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const prevStep = useRef(step);

  useEffect(() => writeStorage(DRAFT_KEY, draft), [draft]);

  useEffect(() => {
    if (prevStep.current === step) return;
    prevStep.current = step;
    headingRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [step]);

  const picks = PICKS[draft.tier];
  const lab = draft.lab && picks.some((p) => p.id === draft.lab) ? draft.lab : picks[0].id;
  const labScenario = scenarioById(lab);

  function go(n: 1 | 2 | 3) {
    setParams({ step: String(n) });
  }

  const titles: Record<1 | 2 | 3, { title: string; sub: string }> = {
    1: {
      title: "Declare your Path",
      sub: "Pick the tier closest to where you are. It drives recommendations, not access, and you can change it any time in My Path. It is separate from the Onyx help level you set inside each lab.",
    },
    2: { title: "How will you connect", sub: "This becomes the default for new labs. Change it per lab or in Settings." },
    3: { title: "Pick your first lab", sub: `Recommended for ${draft.tier} ${TIER_NAMES[draft.tier]}. Labs are destroyed when a session ends. Notes, proofs and reports stay on your account.` },
  };

  return (
    <AuthLayout wide>
      <div className="ob">
        <div className="ob__top">
          <StepIndicator step={step} />
          <Link to="/" className="ob__skip" onClick={() => writeStorage(DRAFT_KEY, null)}>
            Skip setup
          </Link>
        </div>
        <div className="ob__body rp-view" key={step}>
          <header className="ob__head">
            <h1 ref={headingRef} tabIndex={-1} className="ob__title">
              {titles[step].title}
            </h1>
            <p className="ob__sub">{titles[step].sub}</p>
          </header>
          {step === 1 && <TierStep value={draft.tier} onChange={(tier) => setDraft({ ...draft, tier, lab: null })} />}
          {step === 2 && <ConnectStep value={draft.connection} onChange={(connection) => setDraft({ ...draft, connection })} />}
          {step === 3 && (
            <>
              <LabStep tier={draft.tier} value={lab} onChange={(id) => setDraft({ ...draft, lab: id })} />
              <p className="ob__alt">
                Something else in mind? <Link to="/catalogue" onClick={() => writeStorage(DRAFT_KEY, null)}>Browse the catalogue</Link>
              </p>
            </>
          )}
        </div>
        <div className="ob__foot">
          {step > 1 ? (
            <Button variant="quiet" iconLeft="arrow-left" onClick={() => go((step - 1) as 1 | 2)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 3 ? (
            <Button variant="primary" iconRight="arrow-right" onClick={() => go((step + 1) as 2 | 3)}>
              Continue
            </Button>
          ) : (
            labScenario && (
              <ButtonLink to={`/catalogue/${labScenario.slug}`} variant="primary" iconLeft="play" onClick={() => writeStorage(DRAFT_KEY, null)}>
                Launch {labScenario.name}
              </ButtonLink>
            )
          )}
        </div>
      </div>
    </AuthLayout>
  );
}
