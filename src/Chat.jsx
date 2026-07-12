// src/Chat.jsx
// AI wellness companion with memory: history loads from Supabase and
// every exchange is saved, so conversations survive refreshes.
// The OpenAI key stays on the Express server — never in this file.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

const MESSAGE_MAX_LENGTH = 1000
const HISTORY_SEND_LIMIT = 20 // what we send to the AI (bounds cost)
const HISTORY_LOAD_LIMIT = 50 // what we show from the database

const MORNING_END_HOUR = 12
const AFTERNOON_END_HOUR = 17

const TEXT = {
  en: {
    title: 'Talk to Akili',
    disclaimer:
      'Akili is a supportive companion, not a therapist, and does not diagnose. For emergencies, use the Help tab.',
    placeholder: 'What is on your mind?',
    send: 'Send',
    sending: '…',
    tooLong: `Message is too long (max ${MESSAGE_MAX_LENGTH} characters).`,
    serverError: 'Could not reach Akili right now. Please try again shortly.',
    loadError: 'Could not load your conversation history.',
    greetingMorning: 'Good morning. How are you starting your day?',
    greetingAfternoon: 'Good afternoon. How is your day going so far?',
    greetingEvening: 'Good evening. How was your day?',
  },
  sw: {
    title: 'Ongea na Akili',
    disclaimer:
      'Akili ni rafiki wa kukusaidia, si mtaalamu wa tiba, na haitoi utambuzi wa magonjwa. Kwa dharura, tumia sehemu ya Msaada.',
    placeholder: 'Nini kipo akilini mwako?',
    send: 'Tuma',
    sending: '…',
    tooLong: `Ujumbe ni mrefu mno (kikomo ni herufi ${MESSAGE_MAX_LENGTH}).`,
    serverError: 'Imeshindikana kumfikia Akili kwa sasa. Jaribu tena baadaye.',
    loadError: 'Imeshindikana kupakia mazungumzo yaliyopita.',
    greetingMorning: 'Habari za asubuhi. Unaanzaje siku yako?',
    greetingAfternoon: 'Habari za mchana. Siku yako inaendaje?',
    greetingEvening: 'Habari za jioni. Siku yako ilikuwaje?',
  },
}

function pickGreeting(t) {
  const hour = new Date().getHours()
  if (hour < MORNING_END_HOUR) return t.greetingMorning
  if (hour < AFTERNOON_END_HOUR) return t.greetingAfternoon
  return t.greetingEvening
}

export function Chat({ language = 'en' }) {
  const t = TEXT[language] ?? TEXT.en

  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState({ type: 'loading', message: '' })

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .order('created_at', { ascending: true })
      .limit(HISTORY_LOAD_LIMIT)

    if (error) {
      console.error('chat_messages select failed:', error)
      setStatus({ type: 'error', message: t.loadError })
      return
    }
    setMessages(data ?? [])
    setStatus({ type: 'idle', message: '' })
  }, [t.loadError])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  async function persistMessage(userId, role, content) {
    const { error } = await supabase
      .from('chat_messages')
      .insert({ user_id: userId, role, content })
    // A failed save shouldn't interrupt the conversation — the message
    // is already on screen. Log it so you can see it during development.
    if (error) console.error(`saving ${role} message failed:`, error)
  }

  async function handleSend() {
    const trimmed = draft.trim()
    if (trimmed.length === 0) return
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      setStatus({ type: 'error', message: t.tooLong })
      return
    }

    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      setStatus({ type: 'error', message: t.serverError })
      return
    }
    const userId = authData.user.id

    const nextMessages = [...messages, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setDraft('')
    setStatus({ type: 'loading', message: t.sending })
    await persistMessage(userId, 'user', trimmed)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Only role+content go to the AI — created_at stays local.
          messages: nextMessages
            .slice(-HISTORY_SEND_LIMIT)
            .map(({ role, content }) => ({ role, content })),
          language,
        }),
      })

      if (!response.ok) throw new Error(`Server responded ${response.status}`)

      const data = await response.json()
      if (typeof data.reply !== 'string' || data.reply.length === 0) {
        throw new Error('Malformed server response')
      }

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.reply },
      ])
      setStatus({ type: 'idle', message: '' })
      await persistMessage(userId, 'assistant', data.reply)
    } catch (error) {
      console.error('chat request failed:', error)
      setStatus({ type: 'error', message: t.serverError })
    }
  }

  return (
    <section aria-label={t.title}>
      <h2>{t.title}</h2>
      <p className="disclaimer">{t.disclaimer}</p>

      <div className="chat-log">
        {/* Coach feel: Akili speaks first when there's no history yet. */}
        {messages.length === 0 && status.type === 'idle' && (
          <p className="bubble assistant">{pickGreeting(t)}</p>
        )}
        {messages.map((message, index) => (
          <p key={index} className={`bubble ${message.role}`}>
            {message.content}
          </p>
        ))}
      </div>

      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={t.placeholder}
        maxLength={MESSAGE_MAX_LENGTH}
        rows={2}
      />
      <button
        type="button"
        onClick={handleSend}
        disabled={status.type === 'loading'}
      >
        {status.type === 'loading' ? t.sending : t.send}
      </button>

      {status.type === 'error' && <p role="alert">{status.message}</p>}
    </section>
  )
}
