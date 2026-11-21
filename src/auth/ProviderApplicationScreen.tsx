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
  const [documentType, setDocumentType] = useState<"national_id" | "passport">("national_id")
  const [document, setDocument] = useState<File | null>(null)
  const [skillsEvidence, setSkillsEvidence] = useState("")
  const [identityDisclosureAccepted, setIdentityDisclosureAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [applicationStatus, setApplicationStatus] = useState("")

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    if (!document) {
      setError("Choose a photo or scan of your national ID or passport.")
      return
    }
    if (!identityDisclosureAccepted) {
      setError("Confirm that OddJobs may process your ID for provider identity review.")
      return
    }
    setBusy(true)
    try {
      const application = await submitProviderApplication({
        publicName: publicName.trim(),
        bio: bio.trim(),
        region: region.trim(),
        documentType,
        document,
        skillsEvidence: skillsEvidence.trim(),
        identityDisclosureAccepted,
      })
      setApplicationStatus(application.status)
      setSubmitted(true)
    } catch (caught) {
      console.error("Unable to submit the provider application.", caught)
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
              ? "Your provider application is approved"
              : applicationStatus === "rejected"
                ? "Your previous application was not approved"
                : "Your application is being reviewed"}
          </h1>
          <p>
            {applicationStatus === "verified"
              ? "Provider access is now enabled for your account."
              : "Your identity document and provider details were submitted securely. You can use the provider workspace and publish up to ten listings while an administrator reviews your identity."}
          </p>
          <button className="btn btn-primary" onClick={onComplete}>
            Continue to OddJobs
          </button>
        </section>
      ) : (
        <>
          <div className="page-heading">
            <div>
              <span className="eyebrow">Provider application</span>
              <h1>Tell us about your services</h1>
              <p>Submit your provider details and government ID for an administrator to review. You can publish up to ten listings while verification is pending; approval unlocks unlimited listings.</p>
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
            <label>
              Identity document type
              <select value={documentType} onChange={(event) => setDocumentType(event.target.value as "national_id" | "passport")}>
                <option value="national_id">National ID</option>
                <option value="passport">Passport</option>
              </select>
            </label>
            <label>
              National ID or passport image / PDF (private, up to 8 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(event) => setDocument(event.target.files?.[0] ?? null)}
                required
              />
            </label>
            <label>
              Skills, licences, or relevant experience
              <textarea value={skillsEvidence} onChange={(event) => setSkillsEvidence(event.target.value)} maxLength={2000} rows={4} />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={identityDisclosureAccepted} onChange={(event) => setIdentityDisclosureAccepted(event.target.checked)} />
              <span>I understand authorized OddJobs administrators will review my ID for provider identity verification. The document is private; its retention period will be published before production.</span>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="auth-terms">
              Your ID is stored in a private bucket. Only your account and
              authorized OddJobs administrators can access it. It is never shown
              on your public provider profile.
            </p>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Uploading securely..." : "Submit for identity review"}
            </button>
          </form>
        </>
      )}
    </div>
  )
}
