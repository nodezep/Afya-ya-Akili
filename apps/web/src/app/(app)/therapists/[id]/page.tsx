'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { api } from '@/lib/api';
import { cn, formatDate, formatMoney, initials } from '@/lib/utils';
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  Spinner,
} from '@/components/ui';

interface TherapistDetail {
  id: string;
  title: string;
  yearsExperience: number;
  specialties: string[];
  languages: string[];
  education?: string | null;
  about?: string | null;
  hourlyRateCents: number;
  currency: string;
  ratingAvg: number;
  ratingCount: number;
  user: { profile: { firstName: string; lastName: string; avatarUrl?: string | null; city?: string | null } };
  availability: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  reviews: Array<{
    rating: number;
    comment?: string | null;
    createdAt: string;
    author: { profile: { firstName: string } | null };
  }>;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function nextDays(count: number): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d.toISOString().slice(0, 10);
  });
}

export default function TherapistDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [date, setDate] = useState(nextDays(1)[0]);
  const [slot, setSlot] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: therapist, isLoading } = useQuery({
    queryKey: ['therapist', params.id],
    queryFn: () => api<TherapistDetail>(`/therapists/${params.id}`),
  });

  const { data: availability, isLoading: loadingSlots } = useQuery({
    queryKey: ['availability', params.id, date],
    queryFn: () =>
      api<{ slots: string[] }>(`/appointments/availability/${params.id}?date=${date}`),
  });

  const book = useMutation({
    mutationFn: () =>
      api<{ id: string }>('/appointments', {
        method: 'POST',
        body: JSON.stringify({ therapistId: params.id, startsAt: slot }),
      }),
    onSuccess: () => router.push('/appointments?booked=1'),
    onError: (err) => setError((err as Error).message),
  });

  if (isLoading) return <Spinner />;
  if (!therapist) return <ErrorState message="Therapist not found" />;

  const profile = therapist.user.profile;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardContent className="flex flex-wrap items-start gap-4">
            <Avatar src={profile.avatarUrl} fallback={initials(profile.firstName, profile.lastName)} size={72} />
            <div className="flex-1">
              <h1 className="text-xl font-bold">
                {profile.firstName} {profile.lastName}
              </h1>
              <p className="text-slate-500">{therapist.title}</p>
              <p className="mt-1 flex items-center gap-2 text-sm text-slate-400">
                <span className="flex items-center gap-1 text-amber-500">
                  <Star className="h-4 w-4 fill-current" />
                  {therapist.ratingCount > 0 ? `${therapist.ratingAvg.toFixed(1)} (${therapist.ratingCount})` : 'New'}
                </span>
                · {therapist.yearsExperience} yrs experience
                {profile.city && ` · ${profile.city}`}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {therapist.specialties.map((s) => (
                  <Badge key={s} className="capitalize">{s}</Badge>
                ))}
                {therapist.languages.map((l) => (
                  <Badge key={l} variant="info">{l.toUpperCase()}</Badge>
                ))}
              </div>
            </div>
            <p className="text-lg font-bold">
              {formatMoney(therapist.hourlyRateCents, therapist.currency)}
              <span className="text-sm font-normal text-slate-400">/hour</span>
            </p>
          </CardContent>
        </Card>

        {therapist.about && (
          <Card>
            <CardHeader><CardTitle>About</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">{therapist.about}</p>
              {therapist.education && (
                <p className="mt-3 text-sm text-slate-500"><strong>Education:</strong> {therapist.education}</p>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Reviews</CardTitle></CardHeader>
          <CardContent>
            {therapist.reviews.length === 0 ? (
              <p className="text-sm text-slate-500">No reviews yet.</p>
            ) : (
              <ul className="space-y-4">
                {therapist.reviews.map((review, i) => (
                  <li key={i} className="border-b border-slate-100 pb-4 last:border-0 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="flex text-amber-500">
                        {Array.from({ length: review.rating }).map((_, star) => (
                          <Star key={star} className="h-3.5 w-3.5 fill-current" />
                        ))}
                      </span>
                      <span className="text-sm font-medium">{review.author.profile?.firstName ?? 'Member'}</span>
                      <span className="text-xs text-slate-400">{formatDate(review.createdAt)}</span>
                    </div>
                    {review.comment && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{review.comment}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Booking panel */}
      <div>
        <Card className="sticky top-20">
          <CardHeader><CardTitle>Book a session</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {error && <ErrorState message={error} />}
            <div>
              <p className="mb-2 text-sm font-medium">Pick a date</p>
              <div className="grid grid-cols-4 gap-1.5">
                {nextDays(8).map((d) => {
                  const dayName = DAYS[new Date(`${d}T00:00:00Z`).getUTCDay()];
                  return (
                    <button
                      key={d}
                      onClick={() => {
                        setDate(d);
                        setSlot(null);
                      }}
                      className={cn(
                        'rounded-lg border px-1 py-2 text-center text-xs',
                        date === d
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-200 dark:border-slate-700',
                      )}
                    >
                      <span className="block font-semibold">{dayName}</span>
                      {d.slice(8)}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium">Available times (UTC)</p>
              {loadingSlots ? (
                <Spinner className="py-4" />
              ) : availability && availability.slots.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {availability.slots.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSlot(s)}
                      className={cn(
                        'rounded-lg border px-2 py-1.5 text-xs',
                        slot === s
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-200 dark:border-slate-700',
                      )}
                    >
                      {new Date(s).toISOString().slice(11, 16)}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No slots on this day.</p>
              )}
            </div>
            <Button className="w-full" disabled={!slot} loading={book.isPending} onClick={() => book.mutate()}>
              Request booking
            </Button>
            <p className="text-xs text-slate-400">
              You&apos;ll pay after the therapist confirms — M-Pesa, Airtel Money, or card.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
