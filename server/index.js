// server/index.js
// Tiny Express proxy for the AI chat. Its ONE job: keep the OpenAI
// key off the frontend and enforce safety rules server-side, where
// the client can't bypass them.

import express from 'express'

const PORT = Number(process.env.PORT) || 3001
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const OPENAI_MODEL = 'gpt-4o-mini'

const MAX_MESSAGES = 20
const MAX_CONTENT_LENGTH = 1000
const MAX_REPLY_TOKENS = 400
const ALLOWED_ROLES = new Set(['user', 'assistant'])
const ALLOWED_LANGUAGES = new Set(['en', 'sw'])

// The safety rules live HERE, server-side, so no client can strip them.
function buildSystemPrompt(language) {
  const languageLine =
    language === 'sw'
      ? 'Reply in Kiswahili unless the user writes in English.'
      : 'Reply in English unless the user writes in Kiswahili.'

  return [
    'You are Akili, a warm, supportive mental wellness companion for people in Tanzania and East Africa.',
    'You are NOT a therapist or doctor. Never diagnose any condition. Never prescribe or advise on medication.',
    'Listen, encourage, and suggest simple evidence-based coping strategies (breathing, journaling, talking to trusted people, rest, routine).',
    'Keep replies short and warm — a few sentences, not essays.',
    'If the user expresses thoughts of self-harm, suicide, or being in danger: respond with calm empathy, encourage them to contact local emergency services or a trusted person right now, and point them to the Help section of the app. Do not lecture or panic.',
    'For ongoing or severe struggles, gently encourage seeing a mental health professional.',
    languageLine,
  ].join(' ')
}

function validateChatRequest(body) {
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return 'messages must be a non-empty array'
  }
  if (body.messages.length > MAX_MESSAGES) {
    return `too many messages (max ${MAX_MESSAGES})`
  }
  for (const message of body.messages) {
    if (!ALLOWED_ROLES.has(message?.role)) {
      return 'each message needs role "user" or "assistant"'
    }
    if (
      typeof message.content !== 'string' ||
      message.content.length === 0 ||
      message.content.length > MAX_CONTENT_LENGTH
    ) {
      return `each message needs content of 1-${MAX_CONTENT_LENGTH} characters`
    }
  }
  if (body.language !== undefined && !ALLOWED_LANGUAGES.has(body.language)) {
    return 'language must be "en" or "sw"'
  }
  return null
}

const app = express()
app.use(express.json({ limit: '50kb' })) // bound request size

app.post('/api/chat', async (request, response) => {
  const validationError = validateChatRequest(request.body)
  if (validationError) {
    response.status(400).json({ error: validationError })
    return
  }

  if (!OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set — see server/.env.example')
    response.status(503).json({ error: 'AI service is not configured' })
    return
  }

  const { messages, language = 'en' } = request.body

  try {
    const openaiResponse = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: MAX_REPLY_TOKENS,
        messages: [
          { role: 'system', content: buildSystemPrompt(language) },
          ...messages,
        ],
      }),
    })

    if (!openaiResponse.ok) {
      const errorBody = await openaiResponse.text()
      console.error('OpenAI error:', openaiResponse.status, errorBody)
      response.status(502).json({ error: 'AI service error' })
      return
    }

    const data = await openaiResponse.json()
    const reply = data?.choices?.[0]?.message?.content

    if (typeof reply !== 'string' || reply.length === 0) {
      console.error('Unexpected OpenAI response shape:', JSON.stringify(data).slice(0, 500))
      response.status(502).json({ error: 'AI service returned no reply' })
      return
    }

    response.json({ reply })
  } catch (error) {
    console.error('chat proxy failed:', error)
    response.status(502).json({ error: 'AI service unreachable' })
  }
})

app.listen(PORT, () => {
  console.log(`Akili server listening on http://localhost:${PORT}`)
})
