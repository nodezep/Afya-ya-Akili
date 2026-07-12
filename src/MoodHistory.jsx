// src/MoodHistory.jsx
// Shows the user's recent check-ins — the "see your patterns" half of
// the Ally-inspired loop. Read-only in v1; RLS guarantees users only
// ever receive their own rows.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const RECENT_ENTRIES_LIMIT = 7 // roughly one week of daily check-ins

const TEXT = {
  en: {
    title: 'Your recent check-ins',
    empty: 'No check-ins yet. Your first one starts your story.',
    loadError: 'Could not load your history. Please try again.',
    loading: 'Loading…',
  },
  sw: {
    title: 'Tathmini zako za hivi karibuni',
    empty: 'Hakuna tathmini bado. Anza leo.',
    loadError: 'Imeshindikana kupakia historia. Jaribu tena.',
    loading: 'Inapakia…',
  },
}

const MOOD_EMOJI = { 1: '😞', 2: '😔', 3: '😐', 4: '🙂', 5: '😄' }

export function MoodHistory({ language = 'en', refreshKey = 0 }) {
  const t = TEXT[language] ?? TEXT.en

  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'

  const loadEntries = useCallback(async () => {
    setStatus('loading')

    // No user_id filter needed here: RLS already restricts rows to the
    // signed-in user. Defense lives in the database, not the client.
    const { data, error } = await supabase
      .from('mood_entries')
      .select('id, mood_score, note, created_at')
      .order('created_at', { ascending: false })
      .limit(RECENT_ENTRIES_LIMIT)

    if (error) {
      console.error('mood_entries select failed:', error)
      setStatus('error')
      return
    }

    setEntries(data ?? [])
    setStatus('ready')
  }, [])

  // refreshKey lets the parent trigger a reload after a new check-in:
  // <MoodHistory refreshKey={savedCount} />
  useEffect(() => {
    loadEntries()
  }, [loadEntries, refreshKey])

  if (status === 'loading') return <p>{t.loading}</p>
  if (status === 'error') return <p role="alert">{t.loadError}</p>

  return (
    <section aria-label={t.title}>
      <h2>{t.title}</h2>

      {entries.length === 0 ? (
        <p>{t.empty}</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <span>{MOOD_EMOJI[entry.mood_score] ?? '❓'}</span>{' '}
              <time dateTime={entry.created_at}>
                {new Date(entry.created_at).toLocaleDateString(
                  language === 'sw' ? 'sw-TZ' : 'en-GB'
                )}
              </time>
              {entry.note && <p>{entry.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
