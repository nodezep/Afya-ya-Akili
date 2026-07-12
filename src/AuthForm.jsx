// Sign up / sign in via Supabase Auth. One component handles both,
// toggled by `mode`, so validation and error handling live in one place.
import { useState } from 'react'
import { supabase } from './supabaseClient'

const MIN_PASSWORD_LENGTH = 8

export function AuthForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState('signIn') // 'signIn' | 'signUp'
  const [status, setStatus] = useState({ type: 'idle', message: '' })

  async function handleSubmit(event) {
    event.preventDefault()

    if (!email.includes('@')) {
      setStatus({ type: 'error', message: 'Please enter a valid email.' })
      return
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus({
        type: 'error',
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      })
      return
    }

    setStatus({ type: 'loading', message: 'Please wait…' })

    const { error } =
      mode === 'signUp'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setStatus({ type: 'error', message: error.message })
      return
    }

    setStatus({
      type: 'success',
      message:
        mode === 'signUp'
          ? 'Check your email to confirm your account.'
          : 'Signed in.',
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{mode === 'signUp' ? 'Create account' : 'Sign in'}</h2>

      <input
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        required
      />
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        required
      />

      <button type="submit" disabled={status.type === 'loading'}>
        {mode === 'signUp' ? 'Sign up' : 'Sign in'}
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
      >
        {mode === 'signUp' ? 'Have an account? Sign in' : 'New here? Create account'}
      </button>

      {status.message && <p role="status">{status.message}</p>}
    </form>
  )
}
