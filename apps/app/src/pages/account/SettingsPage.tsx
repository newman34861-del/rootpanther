import { Navigate, useParams, useSearchParams } from "react-router-dom";
import { Card, ErrorState, Page, PageHeader, Tabs } from "@rootpanther/ui";
import { useDataState } from "../../review/review";
import { LabDefaultsTab } from "./LabDefaultsTab";
import { PreferencesTab } from "./PreferencesTab";
import { SecurityTab } from "./SecurityTab";
import { PageSkeleton } from "./parts";
import "./account.css";

type TabId = "preferences" | "security" | "lab-defaults";

const TABS: { id: TabId; label: string }[] = [
  { id: "preferences", label: "Preferences" },
  { id: "security", label: "Security" },
  { id: "lab-defaults", label: "Lab defaults" },
];

const SKELETON: Record<TabId, number[]> = {
  preferences: [2, 1, 2],
  security: [3, 2],
  "lab-defaults": [1, 1, 1],
};

export default function SettingsPage() {
  const { tab } = useParams();
  const state = useDataState();
  const [params, setParams] = useSearchParams();
  const current = TABS.find((t) => t.id === tab);
  if (!current) return <Navigate to="/settings/preferences" replace />;

  let body;
  if (state === "loading") {
    body = <PageSkeleton cards={SKELETON[current.id]} />;
  } else if (state === "error") {
    body = (
      <Card>
        <ErrorState
          title="Settings did not load"
          reference="req_77d0a4"
          onRetry={() => {
            params.delete("state");
            setParams(params, { replace: true });
          }}
        >
          We could not reach the settings service. Your current settings still apply to labs.
        </ErrorState>
      </Card>
    );
  } else if (current.id === "preferences") {
    body = <PreferencesTab />;
  } else if (current.id === "security") {
    body = <SecurityTab loading={false} />;
  } else {
    body = <LabDefaultsTab />;
  }

  return (
    <Page>
      <PageHeader title="Settings" crumbs={[{ label: "Account" }, { label: "Settings" }, { label: current.label }]}>
        <Tabs label="Settings sections" value={current.id} items={TABS.map((t) => ({ ...t, to: `/settings/${t.id}` }))} />
      </PageHeader>
      <div className="ac-panel rp-view" key={current.id}>
        {body}
      </div>
    </Page>
  );
}
