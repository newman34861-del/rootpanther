import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Avatar,
  Button,
  Card,
  Combobox,
  ConfirmDialog,
  ErrorState,
  Icon,
  Input,
  Modal,
  Page,
  PageHeader,
  Spinner,
  StatusDot,
  formatDate,
  useToast,
} from "@rootpanther/ui";
import { PasswordField } from "../../auth/parts";
import { emailError } from "../../auth/password";
import { useDataState, useReview } from "../../review/review";
import { COUNTRIES, TAKEN_HANDLES, accountFootprint, freshProfile, profile as savedProfile } from "../../mock/settings";
import type { Profile } from "../../mock/settings";
import { DangerCard, FormRow, PageSkeleton, SaveBar } from "./parts";
import "./account.css";

type HandleStatus = "idle" | "invalid" | "checking" | "available" | "taken" | "current";

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9_]{1,22}[a-z0-9])?$/;

function handleProblem(h: string): string | null {
  if (h.length < 3) return "Use 3 to 24 characters";
  if (h.length > 24) return "Use 3 to 24 characters";
  if (!HANDLE_RE.test(h)) return "Lowercase letters, numbers and underscores. Start and end with a letter or number.";
  return null;
}

function useHandleStatus(handle: string, current: string | null): [HandleStatus, string | null] {
  const [status, setStatus] = useState<HandleStatus>("idle");
  useEffect(() => {
    if (!handle) return setStatus("idle");
    if (handle === current) return setStatus("current");
    if (handleProblem(handle)) return setStatus("invalid");
    setStatus("checking");
    const t = window.setTimeout(() => setStatus(TAKEN_HANDLES.includes(handle) ? "taken" : "available"), 650);
    return () => window.clearTimeout(t);
  }, [handle, current]);
  return [status, status === "invalid" ? handleProblem(handle) : status === "taken" ? "Taken. Try another handle." : null];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

function AvatarField({ name, src, onChange }: { name: string; src: string | null; onChange: (src: string | null) => void }) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Use a PNG, JPEG or WebP image");
    if (file.size > 2 * 1024 * 1024) return setError(`${(file.size / 1024 / 1024).toFixed(1)} MB is over the 2 MB limit`);
    setError(null);
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setUploading(false);
      onChange(String(reader.result));
      toast.push({ title: "Photo ready", detail: "Save to apply it to your account.", tone: "primary" });
    };
    reader.onerror = () => {
      setUploading(false);
      setError("The file could not be read. Try another image.");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="ac-avatar">
      <span className="ac-avatar__img">
        <Avatar initials={initials(name)} size={56} src={src ?? undefined} name={`${name} profile photo`} />
        {uploading && (
          <span className="ac-avatar__busy">
            <Spinner size={16} label="Uploading photo" />
          </span>
        )}
      </span>
      <div className="ac-avatar__body">
        <div className="ac-avatar__actions">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="rp-sr" tabIndex={-1} aria-hidden="true" onChange={onFile} />
          <Button size="sm" variant="secondary" iconLeft="upload" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {src ? "Replace photo" : "Upload photo"}
          </Button>
          {src && (
            <Button size="sm" variant="quiet" iconLeft="trash" onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        {error ? (
          <p className="rp-field__error" role="alert">
            <Icon name="alert-circle" size={13} />
            {error}
          </p>
        ) : (
          <p className="ac-hint">PNG, JPEG or WebP, up to 2 MB. Cropped to a square. Without a photo, your initials are shown.</p>
        )}
      </div>
    </div>
  );
}

function HandleField({ value, onChange, current, status, error }: { value: string; onChange: (v: string) => void; current: string | null; status: HandleStatus; error: string | null }) {
  const suffix =
    status === "checking" ? (
      <Spinner size={14} label="Checking availability" />
    ) : status === "available" ? (
      <Icon name="check" size={15} className="ac-handle__ok" label="Available" />
    ) : status === "taken" || status === "invalid" ? (
      <Icon name="x" size={15} className="ac-handle__bad" label="Not available" />
    ) : undefined;
  return (
    <div className="ac-handle">
      <Input
        id="pf-handle"
        icon="hash"
        mono
        value={value}
        placeholder="handle"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={24}
        aria-invalid={error ? true : undefined}
        aria-describedby="pf-handle-status"
        wrapperClassName={error ? "is-invalid" : undefined}
        suffix={suffix}
        onChange={(e) => onChange(e.target.value.toLowerCase().replace(/\s/g, ""))}
      />
      <p id="pf-handle-status" className={error ? "rp-field__error" : "ac-hint"} aria-live="polite">
        {error ? (
          <>
            <Icon name="alert-circle" size={13} />
            {error}
          </>
        ) : status === "available" ? (
          <>
            <span className="rp-mono">@{value}</span> is available. Shown on shared reports and debriefs.
          </>
        ) : status === "current" ? (
          <>
            Your current handle. Shown as <span className="rp-mono">@{current}</span> on shared reports and debriefs.
          </>
        ) : status === "checking" ? (
          "Checking availability"
        ) : (
          "Shown on shared reports and debriefs instead of your name. Leave empty to stay anonymous."
        )}
      </p>
    </div>
  );
}

function ChangeEmailDialog({ open, onClose, current, onRequested }: { open: boolean; onClose: () => void; current: string; onRequested: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setEmail("");
      setPassword("");
      setErrors({});
    }
  }, [open]);

  function submit(e: FormEvent) {
    e.preventDefault();
    const next = {
      email: emailError(email) ?? (email.trim().toLowerCase() === current.toLowerCase() ? "This is already your email address" : undefined),
      password: password ? undefined : "Enter your current password",
    };
    setErrors(next);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return pwRef.current?.focus();
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (password === "wrong-password") {
        setErrors({ password: "Incorrect password" });
        return pwRef.current?.focus();
      }
      onRequested(email.trim());
    }, 800);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change email address"
      size="sm"
      initialFocus={emailRef}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="pf-email-form" variant="primary" loading={busy}>
            Send verification link
          </Button>
        </>
      }
    >
      <form id="pf-email-form" className="ac-form" noValidate onSubmit={submit}>
        <p>
          You keep signing in with <span className="rp-mono rp-strong">{current}</span> until you open the link sent to the new address.
        </p>
        <Input
          ref={emailRef}
          label="New email address"
          type="email"
          name="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          error={errors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField
          ref={pwRef}
          label="Current password"
          name="current-password"
          autoComplete="current-password"
          value={password}
          error={errors.password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </form>
    </Modal>
  );
}

