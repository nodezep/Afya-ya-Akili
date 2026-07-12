// src/Breathing.jsx
// Box breathing (4-4-4-4): a guided circle that grows and shrinks.
// Runs entirely in the browser — works offline, no backend needed,
// which matters on patchy connections.

import { useEffect, useState } from 'react'

const PHASE_DURATION_SECONDS = 4
const PHASES = ['inhale', 'hold1', 'exhale', 'hold2']

const TEXT = {
  en: {
    title: 'Breathing exercise',
    intro: 'Follow the circle. Four seconds each: in, hold, out, hold.',
    start: 'Start',
    stop: 'Stop',
    inhale: 'Breathe in…',
    hold1: 'Hold…',
    exhale: 'Breathe out…',
    hold2: 'Hold…',
  },
  sw: {
    title: 'Zoezi la kupumua',
    intro: 'Fuata duara. Sekunde nne kila hatua: vuta, shikilia, toa, shikilia.',
    start: 'Anza',
    stop: 'Simama',
    inhale: 'Vuta pumzi…',
    hold1: 'Shikilia…',
    exhale: 'Toa pumzi…',
    hold2: 'Shikilia…',
  },
}

// The circle scales up on inhale, stays big on hold, shrinks on exhale.
const PHASE_SCALE = { inhale: 1.6, hold1: 1.6, exhale: 1.0, hold2: 1.0 }

export function Breathing({ language = 'en' }) {
  const t = TEXT[language] ?? TEXT.en

  const [isRunning, setIsRunning] = useState(false)
  const [phaseIndex, setPhaseIndex] = useState(0)

  useEffect(() => {
    if (!isRunning) return

    // One interval advances the phase; cleanup stops it when the
    // user leaves or presses stop, so no timers leak.
    const interval = setInterval(() => {
      setPhaseIndex((index) => (index + 1) % PHASES.length)
    }, PHASE_DURATION_SECONDS * 1000)

    return () => clearInterval(interval)
  }, [isRunning])

  const phase = PHASES[phaseIndex]

  return (
    <section aria-label={t.title}>
      <h2>{t.title}</h2>
      <p>{t.intro}</p>

      <div
        aria-hidden="true"
        style={{
          width: 80,
          height: 80,
          margin: '30px auto',
          borderRadius: '50%',
          background: 'var(--accent)',
          transform: `scale(${isRunning ? PHASE_SCALE[phase] : 1})`,
          transition: `transform ${PHASE_DURATION_SECONDS}s ease-in-out`,
        }}
      />

      {/* aria-live announces phase changes to screen readers */}
      <p role="status" aria-live="polite" style={{ textAlign: 'center' }}>
        {isRunning ? t[phase] : ''}
      </p>

      <button
        type="button"
        onClick={() => {
          setPhaseIndex(0)
          setIsRunning((running) => !running)
        }}
      >
        {isRunning ? t.stop : t.start}
      </button>
    </section>
  )
}
