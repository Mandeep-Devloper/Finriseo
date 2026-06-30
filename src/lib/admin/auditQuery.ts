// Server-side query for the audit-log viewer (filter + paginate). Server-only.
import 'server-only';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';

export const AUDIT_PAGE_SIZE = 30;

export interface AuditFilters {
  actorAdminId?: string;
  action?: string;
  from?: Date;
  to?: Date;
}

export function buildAuditWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};
  if (f.actorAdminId) where.actorAdminId = f.actorAdminId;
  if (f.action) where.action = f.action;
  if (f.from || f.to) {
    where.createdAt = {};
    if (f.from) where.createdAt.gte = f.from;
    if (f.to) where.createdAt.lte = f.to;
  }
  return where;
}

const INCLUDE = {
  actorAdmin: { select: { name: true, email: true } },
} satisfies Prisma.AuditLogInclude;

export type AuditRow = Prisma.AuditLogGetPayload<{ include: typeof INCLUDE }>;

export async function listAuditLog(
  filters: AuditFilters,
  page: number
): Promise<{ rows: AuditRow[]; total: number; page: number; pageCount: number }> {
  const where = buildAuditWhere(filters);
  const p = Math.max(1, page);
  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (p - 1) * AUDIT_PAGE_SIZE,
      take: AUDIT_PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);
  return { rows, total, page: p, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)) };
}

/** Admins for the actor filter (includes inactive — they still authored events). */
export function getAuditActors() {
  return db.adminUser.findMany({
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });
}
