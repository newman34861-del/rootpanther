import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, ConfirmDialog, Icon, Skeleton, formatRelative } from "@rootpanther/ui";
import { ORPHAN_REASON, lastScanAt, orphanDetail } from "../../mock/fleet";
import type { Tenant } from "../../mock/fleet";
import { dur, perHour, usd } from "./util";

interface Props {
  orphans: Tenant[];
  loading: boolean;
  onCleanup: (ids: string[]) => void;
}

export function OrphanBlock({ orphans, loading, onCleanup }: Props) {
  const [confirm, setConfirm] = useState(false);
  const hourly = orphans.reduce((a, t) => a + t.hourly, 0);
  const burned = orphans.reduce((a, t) => a + (t.hourly * (t.orphan?.sinceMin ?? 0)) / 60, 0);
  const vms = orphans.reduce((a, t) => a + t.hostCount, 0);

  if (loading) {
    return (
      <section className="fl-orphans is-loading" aria-label="Idle and orphaned infrastructure" aria-busy="true">
        <div className="fl-orphans__head">
          <div>
            <Skeleton width={280} height={18} />
            <Skeleton width={360} height={11} style={{ marginTop: 10 }} />
          </div>
          <div className="fl-orphans__figs">
            <Skeleton width={96} height={40} />
            <Skeleton width={96} height={40} />
          </div>
        </div>
        <div className="fl-orphans__list">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="fl-orphan">
              <Skeleton width="80%" height={12} />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (orphans.length === 0) {
    return (
      <section id="orphaned" tabIndex={-1} className="fl-orphans is-clear" aria-labelledby="fl-orphans-title">
        <Icon name="check-circle" size={16} className="fl-orphans__okicon" />
        <h2 id="fl-orphans-title" className="fl-orphans__oktitle">
          No idle or orphaned tenants
        </h2>
        <span className="fl-orphans__scan">
          Last scan <span className="rp-mono rp-num">{formatRelative(lastScanAt)}</span>, every 5 minutes
        </span>
      </section>
    );
  }

  return (
    <section id="orphaned" tabIndex={-1} className="fl-orphans" aria-labelledby="fl-orphans-title">
      <div className="fl-orphans__head">
        <div className="fl-orphans__titles">
          <h2 id="fl-orphans-title">
            <Icon name="warning" size={16} className="fl-orphans__icon" />
            <span>
              <span className="rp-mono rp-num">{orphans.length}</span> idle or orphaned {orphans.length === 1 ? "tenant" : "tenants"} still running
            </span>
          </h2>
          <p>
            Past max life, past the idle limit, or with no session record. <span className="rp-mono rp-num">{vms}</span> VMs billed by Azure. Scanned{" "}
            <span className="rp-mono rp-num">{formatRelative(lastScanAt)}</span>.
          </p>
        </div>
        <dl className="fl-orphans__figs">
          <div>
            <dt>Burn rate</dt>
            <dd className="rp-mono rp-num">{perHour(hourly)}</dd>
          </div>
          <div>
            <dt>Burned so far</dt>
            <dd className="rp-mono rp-num">{usd(burned)}</dd>
          </div>
        </dl>
        <Button variant="destructive" iconLeft="trash" onClick={() => setConfirm(true)} className="fl-orphans__cta">
          Tear down {orphans.length} {orphans.length === 1 ? "tenant" : "tenants"}
        </Button>
      </div>
      <div className="fl-orphan fl-orphan--head" aria-hidden="true">
        <span>Tenant</span>
        <span>Scenario</span>
        <span>Reason</span>
        <span className="fl-orphan__num">Overdue</span>
        <span className="fl-orphan__num">Rate</span>
        <span className="fl-orphan__num">Burned</span>
      </div>
      <ul className="fl-orphans__list" aria-label="Orphaned tenants">
        {orphans.map((t) => (
          <li key={t.id} className="fl-orphan">
            <Link to={`/fleet?tenant=${t.id}`} className="fl-orphan__id rp-mono">
              {t.id}
            </Link>
            <span className="fl-orphan__scn">
              {t.scenarioName}
              <span className="rp-mono"> {t.region}</span>
            </span>
            <span className="fl-orphan__why">
              <span className="fl-orphan__reason">{ORPHAN_REASON[t.orphan!.reason]}</span>
              <span className="fl-orphan__detail" title={orphanDetail(t)}>
                {orphanDetail(t)}
              </span>
            </span>
            <span className="fl-orphan__num fl-orphan__since rp-mono rp-num">
              <span className="rp-sr">Overdue </span>
              {dur(t.orphan!.sinceMin)}
            </span>
            <span className="fl-orphan__num fl-orphan__rate rp-mono rp-num">
              <span className="rp-sr">Rate </span>
              {perHour(t.hourly)}
            </span>
            <span className="fl-orphan__num fl-orphan__burn rp-mono rp-num">
              <span className="rp-sr">Burned </span>
              {usd((t.hourly * t.orphan!.sinceMin) / 60)}
            </span>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        destructive
        title={`Tear down ${orphans.length} orphaned ${orphans.length === 1 ? "tenant" : "tenants"}`}
        confirmLabel={`Tear down and stop ${perHour(hourly)}`}
        requireText={`teardown ${orphans.length}`}
        onConfirm={() => {
          setConfirm(false);
          onCleanup(orphans.map((t) => t.id));
        }}
      >
        <p>
          Deletes <span className="rp-mono rp-strong">{orphans.length}</span> resource groups and <span className="rp-mono rp-strong">{vms}</span> VMs, stopping{" "}
          <span className="rp-mono rp-strong">{perHour(hourly)}</span> of spend. Stale locks are force-released first.
        </p>
        <ul className="fl-confirmlist">
          {orphans.map((t) => (
            <li key={t.id}>
              <span className="rp-mono">{t.id}</span>
              <span>{t.scenarioName}</span>
              <span className="rp-mono rp-num">{perHour(t.hourly)}</span>
            </li>
          ))}
        </ul>
        <p>No learner is connected to any of these tenants, and none of this time is charged to learners. This cannot be undone.</p>
      </ConfirmDialog>
    </section>
  );
}
