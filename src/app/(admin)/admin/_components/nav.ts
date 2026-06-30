import {
  LayoutDashboard,
  Users,
  Building2,
  UserCog,
  ScrollText,
  Inbox,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Capability } from '@/lib/auth/permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Capability required to see this item (matches the RBAC matrix). */
  capability: Capability;
  /** Phase 1: only the dashboard is built. Others render as disabled "soon"
   *  placeholders until their phase lands, so the nav shows the full shape. */
  ready: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, capability: 'dashboard', ready: true },
  { label: 'Leads', href: '/admin/leads', icon: Users, capability: 'view_leads', ready: true },
  { label: 'Lenders', href: '/admin/lenders', icon: Building2, capability: 'lender_crud', ready: true },
  { label: 'Inbox', href: '/admin/inbox', icon: Inbox, capability: 'contact_inbox', ready: true },
  { label: 'Audit log', href: '/admin/audit', icon: ScrollText, capability: 'audit_view', ready: true },
  { label: 'Team', href: '/admin/team', icon: UserCog, capability: 'team_manage', ready: true },
  { label: 'Settings', href: '/admin/settings', icon: Settings, capability: 'settings', ready: true },
];
