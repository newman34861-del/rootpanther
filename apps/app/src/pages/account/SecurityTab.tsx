import { useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Callout,
  Card,
  Checkbox,
  ConfirmDialog,
  CopyButton,
  DataTable,
  Icon,
  Modal,
  PROVIDERS,
  ProviderMark,
  QrCode,
  StatusDot,
  Tooltip,
  formatDate,
  formatRelative,
  useCopy,
  useMediaQuery,
  useToast,
} from "@rootpanther/ui";
import type { Column, IconName, Provider } from "@rootpanther/ui";
import { OtpInput, PasswordField, StrengthMeter } from "../../auth/parts";
import { checkPassword, personalTokens } from "../../auth/password";
import { currentUser } from "../../mock/account";
import { providerOnlySecurity, recoveryCodes, regeneratedCodes, security as savedSecurity, totpSetup } from "../../mock/settings";
import type { ActiveSession, ConnectedAccount, SecurityState } from "../../mock/settings";
import { FormRow } from "./parts";

const PROVIDER_LABEL: Record<Provider, string> = { google: "Google", microsoft: "Microsoft", github: "GitHub" };

function ChangePassword({ hasPassword, onSet }: { hasPassword: boolean; onSet: () => void }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refs = { current: useRef<HTMLInputElement>(null), next: useRef<HTMLInputElement>(null), confirm: useRef<HTMLInputElement>(null) };
  const check = useMemo(() => checkPassword(next, personalTokens(currentUser.name, currentUser.email.split("@")[0])), [next]);
  const sameAsOld = hasPassword && next.length > 0 && next === current;
  const mismatch = confirm.length > 0 && confirm !== next;

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setSubmitted(false);
    setCurrentError(null);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (hasPassword && !current) {
      setCurrentError("Enter your current password");
      return refs.current.current?.focus();
    }
    if (!check.valid || sameAsOld) return refs.next.current?.focus();
    if (!confirm || mismatch) return refs.confirm.current?.focus();
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (current === "wrong-password") {
        setCurrentError("Incorrect password");
        return refs.current.current?.focus();
      }
      reset();
      onSet();
      toast.push({ title: hasPassword ? "Password changed" : "Password set", detail: "Other sessions were signed out.", tone: "success" });
    }, 900);
  }

  const nextError = submitted ? (sameAsOld ? "Choose a password you have not used here before" : !check.valid ? (next ? "Meet every requirement below" : "Enter a new password") : undefined) : undefined;
  const confirmError = submitted && (!confirm ? "Enter the new password again" : mismatch ? "Passwords do not match" : undefined);

  return (
    <form onSubmit={onSubmit} noValidate aria-label={hasPassword ? "Change password" : "Set a password"}>
      <Card
        title={hasPassword ? "Password" : "Set a password"}
        padding="none"
        meta={hasPassword && savedSecurity.passwordChangedAt ? `Changed ${formatDate(savedSecurity.passwordChangedAt, { day: "numeric", month: "short", year: "numeric" })}` : undefined}
        footer={
          <>
            <span className="ac-hint">Changing it signs out every other session.</span>
            <Button type="submit" variant="secondary" loading={busy}>
              {hasPassword ? "Change password" : "Set password"}
            </Button>
          </>
        }
      >
        <input type="email" name="username" autoComplete="username" value={currentUser.email} readOnly hidden />
        {!hasPassword && (
          <div className="ac-callout">
            <Callout tone="info" title="You sign in with GitHub only">
              Add a password so you can still sign in if you lose access to GitHub. It also lets you unlink providers.
            </Callout>
          </div>
        )}
        {hasPassword && (
          <FormRow label="Current password" htmlFor="sc-current">
            <PasswordField
              ref={refs.current}
              id="sc-current"
              name="current-password"
              autoComplete="current-password"
              value={current}
              error={currentError ?? undefined}
              onChange={(e) => {
                setCurrent(e.target.value);
                setCurrentError(null);
              }}
            />
          </FormRow>
        )}
        <FormRow label="New password" htmlFor="sc-new">
          <PasswordField ref={refs.next} id="sc-new" name="new-password" autoComplete="new-password" value={next} describedBy="sc-strength" error={nextError} onChange={(e) => setNext(e.target.value)} />
          <StrengthMeter check={check} id="sc-strength" empty={!next} showErrors={submitted && next.length > 0} />
        </FormRow>
        <FormRow label="Confirm new password" htmlFor="sc-confirm">
          <PasswordField ref={refs.confirm} id="sc-confirm" name="confirm-password" autoComplete="new-password" value={confirm} error={confirmError || undefined} onChange={(e) => setConfirm(e.target.value)} />
        </FormRow>
      </Card>
    </form>
  );
}

