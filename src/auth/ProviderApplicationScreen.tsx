import { useState, type FormEvent } from "react"
import { useAuth } from "./AuthProvider"

export default function ProviderApplicationScreen({
  onComplete,
}: {
  onComplete: () => void
}) {
  const { submitProviderApplication } = useAuth()
  const [publicName, setPublicName] = useState("")
  const [bio, setBio] = useState("")
  const [region, setRegion] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState("")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setBusy(true)
    try {
      const application = await submitProviderApplication({
        publicName: publicName.trim(),
        bio: bio.trim(),
        region: region.trim(),
      })
      setApplicationStatus(application.status)
      setSubmitted(true)
    } catch (caught) {
      console.error("Unable to submit the supplier application.", caught)
      setError("We couldn’t submit your application. Please try again shortly.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="content narrow provider-application">
      {submitted ? (
        <section className="surface provider-application-success" role="status">
          <span className="badge badge-amber">Application received</span>
          <h1>
            {applicationStatus === "verified"
              ? "Your supplier profile is verified"
              : applicationStatus === "rejected"
                ? "Your previous application was not approved"
                : "Your supplier profile is under review"}
          </h1>
          <p>
            You can keep using OddJobs as a customer. Provider access is only
            added after the team reviews your application.
          </p>
          <button className="btn btn-primary" onClick={onComplete}>
            Continue to OddJobs
          </button>
        </section>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">Supplier registration</span>
              <h1>Tell us about your services</h1>
              <p>Your profile is reviewed before supplier access is enabled.</p>
            </div>
          </div>
          <form className="surface provider-application-form" onSubmit={submit}>
            <label>
              Public business or service name
              <input
                value={publicName}
                onChange={(event) => setPublicName(event.target.value)}
                maxLength={120}
                required
              />
            </label>
            <label>
              Service description
              <textarea
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                maxLength={2000}
                rows={5}
                required
              />
            </label>
            <label>
              Service region
              <input
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                maxLength={120}
                placeholder="e.g. Nairobi"
                required
              />
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="auth-terms">
              Submitting this form does not grant provider access. OddJobs must
              review and provision your role.
            </p>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Submitting..." : "Submit supplier application"}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
