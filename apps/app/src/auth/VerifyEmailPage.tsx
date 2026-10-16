import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button, Icon, Input, Spinner, useToast } from "@rootpanther/ui";
import { authMock } from "../mock/settings";
import { AuthHeader, AuthLayout } from "./AuthLayout";
import { formatCooldown, useCooldown } from "./parts";
import { emailError } from "./password";

export default function VerifyEmailPage() {
  const toast = useToast();
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") ?? authMock.email);
  const [expired, setExpired] = useState(params.get("state") === "error");
  const [cooldown, startCooldown] = useCooldown(authMock.resendCooldown, !expired);
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(email);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);

  function resend() {
    setSending(true);
    window.setTimeout(() => {
      setSending(false);
      setExpired(false);
      startCooldown();
      toast.push({ title: "Verification email sent", detail: email, tone: "primary" });
    }, 700);
  }

  function closeEditor() {
    setEditing(false);
    setDraftError(null);
    window.setTimeout(() => changeRef.current?.focus(), 0);
  }

  function saveEmail(e: FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    const err = emailError(next) ?? (next.toLowerCase() === email.toLowerCase() ? "This is the address we already sent to" : null);
    setDraftError(err);
    if (err) return draftRef.current?.focus();
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      setEmail(next);
      setExpired(false);
      startCooldown();
      closeEditor();
      toast.push({ title: "Email address changed", detail: `New link sent to ${next}`, tone: "primary" });
    }, 800);
  }

  return (
    <AuthLayout>
      <div className="au-card__body rp-view" key={expired ? "expired" : "pending"}>
        <AuthHeader
          title={expired ? "Verification link expired" : "Check your email"}
          sub={
            expired ? (
              <>
                The link sent to <span className="au-email rp-mono">{email}</span> is no longer valid. Links expire after {authMock.verifyLinkHours} hours.
              </>
            ) : (
              <>
                Open the link we sent to <span className="au-email rp-mono">{email}</span> to verify your address.
              </>
            )
          }
        />

        {expired ? (
          <Button variant="primary" size="lg" block loading={sending} onClick={resend}>
            Send a new link
          </Button>
        ) : (
          <>
            <div className="au-verify">
              <span className="au-verify__state" role="status">
                <Spinner size={14} />
                Waiting for you to open the link
              </span>
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
                  Resend email
                </Button>
              </div>
            </div>
            <p className="au-note au-note--icon">
              <Icon name="info" size={14} />
              <span>
                Sent from <span className="au-nowrap">no-reply@rootpanther.com</span>. Check spam or quarantine if it has not arrived after a minute. The link expires in {authMock.verifyLinkHours} hours.
              </span>
            </p>
          </>
        )}

        {editing ? (
          <form className="au-inline rp-view" onSubmit={saveEmail} noValidate aria-label="Change email address">
            <Input
              ref={draftRef}
              label="New email address"
              type="email"
              name="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              value={draft}
              error={draftError ?? undefined}
              hint="The old link stops working."
              onChange={(e) => {
                setDraft(e.target.value);
                setDraftError(null);
              }}
            />
            <div className="au-inline__actions">
              <Button type="submit" size="sm" variant="secondary" loading={saving}>
                Change and resend
              </Button>
              <Button
                size="sm"
                variant="quiet"
                onClick={() => {
                  setDraft(email);
                  closeEditor();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="au-links">
            <button ref={changeRef} type="button" className="rp-link" onClick={() => setEditing(true)}>
              Wrong address? Change email
            </button>
          </div>
        )}
      </div>
      <div className="au-card__foot">
        <span>Verified on another device?</span>
        <Link to="/onboarding">Continue</Link>
      </div>
    </AuthLayout>
  );
}