function DeleteAccount({ email }: { email: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const f = accountFootprint;
  return (
    <DangerCard title="Danger zone">
      <div className="ac-danger__row">
        <div className="ac-danger__text">
          <span className="rp-strong">Delete account</span>
          <p>Permanently deletes your account, lab history, reports and Onyx conversations. Cancels your plan at the end of the billing period.</p>
        </div>
        <Button variant="destructive" iconLeft="trash" onClick={() => setOpen(true)}>
          Delete account
        </Button>
      </div>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        destructive
        requireText="delete my account"
        loading={busy}
        title="Delete your account"
        confirmLabel="Delete account"
        onConfirm={() => {
          setBusy(true);
          window.setTimeout(() => {
            setBusy(false);
            setOpen(false);
            toast.push({ title: "Account scheduled for deletion", detail: `Confirmation sent to ${email}. Sign in within 14 days to cancel.`, tone: "crit", duration: 8000 });
            navigate("/signin");
          }, 900);
        }}
      >
        <p>This deletes, and cannot be undone after 14 days:</p>
        <ul className="ac-deletelist">
          <li>
            <span className="rp-mono rp-num">{f.labSessions}</span> lab sessions, <span className="rp-mono rp-num">{f.proofs}</span> captured proofs and your Path progress
          </li>
          <li>
            <span className="rp-mono rp-num">{f.reports}</span> reports and <span className="rp-mono rp-num">{f.debriefs}</span> debriefs, including exports
          </li>
          <li>
            <span className="rp-mono rp-num">{f.onyxConversations}</span> Onyx conversations and notes
          </li>
          <li>Your SSH key, OpenVPN profiles and connected sign-in providers</li>
        </ul>
        <p>Any running lab is destroyed now. Your plan is cancelled and not renewed. Invoices are kept for 7 years for tax records.</p>
      </ConfirmDialog>
    </DangerCard>
  );
}

export default function ProfilePage() {
  const toast = useToast();
  const state = useDataState();
  const { flags } = useReview();
  const [params, setParams] = useSearchParams();
  const loaded: Profile = flags.user === "new" || state === "empty" ? freshProfile : savedProfile;
  const [saved, setSaved] = useState<Profile>(loaded);
  const [name, setName] = useState(loaded.name);
  const [country, setCountry] = useState<string | null>(loaded.country);
  const [handle, setHandle] = useState(loaded.handle ?? "");
  const [avatar, setAvatar] = useState<string | null>(loaded.avatarUrl);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [handleStatus, handleError] = useHandleStatus(handle, saved.handle);
  const nameRef = useRef<HTMLInputElement>(null);
  const [resending, setResending] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  const dirty = name !== saved.name || country !== saved.country || (handle || null) !== saved.handle || avatar !== saved.avatarUrl;

  const countryOptions = useMemo(() => COUNTRIES, []);

  function discard() {
    setName(saved.name);
    setCountry(saved.country);
    setHandle(saved.handle ?? "");
    setAvatar(saved.avatarUrl);
    setNameError(null);
    setSaveFailed(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const nErr = name.trim().length < 2 ? (name.trim() ? "Enter at least 2 characters" : "Enter your name") : null;
    setNameError(nErr);
    if (nErr) return nameRef.current?.focus();
    if (handle && (handleStatus === "invalid" || handleStatus === "taken")) return document.getElementById("pf-handle")?.focus();
    if (handle && handleStatus === "checking") return;
    if (!dirty) return toast.push({ title: "No changes to save" });
    setSaving(true);
    setSaveFailed(false);
    window.setTimeout(() => {
      setSaving(false);
      if (params.get("save") === "error") {
        setSaveFailed(true);
        params.delete("save");
        setParams(params, { replace: true });
        return;
      }
      const next = { ...saved, name: name.trim(), country, handle: handle || null, avatarUrl: avatar };
      setSaved(next);
      setName(next.name);
      toast.push({ title: "Profile saved", tone: "success" });
    }, 800);
  }

  const memberSince = formatDate(saved.memberSince, { month: "long", year: "numeric" });

  let body;
  if (state === "loading") {
    body = <PageSkeleton cards={[5, 1]} />;
  } else if (state === "error") {
    body = (
      <Card>
        <ErrorState
          title="Your profile did not load"
          onRetry={() => {
            params.delete("state");
            setParams(params, { replace: true });
          }}
          reference="req_3b91fe"
        >
          We could not reach the account service. Labs and saved work are not affected.
        </ErrorState>
      </Card>
    );
  } else {
    body = (
      <div className="ac-stack">
        <form onSubmit={onSubmit} noValidate aria-label="Profile details">
          <Card padding="none" footer={<SaveBar dirty={dirty} saving={saving} onDiscard={discard} label="Save" idle={<span className="ac-hint">Member since {memberSince}</span>} />}>
            {saveFailed && (
              <div className="ac-callout">
                <p className="rp-field__error" role="alert">
                  <Icon name="alert-circle" size={13} />
                  Profile not saved. The account service did not respond. Your edits are still here, try again.
                </p>
              </div>
            )}
            <FormRow label="Photo" description="Shown in the top bar and on shared reports." className="ac-row--top">
              <AvatarField name={name || saved.name} src={avatar} onChange={setAvatar} />
            </FormRow>
            <FormRow label="Name" htmlFor="pf-name">
              <Input
                ref={nameRef}
                id="pf-name"
                name="name"
                autoComplete="name"
                maxLength={80}
                value={name}
                error={nameError ?? undefined}
                onChange={(e) => {
                  setName(e.target.value);
                  if (nameError) setNameError(null);
                }}
              />
            </FormRow>
            <FormRow label="Email">
              <div className="ac-email">
                <div className="ac-email__line">
                  <span className="ac-email__value rp-mono">{saved.email}</span>
                  {saved.emailVerified ? (
                    <StatusDot tone="success" size="sm" label="Verified" />
                  ) : (
                    <StatusDot tone="med" size="sm" label="Not verified" />
                  )}
                  <Button size="sm" variant="quiet" className="ac-email__change" onClick={() => setEmailOpen(true)}>
                    Change
                  </Button>
                </div>
                <p className="ac-hint" aria-live="polite">
                  {pendingEmail ? (
                    <>
                      Verification sent to <span className="rp-mono rp-strong">{pendingEmail}</span>. Open the link to switch.{" "}
                      <button
                        type="button"
                        className="rp-link"
                        onClick={() => {
                          setPendingEmail(null);
                          toast.push({ title: "Email change cancelled", detail: `Still signing in with ${saved.email}` });
                        }}
                      >
                        Cancel change
                      </button>
                    </>
                  ) : saved.emailVerified ? (
                    "Used to sign in, for receipts and for session expiry warnings."
                  ) : (
                    <>
                      Check your inbox for the link.{" "}
                      <button
                        type="button"
                        className="rp-link"
                        disabled={resending}
                        onClick={() => {
                          setResending(true);
                          window.setTimeout(() => {
                            setResending(false);
                            toast.push({ title: "Verification email sent", detail: saved.email, tone: "primary" });
                          }, 600);
                        }}
                      >
                        Resend
                      </button>
                    </>
                  )}
                </p>
              </div>
            </FormRow>
            <FormRow label="Country" htmlFor="pf-country" description="Sets tax on invoices. Not shown publicly.">
              <Combobox id="pf-country" options={countryOptions} value={country} onChange={setCountry} placeholder="Search countries" emptyText="No country matches" />
            </FormRow>
            <FormRow
              label={
                <>
                  Public handle <span className="ac-optional">Optional</span>
                </>
              }
              htmlFor="pf-handle"
            >
              <HandleField value={handle} onChange={setHandle} current={saved.handle} status={handleStatus} error={handleError} />
            </FormRow>
          </Card>
        </form>
        <DeleteAccount email={saved.email} />
        <ChangeEmailDialog
          open={emailOpen}
          onClose={() => setEmailOpen(false)}
          current={saved.email}
          onRequested={(next) => {
            setEmailOpen(false);
            setPendingEmail(next);
            toast.push({ title: "Verification link sent", detail: next, tone: "primary" });
          }}
        />
      </div>
    );
  }

  return (
    <Page>
      <PageHeader title="Profile" crumbs={[{ label: "Account" }, { label: "Profile" }]} />
      {body}
    </Page>
  );
}
