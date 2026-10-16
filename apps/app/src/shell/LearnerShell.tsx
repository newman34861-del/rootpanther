import { useCallback, useEffect, useMemo, useState } from "react";
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
  NavGroup,
  NavItem,
  Popover,
  SearchTrigger,
  Sidebar,
  StatusDot,
  TIER_NAMES,
  TierDot,
  TopBar,
  cx,
  formatRelative,
  isTypingTarget,
  toneVar,
  useMediaQuery,
  useStoredState,
  useToast,
} from "@rootpanther/ui";
import type { CommandItem, IconName, MenuItem, Notification, Theme } from "@rootpanther/ui";
import { currentUser, notifications as mockNotifications } from "../mock/account";
import { dayMonth, failedPayment } from "../mock/billing";
import { useReview } from "../review/review";
import { buildCommands, COMMAND_GROUPS } from "./commands";
import "./shell.css";

export const PORTAL_URL = import.meta.env.VITE_PORTAL_URL ?? "https://portal.rootpanther.com";

const NAV: { to: string; icon: IconName; label: string; match: (p: string) => boolean }[] = [
  { to: "/", icon: "home", label: "Home", match: (p) => p === "/" },
  { to: "/catalogue", icon: "grid", label: "Catalogue", match: (p) => p.startsWith("/catalogue") },
  { to: "/path", icon: "route", label: "My Path", match: (p) => p.startsWith("/path") },
  { to: "/labs", icon: "flask", label: "Labs", match: (p) => p.startsWith("/labs") },
  { to: "/reports", icon: "document", label: "Reports", match: (p) => p.startsWith("/reports") },
];

function PathChip({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const next = "C3";
  return (
    <Link to="/path" className={cx("ls-pathchip", collapsed && "is-collapsed")} aria-label={`My Path: ${currentUser.tier} ${TIER_NAMES[currentUser.tier]}`} onClick={onNavigate}>
      {collapsed ? (
        <TierDot tier={currentUser.tier} display="code" size="sm" />
      ) : (
        <>
          <span className="ls-pathchip__row">
            <span className="ls-pathchip__label">Path</span>
            <span className="ls-pathchip__next rp-mono">
              3/5 to {next}
            </span>
          </span>
          <TierDot tier={currentUser.tier} />
          <span className="ls-pathchip__bar" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={cx(i < 3 && "is-on")} />
            ))}
          </span>
        </>
      )}
    </Link>
  );
}

