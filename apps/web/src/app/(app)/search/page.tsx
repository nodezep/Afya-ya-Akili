'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDuration, initials } from '@/lib/utils';
import { Avatar, Badge, Card, CardContent, EmptyState, Input, Spinner } from '@/components/ui';

interface SearchResults {
  therapists: Array<{
    id: string;
    title: string;
    specialties: string[];
    user: { profile: { firstName: string; lastName: string; avatarUrl?: string | null } };
  }>;
  meditations: Array<{ id: string; title: string; category: string; durationSec: number }>;
  courses: Array<{ id: string; title: string; slug: string; category: string }>;
  journalEntries: Array<{ id: string; title: string; createdAt: string }>;
  conversations: Array<{ id: string; title: string }>;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['search', query],
    queryFn: () => api<SearchResults>(`/search?q=${encodeURIComponent(query)}`),
    enabled: query.trim().length >= 2,
  });

  const hasResults =
    data &&
    (data.therapists.length || data.meditations.length || data.courses.length ||
      data.journalEntries.length || data.conversations.length);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Search</h1>
      <Input
        autoFocus
        placeholder="Search therapists, meditations, courses, your journal…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {isLoading && <Spinner />}

      {data && !hasResults && <EmptyState title={`No results for "${query}"`} />}

      {data?.therapists && data.therapists.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Therapists</h2>
          <div className="space-y-2">
            {data.therapists.map((therapist) => (
              <Link key={therapist.id} href={`/therapists/${therapist.id}`}>
                <Card className="transition hover:border-brand-400">
                  <CardContent className="flex items-center gap-3 py-3">
                    <Avatar
                      src={therapist.user.profile.avatarUrl}
                      fallback={initials(therapist.user.profile.firstName, therapist.user.profile.lastName)}
                      size={36}
                    />
                    <div>
                      <p className="font-medium">
                        {therapist.user.profile.firstName} {therapist.user.profile.lastName}
                      </p>
                      <p className="text-xs text-slate-500">{therapist.title}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data?.meditations && data.meditations.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Meditations</h2>
          <div className="space-y-2">
            {data.meditations.map((meditation) => (
              <Link key={meditation.id} href="/meditations">
                <Card className="transition hover:border-brand-400">
                  <CardContent className="flex items-center justify-between py-3">
                    <p className="font-medium">{meditation.title}</p>
                    <Badge className="capitalize">
                      {meditation.category} · {formatDuration(meditation.durationSec)}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data?.courses && data.courses.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Courses</h2>
          <div className="space-y-2">
            {data.courses.map((course) => (
              <Link key={course.id} href="/learning">
                <Card className="transition hover:border-brand-400">
                  <CardContent className="flex items-center justify-between py-3">
                    <p className="font-medium">{course.title}</p>
                    <Badge className="capitalize">{course.category}</Badge>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data?.journalEntries && data.journalEntries.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Your journal</h2>
          <div className="space-y-2">
            {data.journalEntries.map((entry) => (
              <Link key={entry.id} href="/journal">
                <Card className="transition hover:border-brand-400">
                  <CardContent className="py-3">
                    <p className="font-medium">{entry.title}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {data?.conversations && data.conversations.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Conversations</h2>
          <div className="space-y-2">
            {data.conversations.map((conversation) => (
              <Link key={conversation.id} href="/chat">
                <Card className="transition hover:border-brand-400">
                  <CardContent className="py-3">
                    <p className="font-medium">{conversation.title}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
