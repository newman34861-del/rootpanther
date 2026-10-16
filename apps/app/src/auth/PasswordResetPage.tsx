import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, ButtonLink, Callout, Icon, Input, useToast } from "@rootpanther/ui";
import { authMock } from "../mock/settings";
import { AuthHeader, AuthLayout } from "./AuthLayout";
import { PasswordField, StrengthMeter, formatCooldown, useCooldown } from "./parts";
import { checkPassword, emailError, personalTokens } from "./password";

type Step = "request" | "sent" | "new" | "done";

function RequestStep() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const err = emailError(email);
    setError(err);
    if (err) return ref.current?.focus();
    setBusy(true);
    window.setTimeout(() => navigate(`/reset/sent?email=${encodeURIComponent(email.trim())}`), 800);
  }

  return (
    <>
      <div className="au-card__body rp-view">
        <AuthHeader title="Reset your password" sub="Enter the email on your account. We will send a link to choose a new password." />
        <form className="au-form" noValidate onSubmit={onSubmit} aria-label="Request password reset">
          <Input
            ref={ref}
            label="Email"
            type="email"
            name="email"
            inputSize="lg"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={email}
            error={error ?? undefined}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
          />
          <Button type="submit" variant="primary" size="lg" block loading={busy} className="au-form__submit">
            {busy ? "Sending link" : "Send reset link"}
          </Button>
        </form>
      </div>
      <div className="au-card__foot">
        <span>Remembered it?</span>
        <Link to="/signin">Back to sign in</Link>
      </div>
    </>
  );
}

function SentStep() {
  const toast = useToast();
  const [params] = useSearchParams();
  const email = params.get("email") ?? authMock.email;
  const [cooldown, startCooldown] = useCooldown(authMock.resendCooldown, true);
  const [sending, setSending] = useState(false);

  function resend() {
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      startCooldown();
      toast.push({ title: "Reset link sent again", detail: email, tone: "primary" });
    }, 700);
  }

  return (
    <>
      <div className="au-card__body rp-view">
        <AuthHeader
          title="Check your email"
          sub={
            <>
              If an account exists for <span className="au-email rp-mono">{email}</span>, a reset link is on its way. It expires in {authMock.resetLinkMinutes} minutes.
            </>
          }
        />
        <div className="au-verify">
          <div className="au-resend">
            <span className="au-resend__timer" aria-live="polite">
              {cooldown > 0 ? (
                <>
                  Resend in <span className="rp-mono rp-num">{formatCooldown(cooldown)}</span>
                </>
              ) : (
                "Did not get it?"
              )}
            </span>
            <Button size="sm" variant="secondary" iconLeft="refresh" loading={sending} disabled={cooldown > 0} onClick={resend}>
              Resend link
            </Button>
          </div>
        </div>
        <p className="au-note au-note--icon">
          <Icon name="info" size={14} />
          <span>
            Sent from <span className="au-nowrap">no-reply@rootpanther.com</span>. Signing in elsewhere is not affected until you set a new password.
          </span>
        </p>
        <div className="au-links">
          <Link to={`/reset?email=${encodeURIComponent(email)}`}>Use a different email</Link>
        </div>
      </div>
      <div className="au-card__foot">
        <Link to="/signin">Back to sign in</Link>
      </div>
    </>
  );
}

function ExpiredToken() {
  return (
    <>
      <div className="au-card__body rp-view">
        <span className="au-status is-crit" aria-hidden="true">
          <Icon name="x-circle" size={20} />
        </span>
        <AuthHeader brand={false} title="This reset link has expired" sub={`Reset links work once and expire after ${authMock.resetLinkMinutes} minutes. Your password has not changed.`} />
        <ButtonLink to="/reset" variant="primary" size="lg" block>
          Request a new link
        </ButtonLink>
      </div>
      <div className="au-card__foot">
        <Link to="/signin">Back to sign in</Link>
      </div>
    </>
  );
}

function NewPasswordStep() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const check = useMemo(() => checkPassword(password, personalTokens("Dana Reyes", authMock.email.split("@")[0])), [password]);

  if (params.get("state") === "error") return <ExpiredToken />;

  const pwError = submitted && !check.valid ? (password ? "Meet every requirement below" : "Enter a new password") : undefined;
  const mismatch = confirm.length > 0 && confirm !== password;
  const confirmError = (submitted || confirmTouched) && (mismatch ? "Passwords do not match" : submitted && !confirm ? "Enter the password again" : undefined);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!check.valid) return pwRef.current?.focus();
    if (!confirm || confirm !== password) return confirmRef.current?.focus();
    setBusy(true);
    window.setTimeout(() => navigate("/reset/done"), 900);
  }

  return (
    <>
      <div className="au-card__body rp-view">
        <AuthHeader
          title="Choose a new password"
          sub={
            <>
              For <span className="au-email rp-mono">{authMock.email}</span>
            </>
          }
        />
        <form className="au-form" noValidate onSubmit={onSubmit} aria-label="Set a new password">
          <input type="email" name="username" autoComplete="username" value={authMock.email} readOnly hidden />
          <div className="au-stack au-stack--tight">
            <PasswordField
              ref={pwRef}
              label="New password"
              name="new-password"
              inputSize="lg"
              autoComplete="new-password"
              autoFocus
              value={password}
              describedBy="rs-strength"
              error={pwError}
              onChange={(e) => setPassword(e.target.value)}
            />
            <StrengthMeter check={check} id="rs-strength" empty={!password} showErrors={submitted && password.length > 0} />
          </div>
          <PasswordField
            ref={confirmRef}
            label="Confirm new password"
            name="confirm-password"
            inputSize="lg"
            autoComplete="new-password"
            value={confirm}
            error={confirmError || undefined}
            onChange={(e) => setConfirm(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
          />
          <Callout tone="info" icon="logout">
            Every other session is signed out. Running labs keep going.
          </Callout>
          <Button type="submit" variant="primary" size="lg" block loading={busy} className="au-form__submit">
            {busy ? "Saving password" : "Set new password"}
          </Button>
        </form>
      </div>
      <div className="au-card__foot">
        <Link to="/signin">Back to sign in</Link>
      </div>
    </>
  );
}

function DoneStep() {
  return (
    <>
      <div className="au-card__body rp-view">
        <span className="au-status is-success" aria-hidden="true">
          <Icon name="check" size={20} />
        </span>
        <AuthHeader brand={false} title="Password changed" sub="Other sessions were signed out. Sign in with your new password." />
        <ButtonLink to="/signin" variant="primary" size="lg" block>
          Sign in
        </ButtonLink>
      </div>
    </>
  );
}

const STEPS: Record<Step, () => JSX.Element> = {
  request: RequestStep,
  sent: SentStep,
  new: NewPasswordStep,
  done: DoneStep,
};

export default function PasswordResetPage() {
  const { step } = useParams();
  const current: Step | null = step === undefined ? "request" : step === "sent" || step === "new" || step === "done" ? step : null;
  if (!current) return <Navigate to="/reset" replace />;
  const View = STEPS[current];
  return (
    <AuthLayout>
      <View key={current} />
    </AuthLayout>
  );
}
