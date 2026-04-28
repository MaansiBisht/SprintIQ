'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getOverview, getWorkload, getJiraStatus,
  getAssignments, getTickets, autoAssignTicket, syncJira,
} from '@/lib/api';
import ReasoningModal, { VerdictData } from '@/components/ReasoningModal';

interface Overview {
  totalTickets: number;
  activeTickets: number;
  assignmentsToday: number;
  autoAssignSuccess: number;
  lastSyncAt: string | null;
  lastWebhookAt: string | null;
}

interface WorkloadItem {
  id: string;
  name: string;
  email: string;
  workload_capacity: number;
  active_tickets: string;
  weekly_assignments: string;
  utilizationPercent: number;
}

interface TicketRow {
  id: string;
  jira_key: string;
  summary: string;
  status: string;
  priority: string;
  assignee_name: string | null;
  type?: string;
  created_at: string;
}

interface AssignmentRow {
  id: string;
  jira_key: string;
  summary: string;
  developer_name: string | null;
  final_score: number | null;
  created_at: string;
}

const initials = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const avatarColor = (s: string) => ((s.charCodeAt(0) + s.charCodeAt(s.length - 1)) % 5) + 1;

const loadLabel = (pct: number): 'success' | 'warning' | 'danger' =>
  pct > 80 ? 'danger' : pct > 50 ? 'warning' : 'success';

