import { useParams } from "react-router-dom";
import { Page, PageHeader, Tabs } from "@rootpanther/ui";
import { useDataState } from "../../review/review";
import { OnyxMentor } from "./OnyxMentor";
import { OnyxPrimers } from "./OnyxPrimers";
import { OnyxDrills } from "./OnyxDrills";
import { OnyxPlaybooks } from "./OnyxPlaybooks";
import { OnyxHistory } from "./OnyxHistory";
import "./onyx.css";

type Tab = "mentor" | "primers" | "drills" | "playbooks" | "history";

const TABS: { id: Tab; label: string; to: string }[] = [
  { id: "mentor", label: "Mentor", to: "/onyx" },
  { id: "primers", label: "Primers", to: "/onyx/primers" },
  { id: "drills", label: "Drills", to: "/onyx/drills" },
  { id: "playbooks", label: "Playbooks", to: "/onyx/playbooks" },
  { id: "history", label: "History", to: "/onyx/history" },
];

export default function OnyxPage() {
  const { tab } = useParams();
  const state = useDataState();
  const active: Tab = (TABS.find((t) => t.id === tab)?.id ?? "mentor") as Tab;

  return (
    <Page width={active === "mentor" ? "full" : "reading"}>
      <PageHeader title="Ask Onyx" />
      <Tabs className="ox-tabs" label="Onyx sections" value={active} items={TABS.map((t) => ({ id: t.id, label: t.label, to: t.to }))} />
      {active === "mentor" && <OnyxMentor state={state} />}
      {active === "primers" && <OnyxPrimers state={state} />}
      {active === "drills" && <OnyxDrills state={state} />}
      {active === "playbooks" && <OnyxPlaybooks state={state} />}
      {active === "history" && <OnyxHistory state={state} />}
    </Page>
  );
}
