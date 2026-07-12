'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { api, Tokens } from '@/lib/api';
import { useAuth } from '@/providers/app-providers';
import { Button, ErrorState, Input, Label } from '@/components/ui';

/** Passwordless sign-in with a one-time code (email or phone). */
export default function OtpLoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [target, setTarget] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'LOGIN', target }),
        skipAuth: true,
      });
      setStep('verify');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api<{ tokens: Tokens }>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'LOGIN', target, code }),
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
      <h1 className="text-2xl font-bold">Sign in with a code</h1>
      <p className="mt-1 text-sm text-slate-500">
        We&apos;ll send a 6-digit code to your email or phone.
      </p>

      {step === 'request' ? (
        <form onSubmit={requestCode} className="mt-8 space-y-4">
          {error && <ErrorState message={error} />}
          <div>
            <Label htmlFor="target">Email or phone (+254…)</Label>
            <Input id="target" required value={target} onChange={(e) => setTarget(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="mt-8 space-y-4">
          {error && <ErrorState message={error} />}
          <p className="text-sm text-slate-500">
            Code sent to <strong>{target}</strong>.{' '}
            <button type="button" className="text-brand-600 hover:underline" onClick={() => setStep('request')}>
              Change
            </button>
          </p>
          <div>
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              required
              inputMode="numeric"
              maxLength={6}
              className="text-center text-2xl tracking-[0.5em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Verify and sign in
          </Button>
        </form>
      )}

      <p className="mt-8 text-center text-sm text-slate-500">
        <Link href="/auth/login" className="font-medium text-brand-600 hover:underline">
          Use password instead
        </Link>
      </p>
    </div>
  );
}
