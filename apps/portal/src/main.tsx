import { StrictMode, forwardRef } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter, Link, MemoryRouter } from "react-router-dom";
import { LinkProvider, ToastProvider } from "@rootpanther/ui";
import type { UiLinkProps } from "@rootpanther/ui";
import "@rootpanther/ui/styles.css";
import { App } from "./App";
import { ReviewProvider } from "./review/review";

const RouterLink = forwardRef<HTMLAnchorElement, UiLinkProps>(function RouterLink({ to, ...rest }, ref) {
  return <Link ref={ref} to={to} {...rest} />;
});

const Router = import.meta.env.VITE_ROUTER === "hash" ? HashRouter : import.meta.env.VITE_ROUTER === "memory" ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Router>
      <LinkProvider component={RouterLink}>
        <ToastProvider>
          <ReviewProvider>
            <App />
          </ReviewProvider>
        </ToastProvider>
      </LinkProvider>
    </Router>
  </StrictMode>,
);
