// Root component: auth session, language toggle, and simple tab
// navigation between the five features.
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { AuthForm } from './AuthForm'
import { CheckIn } from './CheckIn'
import { MoodHistory } from './MoodHistory'
import { Journal } from './Journal'
import { Breathing } from './Breathing'
import { Chat } from './Chat'
import { Support } from './Support'
import { DailyPrompt } from './DailyPrompt'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'sw', label: 'Kiswahili' },
]

const TABS = [
  { id: 'checkin', en: 'Check-in', sw: 'Tathmini' },
  { id: 'journal', en: 'Journal', sw: 'Shajara' },
  { id: 'breathe', en: 'Breathe', sw: 'Pumua' },
  { id: 'chat', en: 'Talk', sw: 'Ongea' },
  { id: 'help', en: 'Help', sw: 'Msaada' },
]

export function App() {
  // undefined = still checking, null = signed out, object = signed in.
  const [session, setSession] = useState(undefined)
  const [language, setLanguage] = useState('en')
  const [activeTab, setActiveTab] = useState('checkin')
  const [savedCount, setSavedCount] = useState(0)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .catch((error) => {
        console.error('getSession failed:', error)
        setSession(null)
      })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    )
    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('signOut failed:', error)
  }

  if (session === undefined) {
    return <div className="wrap"><p>Loading…</p></div>
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <h1>Akili</h1>
        <div>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => setLanguage(lang.code)}
              style={{ fontWeight: language === lang.code ? 'bold' : 'normal' }}
            >
              {lang.label}
            </button>
          ))}
          {session && (
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          )}
        </div>
      </div>

      {session ? (
        <>
          <nav aria-label="Sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id}
              >
                {tab[language] ?? tab.en}
              </button>
            ))}
          </nav>

          {activeTab === 'checkin' && (
            <>
              <DailyPrompt language={language} />
              <CheckIn
                language={language}
                onSaved={() => setSavedCount((count) => count + 1)}
              />
              <MoodHistory language={language} refreshKey={savedCount} />
            </>
          )}
          {activeTab === 'journal' && <Journal language={language} />}
          {activeTab === 'breathe' && <Breathing language={language} />}
          {activeTab === 'chat' && <Chat language={language} />}
          {activeTab === 'help' && <Support language={language} />}
        </>
      ) : (
        <AuthForm />
      )}
    </div>
  )
}
