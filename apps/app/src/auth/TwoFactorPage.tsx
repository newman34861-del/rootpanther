import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Callout, Icon, Input, Spinner } from "@rootpanther/ui";
import { useReview } from "../review/review";
import { authMock } from "../mock/settings";
import { AuthHeader, AuthLayout } from "./AuthLayout";
import { OtpInput, RECOVERY_RE, formatRecovery } from "./parts";

const REJECTED = "000000";
const SPENT_CODE = "abcd-1234";

export default function TwoFactorPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { flags } = useReview();
  const startError = params.get("state") === "error";
  const [mode, setMode] = useState<"totp" | "recovery">(params.get("mode") === "recovery" ? "recovery" : "totp");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [attempts, setAttempts] = useState(startError ? 3 : authMock.codeAttempts);
  const [error, setError] = useState<string | null>(startError ? "That code did not match" : null);
  const [verifying, setVerifying] = useState(false);
  const [remember, setRemember] = useState(false);
  const recoveryRef = useRef<HTMLInputElement>(null);
  const locked = attempts <= 0;
  const destination = flags.user === "new" ? "/onboarding" : "/";

  function fail(message: string) {
    const left = attempts - 1;
    setAttempts(left);
    setError(message);
    setVerifying(false);
  }

  function verify(value: string) {
    if (verifying || locked) return;
    setVerifying(true);
    setError(null);
    window.setTimeout(() => {
      if (value === REJECTED || startError) {
        setCode("");
        fail("That code did not match");
        return;
      }
      navigate(destination);
    }, 700);
  }

  function onSubmitTotp(e: FormEvent) {
    e.preventDefault();
    if (code.length < 6) return setError("Enter all 6 digits");
    verify(code);
  }

  function onSubmitRecovery(e: FormEvent) {
    e.preventDefault();
    if (!RECOVERY_RE.test(recovery)) {
      setError("Enter a code in the format xxxx-xxxx");
      return recoveryRef.current?.focus();
    }
    setVerifying(true);
    setError(null);
    window.setTimeout(() => {
      if (recovery === SPENT_CODE) {
        fail("That recovery code has already been used");
        recoveryRef.current?.focus();
        return;
      }
      navigate(destination);
    }, 700);
  }

  function switchMode(next: "totp" | "recovery") {
    setMode(next);
    setError(null);
    setCode("");
    setRecovery("");
  }

  const attemptsNote = attempts === 1 ? "1 attempt left" : `${attempts} attempts left`;

  return (
    <AuthLayout>
      {mode === "totp" ? (
        <div className="au-card__body rp-view" key="totp">
          <AuthHeader title="Two-factor authentication" sub="Enter the 6-digit code from your authenticator app." />
          <form className="au-form" noValidate onSubmit={onSubmitTotp} aria-label="Verify authentication code">
            <div className="au-otpfield">
              <span id="tf-label" className="rp-field__label">
                Authentication code
              </span>
              <OtpInput
                value={code}
                onChange={(v) => {
                  setCode(v);
                  if (error) setError(null);
                }}
                onComplete={verify}
                invalid={!!error}
                disabled={verifying || locked}
                labelledBy="tf-label"
                describedBy="tf-status"
                autoFocus
              />
              <div id="tf-status" className="au-otpfield__status" aria-live="assertive">
                {verifying ? (
                  <span className="au-otpfield__busy">
                    <Spinner size={13} />
                    Verifying
                  </span>
                ) : error && !locked ? (
                  <span className="rp-field__error">
                    <Icon name="alert-circle" size={13} />
                    {error}. {attemptsNote}.
                  </span>
                ) : (
                  <span className="rp-field__hint">Codes refresh every 30 seconds. Paste works.</span>
                )}
              </div>
            </div>
            {locked && (
              <Callout tone="crit" icon="lock" role="alert" title="Too many incorrect codes">
                Sign-in is paused for {authMock.lockMinutes} minutes. Use a recovery code, or <Link to="/signin">start again</Link> later.
              </Callout>
            )}
            <label className="rp-check au-remember">
              <input type="checkbox" className="rp-check__input" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="rp-check__box" aria-hidden="true">
                <Icon name="check" size={12} strokeWidth={2.5} />
              </span>
              <span className="rp-check__text">
                <span className="rp-check__label">Trust this browser for 30 days</span>
              </span>
            </label>
            <Button type="submit" variant={locked ? "secondary" : "primary"} size="lg" block loading={verifying} disabled={locked} className="au-form__submit">
              {verifying ? "Verifying" : "Verify"}
            </Button>
          </form>
          <div className="au-links">
            <button type="button" className="rp-link" onClick={() => switchMode("recovery")}>
              Use a recovery code
            </button>
          </div>
        </div>
      ) : (
        <div className="au-card__body rp-view" key="recovery">
          <AuthHeader title="Use a recovery code" sub="Enter one of the 10 codes you saved when you turned on two-factor authentication." />
          <form className="au-form" noValidate onSubmit={onSubmitRecovery} aria-label="Verify recovery code">
            <Input
              ref={recoveryRef}
              label="Recovery code"
              name="recovery-code"
              inputSize="lg"
              mono
              autoFocus
              value={recovery}
              placeholder="xxxx-xxxx"
              autoComplete="one-time-code"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={9}
              error={error ? (locked ? error : `${error}. ${attemptsNote}.`) : undefined}
              hint="Each code works once. Generate new codes in Settings after you sign in."
              onChange={(e) => {
                setRecovery(formatRecovery(e.target.value));
                if (error) setError(null);
              }}
            />
            <Button type="submit" variant="primary" size="lg" block loading={verifying} disabled={locked} className="au-form__submit">
              {verifying ? "Verifying" : "Verify recovery code"}
            </Button>
          </form>
          <div className="au-links">
            <button type="button" className="rp-link" onClick={() => switchMode("totp")}>
              Use your authenticator app
            </button>
          </div>
        </div>
      )}
      <div className="au-card__foot">
        <span>Lost your device and codes?</span>
        <a href="https://rootpanther.com/help/account-recovery">Recover your account</a>
      </div>
    </AuthLayout>
  );
}
