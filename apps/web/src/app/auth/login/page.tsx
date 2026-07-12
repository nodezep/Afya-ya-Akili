'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, Tokens } from '@/lib/api';
import { useAuth } from '@/providers/app-providers';
import { Button, ErrorState, Input, Label } from '@/components/ui';
import { OAuthButtons } from '@/components/oauth-buttons';

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ tokens: Tokens }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });
      await signIn(result.tokens);
      router.push('/dashboard');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-1 text-sm text-slate-500">Sign in to continue your journey.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <ErrorState message={error} />}
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/auth/forgot-password" className="text-sm text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Sign in
        </Button>
      </form>

      <div className="mt-6">
        <OAuthButtons />
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        New to AKILI?{' '}
        <Link href="/auth/register" className="font-medium text-brand-600 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
