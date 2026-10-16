import { useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, HelpDial, Icon, Select, Slider, Switch, cx, helpLabel, useMediaQuery, useToast } from "@rootpanther/ui";
import type { ThemePreference } from "@rootpanther/ui";
import { useAppTheme } from "../../theme";
import { currentUser } from "../../mock/account";
import { TERMINAL_THEMES, preferences as savedPreferences } from "../../mock/settings";
import type { EmailPreferences, Preferences, TerminalTheme } from "../../mock/settings";
import { FormRow, SaveBar } from "./parts";

function ThemePreview({ variant }: { variant: "dark" | "light" }) {
  return (
    <span className={cx("ac-tp", `ac-tp--${variant}`)} data-theme={variant === "light" ? "light" : undefined} aria-hidden="true">
      <span className="ac-tp__top" />
      <span className="ac-tp__side">
        <span className="ac-tp__nav is-on" />
        <span className="ac-tp__nav" />
        <span className="ac-tp__nav" />
        <span className="ac-tp__nav" />
      </span>
      <span className="ac-tp__main">
        <span className="ac-tp__card">
          <span className="ac-tp__line is-head" />
          <span className="ac-tp__line" />
          <span className="ac-tp__cta" />
        </span>
      </span>
    </span>
  );
}

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

function ThemePicker() {
  const toast = useToast();
  const { preference, setPreference } = useAppTheme();
  const systemLight = useMediaQuery("(prefers-color-scheme: light)");
  return (
    <div className="ac-themes" role="radiogroup" aria-label="Theme">
      {THEME_OPTIONS.map((o) => {
        const on = preference === o.value;
        return (
          <label key={o.value} className={cx("ac-theme", on && "is-checked")}>
            <span className="ac-theme__preview">
              {o.value === "system" ? (
                <span className="ac-tp-split">
                  <ThemePreview variant="dark" />
                  <ThemePreview variant="light" />
                </span>
              ) : (
                <ThemePreview variant={o.value} />
              )}
            </span>
            <span className="ac-theme__foot">
              <input
                type="radio"
                name="theme"
                className="rp-radio__input"
                value={o.value}
                checked={on}
                onChange={() => {
                  setPreference(o.value);
                  toast.push({ title: o.value === "system" ? `Theme follows your system, now ${systemLight ? "light" : "dark"}` : `${o.label} theme on`, tone: "primary", duration: 3000 });
                }}
              />
              <span className="rp-radio__dot" aria-hidden="true" />
              <span className="ac-theme__label">{o.label}</span>
              {o.value === "system" && <span className="ac-theme__aside">Now {systemLight ? "light" : "dark"}</span>}
            </span>
          </label>
        );
      })}
    </div>
  );
}

const SAMPLE = [
  { prompt: true, text: "nxc smb 172.16.20.0/24 -u j.harlow -p 'Autumn#2026'" },
  { prompt: false, text: "SMB  172.16.20.11  445  MER-SQL01  [+] meridian.local\\j.harlow:Autumn#2026" },
  { prompt: false, text: "SMB  172.16.20.5   445  MER-DC01   [+] meridian.local\\j.harlow:Autumn#2026" },
];

function TerminalSample({ size, theme }: { size: number; theme: TerminalTheme }) {
  return (
    <div className={cx("ac-term", `is-${theme}`)} style={{ fontSize: size }} aria-label={`Terminal preview at ${size} pixels`} role="img">
      {SAMPLE.map((l, i) => (
        <div key={i} className="ac-term__line rp-mono">
          {l.prompt && <span className="ac-term__prompt">kali@rp-attack:~$ </span>}
          {l.text}
        </div>
      ))}
      <div className="ac-term__line rp-mono">
        <span className="ac-term__prompt">kali@rp-attack:~$ </span>
        <span className="ac-term__cursor" />
      </div>
    </div>
  );
}

