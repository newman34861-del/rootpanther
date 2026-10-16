import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Callout, Input, formatClock, useCountdown } from "@rootpanther/ui";
import type { Provider } from "@rootpanther/ui";
import { authMock } from "../mock/settings";
import { AuthHeader, AuthLayout } from "./AuthLayout";
import { OrDivider, PasswordField, ProviderButtons } from "./parts";
import { emailError } from "./password";

type Failure = { kind: "invalid"; attemptsLeft: number } | { kind: "locked" } | null;

function initialFailure(state: string | null): Failure {
  if (state === "error") return { kind: "invalid", attemptsLeft: 3 };
  if (state === "locked" || state === "denied") return { kind: "locked" };
  return null;
}

function LockedNotice() {
  const left = useCountdown(authMock.lockMinutes * 60 - 8);
  return (
    <Callout tone="crit" icon="lock" role="alert" title="Account temporarily locked">
      Too many failed attempts. Try again in <span className="rp-mono rp-num">{formatClock(left)}</span>, or <Link to="/reset">reset your password</Link> to sign in now.
    </Callout>
  );
}

export default function SignInPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const startState = params.get("state");
  const [email, setEmail] = useState(startState ? authMock.email : "");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [failure, setFailure] = useState<Failure>(() => initialFailure(startState));
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const locked = failure?.kind === "locked";

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || locked) return;
    const next = { email: emailError(email) ?? undefined, password: password ? undefined : "Enter your password" };
    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (failure?.kind === "invalid") {
        const attemptsLeft = failure.attemptsLeft - 1;
        setFailure(attemptsLeft <= 0 ? { kind: "locked" } : { kind: "invalid", attemptsLeft });
        setPassword("");
        passwordRef.current?.focus();
        return;
      }
      navigate("/2fa");
    }, 900);
  }

  function onProvider(p: Provider) {
    setProvider(p);
    window.setTimeout(() => navigate("/2fa"), 1100);
  }

  return (
    <AuthLayout>
      <div className="au-card__body rp-view">
        <AuthHeader title="Welcome back" sub="Sign in to continue" />
        <form className="au-form" method="post" action="/signin" noValidate onSubmit={onSubmit} aria-label="Sign in">
          {failure?.kind === "invalid" && (
            <Callout tone="crit" role="alert" title="Incorrect email or password">
              {failure.attemptsLeft === 1 ? "1 attempt left" : `${failure.attemptsLeft} attempts left`} before sign-in is locked for {authMock.lockMinutes} minutes.
            </Callout>
          )}
          {locked && <LockedNotice />}
          <Input
            ref={emailRef}
            label="Email"
            type="email"
            name="email"
            inputSize="lg"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors({ ...errors, email: undefined });
            }}
          />
          <PasswordField
            ref={passwordRef}
            label="Password"
            name="password"
            inputSize="lg"
            autoComplete="current-password"
            autoFocus={failure?.kind === "invalid"}
            value={password}
            error={errors.password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors({ ...errors, password: undefined });
            }}
          />
          <Button type="submit" variant={locked ? "secondary" : "primary"} size="lg" block loading={busy} disabled={locked || provider !== null} className="au-form__submit">
            {busy ? "Signing in" : "Sign in"}
          </Button>
        </form>
        <OrDivider />
        <ProviderButtons onSelect={onProvider} pending={provider} />
        <div className="au-links">
          <Link to="/reset">Forgot password?</Link>
        </div>
      </div>
      <div className="au-card__foot">
        <span>New to Rootpanther?</span>
        <Link to="/signup">Create account</Link>
      </div>
    </AuthLayout>
  );
}
