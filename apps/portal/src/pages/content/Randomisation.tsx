import { useState } from "react";
import { Badge, Button, Card, CopyButton, EmptyState, LoadingRegion, SCENARIO_TYPE_LABEL, Select, Skeleton, TierDot, TopologyDiagram, useToast } from "@rootpanther/ui";
import { generateInstance, randomisationFor } from "../../mock/content";
import type { ContentScenario, GeneratedInstance, RandKind } from "../../mock/content";

const KIND_LABEL: Record<RandKind, string> = { credential: "Credentials", flag: "Flags", hostname: "Hostnames", network: "Addressing" };
const KIND_ORDER: RandKind[] = ["credential", "flag", "hostname", "network"];

interface Props {
  scenario: ContentScenario | undefined;
  options: ContentScenario[];
  loading: boolean;
  onSelect: (slug: string) => void;
}

export function Randomisation({ scenario, options, loading, onSelect }: Props) {
  const toast = useToast();
  const [preview, setPreview] = useState<{ slug: string; inst: GeneratedInstance } | null>(null);
  const shown = preview && scenario && preview.slug === scenario.slug ? preview.inst : null;

  const picker = (
    <Select
      selectSize="sm"
      aria-label="Scenario"
      value={scenario?.slug ?? ""}
      onChange={(e) => onSelect(e.target.value)}
      placeholder="Choose a scenario"
      options={options.map((o) => ({ value: o.slug, label: o.name }))}
      className="cn-picker"
    />
  );

  if (loading) {
    return (
      <Card title="Per-deploy randomisation" padding="none">
        <LoadingRegion label="Loading randomisation config">
          <div className="cn-rand__skel">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="cn-rand__skelrow">
                <Skeleton width="18%" height={11} />
                <Skeleton width="12%" height={11} />
                <Skeleton width="20%" height={11} />
                <Skeleton width="24%" height={11} />
              </div>
            ))}
          </div>
        </LoadingRegion>
      </Card>
    );
  }

  if (!scenario) {
    return (
      <Card title="Per-deploy randomisation" actions={options.length ? picker : undefined} padding="none">
        <EmptyState icon="sliders" title={options.length ? "Choose a scenario" : "No scenarios to configure"} compact>
          Credentials, flags, hostnames and addressing are generated fresh for every tenant.
        </EmptyState>
      </Card>
    );
  }

  const fields = randomisationFor(scenario);
  const value = (id: string) => shown?.values.find((v) => v.id === id);
  const generate = () => {
    const inst = generateInstance(scenario, Math.floor(Math.random() * 0xffffffff));
    setPreview({ slug: scenario.slug, inst });
    toast.push({ title: `Preview generated for ${scenario.name}`, detail: `Seed ${inst.seed}. Nothing was deployed.`, tone: "info" });
  };

  return (
    <Card
      title="Per-deploy randomisation"
      className="cn-randcard"
      meta={
        <span className="cn-randmeta">
          <span className="rp-strong">{scenario.name}</span>
          <Badge>{SCENARIO_TYPE_LABEL[scenario.type]}</Badge>
          <TierDot tier={scenario.tier} display="code" size="sm" />
          <span className="rp-mono">{scenario.version}</span>
        </span>
      }
      actions={
        <>
          {picker}
          <Button size="sm" variant="secondary" iconLeft={shown ? "refresh" : "play"} onClick={generate}>
            {shown ? "Regenerate" : "Preview generated instance"}
          </Button>
        </>
      }
      padding="none"
    >
      <div className="cn-randwrap" role="region" aria-label={`Randomised values for ${scenario.name}`} tabIndex={0}>
        <table className={`cn-randtable${shown ? " has-preview" : ""}`}>
          <caption className="rp-sr">
            Randomised values for {scenario.name} {scenario.version}
            {shown ? `, with a generated preview for seed ${shown.seed}` : ""}
          </caption>
          <colgroup>
            <col className="cn-col-value" />
            <col className="cn-col-target" />
            <col className="cn-col-gen" />
            <col />
            {shown && <col className="cn-col-preview" />}
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Value</th>
              <th scope="col">Target</th>
              <th scope="col">Generator</th>
              <th scope="col">Constraint</th>
              {shown && (
                <th scope="col" className="cn-prevhead">
                  Generated, seed <span className="rp-mono">{shown.seed}</span>
                </th>
              )}
            </tr>
          </thead>
          {KIND_ORDER.map((k) => {
            const group = fields.filter((f) => f.kind === k);
            if (!group.length) return null;
            return (
              <tbody key={k}>
                <tr className="cn-randtable__group">
                  <th scope="rowgroup" colSpan={shown ? 5 : 4}>
                    {KIND_LABEL[k]} <span className="rp-mono rp-num">{group.length}</span>
                  </th>
                </tr>
                {group.map((f) => {
                  const v = value(f.id);
                  return (
                    <tr key={f.id}>
                      <th scope="row" className={f.kind === "flag" ? "rp-mono" : undefined}>
                        {f.label}
                      </th>
                      <td className="rp-mono">{f.target}</td>
                      <td className="rp-mono cn-gen" title={f.generator}>
                        {f.generator}
                      </td>
                      <td title={f.constraint}>{f.constraint}</td>
                      {shown && (
                        <td className="cn-prevcell">
                          {v && (
                            <span className="cn-prevval">
                              <span className="rp-mono" title={v.value}>
                                {v.value}
                              </span>
                              <CopyButton value={v.value} label={`Copy generated ${f.label}`} />
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            );
          })}
        </table>
      </div>
      <div className="cn-randtopo" aria-live="polite">
        <div className="cn-randtopo__head">
          <h3>{shown ? "Generated topology" : "Base topology"}</h3>
          <span className="cn-randtopo__note">
            {shown ? "Preview only. Nothing is deployed and these values are never issued to a learner." : "Hostnames and addresses change on every deploy."}
          </span>
        </div>
        <div className="cn-randtopo__fig">
          <TopologyDiagram
            hosts={shown ? shown.hosts : scenario.hosts}
            links={shown ? shown.links : scenario.links}
            label={shown ? `Generated topology for ${scenario.name}, seed ${shown.seed}` : `Base topology for ${scenario.name}`}
            showState={false}
            attackerLabel="Learner Kali"
          />
        </div>
      </div>
    </Card>
  );
}
