'use client';

import { useEffect, useState } from 'react';
import { getSettings, updateSettings, getJiraStatus, connectJira, syncJira } from '@/lib/api';

interface Settings {
  expertise_weight:  number;
  similarity_weight: number;
  workload_weight:   number;
  fairness_weight:   number;
  sync_frequency:    number;
  ml_enabled:        boolean;
}

interface JiraStatus {
  connected: boolean;
  baseUrl?: string;
  lastSyncAt?: string;
  ticketCount?: number;
}

const normalize = (p: Partial<Record<string, unknown>> = {}): Settings => {
  const num = (k: string, d: number): number => {
    const v = p[k] ?? p[k.replace('_', '')];
    const n = typeof v === 'number' ? v : parseFloat(v as string);
    return Number.isFinite(n) ? Number(n) : d;
  };
  return {
    expertise_weight:  num('expertise_weight',  0.30),
    similarity_weight: num('similarity_weight', 0.25),
    workload_weight:   num('workload_weight',   0.25),
    fairness_weight:   num('fairness_weight',   0.20),
    sync_frequency:    num('sync_frequency',    60),
    ml_enabled: Boolean(p.ml_enabled ?? p.mlEnabled ?? false),
  };
};

const WEIGHTS: { key: keyof Settings; label: string; description: string; color: string }[] = [
  { key: 'expertise_weight',  label: 'Expertise',  description: 'Prior tickets on the same component or type.', color: 'var(--blue)'   },
  { key: 'similarity_weight', label: 'Similarity', description: 'Affinity by ticket type, labels, components.',  color: 'var(--blue-2)' },
  { key: 'workload_weight',   label: 'Workload',   description: 'Current capacity. Lighter load wins.',          color: 'var(--green)'  },
  { key: 'fairness_weight',   label: 'Fairness',   description: 'Even distribution across the team.',            color: 'var(--yellow)' },
];

