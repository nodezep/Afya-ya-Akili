'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/utils';
import { useAuth } from '@/providers/app-providers';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Spinner,
} from '@/components/ui';

interface PlatformOverview {
  users: { total: number; new: number; active: number };
  therapists: { approved: number };
  appointments: { created: number };
  revenue: { totalCents: number; payments: number };
  crisis: { unacknowledged: number };
}

interface AdminUser {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
  createdAt: string;
  profile: { firstName: string; lastName: string } | null;
}

interface CrisisEvent {
  id: string;
  riskLevel: string;
  trigger: string;
  createdAt: string;
  user: {
    email: string;
    phone?: string | null;
    profile: {
      firstName: string;
      lastName: string;
      emergencyContactName?: string | null;
      emergencyContactPhone?: string | null;
    } | null;
  };
}

interface TherapistApplication {
  id: string;
  title: string;
  licenseNumber: string;
  licenseBody: string;
  yearsExperience: number;
  specialties: string[];
  user: { email: string; profile: { firstName: string; lastName: string } | null };
}

type Tab = 'overview' | 'users' | 'crisis' | 'applications';

export default function AdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin', 'overview'],
    queryFn: () => api<PlatformOverview>('/analytics/platform'),
    enabled: isAdmin,
  });

  const { data: users } = useQuery({
    queryKey: ['admin', 'users', search],
    queryFn: () =>
      api<{ items: AdminUser[] }>(
        `/admin/users?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ).then((r) => r.items),
    enabled: isAdmin && tab === 'users',
  });

  const { data: crisisQueue } = useQuery({
    queryKey: ['admin', 'crisis'],
    queryFn: () => api<{ items: CrisisEvent[] }>('/admin/crisis-queue?limit=50').then((r) => r.items),
    enabled: isAdmin && tab === 'crisis',
  });

  const { data: applications } = useQuery({
    queryKey: ['admin', 'applications'],
    queryFn: () =>
      api<{ items: TherapistApplication[] }>('/therapists/applications?limit=50').then((r) => r.items),
    enabled: isAdmin && tab === 'applications',
  });

  const setBan = useMutation({
    mutationFn: ({ id, banned }: { id: string; banned: boolean }) =>
      api(`/admin/users/${id}/ban`, { method: 'POST', body: JSON.stringify({ banned }) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });

  const acknowledge = useMutation({
    mutationFn: (id: string) => api(`/admin/crisis-queue/${id}/acknowledge`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin'] }),
  });

  const moderate = useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      api(`/therapists/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] }),
  });

  if (!isAdmin) {
    return <EmptyState title="Admin access required" />;
  }
  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          {user?.role === 'SUPER_ADMIN' ? 'Super admin' : 'Admin'} dashboard
        </h1>
        <div className="flex gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
          {(
            [
              ['overview', 'Overview'],
              ['users', 'Users'],
              ['crisis', 'Crisis queue'],
              ['applications', 'Applications'],
            ] as Array<[Tab, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                tab === key ? 'bg-brand-600 text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {label}
              {key === 'crisis' && (overview?.crisis.unacknowledged ?? 0) > 0 && (
                <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 text-xs text-white">
                  {overview!.crisis.unacknowledged}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {tab === 'overview' && overview && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Total users</p>
                <Users className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-1 text-2xl font-bold">{overview.users.total}</p>
              <p className="text-xs text-emerald-600">+{overview.users.new} this month</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Active users (30d)</p>
                <TrendingUp className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-1 text-2xl font-bold">{overview.users.active}</p>
              <p className="text-xs text-slate-400">{overview.appointments.created} bookings</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Revenue (30d)</p>
                <ShieldCheck className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-1 text-2xl font-bold">{formatMoney(overview.revenue.totalCents)}</p>
              <p className="text-xs text-slate-400">{overview.revenue.payments} payments</p>
            </CardContent>
          </Card>
          <Card className={overview.crisis.unacknowledged > 0 ? 'border-rose-400' : ''}>
            <CardContent>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">Crisis alerts</p>
                <AlertTriangle className="h-4 w-4 text-rose-500" />
              </div>
              <p className="mt-1 text-2xl font-bold">{overview.crisis.unacknowledged}</p>
              <p className="text-xs text-slate-400">unacknowledged</p>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'users' && (
        <Card>
          <CardHeader>
            <Input
              placeholder="Search by email or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>
          <CardContent>
            {users && users.length > 0 ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {row.profile ? `${row.profile.firstName} ${row.profile.lastName}` : row.email}
                      </p>
                      <p className="text-xs text-slate-400">
                        {row.email} · joined {formatDateTime(row.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={row.role === 'USER' ? 'default' : 'info'}>{row.role}</Badge>
                      {row.isBanned && <Badge variant="danger">BANNED</Badge>}
                      {row.role !== 'SUPER_ADMIN' && (
                        <Button
                          size="sm"
                          variant={row.isBanned ? 'outline' : 'danger'}
                          onClick={() => setBan.mutate({ id: row.id, banned: !row.isBanned })}
                        >
                          {row.isBanned ? 'Unban' : 'Ban'}
                        </Button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No users found" />
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'crisis' && (
        <Card>
          <CardHeader>
            <CardTitle>Unacknowledged crisis events</CardTitle>
          </CardHeader>
          <CardContent>
            {crisisQueue && crisisQueue.length > 0 ? (
              <ul className="space-y-4">
                {crisisQueue.map((event) => (
                  <li key={event.id} className="rounded-lg border border-rose-200 p-4 dark:border-rose-900">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <Badge variant="danger">{event.riskLevel}</Badge>
                        <span className="ml-2 font-medium">
                          {event.user.profile
                            ? `${event.user.profile.firstName} ${event.user.profile.lastName}`
                            : event.user.email}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">{formatDateTime(event.createdAt)}</span>
                      </div>
                      <Button size="sm" onClick={() => acknowledge.mutate(event.id)}>
                        Acknowledge
                      </Button>
                    </div>
                    <p className="mt-2 rounded bg-slate-50 p-2 text-sm italic text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      &ldquo;{event.trigger}&rdquo;
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Contact: {event.user.email}
                      {event.user.phone && ` · ${event.user.phone}`}
                      {event.user.profile?.emergencyContactPhone &&
                        ` · Emergency: ${event.user.profile.emergencyContactName ?? ''} ${event.user.profile.emergencyContactPhone}`}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No pending crisis events" />
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'applications' && (
        <Card>
          <CardHeader>
            <CardTitle>Therapist applications</CardTitle>
          </CardHeader>
          <CardContent>
            {applications && applications.length > 0 ? (
              <ul className="space-y-4">
                {applications.map((application) => (
                  <li key={application.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {application.user.profile
                            ? `${application.user.profile.firstName} ${application.user.profile.lastName}`
                            : application.user.email}{' '}
                          <span className="text-sm font-normal text-slate-500">— {application.title}</span>
                        </p>
                        <p className="text-xs text-slate-400">
                          Licence {application.licenseNumber} ({application.licenseBody}) ·{' '}
                          {application.yearsExperience} yrs · {application.specialties.join(', ')}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => moderate.mutate({ id: application.id, approve: true })}>
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => moderate.mutate({ id: application.id, approve: false })}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No pending applications" />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
