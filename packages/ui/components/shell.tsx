import { useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { Icon } from "../icons";
import type { IconName } from "../icons";
import { cx } from "../format";
import { useEscape, useFocusTrap } from "../hooks";
import { UiLink } from "./Link";
import { Tooltip } from "./Tooltip";

export interface AppShellProps {
  topbar: ReactNode;
  sidebar: ReactNode;
  banner?: ReactNode;
  collapsed?: boolean;
  mobileNavOpen?: boolean;
  onMobileNavClose?: () => void;
  children: ReactNode;
  variant?: "app" | "portal";
}

export function AppShell({ topbar, sidebar, banner, collapsed, mobileNavOpen, onMobileNavClose, children, variant = "app" }: AppShellProps) {
  const top = useRef<HTMLDivElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const drawer = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = top.current;
    const root = shell.current;
    if (!el || !root) return;
    const set = () => root.style.setProperty("--chrome-h", `${el.getBoundingClientRect().height}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useFocusTrap(drawer, !!mobileNavOpen);
  useEscape(!!mobileNavOpen, () => onMobileNavClose?.());

  return (
    <div ref={shell} className={cx("rp-shell", `rp-shell--${variant}`, collapsed && "is-collapsed")}>
      <a className="rp-skip" href="#main">
        Skip to content
      </a>
      <div ref={top} className="rp-chrome-top">
        {banner}
        {topbar}
      </div>
      <div className="rp-sidebar-slot">{sidebar}</div>
      {mobileNavOpen && (
        <div className="rp-scrim rp-scrim--nav" onPointerDown={(e) => e.target === e.currentTarget && onMobileNavClose?.()}>
          <div ref={drawer} className="rp-navdrawer" role="dialog" aria-modal="true" aria-label="Navigation">
            {sidebar}
          </div>
        </div>
      )}
      <main id="main" className="rp-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

export interface TopBarProps {
  brand: ReactNode;
  center?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
}

export function TopBar({ brand, center, actions, leading }: TopBarProps) {
  return (
    <header className="rp-topbar">
      <div className="rp-topbar__brand">
        {leading}
        {brand}
      </div>
      <div className="rp-topbar__center">{center}</div>
      <div className="rp-topbar__actions">{actions}</div>
    </header>
  );
}

export function SearchTrigger({ onOpen, label = "Search or run a command", shortcut = "⌘K" }: { onOpen: () => void; label?: string; shortcut?: string }) {
  return (
    <button type="button" className="rp-searchtrigger" onClick={onOpen} aria-keyshortcuts="Meta+K Control+K">
      <Icon name="search" size={15} />
      <span className="rp-searchtrigger__label">{label}</span>
      <kbd className="rp-searchtrigger__kbd">{shortcut}</kbd>
    </button>
  );
}

export interface SidebarProps {
  children: ReactNode;
  footer?: ReactNode;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  label?: string;
}

export function Sidebar({ children, footer, collapsed, onToggleCollapsed, label = "Primary" }: SidebarProps) {
  return (
    <nav className={cx("rp-sidebar", collapsed && "is-collapsed")} aria-label={label}>
      <div className="rp-sidebar__scroll">{children}</div>
      <div className="rp-sidebar__foot">
        {footer}
        {onToggleCollapsed && (
          <button
            type="button"
            className="rp-sidebar__collapse"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-pressed={collapsed}
          >
            <Icon name="panel-left" size={15} />
            {!collapsed && <span>Collapse</span>}
            {!collapsed && <kbd>[</kbd>}
          </button>
        )}
      </div>
    </nav>
  );
}

export interface NavItemProps {
  to: string;
  icon: IconName;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  count?: number;
  external?: boolean;
  status?: ReactNode;
  onNavigate?: () => void;
}

export function NavItem({ to, icon, label, active, collapsed, count, external, status, onNavigate }: NavItemProps) {
  const link = (
    <UiLink
      to={to}
      className={cx("rp-nav__item", active && "is-active")}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? label : undefined}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      onClick={onNavigate}
    >
      <Icon name={icon} size={16} />
      {!collapsed && <span className="rp-nav__label">{label}</span>}
      {!collapsed && status}
      {!collapsed && count !== undefined && <span className="rp-nav__count rp-mono rp-num">{count}</span>}
      {!collapsed && external && <Icon name="external" size={12} className="rp-nav__ext" />}
    </UiLink>
  );
  return (
    <li>
      {collapsed ? (
        <Tooltip content={label} side="right">
          {link}
        </Tooltip>
      ) : (
        link
      )}
    </li>
  );
}

export function NavGroup({ label, children, collapsed }: { label?: string; children: ReactNode; collapsed?: boolean }) {
  return (
    <div className="rp-nav__group">
      {label && (collapsed ? <div className="rp-nav__sep" role="separator" /> : <div className="rp-nav__grouplabel">{label}</div>)}
      <ul className="rp-nav__list">{children}</ul>
    </div>
  );
}

export interface BannerProps {
  tone: "crit" | "med" | "info" | "premium";
  icon?: IconName;
  children: ReactNode;
  action?: ReactNode;
}

export function Banner({ tone, icon, children, action }: BannerProps) {
  const style = { "--tone": `var(--${tone === "premium" ? "premium" : tone})` } as CSSProperties;
  return (
    <div className={cx("rp-banner", `rp-banner--${tone}`)} role={tone === "crit" ? "alert" : "status"} style={style}>
      <Icon name={icon ?? (tone === "crit" ? "warning" : "info")} size={15} />
      <div className="rp-banner__text">{children}</div>
      {action && <div className="rp-banner__action">{action}</div>}
    </div>
  );
}

export function useBodyClass(cls: string, active = true) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add(cls);
    return () => document.body.classList.remove(cls);
  }, [cls, active]);
}