export default function SettingsPage() {
  const [settings, setSettings]   = useState<Settings>(normalize());
  const [jira, setJira]           = useState<JiraStatus>({ connected: false });
  const [form, setForm]           = useState({ baseUrl: '', apiToken: '', userEmail: '' });
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [syncing, setSyncing]     = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage]     = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, j] = await Promise.all([getSettings(), getJiraStatus()]);
        if (s.success) setSettings(normalize(s.settings));
        if (j.success) setJira(j);
      } finally { setLoading(false); }
    })();
  }, []);

  const weightTotal =
    Number(settings.expertise_weight) +
    Number(settings.similarity_weight) +
    Number(settings.workload_weight) +
    Number(settings.fairness_weight);
  const balanced = Math.abs(weightTotal - 1) < 0.01;

  async function save() {
    setSaving(true); setMessage(null);
    try {
      const res = await updateSettings({
        expertiseWeight:  settings.expertise_weight,
        similarityWeight: settings.similarity_weight,
        workloadWeight:   settings.workload_weight,
        fairnessWeight:   settings.fairness_weight,
        syncFrequency:    settings.sync_frequency,
        mlEnabled:        settings.ml_enabled,
      });
      setMessage(res.success
        ? { ok: true,  text: 'Settings saved.' }
        : { ok: false, text: res.error || 'Could not save settings.' });
    } catch {
      setMessage({ ok: false, text: 'Network error. Please try again.' });
    } finally { setSaving(false); }
  }

  async function connect() {
    setConnecting(true); setMessage(null);
    try {
      const r = await connectJira(form.baseUrl, form.apiToken, form.userEmail);
      if (r.success) {
        setMessage({ ok: true, text: 'Connected to Jira.' });
        const j = await getJiraStatus();
        if (j.success) setJira(j);
      } else {
        setMessage({ ok: false, text: r.error || 'Connection failed.' });
      }
    } catch { setMessage({ ok: false, text: 'Connection failed.' }); }
    finally { setConnecting(false); }
  }

  async function sync() {
    setSyncing(true); setMessage(null);
    try {
      const r = await syncJira();
      setMessage(r.success
        ? { ok: true,  text: r.message || 'Sync complete.' }
        : { ok: false, text: r.error || 'Sync failed.' });
      const j = await getJiraStatus();
      if (j.success) setJira(j);
    } catch { setMessage({ ok: false, text: 'Sync failed.' }); }
    finally { setSyncing(false); }
  }

  if (loading) {
    return (
      <div className="anim-fade">
        <div className="h-8 w-40 skeleton mb-2" />
        <div className="h-4 w-64 skeleton mb-7" />
        <div className="grid grid-cols-2 gap-6">
          <div className="h-[400px] skeleton" />
          <div className="h-[400px] skeleton" />
        </div>
      </div>
    );
  }

  return (
    <div className="anim-fade">
      <div className="mb-6 anim-rise">
        <h1 className="h-page">Settings</h1>
        <p className="text-[13.5px] text-fg-muted mt-1.5">
          Configure Jira connection and scoring weights.
        </p>
      </div>

      {message && (
        <div
          className="mb-6 p-3 flex items-center gap-3 rounded-r-sm border-l-[3px] anim-fade"
          style={{
            borderLeftColor: message.ok ? 'var(--success)' : 'var(--danger)',
            background: message.ok ? 'var(--success-soft)' : 'var(--danger-soft)',
          }}
        >
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ background: message.ok ? 'var(--success)' : 'var(--danger)' }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-white">
              {message.ok
                ? <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                : <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              }
            </svg>
          </div>
          <span className="text-[13px]" style={{ color: message.ok ? 'var(--success)' : 'var(--danger)' }}>
            {message.text}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* JIRA */}
        <section className="card anim-rise">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <span className="h-section">Jira connection</span>
            {jira.connected ? (
              <span className="pill" data-tone="success">
                <span className="live-dot" />
                Connected
              </span>
            ) : (
              <span className="pill" data-tone="danger">Disconnected</span>
            )}
          </div>

          <div className="p-5">
            {jira.connected ? (
              <div className="space-y-4">
                <dl className="space-y-3">
                  <div className="flex items-baseline justify-between border-b border-border-subtle pb-2.5">
                    <dt className="text-[12.5px] text-fg-muted">Base URL</dt>
                    <dd className="mono text-[12px] text-fg truncate max-w-[60%]">{jira.baseUrl}</dd>
                  </div>
                  <div className="flex items-baseline justify-between border-b border-border-subtle pb-2.5">
                    <dt className="text-[12.5px] text-fg-muted">Tickets synced</dt>
                    <dd className="mono text-[13px] text-fg tnum">{jira.ticketCount?.toLocaleString() ?? '—'}</dd>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <dt className="text-[12.5px] text-fg-muted">Last sync</dt>
                    <dd className="mono text-[12px] text-fg-muted tnum">
                      {jira.lastSyncAt
                        ? new Date(jira.lastSyncAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                        : 'Never'}
                    </dd>
                  </div>
                </dl>
                <button
                  onClick={sync}
                  disabled={syncing}
                  className="btn w-full justify-center"
                  data-variant="primary"
                >
                  {syncing ? (
                    <>
                      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 animate-spin">
                        <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                      Syncing…
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                        <path d="M2.5 8a5.5 5.5 0 0 1 9.5-3.8M13.5 8a5.5 5.5 0 0 1-9.5 3.8M11 2v2.5h2.5M5 14v-2.5H2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Sync now
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label htmlFor="baseUrl" className="label">Base URL</label>
                  <input
                    id="baseUrl"
                    type="url"
                    value={form.baseUrl}
                    onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                    placeholder="https://your-domain.atlassian.net"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="userEmail" className="label">Atlassian email</label>
                  <input
                    id="userEmail"
                    type="email"
                    value={form.userEmail}
                    onChange={(e) => setForm({ ...form, userEmail: e.target.value })}
                    placeholder="you@your-domain.com"
                    className="input"
                  />
                </div>
                <div>
                  <label htmlFor="apiToken" className="label">API token</label>
                  <input
                    id="apiToken"
                    type="password"
                    value={form.apiToken}
                    onChange={(e) => setForm({ ...form, apiToken: e.target.value })}
                    placeholder="Your Atlassian API token"
                    className="input"
                  />
                  <div className="mt-1.5 text-[11.5px] text-fg-subtle">
                    Get one at <span className="mono">id.atlassian.com/manage/api-tokens</span>
                  </div>
                </div>
                <button
                  onClick={connect}
                  disabled={connecting || !form.baseUrl || !form.apiToken || !form.userEmail}
                  className="btn w-full justify-center"
                  data-variant="primary"
                >
                  {connecting ? 'Connecting…' : 'Connect to Jira'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* WEIGHTS */}
        <section className="card anim-rise">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
            <span className="h-section">Scoring weights</span>
            <span
              className="mono text-[11.5px] tnum px-2 py-0.5 rounded-sm"
              style={{
                color: balanced ? 'var(--success)' : 'var(--danger)',
                background: balanced ? 'var(--success-soft)' : 'var(--danger-soft)',
              }}
            >
              Σ {weightTotal.toFixed(2)} {balanced ? '✓' : '×'}
            </span>
          </div>

          <div className="p-5">
            {!balanced && (
              <div className="mb-5 p-2.5 rounded-sm border-l-[3px] border-danger bg-danger-soft text-[12.5px] text-danger">
                Weights must sum to 1.00. Adjust the sliders below.
              </div>
            )}

            <div className="space-y-5 mb-6">
              {WEIGHTS.map((w) => {
                const v = settings[w.key] as number;
                return (
                  <div key={String(w.key)}>
                    <div className="flex items-baseline justify-between mb-2">
                      <div className="flex items-baseline gap-2">
                        <span className="w-2 h-2 rounded-sm rotate-45 translate-y-[2px]" style={{ background: w.color }} />
                        <span className="text-[13.5px] text-fg font-medium">{w.label}</span>
                        <span className="text-[12px] text-fg-subtle">{w.description}</span>
                      </div>
                      <span className="mono text-[12.5px] text-fg tnum">{v.toFixed(2)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={v}
                      onChange={(e) => setSettings({ ...settings, [w.key]: parseFloat(e.target.value) })}
                      className="w-full"
                    />
                  </div>
                );
              })}
            </div>

            <div className="pt-5 border-t border-border-subtle">
              <label htmlFor="syncFreq" className="label">Sync frequency</label>
              <div className="flex items-center gap-3">
                <input
                  id="syncFreq"
                  type="number"
                  min="5"
                  max="1440"
                  value={settings.sync_frequency}
                  onChange={(e) => setSettings({ ...settings, sync_frequency: parseInt(e.target.value, 10) || 0 })}
                  className="input max-w-[140px]"
                />
                <span className="text-[12.5px] text-fg-subtle">minutes between Jira syncs</span>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-border-subtle flex items-center justify-end">
              <button
                onClick={save}
                disabled={saving || !balanced}
                className="btn"
                data-variant="primary"
              >
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
