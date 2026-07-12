'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Users } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/providers/app-providers';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ErrorState,
  Input,
  Spinner,
} from '@/components/ui';

interface Insights {
  memberCount: number;
  message?: string;
  engagement?: { activeMembers: number; moodCheckIns: number };
  wellbeing?: {
    averageMood: number | null;
    weeklyMoodTrend: Array<{ week: string; average: number }>;
    assessmentSeverityMix: Array<{ severity: string; count: number }>;
  };
}

interface Member {
  id: string;
  status: string;
  isAdmin: boolean;
  user: {
    email: string;
    profile: { firstName: string; lastName: string } | null;
  };
}

export default function CorporatePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const organization = user?.orgMemberships?.find((m) => m.isAdmin)?.organization;
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const { data: insights, isLoading } = useQuery({
    queryKey: ['corporate', 'insights', organization?.id],
    queryFn: () => api<Insights>(`/organizations/${organization!.id}/insights`),
    enabled: Boolean(organization),
  });

  const { data: members } = useQuery({
    queryKey: ['corporate', 'members', organization?.id],
    queryFn: () =>
      api<{ items: Member[] }>(`/organizations/${organization!.id}/members?limit=100`).then(
        (r) => r.items,
      ),
    enabled: Boolean(organization),
  });

  const invite = useMutation({
    mutationFn: () =>
      api(`/organizations/${organization!.id}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      }),
    onSuccess: () => {
      setInviteEmail('');
      setSent(true);
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ['corporate'] });
    },
    onError: (err) => setError((err as Error).message),
  });

  if (!organization) {
    return (
      <EmptyState
        title="No organization access"
        description="You are not an admin of any organization. Contact AKILI to set up corporate wellbeing for your team."
      />
    );
  }
  if (isLoading) return <Spinner />;

  const maxTrend = Math.max(...(insights?.wellbeing?.weeklyMoodTrend.map((w) => w.average) ?? [1]), 1);

  const submitInvite = (e: FormEvent) => {
    e.preventDefault();
    invite.mutate();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{organization.name}</h1>
        <p className="text-sm text-slate-500">
          Anonymised team wellbeing. Individual data is never shown.
        </p>
      </div>

      {insights?.message ? (
        <Card>
          <CardContent className="flex items-center gap-3">
            <Users className="h-5 w-5 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300">{insights.message}</p>
          </CardContent>
        </Card>
      ) : (
        insights?.wellbeing && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent>
                  <p className="text-sm text-slate-500">Members</p>
                  <p className="mt-1 text-2xl font-bold">{insights.memberCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <p className="text-sm text-slate-500">Active this month</p>
                  <p className="mt-1 text-2xl font-bold">{insights.engagement?.activeMembers ?? 0}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent>
                  <p className="text-sm text-slate-500">Average team mood</p>
                  <p className="mt-1 text-2xl font-bold">
                    {insights.wellbeing.averageMood?.toFixed(1) ?? '—'}/10
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Weekly mood trend</CardTitle></CardHeader>
              <CardContent>
                {insights.wellbeing.weeklyMoodTrend.length > 0 ? (
                  <div className="flex h-32 items-end gap-2">
                    {insights.wellbeing.weeklyMoodTrend.map((week) => (
                      <div
                        key={String(week.week)}
                        className="flex-1 rounded-t bg-brand-500/80"
                        style={{ height: `${(week.average / maxTrend) * 100}%` }}
                        title={`${new Date(week.week).toLocaleDateString()}: ${week.average.toFixed(1)}`}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No mood data in this period yet.</p>
                )}
              </CardContent>
            </Card>
          </>
        )
      )}

      {/* Members */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Members</CardTitle>
          <form onSubmit={submitInvite} className="flex gap-2">
            <Input
              type="email"
              required
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="w-56"
            />
            <Button type="submit" size="sm" loading={invite.isPending}>
              Invite
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          {error && <ErrorState message={error} />}
          {sent && (
            <p className="mb-3 text-sm text-emerald-600">Invitation sent.</p>
          )}
          {members && members.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.map((member) => (
                <li key={member.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {member.user.profile
                        ? `${member.user.profile.firstName} ${member.user.profile.lastName}`
                        : member.user.email}
                    </p>
                    <p className="text-xs text-slate-400">{member.user.email}</p>
                  </div>
                  <div className="flex gap-2">
                    {member.isAdmin && <Badge variant="info">Admin</Badge>}
                    <Badge
                      variant={
                        member.status === 'ACTIVE'
                          ? 'success'
                          : member.status === 'INVITED'
                            ? 'warning'
                            : 'default'
                      }
                    >
                      {member.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No members yet" description="Invite your first team member above." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
