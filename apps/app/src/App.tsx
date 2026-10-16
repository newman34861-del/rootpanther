import { Suspense, lazy, useEffect } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { Page, Skeleton, SkeletonText, LoadingRegion } from "@rootpanther/ui";
import { useAppTheme } from "./theme";
import { LearnerShell } from "./shell/LearnerShell";
import { ReviewPanel } from "./review/review";
import { NotFoundPage } from "./pages/NotFoundPage";

function page<T extends ComponentType>(load: () => Promise<{ default: T }>): LazyExoticComponent<T> {
  return lazy(load);
}

const HomePage = page(() => import("./pages/home/HomePage"));
const CataloguePage = page(() => import("./pages/catalogue/CataloguePage"));
const ScenarioDetailPage = page(() => import("./pages/catalogue/ScenarioDetailPage"));
const PathPage = page(() => import("./pages/path/PathPage"));
const LabsPage = page(() => import("./pages/labs/LabsPage"));
const ReportsPage = page(() => import("./pages/reports/ReportsPage"));
const ReportBuilderPage = page(() => import("./pages/reports/ReportBuilderPage"));
const DebriefPage = page(() => import("./pages/reports/DebriefPage"));
const OnyxPage = page(() => import("./pages/onyx/OnyxPage"));
const LabView = page(() => import("./pages/lab/LabView"));
const ProfilePage = page(() => import("./pages/account/ProfilePage"));
const SettingsPage = page(() => import("./pages/account/SettingsPage"));
const BillingPage = page(() => import("./billing/BillingPage"));
const PaymentFailedPage = page(() => import("./billing/PaymentFailedPage"));
const PricingPage = page(() => import("./billing/PricingPage"));
const CheckoutPage = page(() => import("./billing/CheckoutPage"));
const CheckoutResultPage = page(() => import("./billing/CheckoutResultPage"));
const SignInPage = page(() => import("./auth/SignInPage"));
const SignUpPage = page(() => import("./auth/SignUpPage"));
const VerifyEmailPage = page(() => import("./auth/VerifyEmailPage"));
const PasswordResetPage = page(() => import("./auth/PasswordResetPage"));
const TwoFactorPage = page(() => import("./auth/TwoFactorPage"));
const OnboardingPage = page(() => import("./auth/OnboardingPage"));
const KitPage = page(() => import("./pages/kit/KitPage"));

function PageFallback() {
  return (
    <Page>
      <LoadingRegion label="Loading page">
        <div className="rp-stack" style={{ ["--gap" as string]: "16px" }}>
          <Skeleton width={220} height={22} />
          <Skeleton height={140} radius="lg" />
          <SkeletonText lines={3} />
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
  const theme = useAppTheme();
  const shell = (
    <LearnerShell theme={theme.resolved} onToggleTheme={theme.toggle}>
      <Suspense fallback={<PageFallback />}>
        <Outlet />
      </Suspense>
    </LearnerShell>
  );
  const bare = (
    <Suspense fallback={null}>
      <Outlet />
    </Suspense>
  );

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={shell}>
          <Route path="/" element={<HomePage />} />
          <Route path="/catalogue" element={<CataloguePage />} />
          <Route path="/catalogue/:slug" element={<ScenarioDetailPage />} />
          <Route path="/path" element={<PathPage />} />
          <Route path="/labs" element={<LabsPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/debriefs/:id" element={<DebriefPage />} />
          <Route path="/reports/:id" element={<ReportBuilderPage />} />
          <Route path="/onyx" element={<OnyxPage />} />
          <Route path="/onyx/:tab" element={<OnyxPage />} />
          <Route path="/account/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<Navigate to="/settings/preferences" replace />} />
          <Route path="/settings/:tab" element={<SettingsPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/billing/payment-failed" element={<PaymentFailedPage />} />
          <Route path="/kit" element={<KitPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route element={bare}>
          <Route path="/lab/:sessionId" element={<LabView />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/checkout/:result" element={<CheckoutResultPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/verify" element={<VerifyEmailPage />} />
          <Route path="/reset" element={<PasswordResetPage />} />
          <Route path="/reset/:step" element={<PasswordResetPage />} />
          <Route path="/2fa" element={<TwoFactorPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>
      </Routes>
      <ReviewPanel theme={theme.preference} onTheme={theme.setPreference} />
    </>
  );
}
