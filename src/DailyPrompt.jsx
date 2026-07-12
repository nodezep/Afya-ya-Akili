// src/DailyPrompt.jsx
// The "Methali ya leo" band — Akili's signature. A traditional Swahili
// proverb (public folklore) with translation and a gentle reflection
// question, rotating daily. Styled like the printed message on a kanga.

const PROVERBS = [
  {
    sw: 'Akili ni mali.',
    en: 'The mind is wealth.',
    questionEn: 'What is one thought worth keeping today?',
    questionSw: 'Ni wazo gani moja la kutunza leo?',
  },
  {
    sw: 'Haba na haba, hujaza kibaba.',
    en: 'Little by little fills the measure.',
    questionEn: 'What small step did you manage today?',
    questionSw: 'Ni hatua gani ndogo umeweza leo?',
  },
  {
    sw: 'Pole pole ndio mwendo.',
    en: 'Slowly is the way to go.',
    questionEn: 'Where can you give yourself more time?',
    questionSw: 'Wapi unaweza kujipa muda zaidi?',
  },
  {
    sw: 'Baada ya dhiki, faraja.',
    en: 'After hardship comes relief.',
    questionEn: 'What has gotten easier for you lately?',
    questionSw: 'Ni nini kimekuwa rahisi kwako hivi karibuni?',
  },
  {
    sw: 'Umoja ni nguvu.',
    en: 'Unity is strength.',
    questionEn: 'Who could you reach out to today?',
    questionSw: 'Ni nani unaweza kuwasiliana naye leo?',
  },
  {
    sw: 'Subira huvuta heri.',
    en: 'Patience draws blessings.',
    questionEn: 'What are you waiting for patiently right now?',
    questionSw: 'Ni nini unakisubiri kwa subira kwa sasa?',
  },
]

const TITLE = { en: 'Proverb of the day', sw: 'Methali ya leo' }

function dayOfYear(date) {
  const startOfYear = new Date(date.getFullYear(), 0, 0)
  const millisecondsPerDay = 24 * 60 * 60 * 1000
  return Math.floor((date - startOfYear) / millisecondsPerDay)
}

export function DailyPrompt({ language = 'en' }) {
  // Same proverb all day, changes tomorrow — a small daily ritual.
  const proverb = PROVERBS[dayOfYear(new Date()) % PROVERBS.length]

  return (
    <aside className="methali" aria-label={TITLE[language] ?? TITLE.en}>
      <span className="methali-eyebrow">{TITLE[language] ?? TITLE.en}</span>
      <p className="methali-proverb">{proverb.sw}</p>
      <p className="methali-translation">{proverb.en}</p>
      <p className="methali-question">
        {language === 'sw' ? proverb.questionSw : proverb.questionEn}
      </p>
    </aside>
  )
}
