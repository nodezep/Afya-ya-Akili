'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import { Button, Card, CardContent, EmptyState, Spinner } from '@/components/ui';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => api<{ items: Notification[] }>('/notifications?limit=50').then((r) => r.items),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api(`/notifications/${id}/read`, { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllRead = useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  if (isLoading) return <Spinner />;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
          <CheckCheck className="h-4 w-4" /> Mark all read
        </Button>
      </div>

      {data && data.length > 0 ? (
        <div className="space-y-2">
          {data.map((notification) => (
            <Card
              key={notification.id}
              className={cn('cursor-pointer', !notification.readAt && 'border-brand-400')}
              onClick={() => !notification.readAt && markRead.mutate(notification.id)}
            >
              <CardContent className="flex items-start gap-3 py-4">
                {!notification.readAt && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />}
                <div className={cn(notification.readAt && 'pl-5')}>
                  <p className="font-medium">{notification.title}</p>
                  <p className="text-sm text-slate-500">{notification.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(notification.createdAt)}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="You're all caught up" />
      )}
    </div>
  );
}
