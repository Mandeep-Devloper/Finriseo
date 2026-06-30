// Server-side data access for the admin leads view. Centralizes the filter /
// sort / pagination logic so the list page AND the CSV export apply IDENTICAL
// rules (no drift between what an admin sees and what they export).
import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { DRAFT_STATUS } from '@/lib/admin/pipeline';

export const PAGE_SIZE = 25;

export const SORTABLE_FIELDS = ['createdAt', 'updatedAt', 'loanAmount', 'fullName', 'status'] as const;
export type SortField = (typeof SORTABLE_FIELDS)[number];

export interface LeadFilters {
  status?: string;            // exact pipeline status (may be 'draft')
  includeDrafts?: boolean;    // when no explicit status, include drafts too
  loanPurpose?: string;
  lenderId?: number;          // chosenLenderId
  assignedToId?: string;      // AdminUser id, or the sentinel 'unassigned'
  search?: string;            // phone / name / referenceId (partial)
  from?: Date;
  to?: Date;
}

export interface LeadQuery extends LeadFilters {
  page: number;               // 1-based
  sortBy: SortField;
  sortDir: 'asc' | 'desc';
}

/**
 * Parse a leads query from a param getter. Used by BOTH the list page
 * (searchParams) and the export route (URL) so they always agree. Unknown/invalid
 * values fall back to safe defaults.
 */
export function parseLeadQuery(get: (key: string) => string | undefined): LeadQuery {
  const page = Math.max(1, parseInt(get('page') ?? '1', 10) || 1);

  const sortByRaw = get('sortBy');
  const sortBy: SortField = (SORTABLE_FIELDS as readonly string[]).includes(sortByRaw ?? '')
    ? (sortByRaw as SortField)
    : 'createdAt';
  const sortDir = get('sortDir') === 'asc' ? 'asc' : 'desc';

  const lenderIdRaw = get('lenderId');
  const lenderId = lenderIdRaw ? parseInt(lenderIdRaw, 10) : undefined;

  const fromRaw = get('from');
  const toRaw = get('to');
  // `to` is inclusive to the end of the chosen day.
  const to = toRaw ? new Date(`${toRaw}T23:59:59.999`) : undefined;

  const includeDraftsRaw = get('includeDrafts');

  return {
    page,
    sortBy,
    sortDir,
    status: get('status') || undefined,
    includeDrafts: includeDraftsRaw === '1' || includeDraftsRaw === 'true',
    loanPurpose: get('loanPurpose') || undefined,
    lenderId: Number.isFinite(lenderId) ? lenderId : undefined,
    assignedToId: get('assignedToId') || undefined,
    search: get('search') || undefined,
    from: fromRaw ? new Date(`${fromRaw}T00:00:00.000`) : undefined,
    to: Number.isNaN(to?.getTime()) ? undefined : to,
  };
}

/** Build the Prisma where-clause shared by list + export. */
export function buildWhere(f: LeadFilters): Prisma.ApplicationWhereInput {
  const where: Prisma.ApplicationWhereInput = {};

  if (f.status) {
    where.status = f.status;
  } else if (!f.includeDrafts) {
    // Default lead view excludes in-progress/abandoned funnels.
    where.status = { not: DRAFT_STATUS };
  }

  if (f.loanPurpose) where.loanPurpose = f.loanPurpose;
  if (f.lenderId != null) where.chosenLenderId = f.lenderId;

  if (f.assignedToId === 'unassigned') where.assignedToId = null;
  else if (f.assignedToId) where.assignedToId = f.assignedToId;

  if (f.from || f.to) {
    where.createdAt = {};
    if (f.from) where.createdAt.gte = f.from;
    if (f.to) where.createdAt.lte = f.to;
  }

  const q = f.search?.trim();
  if (q) {
    where.OR = [
      { mobile: { contains: q } },
      { fullName: { contains: q, mode: 'insensitive' } },
      { referenceId: { contains: q.toUpperCase() } },
    ];
  }

  return where;
}

const LIST_INCLUDE = {
  assignedTo: { select: { id: true, name: true } },
  chosenLender: { select: { id: true, name: true } },
} satisfies Prisma.ApplicationInclude;

export type LeadRow = Prisma.ApplicationGetPayload<{ include: typeof LIST_INCLUDE }>;

/** Server-paginated, filtered, sorted list of applications + total count. */
export async function listApplications(
  query: LeadQuery
): Promise<{ rows: LeadRow[]; total: number; page: number; pageCount: number }> {
  const where = buildWhere(query);
  const page = Math.max(1, query.page);

  const [rows, total] = await Promise.all([
    db.application.findMany({
      where,
      include: LIST_INCLUDE,
      orderBy: { [query.sortBy]: query.sortDir },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.application.count({ where }),
  ]);

  return { rows, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

/** All rows matching the filters (no pagination) — for CSV export. */
export function listAllForExport(filters: LeadFilters, sortBy: SortField, sortDir: 'asc' | 'desc') {
  return db.application.findMany({
    where: buildWhere(filters),
    include: LIST_INCLUDE,
    orderBy: { [sortBy]: sortDir },
  });
}

const DETAIL_INCLUDE = {
  assignedTo: { select: { id: true, name: true, email: true, role: true } },
  chosenLender: { select: { id: true, name: true } },
  notes: {
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { id: true, name: true } } },
  },
} satisfies Prisma.ApplicationInclude;

export type LeadDetail = Prisma.ApplicationGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** Full detail for one application, by its public referenceId. */
export function getApplicationDetail(referenceId: string): Promise<LeadDetail | null> {
  return db.application.findUnique({ where: { referenceId }, include: DETAIL_INCLUDE });
}

/** The lender the borrower picked in the funnel (selectedOfferId), if any. */
export function getSelectedOffer(selectedOfferId: number | null) {
  if (selectedOfferId == null) return Promise.resolve(null);
  return db.lender.findUnique({
    where: { id: selectedOfferId },
    select: { id: true, name: true, interestRate: true, tenureMonths: true },
  });
}

export type AuditEntry = Prisma.AuditLogGetPayload<{
  include: { actorAdmin: { select: { name: true; email: true } } };
}>;

/** Audit trail (borrower + admin events) for one application's referenceId. */
export function getApplicationAudit(referenceId: string): Promise<AuditEntry[]> {
  return db.auditLog.findMany({
    where: { referenceId },
    include: { actorAdmin: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

/** Active admins that can own a lead (for assign dropdown + agent filter). */
export function getAssignableAgents() {
  return db.adminUser.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });
}

/** Filter options for the leads toolbar: lenders + distinct loan purposes. */
export async function getFilterOptions() {
  const [lenders, purposes] = await Promise.all([
    db.lender.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    db.application.findMany({
      where: { loanPurpose: { not: null } },
      select: { loanPurpose: true },
      distinct: ['loanPurpose'],
      orderBy: { loanPurpose: 'asc' },
    }),
  ]);
  return {
    lenders,
    purposes: purposes.map((p) => p.loanPurpose).filter((p): p is string => Boolean(p)),
  };
}
