import { useEffect, useRef, useState, type FormEvent } from "react"

import { useAuth, type AuthMethod, type OAuthProvider } from "./AuthProvider"

import TermsDialog from "./TermsDialog"

import type { Role } from "../demo/model"

type AuthStage =
  | "login"
  | "role"
  | "signup"
  | "signupOtp"
  | "otp"
  | "forgot"
  | "recovery"
  | "recoveryDone"
  | "signupSent"
  | "policyConsent"

type SignupIntent = "customer" | "supplier"

type AuthExperienceProps = {
  initialRole?: Role | null

  initialStage: AuthStage

  chooseWorkspace: (role: Role) => void

  changeWorkspace: () => void
}

function identify(
  value: string,
): { method: AuthMethod; identifier: string } | null {
  const trimmed = value.trim()

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { method: "email", identifier: trimmed.toLowerCase() }
  }

  let digits = trimmed.replace(/\D/g, "")

  if (digits.startsWith("254")) digits = digits.slice(3)

  if (digits.startsWith("0")) digits = digits.slice(1)

  if (!/^[17]\d{8}$/.test(digits)) return null

  return { method: "phone", identifier: `+254${digits}` }
}

function getErrorMessage(error: unknown) {
  console.error("Authentication request failed.", error)
  return "We couldn’t complete that request. Please try again shortly."
}

