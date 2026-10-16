import { createContext, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Icon, SegmentedControl, Select, readStorage, writeStorage } from "@rootpanther/ui";
import type { ThemePreference } from "@rootpanther/ui";

export type DataState = "default" | "loading" | "empty" | "error" | "denied";
export type BannerFlag = "none" | "impersonation" | "dunning";
export type LabFlag = "active" | "none";
export type UserFlag = "returning" | "new";
export type RoleFlag = "operator" | "learner";

export interface ReviewFlags {
  banner: BannerFlag;
  lab: LabFlag;
  user: UserFlag;
  role: RoleFlag;
}

const DEFAULTS: ReviewFlags = { banner: "none", lab: "active", user: "returning", role: "operator" };

interface ReviewApi {
  flags: ReviewFlags;
  setFlag: <K extends keyof ReviewFlags>(k: K, v: ReviewFlags[K]) => void;
}

const ReviewContext = createContext<ReviewApi>({ flags: DEFAULTS, setFlag: () => undefined });

export const REVIEW_ENABLED = import.meta.env.VITE_REVIEW !== "0";

export function ReviewProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<ReviewFlags>(() => ({ ...DEFAULTS, ...readStorage<Partial<ReviewFlags>>("rp-review", {}) }));
  const api = useMemo<ReviewApi>(
    () => ({
      flags,
      setFlag: (k, v) =>
        setFlags((f) => {
          const next = { ...f, [k]: v };
          writeStorage("rp-review", next);
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
  ["/", "Home"],
  ["/catalogue", "Catalogue"],
  ["/catalogue/meridian", "Scenario detail"],
  ["/path", "My Path"],
  ["/labs", "Labs"],
  ["/lab/ses_4QmX9a", "Lab view"],
  ["/reports", "Reports"],
  ["/reports/rep-meridian", "Report builder"],
  ["/reports/debriefs/deb-basalt", "Debrief"],
  ["/onyx", "Ask Onyx"],
  ["/account/profile", "Profile"],
  ["/settings/preferences", "Settings"],
  ["/billing", "Billing and plan"],
  ["/billing/payment-failed", "Payment failed"],
  ["/pricing", "Pricing (public)"],
  ["/checkout?plan=practitioner&interval=month&mode=elements", "Checkout, card form"],
  ["/checkout?plan=practitioner&interval=month&mode=hosted", "Checkout, Stripe hand-off"],
  ["/checkout/success", "Checkout success"],
  ["/checkout/cancelled", "Checkout cancelled"],
  ["/checkout/processing", "Checkout processing"],
  ["/signin", "Sign in"],
  ["/signup", "Create account"],
  ["/verify", "Verify email"],
  ["/reset", "Password reset"],
  ["/2fa", "Two-factor"],
  ["/onboarding?step=1", "Onboarding"],
  ["/kit", "Component kit"],
];

export function ReviewPanel({ theme, onTheme }: { theme: ThemePreference; onTheme: (t: ThemePreference) => void }) {
  const [open, setOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const { flags, setFlag } = useReview();
  const state = useDataState();
  const navigate = useNavigate();
  const location = useLocation();
  if (!REVIEW_ENABLED) return null;
  const here = SCREENS.find(([to]) => to.split("?")[0] === location.pathname)?.[0] ?? "";
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
          <p className="rv__note">
            Preview tooling for design review. Not part of the product. <Link to="/kit">Component kit</Link>
          </p>
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
                { value: "denied", label: "Plan" },
              ]}
            />
          </div>
          <div className="rv__row">
            <span>Active lab</span>
            <SegmentedControl size="sm" label="Active lab" value={flags.lab} onChange={(v) => setFlag("lab", v)} options={[{ value: "active", label: "Running" }, { value: "none", label: "None" }]} />
          </div>
          <div className="rv__row">
            <span>Learner</span>
            <SegmentedControl size="sm" label="Learner" value={flags.user} onChange={(v) => setFlag("user", v)} options={[{ value: "returning", label: "Returning" }, { value: "new", label: "New" }]} />
          </div>
          <div className="rv__row">
            <span>Role</span>
            <SegmentedControl size="sm" label="Role" value={flags.role} onChange={(v) => setFlag("role", v)} options={[{ value: "operator", label: "Operator" }, { value: "learner", label: "Learner" }]} />
          </div>
          <div className="rv__row">
            <span>Banner</span>
            <SegmentedControl
              size="sm"
              label="Global banner"
              value={flags.banner}
              onChange={(v) => setFlag("banner", v)}
              options={[
                { value: "none", label: "None" },
                { value: "impersonation", label: "Imperson." },
                { value: "dunning", label: "Dunning" },
              ]}
            />
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
