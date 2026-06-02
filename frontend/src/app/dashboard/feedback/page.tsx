'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface DevFeedback {
  developerId: string;
  totalAssignments: number;
  completed: number;
  reassigned: number;
  completedLate: number;
  completedFast: number;
  avgResolutionHours: number;
  successRate: number;
}

interface DevInfo {
  id: string;
  name: string;
}

export default function FeedbackPage() {
  const [stats, setStats] = useState<DevFeedback[]>([]);
  const [devs, setDevs] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [fb, devRes] = await Promise.all([
          api.get('/feedback/team').then(r => r.json()),
          api.get('/developers').then(r => r.json()),
        ]);
        if (fb.success) setStats(fb.stats);
        if (devRes.success) {
          const map = new Map<string, string>();
          devRes.developers.forEach((d: DevInfo) => map.set(d.id, d.name));
          setDevs(map);
        }
      } finally { setLoading(false); }
    })();
  }, []);

  const totals = stats.reduce(
    (acc, s) => ({
      total: acc.total + s.totalAssignments,
      completed: acc.completed + s.completed + s.completedFast,
      reassigned: acc.reassigned + s.reassigned,
      late: acc.late + s.completedLate,
    }),
    { total: 0, completed: 0, reassigned: 0, late: 0 }
  );

  const teamSuccessRate = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  if (loading) {
    return (
      <div className="anim-fade flex items-center justify-center h-64">
        <div className="text-fg-muted text-sm">Loading feedback data…</div>
      </div>
    );
  }

  return (
    <div className="anim-fade">
      <div className="mb-6 anim-rise">
        <h1 className="h-page">Feedback & Learning</h1>
        <p className="text-[13.5px] text-fg-muted mt-1.5">
          Assignment outcomes tracked automatically · Score adjustments applied in real-time
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 stagger">
        <div className="card p-4">
          <div className="meta mb-1">Total outcomes</div>
          <div className="text-2xl font-semibold text-fg mono tnum">{totals.total}</div>
        </div>
        <div className="card p-4">
          <div className="meta mb-1">Success rate</div>
          <div className="text-2xl font-semibold text-green mono tnum">{teamSuccessRate}%</div>
        </div>
        <div className="card p-4">
          <div className="meta mb-1">Reassignments</div>
          <div className="text-2xl font-semibold text-coral mono tnum">{totals.reassigned}</div>
        </div>
        <div className="card p-4">
          <div className="meta mb-1">Completed late</div>
          <div className="text-2xl font-semibold text-amber mono tnum">{totals.late}</div>
        </div>
      </div>

      {/* Per-developer table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="text-[13px] font-semibold text-fg">Developer Performance</h2>
        </div>
        {stats.length === 0 ? (
          <div className="px-4 py-8 text-center text-fg-muted text-sm">
            No feedback data yet. Outcomes will be recorded as tickets are completed or reassigned.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-fg-subtle">
                  <th className="text-left px-4 py-2.5 font-medium">Developer</th>
                  <th className="text-right px-4 py-2.5 font-medium">Total</th>
                  <th className="text-right px-4 py-2.5 font-medium">Completed</th>
                  <th className="text-right px-4 py-2.5 font-medium">Fast</th>
                  <th className="text-right px-4 py-2.5 font-medium">Late</th>
                  <th className="text-right px-4 py-2.5 font-medium">Reassigned</th>
                  <th className="text-right px-4 py-2.5 font-medium">Avg Hours</th>
                  <th className="text-right px-4 py-2.5 font-medium">Success</th>
                </tr>
              </thead>
              <tbody>
                {stats
                  .sort((a, b) => b.successRate - a.successRate)
                  .map((s) => (
                    <tr key={s.developerId} className="border-b border-border last:border-0 hover:bg-n-20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-fg">
                        {devs.get(s.developerId) || s.developerId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5 text-right mono tnum">{s.totalAssignments}</td>
                      <td className="px-4 py-2.5 text-right mono tnum text-green">{s.completed}</td>
                      <td className="px-4 py-2.5 text-right mono tnum text-blue">{s.completedFast}</td>
                      <td className="px-4 py-2.5 text-right mono tnum text-amber">{s.completedLate}</td>
                      <td className="px-4 py-2.5 text-right mono tnum text-coral">{s.reassigned}</td>
                      <td className="px-4 py-2.5 text-right mono tnum">{s.avgResolutionHours.toFixed(1)}h</td>
                      <td className="px-4 py-2.5 text-right">
                        <span
                          className={`mono tnum font-semibold ${
                            s.successRate >= 0.8 ? 'text-green' : s.successRate >= 0.5 ? 'text-amber' : 'text-coral'
                          }`}
                        >
                          {Math.round(s.successRate * 100)}%
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
