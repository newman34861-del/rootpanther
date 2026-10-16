import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ClipboardEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, Callout, IconButton, Input, Lockup, StatusDot, applyTheme, readStorage, useToast } from "@rootpanther/ui";
import type { ThemePreference } from "@rootpanther/ui";
import { operator } from "../mock/operator";
import { useDataState } from "../review/review";
import "./auth.css";

const ALLOWED_IP = "203.0.113.24";
const BLOCKED_IP = "198.51.100.23";
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Auth screens are always dark. The shell's theme hook can re-apply light after this mounts, so watch the attribute.
function useForceDark() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.removeAttribute("data-theme");
    const mo = new MutationObserver(() => {
      if (root.hasAttribute("data-theme")) root.removeAttribute("data-theme");
    });
    mo.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mo.disconnect();
      const pref = readStorage<ThemePreference>("rp-portal-theme", "dark");
      const sys = window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
      applyTheme(pref === "system" ? sys : pref);
    };
  }, []);
}

function clockIn(minutes: number) {
  return new Date(Date.now() + minutes * 60000).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function PolicyPanel({ blocked }: { blocked: boolean }) {
  const rows: { label: string; value: ReactNode }[] = [
    {
      label: "Your IP",
      value: (
        <span className="os-policy__ip">
          <span className="rp-mono">{blocked ? BLOCKED_IP : ALLOWED_IP}</span>
          {blocked ? <StatusDot tone="crit" size="sm" label="Not on allowlist" /> : <StatusDot tone="success" size="sm" label="On allowlist" />}
        </span>
      ),
    },
    { label: "Two-factor", value: "Required at every sign-in" },
    { label: "Idle lock", value: <><span className="rp-mono rp-num">15</span> minutes without input</> },
    { label: "Session", value: <span className="rp-mono">portal.rootpanther.com</span> },
  ];
  return (
    <aside className="os-policy" aria-label="Access policy">
      <span className="rp-eyebrow">Access policy</span>
      <dl className="os-policy__list">
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.value}</dd>
          </div>
        ))}
      </dl>
      <ul className="os-policy__notes">
        <li>Operator accounts are created by an owner. There is no self-registration.</li>
        <li>The session cookie is scoped to this host and is not shared with the learner app.</li>
        <li>Every sign-in, success or failure, is written to the audit log with your IP.</li>
      </ul>
    </aside>
  );
}

function Frame({ step, blocked, children }: { step: string; blocked: boolean; children: ReactNode }) {
  return (
    <div className="os-page">
      <main className="os-main" id="main">
        <div className="os-card">
          <section className="os-form rp-view" key={step} aria-labelledby="os-title">
            <Lockup size="md" badge="PORTAL" />
            {children}
          </section>
          <PolicyPanel blocked={blocked} />
        </div>
        <p className="os-foot">
          <span className="os-env rp-mono">
            <span className="os-env__dot" aria-hidden="true" />
            production
          </span>
          <span className="rp-mono">portal.rootpanther.com</span>
        </p>
      </main>
    </div>
  );
}

function Blocked() {
  return (
    <>
      <h1 id="os-title" className="os-title">
        Operator sign-in
      </h1>
      <Callout tone="crit" icon="lock" role="alert" title="This network is not on the allowlist">
        Connections from <span className="rp-mono rp-strong">{BLOCKED_IP}</span> are refused before credentials are checked. Connect through the company VPN, or ask an owner to add this address in System.
      </Callout>
      <dl className="os-refs">
        <div>
          <dt>Request</dt>
          <dd className="rp-mono">req_9d41b0</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd className="rp-mono rp-num">{new Date().toISOString().slice(0, 16).replace("T", " ")} UTC</dd>
        </div>
      </dl>
    </>
  );
}