const EMAIL_ROWS: { key: keyof EmailPreferences; label: string; description: string }[] = [
  { key: "sessionExpiry", label: "Session expiry warnings", description: "15 minutes before a running lab reaches its time limit." },
  { key: "debriefReady", label: "Debrief ready", description: "When Onyx finishes the debrief for a lab you ended." },
  { key: "newScenarios", label: "New scenarios", description: "When a scenario is published at your Path tier. At most one a week." },
  { key: "billing", label: "Billing", description: "Receipts and plan changes. Failed payment notices are always sent." },
];

export function PreferencesTab() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const narrow = useMediaQuery("(max-width: 767px)");
  const [saved, setSaved] = useState<Preferences>(savedPreferences);
  const [draft, setDraft] = useState<Preferences>(savedPreferences);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setSaving(true);
    window.setTimeout(() => {
      setSaving(false);
      if (params.get("save") === "error") {
        params.delete("save");
        setParams(params, { replace: true });
        toast.push({ title: "Preferences not saved", detail: "The settings service did not respond. Your changes are still here.", tone: "crit" });
        return;
      }
      setSaved(draft);
      toast.push({ title: "Preferences saved", tone: "success" });
    }, 700);
  }

  const setEmail = (key: keyof EmailPreferences, v: boolean) => setDraft({ ...draft, email: { ...draft.email, [key]: v } });

  return (
    <div className="ac-stack">
      <Card title="Appearance" padding="none" meta="Saved on this device">
        <FormRow label="Theme" as="fieldset" className="ac-row--stack" description="Applies straight away. Sign-in screens are always dark.">
          <ThemePicker />
        </FormRow>
        <FormRow label="Reduced motion" description="Set by your operating system, not here." className="ac-row--inline">
          <div className="ac-motion" aria-live="polite">
            <span className="rp-strong">{reducedMotion ? "On" : "Off"}</span>
            <span className="ac-hint">{reducedMotion ? "Fades, reveals and the skeleton shimmer are turned off." : "Fades and reveals play. Turn on reduced motion in your system to stop them."}</span>
          </div>
        </FormRow>
      </Card>

      <form onSubmit={onSubmit} noValidate aria-label="Lab preferences" className="ac-stack">
        <Card title="Onyx" padding="none">
          <FormRow label="Default help level" labelId="pr-help-label" className="ac-row--stack" description="Used when a lab starts. Change it any time from the Onyx panel in a lab. Separate from your declared Path tier.">
            <HelpDial value={draft.helpDefault} onChange={(helpDefault) => setDraft({ ...draft, helpDefault })} label="Default Onyx help level" compact={narrow} />
          </FormRow>
        </Card>

        <Card title="Terminal" padding="none" meta="In-browser terminal only">
          <div className="ac-row ac-row--stack">
            <div className="ac-termgrid">
              <Slider id="pr-font" label="Font size" min={11} max={18} value={draft.terminalFontSize} onChange={(terminalFontSize) => setDraft({ ...draft, terminalFontSize })} format={(v) => `${v} px`} />
              <Select
                id="pr-term-theme"
                label="Colour theme"
                options={TERMINAL_THEMES}
                value={draft.terminalTheme}
                onChange={(e) => setDraft({ ...draft, terminalTheme: e.target.value as TerminalTheme })}
              />
            </div>
            <TerminalSample size={draft.terminalFontSize} theme={draft.terminalTheme} />
          </div>
        </Card>

        <Card title="Email notifications" padding="none" meta={<span className="rp-mono">{currentUser.email}</span>}>
          <div className="ac-switches">
            {EMAIL_ROWS.map((r) => (
              <div key={r.key} className="ac-switches__row">
                <Switch checked={draft.email[r.key]} onChange={(v) => setEmail(r.key, v)} label={r.label} description={r.description} />
              </div>
            ))}
          </div>
        </Card>

        <div className={cx("ac-sticky", dirty && "is-dirty")}>
          <SaveBar
            dirty={dirty}
            saving={saving}
            onDiscard={() => setDraft(saved)}
            idle={
              <span className="ac-hint">
                <Icon name="check" size={13} className="ac-hint__icon" />
                Default help level <span className="rp-strong">{helpLabel(saved.helpDefault)}</span>, terminal <span className="rp-mono">{saved.terminalFontSize} px</span>
              </span>
            }
          />
        </div>
      </form>
    </div>
  );
}
