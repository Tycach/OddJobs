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

import { POLICY_VERSIONS } from "./TermsDialog"
export type AuthMethod = "phone" | "email"

export type OAuthProvider = "apple" | "google"
export type ProviderApplication = {
  publicName: string
  bio: string
  region: string
  status: string
}
export type AuthProfile = {
  id: string
  displayName: string
  status: string
  roles: string[]
}

type AuthContextValue = {
  loading: boolean
  profile: AuthProfile | null
  recovery: boolean
  rememberMe: boolean
  supplierSignupPending: boolean
  policyConsentRequired: boolean
  setRememberMe: (remember: boolean) => void
  acceptCurrentPolicies: () => Promise<void>
  requestOtp: (
    method: AuthMethod,
    identifier: string,
    signup?: { displayName: string; intent: "customer" | "supplier" },
  ) => Promise<string | null>
  signInWithPassword: (
    method: AuthMethod,
    identifier: string,
    password: string,
  ) => Promise<string | null>
  signUp: (
    method: AuthMethod,
    identifier: string,
    password: string,
    displayName: string,
    intent: "customer" | "supplier",
  ) => Promise<{ error: string | null; needsVerification: boolean }>
  signInWithOAuth: (provider: OAuthProvider) => Promise<string | null>
  requestPasswordReset: (email: string) => Promise<string | null>
  updatePassword: (password: string) => Promise<string | null>
  completePasswordRecovery: () => void
  verifyOtp: (
    method: AuthMethod,
    identifier: string,
    token: string,
  ) => Promise<string | null>
  resendOtp: (method: AuthMethod, identifier: string) => Promise<string | null>
  submitProviderApplication: (
    application: Omit<ProviderApplication, "status">,
  ) => Promise<ProviderApplication>
  signOut: () => Promise<void>
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseApiKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY
const apiUrl = (
  import.meta.env.VITE_API_URL || "http://127.0.0.1:3000"
).replace(/\/$/, "")
let rememberSession =
  window.localStorage.getItem("oddjobs-auth-remember-session") === "1"
const authStorage = {
  getItem: async (key: string) =>
    window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key),
  setItem: async (key: string, value: string) => {
    const target = rememberSession ? window.localStorage : window.sessionStorage
    const other = rememberSession ? window.sessionStorage : window.localStorage
    other.removeItem(key)
    target.setItem(key, value)
  },
  removeItem: async (key: string) => {
    window.localStorage.removeItem(key)
    window.sessionStorage.removeItem(key)
  },
}
const supabase: SupabaseClient | null =
  supabaseUrl && supabaseApiKey
    ? createClient(supabaseUrl, supabaseApiKey, {
        auth: {
          autoRefreshToken: true,
          detectSessionInUrl: true,
          persistSession: true,
          storage: authStorage,
        },
      })
    : null

const AuthContext = createContext<AuthContextValue | null>(null)

function getAuthErrorMessage(
  error: { message: string; code?: string } | null,
  fallback: string,
) {
  if (!error) return fallback
  const code = error.code?.toLowerCase() ?? ""
  const message = error.message.toLowerCase()

  if (
    code.includes("rate_limit") ||
    code.includes("too_many") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "There have been too many attempts. Please wait a few minutes and try again."
  }
  if (
    code.includes("email_not_confirmed") ||
    message.includes("email not confirmed")
  ) {
    return "Please verify your email using the link we sent before signing in."
  }
  if (
    code.includes("invalid_credentials") ||
    message.includes("invalid login credentials")
  ) {
    return "Those sign-in details don’t match. Check them and try again."
  }
  if (
    code.includes("otp_expired") ||
    code.includes("token_expired") ||
    message.includes("expired")
  ) {
    return "That verification link or code has expired. Request a new one and try again."
  }
  if (
    code.includes("invalid_otp") ||
    code.includes("otp_invalid") ||
    message.includes("invalid otp") ||
    message.includes("invalid token")
  ) {
    return "That verification code doesn’t look right. Check it and try again."
  }
  if (code.includes("weak_password") || message.includes("weak password")) {
    return "Choose a stronger password and try again."
  }

  return fallback
}

function getApiErrorMessage(status: number, fallback: string) {
  if (status === 401) return "Please sign in again and retry."
  if (status === 429) {
    return "There have been too many attempts. Please wait a few minutes and try again."
  }
  if (status >= 500) {
    return "This service is temporarily unavailable. Please try again shortly."
  }
  return fallback
}

