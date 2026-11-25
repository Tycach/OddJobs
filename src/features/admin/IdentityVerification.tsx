import { useEffect, useState, type ReactNode } from "react"
import {
  useAuth,
  type AdminCustomerVerificationSummary,
  type AdminVerificationStatus,
  type AdminVerificationSummary,
} from "../../auth/AuthProvider"
import { Badge, Button, EmptyState, Icon, PageHeader } from "../../shared/components/WorkspaceUi"

const pageSize = 25

function DocumentReview({
  applicant,
  documentType,
  url,
  loading,
  refresh,
}: {
  applicant: string
  documentType: string | null
  url: string
  loading: boolean
  refresh: () => void
}) {
  return <section className="identity-document-card">
    <div className="identity-card-heading">
      <div><span className="eyebrow">Submitted document</span><h2>{documentType?.replace(/_/g, " ") || "Identity document"}</h2></div>
      <Button variant="secondary" disabled={loading} onClick={refresh}>{loading ? "Loading…" : "Refresh"}</Button>
    </div>
    <div className="identity-document-preview">
      {url ? <iframe key={url} src={url} title={`${applicant} identity document`} /> : loading ? <p role="status">Loading private document…</p> : <p>Document preview is unavailable. Refresh the secure link to try again.</p>}
    </div>
    {url && <a className="identity-document-open" href={url} target="_blank" rel="noreferrer">Open in a new tab</a>}
    <p className="caption">Private preview link expires after 60 seconds.</p>
  </section>
}

