'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Button, ErrorState, Spinner } from '@/components/ui';

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage('This verification link is missing its token.');
      return;
    }
    api('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
      skipAuth: true,
    })
      .then(() => setState('success'))
      .catch((err: Error) => {
        setState('error');
        setMessage(err.message);
      });
  }, [token]);

  if (state === 'verifying') return <Spinner />;
  if (state === 'error') return <div className="mt-6"><ErrorState message={message} /></div>;
  return (
    <div className="mt-6 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
      Your email is verified. Welcome to AKILI!
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Verifying your email</h1>
      <Suspense fallback={<Spinner />}>
        <VerifyEmailInner />
      </Suspense>
      <Link href="/dashboard" className="mt-8 block">
        <Button className="w-full">Go to dashboard</Button>
      </Link>
    </div>
  );
}
