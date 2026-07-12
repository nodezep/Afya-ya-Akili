'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/utils';
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

interface Plan {
  id: string;
  tier: 'FREE' | 'PREMIUM' | 'CORPORATE';
  name: string;
  description: string;
  priceMonthlyCents: number;
  priceYearlyCents: number;
  currency: string;
  features: string[];
}

interface Subscription {
  plan: Plan | null;
  status: string;
  interval?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  isDefaultFree?: boolean;
}

interface Payment {
  id: string;
  provider: string;
  status: string;
  amountCents: number;
  currency: string;
  description: string;
  createdAt: string;
}

export default function BillingPage() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: plans } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: () => api<Plan[]>('/billing/plans'),
  });
  const { data: subscription, isLoading } = useQuery({
    queryKey: ['billing', 'subscription'],
    queryFn: () => api<Subscription>('/billing/subscription'),
  });
  const { data: payments } = useQuery({
    queryKey: ['billing', 'payments'],
    queryFn: () => api<{ items: Payment[] }>('/billing/payments?limit=20').then((r) => r.items),
  });

  const stripeCheckout = useMutation({
    mutationFn: () =>
      api<{ url: string }>('/billing/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify({ interval }),
      }),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (err) => setError((err as Error).message),
  });

  const mobileCheckout = useMutation({
    mutationFn: (provider: 'MPESA' | 'AIRTEL_MONEY') =>
      api<{ customerMessage: string }>('/billing/mobile-money/checkout', {
        method: 'POST',
        body: JSON.stringify({
          provider,
          phone,
          purpose: interval === 'year' ? 'PREMIUM_YEAR' : 'PREMIUM_MONTH',
        }),
      }),
    onSuccess: (result) => {
      setMessage(result.customerMessage);
      setError(null);
    },
    onError: (err) => setError((err as Error).message),
  });

  const cancelSub = useMutation({
    mutationFn: () => api('/billing/subscription/cancel', { method: 'POST' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['billing'] }),
    onError: (err) => setError((err as Error).message),
  });

  if (isLoading) return <Spinner />;

  const currentTier = subscription?.plan?.tier ?? 'FREE';
  const premium = plans?.find((p) => p.tier === 'PREMIUM');

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>
      {error && <ErrorState message={error} />}
      {message && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          {message} Your subscription activates as soon as the payment is confirmed.
        </div>
      )}

      {/* Current plan */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Current plan</CardTitle>
          <Badge variant={currentTier === 'FREE' ? 'default' : 'success'}>{currentTier}</Badge>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {subscription?.plan?.description ?? 'Core wellbeing tools, free forever.'}
          </p>
          {subscription?.currentPeriodEnd && (
            <p className="mt-2 text-sm text-slate-500">
              {subscription.cancelAtPeriodEnd ? 'Ends' : 'Renews'} on{' '}
              {formatDateTime(subscription.currentPeriodEnd)}
            </p>
          )}
          {currentTier !== 'FREE' && !subscription?.cancelAtPeriodEnd && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              loading={cancelSub.isPending}
              onClick={() => cancelSub.mutate()}
            >
              Cancel at period end
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Upgrade */}
      {currentTier === 'FREE' && premium && (
        <Card className="border-brand-500">
          <CardHeader>
            <CardTitle>Upgrade to Premium</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {(['month', 'year'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setInterval(option)}
                  className={`rounded-lg border px-4 py-2 text-sm ${
                    interval === option
                      ? 'border-brand-600 bg-brand-600 text-white'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {option === 'month'
                    ? `${formatMoney(premium.priceMonthlyCents, premium.currency)}/month`
                    : `${formatMoney(premium.priceYearlyCents, premium.currency)}/year`}
                </button>
              ))}
            </div>
            <ul className="grid gap-1.5 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
              {premium.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> {feature}
                </li>
              ))}
            </ul>
            <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
              <Button loading={stripeCheckout.isPending} onClick={() => stripeCheckout.mutate()}>
                Pay with card (Stripe)
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  placeholder="Phone e.g. +254712345678"
                  className="max-w-xs"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <Button
                  variant="secondary"
                  disabled={!phone}
                  loading={mobileCheckout.isPending}
                  onClick={() => mobileCheckout.mutate('MPESA')}
                >
                  M-Pesa
                </Button>
                <Button
                  variant="secondary"
                  disabled={!phone}
                  loading={mobileCheckout.isPending}
                  onClick={() => mobileCheckout.mutate('AIRTEL_MONEY')}
                >
                  Airtel Money
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment history */}
      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {payments.map((payment) => (
                <li key={payment.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{payment.description}</p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(payment.createdAt)} · {payment.provider}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatMoney(payment.amountCents, payment.currency)}</p>
                    <Badge
                      variant={
                        payment.status === 'SUCCEEDED'
                          ? 'success'
                          : payment.status === 'FAILED'
                            ? 'danger'
                            : 'warning'
                      }
                    >
                      {payment.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No payments yet" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