async function postPolicyConsent(
  accessToken: string,
  termsVersion: string,
  privacyVersion: string,
) {
  const consentResponse = await fetch(`${apiUrl}/v1/me/policy-consents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ termsVersion, privacyVersion }),
  })
  if (!consentResponse.ok) {
    throw new Error(
      getApiErrorMessage(
        consentResponse.status,
        "We couldn’t save your policy acceptance. Please try again.",
      ),
    )
  }
}

async function fetchProfile(
  session: Session,
): Promise<{ profile: AuthProfile; policyConsentRequired: boolean }> {
  const headers = { Authorization: `Bearer ${session.access_token}` }
  let response = await fetch(`${apiUrl}/v1/me`, { headers })
  if (response.status === 404) {
    response = await fetch(`${apiUrl}/v1/me/bootstrap`, {
      method: "POST",
      headers,
    })
  }
  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(
        response.status,
        "We couldn’t load your profile. Please try again.",
      ),
    )
  }
  const profile = (await response.json()) as AuthProfile
  const metadata = session.user.user_metadata
  const termsVersion = metadata?.oddjobs_terms_version
  const privacyVersion = metadata?.oddjobs_privacy_version
  const policyConsentRequired =
    termsVersion !== POLICY_VERSIONS.terms ||
    privacyVersion !== POLICY_VERSIONS.privacy
  if (!policyConsentRequired) {
    await postPolicyConsent(
      session.access_token,
      POLICY_VERSIONS.terms,
      POLICY_VERSIONS.privacy,
    )
  }
  return { profile, policyConsentRequired }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))

  const [recovery, setRecovery] = useState(false)
  const [supplierSignupPending, setSupplierSignupPending] = useState(false)
  const [policyConsentRequired, setPolicyConsentRequired] = useState(false)
  useEffect(() => {
    if (!supabase) return
    let active = true
    let loadingToken: string | null = null

    const loadProfile = async (session: Session | null) => {
      if (!session) {
        loadingToken = null
        setSupplierSignupPending(false)
        setPolicyConsentRequired(false)
        setProfile(null)
        setLoading(false)
        return
      }
      setSupplierSignupPending(
        session.user.user_metadata?.account_intent === "supplier",
      )
      if (loadingToken === session.access_token) return
      loadingToken = session.access_token

      setLoading(true)
      try {
        const result = await fetchProfile(session)
        if (active && loadingToken === session.access_token) {
          setProfile(result.profile)
          setPolicyConsentRequired(result.policyConsentRequired)
        }
      } catch (error) {
        console.error(
          "Unable to load the authenticated OddJobs profile.",
          error,
        )
        if (active && loadingToken === session.access_token) setProfile(null)
      } finally {
        if (active && loadingToken === session.access_token) setLoading(false)
      }
    }

    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error("Unable to restore the Supabase session.", error)
      if (active) void loadProfile(data.session)
    })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true)
      if (active) void loadProfile(session)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const acceptCurrentPolicies = async () => {
    if (!supabase) {
      throw new Error(
        "Account services are temporarily unavailable. Please try again later.",
      )
    }
    const updateResult = await supabase.auth.updateUser({
      data: {
        oddjobs_terms_version: POLICY_VERSIONS.terms,
        oddjobs_privacy_version: POLICY_VERSIONS.privacy,
      },
    })
    if (updateResult.error) {
      throw new Error(
        getAuthErrorMessage(
          updateResult.error,
          "We couldn’t save your policy acceptance. Please try again.",
        ),
      )
    }

    const sessionResult = await supabase.auth.getSession()
    if (sessionResult.error) {
      throw new Error(
        getAuthErrorMessage(
          sessionResult.error,
          "We couldn’t confirm your sign-in. Please sign in again.",
        ),
      )
    }
    if (!sessionResult.data.session) {
      throw new Error("Sign in again to save your policy acceptance.")
    }

    await postPolicyConsent(
      sessionResult.data.session.access_token,
      POLICY_VERSIONS.terms,
      POLICY_VERSIONS.privacy,
    )
    setPolicyConsentRequired(false)
  }

  const requestOtp = async (
    method: AuthMethod,
    identifier: string,
    signup?: { displayName: string; intent: "customer" | "supplier" },
  ) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }
    const options = signup
      ? {
          shouldCreateUser: true,
          data: {
            full_name: signup.displayName,
            oddjobs_terms_version: POLICY_VERSIONS.terms,
            oddjobs_privacy_version: POLICY_VERSIONS.privacy,
            ...(signup.intent === "supplier"
              ? { account_intent: signup.intent }
              : {}),
          },
        }
      : { shouldCreateUser: false }
    const result =
      method === "phone"
        ? await supabase.auth.signInWithOtp({
            phone: identifier,
            options,
          })
        : await supabase.auth.signInWithOtp({
            email: identifier,
            options,
          })
    return result.error
      ? getAuthErrorMessage(
          result.error,
          "We couldn’t send a verification code. Please try again shortly.",
        )
      : null
  }
  const signInWithPassword = async (
    method: AuthMethod,
    identifier: string,
    password: string,
  ) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }
    const result =
      method === "phone"
        ? await supabase.auth.signInWithPassword({
            phone: identifier,
            password,
          })
        : await supabase.auth.signInWithPassword({
            email: identifier,
            password,
          })
    return result.error
      ? getAuthErrorMessage(
          result.error,
          "We couldn’t sign you in. Please check your details and try again.",
        )
      : null
  }

  const signUp = async (
    method: AuthMethod,
    identifier: string,
    password: string,
    displayName: string,
    intent: "customer" | "supplier",
  ) => {
    if (!supabase) {
      return {
        error: "Account services are temporarily unavailable. Please try again later.",
        needsVerification: false,
      }
    }
    const options = {
      data: {
        full_name: displayName,
        oddjobs_terms_version: POLICY_VERSIONS.terms,
        oddjobs_privacy_version: POLICY_VERSIONS.privacy,
        ...(intent === "supplier" ? { account_intent: intent } : {}),
      },
      emailRedirectTo: `${window.location.origin}/consumer/login`,
    }
    const result =
      method === "phone"
        ? await supabase.auth.signUp({
            phone: identifier,
            password,
            options,
          })
        : await supabase.auth.signUp({
            email: identifier,
            password,
            options,
          })
    return {
      error: result.error
        ? getAuthErrorMessage(
            result.error,
            "We couldn’t create your account right now. Please try again shortly.",
          )
        : null,
      needsVerification: !result.error && !result.data.session,
    }
  }
  const signInWithOAuth = async (provider: OAuthProvider) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.href },
    })
    return error
      ? getAuthErrorMessage(
          error,
          "We couldn’t start sign-in with that option. Please try again.",
        )
      : null
  }
  const requestPasswordReset = async (email: string) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/consumer/login`,
    })
    return error
      ? getAuthErrorMessage(
          error,
          "We couldn’t send a reset link. Please try again shortly.",
        )
      : null
  }
  const updatePassword = async (password: string) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }
    const { error } = await supabase.auth.updateUser({ password })
    return error
      ? getAuthErrorMessage(
          error,
          "We couldn’t update your password. Please try again.",
        )
      : null
  }
  const verifyOtp = async (
    method: AuthMethod,
    identifier: string,
    token: string,
  ) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }
    const result =
      method === "phone"
        ? await supabase.auth.verifyOtp({
            phone: identifier,
            token,
            type: "sms",
          })
        : await supabase.auth.verifyOtp({
            email: identifier,
            token,
            type: "email",
          })
    return result.error
      ? getAuthErrorMessage(
          result.error,
          "We couldn’t verify that code. Please try again.",
        )
      : null
  }

  const resendOtp = async (method: AuthMethod, identifier: string) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }
    const result =
      method === "phone"
        ? await supabase.auth.resend({ type: "sms", phone: identifier })
        : await supabase.auth.signInWithOtp({
            email: identifier,
            options: { shouldCreateUser: false },
          })
    return result.error
      ? getAuthErrorMessage(
          result.error,
          "We couldn’t send a new verification code. Please try again.",
        )
      : null
  }

  const submitProviderApplication = async (
    application: Omit<ProviderApplication, "status">,
  ): Promise<ProviderApplication> => {
    if (!supabase) {
      throw new Error(
        "Account services are temporarily unavailable. Please try again later.",
      )
    }
    const { data, error } = await supabase.auth.getSession()
    if (error) {
      throw new Error(
        getAuthErrorMessage(
          error,
          "We couldn’t confirm your sign-in. Please sign in again.",
        ),
      )
    }
    if (!data.session) {
      throw new Error("Please sign in before submitting your supplier application.")
    }
    const response = await fetch(`${apiUrl}/v1/provider-applications`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(application),
    })
    if (!response.ok) {
      throw new Error(
        getApiErrorMessage(
          response.status,
          "We couldn’t submit your supplier application. Please try again.",
        ),
      )
    }
    const result = (await response.json()) as ProviderApplication
    const metadataResult = await supabase.auth.updateUser({
      data: { account_intent: null },
    })
    if (metadataResult.error) {
      throw new Error(
        "Your application was received, but we couldn’t finish updating your account. Please contact support if you need help.",
      )
    }
    setSupplierSignupPending(false)
    return result
  }
  const signOut = async () => {
    if (!supabase) return
    const { error } = await supabase.auth.signOut()
    if (error) {
      throw new Error(
        getAuthErrorMessage(
          error,
          "We couldn’t sign you out. Please try again.",
        ),
      )
    }
  }

  return (
    <AuthContext.Provider
      value={{
        loading,
        profile,
        recovery,
        rememberMe: rememberSession,
        supplierSignupPending,
        policyConsentRequired,
        setRememberMe: (remember) => {
          rememberSession = remember
          window.localStorage.setItem(
            "oddjobs-auth-remember-session",
            remember ? "1" : "0",
          )
        },
        acceptCurrentPolicies,
        requestOtp,
        signInWithPassword,
        signUp,
        signInWithOAuth,
        requestPasswordReset,
        updatePassword,
        completePasswordRecovery: () => setRecovery(false),
        verifyOtp,
        resendOtp,
        submitProviderApplication,
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