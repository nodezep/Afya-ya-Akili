'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, Trash2 } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Spinner,
  Textarea,
} from '@/components/ui';

const EMOTIONS = ['happy', 'calm', 'grateful', 'energetic', 'hopeful', 'anxious', 'stressed', 'sad', 'angry', 'tired', 'lonely', 'overwhelmed'];
const FACTORS = ['work', 'family', 'sleep', 'health', 'money', 'relationships', 'weather', 'exercise'];

interface MoodStats {
  averageScore: number | null;
  totalEntries: number;
  streakDays: number;
  daily: Array<{ date: string; average: number; count: number }>;
  topEmotions: Array<{ name: string; count: number }>;
  topFactors: Array<{ name: string; count: number }>;
}

interface MoodEntry {
  id: string;
  score: number;
  emotions: string[];
  factors: string[];
  note?: string | null;
  createdAt: string;
}

export default function MoodPage() {
  const queryClient = useQueryClient();
  const [score, setScore] = useState(7);
  const [emotions, setEmotions] = useState<string[]>([]);
  const [factors, setFactors] = useState<string[]>([]);
  const [note, setNote] = useState('');

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['mood', 'stats'],
    queryFn: () => api<MoodStats>('/mood/stats?days=30'),
  });
  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ['mood', 'entries'],
    queryFn: () => api<{ items: MoodEntry[] }>('/mood?limit=20').then((r) => r.items),
  });

  const createEntry = useMutation({
    mutationFn: () =>
      api('/mood', {
        method: 'POST',
        body: JSON.stringify({ score, emotions, factors, note: note || undefined }),
      }),
    onSuccess: () => {
      setEmotions([]);
      setFactors([]);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['mood'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id: string) => api(`/mood/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['mood'] }),
  });

  const toggle = (list: string[], setList: (v: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    createEntry.mutate();
  };

  const maxBar = Math.max(...(stats?.daily.map((d) => d.average) ?? [1]), 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mood tracker</h1>
        {stats && stats.streakDays > 0 && (
          <Badge variant="warning" className="gap-1">
            <Flame className="h-3.5 w-3.5" /> {stats.streakDays}-day streak
          </Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Log form */}
        <Card>
          <CardHeader>
            <CardTitle>How are you right now?</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div>
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Low</span>
                  <span className="text-2xl font-bold text-brand-600">{score}/10</span>
                  <span>Great</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="mt-2 w-full accent-brand-600"
                />
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">Emotions</p>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONS.map((emotion) => (
                    <button
                      key={emotion}
                      type="button"
                      onClick={() => toggle(emotions, setEmotions, emotion)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm capitalize transition',
                        emotions.includes(emotion)
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-200 text-slate-600 hover:border-brand-400 dark:border-slate-700 dark:text-slate-300',
                      )}
                    >
                      {emotion}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium">What&apos;s influencing this?</p>
                <div className="flex flex-wrap gap-2">
                  {FACTORS.map((factor) => (
                    <button
                      key={factor}
                      type="button"
                      onClick={() => toggle(factors, setFactors, factor)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-sm capitalize transition',
                        factors.includes(factor)
                          ? 'border-slate-700 bg-slate-700 text-white dark:border-slate-300 dark:bg-slate-300 dark:text-slate-900'
                          : 'border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300',
                      )}
                    >
                      {factor}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                rows={2}
                placeholder="Add a note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />

              <Button type="submit" loading={createEntry.isPending} className="w-full">
                Save check-in
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Trends */}
        <Card>
          <CardHeader>
            <CardTitle>Last 30 days</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingStats ? (
              <Spinner />
            ) : stats && stats.daily.length > 0 ? (
              <>
                <div className="flex h-36 items-end gap-1">
                  {stats.daily.map((day) => (
                    <div
                      key={String(day.date)}
                      className="flex-1 rounded-t bg-brand-500/80 transition hover:bg-brand-600"
                      style={{ height: `${(day.average / maxBar) * 100}%` }}
                      title={`${new Date(day.date).toLocaleDateString()}: ${day.average.toFixed(1)}/10`}
                    />
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Average</p>
                    <p className="text-xl font-bold">{stats.averageScore?.toFixed(1) ?? '—'}/10</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Check-ins</p>
                    <p className="text-xl font-bold">{stats.totalEntries}</p>
                  </div>
                </div>
                {stats.topEmotions.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-500">Most frequent emotions</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {stats.topEmotions.map((emotion) => (
                        <Badge key={emotion.name} className="capitalize">
                          {emotion.name} × {emotion.count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <EmptyState title="No data yet" description="Log your first mood to see trends here." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent check-ins</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingEntries ? (
            <Spinner />
          ) : entries && entries.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className="font-medium">
                      {entry.score}/10
                      {entry.emotions.length > 0 && (
                        <span className="ml-2 text-sm font-normal capitalize text-slate-500">
                          {entry.emotions.join(', ')}
                        </span>
                      )}
                    </p>
                    {entry.note && <p className="mt-0.5 text-sm text-slate-500">{entry.note}</p>}
                    <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  <button
                    onClick={() => deleteEntry.mutate(entry.id)}
                    className="text-slate-400 hover:text-rose-500"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No check-ins yet" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
