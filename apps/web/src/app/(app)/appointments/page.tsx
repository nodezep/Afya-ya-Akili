'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Video } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime, formatMoney, initials } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  ErrorState,
  Input,
  Spinner,
} from '@/components/ui';

interface Appointment {
  id: string;
  startsAt: string;
  endsAt: string;
  status: 'PENDING' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  priceCents: number;
  currency: string;
  paymentId?: string | null;
  therapist: {
    id: string;
    title: string;
    user: { profile: { firstName: string; lastName: string; avatarUrl?: string | null } };
  };
  videoRoom?: { roomUrl: string } | null;
}

const STATUS_VARIANT: Record<Appointment['status'], 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  IN_PROGRESS: 'info',
  COMPLETED: 'default',
  CANCELLED: 'danger',
  NO_SHOW: 'danger',
};

export default function AppointmentsPage() {
  const queryClient = useQueryClient();
  const [payingId, setPayingId] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [payMessage, setPayMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['appointments'],
    queryFn: () => api<{ items: Appointment[] }>('/appointments?limit=50').then((r) => r.items),
  });

  const cancel = useMutation({
    mutationFn: (id: string) =>
      api(`/appointments/${id}/cancel`, { method: 'POST', body: JSON.stringify({}) }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['appointments'] }),
    onError: (err) => setError((err as Error).message),
  });

  const payMobile = useMutation({
    mutationFn: ({ appointmentId, provider }: { appointmentId: string; provider: 'MPESA' | 'AIRTEL_MONEY' }) =>
      api<{ customerMessage: string }>('/billing/mobile-money/checkout', {
        method: 'POST',
        body: JSON.stringify({ provider, phone, purpose: 'APPOINTMENT', appointmentId }),
      }),
    onSuccess: (result) => {
      setPayMessage(result.customerMessage);
      setPayingId(null);
    },
    onError: (err) => setError((err as Error).message),
  });

  const join = async (appointmentId: string) => {
    setError(null);
    try {
      const result = await api<{ roomUrl: string; token: string | null }>(
        `/video/appointments/${appointmentId}/join`,
      );
      const url = result.token ? `${result.roomUrl}?t=${result.token}` : result.roomUrl;
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My appointments</h1>
      {error && <ErrorState message={error} />}
      {payMessage && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {payMessage}
        </div>
      )}

      {data && data.length > 0 ? (
        <div className="space-y-3">
          {data.map((appointment) => {
            const profile = appointment.therapist.user.profile;
            const joinable = ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status);
            const cancellable = ['PENDING', 'CONFIRMED'].includes(appointment.status);
            const payable = appointment.status !== 'CANCELLED' && !appointment.paymentId;
            return (
              <Card key={appointment.id}>
                <CardContent className="flex flex-wrap items-center gap-4">
                  <Avatar src={profile.avatarUrl} fallback={initials(profile.firstName, profile.lastName)} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {profile.firstName} {profile.lastName}
                      <span className="ml-2 text-sm font-normal text-slate-500">{appointment.therapist.title}</span>
                    </p>
                    <p className="text-sm text-slate-500">{formatDateTime(appointment.startsAt)}</p>
                    <p className="text-xs text-slate-400">
                      {formatMoney(appointment.priceCents, appointment.currency)}
                      {appointment.paymentId ? ' · paid' : ' · unpaid'}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[appointment.status]}>{appointment.status}</Badge>
                  <div className="flex flex-wrap gap-2">
                    {joinable && (
                      <Button size="sm" onClick={() => void join(appointment.id)}>
                        <Video className="h-4 w-4" /> Join
                      </Button>
                    )}
                    {payable && (
                      <Button size="sm" variant="outline" onClick={() => setPayingId(appointment.id)}>
                        Pay
                      </Button>
                    )}
                    {cancellable && (
                      <Button size="sm" variant="ghost" onClick={() => cancel.mutate(appointment.id)}>
                        Cancel
                      </Button>
                    )}
                  </div>
                  {payingId === appointment.id && (
                    <div className="w-full space-y-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                      <Input
                        placeholder="Phone e.g. +254712345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          loading={payMobile.isPending}
                          disabled={!phone}
                          onClick={() => payMobile.mutate({ appointmentId: appointment.id, provider: 'MPESA' })}
                        >
                          Pay with M-Pesa
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={payMobile.isPending}
                          disabled={!phone}
                          onClick={() =>
                            payMobile.mutate({ appointmentId: appointment.id, provider: 'AIRTEL_MONEY' })
                          }
                        >
                          Airtel Money
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setPayingId(null)}>
                          Close
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No appointments yet"
          description="Browse the therapist marketplace to book your first session."
        />
      )}
    </div>
  );
}
