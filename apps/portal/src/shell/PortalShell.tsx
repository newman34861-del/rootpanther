import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AppShell,
  Avatar,
  Banner,
  Button,
  CommandPalette,
  DropdownMenu,
  Icon,
  IconButton,
  Lockup,
  Modal,
  NavGroup,
  NavItem,
  SearchTrigger,
  Sidebar,
  StatusDot,
  TopBar,
  formatClock,
  isTypingTarget,
  useInterval,
  useMediaQuery,
  useStoredState,
  useToast,
} from "@rootpanther/ui";
import type { CommandItem, IconName, Theme } from "@rootpanther/ui";
import { operator } from "../mock/operator";
import { useReview } from "../review/review";
import "./shell.css";

export const APP_URL = import.meta.env.VITE_APP_URL ?? "https://app.rootpanther.com";
const IDLE_SECONDS = 15 * 60;

const NAV: { to: string; icon: IconName; label: string; count?: number }[] = [
  { to: "/", icon: "gauge", label: "Overview" },
  { to: "/users", icon: "users", label: "Users" },
  { to: "/billing", icon: "card", label: "Billing", count: 7 },
  { to: "/fleet", icon: "server", label: "Fleet", count: 3 },
  { to: "/content", icon: "layers", label: "Content" },
  { to: "/onyx", icon: "chat", label: "Onyx Ops" },
  { to: "/finance", icon: "money", label: "Finance" },
  { to: "/system", icon: "activity", label: "System" },
];

const GROUPS = ["Actions", "Navigation", "Users", "Tenants", "Scenarios"];

function buildCommands(): CommandItem[] {
  const items: CommandItem[] = [
    { id: "nav:/fleet?filter=orphaned", label: "Review orphaned infrastructure", group: "Actions", icon: "warning", hint: "3 tenants" },
    { id: "nav:/billing#dunning", label: "Open dunning board", group: "Actions", icon: "card" },
    { id: "nav:/users?export=1", label: "Export users to CSV", group: "Actions", icon: "download" },
    { id: "nav:/content#solve-tests", label: "Solve-test CI board", group: "Actions", icon: "check-circle" },
    { id: "nav:/system#audit", label: "Audit log", group: "Actions", icon: "checklist" },
  ];
  NAV.forEach((n) => items.push({ id: `nav:${n.to}`, label: n.label, group: "Navigation", icon: n.icon }));
  operator.searchUsers.forEach((u) => items.push({ id: `nav:/users/${u.id}`, label: u.email, group: "Users", icon: "user", hint: u.plan, mono: true, keywords: [u.name] }));
  operator.searchTenants.forEach((t) => items.push({ id: `nav:/fleet?tenant=${t.id}`, label: t.id, group: "Tenants", icon: "server", hint: t.scenario, mono: true, keywords: [t.user] }));
  ["Meridian", "Ironwood", "Vesper", "Cinder", "Quarry", "Granite"].forEach((s) => items.push({ id: `nav:/content?scenario=${s.toLowerCase()}`, label: s, group: "Scenarios", icon: "layers" }));
  return items;
}

