'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { getDeveloperAnalytics } from '@/lib/api';

interface Skill { dimension: 'type' | 'label' | 'component'; value: string; count: number | string; }

interface Assignment {
  jira_key: string;
  summary: string;
  created_at: string;
  final_score?: number | null;
}

interface Analytics {
  activeTickets: number;
  avgResolutionHours: number;
  componentExpertise: { component: string; count: string }[];
  recentAssignments: Assignment[];
  topSkills: Skill[];
}

interface Developer {
  id: string;
  name: string;
  email: string;
  workload_capacity: number;
}

interface DossierData { developer: Developer; analytics: Analytics; }

const initials = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const avatarColor = (s: string) => ((s.charCodeAt(0) + s.charCodeAt(s.length - 1)) % 5) + 1;

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

export default function DeveloperDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [data, setData] = useState<DossierData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await getDeveloperAnalytics(id);
        if (res.success) setData({ developer: res.developer, analytics: res.analytics });
      } finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="anim-fade">
        <div className="h-4 w-24 skeleton mb-4" />
        <div className="h-14 w-60 skeleton mb-3" />
        <div className="h-4 w-80 skeleton mb-8" />
        <div className="grid grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (<div key={i} className="h-[96px] skeleton" />))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="anim-fade">
        <Link href="/dashboard/developers" className="text-[12.5px] text-fg-muted hover:text-blue inline-flex items-center gap-1 mb-6">
          <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
            <path d="M11 3L6 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back to team
        </Link>
        <div className="card py-16 text-center">
          <div className="text-[14px] font-medium text-fg mb-1">Developer not found</div>
          <div className="text-[12.5px] text-fg-subtle">This profile may have been removed.</div>
        </div>
      </div>
    );
  }

  const { developer, analytics } = data;
  const skills = analytics.topSkills || [];
  const typeSkills      = skills.filter(s => s.dimension === 'type');
  const labelSkills     = skills.filter(s => s.dimension === 'label');
  const componentSkills = skills.filter(s => s.dimension === 'component');

  const topType = [...typeSkills].sort((a, b) => Number(b.count) - Number(a.count))[0];
  const topComp = [...componentSkills].sort((a, b) => Number(b.count) - Number(a.count))[0];
  const totalFilings = skills.reduce((acc, s) => s.dimension === 'type' ? acc + Number(s.count) : acc, 0);

  const maxCount = (list: Skill[]) => Math.max(...list.map(s => Number(s.count)), 1);
  const util = developer.workload_capacity > 0
    ? Math.round((analytics.activeTickets / developer.workload_capacity) * 100)
    : 0;

  return (
    <div className="anim-fade">
      {/* Breadcrumb */}
      <Link href="/dashboard/developers" className="text-[12.5px] text-fg-muted hover:text-blue inline-flex items-center gap-1 mb-5">
        <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
          <path d="M11 3L6 8l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Team
      </Link>

      {/* Hero */}
      <div className="flex items-start gap-5 mb-7 anim-rise">
        <span className="avatar" data-size="xl" data-c={avatarColor(developer.name)}>{initials(developer.name)}</span>
        <div className="flex-1 min-w-0">
          <h1 className="h-display">{developer.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[13px]">
            <span className="mono text-fg-muted">{developer.email || '—'}</span>
            <span className="text-fg-faint">·</span>
            <span className="text-fg-muted">
              Capacity <span className="mono text-fg tnum">{developer.workload_capacity}</span>
            </span>
            {topType && (
              <>
                <span className="text-fg-faint">·</span>
                <span className="text-fg-muted">
                  Primary: <span className="text-fg font-medium">{topType.value}</span>
                </span>
              </>
            )}
            {topComp && (
              <>
                <span className="text-fg-faint">·</span>
                <span className="text-fg-muted">
                  Leads on <span className="text-fg font-medium">{topComp.value}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger">
        <div className="kpi anim-rise">
          <div className="kpi-label">Active load</div>
          <div className="kpi-value">{analytics.activeTickets}</div>
          <div className="kpi-foot mt-2">
            <div className="score-solo flex-1">
              <div className="score-solo-fill"
                data-tone={util > 80 ? 'danger' : util > 50 ? 'warning' : 'success'}
                style={{ width: `${Math.min(util, 100)}%` }} />
            </div>
            <span className="mono tnum shrink-0">{util}%</span>
          </div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">Avg resolution</div>
          <div className="kpi-value">
            {analytics.avgResolutionHours > 0 ? analytics.avgResolutionHours.toFixed(1) : '—'}
            {analytics.avgResolutionHours > 0 && <span className="text-fg-subtle text-[22px] ml-1">h</span>}
          </div>
          <div className="kpi-foot">per ticket</div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">Total filings</div>
          <div className="kpi-value">{totalFilings}</div>
          <div className="kpi-foot">resolved by this dev</div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">Skill signals</div>
          <div className="kpi-value">{skills.length}</div>
          <div className="kpi-foot">learned from history</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Skills */}
        <section className="lg:col-span-8">
          <div className="card anim-rise">
            <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
              <span className="h-section">Skill signals</span>
              <span className="text-[11.5px] text-fg-subtle">Learned from resolved tickets</span>
            </div>

            {skills.length === 0 ? (
              <div className="py-16 px-5 text-center">
                <div className="text-[13px] text-fg-subtle">No skill signals yet. Signals are built from resolved Jira tickets.</div>
              </div>
            ) : (
              <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-6">
                <SkillColumn title="Types" list={typeSkills} maxCount={maxCount(typeSkills)} />
                <SkillColumn title="Components" list={componentSkills.slice(0, 10)} maxCount={maxCount(componentSkills)} />
                <SkillColumn title="Labels" list={labelSkills.slice(0, 10)} maxCount={maxCount(labelSkills)} />
              </div>
            )}
          </div>

          {analytics.componentExpertise && analytics.componentExpertise.length > 0 && (
            <div className="card anim-rise mt-6">
              <div className="px-5 py-3.5 border-b border-border">
                <span className="h-section">Component history</span>
              </div>
              <div className="p-5 space-y-3">
                {analytics.componentExpertise.slice(0, 8).map((c) => {
                  const max = Math.max(...analytics.componentExpertise.map(x => Number(x.count)), 1);
                  const pct = Math.max((Number(c.count) / max) * 100, 3);
                  return (
                    <div key={c.component} className="grid grid-cols-[180px_1fr_60px] items-center gap-3">
                      <span className="mono text-[12px] text-fg truncate">{c.component}</span>
                      <div className="score-solo h-1.5">
                        <div className="score-solo-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="mono text-[11px] text-fg-muted tnum text-right">{c.count} tkts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Recent */}
        <section className="lg:col-span-4">
          <div className="card anim-rise">
            <div className="px-5 py-3.5 border-b border-border">
              <span className="h-section">Recent assignments</span>
            </div>
            {analytics.recentAssignments.length === 0 ? (
              <div className="py-12 px-5 text-center">
                <div className="text-[13px] text-fg-subtle">No assignments yet.</div>
              </div>
            ) : (
              <ol>
                {analytics.recentAssignments.slice(0, 10).map((a, i) => (
                  <li key={`${a.jira_key}-${i}`} className="row-hover px-4 py-3 border-b border-border-subtle last:border-b-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="mono text-[12px] text-blue-deep font-medium tnum">{a.jira_key}</span>
                      <span className="mono text-[10.5px] text-fg-subtle tnum ml-auto">{formatShortDate(a.created_at)}</span>
                    </div>
                    <p className="text-[12.5px] text-fg-muted leading-snug line-clamp-2">{a.summary}</p>
                    {a.final_score !== null && a.final_score !== undefined && (
                      <div className="mt-1.5 text-[10.5px] text-fg-subtle mono tnum">
                        Score · {Number(a.final_score).toFixed(2)}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SkillColumn({ title, list, maxCount }: { title: string; list: Skill[]; maxCount: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[11.5px] font-medium text-fg-muted uppercase tracking-wider">{title}</span>
        <span className="mono text-[10.5px] text-fg-subtle tnum">{list.length}</span>
      </div>
      {list.length === 0 ? (
        <div className="text-[12.5px] text-fg-subtle italic">No signals.</div>
      ) : (
        <ul className="space-y-2">
          {[...list].sort((a, b) => Number(b.count) - Number(a.count)).map((s) => {
            const pct = Math.max((Number(s.count) / maxCount) * 100, 8);
            return (
              <li key={s.value}>
                <div className="flex items-baseline justify-between mb-1">
                  <span className="text-[12.5px] text-fg truncate">{s.value}</span>
                  <span className="mono text-[10.5px] text-fg-subtle tnum">{s.count}</span>
                </div>
                <div className="score-solo h-1">
                  <div className="score-solo-fill" style={{ width: `${pct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