const timeAgo = (s: string | null): string => {
  if (!s) return '—';
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

function SparkleIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2l1.3 3.7L13 7l-3.7 1.3L8 12l-1.3-3.7L3 7l3.7-1.3L8 2Z" fill="currentColor" />
      <path d="M13 11l.55 1.45L15 13l-1.45.55L13 15l-.55-1.45L11 13l1.45-.55L13 11Z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [workload, setWorkload] = useState<WorkloadItem[]>([]);
  const [unassigned, setUnassigned] = useState<TicketRow[]>([]);
  const [recent, setRecent] = useState<AssignmentRow[]>([]);
  const [jiraConnected, setJiraConnected] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);

  async function loadAll() {
    try {
      const [ov, wl, jr, pending, as] = await Promise.all([
        getOverview(),
        getWorkload(),
        getJiraStatus(),
        getTickets({ limit: '8', status: 'To Do' }),
        getAssignments({ limit: '6' }),
      ]);
      if (ov.success) setOverview(ov.overview);
      if (wl.success) setWorkload(wl.workload);
      if (jr.success) setJiraConnected(jr.connected);
      if (pending.success) setUnassigned(pending.tickets.filter((t: TicketRow) => !t.assignee_name));
      if (as.success) setRecent(as.assignments);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, []);

  async function handleAssign(t: TicketRow) {
    setAssigning(t.id);
    try {
      const res = await autoAssignTicket(t.id);
      if (res.success) {
        setVerdict({
          ticketKey: res.ticketKey || t.jira_key,
          ticketSummary: t.summary,
          developerName: res.developerName,
          breakdown: res.breakdown,
          reasoning: res.reasoning,
        });
        loadAll();
      }
    } finally {
      setAssigning(null);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try { await syncJira(); loadAll(); } finally { setSyncing(false); }
  }

  const autoRate = overview?.totalTickets
    ? Math.round(((overview.autoAssignSuccess || 0) / Math.max(overview.totalTickets, 1)) * 100)
    : 0;

  const topLoad = workload.slice(0, 6);

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="anim-fade">
      {/* Page header */}
      <div className="flex items-start justify-between mb-7 anim-rise">
        <div>
          <h1 className="h-page">Overview</h1>
          <p className="text-[13.5px] text-fg-muted mt-2">
            {jiraConnected
              ? <>Connected to Jira · last sync <span className="mono tnum">{timeAgo(overview?.lastSyncAt ?? null)}</span></>
              : <>Jira not connected. <Link href="/dashboard/settings" className="text-blue hover:underline">Set it up →</Link></>
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSync}
            disabled={syncing || !jiraConnected}
            className="btn"
            data-size="sm"
          >
            {syncing ? (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 animate-spin">
                  <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                Syncing…
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                  <path d="M2.5 8a5.5 5.5 0 0 1 9.5-3.8M13.5 8a5.5 5.5 0 0 1-9.5 3.8M11 2v2.5h2.5M5 14v-2.5H2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Sync Jira
              </>
            )}
          </button>
          <Link href="/dashboard/tickets" className="btn" data-variant="primary" data-size="sm">
            View all tickets
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </div>

      {/* KPI row — last KPI is AI-themed */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger">
        <div className="kpi anim-rise">
          <div className="kpi-label">Active tickets</div>
          <div className="kpi-value">{(overview?.activeTickets ?? 0).toLocaleString()}</div>
          <div className="kpi-foot">
            <span className="mono tnum">{overview?.totalTickets ?? 0}</span>
            <span>total in system</span>
          </div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">Assigned today</div>
          <div className="kpi-value">{(overview?.assignmentsToday ?? 0).toLocaleString()}</div>
          <div className="kpi-foot">dispatched</div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">Auto-assigned · 7d</div>
          <div className="kpi-value">{(overview?.autoAssignSuccess ?? 0).toLocaleString()}</div>
          <div className="kpi-foot">
            <span className="ai-chip">
              <SparkleIcon className="ai-chip-sparkle" />
              by SprintIQ
            </span>
          </div>
        </div>
        <div className="kpi kpi-ai anim-rise">
          <div className="kpi-label flex items-center gap-2">
            <SparkleIcon className="w-3 h-3 text-coral" />
            Auto-match rate
          </div>
          <div className="kpi-value">{autoRate}<span className="text-[24px] text-coral/70">%</span></div>
          <div className="kpi-foot">last 7 days</div>
        </div>
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">

        {/* QUEUE */}
        <section className="lg:col-span-8">
          <div className="card anim-rise overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="h-section">Awaiting assignment</span>
                {unassigned.length > 0 && <span className="pill" data-tone="blue">{unassigned.length}</span>}
              </div>
              <Link href="/dashboard/tickets" className="text-[12.5px] text-fg-muted hover:text-blue flex items-center gap-1 font-medium">
                View all
                <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
                  <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>

            {unassigned.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="w-10 h-10 rounded-full bg-green-soft mx-auto mb-3 flex items-center justify-center">
                  <svg viewBox="0 0 16 16" fill="none" className="w-5 h-5 text-green">
                    <path d="M3 8.5l3 3 7-7.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-[14px] font-semibold text-fg mb-1">Queue is clear</div>
                <div className="text-[12.5px] text-fg-subtle">No unassigned tickets right now.</div>
              </div>
            ) : (
              <ul>
                {unassigned.slice(0, 6).map((t) => (
                  <li key={t.id} className="row-hover grid grid-cols-[auto_1fr_auto] gap-3 items-center px-5 py-3.5 border-b border-border-subtle last:border-b-0">
                    <span className="dot mt-[6px]" data-p={t.priority} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="mono text-[11.5px] text-blue-deep font-semibold tnum">{t.jira_key}</span>
                        <span className="pill">{t.status}</span>
                        {t.type && <span className="pill">{t.type}</span>}
                      </div>
                      <div className="text-[13.5px] text-fg truncate">{t.summary}</div>
                    </div>
                    <button
                      onClick={() => handleAssign(t)}
                      disabled={assigning === t.id}
                      className="btn shrink-0"
                      data-variant="accent"
                      data-size="sm"
                    >
                      {assigning === t.id ? (
                        <>
                          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 animate-spin">
                            <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                          Assigning
                        </>
                      ) : (
                        <>
                          <SparkleIcon className="w-3 h-3" />
                          Auto-assign
                        </>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* TEAM */}
        <section className="lg:col-span-4">
          <div className="card anim-rise h-full flex flex-col">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div className="flex items-center gap-3">
                <span className="h-section">Team workload</span>
                {workload.length > 0 && <span className="pill">{workload.length}</span>}
              </div>
              <Link href="/dashboard/developers" className="text-[12.5px] text-fg-muted hover:text-blue font-medium">
                Roster →
              </Link>
            </div>

            {topLoad.length === 0 ? (
              <div className="px-5 py-10 text-center flex-1 flex items-center justify-center">
                <div className="text-[12.5px] text-fg-subtle">No developers configured yet.</div>
              </div>
            ) : (
              <ul className="px-2 py-2 space-y-0.5">
                {topLoad.map((dev) => {
                  const active = parseInt(dev.active_tickets, 10);
                  const pct = Math.min(dev.utilizationPercent, 100);
                  const tone = loadLabel(pct);
                  return (
                    <li key={dev.id}>
                      <Link
                        href={`/dashboard/developers/${dev.id}`}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-r-sm hover:bg-n-20 transition-colors"
                      >
                        <span className="avatar shrink-0" data-c={avatarColor(dev.name)}>{initials(dev.name)}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-1.5">
                            <span className="text-[13.5px] font-medium text-fg truncate">{dev.name}</span>
                            <span className="mono text-[10.5px] text-fg-subtle tnum shrink-0">
                              {active}/{dev.workload_capacity}
                            </span>
                          </div>
                          <div className="score-solo">
                            <div className="score-solo-fill" data-tone={tone} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>

      {/* Recent */}
      <section>
        <div className="card anim-rise overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <div className="flex items-center gap-3">
              <span className="h-section">Recent auto-assignments</span>
              {recent.length > 0 && <span className="pill" data-tone="coral">{recent.length}</span>}
            </div>
            <Link href="/dashboard/assignments" className="text-[12.5px] text-fg-muted hover:text-blue font-medium">
              History →
            </Link>
          </div>

          {recent.length === 0 ? (
            <div className="px-5 py-12 text-center text-[13px] text-fg-subtle">
              No assignments have been made yet.
            </div>
          ) : (
            <ul>
              {recent.map((a) => (
                <li key={a.id} className="row-hover grid grid-cols-[90px_1fr_auto_auto] items-center gap-4 px-5 py-3 border-b border-border-subtle last:border-b-0">
                  <span className="mono text-[11.5px] text-fg-subtle tnum">{timeAgo(a.created_at)}</span>
                  <div className="min-w-0 flex items-center gap-3">
                    <span className="mono text-[12.5px] text-blue-deep font-semibold tnum shrink-0">{a.jira_key}</span>
                    <span className="text-[13.5px] text-fg-muted truncate">{a.summary}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-coral">
                      <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {a.developer_name ? (
                      <>
                        <span className="avatar" data-c={avatarColor(a.developer_name)} style={{ width: 22, height: 22, fontSize: 10 }}>{initials(a.developer_name)}</span>
                        <span className="text-[13px] text-fg">{a.developer_name}</span>
                      </>
                    ) : (
                      <span className="text-[12.5px] text-fg-subtle italic">Unassigned</span>
                    )}
                  </div>
                  <span className="mono text-[12px] text-fg-subtle tnum whitespace-nowrap">
                    {a.final_score != null ? `· ${Number(a.final_score).toFixed(2)}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <ReasoningModal
        open={verdict !== null}
        onClose={() => setVerdict(null)}
        data={verdict}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="anim-fade">
      <div className="h-8 w-40 skeleton mb-2" />
      <div className="h-4 w-64 skeleton mb-7" />
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[...Array(4)].map((_, i) => (<div key={i} className="h-[100px] skeleton" />))}
      </div>
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-8 h-[360px] skeleton" />
        <div className="col-span-4 h-[360px] skeleton" />
      </div>
    </div>
  );
}