function Credentials() {
  const state = useDataState();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  // The review panel has no "locked" option, so its Empty state previews the locked account.
  const presetLocked = params.get("state") === "locked" || state === "empty";
  const presetError = state === "error";
  const [email, setEmail] = useState(presetError || presetLocked ? operator.email : "");
  const [password, setPassword] = useState(presetError ? "••••••••••" : "");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [attempts, setAttempts] = useState(presetError ? 2 : presetLocked ? MAX_ATTEMPTS : 0);
  const [failed, setFailed] = useState(presetError);
  const [lockedUntil] = useState(() => clockIn(LOCK_MINUTES));
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const loading = state === "loading" || busy;
  const locked = attempts >= MAX_ATTEMPTS;

  useEffect(() => {
    if (!presetError && !presetLocked) emailRef.current?.focus();
  }, [presetError, presetLocked]);

  function submit(e: FormEvent) {
    e.preventDefault();
    if (locked || loading) return;
    const next: typeof errors = {};
    if (!email.trim()) next.email = "Enter your work email.";
    else if (!EMAIL_RE.test(email.trim())) next.email = "Enter a full email address, like name@rootpanther.com.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    setFailed(false);
    window.setTimeout(() => {
      setBusy(false);
      const ok = email.trim().toLowerCase().endsWith("@rootpanther.com") && password.length >= 8;
      if (ok) {
        navigate("/signin/2fa", { state: { email: email.trim() } });
        return;
      }
      setAttempts((a) => a + 1);
      setFailed(true);
      setPassword("");
    }, 700);
  }

  const left = MAX_ATTEMPTS - attempts;

  return (
    <>
      <h1 id="os-title" className="os-title">
        Operator sign-in
      </h1>
      <div aria-live="assertive" className="os-alert">
        {locked ? (
          <Callout tone="crit" icon="lock" role="alert" title="Account locked">
            {MAX_ATTEMPTS} failed attempts. Sign-in is blocked until <span className="rp-mono rp-num rp-strong">{lockedUntil}</span>. An owner can clear the lock sooner in System.
          </Callout>
        ) : failed ? (
          <Callout tone="crit" role="alert" title="Email or password is incorrect">
            <span className="rp-mono rp-num rp-strong">{left}</span> {left === 1 ? "attempt" : "attempts"} left before the account locks for {LOCK_MINUTES} minutes.
          </Callout>
        ) : null}
      </div>
      <form className="os-fields" onSubmit={submit} noValidate>
        <Input
          ref={emailRef}
          label="Work email"
          type="email"
          name="email"
          autoComplete="username"
          spellCheck={false}
          inputSize="lg"
          mono
          placeholder="name@rootpanther.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (errors.email) setErrors({ ...errors, email: undefined });
          }}
          error={errors.email}
          disabled={loading || locked}
        />
        <Input
          label="Password"
          type={show ? "text" : "password"}
          name="password"
          autoComplete="current-password"
          inputSize="lg"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (errors.password) setErrors({ ...errors, password: undefined });
          }}
          error={errors.password}
          disabled={loading || locked}
          suffix={<IconButton icon={show ? "eye-off" : "eye"} label={show ? "Hide password" : "Show password"} size="sm" onClick={() => setShow(!show)} aria-pressed={show} disabled={loading || locked} />}
        />
        <Button type="submit" variant="primary" size="lg" block loading={loading} disabled={locked}>
          {loading ? "Checking" : "Continue"}
        </Button>
      </form>
      <p className="os-help">Forgot your password or lost your authenticator? An owner can reset both from System.</p>
    </>
  );
}

const SEQUENTIAL = ["012345", "123456", "234567", "345678", "456789", "987654", "654321"];

