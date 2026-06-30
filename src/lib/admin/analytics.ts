// Server-side dashboard aggregation. Everything is computed in the DB (groupBy /
// aggregate / raw SUM) — no fetch-all-and-loop-in-the-browser. Runs the queries
// in parallel for a single dashboard render.
import 'server-only';
import { db } from '@/lib/db';
import { DRAFT_STATUS, PIPELINE_STATUSES } from '@/lib/admin/pipeline';
import { getDefaultCommissionRate } from '@/lib/admin/settings';

export interface Kpis {
  totalLeads: number;        // non-draft applications
  drafts: number;            // in-progress / abandoned funnels
  byStatus: Record<string, number>;
  disbursedCount: number;
  disbursedTotal: number;
  disbursedThisMonth: number;
  estimatedCommission: number;
  conversionRate: number;    // disbursed / totalLeads, 0..1
  activeLenders: number;
}

export interface Point { label: string; value: number; }
export interface FunnelStage { label: string; value: number; }

function startOfMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

async function getKpis(): Promise<Kpis> {
  const monthStart = startOfMonth();
  // Fallback commission rate from settings, applied when a lender has none.
  const defaultRate = await getDefaultCommissionRate();

  const [
    statusGroups,
    disbursedAgg,
    monthAgg,
    commissionRows,
    activeLenders,
  ] = await Promise.all([
    db.application.groupBy({ by: ['status'], _count: { _all: true } }),
    db.application.aggregate({
      where: { disbursedAt: { not: null } },
      _sum: { disbursedAmount: true },
      _count: { _all: true },
    }),
    db.application.aggregate({
      where: { disbursedAt: { gte: monthStart } },
      _sum: { disbursedAmount: true },
    }),
    // Commission = Σ(disbursedAmount × effectiveRate / 100) across disbursed loans,
    // where effectiveRate = lender.commissionRate, falling back to the configured
    // default. Loans with neither are excluded.
    db.$queryRaw<Array<{ commission: number }>>`
      SELECT COALESCE(SUM(a."disbursedAmount" * COALESCE(l."commissionRate", ${defaultRate}) / 100), 0) AS commission
      FROM "Application" a
      JOIN "Lender" l ON a."chosenLenderId" = l.id
      WHERE a."disbursedAmount" IS NOT NULL AND COALESCE(l."commissionRate", ${defaultRate}) IS NOT NULL
    `,
    db.lender.count({ where: { active: true } }),
  ]);

  const byStatus: Record<string, number> = {};
  let totalAll = 0;
  for (const g of statusGroups) {
    byStatus[g.status] = g._count._all;
    totalAll += g._count._all;
  }
  const drafts = byStatus[DRAFT_STATUS] ?? 0;
  const totalLeads = totalAll - drafts;
  const disbursedCount = byStatus['disbursed'] ?? 0;

  return {
    totalLeads,
    drafts,
    byStatus,
    disbursedCount,
    disbursedTotal: disbursedAgg._sum.disbursedAmount ?? 0,
    disbursedThisMonth: monthAgg._sum.disbursedAmount ?? 0,
    estimatedCommission: Number(commissionRows[0]?.commission ?? 0),
    conversionRate: totalLeads > 0 ? disbursedCount / totalLeads : 0,
    activeLenders,
  };
}

/** Non-draft leads per day for the last `days` days, zero-filled. */
async function getLeadsOverTime(days = 30): Promise<Point[]> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  since.setDate(since.getDate() - (days - 1));

  const rows = await db.$queryRaw<Array<{ day: Date; count: number }>>`
    SELECT date_trunc('day', "createdAt")::date AS day, COUNT(*)::int AS count
    FROM "Application"
    WHERE "createdAt" >= ${since} AND "status" <> ${DRAFT_STATUS}
    GROUP BY day
    ORDER BY day
  `;

  const byDay = new Map<string, number>();
  for (const r of rows) byDay.set(new Date(r.day).toISOString().slice(0, 10), Number(r.count));

  const series: Point[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    series.push({ label: key, value: byDay.get(key) ?? 0 });
  }
  return series;
}

async function getByLoanType(): Promise<Point[]> {
  const groups = await db.application.groupBy({
    by: ['loanPurpose'],
    where: { status: { not: DRAFT_STATUS }, loanPurpose: { not: null } },
    _count: { _all: true },
  });
  return groups
    .map((g) => ({ label: g.loanPurpose ?? 'Unknown', value: g._count._all }))
    .sort((a, b) => b.value - a.value);
}

async function getByLender(): Promise<Point[]> {
  return db.$queryRaw<Array<{ label: string; value: number }>>`
    SELECT l.name AS label, COUNT(a.id)::int AS value
    FROM "Application" a
    JOIN "Lender" l ON a."chosenLenderId" = l.id
    GROUP BY l.name
    ORDER BY value DESC
  `;
}

/** started → submitted → approved → disbursed. */
async function getFunnel(): Promise<FunnelStage[]> {
  const [started, submitted, approved, disbursed] = await Promise.all([
    db.application.count(),
    db.application.count({ where: { status: { not: DRAFT_STATUS } } }),
    db.application.count({ where: { status: { in: ['approved', 'disbursed'] } } }),
    db.application.count({ where: { status: 'disbursed' } }),
  ]);
  return [
    { label: 'Started', value: started },
    { label: 'Submitted', value: submitted },
    { label: 'Approved', value: approved },
    { label: 'Disbursed', value: disbursed },
  ];
}

export type ActivityEntry = {
  id: string;
  action: string;
  referenceId: string;
  targetType: string | null;
  lender: string | null;
  createdAt: Date;
  actorName: string | null;
  isBorrower: boolean;
};

async function getRecentActivity(limit = 12): Promise<ActivityEntry[]> {
  const rows = await db.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { actorAdmin: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    referenceId: r.referenceId,
    targetType: r.targetType,
    lender: r.lender,
    createdAt: r.createdAt,
    actorName: r.actorAdmin?.name ?? null,
    isBorrower: !r.actorAdminId && Boolean(r.actorUid),
  }));
}

export interface DashboardData {
  kpis: Kpis;
  leadsOverTime: Point[];
  byStatus: Point[];
  byLoanType: Point[];
  byLender: Point[];
  funnel: FunnelStage[];
  activity: ActivityEntry[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const [kpis, leadsOverTime, byLoanType, byLender, funnel, activity] = await Promise.all([
    getKpis(),
    getLeadsOverTime(30),
    getByLoanType(),
    getByLender(),
    getFunnel(),
    getRecentActivity(12),
  ]);

  // Pipeline status breakdown (ordered), derived from the KPI counts.
  const byStatus: Point[] = PIPELINE_STATUSES.map((s) => ({
    label: s,
    value: kpis.byStatus[s] ?? 0,
  }));

  return { kpis, leadsOverTime, byStatus, byLoanType, byLender, funnel, activity };
}
