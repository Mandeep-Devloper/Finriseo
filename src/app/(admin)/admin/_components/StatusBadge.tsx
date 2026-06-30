import { statusLabel, STATUS_TONE } from '@/lib/admin/pipeline';
import styles from './StatusBadge.module.css';

// Pipeline status pill, shared by the leads table and detail view. Server-safe.
export function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? 'gray';
  return <span className={`${styles.badge} ${styles[tone] ?? styles.gray}`}>{statusLabel(status)}</span>;
}
