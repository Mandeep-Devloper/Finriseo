import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin';
import { AdminShell } from '../_components/AdminShell';

// Server-side gate for EVERY authenticated admin page. requireAdmin's logic runs
// here via getAdminSession(): no valid+active admin session → bounce to login.
// This is real authorization (the middleware presence-check is only a UX
// redirect). force-dynamic so the session is re-verified on each request and
// never served from a static/cached render.
export const dynamic = 'force-dynamic';

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await getAdminSession();
  if (!admin) redirect('/admin/login');

  return (
    <AdminShell
      admin={{ name: admin.name, email: admin.email, role: admin.role }}
    >
      {children}
    </AdminShell>
  );
}
