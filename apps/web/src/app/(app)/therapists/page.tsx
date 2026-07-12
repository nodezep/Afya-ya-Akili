'use client';

import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn, formatMoney, initials } from '@/lib/utils';
import { Avatar, Badge, Card, CardContent, EmptyState, Input, Spinner } from '@/components/ui';

interface Therapist {
  id: string;
  title: string;
  yearsExperience: number;
  specialties: string[];
  languages: string[];
  hourlyRateCents: number;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  user: { profile: { firstName: string; lastName: string; avatarUrl?: string | null; city?: string | null } };
}

export default function TherapistsPage() {
  const [specialty, setSpecialty] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: specialties } = useQuery({
    queryKey: ['therapists', 'specialties'],
    queryFn: () => api<Array<{ name: string; count: number }>>('/therapists/specialties'),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['therapists', specialty, search],
    queryFn: () =>
      api<{ items: Therapist[] }>(
        `/therapists?limit=30${specialty ? `&specialty=${specialty}` : ''}${
          search ? `&search=${encodeURIComponent(search)}` : ''
        }`,
      ).then((r) => r.items),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Find your therapist</h1>
        <p className="text-sm text-slate-500">
          Every professional on AKILI is licence-verified before they can accept bookings.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name or approach…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSpecialty(null)}
            className={cn(
              'rounded-full border px-3 py-1 text-sm',
              specialty === null
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
            )}
          >
            All
          </button>
          {specialties?.slice(0, 8).map((s) => (
            <button
              key={s.name}
              onClick={() => setSpecialty(s.name)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm capitalize',
                specialty === s.name
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Spinner />
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((therapist) => (
            <Link key={therapist.id} href={`/therapists/${therapist.id}`}>
              <Card className="h-full transition hover:border-brand-400">
                <CardContent>
                  <div className="flex items-center gap-3">
                    <Avatar
                      src={therapist.user.profile.avatarUrl}
                      fallback={initials(therapist.user.profile.firstName, therapist.user.profile.lastName)}
                      size={48}
                    />
                    <div>
                      <p className="font-semibold">
                        {therapist.user.profile.firstName} {therapist.user.profile.lastName}
                      </p>
                      <p className="text-sm text-slate-500">{therapist.title}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {therapist.specialties.slice(0, 3).map((s) => (
                      <Badge key={s} className="capitalize">{s}</Badge>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1 text-amber-500">
                      <Star className="h-4 w-4 fill-current" />
                      {therapist.ratingCount > 0 ? therapist.ratingAvg.toFixed(1) : 'New'}
                      {therapist.ratingCount > 0 && (
                        <span className="text-slate-400">({therapist.ratingCount})</span>
                      )}
                    </span>
                    <span className="font-semibold">
                      {formatMoney(therapist.hourlyRateCents, therapist.currency)}/hr
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="No therapists match your filters" />
      )}
    </div>
  );
}
