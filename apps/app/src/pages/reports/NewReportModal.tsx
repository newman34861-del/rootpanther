import { useEffect, useId, useRef, useState } from "react";
import { Button, Checkbox, Input, Modal, Select } from "@rootpanther/ui";
import type { ScenarioType } from "@rootpanther/ui";
import { scenarios } from "../../mock/scenarios";

const TYPE_LABEL: Record<ScenarioType, string> = { "ad-set": "AD set", standalone: "Standalone", "exam-sim": "Exam simulation" };

const ATTEMPTED = scenarios.filter((s) => s.history && s.history.attempts > 0);

const TEMPLATE_SECTIONS = "Executive summary, scope, methodology, findings per host, remediation, command appendix.";

export function NewReportModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (title: string, scenarioIds: string[]) => void }) {
  const [title, setTitle] = useState("");
  const [touched, setTouched] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const legendId = useId();

  useEffect(() => {
    if (!open) {
      setTitle("");
      setTouched(false);
      setPicked([]);
      setBusy(false);
    }
  }, [open]);

  function toggle(id: string) {
    const next = picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id];
    setPicked(next);
    if (!touched) {
      const names = ATTEMPTED.filter((s) => next.includes(s.id));
      if (names.length === 0) setTitle("");
      else if (names.length === 1) setTitle(`${names[0].name}, ${names[0].type === "ad-set" ? "internal assessment" : "standalone report"}`);
      else setTitle(`Practice report, ${names.map((n) => n.name).join(", ")}`);
    }
  }

  const ready = title.trim().length > 0 && picked.length > 0;

  function submit() {
    if (!ready || busy) return;
    setBusy(true);
    window.setTimeout(() => onCreate(title.trim(), picked), 450);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New report"
      size="md"
      initialFocus={titleRef}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!ready} loading={busy}>
            Create report
          </Button>
        </>
      }
    >
      <form
        className="rl-new"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Input
          ref={titleRef}
          label="Title"
          value={title}
          placeholder="Meridian, internal assessment"
          onChange={(e) => {
            setTitle(e.target.value);
            setTouched(true);
          }}
        />
        <fieldset className="rl-new__scen" aria-describedby={`${legendId}-hint`}>
          <legend id={legendId} className="rp-field__label">
            Scenarios
          </legend>
          <p id={`${legendId}-hint`} className="rl-new__hint">
            Evidence you saved in these labs appears in the evidence tray.
          </p>
          <div className="rl-new__list">
            {ATTEMPTED.map((s) => (
              <Checkbox
                key={s.id}
                checked={picked.includes(s.id)}
                onChange={() => toggle(s.id)}
                label={s.name}
                description={`${TYPE_LABEL[s.type]}, ${s.hostCount} ${s.hostCount === 1 ? "host" : "hosts"}`}
              />
            ))}
          </div>
        </fieldset>
        <Select label="Template" hint={TEMPLATE_SECTIONS} value="oscp" onChange={() => undefined} options={[{ value: "oscp", label: "OSCP exam report" }]} />
      </form>
    </Modal>
  );
}
