'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Plus, Star, Trash2, X } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  Input,
  Spinner,
  Textarea,
} from '@/components/ui';

interface JournalEntry {
  id: string;
  title: string;
  content: string;
  tags: string[];
  sentimentScore: number | null;
  isFavorite: boolean;
  createdAt: string;
}

export default function JournalPage() {
  const queryClient = useQueryClient();
  const [showEditor, setShowEditor] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: prompts } = useQuery({
    queryKey: ['journal', 'prompts'],
    queryFn: () => api<{ promptOfTheDay: string }>('/journal/prompts'),
  });

  const { data: entries, isLoading } = useQuery({
    queryKey: ['journal', 'entries', search],
    queryFn: () =>
      api<{ items: JournalEntry[] }>(
        `/journal?limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ).then((r) => r.items),
  });

  const create = useMutation({
    mutationFn: () =>
      api('/journal', { method: 'POST', body: JSON.stringify({ title, content }) }),
    onSuccess: () => {
      setTitle('');
      setContent('');
      setShowEditor(false);
      void queryClient.invalidateQueries({ queryKey: ['journal'] });
    },
  });

  const toggleFavorite = useMutation({
    mutationFn: (entry: JournalEntry) =>
      api(`/journal/${entry.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite: !entry.isFavorite }),
      }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['journal'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/journal/${id}`, { method: 'DELETE' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['journal'] }),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate();
  };

  const sentimentBadge = (score: number | null) => {
    if (score === null) return null;
    if (score > 0.2) return <Badge variant="success">positive</Badge>;
    if (score < -0.2) return <Badge variant="danger">heavy</Badge>;
    return <Badge>neutral</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Journal</h1>
        <Button onClick={() => setShowEditor((v) => !v)}>
          {showEditor ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showEditor ? 'Close' : 'New entry'}
        </Button>
      </div>

      {prompts?.promptOfTheDay && !showEditor && (
        <button
          className="flex w-full items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900 transition hover:border-amber-400 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          onClick={() => {
            setShowEditor(true);
            setTitle(prompts.promptOfTheDay.slice(0, 80));
          }}
        >
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Today&apos;s prompt:</strong> {prompts.promptOfTheDay}
          </span>
        </button>
      )}

      {showEditor && (
        <Card>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <Input
                placeholder="Title"
                required
                maxLength={150}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="Write freely. This space is yours."
                required
                rows={8}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setShowEditor(false)}>
                  Cancel
                </Button>
                <Button type="submit" loading={create.isPending}>
                  Save entry
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Input
        placeholder="Search your entries…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {isLoading ? (
        <Spinner />
      ) : entries && entries.length > 0 ? (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent
                className="cursor-pointer"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{entry.title}</h3>
                      {sentimentBadge(entry.sentimentScore)}
                    </div>
                    <p
                      className={cn(
                        'mt-1 whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300',
                        expanded !== entry.id && 'line-clamp-2',
                      )}
                    >
                      {entry.content}
                    </p>
                    <p className="mt-2 text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite.mutate(entry);
                      }}
                      className={cn(
                        'rounded p-1.5',
                        entry.isFavorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-500',
                      )}
                      aria-label="Favourite"
                    >
                      <Star className="h-4 w-4" fill={entry.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        remove.mutate(entry.id);
                      }}
                      className="rounded p-1.5 text-slate-300 hover:text-rose-500"
                      aria-label="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your journal is empty"
          description="Writing for five minutes a day measurably reduces stress. Start with today's prompt."
        />
      )}
    </div>
  );
}