function ApplicantReview({
  title,
  applicant,
  status,
  submittedAt,
  documentType,
  documentUrl,
  documentLoading,
  error,
  refreshDocument,
  back,
  children,
}: {
  title: string
  applicant: string
  status: string
  submittedAt: string
  documentType: string | null
  documentUrl: string
  documentLoading: boolean
  error: string
  refreshDocument: () => void
  back: () => void
  children: ReactNode
}) {
  return <div className="content console-content identity-review-page">
    <PageHeader title={title} description="Compare the submitted document with the applicant details before recording a decision." action={<Button variant="secondary" onClick={back}>Back to queue</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="identity-review-layout">
      <DocumentReview applicant={applicant} documentType={documentType} url={documentUrl} loading={documentLoading} refresh={refreshDocument} />
      <aside className="identity-review-details">
        <div className="identity-applicant-heading"><div><span className="eyebrow">Applicant</span><h2>{applicant}</h2></div><Badge tone={status === "verified" ? "green" : status === "rejected" ? "red" : "amber"}>{status.replace(/_/g, " ")}</Badge></div>
        <dl className="identity-facts"><div><dt>Submitted</dt><dd>{new Date(submittedAt).toLocaleString()}</dd></div><div><dt>Document type</dt><dd>{documentType?.replace(/_/g, " ") || "Not provided"}</dd></div></dl>
        {children}
      </aside>
    </div>
  </div>
}

export function IdentityVerification() {
  const [queue, setQueue] = useState<"provider" | "customer">("provider")
  if (queue === "customer") return <CustomerIdentityQueue onBack={() => setQueue("provider")} />
  return <ProviderIdentityQueue onCustomerQueue={() => setQueue("customer")} />
}

function ProviderIdentityQueue({ onCustomerQueue }: { onCustomerQueue: () => void }) {
  const { getAdminVerifications, getAdminVerificationDocument, decideAdminVerification } = useAuth()
  const [status, setStatus] = useState<AdminVerificationStatus>("in_review")
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<{ items: AdminVerificationSummary[]; total: number }>({ items: [], total: 0 })
  const [selected, setSelected] = useState<AdminVerificationSummary | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [documentLoading, setDocumentLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [documentUrl, setDocumentUrl] = useState("")

  const load = () => {
    setLoading(true)
    setError("")
    void getAdminVerifications(status, pageSize, offset).then(setPage)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load provider applications."))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminVerifications, status, offset])

  const openDocument = async (item: AdminVerificationSummary) => {
    setDocumentLoading(true)
    setDocumentUrl("")
    try { setDocumentUrl((await getAdminVerificationDocument(item.id)).url) }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open the identity document.") }
    finally { setDocumentLoading(false) }
  }
  const openReview = (item: AdminVerificationSummary) => {
    setSelected(item)
    setReason("")
    setError("")
    setReviewOpen(true)
    void openDocument(item)
  }
  const decide = async (decision: "verified" | "rejected") => {
    if (!selected) return
    if (decision === "rejected" && !reason.trim()) { setError("Enter a reason before rejecting verification."); return }
    setSaving(true)
    setError("")
    try {
      const updated = await decideAdminVerification(selected.id, decision, reason.trim())
      setPage((current) => ({ ...current, items: current.items.map((item) => item.id === updated.id ? updated : item) }))
      setSelected(updated)
      setReason("")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save verification decision.") }
    finally { setSaving(false) }
  }

  if (reviewOpen && selected) return <ApplicantReview title="Review provider application" applicant={selected.displayName} status={selected.status} submittedAt={selected.submittedAt} documentType={selected.documentType} documentUrl={documentUrl} documentLoading={documentLoading} error={error} refreshDocument={() => void openDocument(selected)} back={() => setReviewOpen(false)}>
    <dl className="identity-facts"><div><dt>Provider name</dt><dd>{selected.publicName}</dd></div><div><dt>Service region</dt><dd>{selected.region || "Not provided"}</dd></div></dl>
    {selected.skillsEvidence && <section className="identity-evidence"><h3>Skills and experience</h3><p>{selected.skillsEvidence}</p></section>}
    {selected.status === "in_review" ? <div className="identity-decision"><label>Decision note <span>Required to reject</span><textarea value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} rows={3} /></label><div className="identity-decision-actions"><Button disabled={saving || !selected.documentType} onClick={() => void decide("verified")}>{saving ? "Saving…" : "Approve provider"}</Button><Button variant="danger" disabled={saving || !reason.trim()} onClick={() => void decide("rejected")}>Reject</Button></div></div> : <p className="identity-readonly-note">This application has already been reviewed.</p>}
  </ApplicantReview>

  return <div className="content console-content identity-queue-page">
    <PageHeader title="Verification queue" description="Review provider applications and submitted identity documents." action={<Button variant="secondary" onClick={load}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="identity-queue-toolbar"><div className="identity-queue-tabs"><button type="button" className="active" aria-current="page">Provider applications</button><button type="button" onClick={onCustomerQueue}>Customer identity checks</button></div><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value as AdminVerificationStatus); setOffset(0) }}><option value="in_review">In review</option><option value="not_started">Not started</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="all">All</option></select></label></div>
    <section className="identity-queue-card">
      {loading ? <p className="identity-queue-loading" role="status">Loading provider applications…</p> : page.items.length ? <div className="table-wrap"><table className="identity-queue-table"><thead><tr><th>Applicant</th><th>Provider</th><th>Region</th><th>Status</th><th>Submitted</th><th /></tr></thead><tbody>{page.items.map((item) => <tr key={item.id}><td><strong>{item.displayName}</strong></td><td>{item.publicName}</td><td>{item.region || "—"}</td><td><span className={`identity-status identity-status-${item.status}`}>{item.status.replace(/_/g, " ")}</span></td><td>{new Date(item.submittedAt).toLocaleDateString()}</td><td><button className="identity-review-button" type="button" onClick={() => openReview(item)}>Review <Icon name="chevron" size={15} /></button></td></tr>)}</tbody></table></div> : !error ? <EmptyState title="No provider applications" detail="No profiles match this status." /> : null}
      <div className="identity-pagination"><Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</Button><span>{page.total ? `${offset + 1}–${Math.min(offset + page.items.length, page.total)} of ${page.total}` : "0 applications"}</span><Button variant="secondary" disabled={loading || offset + pageSize >= page.total} onClick={() => setOffset((value) => value + pageSize)}>Next</Button></div>
    </section>
    <p className="identity-queue-caption">Documents are private. Each preview link is audited and expires after 60 seconds.</p>
  </div>
}

function CustomerIdentityQueue({ onBack }: { onBack: () => void }) {
  const { getAdminCustomerVerifications, getAdminCustomerVerificationDocument, decideAdminCustomerVerification } = useAuth()
  const [page, setPage] = useState<{ items: AdminCustomerVerificationSummary[]; total: number }>({ items: [], total: 0 })
  const [selected, setSelected] = useState<AdminCustomerVerificationSummary | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [status, setStatus] = useState<AdminVerificationStatus>("in_review")
  const [offset, setOffset] = useState(0)
  const [reason, setReason] = useState("")
  const [documentUrl, setDocumentUrl] = useState("")
  const [documentLoading, setDocumentLoading] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = () => {
    setLoading(true)
    setError("")
    void getAdminCustomerVerifications(status, pageSize, offset).then(setPage)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load customer identity checks."))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminCustomerVerifications, status, offset])
  const openDocument = async (item: AdminCustomerVerificationSummary) => {
    setDocumentLoading(true)
    setDocumentUrl("")
    try { setDocumentUrl((await getAdminCustomerVerificationDocument(item.id)).url) }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open the private ID document.") }
    finally { setDocumentLoading(false) }
  }
  const openReview = (item: AdminCustomerVerificationSummary) => {
    setSelected(item)
    setReason("")
    setError("")
    setReviewOpen(true)
    void openDocument(item)
  }
  const decide = async (decision: "verified" | "rejected") => {
    if (!selected) return
    if (decision === "rejected" && !reason.trim()) { setError("Enter a reason before rejecting this identity check."); return }
    setBusy(true)
    setError("")
    try {
      const updated = await decideAdminCustomerVerification(selected.id, decision, reason.trim())
      setPage((current) => ({ ...current, items: current.items.map((item) => item.id === updated.id ? updated : item) }))
      setSelected(updated)
      setReason("")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the decision.") }
    finally { setBusy(false) }
  }
  if (reviewOpen && selected) return <ApplicantReview title="Review customer identity" applicant={selected.displayName} status={selected.status} submittedAt={selected.submittedAt} documentType={selected.documentType} documentUrl={documentUrl} documentLoading={documentLoading} error={error} refreshDocument={() => void openDocument(selected)} back={() => setReviewOpen(false)}>
    {selected.status === "in_review" ? <div className="identity-decision"><label>Decision note <span>Required to reject</span><textarea value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} rows={3} /></label><div className="identity-decision-actions"><Button disabled={busy} onClick={() => void decide("verified")}>{busy ? "Saving…" : "Approve identity"}</Button><Button variant="danger" disabled={busy || !reason.trim()} onClick={() => void decide("rejected")}>Reject</Button></div></div> : <p className="identity-readonly-note">This identity check has already been reviewed.</p>}
  </ApplicantReview>

  return <div className="content console-content identity-queue-page">
    <PageHeader title="Customer identity checks" description="Review hirer identity documents separately from provider applications." action={<Button variant="secondary" onClick={onBack}>Provider queue</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="identity-queue-toolbar"><div className="identity-queue-tabs"><button type="button" onClick={onBack}>Provider applications</button><button type="button" className="active" aria-current="page">Customer identity checks</button></div><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value as AdminVerificationStatus); setOffset(0) }}><option value="in_review">In review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="all">All</option></select></label><Button variant="secondary" onClick={load}>Refresh</Button></div>
    <section className="identity-queue-card">{loading ? <p className="identity-queue-loading" role="status">Loading customer checks…</p> : page.items.length ? <div className="table-wrap"><table className="identity-queue-table"><thead><tr><th>Applicant</th><th>Document</th><th>Status</th><th>Submitted</th><th /></tr></thead><tbody>{page.items.map((item) => <tr key={item.id}><td><strong>{item.displayName}</strong></td><td>{item.documentType.replace(/_/g, " ")}</td><td><span className={`identity-status identity-status-${item.status}`}>{item.status.replace(/_/g, " ")}</span></td><td>{new Date(item.submittedAt).toLocaleDateString()}</td><td><button className="identity-review-button" type="button" onClick={() => openReview(item)}>Review <Icon name="chevron" size={15} /></button></td></tr>)}</tbody></table></div> : !error ? <EmptyState title="No customer checks" detail="No customer identity records match this status." /> : null}
      <div className="identity-pagination"><Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</Button><span>{page.total ? `${offset + 1}–${Math.min(offset + page.items.length, page.total)} of ${page.total}` : "0 checks"}</span><Button variant="secondary" disabled={loading || offset + pageSize >= page.total} onClick={() => setOffset((value) => value + pageSize)}>Next</Button></div>
    </section>
    <p className="identity-queue-caption">Documents are private. Each preview link is audited and expires after 60 seconds.</p>
  </div>
}
