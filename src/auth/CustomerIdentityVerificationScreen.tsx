import { useEffect, useState } from "react"
import { useAuth, type CustomerVerificationSummary } from "./AuthProvider"
import type { Screen } from "../demo/model"
import { Button, PageHeader } from "../shared/components/WorkspaceUi"

export default function CustomerIdentityVerificationScreen({ go }: { go: (screen: Screen) => void }) {
  const auth = useAuth()
  const [status, setStatus] = useState<CustomerVerificationSummary | null>(null)
  const [documentType, setDocumentType] = useState<"national_id" | "passport">("national_id")
  const [document, setDocument] = useState<File | null>(null)
  const [disclosure, setDisclosure] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const refresh = () => auth.getCustomerVerification().then(setStatus).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load identity status."))
  useEffect(() => { void refresh() }, [auth.getCustomerVerification])

  const submit = async () => {
    if (!document) { setError("Choose a photo or PDF of your ID."); return }
    setBusy(true)
    setError("")
    try {
      setStatus(await auth.submitCustomerVerification({ documentType, document, identityDisclosureAccepted: disclosure }))
      setDocument(null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your identity check.")
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = !status || status.status === "not_started" || status.status === "rejected"
  return <div className="content narrow">
    <PageHeader eyebrow="Hirer account" title="Hirer identity verification" description="Verify your hirer account. This does not create a worker profile or change your account role." />
    <div className="notice notice-warning">Your ID is stored privately and reviewed by authorized OddJobs staff. Only submit an ID when you are ready to complete this check.</div>
    <section className="card form-card">
      {status && <div className="verification-status"><strong>Status</strong><span>{status.status.replace(/_/g, " ")}</span>{status.submittedAt && <small>Submitted {new Date(status.submittedAt).toLocaleDateString()}</small>}{status.reviewReason && <p>{status.reviewReason}</p>}</div>}
      {canSubmit && <>
        <label>Identity document type<select value={documentType} onChange={(event) => setDocumentType(event.target.value as "national_id" | "passport")}><option value="national_id">National ID</option><option value="passport">Passport</option></select></label>
        <label>Photo or PDF of your ID<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} /></label>
        {document && <p className="caption">Selected: {document.name}</p>}
        <label className="preference-line"><input type="checkbox" checked={disclosure} onChange={(event) => setDisclosure(event.target.checked)} /> I consent to OddJobs securely processing this ID for hirer identity verification.</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button disabled={busy || !disclosure} onClick={() => void submit()}>{busy ? "Submitting securely…" : "Submit for review"}</Button>
      </>}
      {status?.status === "in_review" && <p role="status">Your identity check is waiting for an administrator review.</p>}
      {status?.status === "verified" && <p role="status">Your hirer identity has been verified.</p>}
      <Button variant="secondary" onClick={() => go("settings")}>Back to settings</Button>
    </section>
  </div>
}
