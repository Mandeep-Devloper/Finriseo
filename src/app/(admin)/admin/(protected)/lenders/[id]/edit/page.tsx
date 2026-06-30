import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { LenderForm, type LenderFormValues } from '../../LenderForm';
import styles from '../../lenders.module.css';

export const dynamic = 'force-dynamic';

// Numbers/nulls → form strings ('' for unset). Keeps LenderForm purely string-state.
const s = (n: number | null | undefined) => (n == null ? '' : String(n));

export default async function EditLenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, 'lender_crud')) {
    return <div className={styles.wrap}><div className={styles.forbidden}>You don’t have access to lender management.</div></div>;
  }

  const id = parseInt((await params).id, 10);
  if (!Number.isFinite(id)) notFound();
  const lender = await db.lender.findUnique({ where: { id } });
  if (!lender) notFound();

  const initial: LenderFormValues = {
    id: lender.id,
    name: lender.name,
    color: lender.color,
    logoUrl: lender.logoUrl ?? '',
    processingFee: lender.processingFee,
    priority: s(lender.priority),
    active: lender.active,
    interestRate: s(lender.interestRate),
    interestRateMax: s(lender.interestRateMax),
    tenureMonths: s(lender.tenureMonths),
    minIncome: s(lender.minIncome),
    maxMultiplier: s(lender.maxMultiplier),
    minAmount: s(lender.minAmount),
    maxAmount: s(lender.maxAmount),
    minAge: s(lender.minAge),
    maxAge: s(lender.maxAge),
    maxFoir: s(lender.maxFoir),
    commissionRate: s(lender.commissionRate),
    employmentTypes: lender.employmentTypes,
    loanTypes: lender.loanTypes,
  };

  return (
    <div className={styles.wrap}>
      <Link href="/admin/lenders" className={styles.back}><ChevronLeft size={16} /> Back to lenders</Link>
      <h1 className={styles.title}>Edit {lender.name}</h1>
      <LenderForm initial={initial} />
    </div>
  );
}
