// src/CheckIn.jsx
// Akili daily check-in (Ally-inspired: quick mood + optional reflection).
// Bilingual EN/SW. Saves to Supabase mood_entries (RLS enforces ownership).

import { useState } from 'react'
import { supabase } from './supabaseClient'

// Named constants — no magic numbers scattered in logic.
const NOTE_MAX_LENGTH = 1000
const MOOD_MIN = 1
const MOOD_MAX = 5

// Mood options live in data, not JSX, so adding/reordering moods
// is a one-line change and both languages stay in sync.
const MOODS = [
  { score: 1, emoji: '😞', en: 'Very low', sw: 'Chini sana' },
  { score: 2, emoji: '😔', en: 'Low',      sw: 'Chini' },
  { score: 3, emoji: '😐', en: 'Okay',     sw: 'Sawa' },
  { score: 4, emoji: '🙂', en: 'Good',     sw: 'Nzuri' },
  { score: 5, emoji: '😄', en: 'Great',    sw: 'Nzuri sana' },
]

const TEXT = {
  en: {
    title: 'How are you feeling today?',
    notePlaceholder: "What's on your mind? (optional, private)",
    save: 'Save check-in',
    saving: 'Saving…',
    saved: 'Saved. Thank you for checking in.',
    pickMood: 'Please choose a mood first.',
    noteTooLong: `Note is too long (max ${NOTE_MAX_LENGTH} characters).`,
    notSignedIn: 'Please sign in to save your check-in.',
    genericError: 'Could not save. Please try again.',
  },
  sw: {
    title: 'Unajisikiaje leo?',
    notePlaceholder: 'Nini kipo akilini mwako? (hiari, ni siri yako)',
    save: 'Hifadhi',
    saving: 'Inahifadhi…',
    saved: 'Imehifadhiwa. Asante kwa kujitathmini.',
    pickMood: 'Tafadhali chagua hisia kwanza.',
    noteTooLong: `Maelezo ni marefu mno (kikomo ni herufi ${NOTE_MAX_LENGTH}).`,
    notSignedIn: 'Tafadhali ingia kwanza ili kuhifadhi.',
    genericError: 'Imeshindikana kuhifadhi. Jaribu tena.',
  },
}

export function CheckIn({ language = 'en', onSaved }) {
  const t = TEXT[language] ?? TEXT.en // guard: unknown language falls back safely

  const [selectedScore, setSelectedScore] = useState(null)
  const [note, setNote] = useState('')
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  async function handleSave() {
    // --- validate before touching the network ---
    if (
      selectedScore === null ||
      selectedScore < MOOD_MIN ||
      selectedScore > MOOD_MAX
    ) {
      setStatus({ type: 'error', message: t.pickMood })
      return
    }
    if (note.length > NOTE_MAX_LENGTH) {
      setStatus({ type: 'error', message: t.noteTooLong })
      return
    }

    setStatus({ type: 'loading', message: t.saving })

    // Who is signed in? RLS also enforces this server-side; this check
    // just gives the user a clear message instead of a cryptic failure.
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      setStatus({ type: 'error', message: t.notSignedIn })
      return
    }

    const trimmedNote = note.trim()
    const { error } = await supabase.from('mood_entries').insert({
      user_id: authData.user.id,
      mood_score: selectedScore,
      note: trimmedNote === '' ? null : trimmedNote, // store null, not ''
    })

    if (error) {
      // Log details for you; show a calm, non-technical message to the user.
      console.error('mood_entries insert failed:', error)
      setStatus({ type: 'error', message: t.genericError })
      return
    }

    setStatus({ type: 'success', message: t.saved })
    setSelectedScore(null)
    setNote('')
    onSaved?.() // let the parent refresh history/charts if it wants
  }

  return (
    <section aria-label={t.title}>
      <h2>{t.title}</h2>

      <div role="radiogroup" aria-label={t.title}>
        {MOODS.map((mood) => (
          <button
            key={mood.score}
            type="button"
            role="radio"
            aria-checked={selectedScore === mood.score}
            onClick={() => setSelectedScore(mood.score)}
            style={{
              fontWeight: selectedScore === mood.score ? 'bold' : 'normal',
            }}
          >
            {mood.emoji} {mood[language] ?? mood.en}
          </button>
        ))}
      </div>

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder={t.notePlaceholder}
        maxLength={NOTE_MAX_LENGTH}
        rows={3}
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={status.type === 'loading'}
      >
        {status.type === 'loading' ? t.saving : t.save}
      </button>

      {status.message && <p role="status">{status.message}</p>}
    </section>
  )
}
