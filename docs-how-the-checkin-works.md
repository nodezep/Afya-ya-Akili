# Akili — Ally-Inspired Daily Check-in: How It Works

Version 1 · The first complete feature slice: database → security → UI → history.

---

## 1. What we borrowed from Ally (and what we didn't)

Ally's core loop is simple and effective:

> **Check in → reflect privately → notice your patterns over time.**

That loop is what this feature implements. We deliberately did **not** copy:

- Ally's name, branding, visual design, or written content (their intellectual
  property — and Akili should have its own identity)
- Their AI conversation layer (that's our Phase 2, built our own way)
- Their subscription flow

## 2. Tanzanian adaptations baked in from day one

| Ally (European) assumption | Akili decision |
|---|---|
| German/English UI | **Swahili + English in the same component** — every label exists in both; language is a prop, defaulting safely to English |
| Fast connections, modern phones | **Tiny payloads**: one small insert per check-in, last 7 rows on load; works on cheap Android + patchy data |
| Card payments | Not relevant yet — when a paid tier comes, it targets **mobile money** (M-Pesa, Tigo Pesa, Airtel Money) |
| Low-stigma environment | **Privacy is a feature**: notes are optional, marked "private/siri yako", users can delete any entry, and the database physically prevents anyone else reading them |

> Swahili strings in the code are my drafts. Before launch, have a native
> speaker review them — emotional wording ("Chini sana" etc.) deserves a human eye.

## 3. Architecture (where each piece lives)

```
┌─────────────────────────────┐
│  React (Next.js)            │
│  ┌──────────┐ ┌───────────┐ │
│  │ CheckIn  │ │MoodHistory│ │   UI: capture + reflect back
│  └────┬─────┘ └─────┬─────┘ │
│       │  supabase-js │      │
└───────┼──────────────┼──────┘
        ▼              ▼
┌─────────────────────────────┐
│  Supabase                   │
│  Auth ── who you are        │
│  Postgres ── mood_entries   │
│  RLS ── the security wall   │
└─────────────────────────────┘
```

No custom backend server exists yet — supabase-js talks straight to the
database, and **Row Level Security is what makes that safe**. The Python/FastAPI
AI service enters only in Phase 2.

## 4. Data flow, step by step

**Saving a check-in (CheckIn.jsx):**
1. User taps a mood (1–5) and optionally writes a note.
2. The component validates locally first: a mood is chosen, note ≤ 1000 chars.
   (Fail fast, friendly message, no wasted network call.)
3. It confirms someone is signed in (`supabase.auth.getUser()`).
4. It inserts `{ user_id, mood_score, note }` into `mood_entries`.
5. Postgres re-checks everything the client claimed:
   - `CHECK (mood_score between 1 and 5)` — invalid scores are impossible
   - `CHECK (char_length(note) <= 1000)` — oversized notes are impossible
   - RLS `with check (auth.uid() = user_id)` — writing as someone else is impossible
6. On success the form resets and calls `onSaved()` so the parent can refresh.

**Reading history (MoodHistory.jsx):**
1. Selects the latest 7 entries, newest first.
2. There is deliberately **no `where user_id = ...` in the client** — RLS adds
   that filter server-side. Even a buggy or malicious client can only ever
   receive its own rows. Security lives in the database, not in JavaScript.
3. An index on `(user_id, created_at desc)` makes this query fast forever.

## 5. The security model in one paragraph

Every protection exists **twice**: once in the UI (for a kind user experience)
and once in Postgres (as the actual guarantee). The client validates so users
get instant, polite feedback; the database constrains so that no bug, console
trick, or hostile request can bypass the rules. For a mental-health app, the
database layer is the one that matters — treat the UI checks as courtesy only.

Deletion is a right, not an afterthought: users can delete individual entries
(RLS delete policy), and deleting an account cascades away all their data
(profiles → mood_entries), which supports right-to-erasure obligations under
Tanzania's data-protection law and GDPR.

## 6. Setup (in order)

1. Run `02_mood_entries.sql` in Supabase → SQL Editor (after the profiles migration).
2. Confirm in Table Editor: `mood_entries` exists with the RLS shield icon.
3. Copy `CheckIn.jsx` and `MoodHistory.jsx` into `src/`.
4. Wire them together:

```jsx
// inside your signed-in area
const [savedCount, setSavedCount] = useState(0)

<CheckIn
  language={profile.preferred_language}
  onSaved={() => setSavedCount((count) => count + 1)}
/>
<MoodHistory
  language={profile.preferred_language}
  refreshKey={savedCount}
/>
```

5. Test: check in as user A, sign out, sign in as user B — B must see nothing of A's.
   **Run this test every time you add a table.**

## 7. Known gaps (honest list, not TODOs in code)

- **No styling yet** — components are semantic, accessible HTML; the calming
  design pass comes when we do the design system.
- **One check-in per day is not enforced** — users can check in repeatedly.
  Fine for v1; a daily-uniqueness rule is a small later migration if wanted.
- **No chart yet** — the list is the v1 "pattern awareness"; a weekly chart is
  the natural next iteration.
- **No AI reflection yet** — Ally's "AI notices your patterns" is Phase 2,
  where the FastAPI service and pgvector arrive.
- **Timezone display** uses the phone's locale; entries are stored in UTC
  (timestamptz), which is correct and lets us render any timezone later.

## 8. What's next

The satisfying next step: a **weekly mood chart** on top of this exact data —
no schema changes needed. After that, the resource hub, then Phase 2 (AI).
