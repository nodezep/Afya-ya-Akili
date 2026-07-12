'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, Tokens } from '@/lib/api';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/providers/app-providers';
import { ErrorState, Spinner } from '@/components/ui';

/** Handles the redirect from Supabase OAuth and exchanges tokens. */
export default function OAuthCallbackPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const supabase = getSupabase();
      if (!supabase) {
        setError('OAuth is not configured');
        return;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !data.session) {
        setError(sessionError?.message ?? 'No OAuth session found. Please try again.');
        return;
      }
      try {
        const result = await api<{ tokens: Tokens }>('/auth/oauth', {
          method: 'POST',
          body: JSON.stringify({ supabaseAccessToken: data.session.access_token }),
          skipAuth: true,
        });
        await signIn(result.tokens);
        router.replace('/dashboard');
      } catch (err) {
        setError((err as Error).message);
      }
    };
    void run();
  }, [router, signIn]);

  return (
    <div>
      <h1 className="text-2xl font-bold">Signing you in…</h1>
      {error ? <div className="mt-6"><ErrorState message={error} /></div> : <Spinner />}
    </div>
  );
}
