// One shared client for the whole app. Every file imports this same
// instance instead of creating its own.
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loudly at startup if config is missing, instead of a confusing
// network error somewhere deep in the app later.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill it in.'
  )
}

// ============================================================================
// DEVELOPER PREVIEW MODE: MOCK SUPABASE CLIENT
// If the configured URL is a placeholder/dummy URL, we intercept all calls
// and route them to browser LocalStorage. This allows exploring and using the
// entire layout (check-in, journal, breathing, chat) with zero database setup!
// ============================================================================

class MockQueryBuilder {
  constructor(table) {
    this.table = table
    this.eqField = null
    this.eqValue = null
  }

  select() { return this }
  order() { return this }
  limit() { return this }
  delete() { return this }
  
  eq(field, value) {
    this.eqField = field
    this.eqValue = value
    return this
  }

  async insert(data) {
    const list = JSON.parse(localStorage.getItem(`mock_${this.table}`) || '[]')
    const records = Array.isArray(data) ? data : [data]
    const createdRecords = records.map(r => ({
      id: Math.random().toString(36).substring(2, 15),
      created_at: new Date().toISOString(),
      ...r
    }))
    
    list.push(...createdRecords)
    localStorage.setItem(`mock_${this.table}`, JSON.stringify(list))
    return { data: Array.isArray(data) ? createdRecords : createdRecords[0], error: null }
  }

  // Thenable interface makes the chain awaitable: e.g., await supabase.from(...).select(...)
  then(onfulfilled) {
    const list = JSON.parse(localStorage.getItem(`mock_${this.table}`) || '[]')
    let result = [...list]

    // Handle delete if eq was called
    if (this.eqField && this.eqValue !== null && this.eqValue !== undefined) {
      const filtered = list.filter(item => item[this.eqField] !== this.eqValue)
      localStorage.setItem(`mock_${this.table}`, JSON.stringify(filtered))
      result = filtered
    }

    // Sort: profiles, mood_entries, journal_entries descend; chat_messages ascend
    if (this.table === 'chat_messages') {
      result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    } else {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }

    return Promise.resolve({ data: result, error: null }).then(onfulfilled)
  }
}

let mockSession = JSON.parse(localStorage.getItem('mock_session') || 'null')
const authListeners = new Set()

const mockSupabase = {
  auth: {
    async getSession() {
      return { data: { session: mockSession }, error: null }
    },

    onAuthStateChange(callback) {
      authListeners.add(callback)
      // Trigger immediately
      setTimeout(() => callback('SIGNED_IN', mockSession), 0)
      return {
        data: {
          subscription: {
            unsubscribe() {
              authListeners.delete(callback)
            }
          }
        }
      }
    },

    async getUser() {
      if (!mockSession) return { data: { user: null }, error: new Error('Not signed in') }
      return { data: { user: mockSession.user }, error: null }
    },

    async signUp({ email, password }) {
      mockSession = {
        user: { id: 'mock-user-id-12345', email },
        access_token: 'mock-access-token'
      }
      localStorage.setItem('mock_session', JSON.stringify(mockSession))
      authListeners.forEach(cb => cb('SIGNED_IN', mockSession))
      return { data: { user: mockSession.user }, error: null }
    },

    async signInWithPassword({ email, password }) {
      mockSession = {
        user: { id: 'mock-user-id-12345', email },
        access_token: 'mock-access-token'
      }
      localStorage.setItem('mock_session', JSON.stringify(mockSession))
      authListeners.forEach(cb => cb('SIGNED_IN', mockSession))
      return { data: { session: mockSession }, error: null }
    },

    async signOut() {
      mockSession = null
      localStorage.removeItem('mock_session')
      authListeners.forEach(cb => cb('SIGNED_OUT', null))
      return { error: null }
    }
  },

  from(tableName) {
    return new MockQueryBuilder(tableName)
  }
}

// ============================================================================
// EXPORT CLIENT
// ============================================================================

const isPlaceholder = supabaseUrl.includes('placeholder-project')

export const supabase = isPlaceholder
  ? mockSupabase
  : createClient(supabaseUrl, supabaseAnonKey)