export function PortalShell({ children, theme, onToggleTheme }: { children: ReactNode; theme: Theme; onToggleTheme: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { flags, setFlag } = useReview();
  const [collapsedPref, setCollapsedPref] = useStoredState("rp-portal-collapsed", false);
  const tablet = useMediaQuery("(max-width: 1023px)");
  const mobile = useMediaQuery("(max-width: 767px)");
  const collapsed = mobile ? false : tablet ? true : collapsedPref;
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [idle, setIdle] = useState(IDLE_SECONDS);
  const commands = useMemo(buildCommands, []);

  useEffect(() => setNavOpen(false), [location.pathname]);

  useInterval(() => setIdle((s) => Math.max(0, s - 1)), 1000);

  useEffect(() => {
    const reset = () => setIdle(IDLE_SECONDS);
    window.addEventListener("pointerdown", reset);
    window.addEventListener("keydown", reset);
    return () => {
      window.removeEventListener("pointerdown", reset);
      window.removeEventListener("keydown", reset);
    };
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "[" && !e.metaKey && !e.ctrlKey && !isTypingTarget(e.target) && !tablet) {
        setCollapsedPref(!collapsedPref);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [collapsedPref, setCollapsedPref, tablet]);

  const active = (to: string) => (to === "/" ? location.pathname === "/" : location.pathname.startsWith(to));

  const sidebar = (
    <Sidebar
      label="Portal"
      collapsed={collapsed}
      onToggleCollapsed={tablet ? undefined : () => setCollapsedPref(!collapsedPref)}
      footer={
        collapsed ? null : (
          <div className="ps-session" aria-label="Operator session">
            <div className="ps-session__row">
              <StatusDot tone="success" size="sm" label="2FA verified" />
            </div>
            <div className="ps-session__row">
              <span>Idle lock</span>
              <span className="rp-mono rp-num">{formatClock(idle)}</span>
            </div>
          </div>
        )
      }
    >
      <NavGroup collapsed={collapsed}>
        {NAV.map((n) => (
          <NavItem key={n.to} to={n.to} icon={n.icon} label={n.label} active={active(n.to)} collapsed={collapsed} count={n.count} />
        ))}
      </NavGroup>
    </Sidebar>
  );

  return (
    <>
      <AppShell
        variant="portal"
        collapsed={collapsed}
        mobileNavOpen={navOpen}
        onMobileNavClose={() => setNavOpen(false)}
        banner={
          flags.incident === "active" ? (
            <Banner
              tone="crit"
              icon="warning"
              action={
                <Button size="sm" variant="secondary" onClick={() => navigate("/system#incidents")}>
                  Open incident
                </Button>
              }
            >
              <span className="rp-strong">INC-0142, provisioning degraded in uksouth.</span> 6 launches failed in 15 minutes. Learners were not charged.
            </Banner>
          ) : null
        }
        sidebar={sidebar}
        topbar={
          <TopBar
            leading={mobile ? <IconButton icon="menu" label="Open navigation" variant="chrome" onClick={() => setNavOpen(true)} tooltip={false} /> : undefined}
            brand={
              <Link to="/" aria-label="Portal overview">
                <Lockup collapsed={collapsed && !mobile} size={mobile ? "sm" : "md"} badge="PORTAL" />
              </Link>
            }
            center={
              <>
                <SearchTrigger onOpen={() => setPaletteOpen(true)} label="Search users, tenants, scenarios" />
                <span className="ps-env rp-mono" title="Environment">
                  <span className="ps-env__dot" aria-hidden="true" />
                  production
                </span>
              </>
            }
            actions={
              <>
                <IconButton icon={theme === "dark" ? "sun" : "moon"} label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} variant="chrome" onClick={onToggleTheme} />
                <IconButton icon="bell" label="Alerts" variant="chrome" badge={4} onClick={() => navigate("/#alerts")} />
                <DropdownMenu
                  label="Operator"
                  width={264}
                  header={
                    <div className="ps-acct">
                      <Avatar initials={operator.initials} size={32} />
                      <div className="ps-acct__text">
                        <span className="ps-acct__name">{operator.name}</span>
                        <span className="ps-acct__email rp-mono">{operator.email}</span>
                      </div>
                    </div>
                  }
                  items={[
                    { id: "role", heading: <span className="rp-mono">role: {operator.role}</span> },
                    { id: "app", label: "Open learner app", icon: "external", to: APP_URL, external: true },
                    { id: "d", divider: true },
                    { id: "out", label: "Sign out", icon: "logout", to: "/signin" },
                  ]}
                  trigger={(p) => (
                    <button {...p} type="button" className="rp-topbar__avatarbtn" aria-label={`Operator menu for ${operator.name}`}>
                      <Avatar initials={operator.initials} size={28} />
                      <Icon name="chevron-down" size={13} />
                    </button>
                  )}
                />
              </>
            }
          />
        }
      >
        {children}
      </AppShell>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={commands}
        groupOrder={GROUPS}
        placeholder="Search users, tenants, scenarios"
        onSelect={(item) => {
          const [, to] = item.id.split(/:(.*)/s);
          navigate(to);
        }}
      />
      <Modal
        open={flags.idle === "warning"}
        onClose={() => setFlag("idle", "none")}
        title="Portal session locking"
        size="sm"
        icon="lock"
        tone="med"
        footer={
          <>
            <Button variant="quiet" onClick={() => navigate("/signin")}>
              Sign out now
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setFlag("idle", "none");
                toast.push({ title: "Session extended", detail: "Idle lock reset to 15 minutes.", tone: "success" });
              }}
            >
              Stay signed in
            </Button>
          </>
        }
      >
        <p>
          No activity for 14 minutes. The portal locks in <span className="rp-mono rp-num rp-strong">00:58</span> and you will need your password and a 2FA code to continue.
        </p>
      </Modal>
    </>
  );
}