function NotificationsButton() {
  const [items, setItems] = useState<Notification[]>(mockNotifications);
  const unread = items.filter((n) => !n.read).length;
  const navigate = useNavigate();
  return (
    <Popover
      align="end"
      width={360}
      label="Notifications"
      trigger={(p) => <IconButton {...p} icon="bell" label="Notifications" variant="chrome" badge={unread || undefined} />}
    >
      {(close) => (
        <div className="ls-notes">
          <div className="ls-notes__head">
            <h2>Notifications</h2>
            {unread > 0 && (
              <button type="button" className="rp-link rp-small" onClick={() => setItems(items.map((n) => ({ ...n, read: true })))}>
                Mark all read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <div className="ls-notes__empty">No notifications.</div>
          ) : (
            <ul className="ls-notes__list">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={cx("ls-notes__item", !n.read && "is-unread")}
                    onClick={() => {
                      setItems(items.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
                      close();
                      if (n.href) navigate(n.href);
                    }}
                  >
                    <span className="ls-notes__dot" style={{ background: n.read ? "transparent" : toneVar(n.tone ?? "primary") }} aria-hidden="true" />
                    <span className="ls-notes__body">
                      <span className="ls-notes__title">{n.title}</span>
                      {n.detail && <span className="ls-notes__detail">{n.detail}</span>}
                    </span>
                    <time className="ls-notes__time rp-mono" dateTime={n.at}>
                      {formatRelative(n.at)}
                    </time>
                    {!n.read && <span className="rp-sr">Unread</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Popover>
  );
}

export interface LearnerShellProps {
  children: ReactNode;
  theme: Theme;
  onToggleTheme: () => void;
}

export function LearnerShell({ children, theme, onToggleTheme }: LearnerShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { flags, setFlag } = useReview();
  const [collapsedPref, setCollapsedPref] = useStoredState("rp-sidebar-collapsed", false);
  const tablet = useMediaQuery("(max-width: 1023px)");
  const mobile = useMediaQuery("(max-width: 767px)");
  const collapsed = mobile ? false : tablet ? true : collapsedPref;
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [recent, setRecent] = useStoredState<string[]>("rp-palette-recent", ["action:resume", "nav:/labs", "scenario:ironwood"]);
  const isOperator = flags.role === "operator";
  const labActive = flags.lab === "active";

  useEffect(() => setNavOpen(false), [location.pathname]);

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

  const commands = useMemo(() => buildCommands({ labActive, theme }), [labActive, theme]);

  const runCommand = useCallback(
    (item: CommandItem) => {
      setRecent([item.id, ...recent.filter((r) => r !== item.id)].slice(0, 5));
      const [kind, value] = item.id.split(/:(.*)/s);
      if (kind === "nav" || kind === "scenario" || kind === "section" || kind === "settings") navigate(value);
      else if (kind === "technique") navigate(`/catalogue?technique=${value}`);
      else if (kind === "host") {
        navigator.clipboard?.writeText(value).catch(() => undefined);
        toast.push({ title: `Copied ${value}`, tone: "primary" });
      } else if (item.id === "action:theme") onToggleTheme();
      else if (item.id === "action:resume") navigate("/lab/ses_4QmX9a");
      else if (item.id === "action:openvpn") toast.push({ title: "rootpanther-lab.ovpn downloaded", detail: "Run sudo openvpn rootpanther-lab.ovpn", tone: "success" });
      else if (item.id === "action:extend") navigate("/labs#extend");
      else if (item.id === "action:new-report") navigate("/reports?new=1");
      else if (item.id === "action:launch-recommended") navigate("/catalogue/tamarack");
      else if (item.id === "action:sidebar") setCollapsedPref(!collapsedPref);
    },
    [navigate, onToggleTheme, recent, setRecent, toast, collapsedPref, setCollapsedPref],
  );

  const accountItems: MenuItem[] = [
    { id: "profile", label: "Profile", icon: "user", to: "/account/profile" },
    { id: "billing", label: "Billing & plan", icon: "card", to: "/billing" },
    { id: "settings", label: "Settings", icon: "sliders", to: "/settings/preferences" },
    ...(isOperator ? ([{ id: "d1", divider: true }, { id: "portal", label: "Portal", icon: "shield", to: PORTAL_URL, external: true, meta: "Operators" }] as MenuItem[]) : []),
    { id: "d2", divider: true },
    { id: "signout", label: "Sign out", icon: "logout", to: "/signin" },
  ];

  const banner =
    flags.banner === "impersonation" ? (
      <Banner
        tone="med"
        icon="eye"
        action={
          <Button size="sm" variant="secondary" onClick={() => setFlag("banner", "none")}>
            Exit impersonation
          </Button>
        }
      >
        <span className="rp-strong">Impersonation.</span> Operator <span className="rp-mono">priya@rootpanther.com</span> is viewing this account as {currentUser.name}. Every action is written to the audit log.
      </Banner>
    ) : flags.banner === "dunning" ? (
      <Banner
        tone="crit"
        icon="card"
        action={
          <Button size="sm" variant="secondary" onClick={() => navigate("/billing/payment-failed")}>
            Fix payment method
          </Button>
        }
      >
        <span className="rp-strong">Payment failed on {dayMonth(failedPayment.failedAt)}.</span> Your access continues until {dayMonth(failedPayment.accessPausesOn)} while we retry the card ending 4417.
      </Banner>
    ) : null;

  const sidebar = (
    <Sidebar
      collapsed={collapsed}
      onToggleCollapsed={tablet ? undefined : () => setCollapsedPref(!collapsedPref)}
      footer={<PathChip collapsed={collapsed} onNavigate={() => setNavOpen(false)} />}
    >
      <NavGroup collapsed={collapsed}>
        {NAV.map((n) => (
          <NavItem
            key={n.to}
            to={n.to}
            icon={n.icon}
            label={n.label}
            active={n.match(location.pathname)}
            collapsed={collapsed}
            status={n.to === "/labs" && labActive ? <StatusDot tone="primary" size="sm" title="A lab is running" /> : undefined}
          />
        ))}
      </NavGroup>
      <NavGroup label="Trainer" collapsed={collapsed}>
        <NavItem to="/onyx" icon="chat" label="Ask Onyx" active={location.pathname.startsWith("/onyx")} collapsed={collapsed} />
      </NavGroup>
    </Sidebar>
  );

  return (
    <>
      <AppShell
        collapsed={collapsed}
        banner={banner}
        mobileNavOpen={navOpen}
        onMobileNavClose={() => setNavOpen(false)}
        sidebar={sidebar}
        topbar={
          <TopBar
            leading={mobile ? <IconButton icon="menu" label="Open navigation" variant="chrome" onClick={() => setNavOpen(true)} tooltip={false} /> : undefined}
            brand={
              <Link to="/" aria-label="Rootpanther home">
                <Lockup collapsed={collapsed && !mobile} size={mobile ? "sm" : "md"} />
              </Link>
            }
            center={<SearchTrigger onOpen={() => setPaletteOpen(true)} />}
            actions={
              <>
                <IconButton icon={theme === "dark" ? "sun" : "moon"} label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} variant="chrome" onClick={onToggleTheme} />
                <NotificationsButton />
                <DropdownMenu
                  label="Account"
                  width={260}
                  items={accountItems}
                  header={
                    <div className="ls-acct">
                      <Avatar initials={currentUser.initials} size={32} />
                      <div className="ls-acct__text">
                        <span className="ls-acct__name">{currentUser.name}</span>
                        <span className="ls-acct__email">{currentUser.email}</span>
                      </div>
                    </div>
                  }
                  trigger={(p) => (
                    <button {...p} type="button" className="rp-topbar__avatarbtn" aria-label={`Account menu for ${currentUser.name}`}>
                      <Avatar initials={currentUser.initials} size={28} />
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
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={commands} recentIds={recent} onSelect={runCommand} groupOrder={COMMAND_GROUPS} />
    </>
  );
}
