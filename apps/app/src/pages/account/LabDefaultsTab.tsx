import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Card, CopyButton, Icon, Radio, StatusDot, Textarea, useToast } from "@rootpanther/ui";
import type { ConnectionMethod } from "@rootpanther/ui";
import { ChoiceCard } from "../../auth/parts";
import { labDefaults as savedDefaults, sessionLimits } from "../../mock/settings";
import type { LabDefaults, TeardownPolicy } from "../../mock/settings";
import { FormRow, SaveBar } from "./parts";
import { parseSshKey, sshFingerprint } from "./sshKey";

const TEARDOWN: { value: TeardownPolicy; label: string; description: string }[] = [
  {
    value: "idle",
    label: `End after ${sessionLimits.idleMinutes} minutes idle`,
    description: `No terminal input and no OpenVPN traffic for ${sessionLimits.idleMinutes} minutes ends the session. You get a ${sessionLimits.warningMinutes}-minute warning.`,
  },
  {
    value: "leave",
    label: "End when I close the lab view",
    description: `Ends ${sessionLimits.leaveGraceMinutes} minutes after the last lab tab closes, unless an OpenVPN tunnel is still up. Uses the fewest lab hours.`,
  },
  {
    value: "max-life",
    label: "Keep running until the time limit",
    description: `Ignores idle time. Ends at the ${sessionLimits.maxLifeHours}-hour maximum. Lab hours count the whole time.`,
  },
];

function KeyStatus({ value }: { value: string }) {
  const parsed = useMemo(() => (value.trim() ? parseSshKey(value) : null), [value]);
  const [fp, setFp] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setFp(null);
    if (parsed?.ok) void sshFingerprint(parsed.blob).then((f) => live && setFp(f));
    return () => {
      live = false;
    };
  }, [parsed]);
  if (!parsed || !parsed.ok) return null;
  return (
    <dl className="ac-key">
      <div className="ac-key__row">
        <dt>Type</dt>
        <dd className="rp-mono">
          {parsed.label}
          {parsed.bits ? ` ${parsed.bits}` : ""}
        </dd>
      </div>
      <div className="ac-key__row">
        <dt>Fingerprint</dt>
        <dd className="ac-key__fp">
          <span className="rp-mono">{fp ?? "Calculating"}</span>
          {fp && <CopyButton value={fp} label="Copy fingerprint" />}
        </dd>
      </div>
      {parsed.comment && (
        <div className="ac-key__row">
          <dt>Comment</dt>
          <dd className="rp-mono">{parsed.comment}</dd>
        </div>
      )}
    </dl>
  );
}

export function LabDefaultsTab() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [saved, setSaved] = useState<LabDefaults>(savedDefaults);
  const [draft, setDraft] = useState<LabDefaults>(savedDefaults);
  const [keyTouched, setKeyTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const keyRef = useRef<HTMLTextAreaElement>(null);
  const teardownId = useId();
  const dirty = draft.connection !== saved.connection || draft.teardown !== saved.teardown || draft.sshKey.trim() !== saved.sshKey.trim();
  const parsed = draft.sshKey.trim() ? parseSshKey(draft.sshKey) : null;
  const keyError = parsed && !parsed.ok && (keyTouched || draft.sshKey.length > 40) ? parsed.error : undefined;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setKeyTouched(true);
    if (parsed && !parsed.ok) return keyRef.current?.focus();
    if (!dirty) return;
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      if (params.get("save") === "error") {
        params.delete("save");
        setParams(params, { replace: true });
        toast.push({ title: "Lab defaults not saved", detail: "The settings service did not respond. Your changes are still here.", tone: "crit" });
        return;
      }
      const next = { ...draft, sshKey: draft.sshKey.trim() };
      setSaved(next);
      setDraft(next);
      toast.push({
        title: "Lab defaults saved",
        detail: next.sshKey !== saved.sshKey ? "The new SSH key applies to attack boxes started from now on." : "Applies to labs you launch from now on.",
        tone: "success",
      });
    }, 800);
  }

  return (
    <form onSubmit={onSubmit} noValidate aria-label="Lab defaults" className="ac-stack">
      <Card title="Connection" padding="none">
        <FormRow label="Preferred method" as="fieldset" className="ac-row--stack" description="Pre-selected when you launch a lab. You can switch per lab.">
          <div className="ac-conn">
            {(["browser", "openvpn"] as ConnectionMethod[]).map((m) => (
              <ChoiceCard
                key={m}
                name="connection"
                value={m}
                checked={draft.connection === m}
                onSelect={() => setDraft({ ...draft, connection: m })}
                title={
                  <>
                    <Icon name={m === "browser" ? "monitor" : "network"} size={16} />
                    {m === "browser" ? "In-browser terminal" : "Your own Kali over OpenVPN"}
                  </>
                }
                description={m === "browser" ? "Hosted Kali in the lab view, next to Onyx. Uses the SSH key below." : "Download a .ovpn per session and run sudo openvpn on your machine."}
              />
            ))}
          </div>
        </FormRow>
      </Card>

      <Card title="Auto-teardown" padding="none" meta={`Every session ends at ${sessionLimits.maxLifeHours} hours`}>
        <fieldset className="ac-row ac-row--stack" aria-describedby={`${teardownId}-d`}>
          <div className="ac-row__label">
            <legend className="ac-row__title">When a session ends on its own</legend>
            <p className="ac-row__desc" id={`${teardownId}-d`}>
              Machines are destroyed when a session ends. Notes, proofs and reports stay on your account.
            </p>
          </div>
          <div className="ac-row__control ac-radios">
            {TEARDOWN.map((o) => (
              <Radio key={o.value} name="teardown" value={o.value} checked={draft.teardown === o.value} onChange={() => setDraft({ ...draft, teardown: o.value })} label={o.label} description={o.description} />
            ))}
          </div>
        </fieldset>
      </Card>

      <Card title="Hosted attack box" padding="none" meta={saved.sshKey ? <StatusDot tone="neutral" size="sm" label="1 key" /> : <StatusDot tone="neutral" hollow size="sm" label="No key" />}>
        <FormRow label="SSH public key" htmlFor="ld-key" className="ac-row--stack" description={<>Lets you SSH into the hosted Kali box as <span className="rp-mono">kali</span>. Paste the contents of your <span className="rp-mono">.pub</span> file. ED25519 recommended.</>}>
          <Textarea
            ref={keyRef}
            id="ld-key"
            name="ssh-public-key"
            mono
            rows={3}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="off"
            placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... you@kali"
            value={draft.sshKey}
            error={keyError}
            hint={!keyError && !parsed ? <>Generate one with <span className="rp-mono">ssh-keygen -t ed25519</span></> : undefined}
            onChange={(e) => setDraft({ ...draft, sshKey: e.target.value })}
            onBlur={() => setKeyTouched(true)}
            className="ac-keyarea"
          />
          <KeyStatus value={draft.sshKey} />
          {draft.sshKey && (
            <div>
              <Button size="sm" variant="quiet" iconLeft="trash" onClick={() => setDraft({ ...draft, sshKey: "" })}>
                Remove key
              </Button>
            </div>
          )}
        </FormRow>
      </Card>

      <div className={dirty ? "ac-sticky is-dirty" : "ac-sticky"}>
        <SaveBar dirty={dirty} saving={saving} onDiscard={() => setDraft(saved)} idle={<span className="ac-hint">Applies to labs you launch from now on. Running labs keep their settings.</span>} />
      </div>
    </form>
  );
}
