'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { logout, getJiraStatus, getOverview } from '@/lib/api';

interface NavCounts {
  tickets: number | null;
  assignments: number | null;
}

const NAV = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
        <rect x="1.5" y="1.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
        <rect x="8.5" y="1.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
        <rect x="1.5" y="8.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
        <rect x="8.5" y="8.5" width="6" height="6" rx="1.2" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    href: '/dashboard/tickets',
    label: 'Tickets',
    countKey: 'tickets' as const,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
        <path d="M2 4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1.5a1.5 1.5 0 0 0 0 3V11a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V9a1.5 1.5 0 0 0 0-3V4.5Z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 3.5v9" stroke="currentColor" strokeWidth="1.3" strokeDasharray="1.5 1.5" />
      </svg>
    ),
  },
  {
    href: '/dashboard/developers',
    label: 'Team',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
        <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1.5 13.5c.5-2.3 2.2-4 4.5-4s4 1.7 4.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="11.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M10.3 9.5c2 .3 3.7 1.8 4.2 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/assignments',
    label: 'Assignments',
    countKey: 'assignments' as const,
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
        <path d="M3 2.5h10v11l-5-2.5-5 2.5v-11Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M5.5 6h5M5.5 8.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3" />
        <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.2 3.2l1.4 1.4M11.4 11.4l1.4 1.4M3.2 12.8l1.4-1.4M11.4 4.6l1.4-1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [counts, setCounts] = useState<NavCounts>({ tickets: null, assignments: null });
  const [jira, setJira] = useState<{ connected: boolean; lastSyncAt?: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [ov, jr] = await Promise.all([getOverview(), getJiraStatus()]);
        if (ov.success) {
          setCounts({
            tickets: ov.overview.activeTickets ?? 0,
            assignments: ov.overview.autoAssignSuccess ?? 0,
          });
        }
        if (jr.success) setJira({ connected: jr.connected, lastSyncAt: jr.lastSyncAt });
      } catch { /* noop */ }
    })();
  }, [pathname]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/';
  };

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname?.startsWith(`${href}/`));

  const lastSync = jira?.lastSyncAt
    ? new Date(jira.lastSyncAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'Never';

  return (
    <aside className="w-[248px] shrink-0 border-r border-border bg-n-10 min-h-screen sticky top-0 self-start flex flex-col">

      {/* Brand */}
      <div className="px-4 pt-5 pb-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-r bg-blue flex items-center justify-center text-white font-semibold text-[15px] tracking-tight shrink-0 relative overflow-hidden">
            <span className="relative z-10">A</span>
            <span className="absolute right-0 top-0 w-3 h-3 rounded-full bg-coral" style={{ transform: 'translate(35%,-35%)' }} />
          </div>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-fg tracking-tight leading-none">AssignIQ</div>
            <div className="text-[10px] text-fg-subtle mt-1 font-semibold tracking-[0.08em] uppercase">for Jira</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="px-3 pt-2 flex-1">
        <div className="meta px-2 mb-2">Workspace</div>
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = isActive(item.href);
            const count = item.countKey ? counts[item.countKey] : null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="nav-item"
                  data-active={active ? 'true' : 'false'}
                >
                  <span className="nav-icon">{item.icon}</span>
                  <span>{item.label}</span>
                  {count !== null && count !== undefined && count > 0 && (
                    <span className="nav-count tnum">{count.toLocaleString()}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Jira connection — blue-tinted */}
      <div className="px-3 pb-3">
        <div
          className="card p-3 relative overflow-hidden"
          style={{
            background: jira?.connected ? 'var(--blue-tint)' : 'var(--n-20)',
            borderColor: jira?.connected ? 'oklch(88% 0.03 260)' : 'var(--border)',
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                <path d="M8 1.5L1.5 8 8 14.5 14.5 8 8 1.5Z" fill={jira?.connected ? 'var(--blue)' : 'var(--n-100)'} />
                <path d="M8 5.5L5.5 8 8 10.5 10.5 8 8 5.5Z" fill="white" />
              </svg>
              <span className="text-[11.5px] font-semibold text-fg">Jira</span>
            </div>
            {jira === null ? (
              <span className="text-[10px] text-fg-subtle">…</span>
            ) : jira.connected ? (
              <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-green">
                <span className="live-dot" />
                Live
              </span>
            ) : (
              <span className="text-[10.5px] font-semibold text-red">Disconnected</span>
            )}
          </div>
          <div className="text-[11px] text-fg-subtle mono tnum truncate">
            {jira?.connected ? `synced · ${lastSync}` : 'Not connected'}
          </div>
        </div>
      </div>

      {/* User / logout */}
      <div className="px-3 pb-3 pt-1 border-t border-border">
        <button
          onClick={handleLogout}
          className="nav-item w-full text-left"
        >
          <span className="nav-icon">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <path d="M10 3.5V3a1.5 1.5 0 0 0-1.5-1.5h-5A1.5 1.5 0 0 0 2 3v10a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 10 13v-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M6 8h8m0 0-2.5-2.5M14 8l-2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
