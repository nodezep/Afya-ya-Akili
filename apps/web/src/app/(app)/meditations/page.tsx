'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Clock, Play } from 'lucide-react';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn, formatDuration } from '@/lib/utils';
import { Badge, Card, CardContent, EmptyState, Spinner } from '@/components/ui';

interface Meditation {
  id: string;
  title: string;
  description: string;
  category: string;
  durationSec: number;
  audioUrl: string;
  narrator?: string | null;
  isPremium: boolean;
}

export default function MeditationsPage() {
  const [category, setCategory] = useState<string | null>(null);
  const [playing, setPlaying] = useState<Meditation | null>(null);

  const { data: categories } = useQuery({
    queryKey: ['meditations', 'categories'],
    queryFn: () => api<Array<{ category: string; count: number }>>('/meditations/categories'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['meditations', category],
    queryFn: () =>
      api<{ items: Meditation[] }>(
        `/meditations?limit=50${category ? `&category=${category}` : ''}`,
      ).then((r) => r.items),
  });

  const { data: stats } = useQuery({
    queryKey: ['meditations', 'stats'],
    queryFn: () =>
      api<{ totalSessions: number; totalMinutes: number; streakDays: number }>('/meditations/stats'),
  });

  const startSession = useMutation({
    mutationFn: (meditationId: string) =>
      api('/meditations/sessions', { method: 'POST', body: JSON.stringify({ meditationId }) }),
  });

  const play = (meditation: Meditation) => {
    setPlaying(meditation);
    startSession.mutate(meditation.id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Meditation library</h1>
          {stats && (
            <p className="text-sm text-slate-500">
              {stats.totalMinutes} mindful minutes · {stats.totalSessions} sessions
              {stats.streakDays > 0 && ` · ${stats.streakDays}-day streak`}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setCategory(null)}
          className={cn(
            'rounded-full border px-4 py-1.5 text-sm capitalize',
            category === null
              ? 'border-brand-600 bg-brand-600 text-white'
              : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
          )}
        >
          All
        </button>
        {categories?.map((c) => (
          <button
            key={c.category}
            onClick={() => setCategory(c.category)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm capitalize',
              category === c.category
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
            )}
          >
            {c.category} ({c.count})
          </button>
        ))}
      </div>

      {playing && (
        <Card className="border-brand-500">
          <CardContent>
            <p className="text-sm text-slate-500">Now playing</p>
            <h3 className="font-semibold">{playing.title}</h3>
            <audio controls autoPlay src={playing.audioUrl} className="mt-3 w-full">
              Your browser does not support audio playback.
            </audio>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Spinner />
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((meditation) => (
            <Card key={meditation.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col">
                <div className="flex items-start justify-between">
                  <Badge className="capitalize">{meditation.category}</Badge>
                  {meditation.isPremium && <Badge variant="warning">Premium</Badge>}
                </div>
                <h3 className="mt-3 font-semibold">{meditation.title}</h3>
                <p className="mt-1 flex-1 text-sm text-slate-500">{meditation.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-sm text-slate-400">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(meditation.durationSec)}
                    {meditation.narrator && ` · ${meditation.narrator}`}
                  </span>
                  <button
                    onClick={() => play(meditation)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700"
                    aria-label={`Play ${meditation.title}`}
                  >
                    <Play className="h-4 w-4 fill-current" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No meditations found" />
      )}
    </div>
  );
}
