import Link from 'next/link';
import { Users, IndianRupee, TrendingUp, Wallet, Percent, Building2, ArrowRight } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { getDashboardData, type Point, type FunnelStage } from '@/lib/admin/analytics';
import { statusLabel } from '@/lib/admin/pipeline';
import { auditActionLabel } from '@/lib/admin/audit';
import { fmtMoney, fmtDateTime } from '@/lib/admin/format';
import styles from './dashboard.module.css';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage() {
  const admin = await getAdminSession();
  const name = admin?.name ?? 'there';

  // Agents don't have the dashboard capability — show them a simple landing
  // that points to the one thing they can do.
  if (!admin || !can(admin.role, 'dashboard')) {
    return (
      <div className={styles.wrap}>
        <h1 className={styles.title}>Welcome back, {name}</h1>
        <p className={styles.sub}>Head to your leads to get started.</p>
        <Link href="/admin/leads" className={styles.agentCta}>
          Go to Leads <ArrowRight size={16} />
        </Link>
      </div>
    );
  }

  const d = await getDashboardData();

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.sub}>Welcome back, {name}</p>
      </header>

      {/* ── KPI cards ── */}
      <section className={styles.kpis} aria-label="Key metrics">
        <Kpi icon={<Users size={18} />} label="Total leads" value={String(d.kpis.totalLeads)} sub={`${d.kpis.drafts} drafts in progress`} />
        <Kpi icon={<TrendingUp size={18} />} label="Disbursed loans" value={String(d.kpis.disbursedCount)} sub={fmtMoney(d.kpis.disbursedTotal)} />
        <Kpi icon={<Wallet size={18} />} label="Disbursed this month" value={fmtMoney(d.kpis.disbursedThisMonth)} />
        <Kpi icon={<IndianRupee size={18} />} label="Est. commission" value={fmtMoney(d.kpis.estimatedCommission)} sub="from disbursed × rate" />
        <Kpi icon={<Percent size={18} />} label="Conversion" value={`${(d.kpis.conversionRate * 100).toFixed(1)}%`} sub="leads → disbursed" />
        <Kpi icon={<Building2 size={18} />} label="Active lenders" value={String(d.kpis.activeLenders)} />
      </section>

      {/* ── Charts ── */}
      <section className={styles.charts}>
        <div className={`${styles.card} ${styles.spanWide}`}>
          <h2 className={styles.cardTitle}>Leads over time</h2>
          <p className={styles.cardHint}>Last 30 days</p>
          <LineChart points={d.leadsOverTime} />
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Funnel</h2>
          <Funnel stages={d.funnel} />
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>By status</h2>
          <BarList points={d.byStatus.map((p) => ({ label: statusLabel(p.label), value: p.value }))} tone="forest" />
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>By loan type</h2>
          {d.byLoanType.length ? <BarList points={d.byLoanType} tone="blue" /> : <Empty />}
        </div>

        <div className={styles.card}>
          <h2 className={styles.cardTitle}>By lender (disbursed/assigned)</h2>
          {d.byLender.length ? <BarList points={d.byLender} tone="gold" /> : <Empty />}
        </div>
      </section>

      {/* ── Recent activity ── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>Recent activity</h2>
        {d.activity.length === 0 ? (
          <Empty />
        ) : (
          <ul className={styles.activity}>
            {d.activity.map((a) => (
              <li key={a.id} className={styles.activityRow}>
                <span className={styles.activityDot} aria-hidden="true" />
                <div className={styles.activityBody}>
                  <span className={styles.activityAction}>{auditActionLabel(a.action)}</span>
                  {a.targetType === 'application' && a.referenceId && (
                    <Link href={`/admin/leads/${a.referenceId}`} className={styles.activityRef}>
                      {a.referenceId}
                    </Link>
                  )}
                  {a.lender && a.targetType !== 'application' && <span className={styles.activityMeta}> · {a.lender}</span>}
                  <div className={styles.activityMeta}>
                    {a.actorName ?? (a.isBorrower ? 'Borrower' : 'System')} · {fmtDateTime(a.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ── Presentational helpers (server-rendered) ── */

function Kpi({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiIcon}>{icon}</span>
      <div>
        <div className={styles.kpiValue}>{value}</div>
        <div className={styles.kpiLabel}>{label}</div>
        {sub && <div className={styles.kpiSub}>{sub}</div>}
      </div>
    </div>
  );
}

function Empty() {
  return <p className={styles.empty}>No data yet.</p>;
}

function BarList({ points, tone }: { points: Point[]; tone: 'forest' | 'blue' | 'gold' }) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <ul className={styles.bars}>
      {points.map((p) => (
        <li key={p.label} className={styles.barRow}>
          <span className={styles.barLabel}>{p.label}</span>
          <span className={styles.barTrack}>
            <span
              className={`${styles.barFill} ${styles[`tone_${tone}`]}`}
              style={{ width: `${(p.value / max) * 100}%` }}
            />
          </span>
          <span className={styles.barValue}>{p.value}</span>
        </li>
      ))}
    </ul>
  );
}

function Funnel({ stages }: { stages: FunnelStage[] }) {
  const top = Math.max(stages[0]?.value ?? 0, 1);
  return (
    <ul className={styles.funnel}>
      {stages.map((s) => {
        const pct = (s.value / top) * 100;
        return (
          <li key={s.label} className={styles.funnelRow}>
            <span className={styles.funnelLabel}>{s.label}</span>
            <span className={styles.funnelTrack}>
              <span className={styles.funnelFill} style={{ width: `${Math.max(pct, 3)}%` }}>
                {s.value}
              </span>
            </span>
            <span className={styles.funnelPct}>{pct.toFixed(0)}%</span>
          </li>
        );
      })}
    </ul>
  );
}

function LineChart({ points }: { points: Point[] }) {
  const W = 720;
  const H = 180;
  const pad = 8;
  const max = Math.max(...points.map((p) => p.value), 1);
  const n = points.length;
  const total = points.reduce((sum, p) => sum + p.value, 0);

  const coords = points.map((p, i) => {
    const x = n > 1 ? pad + (i / (n - 1)) * (W - pad * 2) : W / 2;
    const y = H - pad - (p.value / max) * (H - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${pad},${H - pad} ${line} ${(W - pad).toFixed(1)},${H - pad}`;

  return (
    <div className={styles.lineChart}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={styles.lineSvg} role="img" aria-label="Leads over time">
        <defs>
          <linearGradient id="leadArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--forest-400)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--forest-400)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#leadArea)" />
        <polyline points={line} fill="none" stroke="var(--forest-500)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className={styles.lineFoot}>
        <span>{points[0]?.label}</span>
        <span className={styles.lineTotal}>{total} leads</span>
        <span>{points[n - 1]?.label}</span>
      </div>
    </div>
  );
}