function RecoveryCodes({ codes, onDownload, extra }: { codes: string[]; onDownload: () => void; extra?: ReactNode }) {
  const [copied, copy] = useCopy();
  return (
    <div className="ac-codes">
      <ol className="ac-codes__grid rp-mono" aria-label="Recovery codes">
        {codes.map((c, i) => (
          <li key={c}>
            <span className="ac-codes__n rp-num" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            {c}
          </li>
        ))}
      </ol>
      <div className="ac-codes__actions">
        <Button size="sm" variant="secondary" iconLeft={copied ? "check" : "copy"} onClick={() => copy(codes.join("\n"))}>
          {copied ? "Copied" : "Copy all"}
        </Button>
        <Button size="sm" variant="secondary" iconLeft="download" onClick={onDownload}>
          Download .txt
        </Button>
        <span className="rp-sr" aria-live="polite">
          {copied ? "Recovery codes copied to clipboard" : ""}
        </span>
        {extra && <span className="ac-codes__extra">{extra}</span>}
      </div>
    </div>
  );
}

function downloadCodes(codes: string[]) {
  const text = [`Rootpanther recovery codes for ${currentUser.email}`, `Generated ${new Date().toISOString().slice(0, 10)}`, "Each code works once.", "", ...codes].join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "rootpanther-recovery-codes.txt";
  a.click();
  URL.revokeObjectURL(url);
}

type SetupStep = "scan" | "codes";

