'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/backend/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg flex items-stretch">

      {/* LEFT — editorial narrative panel */}
      <div className="hidden lg:flex flex-col w-[54%] p-14 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--blue-deep) 0%, var(--blue) 55%, oklch(45% 0.18 250) 100%)' }}
      >
        {/* Dot grid atmosphere */}
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }} />
        {/* Coral glow — the AI signature in the top-right */}
        <div className="absolute top-0 right-0 w-[520px] h-[520px] rounded-full opacity-40" style={{
          background: 'radial-gradient(circle, rgba(240, 136, 97, 0.6) 0%, transparent 60%)',
          transform: 'translate(25%, -40%)',
        }} />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-2.5 mb-auto">
          <div className="w-9 h-9 rounded-r bg-white flex items-center justify-center text-blue-deep font-semibold text-[16px] tracking-tight shrink-0 relative overflow-hidden">
            <span className="relative z-10">A</span>
            <span className="absolute right-0 top-0 w-3.5 h-3.5 rounded-full bg-coral" style={{ transform: 'translate(35%,-35%)' }} />
          </div>
          <div>
            <div className="text-white text-[17px] font-semibold tracking-tight leading-none">SprintIQ</div>
            <div className="text-white/55 text-[10.5px] mt-1 font-semibold tracking-[0.12em] uppercase">for Jira</div>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10 max-w-[500px] anim-rise">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 mb-6 rounded-full text-[11px] font-semibold tracking-[0.08em] uppercase text-white border border-white/15"
            style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(6px)' }}
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3 text-coral-glow">
              <path d="M8 2l1.3 3.7L13 7l-3.7 1.3L8 12l-1.3-3.7L3 7l3.7-1.3L8 2Z" fill="currentColor" />
            </svg>
            Intelligent ticket assignment
          </div>

          <h2 className="text-[56px] leading-[1.02] tracking-[-0.03em] text-white mb-6 font-normal font-sans">
            The right ticket, to the
            <br />
            right engineer, <span className="serif italic text-coral-glow" style={{ fontWeight: 400 }}>automatically</span>.
          </h2>

          <p className="text-[15.5px] text-white/70 leading-[1.6] text-balance max-w-[440px]">
            SprintIQ weighs every Jira ticket against your team&apos;s expertise,
            current load, and resolution history &mdash; so assignments ship faster and
            fairer, without a standup war.
          </p>
        </div>

        {/* Stat row */}
        <div className="relative z-10 mt-14 grid grid-cols-3 gap-6 border-t border-white/12 pt-7">
          {[
            { value: '4',    suffix: '×',   label: 'scoring dimensions' },
            { value: '<1',   suffix: 's',   label: 'assignment latency' },
            { value: '100',  suffix: '%',   label: 'audit-trail transparency' },
          ].map((s) => (
            <div key={s.label}>
              <div className="flex items-baseline gap-1 text-white">
                <span className="serif text-[42px] font-normal leading-none tnum tracking-tight">{s.value}</span>
                <span className="serif italic text-[28px] text-coral-glow leading-none">{s.suffix}</span>
              </div>
              <div className="text-[11.5px] text-white/55 mt-2 font-medium">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="relative z-10 mt-auto pt-8 flex items-center justify-between text-[11px] text-white/40 mono">
          <span>© MMXXVI SprintIQ</span>
          <span>v1.0</span>
        </div>
      </div>

      {/* RIGHT — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[380px] anim-rise">

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-2.5 mb-10">
            <div className="w-8 h-8 rounded-r bg-blue flex items-center justify-center text-white font-semibold text-[15px] relative overflow-hidden">
              <span className="relative z-10">A</span>
              <span className="absolute right-0 top-0 w-3 h-3 rounded-full bg-coral" style={{ transform: 'translate(35%,-35%)' }} />
            </div>
            <div className="text-[16px] font-semibold tracking-tight text-fg">SprintIQ</div>
          </div>

          <h1 className="h-display mb-2">Sign in</h1>
          <p className="text-[13.5px] text-fg-muted mb-7">
            Welcome back. Enter your credentials to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-r-sm border-l-[3px] border-red bg-red-soft anim-fade">
                <div className="text-[12.5px] text-red font-semibold mb-0.5">Sign in failed</div>
                <div className="text-[12.5px] text-red">{error}</div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="you@company.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                data-variant="primary"
                className="btn w-full justify-center"
                data-size="lg"
              >
                {loading ? (
                  <>
                    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5 animate-spin">
                      <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                    Signing in
                  </>
                ) : (
                  <>
                    Sign in
                    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5">
                      <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-8 pt-5 border-t border-border">
            <div className="text-[10.5px] text-fg-subtle uppercase tracking-[0.08em] font-semibold mb-2">Demo credentials</div>
            <div className="mono text-[12px] text-fg-muted leading-[1.7]">
              admin@assigniq.local
              <br />
              admin123
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
