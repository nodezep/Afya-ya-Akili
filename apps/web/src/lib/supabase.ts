'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Supabase is used purely for Google/Apple OAuth. The resulting access token
 * is exchanged for first-party AKILI tokens at POST /auth/oauth.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey);
  }
  return client;
}