function TotpSetupModal({ open, onClose, onEnabled }: { open: boolean; onClose: () => void; onEnabled: () => void }) {
  const [step, setStep] = useState<SetupStep>("scan");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [saved, setSaved] = useState(false);
  const codesRef = useRef<HTMLDivElement>(null);

  function close() {
    onClose();
    window.setTimeout(() => {
      setStep("scan");
      setCode("");
      setError(null);
      setSaved(false);
    }, 300);
  }

  function verify(value: string) {
    if (value.length < 6) return setError("Enter all 6 digits");
    setVerifying(true);
    setError(null);
    window.setTimeout(() => {
      setVerifying(false);
      if (value === totpSetup.rejectedCode) {
        setCode("");
        setError("That code did not match. Check the time on your phone is set automatically.");
        return;
      }
      setStep("codes");
      window.setTimeout(() => codesRef.current?.focus(), 0);
    }, 700);
  }

  const groupedKey = totpSetup.secret.match(/.{1,4}/g)?.join(" ") ?? totpSetup.secret;

  return (
    <Modal
      open={open}
      onClose={step === "codes" ? () => undefined : close}
      dismissable={step !== "codes"}
      size="md"
      title={step === "scan" ? "Set up two-factor authentication" : "Save your recovery codes"}
      footer={
        step === "scan" ? (
          <>
            <span className="ac-modal-step rp-mono">Step 1 of 2</span>
            <Button variant="quiet" onClick={close}>
              Cancel
            </Button>
            <Button variant="primary" loading={verifying} onClick={() => verify(code)}>
              Verify and continue
            </Button>
          </>
        ) : (
          <>
            <span className="ac-modal-step rp-mono">Step 2 of 2</span>
            <Button
              variant="primary"
              disabled={!saved}
              onClick={() => {
                onEnabled();
                close();
              }}
            >
              Finish setup
            </Button>
          </>
        )
      }
    >
      {step === "scan" ? (
        <div className="ac-totp rp-view">
          <ol className="ac-totp__steps">
            <li>
              <span className="ac-totp__num rp-mono">1</span>
              <div className="ac-totp__body">
                <span className="rp-strong">Scan the QR code with your authenticator app</span>
                <span className="ac-hint">1Password, Bitwarden, Google Authenticator, Authy and Aegis all work.</span>
                <div className="ac-totp__qr">
                  <QrCode value={totpSetup.otpauth} size={152} label={`QR code for adding Rootpanther, ${currentUser.email}, to an authenticator app`} />
                  <div className="ac-totp__manual">
                    <span className="ac-hint">Cannot scan? Enter this key manually. Time-based, 6 digits, 30 seconds.</span>
                    <div className="ac-totp__key">
                      <code className="rp-mono" aria-label={`Setup key ${totpSetup.secret.split("").join(" ")}`}>
                        {groupedKey}
                      </code>
                      <CopyButton value={totpSetup.secret} label="Copy setup key" />
                    </div>
                  </div>
                </div>
              </div>
            </li>
            <li>
              <span className="ac-totp__num rp-mono">2</span>
              <div className="ac-totp__body">
                <span className="rp-strong" id="ac-totp-label">
                  Enter the 6-digit code it shows
                </span>
                <OtpInput
                  size="md"
                  autoFocus
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (error) setError(null);
                  }}
                  onComplete={verify}
                  invalid={!!error}
                  disabled={verifying}
                  labelledBy="ac-totp-label"
                  describedBy="ac-totp-status"
                />
                <p id="ac-totp-status" className={error ? "rp-field__error" : "ac-hint"} aria-live="assertive">
                  {error ? (
                    <>
                      <Icon name="alert-circle" size={13} />
                      {error}
                    </>
                  ) : verifying ? (
                    "Verifying"
                  ) : (
                    "Verifies as soon as all 6 digits are in."
                  )}
                </p>
              </div>
            </li>
          </ol>
        </div>
      ) : (
        <div className="ac-totp rp-view" ref={codesRef} tabIndex={-1}>
          <Callout tone="success" icon="shield-check" title="Authenticator verified" role="status">
            Two-factor turns on when you finish. Next time you sign in, Rootpanther asks for a code.
          </Callout>
          <p>
            If you lose your phone, each of these codes signs you in once. Store them in your password manager. They are not shown again.
          </p>
          <RecoveryCodes codes={recoveryCodes} onDownload={() => downloadCodes(recoveryCodes)} />
          <Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)} label="I have saved these codes somewhere safe" />
        </div>
      )}
    </Modal>
  );
}