export default function AuthExperience({
  initialRole = null,

  initialStage,

  chooseWorkspace,

  changeWorkspace,
}: AuthExperienceProps) {
  const auth = useAuth()

  const [stage, setStage] = useState<AuthStage>(initialStage)

  const [intent, setIntent] = useState<SignupIntent>("customer")

  const [name, setName] = useState("")

  const [identifier, setIdentifier] = useState("")

  const [activeIdentifier, setActiveIdentifier] = useState("")

  const [activeMethod, setActiveMethod] = useState<AuthMethod>("email")

  const [password, setPassword] = useState("")

  const [confirmation, setConfirmation] = useState("")

  const [otp, setOtp] = useState("")

  const [termsAccepted, setTermsAccepted] = useState(false)

  const [termsRead, setTermsRead] = useState(false)

  const [privacyRead, setPrivacyRead] = useState(false)

  const [termsOpen, setTermsOpen] = useState(false)

  const [activePolicy, setActivePolicy] = useState<"terms" | "privacy">("terms")

  const [remember, setRemember] = useState(auth.rememberMe)

  const [showPassword, setShowPassword] = useState(false)

  const [busy, setBusy] = useState(false)

  const [error, setErrorState] = useState("")
  const errorTimeout = useRef<number | null>(null)

  const [notice, setNotice] = useState("")

  const [logoFailed, setLogoFailed] = useState(false)

  const [showMobileWelcome, setShowMobileWelcome] = useState(
    initialStage === "login",
  )

  const setError = (message: string) => {
    if (errorTimeout.current !== null) {
      window.clearTimeout(errorTimeout.current)
      errorTimeout.current = null
    }

    setErrorState(message)
    if (message) {
      errorTimeout.current = window.setTimeout(() => {
        setErrorState("")
        errorTimeout.current = null
      }, 6000)
    }
  }

  useEffect(
    () => () => {
      if (errorTimeout.current !== null) {
        window.clearTimeout(errorTimeout.current)
      }
    },
    [],
  )

  const selectedRole = initialRole ?? "consumer"

  const canRegister = !["admin", "support", "partner"].includes(selectedRole)

  const startSignup = (nextIntent: SignupIntent) => {
    setIntent(nextIntent)

    setTermsAccepted(false)

    setTermsRead(false)

    setPrivacyRead(false)

    setError("")

    setNotice("")

    setStage("signup")
  }

  const backToLogin = () => {
    setError("")

    setNotice("")

    setStage("login")
  }

  const openMobileLogin = () => {
    setError("")
    setNotice("")
    setStage("login")
    setShowMobileWelcome(false)
  }

  const openMobileSignup = (nextIntent: SignupIntent) => {
    startSignup(nextIntent)
    setShowMobileWelcome(false)
  }

  const returnToMobileWelcome = () => {
    setError("")
    setNotice("")
    setStage("login")
    setShowMobileWelcome(true)
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const contact = identify(identifier)

    if (!contact) {
      setError("Enter a valid email address or Kenyan mobile number.")

      return
    }

    if (!password) {
      setError("Enter your password.")

      return
    }

    setError("")

    setBusy(true)

    auth.setRememberMe(remember)

    try {
      const message = await auth.signInWithPassword(
        contact.method,

        contact.identifier,

        password,
      )

      if (message) setError(message)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const contact = identify(identifier)

    if (name.trim().length < 2) {
      setError("Enter your name.")

      return
    }

    if (!contact) {
      setError("Enter a valid email address or Kenyan mobile number.")

      return
    }

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.")

      return
    }

    if (password !== confirmation) {
      setError("Your passwords do not match.")

      return
    }

    if (!termsAccepted) {
      setError("Read and accept both policies to create an account.")

      return
    }

    setError("")

    setBusy(true)

    auth.setRememberMe(remember)

    try {
      const result = await auth.signUp(
        contact.method,

        contact.identifier,

        password,

        name.trim(),

        intent,
      )

      if (result.error) {
        setError(result.error)

        return
      }

      setActiveIdentifier(contact.identifier)

      setActiveMethod(contact.method)

      setNotice(
        contact.method === "phone"
          ? "Enter the verification code sent to your phone."
          : `Check ${contact.identifier} for a verification link to finish creating your account.`,
      )

      setStage(
        contact.method === "phone" && result.needsVerification
          ? "otp"
          : result.needsVerification
            ? "signupSent"
            : "login",
      )

      if (!result.needsVerification)
        setNotice("Your account is ready. You can now sign in.")
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const handleOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit verification code.")

      return
    }

    setError("")

    setBusy(true)

    try {
      const message = await auth.verifyOtp(activeMethod, activeIdentifier, otp)

      if (message) setError(message)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const handleOtpSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const contact = identify(identifier)

    if (name.trim().length < 2) {
      setError("Enter your name.")

      return
    }

    if (!contact) {
      setError("Enter a valid email address or Kenyan mobile number.")

      return
    }

    if (!termsAccepted) {
      setError("Read and accept both policies to create an account.")

      return
    }

    setError("")

    setBusy(true)

    try {
      const message = await auth.requestOtp(
        contact.method,
        contact.identifier,
        {
          displayName: name.trim(),

          intent,
        },
      )

      if (message) {
        setError(message)

        return
      }

      setActiveIdentifier(contact.identifier)

      setActiveMethod(contact.method)

      setOtp("")

      setNotice(`A verification code was sent to ${contact.identifier}.`)

      setStage("otp")
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const handlePolicyAcceptance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!termsAccepted) {
      setError("Read and accept both policies to continue.")
      return
    }

    setError("")
    setBusy(true)
    try {
      await auth.acceptCurrentPolicies()
      setNotice("Your policy acceptance is saved. You can continue to OddJobs.")
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const handlePolicySignOut = async () => {
    setError("")
    setBusy(true)
    try {
      await auth.signOut()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const sendOtp = async () => {
    const contact = identify(identifier)

    if (!contact) {
      setError("Enter a valid email address or Kenyan mobile number.")

      return
    }

    setError("")

    setBusy(true)

    try {
      const message = await auth.requestOtp(contact.method, contact.identifier)

      if (message) {
        setError(message)

        return
      }

      setActiveIdentifier(contact.identifier)

      setActiveMethod(contact.method)

      setOtp("")

      setNotice(`A verification code was sent to ${contact.identifier}.`)

      setStage("otp")
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const sendPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const contact = identify(identifier)

    if (!contact || contact.method !== "email") {
      setError("Enter the email address linked to your account.")

      return
    }

    setError("")

    setBusy(true)

    try {
      const message = await auth.requestPasswordReset(contact.identifier)

      if (message) setError(message)
      else
        setNotice(
          "If an account exists for that email, a reset link is on its way.",
        )
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (password.length < 8) {
      setError("Use a password with at least 8 characters.")

      return
    }

    if (password !== confirmation) {
      setError("Your passwords do not match.")

      return
    }

    setError("")

    setBusy(true)

    try {
      const message = await auth.updatePassword(password)

      if (message) setError(message)
      else {
        setNotice("Your password has been updated.")

        setStage("recoveryDone")
      }
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const socialSignIn = async (provider: OAuthProvider) => {
    setError("")

    setBusy(true)

    auth.setRememberMe(remember)

    try {
      const message = await auth.signInWithOAuth(provider)

      if (message) setError(message)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const resendOtp = async () => {
    setError("")

    setNotice("")

    setBusy(true)

    try {
      const message = await auth.resendOtp(activeMethod, activeIdentifier)

      if (message) setError(message)
      else setNotice("A new verification code was sent.")
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setBusy(false)
    }
  }

  const renderPasswordFields = (confirm = false) => (
    <>
      <label className="auth-field">
        <span>{confirm ? "New password" : "Password"}</span>
        <span className="auth-password-wrap">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={confirm ? "new-password" : "current-password"}
            minLength={8}
            required
          />
          <button
            className="auth-show-password"
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </span>
      </label>
      {(confirm || stage === "signup") && (
        <label className="auth-field">
          <span>Confirm password</span>
          <input
            type={showPassword ? "text" : "password"}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
      )}
    </>
  )

  return (
    <main className="auth-experience">
      <section className="auth-art" aria-label="OddJobs marketplace">
        <div className="auth-art-frame">
          <img
            src={`${import.meta.env.BASE_URL}oddjobs-auth-art.jpg`}
            alt="OddJobs: Find. Hire. Get it done. Trusted local service professionals."
          />
        </div>
      </section>
      <section
        className={`mobile-auth-welcome${showMobileWelcome ? "" : " mobile-auth-welcome-hidden"}`}
        aria-label="Welcome to OddJobs"
      >
        <div className="mobile-auth-brand">
          {logoFailed ? (
            <div className="auth-panel-brand-fallback" aria-label="OddJobs.com">
              <strong>OddJobs.com</strong>
              <span>Building doors where none exist.</span>
            </div>
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}oddjobs-logo.png`}
              alt="OddJobs.com — Building doors where none exist."
              onError={() => setLogoFailed(true)}
            />
          )}
        </div>
        <div className="mobile-auth-art">
          <img
            src={`${import.meta.env.BASE_URL}oddjobs-auth-art.jpg`}
            alt=""
          />
        </div>
        <div className="mobile-auth-intro">
          <h1>Find trusted local help. Get it done.</h1>
          <p>Connect with reliable service professionals in your community.</p>
        </div>
        <div className="mobile-auth-actions">
          <button type="button" className="auth-submit" onClick={openMobileLogin}>
            Log in
          </button>
          {canRegister && (
            <button
              type="button"
              className="mobile-auth-signup"
              onClick={() => openMobileSignup("customer")}
            >
              Create account
            </button>
          )}
        </div>
        {canRegister && (
          <button
            type="button"
            className="mobile-auth-supplier"
            onClick={() => openMobileSignup("supplier")}
          >
            Become a supplier
          </button>
        )}
      </section>
      <section
        className={`auth-panel${showMobileWelcome ? " auth-panel-mobile-hidden" : ""}`}
      >
        {initialStage === "login" &&
          !showMobileWelcome &&
          (stage === "login" || stage === "signup") && (
            <button
              type="button"
              className="mobile-auth-back"
              onClick={returnToMobileWelcome}
            >
              ← Back
            </button>
          )}
        <div className="auth-panel-brand">
          {logoFailed ? (
            <div className="auth-panel-brand-fallback" aria-label="OddJobs.com">
              <strong>OddJobs.com</strong>
              <span>Building doors where none exist.</span>
            </div>
          ) : (
            <img
              src={`${import.meta.env.BASE_URL}oddjobs-logo.png`}
              alt="OddJobs.com — Building doors where none exist."
              onError={() => setLogoFailed(true)}
            />
          )}
        </div>
        <div className="auth-form-card">
          {initialRole && (stage === "login" || stage === "signup") && (
            <button
              type="button"
              className="auth-back"
              onClick={changeWorkspace}
            >
              ← Change workspace
            </button>
          )}

          {stage === "role" && (
            <>
              <p className="auth-accent-line" />
              <h1>Choose your workspace</h1>
              <p className="auth-subtitle">
                How would you like to use OddJobs?
              </p>
              {(["consumer", "provider", "partner"] as const).map((role) => (
                <button
                  type="button"
                  className="auth-role-choice"
                  key={role}
                  onClick={() => chooseWorkspace(role)}
                >
                  {role === "consumer"
                    ? "Find trusted help"
                    : role === "provider"
                      ? "Offer services"
                      : "Partner workspace"}
                  <span aria-hidden="true">→</span>
                </button>
              ))}
              <p className="auth-terms">
                Provider access requires review. Staff workspaces are
                provisioned by OddJobs.
              </p>
            </>
          )}

          {stage === "policyConsent" && (
            <>
              <p className="auth-accent-line" />
              <h1>Review our updated policies</h1>
              <p className="auth-subtitle">
                Please read the current Terms &amp; Conditions and Privacy
                Policy to continue using OddJobs.
              </p>
              <form className="auth-form" onSubmit={handlePolicyAcceptance}>
                <div className="auth-terms-consent">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      disabled={!termsRead || !privacyRead}
                      onChange={(event) =>
                        setTermsAccepted(event.target.checked)
                      }
                      required
                    />
                    <span>
                      I agree to the Terms &amp; Conditions and acknowledge the
                      Privacy Policy.
                    </span>
                  </label>
                  <div className="auth-policy-links">
                    <button
                      type="button"
                      className="auth-text-button"
                      onClick={() => {
                        setActivePolicy("terms")
                        setTermsOpen(true)
                      }}
                    >
                      {termsRead
                        ? "Review Terms & Conditions"
                        : "Read Terms & Conditions"}
                    </button>
                    <button
                      type="button"
                      className="auth-text-button"
                      onClick={() => {
                        setActivePolicy("privacy")
                        setTermsOpen(true)
                      }}
                    >
                      {privacyRead
                        ? "Review Privacy Policy"
                        : "Read Privacy Policy"}
                    </button>
                  </div>
                  {(!termsRead || !privacyRead) && (
                    <span className="auth-terms-hint">
                      Read both documents to the end before accepting.
                    </span>
                  )}
                </div>
                <button className="auth-submit" disabled={busy || !termsAccepted}>
                  {busy ? "Saving acceptance..." : "Accept and continue"}
                </button>
              </form>
              <button
                type="button"
                className="auth-otp-link"
                onClick={() => void handlePolicySignOut()}
                disabled={busy}
              >
                Sign out instead
              </button>
            </>
          )}

          {stage === "login" && (
            <>
              <p className="auth-accent-line" />
              <h1>Welcome Back!</h1>
              <p className="auth-subtitle">Log in to access your account</p>
              {initialRole &&
                ["admin", "support", "partner"].includes(initialRole) && (
                  <p className="auth-inline-note">
                    This workspace is restricted. Access is checked after
                    sign-in.
                  </p>
                )}
              <form className="auth-form" onSubmit={handleLogin}>
                <label className="auth-field">
                  <span>Email address or phone number</span>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    autoComplete="username"
                    placeholder="Email Address or Phone Number"
                    required
                  />
                </label>
                {renderPasswordFields()}
                <div className="auth-options">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(event) => {
                        setRemember(event.target.checked)

                        auth.setRememberMe(event.target.checked)
                      }}
                    />
                    <span>Remember Me</span>
                  </label>
                  <button
                    type="button"
                    className="auth-text-button"
                    onClick={() => {
                      setError("")

                      setNotice("")

                      setStage("forgot")
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <button className="auth-submit" disabled={busy}>
                  {busy ? "Signing in..." : "➜  Login"}
                </button>
              </form>
              <div className="auth-divider">
                <span>or</span>
              </div>
              <div className="auth-socials">
                <button
                  type="button"
                  onClick={() => void socialSignIn("google")}
                  disabled={busy}
                >
                  <b className="auth-google-mark" aria-hidden="true">
                    G
                  </b>{" "}
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={() => void socialSignIn("apple")}
                  disabled={busy}
                >
                  <svg
                    className="auth-apple-mark"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="currentColor"
                      d="M16.4 12.7c0-2 1.6-3 1.7-3.1a3.7 3.7 0 0 0-2.9-1.6c-1.2-.1-2.3.7-2.9.7s-1.5-.7-2.5-.7A3.8 3.8 0 0 0 6.6 10c-1.4 2.4-.4 6 1 7.9.7.9 1.4 1.8 2.3 1.8.9 0 1.3-.6 2.5-.6 1.1 0 1.5.6 2.5.6.9 0 1.5-.9 2.2-1.8.8-1 1.1-2 1.1-2.1-.1 0-2.1-.8-2.1-3.1zM14.4 6.4c.5-.6.9-1.4.8-2.2-.7 0-1.5.5-2 1.1-.4.5-.8 1.3-.7 2.1.8.1 1.5-.4 1.9-1z"
                    />
                  </svg>
                  Continue with Apple
                </button>
              </div>
              {canRegister && (
                <div className="auth-signup-links">
                  <p>
                    Don’t have an account?{" "}
                    <button
                      type="button"
                      className="auth-text-button"
                      onClick={() => startSignup("customer")}
                    >
                      Sign Up as a Customer <span aria-hidden="true">→</span>
                    </button>
                  </p>
                  <button
                    type="button"
                    className="auth-supplier-button"
                    onClick={() => startSignup("supplier")}
                  >
                    <span aria-hidden="true">▣</span> Become a Supplier{" "}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
              {initialRole === null && (
                <button
                  type="button"
                  className="auth-workspace-link"
                  onClick={() => setStage("role")}
                >
                  Choose a different workspace
                </button>
              )}
              <button
                type="button"
                className="auth-otp-link"
                onClick={() => void sendOtp()}
                disabled={busy}
              >
                Use a one-time code instead
              </button>
            </>
          )}

          {stage === "signup" && (
            <>
              <button type="button" className="auth-back" onClick={backToLogin}>
                ← Back to login
              </button>
              <p className="auth-accent-line" />
              <h1>
                {intent === "supplier"
                  ? "Become a Supplier"
                  : "Create your account"}
              </h1>
              <p className="auth-subtitle">
                {intent === "supplier"
                  ? "Create your account, then submit your supplier profile for review."
                  : "Sign up as a customer to find trusted local services."}
              </p>
              <form className="auth-form" onSubmit={handleSignup}>
                <label className="auth-field">
                  <span>Full name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    maxLength={120}
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>Email address or phone number</span>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    autoComplete="username"
                    placeholder="Email Address or Phone Number"
                    required
                  />
                </label>
                {renderPasswordFields(true)}
                <label className="auth-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(event) => {
                      setRemember(event.target.checked)

                      auth.setRememberMe(event.target.checked)
                    }}
                  />
                  <span>Remember Me</span>
                </label>
                <div className="auth-terms-consent">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      disabled={!termsRead || !privacyRead}
                      onChange={(event) =>
                        setTermsAccepted(event.target.checked)
                      }
                      required
                    />
                    <span>
                      I agree to the Terms &amp; Conditions and acknowledge the
                      Privacy Policy.
                    </span>
                  </label>
                  <div className="auth-policy-links">
                    <button
                      type="button"
                      className="auth-text-button"
                      onClick={() => {
                        setActivePolicy("terms")
                        setTermsOpen(true)
                      }}
                    >
                      {termsRead
                        ? "Review Terms & Conditions"
                        : "Read Terms & Conditions"}
                    </button>
                    <button
                      type="button"
                      className="auth-text-button"
                      onClick={() => {
                        setActivePolicy("privacy")
                        setTermsOpen(true)
                      }}
                    >
                      {privacyRead
                        ? "Review Privacy Policy"
                        : "Read Privacy Policy"}
                    </button>
                  </div>
                  {(!termsRead || !privacyRead) && (
                    <span className="auth-terms-hint">
                      Read both documents to the end before accepting.
                    </span>
                  )}
                </div>
                <button className="auth-submit" disabled={busy}>
                  {busy ? "Creating account..." : "Create account"}
                </button>
              </form>
              <p className="auth-terms">
                Read and accept the Terms &amp; Conditions and Privacy Policy
                before creating an account.
              </p>
              <button
                type="button"
                className="auth-otp-link"
                onClick={() => {
                  setError("")

                  setNotice("")

                  setStage("signupOtp")
                }}
              >
                Sign up with a one-time code instead
              </button>
            </>
          )}

          {stage === "signupOtp" && (
            <>
              <button
                type="button"
                className="auth-back"
                onClick={() => setStage("signup")}
              >
                ← Back to password signup
              </button>
              <p className="auth-accent-line" />
              <h1>Sign up with a code</h1>
              <p className="auth-subtitle">
                We’ll send a one-time verification code to your email or phone.
              </p>
              <form className="auth-form" onSubmit={handleOtpSignup}>
                <label className="auth-field">
                  <span>Full name</span>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    maxLength={120}
                    required
                  />
                </label>
                <label className="auth-field">
                  <span>Email address or phone number</span>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    autoComplete="username"
                    placeholder="Email Address or Phone Number"
                    required
                  />
                </label>
                <div className="auth-terms-consent">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      disabled={!termsRead || !privacyRead}
                      onChange={(event) =>
                        setTermsAccepted(event.target.checked)
                      }
                      required
                    />
                    <span>
                      I agree to the Terms &amp; Conditions and acknowledge the
                      Privacy Policy.
                    </span>
                  </label>
                  <div className="auth-policy-links">
                    <button
                      type="button"
                      className="auth-text-button"
                      onClick={() => {
                        setActivePolicy("terms")
                        setTermsOpen(true)
                      }}
                    >
                      {termsRead
                        ? "Review Terms & Conditions"
                        : "Read Terms & Conditions"}
                    </button>
                    <button
                      type="button"
                      className="auth-text-button"
                      onClick={() => {
                        setActivePolicy("privacy")
                        setTermsOpen(true)
                      }}
                    >
                      {privacyRead
                        ? "Review Privacy Policy"
                        : "Read Privacy Policy"}
                    </button>
                  </div>
                  {(!termsRead || !privacyRead) && (
                    <span className="auth-terms-hint">
                      Read both documents to the end before accepting.
                    </span>
                  )}
                </div>
                <button className="auth-submit" disabled={busy}>
                  {busy ? "Sending code..." : "Send verification code"}
                </button>
              </form>
            </>
          )}

          {stage === "otp" && (
            <>
              <button type="button" className="auth-back" onClick={backToLogin}>
                ← Back to login
              </button>
              <p className="auth-accent-line" />
              <h1>Verify your account</h1>
              <p className="auth-subtitle">
                {notice || `Enter the code sent to ${activeIdentifier}.`}
              </p>
              <form className="auth-form" onSubmit={handleOtp}>
                <label className="auth-field">
                  <span>6-digit verification code</span>
                  <input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    maxLength={6}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    required
                  />
                </label>
                <button className="auth-submit" disabled={busy}>
                  {busy ? "Verifying..." : "Verify and continue"}
                </button>
              </form>
              <button
                type="button"
                className="auth-text-button auth-centered"
                onClick={() => void resendOtp()}
                disabled={busy}
              >
                Resend code
              </button>
            </>
          )}

          {stage === "signupSent" && (
            <>
              <p className="auth-accent-line" />
              <h1>Check your inbox</h1>
              <p className="auth-subtitle">{notice}</p>
              <button
                type="button"
                className="auth-submit"
                onClick={backToLogin}
              >
                Back to login
              </button>
            </>
          )}

          {stage === "forgot" && (
            <>
              <button type="button" className="auth-back" onClick={backToLogin}>
                ← Back to login
              </button>
              <p className="auth-accent-line" />
              <h1>Reset your password</h1>
              <p className="auth-subtitle">
                We’ll send a secure reset link to your account email.
              </p>
              <form className="auth-form" onSubmit={sendPasswordReset}>
                <label className="auth-field">
                  <span>Email address</span>
                  <input
                    type="email"
                    value={identifier}
                    onChange={(event) => setIdentifier(event.target.value)}
                    autoComplete="email"
                    required
                  />
                </label>
                <button className="auth-submit" disabled={busy}>
                  {busy ? "Sending..." : "Send reset link"}
                </button>
              </form>
            </>
          )}

          {stage === "recovery" && (
            <>
              <p className="auth-accent-line" />
              <h1>Choose a new password</h1>
              <p className="auth-subtitle">
                Use at least 8 characters for your new password.
              </p>
              <form className="auth-form" onSubmit={updatePassword}>
                {renderPasswordFields(true)}
                <button className="auth-submit" disabled={busy}>
                  {busy ? "Updating..." : "Update password"}
                </button>
              </form>
            </>
          )}

          {stage === "recoveryDone" && (
            <>
              <p className="auth-accent-line" />
              <h1>Password updated</h1>
              <p className="auth-subtitle">
                Your password has been changed securely.
              </p>
              <button
                type="button"
                className="auth-submit"
                onClick={auth.completePasswordRecovery}
              >
                Continue to OddJobs
              </button>
            </>
          )}

          {error && (
            <div className="auth-error-toast" role="alert">
              <p>{error}</p>
              <button
                type="button"
                aria-label="Dismiss error message"
                onClick={() => setError("")}
              >
                ×
              </button>
            </div>
          )}
          {notice && stage !== "otp" && stage !== "signupSent" && (
            <p className="auth-feedback" role="status">
              {notice}
            </p>
          )}
          <p className="auth-terms auth-privacy">
            Secure &amp; Reliable · Your data is safe with us
          </p>
        </div>
      </section>
      <TermsDialog
        open={termsOpen}
        policy={activePolicy}
        onClose={() => setTermsOpen(false)}
        onReadToEnd={() => {
          if (activePolicy === "terms") setTermsRead(true)
          else setPrivacyRead(true)
        }}
      />
    </main>
  )
}
