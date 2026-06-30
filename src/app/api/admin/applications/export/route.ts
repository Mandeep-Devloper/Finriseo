import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, adminAuthErrorResponse } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { recordAdminAudit } from '@/lib/services/auditLog';
import { parseLeadQuery, listAllForExport } from '@/lib/admin/applications';
import { statusLabel } from '@/lib/admin/pipeline';

// CSV export of the CURRENT filtered lead set (same filters/sort as the list).
// Role-gated to `export` (ADMIN+) because PII leaves the system here. Audited.
// PAN is intentionally NOT exported — it stays viewable only in the (audited)
// detail view, to limit how widely the most sensitive field is copied around.

// Guard against CSV/formula injection when the file is opened in a spreadsheet.
function csvCell(value: unknown): string {
  let s = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const HEADERS = [
  'Reference ID', 'Name', 'Mobile', 'Email', 'Status', 'Loan Amount',
  'Monthly Income', 'Employment', 'Loan Purpose', 'Assigned To',
  'Disbursed Lender', 'Disbursed Amount', 'Disbursed At', 'Created At',
];

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!can(admin.role, 'export')) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const sp = req.nextUrl.searchParams;
    const query = parseLeadQuery((k) => sp.get(k) ?? undefined);
    const rows = await listAllForExport(query, query.sortBy, query.sortDir);

    const lines = [
      HEADERS.map(csvCell).join(','),
      ...rows.map((r) =>
        [
          r.referenceId,
          r.fullName,
          r.mobile,
          r.email ?? '',
          statusLabel(r.status),
          r.loanAmount ?? '',
          r.monthlyIncome ?? '',
          r.employmentType ?? '',
          r.loanPurpose ?? '',
          r.assignedTo?.name ?? '',
          r.chosenLender?.name ?? '',
          r.disbursedAmount ?? '',
          r.disbursedAt ? r.disbursedAt.toISOString().slice(0, 10) : '',
          r.createdAt.toISOString(),
        ].map(csvCell).join(',')
      ),
    ];
    const csv = '﻿' + lines.join('\r\n'); // BOM so Excel reads UTF-8

    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'export',
      targetType: 'application',
      targetId: `count:${rows.length}`,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="finriseo-leads-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const authErr = adminAuthErrorResponse(err);
    if (authErr) return authErr;
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
