'use client';

import { useEffect, useState } from 'react';
import { getAssignments, getJiraStatus } from '@/lib/api';

interface Breakdown {
  expertise?: number;
  similarity?: number;
  workload?: number;
  fairness?: number;
  adjustments?: number;
  total?: number;
}

interface Assignment {
  id: string;
  jira_key: string;
  summary: string;
  developer_name: string | null;
  trigger_source: string;
  score_breakdown: Breakdown;
  final_score: number | null;
  reasoning_text: string | null;
  manual_override: boolean;
  created_at: string;
}

const initials = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const avatarColor = (s: string) => ((s.charCodeAt(0) + s.charCodeAt(s.length - 1)) % 5) + 1;

const timeAgo = (s: string): string => {
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const formatDateTime = (s: string): string =>
  new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

const triggerLabel = (t: string): string => {
  switch (t) {
    case 'webhook': return 'Webhook';
    case 'button':  return 'Manual';
    case 'auto':    return 'Auto';
    case 'manual':  return 'Manual';
    default:        return t;
  }
};

const triggerTone = (t: string) => {
  if (t === 'auto' || t === 'webhook') return 'coral';
  return 'solid';
};

const SIGNALS: { key: keyof Breakdown; label: string; color: string }[] = [
  { key: 'expertise',  label: 'Expertise',  color: 'var(--blue)'   },
  { key: 'similarity', label: 'Similarity', color: 'var(--blue-2)' },
  { key: 'workload',   label: 'Workload',   color: 'var(--green)'  },
  { key: 'fairness',   label: 'Fairness',   color: 'var(--yellow)' },
];

export default function AssignmentsPage() {
  const [rows, setRows]       = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [baseUrl, setBaseUrl] = useState('');
  const [filter, setFilter]   = useState<'all' | 'auto' | 'manual'>('all');

  useEffect(() => {
    (async () => {
      try {
        const [ass, jira] = await Promise.all([getAssignments(), getJiraStatus()]);
        if (ass.success) setRows(ass.assignments);
        if (jira.connected) setBaseUrl(jira.baseUrl);
      } finally { setLoading(false); }
    })();
  }, []);

  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const filtered = rows.filter(r => {
    if (filter === 'auto')   return !r.manual_override;
    if (filter === 'manual') return r.manual_override;
    return true;
  });

  const autoCount   = rows.filter(r => !r.manual_override).length;
  const manualCount = rows.length - autoCount;
  const thisWeek    = rows.filter(r => Date.now() - new Date(r.created_at).getTime() < 7 * 864e5).length;

  return (
    <div className="anim-fade">
      <div className="flex items-start justify-between mb-6 anim-rise">
        <div>
          <h1 className="h-page">Assignments</h1>
          <p className="text-[13.5px] text-fg-muted mt-1.5">
            Full history of ticket dispatches with reasoning and signal breakdown.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger">
        <div className="kpi anim-rise">
          <div className="kpi-label">Total</div>
          <div className="kpi-value">{rows.length.toLocaleString()}</div>
          <div className="kpi-foot">all assignments</div>
        </div>
        <div className="kpi kpi-ai anim-rise">
          <div className="kpi-label">Auto-matched</div>
          <div className="kpi-value">{autoCount.toLocaleString()}</div>
          <div className="kpi-foot">by AssignIQ</div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">Manual override</div>
          <div className="kpi-value">{manualCount.toLocaleString()}</div>
          <div className="kpi-foot">by reviewer</div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">This week</div>
          <div className="kpi-value">{thisWeek.toLocaleString()}</div>
          <div className="kpi-foot">last 7 days</div>
        </div>
      </div>

      <div className="flex items-center gap-1 mb-4">
        <button className="tab" data-active={filter === 'all' ? 'true' : 'false'} onClick={() => setFilter('all')}>
          All <span className="tab-count">{rows.length}</span>
        </button>
        <button className="tab" data-active={filter === 'auto' ? 'true' : 'false'} onClick={() => setFilter('auto')}>
          Auto <span className="tab-count">{autoCount}</span>
        </button>
        <button className="tab" data-active={filter === 'manual' ? 'true' : 'false'} onClick={() => setFilter('manual')}>
          Manual <span className="tab-count">{manualCount}</span>
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-[13px] text-fg-subtle">Loading assignments…</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="text-[14px] font-medium text-fg mb-1">No assignments yet</div>
            <div className="text-[12.5px] text-fg-subtle">When tickets are assigned, they will appear here.</div>
          </div>
        ) : (
          <ul>
            {filtered.map((r) => {
              const isOpen = expanded.has(r.id);
              return (
                <li key={r.id} className="border-b border-border-subtle last:border-b-0">
                  <button
                    onClick={() => toggle(r.id)}
                    className="w-full grid grid-cols-[90px_1fr_auto_auto] items-center gap-4 px-5 py-3.5 row-hover text-left"
                  >
                    <span className="mono text-[11.5px] text-fg-subtle tnum">{timeAgo(r.created_at)}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <a
                          href={baseUrl ? `${baseUrl}/browse/${r.jira_key}` : '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mono text-[12.5px] text-blue-deep font-medium hover:underline tnum"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {r.jira_key}
                        </a>
                        <span className="text-fg-faint">·</span>
                        <span className="pill" data-tone={triggerTone(r.trigger_source)}>{triggerLabel(r.trigger_source)}</span>
                        {r.manual_override && <span className="pill" data-tone="warning">Overridden</span>}
                      </div>
                      <div className="text-[13px] text-fg truncate">{r.summary}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {r.developer_name ? (
                        <>
                          <span className="avatar" data-c={avatarColor(r.developer_name)} style={{ width: 22, height: 22, fontSize: 10 }}>{initials(r.developer_name)}</span>
                          <span className="text-[13px] text-fg">{r.developer_name}</span>
                        </>
                      ) : (
                        <span className="text-[12.5px] text-fg-subtle italic">Unassigned</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="mono text-[15px] font-medium text-fg tnum">
                          {r.final_score !== null ? r.final_score.toFixed(2) : '—'}
                        </div>
                        <div className="text-[10px] text-fg-subtle uppercase tracking-wider">score</div>
                      </div>
                      <svg viewBox="0 0 16 16" fill="none" className={`w-3.5 h-3.5 text-fg-subtle transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                        <path d="M3 6l5 5 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 bg-bg-2/40 anim-fade">
                      <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-6 pt-3 border-t border-border-subtle">
                        <div>
                          <div className="text-[11.5px] text-fg-subtle uppercase tracking-wider mb-2 font-medium">Reasoning</div>
                          {r.reasoning_text ? (
                            <p className="text-[13.5px] text-fg leading-[1.6] text-pretty">
                              {r.reasoning_text}
                            </p>
                          ) : (
                            <p className="text-[13px] text-fg-subtle italic">No reasoning recorded.</p>
                          )}
                          <div className="mt-4 text-[11.5px] text-fg-subtle mono tnum">
                            Filed · {formatDateTime(r.created_at)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11.5px] text-fg-subtle uppercase tracking-wider mb-3 font-medium">Signal breakdown</div>
                          <div className="space-y-2.5">
                            {SIGNALS.map(({ key, label, color }) => {
                              const v = r.score_breakdown?.[key];
                              if (v === undefined || v === null) return null;
                              const pct = Math.max(0, Math.min(100, Number(v) * 100));
                              return (
                                <div key={key}>
                                  <div className="flex items-baseline justify-between mb-1">
                                    <span className="text-[12px] text-fg-muted">{label}</span>
                                    <span className="mono text-[11px] text-fg tnum">{Number(v).toFixed(2)}</span>
                                  </div>
                                  <div className="score-solo h-1">
                                    <div className="score-solo-fill" style={{ width: `${pct}%`, background: color }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
