'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDevelopers } from '@/lib/api';

interface Developer {
  id: string;
  name: string;
  email: string;
  workload_capacity: number;
  active_tickets: string;
  recent_assignments: string;
  expertise_tags: string[] | null;
}

const initials = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const avatarColor = (s: string) => ((s.charCodeAt(0) + s.charCodeAt(s.length - 1)) % 5) + 1;

const loadTone = (pct: number): 'success' | 'warning' | 'danger' =>
  pct > 80 ? 'danger' : pct > 50 ? 'warning' : 'success';

type SortKey = 'name' | 'load' | 'recent';

export default function DevelopersPage() {
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading]       = useState(true);
  const [sort, setSort]             = useState<SortKey>('load');

  useEffect(() => {
    (async () => {
      try {
        const res = await getDevelopers();
        if (res.success) setDevelopers(res.developers);
      } finally { setLoading(false); }
    })();
  }, []);

  const sorted = [...developers].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'load') {
      const au = (parseInt(a.active_tickets, 10) / Math.max(a.workload_capacity, 1)) || 0;
      const bu = (parseInt(b.active_tickets, 10) / Math.max(b.workload_capacity, 1)) || 0;
      return bu - au;
    }
    return parseInt(b.recent_assignments, 10) - parseInt(a.recent_assignments, 10);
  });

  const totalCapacity  = developers.reduce((a, d) => a + d.workload_capacity, 0);
  const totalActive    = developers.reduce((a, d) => a + parseInt(d.active_tickets, 10), 0);
  const teamUtilization = totalCapacity > 0 ? Math.round((totalActive / totalCapacity) * 100) : 0;
  const available       = developers.filter(d => {
    const pct = (parseInt(d.active_tickets, 10) / Math.max(d.workload_capacity, 1)) * 100;
    return pct < 80;
  }).length;

  return (
    <div className="anim-fade">
      <div className="flex items-start justify-between mb-6 anim-rise">
        <div>
          <h1 className="h-page">Team</h1>
          <p className="text-[13.5px] text-fg-muted mt-1.5">
            <span className="mono tnum">{developers.length}</span> developers ·
            <span className="mono tnum"> {available}</span> available ·
            team load <span className="mono tnum">{teamUtilization}%</span>
          </p>
        </div>
        <div className="flex items-center gap-1">
          {(['load','name','recent'] as SortKey[]).map((k) => (
            <button key={k} className="tab" data-active={sort === k ? 'true' : 'false'} onClick={() => setSort(k)}>
              {k === 'load' ? 'By load' : k === 'name' ? 'By name' : 'By recent'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger">
        <div className="kpi anim-rise">
          <div className="kpi-label">Developers</div>
          <div className="kpi-value">{developers.length}</div>
          <div className="kpi-foot">on the roster</div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">Available now</div>
          <div className="kpi-value" style={{ color: 'var(--success)' }}>{available}</div>
          <div className="kpi-foot">under 80% load</div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">Total capacity</div>
          <div className="kpi-value">{totalCapacity}</div>
          <div className="kpi-foot">ticket slots</div>
        </div>
        <div className="kpi anim-rise">
          <div className="kpi-label">Team utilization</div>
          <div className="kpi-value">{teamUtilization}<span className="text-[24px] text-fg-subtle">%</span></div>
          <div className="kpi-foot">
            <div className="score-solo flex-1">
              <div className="score-solo-fill" data-tone={loadTone(teamUtilization)} style={{ width: `${teamUtilization}%` }} />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (<div key={i} className="h-[144px] skeleton" />))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="card py-16 text-center">
          <div className="text-[14px] font-medium text-fg mb-1">No developers yet</div>
          <div className="text-[12.5px] text-fg-subtle">Sync with Jira to populate the roster.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 stagger">
          {sorted.map((dev) => {
            const active = parseInt(dev.active_tickets, 10);
            const util = dev.workload_capacity > 0 ? Math.round((active / dev.workload_capacity) * 100) : 0;
            const tone = loadTone(util);
            return (
              <Link
                key={dev.id}
                href={`/dashboard/developers/${dev.id}`}
                className="card p-4 hover:border-border-strong transition-colors anim-rise block group"
              >
                <div className="flex items-start gap-3 mb-4">
                  <span className="avatar" data-size="lg" data-c={avatarColor(dev.name)}>{initials(dev.name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[15px] font-semibold text-fg tracking-tight truncate group-hover:text-blue transition-colors">
                        {dev.name}
                      </h3>
                    </div>
                    <div className="mono text-[11px] text-fg-subtle truncate mt-0.5">{dev.email || '—'}</div>
                  </div>
                  {tone === 'danger'  && <span className="pill" data-tone="danger">Busy</span>}
                  {tone === 'warning' && <span className="pill" data-tone="warning">Steady</span>}
                  {tone === 'success' && <span className="pill" data-tone="success">Available</span>}
                </div>

                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-baseline justify-between mb-1.5">
                      <span className="text-[11.5px] text-fg-muted font-medium">Load</span>
                      <span className="mono text-[11.5px] text-fg tnum">
                        <span className="text-fg">{active}</span>
                        <span className="text-fg-faint mx-0.5">/</span>
                        <span className="text-fg-subtle">{dev.workload_capacity}</span>
                        <span className="text-fg-subtle ml-2">{util}%</span>
                      </span>
                    </div>
                    <div className="score-solo">
                      <div className="score-solo-fill" data-tone={tone} style={{ width: `${Math.min(util, 100)}%` }} />
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between pt-2 border-t border-border-subtle">
                    <span className="text-[11.5px] text-fg-muted">Last 30 days</span>
                    <span className="mono text-[12.5px] text-fg tnum">{dev.recent_assignments} assignments</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
