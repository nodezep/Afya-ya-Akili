'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, Tokens } from '@/lib/api';
import { useAuth } from '@/providers/app-providers';
import { Button, ErrorState, Input, Label } from '@/components/ui';
import { OAuthButtons } from '@/components/oauth-buttons';

export default function RegisterPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const update = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ tokens: Tokens }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
        skipAuth: true,
      });
      await signIn(result.tokens);
      router.push('/dashboard?welcome=1');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-slate-500">Free forever plan. No card required.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        {error && <ErrorState message={error} />}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" required value={form.firstName} onChange={update('firstName')} />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" required value={form.lastName} onChange={update('lastName')} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={update('email')} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={update('password')}
          />
          <p className="mt-1 text-xs text-slate-400">
            At least 8 characters with an uppercase letter, lowercase letter, and number.
          </p>
        </div>
        <Button type="submit" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>

      <div className="mt-6">
        <OAuthButtons />
      </div>

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link href="/auth/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
