import { useEffect, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { Lockup, applyTheme, cx } from "@rootpanther/ui";
import { useAppTheme } from "../theme";
import { AuthArt } from "./AuthArt";
import "./auth.css";

const AUTH_PATHS = /^\/(signin|signup|verify|reset|2fa|onboarding)(\/|$)/;

function prefetchAuthRoutes() {
  void import("./SignInPage");
  void import("./SignUpPage");
  void import("./VerifyEmailPage");
  void import("./PasswordResetPage");
  void import("./TwoFactorPage");
  void import("./OnboardingPage");
}

export interface AuthLayoutProps {
  children: ReactNode;
  wide?: boolean;
}

export function AuthLayout({ children, wide }: AuthLayoutProps) {
  const { resolved } = useAppTheme();
  const resolvedRef = useRef(resolved);
  resolvedRef.current = resolved;

  useLayoutEffect(() => {
    const html = document.documentElement;
    html.removeAttribute("data-theme");
    // The theme provider re-applies data-theme whenever the preference changes, so hold it off while auth is mounted.
    const observer = new MutationObserver(() => {
      if (html.hasAttribute("data-theme")) html.removeAttribute("data-theme");
    });
    observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      observer.disconnect();
      // Skip the restore when moving between auth screens so the lazy route swap does not flash the light theme.
      if (!AUTH_PATHS.test(window.location.pathname)) applyTheme(resolvedRef.current);
    };
  }, []);

  useEffect(prefetchAuthRoutes, []);

  const year = new Date().getFullYear();

  return (
    <div className={cx("au", wide && "is-wide")}>
      <main className="au__main" id="main">
        <div className="au__center">
          <div className="au-card">{children}</div>
        </div>
        <footer className="au__foot">
          <span className="rp-num">© {year} Rootpanther</span>
          <nav aria-label="Legal" className="au__legal">
            <a href="https://rootpanther.com/terms">Terms</a>
            <a href="https://rootpanther.com/privacy">Privacy</a>
            <a href="https://rootpanther.com/help">Help</a>
          </nav>
        </footer>
      </main>
      <div className="au__aside" aria-hidden="true">
        <div className="au__art">
          <AuthArt />
        </div>
        <div className="au__scrim" />
      </div>
    </div>
  );
}

export interface AuthHeaderProps {
  title: ReactNode;
  sub?: ReactNode;
  focusOnMount?: boolean;
  brand?: boolean;
}

export function AuthHeader({ title, sub, focusOnMount, brand = true }: AuthHeaderProps) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus({ preventScroll: true });
  }, [focusOnMount]);
  return (
    <header className="au-head">
      {brand && <Lockup size="md" tagline="OSCP lab training" className="au-head__brand" />}
      <div className="au-head__titles">
        <h1 ref={ref} tabIndex={-1} className="au-head__title">
          {title}
        </h1>
        {sub && <p className="au-head__sub">{sub}</p>}
      </div>
    </header>
  );
}
