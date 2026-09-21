import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  BookOpen,
  Bot,
  ClipboardList,
  Code2,
  Compass,
  FolderKanban,
  Globe2,
  GraduationCap,
  Languages,
  LayoutDashboard,
  Library,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { LANGUAGES, useI18n, type UiKey } from '@/lib/i18n';
import { patch } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Avatar, Badge } from '@/components/ui';
import type { LanguageCode, Role } from '@shared/types';

interface NavItem {
  to: string;
  key: UiKey;
  icon: ReactNode;
  end?: boolean;
}

const studentNav: NavItem[] = [
  { to: '/', key: 'dashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/subjects', key: 'subjects', icon: <BookOpen className="h-4 w-4" /> },
  { to: '/progress', key: 'progress', icon: <TrendingUp className="h-4 w-4" /> },
  { to: '/recommendations', key: 'recommendations', icon: <Sparkles className="h-4 w-4" /> },
  { to: '/tutor', key: 'aiTutor', icon: <Bot className="h-4 w-4" /> },
  { to: '/assignments', key: 'assignments', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/resources', key: 'resources', icon: <Compass className="h-4 w-4" /> },
  { to: '/workspace', key: 'workspace', icon: <FolderKanban className="h-4 w-4" /> },
  { to: '/ide', key: 'ide', icon: <Code2 className="h-4 w-4" /> },
  { to: '/classroom', key: 'classroom', icon: <Globe2 className="h-4 w-4" /> },
];

const teacherNav: NavItem[] = [
  { to: '/teacher', key: 'teacherDashboard', icon: <LayoutDashboard className="h-4 w-4" />, end: true },
  { to: '/teacher/classes', key: 'classes', icon: <Users className="h-4 w-4" /> },
  { to: '/teacher/assignments', key: 'assignments', icon: <ClipboardList className="h-4 w-4" /> },
  { to: '/teacher/analytics', key: 'analytics', icon: <BarChart3 className="h-4 w-4" /> },
  { to: '/teacher/library', key: 'courses', icon: <Library className="h-4 w-4" /> },
];

const adminNav: NavItem[] = [
  { to: '/admin', key: 'admin', icon: <Settings className="h-4 w-4" />, end: true },
  { to: '/admin/users', key: 'students', icon: <Users className="h-4 w-4" /> },
];

function navFor(role: Role): NavItem[] {
  if (role === 'teacher') return teacherNav;
  if (role === 'admin') return adminNav;
  return studentNav;
}

export function LanguageSelector({ compact }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  const { user } = useAuth();
  const qc = useQueryClient();
  const onChange = async (code: LanguageCode) => {
    setLanguage(code);
    if (user) {
      try {
        await patch('/users/me', { language: code });
        qc.invalidateQueries({ queryKey: ['lesson'] });
      } catch {
        /* keep local preference */
      }
    }
  };
  return (
    <label className="flex items-center gap-2 text-sm text-slate-600">
      <Languages className="h-4 w-4" aria-hidden />
      {!compact && <span className="sr-only sm:not-sr-only">{t('language')}</span>}
      <select aria-label={t('language')} value={language} onChange={(e) => onChange(e.target.value as LanguageCode)} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-brand-500">
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeName}
            {l.status === 'pilot' ? ' (pilot)' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const { t, language, info } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);
  if (!user) return null;
  const nav = navFor(user.role);

  const roleLabel = user.role === 'student' ? 'Student' : user.role === 'teacher' ? 'Teacher' : 'Admin';

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
          <GraduationCap className="h-5 w-5" />
        </span>
        <div>
          <p className="text-lg font-bold tracking-tight text-slate-900">AIESES</p>
          <p className="text-[11px] leading-tight text-slate-500">{t('tagline')}</p>
        </div>
      </div>
      <nav aria-label="Main navigation" className="flex-1 space-y-0.5 px-3">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors', isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-100')}
          >
            {item.icon}
            {t(item.key)}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-slate-200 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} color={user.avatarColor} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{roleLabel} · demo account</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label={t('logout')}
            title={t('logout')}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">{sidebar}</aside>
      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="absolute right-3 top-4 rounded-md p-1 text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setOpen(true)} className="rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <span className="hidden text-sm text-slate-500 sm:inline">SIH 26207 · AICTE · Smart Education</span>
          </div>
          <div className="flex items-center gap-3">
            {info.status === 'pilot' && <Badge tone="warning">Pilot: {info.name}</Badge>}
            <Badge tone="brand" className="hidden sm:inline-flex">
              {t('demoMode')}
            </Badge>
            <LanguageSelector compact />
          </div>
        </header>
        {language === 'unr' && <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 sm:px-6">{t('pilotLanguage')}</div>}
        <main id="main" className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