function TwoFactorCard({ state, onChange }: { state: SecurityState["twoFactor"]; onChange: (s: SecurityState["twoFactor"]) => void }) {
  const toast = useToast();
  const [setupOpen, setSetupOpen] = useState(false);
  const [disableOpen, setDisableOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <Card
      title="Two-factor authentication"
      padding="none"
      meta={state.enabled ? <StatusDot tone="success" size="sm" label="On" /> : <StatusDot tone="med" size="sm" label="Off" />}
    >
      {state.enabled ? (
        <>
          <FormRow label="Authenticator app" className="ac-row--inline" description={state.enabledAt ? `Turned on ${formatDate(state.enabledAt)}` : undefined}>
            <div className="ac-inline">
              <span className="ac-inline__text">
                <Icon name="shield-check" size={16} className="ac-ok" />
                Codes required at every sign-in
              </span>
              <Button variant="destructive" size="sm" onClick={() => setDisableOpen(true)}>
                Turn off
              </Button>
            </div>
          </FormRow>
          <FormRow label="Recovery codes" className="ac-row--inline" description="Each code signs you in once if you lose your phone.">
            <div className="ac-inline">
              <span className="ac-inline__text">
                <span className="rp-mono rp-num rp-strong">{state.codesLeft ?? 10}</span> of <span className="rp-mono rp-num">10</span> unused
              </span>
              <Button variant="secondary" size="sm" iconLeft="refresh" onClick={() => setRegenOpen(true)}>
                Generate new codes
              </Button>
            </div>
            {(state.codesLeft ?? 10) <= 3 && (
              <Callout tone="med" title="Running low">
                Generate a new set so you are not locked out.
              </Callout>
            )}
          </FormRow>
          {newCodes && (
            <div className="ac-newcodes rp-view">
              <Callout tone="med" icon="warning" title="Your old codes no longer work">
                Save these now. They are not shown again after you leave this page.
              </Callout>
              <RecoveryCodes
                codes={newCodes}
                onDownload={() => downloadCodes(newCodes)}
                extra={
                  <Button size="sm" variant="secondary" iconLeft="check" onClick={() => setNewCodes(null)}>
                    Done, codes saved
                  </Button>
                }
              />
            </div>
          )}
        </>
      ) : (
        <div className="ac-2fa-off">
          <span className="ac-2fa-off__icon" aria-hidden="true">
            <Icon name="shield" size={20} />
          </span>
          <div className="ac-2fa-off__text">
            <span className="rp-strong">Protect your account with an authenticator app</span>
            <p className="ac-hint">After your password, sign-in asks for a 6-digit code from your phone. Labs hold credentials and your reports, so this is recommended.</p>
          </div>
          <Button variant="primary" iconLeft="shield-check" onClick={() => setSetupOpen(true)}>
            Set up
          </Button>
        </div>
      )}

      <TotpSetupModal
        open={setupOpen}
        onClose={() => setSetupOpen(false)}
        onEnabled={() => {
          onChange({ enabled: true, enabledAt: new Date().toISOString(), codesLeft: 10 });
          toast.push({ title: "Two-factor authentication is on", detail: "10 recovery codes saved.", tone: "success" });
        }}
      />
      <ConfirmDialog
        open={disableOpen}
        onClose={() => setDisableOpen(false)}
        destructive
        loading={busy}
        title="Turn off two-factor authentication"
        confirmLabel="Turn off"
        onConfirm={() => {
          setBusy(true);
          window.setTimeout(() => {
            setBusy(false);
            setDisableOpen(false);
            onChange({ enabled: false });
            setNewCodes(null);
            toast.push({ title: "Two-factor authentication is off", detail: `Confirmation sent to ${currentUser.email}`, tone: "crit" });
          }, 700);
        }}
      >
        <p>Your password alone will sign in to this account. Your authenticator entry and all recovery codes stop working.</p>
        <p>We email you to confirm the change.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={regenOpen}
        onClose={() => setRegenOpen(false)}
        loading={busy}
        title="Generate new recovery codes"
        confirmLabel="Generate new codes"
        onConfirm={() => {
          setBusy(true);
          window.setTimeout(() => {
            setBusy(false);
            setRegenOpen(false);
            setNewCodes(regeneratedCodes);
            onChange({ ...state, codesLeft: 10 });
            toast.push({ title: "New recovery codes generated", detail: "The previous 10 codes no longer work.", tone: "primary" });
          }, 700);
        }}
      >
        <p>All {state.codesLeft ?? 10} of your current unused codes stop working straight away.</p>
      </ConfirmDialog>
    </Card>
  );
}

const DEVICE_ICON: Record<ActiveSession["kind"], IconName> = { desktop: "monitor", mobile: "phone", terminal: "terminal" };

