import { SCENARIO_TYPE_LABEL, TECHNIQUE_LABEL, TIER_NAMES } from "@rootpanther/ui";
import type { CommandItem, TechniqueFamily, Theme } from "@rootpanther/ui";
import { activeSession } from "../mock/account";
import { scenarios } from "../mock/scenarios";

export const COMMAND_GROUPS = ["Actions", "Navigation", "Scenarios", "Hosts in active lab", "Techniques", "Report sections", "Settings"];

const REPORT_SECTIONS = [
  ["rep-basalt", "Basalt", "Executive summary"],
  ["rep-basalt", "Basalt", "Methodology"],
  ["rep-basalt", "Basalt", "Findings: BSL-01"],
  ["rep-basalt", "Basalt", "Appendix: commands"],
  ["rep-meridian", "Meridian", "Findings: MER-WEB01"],
  ["rep-meridian", "Meridian", "Scope"],
];

export function buildCommands({ labActive, theme }: { labActive: boolean; theme: Theme }): CommandItem[] {
  const items: CommandItem[] = [];
  if (labActive) {
    items.push({ id: "action:resume", label: `Resume ${activeSession.scenarioName}`, group: "Actions", icon: "play", hint: "Running", keywords: ["lab", "continue", "terminal"] });
    items.push({ id: "action:extend", label: "Extend session", group: "Actions", icon: "clock", keywords: ["time", "lab"] });
  } else {
    items.push({ id: "action:launch-recommended", label: "Launch Ironwood", group: "Actions", icon: "play", hint: "Recommended", keywords: ["start", "lab"] });
  }
  items.push(
    { id: "action:openvpn", label: "Download OpenVPN profile", group: "Actions", icon: "download", keywords: ["vpn", "ovpn", "tunnel", "kali"] },
    { id: "action:theme", label: theme === "dark" ? "Switch to light theme" : "Switch to dark theme", group: "Actions", icon: theme === "dark" ? "sun" : "moon", keywords: ["appearance", "mode"] },
    { id: "action:new-report", label: "New report", group: "Actions", icon: "plus", keywords: ["write", "document"] },
    { id: "action:sidebar", label: "Toggle sidebar", group: "Actions", icon: "panel-left", kbd: "[" },
  );
  const nav: [string, string, CommandItem["icon"]][] = [
    ["/", "Home", "home"],
    ["/catalogue", "Catalogue", "grid"],
    ["/path", "My Path", "route"],
    ["/labs", "Labs", "flask"],
    ["/reports", "Reports", "document"],
    ["/onyx", "Ask Onyx", "chat"],
    ["/billing", "Billing & plan", "card"],
  ];
  nav.forEach(([to, label, icon]) => items.push({ id: `nav:${to}`, label, group: "Navigation", icon }));
  scenarios.forEach((s) =>
    items.push({
      id: `scenario:/catalogue/${s.slug}`,
      label: s.name,
      group: "Scenarios",
      icon: "flask",
      hint: `${SCENARIO_TYPE_LABEL[s.type]} · ${s.tier} ${TIER_NAMES[s.tier]}`,
      keywords: [s.domain, s.objective, ...s.techniques.map((t) => TECHNIQUE_LABEL[t])],
    }),
  );
  if (labActive) {
    activeSession.hosts.forEach((h) =>
      items.push({ id: `host:${h.ip}`, label: `${h.name}  ${h.ip}`, group: "Hosts in active lab", icon: "server", hint: "Copy IP", mono: true, keywords: [h.role] }),
    );
  }
  (Object.keys(TECHNIQUE_LABEL) as TechniqueFamily[]).forEach((t) =>
    items.push({ id: `technique:${t}`, label: TECHNIQUE_LABEL[t], group: "Techniques", icon: "filter", hint: "Filter catalogue" }),
  );
  REPORT_SECTIONS.forEach(([id, scen, section]) =>
    items.push({ id: `section:/reports/${id}?section=${encodeURIComponent(section)}`, label: `${scen}: ${section}`, group: "Report sections", icon: "document" }),
  );
  const settings: [string, string][] = [
    ["/settings/preferences", "Preferences"],
    ["/settings/security", "Security and two-factor"],
    ["/settings/lab-defaults", "Lab defaults"],
    ["/account/profile", "Profile"],
  ];
  settings.forEach(([to, label]) => items.push({ id: `settings:${to}`, label, group: "Settings", icon: "sliders" }));
  return items;
}