function TwoFactor() {
  const state = useDataState();
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const email = (location.state as { email?: string } | null)?.email ?? operator.email;
  const [digits, setDigits] = useState<string[]>(() => (state === "error" ? "482913".split("") : Array(6).fill("")));
  const [error, setError] = useState(state === "error" ? "That code is incorrect or expired. Codes change every 30 seconds." : "");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [code, setCode] = useState("");
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const refocus = useRef(false);
  const loading = state === "loading" || busy;

  useEffect(() => {
    if (state !== "error") refs.current[0]?.focus();
  }, [state]);

  useEffect(() => {
    if (!busy && refocus.current) {
      refocus.current = false;
      refs.current[0]?.focus();
    }
  }, [busy]);

  function verify(value: string) {
    if (loading) return;
    setBusy(true);
    setError("");
    window.setTimeout(() => {
      setBusy(false);
      const bad = recovery ? !/^[a-z0-9]{5}-[a-z0-9]{5}$/i.test(value) : /^(\d)\1{5}$/.test(value) || SEQUENTIAL.includes(value);
      if (bad) {
        setError(recovery ? "Recovery codes look like ab12c-3de45. Each code works once." : "That code is incorrect or expired. Codes change every 30 seconds.");
        if (!recovery) {
          setDigits(Array(6).fill(""));
          refocus.current = true;
        }
        return;
      }
      toast.push({ title: `Signed in as ${operator.name}`, detail: "The portal locks after 15 minutes without input.", tone: "success" });
      navigate("/", { replace: true });
    }, 650);
  }

  function setAt(i: number, v: string) {
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (error) setError("");
    if (next.every((d) => d !== "")) verify(next.join(""));
  }

  function onChange(i: number, raw: string) {
    const v = raw.replace(/\D/g, "");
    if (!v) {
      setAt(i, "");
      return;
    }
    if (v.length > 1) {
      fill(i, v);
      return;
    }
    setAt(i, v);
    if (i < 5) refs.current[i + 1]?.focus();
  }

  function fill(from: number, v: string) {
    const next = [...digits];
    v.slice(0, 6 - from)
      .split("")
      .forEach((d, k) => (next[from + k] = d));
    setDigits(next);
    if (error) setError("");
    const last = Math.min(5, from + v.length);
    refs.current[next.every((d) => d) ? 5 : last]?.focus();
    if (next.every((d) => d !== "")) verify(next.join(""));
  }

  function onPaste(i: number, e: ClipboardEvent<HTMLInputElement>) {
    const v = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!v) return;
    e.preventDefault();
    fill(v.length >= 6 ? 0 : i, v);
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      e.preventDefault();
      setAt(i - 1, "");
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowLeft" && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < 5) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  }

  return (
    <>
      <div className="os-titles">
        <h1 id="os-title" className="os-title">
          Two-factor authentication
        </h1>
        <p className="os-who">
          <span className="rp-mono">{email}</span>
          <Link to="/signin" className="os-who__link">
            Not you
          </Link>
        </p>
      </div>
      <form
        className="os-fields"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (recovery) {
            if (!code.trim()) {
              setError("Enter a recovery code.");
              return;
            }
            verify(code.trim());
          } else if (digits.every((d) => d)) verify(digits.join(""));
          else {
            setError("Enter all 6 digits.");
            refs.current[digits.findIndex((d) => !d)]?.focus();
          }
        }}
      >
        {recovery ? (
          <Input
            label="Recovery code"
            name="recovery"
            mono
            inputSize="lg"
            autoComplete="off"
            spellCheck={false}
            placeholder="ab12c-3de45"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError("");
            }}
            error={error || undefined}
            disabled={loading}
            hint="Each recovery code works once. Using one is recorded in the audit log."
            autoFocus
          />
        ) : (
          <fieldset className="os-otp" aria-describedby={error ? "os-otp-error" : "os-otp-hint"}>
            <legend className="rp-field__label">6-digit code from your authenticator app</legend>
            <div className={error ? "os-otp__cells is-invalid" : "os-otp__cells"}>
              {digits.map((d, i) => (
                <Fragment key={i}>
                  {i === 3 && <span className="os-otp__gap" aria-hidden="true" />}
                  <input
                    ref={(el) => (refs.current[i] = el)}
                    className="os-otp__cell rp-mono"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete={i === 0 ? "one-time-code" : "off"}
                    maxLength={6}
                    value={d}
                    aria-label={`Digit ${i + 1} of 6`}
                    aria-invalid={error ? true : undefined}
                    disabled={loading}
                    onChange={(e) => onChange(i, e.target.value)}
                    onPaste={(e) => onPaste(i, e)}
                    onKeyDown={(e) => onKey(i, e)}
                    onFocus={(e) => e.target.select()}
                  />
                </Fragment>
              ))}
            </div>
            {error ? (
              <p className="rp-field__error" id="os-otp-error" role="alert">
                {error}
              </p>
            ) : (
              <p className="rp-field__hint" id="os-otp-hint">
                Paste the full code or type it. It submits on the sixth digit.
              </p>
            )}
          </fieldset>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={loading}>
          {loading ? "Verifying" : "Verify"}
        </Button>
      </form>
      <button
        type="button"
        className="rp-link os-switch"
        onClick={() => {
          setRecovery(!recovery);
          setError("");
          setCode("");
        }}
      >
        {recovery ? "Use your authenticator app" : "Use a recovery code"}
      </button>
    </>
  );
}

export default function OperatorSignInPage() {
  useForceDark();
  const state = useDataState();
  const { step } = useParams();
  const blocked = state === "denied";
  const twoFactor = step === "2fa";

  useEffect(() => {
    const prev = document.title;
    document.title = twoFactor ? "Two-factor, Rootpanther Portal" : "Operator sign-in, Rootpanther Portal";
    return () => {
      document.title = prev;
    };
  }, [twoFactor]);

  return (
    <Frame step={blocked ? "blocked" : twoFactor ? "2fa" : "signin"} blocked={blocked}>
      {blocked ? <Blocked /> : twoFactor ? <TwoFactor /> : <Credentials />}
    </Frame>
  );
}
