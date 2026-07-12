// src/Journal.jsx
// Private reflection journal (Ally-inspired). Write, list, delete.
// RLS guarantees entries are only ever visible to their owner.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const CONTENT_MAX_LENGTH = 5000
const RECENT_ENTRIES_LIMIT = 10

const TEXT = {
  en: {
    title: 'Your journal',
    placeholder: 'Write freely. This is private — only you can see it.',
    save: 'Save entry',
    saving: 'Saving…',
    empty: 'No entries yet. Writing things down often makes them lighter.',
    tooLong: `Entry is too long (max ${CONTENT_MAX_LENGTH} characters).`,
    tooShort: 'Write something first.',
    deleteLabel: 'Delete',
    loadError: 'Could not load your journal. Please try again.',
    saveError: 'Could not save. Please try again.',
    deleteError: 'Could not delete. Please try again.',
  },
  sw: {
    title: 'Shajara yako',
    placeholder: 'Andika kwa uhuru. Hii ni siri yako — wewe pekee unaweza kuiona.',
    save: 'Hifadhi',
    saving: 'Inahifadhi…',
    empty: 'Hakuna maandishi bado. Kuandika mara nyingi hupunguza uzito wa mawazo.',
    tooLong: `Maandishi ni marefu mno (kikomo ni herufi ${CONTENT_MAX_LENGTH}).`,
    tooShort: 'Andika kitu kwanza.',
    deleteLabel: 'Futa',
    loadError: 'Imeshindikana kupakia shajara. Jaribu tena.',
    saveError: 'Imeshindikana kuhifadhi. Jaribu tena.',
    deleteError: 'Imeshindikana kufuta. Jaribu tena.',
  },
}

export function Journal({ language = 'en' }) {
  const t = TEXT[language] ?? TEXT.en

  const [content, setContent] = useState('')
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState({ type: 'loading', message: '' })

  const loadEntries = useCallback(async () => {
    const { data, error } = await supabase
      .from('journal_entries')
      .select('id, content, created_at')
      .order('created_at', { ascending: false })
      .limit(RECENT_ENTRIES_LIMIT)

    if (error) {
      console.error('journal_entries select failed:', error)
      setStatus({ type: 'error', message: t.loadError })
      return
    }
    setEntries(data ?? [])
    setStatus({ type: 'idle', message: '' })
  }, [t.loadError])

  useEffect(() => {
    loadEntries()
  }, [loadEntries])

  async function handleSave() {
    const trimmed = content.trim()
    if (trimmed.length === 0) {
      setStatus({ type: 'error', message: t.tooShort })
      return
    }
    if (trimmed.length > CONTENT_MAX_LENGTH) {
      setStatus({ type: 'error', message: t.tooLong })
      return
    }

    setStatus({ type: 'loading', message: t.saving })

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      setStatus({ type: 'error', message: t.saveError })
      return
    }

    const { error } = await supabase.from('journal_entries').insert({
      user_id: authData.user.id,
      content: trimmed,
    })

    if (error) {
      console.error('journal_entries insert failed:', error)
      setStatus({ type: 'error', message: t.saveError })
      return
    }

    setContent('')
    await loadEntries()
  }

  async function handleDelete(entryId) {
    const { error } = await supabase
      .from('journal_entries')
      .delete()
      .eq('id', entryId)

    if (error) {
      console.error('journal_entries delete failed:', error)
      setStatus({ type: 'error', message: t.deleteError })
      return
    }
    await loadEntries()
  }

  return (
    <section aria-label={t.title}>
      <h2>{t.title}</h2>

      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={t.placeholder}
        maxLength={CONTENT_MAX_LENGTH}
        rows={5}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={status.type === 'loading'}
      >
        {status.type === 'loading' ? t.saving : t.save}
      </button>

      {status.message && <p role="status">{status.message}</p>}

      {entries.length === 0 && status.type === 'idle' ? (
        <p>{t.empty}</p>
      ) : (
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.created_at}>
                {new Date(entry.created_at).toLocaleDateString(
                  language === 'sw' ? 'sw-TZ' : 'en-GB'
                )}
              </time>
              <p>{entry.content}</p>
              <button type="button" onClick={() => handleDelete(entry.id)}>
                {t.deleteLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
