import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { getAdminSession } from '@/lib/auth/admin';
import { recordAdminAudit } from '@/lib/services/auditLog';
import {
  getApplicationDetail,
  getSelectedOffer,
  getApplicationAudit,
  getAssignableAgents,
  getFilterOptions,
} from '@/lib/admin/applications';
import { fmtDate, fmtDateTime, fmtMoney } from '@/lib/admin/format';
import { statusLabel } from '@/lib/admin/pipeline';
import { auditActionLabel } from '@/lib/admin/audit';
import { StatusBadge } from '../../../_components/StatusBadge';
import { LeadActions } from './LeadActions';
import styles from './detail.module.css';

export const dynamic = 'force-dynamic';

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <dt className={styles.fieldLabel}>{label}</dt>
      <dd className={styles.fieldValue}>{value || <span className={styles.muted}>—</span>}</dd>
    </div>
  );
}

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ referenceId: string }>;
}) {
  const { referenceId } = await params;

  const [admin, app] = await Promise.all([
    getAdminSession(),
    getApplicationDetail(referenceId),
  ]);
  if (!app || !admin) notFound();

  const [selectedOffer, audit, agents, options] = await Promise.all([
    getSelectedOffer(app.selectedOfferId),
    getApplicationAudit(referenceId),
    getAssignableAgents(),
    getFilterOptions(),
  ]);

  // Viewing a borrower's full PII is itself an audited admin action — but only on
  // a REAL view. Next.js <Link> prefetches the RSC payload on hover/viewport,
  // which would otherwise log phantom "Viewed details" events and pollute the
  // audit trail. Skip the audit when this render is a router prefetch.
  const hdrs = await headers();
  const isPrefetch =
    hdrs.get('next-router-prefetch') === '1' || hdrs.get('purpose') === 'prefetch';
  if (!isPrefetch) {
    void recordAdminAudit({
      actorAdminId: admin.id,
      action: 'view_detail',
      targetType: 'application',
      targetId: referenceId,
    });
  }

  return (
    <div className={styles.wrap}>
      <Link href="/admin/leads" className={styles.back}>
        <ChevronLeft size={16} /> Back to leads
      </Link>

      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>{app.fullName}</h1>
          <p className={styles.ref}>{app.referenceId}</p>
        </div>
        <StatusBadge status={app.status} />
      </header>

      <div className={styles.grid}>
        {/* ── Left: data, notes, audit ── */}
        <div className={styles.mainCol}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Borrower</h2>
            <dl className={styles.fields}>
              <Field label="Full name" value={app.fullName} />
              <Field label="Mobile" value={app.mobile} />
              <Field label="Email" value={app.email} />
              <Field label="PIN code" value={app.pinCode} />
              <Field label="PAN" value={app.panNumber} />
            </dl>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Loan &amp; employment</h2>
            <dl className={styles.fields}>
              <Field label="Loan amount" value={fmtMoney(app.loanAmount)} />
              <Field label="Purpose" value={app.loanPurpose} />
              <Field label="Monthly income" value={fmtMoney(app.monthlyIncome)} />
              <Field label="Employment" value={app.employmentType} />
              <Field label="Salary mode" value={app.salaryMode} />
              <Field label="Employer" value={app.employer} />
              <Field label="Experience" value={app.experience} />
              <Field
                label="Borrower-selected offer"
                value={selectedOffer ? `${selectedOffer.name} · ${selectedOffer.interestRate}% · ${selectedOffer.tenureMonths}m` : null}
              />
            </dl>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Pipeline</h2>
            <dl className={styles.fields}>
              <Field label="Status" value={statusLabel(app.status)} />
              <Field label="Funnel step" value={app.currentStep} />
              <Field label="Assigned to" value={app.assignedTo?.name} />
              <Field label="Source" value={app.source} />
              <Field label="Created" value={fmtDateTime(app.createdAt)} />
              <Field label="Updated" value={fmtDateTime(app.updatedAt)} />
            </dl>
          </section>

          {(app.disbursedAt || app.chosenLender) && (
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Disbursement</h2>
              <dl className={styles.fields}>
                <Field label="Lender" value={app.chosenLender?.name} />
                <Field label="Amount" value={fmtMoney(app.disbursedAmount)} />
                <Field label="Date" value={fmtDate(app.disbursedAt)} />
              </dl>
            </section>
          )}

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Notes ({app.notes.length})</h2>
            {app.notes.length === 0 ? (
              <p className={styles.muted}>No notes yet.</p>
            ) : (
              <ul className={styles.notes}>
                {app.notes.map((n) => (
                  <li key={n.id} className={styles.note}>
                    <div className={styles.noteMeta}>
                      <span className={styles.noteAuthor}>{n.author.name}</span>
                      <span className={styles.muted}>{fmtDateTime(n.createdAt)}</span>
                    </div>
                    <p className={styles.noteBody}>{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Activity</h2>
            <ul className={styles.audit}>
              {audit.map((a) => (
                <li key={a.id} className={styles.auditRow}>
                  <span className={styles.auditDot} aria-hidden="true" />
                  <div>
                    <span className={styles.auditAction}>{auditActionLabel(a.action)}</span>
                    {a.lender && <span className={styles.auditLender}> · {a.lender}</span>}
                    <div className={styles.auditMeta}>
                      {a.actorAdmin ? a.actorAdmin.name : a.actorUid ? 'Borrower' : 'System'}
                      {' · '}
                      {fmtDateTime(a.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* ── Right: actions ── */}
        <aside className={styles.sideCol}>
          <LeadActions
            referenceId={app.referenceId}
            role={admin.role}
            status={app.status}
            assignedToId={app.assignedToId}
            agents={agents.map((a) => ({ id: a.id, name: a.name }))}
            lenders={options.lenders.map((l) => ({ id: l.id, name: l.name }))}
            disbursement={{
              chosenLenderId: app.chosenLenderId,
              amount: app.disbursedAmount,
              date: app.disbursedAt ? app.disbursedAt.toISOString().slice(0, 10) : null,
            }}
          />
        </aside>
      </div>
    </div>
  );
}