function SessionsCard({ sessions, onChange, loading }: { sessions: ActiveSession[]; onChange: (s: ActiveSession[]) => void; loading: boolean }) {
  const toast = useToast();
  const [target, setTarget] = useState<ActiveSession | "others" | null>(null);
  const [busy, setBusy] = useState(false);
  const others = sessions.filter((s) => !s.current);
  const narrow = useMediaQuery("(max-width: 767px)");

  const columns: Column<ActiveSession>[] = [
    {
      id: "device",
      header: "Device",
      minWidth: 220,
      cell: (s) => (
        <span className="ac-device">
          <Icon name={DEVICE_ICON[s.kind]} size={15} />
          <span className="ac-device__name">{s.device}</span>
          {s.current && <StatusDot tone="primary" size="sm" label="This device" />}
        </span>
      ),
    },
    { id: "location", header: "Location", width: 210, cell: (s) => s.location, truncate: true },
    { id: "ip", header: "IP address", width: 200, mono: true, cell: (s) => s.ip, truncate: true },
    {
      id: "active",
      header: "Last active",
      width: 130,
      cell: (s) => (s.current ? <span className="rp-strong">Now</span> : <time dateTime={s.lastActive}>{formatRelative(s.lastActive)}</time>),
    },
    {
      id: "actions",
      header: <span className="rp-sr">Actions</span>,
      headerLabel: "Actions",
      width: 104,
      align: "right",
      hideable: false,
      cell: (s) =>
        s.current ? null : (
          <Button size="sm" variant="quiet" onClick={() => setTarget(s)} aria-label={`Revoke ${s.device}, ${s.location}`}>
            Revoke
          </Button>
        ),
    },
  ];

  function confirm() {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (target === "others") {
        onChange(sessions.filter((s) => s.current));
        toast.push({ title: `${others.length} ${others.length === 1 ? "session" : "sessions"} signed out`, tone: "primary" });
      } else if (target) {
        onChange(sessions.filter((s) => s.id !== target.id));
        toast.push({ title: "Session signed out", detail: target.device, tone: "primary" });
      }
      setTarget(null);
    }, 600);
  }

  return (
    <Card
      title="Active sessions"
      padding="none"
      meta={loading ? undefined : <span className="rp-num">{sessions.length} signed in</span>}
      actions={
        others.length > 0 && !loading ? (
          <Button size="sm" variant="secondary" iconLeft="logout" onClick={() => setTarget("others")}>
            Revoke all others
          </Button>
        ) : undefined
      }
    >
      {narrow ? (
        <ul className="ac-sesslist" aria-label="Devices signed in to your account">
          {sessions.map((s) => (
            <li key={s.id} className="ac-sesslist__item">
              <Icon name={DEVICE_ICON[s.kind]} size={16} className="ac-sesslist__icon" />
              <div className="ac-sesslist__body">
                <span className="ac-device__name">{s.device}</span>
                {s.current && <StatusDot tone="primary" size="sm" label="This device" />}
                <span className="ac-sesslist__meta">
                  {s.location} · {s.current ? "Now" : <time dateTime={s.lastActive}>{formatRelative(s.lastActive)}</time>}
                </span>
                <span className="ac-sesslist__meta rp-mono">{s.ip}</span>
              </div>
              {!s.current && (
                <Button size="sm" variant="quiet" onClick={() => setTarget(s)} aria-label={`Revoke ${s.device}, ${s.location}`}>
                  Revoke
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <DataTable
          caption="Devices signed in to your account"
          columns={columns}
          rows={sessions}
          rowKey={(s) => s.id}
          loading={loading}
          columnControls={false}
          className="ac-sessions"
        />
      )}
      <ConfirmDialog
        open={target !== null}
        onClose={() => setTarget(null)}
        destructive
        loading={busy}
        title={target === "others" ? `Revoke ${others.length} other sessions` : "Revoke this session"}
        confirmLabel={target === "others" ? "Revoke all others" : "Revoke session"}
        onConfirm={confirm}
      >
        {target === "others" ? (
          <p>Every device except this one is signed out and must sign in again. Running labs keep going.</p>
        ) : target ? (
          <>
            <p>
              <span className="rp-strong">{target.device}</span> in {target.location} (<span className="rp-mono">{target.ip}</span>) is signed out straight away.
            </p>
            <p>If you do not recognise this device, change your password as well.</p>
          </>
        ) : null}
      </ConfirmDialog>
    </Card>
  );
}

function ConnectedCard({ accounts, hasPassword, onChange }: { accounts: ConnectedAccount[]; hasPassword: boolean; onChange: (a: ConnectedAccount[]) => void }) {
  const toast = useToast();
  const [pending, setPending] = useState<Provider | null>(null);
  const [unlink, setUnlink] = useState<ConnectedAccount | null>(null);
  const linked = accounts.filter((a) => a.linked);
  const lastMethod = !hasPassword && linked.length === 1;

  function link(p: Provider) {
    setPending(p);
    window.setTimeout(() => {
      setPending(null);
      onChange(accounts.map((a) => (a.provider === p ? { ...a, linked: true, account: p === "github" ? "dreyes" : currentUser.email, linkedAt: new Date().toISOString() } : a)));
      toast.push({ title: `${PROVIDER_LABEL[p]} linked`, detail: "You can now sign in with it.", tone: "success" });
    }, 1100);
  }

  return (
    <Card title="Connected accounts" padding="none" meta="Sign in with a provider instead of a password">
      <ul className="ac-providers">
        {PROVIDERS.map((p) => {
          const a = accounts.find((x) => x.provider === p.id) ?? { provider: p.id, linked: false };
          const blocked = a.linked && lastMethod;
          return (
            <li key={p.id} className="ac-provider">
              <span className="ac-provider__mark" aria-hidden="true">
                <ProviderMark provider={p.id} size={20} />
              </span>
              <span className="ac-provider__text">
                <span className="rp-strong">{p.label}</span>
                {a.linked ? (
                  <span className="ac-provider__meta">
                    <span className="rp-mono">{a.account}</span>
                    {a.linkedAt && <span> · linked {formatDate(a.linkedAt, { day: "numeric", month: "short", year: "numeric" })}</span>}
                  </span>
                ) : (
                  <span className="ac-provider__meta">Not linked</span>
                )}
              </span>
              {a.linked ? (
                blocked ? (
                  <Tooltip content="Set a password first. This is your only way to sign in.">
                    <span className="ac-provider__blocked" tabIndex={0} role="note" aria-label={`Cannot unlink ${p.label}. It is your only sign-in method. Set a password first.`}>
                      <Icon name="lock" size={13} />
                      Only sign-in method
                    </span>
                  </Tooltip>
                ) : (
                  <Button size="sm" variant="quiet" onClick={() => setUnlink(a)} aria-label={`Unlink ${p.label}`}>
                    Unlink
                  </Button>
                )
              ) : (
                <Button size="sm" variant="secondary" loading={pending === p.id} disabled={pending !== null} onClick={() => link(p.id)} aria-label={`Link ${p.label}`}>
                  Link
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {lastMethod && (
        <div className="ac-callout ac-callout--foot">
          <Callout tone="info" icon="lock">
            You need at least one way to sign in. Set a password above before unlinking {PROVIDER_LABEL[linked[0].provider]}.
          </Callout>
        </div>
      )}
      <ConfirmDialog
        open={unlink !== null}
        onClose={() => setUnlink(null)}
        destructive
        title={unlink ? `Unlink ${PROVIDER_LABEL[unlink.provider]}` : ""}
        confirmLabel="Unlink"
        onConfirm={() => {
          if (!unlink) return;
          onChange(accounts.map((a) => (a.provider === unlink.provider ? { provider: a.provider, linked: false } : a)));
          toast.push({ title: `${PROVIDER_LABEL[unlink.provider]} unlinked`, tone: "primary" });
          setUnlink(null);
        }}
      >
        {unlink && (
          <p>
            You will no longer be able to sign in with <span className="rp-mono rp-strong">{unlink.account}</span>. You can still sign in with{" "}
            {[hasPassword && "your password", ...linked.filter((l) => l.provider !== unlink.provider).map((l) => PROVIDER_LABEL[l.provider])].filter(Boolean).join(" or ")}.
          </p>
        )}
      </ConfirmDialog>
    </Card>
  );
}

export function SecurityTab({ loading }: { loading: boolean }) {
  const [params] = useSearchParams();
  const initial = params.get("account") === "provider" ? providerOnlySecurity : savedSecurity;
  const [state, setState] = useState<SecurityState>(initial);
  return (
    <div className="ac-stack">
      <ChangePassword hasPassword={state.hasPassword} onSet={() => setState((s) => ({ ...s, hasPassword: true }))} />
      <TwoFactorCard state={state.twoFactor} onChange={(twoFactor) => setState((s) => ({ ...s, twoFactor }))} />
      <SessionsCard sessions={state.sessions} loading={loading} onChange={(sessions) => setState((s) => ({ ...s, sessions }))} />
      <ConnectedCard accounts={state.accounts} hasPassword={state.hasPassword} onChange={(accounts) => setState((s) => ({ ...s, accounts }))} />
    </div>
  );
}
