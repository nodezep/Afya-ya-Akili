'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, Calendar, HeartPulse, Moon, NotebookPen } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { useAuth, useLocale } from '@/providers/app-providers';
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Spinner } from '@/components/ui';

interface DashboardData {
  mood: { average: number | null; checkIns: number; latest: { score: number; createdAt: string } | null };
  journalEntries: number;
  meditation: { sessions: number; minutes: number };
  conversations: number;
  nextAppointment: {
    id: string;
    startsAt: string;
    therapist: { title: string; user: { profile: { firstName: string; lastName: string } } };
  } | null;
  recentAssessments: Array<{
    id: string;
    totalScore: number;
    severity: string;
    createdAt: string;
    template: { type: string; name: string };
  }>;
}

const MOOD_EMOJI = ['😞', '😞', '😕', '😕', '😐', '😐', '🙂', '🙂', '😄', '😄'];

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const [loggedScore, setLoggedScore] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<DashboardData>('/analytics/dashboard'),
  });

  const logMood = useMutation({
    mutationFn: (score: number) =>
      api('/mood', { method: 'POST', body: JSON.stringify({ score }) }),
    onSuccess: (_, score) => {
      setLoggedScore(score);
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? t('dashboard.greeting.morning')
      : hour < 18
        ? t('dashboard.greeting.afternoon')
        : t('dashboard.greeting.evening');

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {greeting}, {user?.profile?.firstName ?? 'friend'} 👋
        </h1>
        <p className="text-slate-500">{t('dashboard.howAreYou')}</p>
      </div>

      {/* Quick mood check-in */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-2">
          {loggedScore ? (
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Logged {MOOD_EMOJI[loggedScore - 1]} — thank you for checking in.{' '}
              <Link href="/mood" className="text-brand-600 hover:underline">
                See your trends
              </Link>
            </p>
          ) : (
            <>
              <span className="mr-2 text-sm font-medium">{t('mood.logMood')}:</span>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((score) => (
                <button
                  key={score}
                  onClick={() => logMood.mutate(score)}
                  disabled={logMood.isPending}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-lg transition hover:scale-110 hover:border-brand-500 dark:border-slate-700"
                  title={`${score}/10`}
                >
                  {MOOD_EMOJI[score - 1]}
                </button>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<HeartPulse className="h-5 w-5 text-rose-500" />}
          label="Average mood (30d)"
          value={data?.mood.average ? `${data.mood.average.toFixed(1)}/10` : '—'}
          hint={`${data?.mood.checkIns ?? 0} check-ins`}
          href="/mood"
        />
        <StatCard
          icon={<NotebookPen className="h-5 w-5 text-amber-500" />}
          label="Journal entries (30d)"
          value={String(data?.journalEntries ?? 0)}
          hint="Keep writing"
          href="/journal"
        />
        <StatCard
          icon={<Moon className="h-5 w-5 text-indigo-500" />}
          label="Meditation minutes"
          value={String(data?.meditation.minutes ?? 0)}
          hint={`${data?.meditation.sessions ?? 0} sessions`}
          href="/meditations"
        />
        <StatCard
          icon={<Bot className="h-5 w-5 text-brand-600" />}
          label="Conversations"
          value={String(data?.conversations ?? 0)}
          hint="Akili is always here"
          href="/chat"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next appointment */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Next session</CardTitle>
            <Calendar className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            {data?.nextAppointment ? (
              <div>
                <p className="font-medium">
                  {data.nextAppointment.therapist.user.profile.firstName}{' '}
                  {data.nextAppointment.therapist.user.profile.lastName}
                </p>
                <p className="text-sm text-slate-500">{data.nextAppointment.therapist.title}</p>
                <p className="mt-2 text-sm">{formatDateTime(data.nextAppointment.startsAt)}</p>
                <Link href="/appointments" className="mt-4 block">
                  <Button size="sm" variant="outline">
                    Manage appointments
                  </Button>
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-slate-500">
                  No upcoming sessions. Talking to a professional can help even when things feel manageable.
                </p>
                <Link href="/therapists" className="mt-4 block">
                  <Button size="sm">{t('therapists.book')}</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent assessments */}
        <Card>
          <CardHeader>
            <CardTitle>Recent assessments</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentAssessments?.length ? (
              <ul className="space-y-3">
                {data.recentAssessments.map((result) => (
                  <li key={result.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{result.template.name}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(result.createdAt)}</p>
                    </div>
                    <Badge variant={result.severity.includes('severe') || result.severity === 'high' ? 'danger' : 'info'}>
                      {result.severity} · {result.totalScore}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div>
                <p className="text-sm text-slate-500">
                  You haven&apos;t taken an assessment yet. A 2-minute check-in gives you a baseline.
                </p>
                <Link href="/assessments" className="mt-4 block">
                  <Button size="sm" variant="outline">
                    Take PHQ-9
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <Card className="transition hover:border-brand-400">
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{label}</p>
            {icon}
          </div>
          <p className="mt-2 text-2xl font-bold">{value}</p>
          <p className="text-xs text-slate-400">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
