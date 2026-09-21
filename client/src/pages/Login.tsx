import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, ShieldCheck, Users, BookOpenCheck } from 'lucide-react';
import { get } from '@/lib/api';
import { homeFor, useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { Alert, Button, Input } from '@/components/ui';
import { LanguageSelector } from '@/components/layout/AppShell';
import type { Role } from '@shared/types';

interface DemoAccount {
  role: Role;
  email: string;
  password: string;
  name: string;
  description: string;
}

export function LoginPage() {
  const { user, loading, demoLogin, login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const accounts = useQuery({
    queryKey: ['demo-accounts'],
    queryFn: () => get<{ demoMode: boolean; accounts: DemoAccount[] }>('/auth/demo-accounts'),
  });

  if (!loading && user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? homeFor(user.role)} replace />;

  const go = (role: Role) => navigate(homeFor(role), { replace: true });

  const onDemo = async (role: Role) => {
    setError(null);
    setBusy(role);
    try {
      const u = await demoLogin(role);
      go(u.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy('form');
    try {
      const u = await login(email, password);
      go(u.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(null);
    }
  };

  const roleCards: { role: Role; icon: React.ReactNode; title: string; blurb: string }[] = [
    { role: 'student', icon: <BookOpenCheck className="h-5 w-5" />, title: 'Student', blurb: 'Learn, practice, get adaptive recommendations, build projects.' },
    { role: 'teacher', icon: <Users className="h-5 w-5" />, title: 'Teacher', blurb: 'Track class progress, weak areas, assignments and analytics.' },
    { role: 'admin', icon: <ShieldCheck className="h-5 w-5" />, title: 'Admin', blurb: 'Platform stats, users and demo data management.' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-2">
        <section className="text-white">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
              <GraduationCap className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">AIESES</h1>
              <p className="text-sm text-brand-100">AI-Enabled Smart Education System</p>
            </div>
          </div>
          <p className="mt-8 text-2xl font-semibold leading-snug">{t('tagline')}</p>
          <p className="mt-3 max-w-lg text-brand-100">
            One integrated platform for school learners in India: curriculum lessons in English, हिन्दी and தமிழ், an AI tutor grounded in the syllabus, adaptive practice, a document studio, and a safe coding workspace — with a teacher
            dashboard for progress and weak-area analytics.
          </p>
          <ul className="mt-6 grid grid-cols-2 gap-3 text-sm text-brand-50 sm:grid-cols-3">
            {['Adaptive Recommendation MVP', 'AI Tutor (grounded)', 'Multilingual content', 'Document → PDF', 'Sandbox code runner', 'Teacher analytics'].map((f) => (
              <li key={f} className="rounded-lg bg-white/10 px-3 py-2 ring-1 ring-white/10">
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-brand-200">Smart India Hackathon · Problem Statement 26207 · AICTE · Internal hackathon build</p>
        </section>

        <section className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Sign in to the demo</h2>
            <LanguageSelector compact />
          </div>
          <p className="mt-1 text-sm text-slate-500">One-click demo accounts with rich synthetic data. No real student data is used.</p>

          {error && (
            <Alert tone="danger" className="mt-4">
              {error}
            </Alert>
          )}

          <div className="mt-5 grid gap-3">
            {roleCards.map((c) => (
              <button
                key={c.role}
                type="button"
                onClick={() => onDemo(c.role)}
                disabled={busy !== null}
                className="group flex items-center gap-4 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-400 hover:bg-brand-50 disabled:opacity-60"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">{c.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">Continue as {c.title}</span>
                  <span className="block text-xs text-slate-500">{c.blurb}</span>
                </span>
                <span className="text-xs font-medium text-brand-700 opacity-0 transition group-hover:opacity-100">{busy === c.role ? 'Signing in…' : 'Enter →'}</span>
              </button>
            ))}
          </div>

          <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or use credentials
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <Input label="Email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@demo.aieses" required />
            <Input label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            <Button type="submit" className="w-full" loading={busy === 'form'}>
              {t('login')}
            </Button>
          </form>

          {accounts.data?.accounts && accounts.data.accounts.length > 0 && (
            <details className="mt-5 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <summary className="cursor-pointer font-medium text-slate-700">Demo credentials</summary>
              <ul className="mt-2 space-y-1">
                {accounts.data.accounts.map((a) => (
                  <li key={a.email} className="flex flex-wrap justify-between gap-2">
                    <span>
                      <span className="font-semibold capitalize">{a.role}</span> — {a.email}
                    </span>
                    <code className="rounded bg-white px-1.5 py-0.5 ring-1 ring-slate-200">{a.password}</code>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      </div>
    </div>
  );
}
