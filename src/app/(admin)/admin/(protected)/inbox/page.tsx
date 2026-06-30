import { db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { fmtDateTime } from '@/lib/admin/format';
import { ResolveButton } from './ResolveButton';
import styles from '../../_components/panel.module.css';

export const dynamic = 'force-dynamic';

type SearchParams = { [key: string]: string | string[] | undefined };

export default async function InboxPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, 'contact_inbox')) {
    return <div className={styles.wrap}><div className={styles.forbidden}>You don’t have access to the inbox.</div></div>;
  }

  const sp = await searchParams;
  const showResolved = (Array.isArray(sp.show) ? sp.show[0] : sp.show) === 'all';

  const messages = await db.contactMessage.findMany({
    where: showResolved ? {} : { status: { not: 'resolved' } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Inbox</h1>
          <p className={styles.sub}>{messages.length} message{messages.length === 1 ? '' : 's'}{showResolved ? '' : ' (open)'}</p>
        </div>
        <a className={styles.secondaryBtn} href={showResolved ? '/admin/inbox' : '/admin/inbox?show=all'}>
          {showResolved ? 'Show open only' : 'Show all'}
        </a>
      </header>

      {messages.length === 0 ? (
        <div className={styles.empty}>No messages.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Received</th>
                <th>From</th>
                <th>Subject &amp; message</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td className={styles.nowrap}>{fmtDateTime(m.createdAt)}</td>
                  <td>
                    <div>{m.name}</div>
                    <div className={styles.muted}>{m.email}</div>
                    <div className={`${styles.muted} ${styles.mono}`}>{m.phone}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.subject}</div>
                    <div className={styles.muted} style={{ whiteSpace: 'pre-wrap', maxWidth: '40ch' }}>{m.message}</div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${m.status === 'resolved' ? styles.badgeGreen : styles.badgeBlue}`}>
                      {m.status === 'resolved' ? 'Resolved' : 'Open'}
                    </span>
                  </td>
                  <td className={styles.nowrap}><ResolveButton id={m.id} status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
