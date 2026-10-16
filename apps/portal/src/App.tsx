import { Suspense, lazy, useEffect } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
import { LoadingRegion, Page, Skeleton, useTheme } from "@rootpanther/ui";
import { PortalShell } from "./shell/PortalShell";
import { ReviewPanel } from "./review/review";

const OverviewPage = lazy(() => import("./pages/overview/OverviewPage"));
const UsersPage = lazy(() => import("./pages/users/UsersPage"));
const UserDetailPage = lazy(() => import("./pages/users/UserDetailPage"));
const BillingOpsPage = lazy(() => import("./pages/billing/BillingOpsPage"));
const FleetPage = lazy(() => import("./pages/fleet/FleetPage"));
const ContentPage = lazy(() => import("./pages/content/ContentPage"));
const OnyxOpsPage = lazy(() => import("./pages/onyx-ops/OnyxOpsPage"));
const FinancePage = lazy(() => import("./pages/finance/FinancePage"));
const SystemPage = lazy(() => import("./pages/system/SystemPage"));
const OperatorSignInPage = lazy(() => import("./auth/OperatorSignInPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

function PageFallback() {
  return (
    <Page width="full">
      <LoadingRegion label="Loading page">
        <div className="rp-stack" style={{ ["--gap" as string]: "16px" }}>
          <Skeleton width={220} height={22} />
          <div className="rp-grid" style={{ ["--cols" as string]: 4 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={104} radius="lg" />
            ))}
          </div>
          <Skeleton height={320} radius="lg" />
        </div>
      </LoadingRegion>
    </Page>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function App() {
  const theme = useTheme("rp-portal-theme");
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route
          element={
            <PortalShell theme={theme.resolved} onToggleTheme={theme.toggle}>
              <Suspense fallback={<PageFallback />}>
                <Outlet />
              </Suspense>
            </PortalShell>
          }
        >
          <Route path="/" element={<OverviewPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/users/:id" element={<UserDetailPage />} />
          <Route path="/billing" element={<BillingOpsPage />} />
          <Route path="/fleet" element={<FleetPage />} />
          <Route path="/content" element={<ContentPage />} />
          <Route path="/onyx" element={<OnyxOpsPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route
          element={
            <Suspense fallback={null}>
              <Outlet />
            </Suspense>
          }
        >
          <Route path="/signin" element={<OperatorSignInPage />} />
          <Route path="/signin/:step" element={<OperatorSignInPage />} />
        </Route>
      </Routes>
      <ReviewPanel theme={theme.preference} onTheme={theme.setPreference} />
    </>
  );
}
