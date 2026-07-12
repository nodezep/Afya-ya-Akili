'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { Button, ErrorState, Input, Label } from '@/components/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
        skipAuth: true,
      });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Reset your password</h1>
      {sent ? (
        <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
          If an account exists for <strong>{email}</strong>, a reset link is on its way.
          Check your inbox (and spam folder).
        </div>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-500">
            Enter your email and we&apos;ll send you a reset link.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            {error && <ErrorState message={error} />}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </form>
        </>
      )}
      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/auth/login" className="font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
