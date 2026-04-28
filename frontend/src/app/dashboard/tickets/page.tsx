'use client';

import { useEffect, useRef, useState } from 'react';
import { getTickets, autoAssignTicket, getJiraStatus } from '@/lib/api';
import ReasoningModal, { VerdictData } from '@/components/ReasoningModal';

interface Ticket {
  id: string;
  jira_key: string;
  summary: string;
  status: string;
  priority: string;
  assignee_name: string | null;
  components: string[] | null;
  labels?: string[] | null;
  type?: string;
  created_at: string;
}

interface Pagination { page: number; limit: number; total: number; totalPages: number; }

const STATUSES: { label: string; value: string }[] = [
  { label: 'All',          value: '' },
  { label: 'Unassigned',   value: 'Unassigned' },
  { label: 'To Do',        value: 'To Do' },
  { label: 'In Progress',  value: 'In Progress' },
  { label: 'In Review',    value: 'In Review' },
  { label: 'Done',         value: 'Done' },
];

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const initials = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const avatarColor = (s: string) => ((s.charCodeAt(0) + s.charCodeAt(s.length - 1)) % 5) + 1;

function Sparkle({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2l1.3 3.7L13 7l-3.7 1.3L8 12l-1.3-3.7L3 7l3.7-1.3L8 2Z" fill="currentColor" />
      <path d="M13 11l.55 1.45L15 13l-1.45.55L13 15l-.55-1.45L11 13l1.45-.55L13 11Z" fill="currentColor" opacity="0.75" />
    </svg>
  );
}

export default function TicketsPage() {
  const [tickets, setTickets]         = useState<Ticket[]>([]);
  const [pagination, setPagination]   = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 0 });
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]               = useState(1);
  const [assigning, setAssigning]     = useState<string | null>(null);
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [verdict, setVerdict]         = useState<VerdictData | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getJiraStatus().then((r) => { if (r.connected) setJiraBaseUrl(r.baseUrl); });
  }, []);

  useEffect(() => {
    fetchTickets(search, statusFilter, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, page]);

  async function fetchTickets(q: string, status: string, p: number) {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(p), limit: '25' };
      if (q) params.search = q;
      if (status && status !== 'Unassigned') params.status = status;
      if (status === 'Unassigned') params.unassigned = 'true';
      const res = await getTickets(params);
      if (res.success) {
        setTickets(res.tickets);
        setPagination(res.pagination);
      }
    } finally { setLoading(false); }
  }

  function handleSearchChange(v: string) {
    setSearch(v);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setPage(1);
      fetchTickets(v, statusFilter, 1);
    }, 300);
  }

  async function handleAutoAssign(t: Ticket) {
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
        fetchTickets(search, statusFilter, page);
      }
    } finally { setAssigning(null); }
  }

  const jiraUrl = (key: string) => jiraBaseUrl ? `${jiraBaseUrl}/browse/${key}` : '#';
  const unassignedCount = tickets.filter(t => !t.assignee_name).length;

  return (
    <div className="anim-fade">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 anim-rise">
        <div>
          <h1 className="h-page">Tickets</h1>
          <p className="text-[13.5px] text-fg-muted mt-2">
            <span className="mono tnum">{pagination.total.toLocaleString()}</span> in the system
            {unassignedCount > 0 && (
              <> · <span className="mono tnum text-coral-deep font-semibold">{unassignedCount}</span> awaiting assignment</>
            )}
          </p>
        </div>
      </div>

      {/* Filter + search */}
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s.value || 'all'}
              onClick={() => { setStatusFilter(s.value); setPage(1); }}
              className="tab"
              data-active={statusFilter === s.value ? 'true' : 'false'}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-[320px]">
          <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fg-subtle pointer-events-none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by key, summary, or keyword…"
            className="input input-search"
          />
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="text-[13px] text-fg-subtle">Fetching tickets…</div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-[14px] font-semibold text-fg mb-1">No tickets match</div>
            <div className="text-[12.5px] text-fg-subtle">Try adjusting your filters or search query.</div>
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-[120px]">Key</th>
                <th>Summary</th>
                <th className="w-[110px]">Status</th>
                <th className="w-[112px]">Priority</th>
                <th className="w-[180px]">Assignee</th>
                <th className="w-[160px] text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td>
                    <a
                      href={jiraUrl(t.jira_key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mono text-[12.5px] text-blue-deep font-semibold hover:underline tnum"
                    >
                      {t.jira_key}
                    </a>
                    <div className="mono text-[10.5px] text-fg-subtle tnum mt-0.5">{formatDate(t.created_at)}</div>
                  </td>
                  <td>
                    <div className="text-[13.5px] text-fg leading-[1.4] line-clamp-2 max-w-[640px]">
                      {t.summary}
                    </div>
                    {(t.type || (t.components?.length ?? 0) > 0 || (t.labels?.length ?? 0) > 0) && (
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {t.type && <span className="pill">{t.type}</span>}
                        {(t.components || []).slice(0, 2).map((c) => (
                          <span key={c} className="pill" data-tone="blue">{c}</span>
                        ))}
                        {(t.labels || []).slice(0, 2).map((l) => (
                          <span key={l} className="pill" data-tone="purple">{l}</span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="pill">{t.status}</span>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-2">
                      <span className="dot" data-p={t.priority} />
                      <span className="text-[12.5px] text-fg-muted font-medium">{t.priority}</span>
                    </span>
                  </td>
                  <td>
                    {t.assignee_name ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="avatar" data-c={avatarColor(t.assignee_name)} style={{ width: 22, height: 22, fontSize: 10 }}>{initials(t.assignee_name)}</span>
                        <span className="text-[13px] text-fg truncate">{t.assignee_name}</span>
                      </span>
                    ) : (
                      <span className="text-[12.5px] text-fg-subtle italic">Unassigned</span>
                    )}
                  </td>
                  <td className="text-right">
                    {!t.assignee_name ? (
                      <button
                        onClick={() => handleAutoAssign(t)}
                        disabled={assigning === t.id}
                        className="btn"
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
                            <Sparkle className="w-3 h-3" />
                            Auto-assign
                          </>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleAutoAssign(t)}
                        disabled={assigning === t.id}
                        className="btn"
                        data-variant="ghost"
                        data-size="sm"
                      >
                        {assigning === t.id ? 'Reassigning…' : 'Reassign'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <span className="text-[12.5px] text-fg-subtle">
            Page <span className="mono tnum text-fg">{pagination.page}</span> of <span className="mono tnum text-fg">{pagination.totalPages}</span>
            <span className="mx-2">·</span>
            <span className="mono tnum">{pagination.total.toLocaleString()}</span> results
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="btn"
              data-size="sm"
            >
              <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
                <path d="M11 3L6 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="btn"
              data-size="sm"
            >
              Next
              <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
                <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <ReasoningModal
        open={verdict !== null}
        onClose={() => setVerdict(null)}
        data={verdict}
      />
    </div>
  );
}
