import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Icon, SegmentedControl, Select, readStorage, writeStorage } from "@rootpanther/ui";
import type { ThemePreference } from "@rootpanther/ui";

export type DataState = "default" | "loading" | "empty" | "error" | "denied";

export interface ReviewFlags {
  idle: "none" | "warning";
  incident: "none" | "active";
}

const DEFAULTS: ReviewFlags = { idle: "none", incident: "none" };

interface ReviewApi {
  flags: ReviewFlags;
  setFlag: <K extends keyof ReviewFlags>(k: K, v: ReviewFlags[K]) => void;
}

const ReviewContext = createContext<ReviewApi>({ flags: DEFAULTS, setFlag: () => undefined });

export const REVIEW_ENABLED = import.meta.env.VITE_REVIEW !== "0";

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<ReviewFlags>(() => ({ ...DEFAULTS, ...readStorage<Partial<ReviewFlags>>("rp-portal-review", {}) }));
  const api = useMemo<ReviewApi>(
    () => ({
      flags,
      setFlag: (k, v) =>
        setFlags((f) => {
          const next = { ...f, [k]: v };
          writeStorage("rp-portal-review", next);
          return next;
        }),
    }),
    [flags],
  );
  return <ReviewContext.Provider value={api}>{children}</ReviewContext.Provider>;
}

export function useReview() {
  return useContext(ReviewContext);
}

export function useDataState(): DataState {
  const [params] = useSearchParams();
  const s = params.get("state");
  if (s === "loading" || s === "empty" || s === "error" || s === "denied") return s;
  return "default";
}

const SCREENS: [string, string][] = [
  ["/", "Overview"],
  ["/users", "Users"],
  ["/users/usr_7Hk2pQ", "User detail"],
  ["/billing", "Billing"],
  ["/fleet", "Fleet"],
  ["/content", "Content"],
  ["/onyx", "Onyx Ops"],
  ["/finance", "Finance"],
  ["/system", "System"],
  ["/signin", "Operator sign-in"],
];

export function ReviewPanel({ theme, onTheme }: { theme: ThemePreference; onTheme: (t: ThemePreference) => void }) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const { flags, setFlag } = useReview();
  const state = useDataState();
  const navigate = useNavigate();
  const location = useLocation();
  if (!REVIEW_ENABLED) return null;
  const here = SCREENS.find(([to]) => to === location.pathname)?.[0] ?? "";
  return (
    <div className="rv">
      {open && (
        <div className="rv__panel" role="dialog" aria-label="Review controls">
          <div className="rv__head">
            <span className="rp-eyebrow">Review controls</span>
            <button type="button" className="rp-modal__close" aria-label="Close review controls" onClick={() => setOpen(false)}>
              <Icon name="x" size={14} />
            </button>
          </div>
          <p className="rv__note">Preview tooling for design review. Not part of the product.</p>
          <div className="rv__row">
            <span>Screen</span>
            <Select
              selectSize="sm"
              aria-label="Go to screen"
              value={here}
              placeholder="Go to screen"
              onChange={(e) => navigate(e.target.value)}
              options={SCREENS.map(([value, label]) => ({ value, label }))}
            />
          </div>
          <div className="rv__row">
            <span>Theme</span>
            <SegmentedControl size="sm" label="Theme" value={theme} onChange={onTheme} options={[{ value: "dark", label: "Dark" }, { value: "light", label: "Light" }]} />
          </div>
          <div className="rv__row">
            <span>Page data</span>
            <SegmentedControl
              size="sm"
              label="Page data state"
              value={state}
              onChange={(v) => {
                const p = new URLSearchParams(params);
                if (v === "default") p.delete("state");
                else p.set("state", v);
                setParams(p, { replace: true });
              }}
              options={[
                { value: "default", label: "Data" },
                { value: "loading", label: "Load" },
                { value: "empty", label: "Empty" },
                { value: "error", label: "Error" },
                { value: "denied", label: "Denied" },
              ]}
            />
          </div>
          <div className="rv__row">
            <span>Idle timeout</span>
            <SegmentedControl size="sm" label="Idle timeout" value={flags.idle} onChange={(v) => setFlag("idle", v)} options={[{ value: "none", label: "Active" }, { value: "warning", label: "Warning" }]} />
          </div>
          <div className="rv__row">
            <span>Incident</span>
            <SegmentedControl size="sm" label="Incident banner" value={flags.incident} onChange={(v) => setFlag("incident", v)} options={[{ value: "none", label: "None" }, { value: "active", label: "Active" }]} />
          </div>
        </div>
      )}
      <button type="button" className="rv__toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="sliders" size={14} />
        Review
      </button>
    </div>
  );
}
