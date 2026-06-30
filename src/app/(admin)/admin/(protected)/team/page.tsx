import { db } from '@/lib/db';
import { getAdminSession } from '@/lib/auth/admin';
import { can } from '@/lib/auth/permissions';
import { TeamManager, type TeamMember } from './TeamManager';
import styles from '../../_components/panel.module.css';

export const dynamic = 'force-dynamic';

export default async function TeamPage() {
  const admin = await getAdminSession();
  if (!admin || !can(admin.role, 'team_manage')) {
    return <div className={styles.wrap}><div className={styles.forbidden}>You don’t have access to team management.</div></div>;
  }

  const rows = await db.adminUser.findMany({
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true },
  });
  const members: TeamMember[] = rows.map((m) => ({
    ...m,
    lastLoginAt: m.lastLoginAt ? m.lastLoginAt.toISOString() : null,
  }));

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Team</h1>
          <p className={styles.sub}>{members.length} member{members.length === 1 ? '' : 's'} · manage roles &amp; access</p>
        </div>
      </header>
      <TeamManager members={members} currentAdminId={admin.id} />
    </div>
  );
}
