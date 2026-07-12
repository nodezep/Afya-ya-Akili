'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { api } from '@/lib/api';
import { Button, ErrorState, Input, Label, Spinner } from '@/components/ui';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await api('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, password }),
        skipAuth: true,
      });
      router.push('/auth/login?reset=1');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <ErrorState message="This reset link is missing its token. Request a new one from the forgot-password page." />
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-4">
      {error && <ErrorState message={error} />}
      <div>
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          type="password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <Button type="submit" className="w-full" loading={loading}>
        Set new password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Choose a new password</h1>
      <Suspense fallback={<Spinner />}>
        <ResetPasswordForm />
      </Suspense>
      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/auth/login" className="font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
