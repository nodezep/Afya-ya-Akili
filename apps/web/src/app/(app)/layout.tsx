'use client';

import {
  Bell,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  ClipboardList,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  NotebookPen,
  Search,
  Settings,
  ShieldAlert,
  Sun,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn, initials } from '@/lib/utils';
import { useAuth, useLocale, useTheme } from '@/providers/app-providers';
import { Avatar, Spinner } from '@/components/ui';
import type { TranslationKey } from '@/lib/i18n';

interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: typeof LayoutDashboard;
}

const mainNav: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { href: '/chat', labelKey: 'nav.chat', icon: Bot },
  { href: '/mood', labelKey: 'nav.mood', icon: HeartPulse },
  { href: '/journal', labelKey: 'nav.journal', icon: NotebookPen },
  { href: '/meditations', labelKey: 'nav.meditations', icon: Moon },
  { href: '/assessments', labelKey: 'nav.assessments', icon: ClipboardList },
  { href: '/learning', labelKey: 'nav.learning', icon: BookOpen },
  { href: '/therapists', labelKey: 'nav.therapists', icon: Users },
  { href: '/appointments', labelKey: 'nav.appointments', icon: Calendar },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t, locale, setLocale } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api<{ count: number }>('/notifications/unread-count'),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/auth/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
  const isOrgAdmin = user.orgMemberships?.some((m) => m.isAdmin) ?? false;

  const navLink = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          active
            ? 'bg-brand-600 text-white'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        )}
      >
        <item.icon className="h-4 w-4" />
        {t(item.labelKey)}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-brand-700 dark:text-brand-400">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">A</span>
          AKILI
        </Link>
        <button className="lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4 scrollbar-thin">
        {mainNav.map(navLink)}
        {isOrgAdmin && navLink({ href: '/corporate', labelKey: 'nav.corporate', icon: Building2 })}
        {isAdmin && (
          <Link
            href="/admin"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              pathname.startsWith('/admin')
                ? 'bg-brand-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
            )}
          >
            <ShieldAlert className="h-4 w-4" />
            {t('nav.admin')}
          </Link>
        )}
      </nav>
      <div className="space-y-1 border-t border-slate-200 p-3 dark:border-slate-800">
        {navLink({ href: '/billing', labelKey: 'nav.billing', icon: CreditCard })}
        {navLink({ href: '/settings', labelKey: 'nav.settings', icon: Settings })}
        <button
          onClick={() => {
            void signOut().then(() => router.push('/'));
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" />
          {t('nav.logout')}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white dark:bg-slate-900">{sidebar}</aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
        {sidebar}
      </aside>

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
          <button className="lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <Link
            href="/search"
            className="flex h-9 flex-1 max-w-md items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-400 hover:border-brand-400 dark:border-slate-700"
          >
            <Search className="h-4 w-4" />
            {t('common.search')}…
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setLocale(locale === 'en' ? 'sw' : 'en')}
              className="rounded-lg px-2 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Switch language"
            >
              {locale.toUpperCase()}
            </button>
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link
              href="/notifications"
              className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              title={t('nav.notifications')}
            >
              <Bell className="h-4 w-4" />
              {(unread?.count ?? 0) > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                  {unread!.count > 9 ? '9+' : unread!.count}
                </span>
              )}
            </Link>
            <Link href="/settings" title="Profile">
              <Avatar
                src={user.profile?.avatarUrl}
                fallback={initials(user.profile?.firstName, user.profile?.lastName)}
                size={32}
              />
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-6xl p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
