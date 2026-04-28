'use client';

import { useEffect } from 'react';

export interface VerdictBreakdown {
  expertise?:  number;
  similarity?: number;
  workload?:   number;
  fairness?:   number;
  adjustments?: number;
  total: number;
}

export interface VerdictData {
  ticketKey: string;
  ticketSummary?: string;
  developerName: string;
  breakdown: VerdictBreakdown;
  reasoning?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  data: VerdictData | null;
}

const SIGNALS: { key: keyof VerdictBreakdown; label: string; color: string }[] = [
  { key: 'expertise',  label: 'Expertise',  color: 'var(--blue)'   },
  { key: 'similarity', label: 'Similarity', color: 'var(--blue-2)' },
  { key: 'workload',   label: 'Workload',   color: 'var(--green)'  },
  { key: 'fairness',   label: 'Fairness',   color: 'var(--yellow)' },
];

const initials = (n: string) =>
  n.split(' ').filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const avatarColor = (s: string) => ((s.charCodeAt(0) + s.charCodeAt(s.length - 1)) % 5) + 1;

export default function ReasoningModal({ open, onClose, data }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || !data) return null;
  const { breakdown } = data;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Assignment reasoning"
      className="fixed inset-0 z-50 flex items-center justify-center anim-fade px-5 py-8"
    >
      <div className="absolute inset-0 bg-fg/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-[580px] max-h-[88vh] overflow-y-auto scrollbar-thin bg-surface border border-border rounded-r-lg shadow-2xl anim-scale">

        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between sticky top-0 bg-surface z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'var(--coral-soft)' }}>
              <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 text-coral-deep">
                <path d="M8 2l1.3 3.7L13 7l-3.7 1.3L8 12l-1.3-3.7L3 7l3.7-1.3L8 2Z" fill="currentColor" />
                <path d="M13 11l.55 1.45L15 13l-1.45.55L13 15l-.55-1.45L11 13l1.45-.55L13 11Z" fill="currentColor" opacity="0.75" />
              </svg>
            </div>
            <span className="text-[14px] font-semibold text-fg">Auto-assignment complete</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="btn"
            data-variant="ghost"
            data-size="sm"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pt-5 pb-6">
          {/* Ticket + dev */}
          <div className="flex items-center gap-3 mb-5">
            <span className="mono text-[12.5px] text-blue-deep font-semibold tnum bg-blue-soft px-2 py-1 rounded-r-sm">
              {data.ticketKey}
            </span>
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-coral">
              <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="avatar" data-c={avatarColor(data.developerName)}>{initials(data.developerName)}</span>
            <span className="text-[15px] font-semibold text-fg">{data.developerName}</span>
          </div>

          {data.ticketSummary && (
            <p className="text-[13.5px] text-fg-muted leading-[1.55] mb-5 text-pretty">
              {data.ticketSummary}
            </p>
          )}

          {/* Score hero */}
          <div className="rounded-r p-5 mb-5 relative overflow-hidden" style={{
            background: 'linear-gradient(135deg, var(--blue-tint) 0%, var(--coral-soft) 100%)',
            border: '1px solid var(--border)',
          }}>
            <div className="flex items-baseline justify-between mb-3">
              <span className="text-[11px] font-semibold text-fg-muted uppercase tracking-[0.08em]">
                Affinity score
              </span>
              <div className="serif text-[44px] font-normal text-fg tnum leading-none tracking-[-0.025em]">
                {breakdown.total.toFixed(2)}
              </div>
            </div>

            {/* Stacked segmented bar showing contribution of each signal */}
            <div className="score-bar h-[10px]">
              {SIGNALS.map(({ key, color }) => {
                const v = breakdown[key];
                if (v === undefined || v === null) return null;
                const width = (Number(v) / Math.max(breakdown.total, 0.01)) * 100;
                return (
                  <div
                    key={key}
                    className="score-seg"
                    data-k={key}
                    style={{ width: `${width}%`, background: color }}
                  />
                );
              })}
            </div>

            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {SIGNALS.map(({ key, label, color }) => {
                const v = breakdown[key];
                if (v === undefined || v === null) return null;
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm" style={{ background: color }} />
                    <span className="text-[11.5px] text-fg-muted">{label}</span>
                    <span className="mono text-[11.5px] text-fg tnum">{Number(v).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Per-signal detail */}
          <div className="mb-5">
            <div className="text-[11.5px] text-fg-subtle uppercase tracking-wider font-medium mb-3">
              Signal breakdown
            </div>
            <div className="space-y-2.5">
              {SIGNALS.map(({ key, label, color }) => {
                const v = breakdown[key];
                if (v === undefined || v === null) return null;
                const pct = Math.max(0, Math.min(100, Number(v) * 100));
                return (
                  <div key={key} className="grid grid-cols-[104px_1fr_48px] items-center gap-3">
                    <span className="text-[13px] text-fg">{label}</span>
                    <div className="score-solo h-[5px]">
                      <div className="score-solo-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="mono text-[12px] text-fg tnum text-right">
                      {Number(v).toFixed(2)}
                    </span>
                  </div>
                );
              })}
              {breakdown.adjustments !== undefined && breakdown.adjustments !== 0 && (
                <div className="grid grid-cols-[104px_1fr_48px] items-center gap-3 pt-2 border-t border-border-subtle">
                  <span className="text-[12.5px] text-fg-muted italic">Adjustments</span>
                  <div />
                  <span className="mono text-[12px] text-fg-muted tnum text-right">
                    {breakdown.adjustments > 0 ? '+' : ''}
                    {breakdown.adjustments.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Reasoning */}
          {data.reasoning && (
            <div className="pt-5 border-t border-border-subtle">
              <div className="text-[11.5px] text-fg-subtle uppercase tracking-wider font-medium mb-2">
                Reasoning
              </div>
              <p className="text-[13.5px] text-fg leading-[1.6] text-pretty">
                {data.reasoning}
              </p>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t border-border-subtle flex items-center justify-between">
            <span className="text-[11.5px] text-fg-subtle mono tnum">
              {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button onClick={onClose} className="btn" data-variant="primary" data-size="sm">
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
