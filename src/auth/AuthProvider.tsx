import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js"

export type AuthMethod = "phone" | "email"

export type AuthProfile = {
  id: string
  displayName: string
  status: string
  roles: string[]
}

type AuthContextValue = {
  configured: boolean
  loading: boolean
  profile: AuthProfile | null
  requestOtp: (method: AuthMethod, identifier: string) => Promise<string | null>
  verifyOtp: (
    method: AuthMethod,
    identifier: string,
    token: string,
  ) => Promise<string | null>
  resendOtp: (method: AuthMethod, identifier: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseApiKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:3000").replace(/\/$/, "")
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseApiKey
    ? createClient(supabaseUrl, supabaseApiKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
        },
      })
    : null

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchProfile(session: Session): Promise<AuthProfile> {
  const headers = { Authorization: `Bearer ${session.access_token}` }
  let response = await fetch(`${apiUrl}/v1/me`, { headers })
  if (response.status === 404) {
    response = await fetch(`${apiUrl}/v1/me/bootstrap`, {
      method: "POST",
      headers,
    })
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { error?: string }
      | null
    throw new Error(body?.error || "Unable to load your OddJobs profile.")
  }
  return (await response.json()) as AuthProfile
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  useEffect(() => {
    if (!supabase) return
    let active = true
    let loadingToken: string | null = null

    const loadProfile = async (session: Session | null) => {
      if (!session) {
        loadingToken = null
        setProfile(null)
        setLoading(false)
        return
      }
      if (loadingToken === session.access_token) return
      loadingToken = session.access_token

      setLoading(true)
      try {
        const nextProfile = await fetchProfile(session)
        if (active && loadingToken === session.access_token) {
          setProfile(nextProfile)
        }
      } catch (error) {
        console.error("Unable to load the authenticated OddJobs profile.", error)
        if (active && loadingToken === session.access_token) setProfile(null)
      } finally {
        if (active && loadingToken === session.access_token) setLoading(false)
      }
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Unable to restore the Supabase session.", error)
      if (active) void loadProfile(data.session)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) void loadProfile(session)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const requestOtp = async (method: AuthMethod, identifier: string) => {
    if (!supabase) {
      return "Supabase Auth is not configured. Add the public Supabase URL and key to the web app environment."
    }
    const result =
      method === "phone"
        ? await supabase.auth.signInWithOtp({
            phone: identifier,
            options: { shouldCreateUser: true },
          })
        : await supabase.auth.signInWithOtp({
            email: identifier,
            options: { shouldCreateUser: true },
          })
    return result.error?.message ?? null
  }

  const verifyOtp = async (
    method: AuthMethod,
    identifier: string,
    token: string,
  ) => {
    if (!supabase) return "Supabase Auth is not configured."
    const result =
      method === "phone"
        ? await supabase.auth.verifyOtp({ phone: identifier, token, type: "sms" })
        : await supabase.auth.verifyOtp({ email: identifier, token, type: "email" })
    return result.error?.message ?? null
  }

  const resendOtp = async (method: AuthMethod, identifier: string) => {
    if (!supabase) return "Supabase Auth is not configured."
    const result =
      method === "phone"
        ? await supabase.auth.resend({ type: "sms", phone: identifier })
        : await supabase.auth.signInWithOtp({
            email: identifier,
            options: { shouldCreateUser: true },
          })
    return result.error?.message ?? null
  }

  const signOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider
      value={{
        configured: Boolean(supabase),
        loading,
        profile,
        requestOtp,
        verifyOtp,
        resendOtp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error("AuthProvider is required.")
  return context
}