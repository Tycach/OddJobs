import { useEffect, useState } from "react"
import {
  useAuth,
  type AdminAdCampaign,
  type AdminAuditEvent,
  type AdminCategory,
  type AdminCustomerVerificationSummary,
  type AdminMonitoringSnapshot,
  type AdminModerationReport,
  type AdminModerationStatus,
  type AdminOverview as AdminOverviewData,
  type AdminSystemSettings,
  type AdminUserSummary,
  type AdminVerificationStatus,
  type AdminVerificationSummary,
} from "../../auth/AuthProvider"
import { Badge, Button, DemoNotice, EmptyState, Icon, Metric, PageHeader } from "../../shared/components/WorkspaceUi"
import { AdminMessages } from "../marketplace/ServiceMessages"

type DataTableProps = {
  headers: string[]
  rows: string[][]
}

function DataTable({ headers, rows }: DataTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>
                  {j === 2 ? (
                    <Badge
                      tone={
                        cell.includes("Reject")
                          ? "red"
                          : cell.includes("Pending") || cell.includes("SLA")
                            ? "amber"
                            : "green"
                      }
                    >
                      {cell}
                    </Badge>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Overview() {
  const { getAdminOverview } = useAuth()
  const [overview, setOverview] = useState<AdminOverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const loadOverview = () => {
    setLoading(true)
    setError("")
    void getAdminOverview()
      .then(setOverview)
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load admin overview.",
        ),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => loadOverview(), [getAdminOverview])

  return (
    <div className="content console-content">
      <PageHeader
        eyebrow="Live marketplace"
        title="Marketplace overview"
        description="Current marketplace counts from the OddJobs API."
        action={
          <Button variant="secondary" onClick={loadOverview}>
            Refresh
          </Button>
        }
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? (
        <p role="status">Loading marketplace counts…</p>
      ) : overview ? (
        <>
          <div className="metrics six">
            <Metric label="Total users" value={overview.totalUsers.toLocaleString()} />
            <Metric label="Active providers" value={overview.activeProviders.toLocaleString()} />
            <Metric label="Pending verifications" value={overview.pendingVerifications.toLocaleString()} />
            <Metric label="Open jobs" value={overview.openJobs.toLocaleString()} />
            <Metric label="Completed jobs" value={overview.completedJobs.toLocaleString()} />
            <Metric label="Disputed jobs" value={overview.disputedJobs.toLocaleString()} />
          </div>
          <DemoNotice>
            Counts reflect tables supported by the current API. Revenue,
            transaction rates, ratings, and historical trends are not available.
          </DemoNotice>
        </>
      ) : null}
    </div>
  )
}

function Users() {
  const { getAdminUsers, reinstateAdminUser } = useAuth()
  const [query, setQuery] = useState("")
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<{ items: AdminUserSummary[]; total: number }>({
    items: [],
    total: 0,
  })
  const [loading, setLoading] = useState(true)
  const [savingUserId, setSavingUserId] = useState("")
  const [error, setError] = useState("")
  const pageSize = 25
  const loadUsers = () => {
    setLoading(true)
    setError("")
    void getAdminUsers(pageSize, offset)
      .then(setPage)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load users."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => loadUsers(), [getAdminUsers, offset])
  const filtered = page.items.filter((user) =>
    `${user.displayName} ${user.id} ${user.roles.join(" ")} ${user.status}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  )

  const reinstate = async (userId: string) => {
    setSavingUserId(userId)
    setError("")
    try {
      await reinstateAdminUser(userId)
      setPage((current) => ({
        ...current,
        items: current.items.map((user) =>
          user.id === userId ? { ...user, status: "active" } : user,
        ),
      }))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not reinstate account.")
    } finally {
      setSavingUserId("")
    }
  }

  return (
    <div className="content console-content">
      <PageHeader
        title="Users & roles"
        description="Paginated user directory; contact details are not exposed."
        action={<Button variant="secondary" onClick={loadUsers}>Refresh</Button>}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="admin-toolbar">
        <div className="search-box active">
          <Icon name="search" />
          <input
            aria-label="Search users"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search this page by name, ID, role, or status"
          />
        </div>
      </div>
      <section className="card table-card">
        {loading ? <p role="status">Loading users…</p> : filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>ID</th><th>Roles</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.id}</td>
                  <td>{user.roles.join(", ") || "—"}</td>
                  <td>{user.status}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td>{user.status === "suspended" && !user.roles.includes("admin") ? (
                    <Button variant="secondary" disabled={savingUserId === user.id} onClick={() => void reinstate(user.id)}>
                      {savingUserId === user.id ? "Restoring…" : "Reinstate"}
                    </Button>
                  ) : "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !error ? (
          <EmptyState
            title={page.total ? "No users match this search" : "No users yet"}
            detail="Search applies to the current page; use pagination to browse more users."
          />
        ) : null}
        <div className="card-actions">
          <Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>
            Previous
          </Button>
          <span>{page.total ? `${offset + 1}–${Math.min(offset + page.items.length, page.total)} of ${page.total}` : "0 users"}</span>
          <Button variant="secondary" disabled={loading || offset + pageSize >= page.total} onClick={() => setOffset((value) => value + pageSize)}>
            Next
          </Button>
        </div>
      </section>
      <DemoNotice>
        Suspended accounts can only be reinstated when there is an active,
        admin-issued suspension record. Search is limited to the currently
        loaded page.
      </DemoNotice>
    </div>
  )
}

function Verification() {
  const { getAdminVerifications, getAdminVerificationDocument, decideAdminVerification } = useAuth()
  const [status, setStatus] = useState<AdminVerificationStatus>("in_review")
  const [offset, setOffset] = useState(0)
  const [page, setPage] = useState<{
    items: AdminVerificationSummary[]
    total: number
  }>({ items: [], total: 0 })
  const [selected, setSelected] = useState<AdminVerificationSummary | null>(null)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [documentLink, setDocumentLink] = useState("")
  const [documentLoading, setDocumentLoading] = useState(false)
  const [queue, setQueue] = useState<"provider" | "customer">("provider")
  const pageSize = 25
  const load = () => {
    setLoading(true)
    setError("")
    void getAdminVerifications(status, pageSize, offset)
      .then((result) => {
        setPage(result)
        setSelected((current) =>
          result.items.find((item) => item.id === current?.id) ??
          result.items[0] ??
          null,
        )
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load verification queue."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminVerifications, status, offset])

  if (queue === "customer") return <CustomerIdentityQueue onBack={() => setQueue("provider")} />

  const decide = async (decision: "verified" | "rejected") => {
    if (!selected) return
    if (decision === "rejected" && !reason.trim()) {
      setError("Enter a reason before rejecting verification.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const updated = await decideAdminVerification(selected.id, decision, reason.trim())
      setPage((current) => ({
        ...current,
        items: current.items.map((item) => item.id === updated.id ? updated : item),
      }))
      setSelected(updated)
      setReason("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save verification decision.")
    } finally {
      setSaving(false)
    }
  }
  const openIdentityDocument = async () => {
    if (!selected) return
    setDocumentLoading(true)
    setDocumentLink("")
    setError("")
    try {
      const result = await getAdminVerificationDocument(selected.id)
      setDocumentLink(result.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the identity document.")
    } finally {
      setDocumentLoading(false)
    }
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="Verification queue"
        description="Review privately submitted identity documents and provider applications."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="filters">
        <Button variant="secondary" onClick={() => setQueue("customer")}>Customer identity checks</Button>
        <label>
          Status
          <select value={status} onChange={(event) => {
            setStatus(event.target.value as AdminVerificationStatus)
            setOffset(0)
          }}>
            <option value="in_review">In review</option>
            <option value="not_started">Not started</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>
      <section className="card table-card">
        {loading ? <p role="status">Loading verification records…</p> : page.items.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Applicant</th><th>Provider name</th><th>Region</th><th>Status</th><th>Submitted</th><th>Review</th></tr></thead>
              <tbody>{page.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.displayName}</td>
                  <td>{item.publicName}</td>
                  <td>{item.region || "—"}</td>
                  <td>{item.status.replace(/_/g, " ")}</td>
                  <td>{new Date(item.submittedAt).toLocaleString()}</td>
                  <td><Button variant="secondary" onClick={() => {
                    setSelected(item)
                    setReason("")
                  }}>Review</Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !error ? <EmptyState title="No verification records" detail="No profiles match this status." /> : null}
        {selected?.status === "in_review" && (
          <div className="card-actions">
            <div>
              <strong>Identity document: </strong>{selected.documentType?.replace("_", " ") || "Not provided"}
              <div>
                <Button variant="secondary" disabled={documentLoading} onClick={() => void openIdentityDocument()}>
                  {documentLoading ? "Preparing secure link…" : "View private ID document"}
                </Button>
                {documentLink && <a href={documentLink} target="_blank" rel="noreferrer">Open document (link expires in 60 seconds)</a>}
              </div>
              {selected.skillsEvidence && <p><strong>Skills evidence:</strong> {selected.skillsEvidence}</p>}
            </div>
            <label>
              Decision note (required to reject)
              <input value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} />
            </label>
            <Button disabled={saving || !selected.documentType} onClick={() => void decide("verified")}>{saving ? "Saving…" : "Approve provider access"}</Button>
            <Button variant="danger" disabled={saving || !reason.trim()} onClick={() => void decide("rejected")}>Reject</Button>
          </div>
        )}
        <div className="card-actions">
          <Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</Button>
          <span>{page.total ? `${offset + 1}–${Math.min(offset + page.items.length, page.total)} of ${page.total}` : "0 records"}</span>
          <Button variant="secondary" disabled={loading || offset + pageSize >= page.total} onClick={() => setOffset((value) => value + pageSize)}>Next</Button>
        </div>
      </section>
      <DemoNotice>Opening an ID creates an audited, one-minute private link. Approve only after comparing the document with the applicant details.</DemoNotice>
    </div>
  )
}

function CustomerIdentityQueue({ onBack }: { onBack: () => void }) {
  const { getAdminCustomerVerifications, getAdminCustomerVerificationDocument, decideAdminCustomerVerification } = useAuth()
  const [page, setPage] = useState<{ items: AdminCustomerVerificationSummary[]; total: number }>({ items: [], total: 0 })
  const [selected, setSelected] = useState<AdminCustomerVerificationSummary | null>(null)
  const [status, setStatus] = useState<AdminVerificationStatus>("in_review")
  const [reason, setReason] = useState("")
  const [documentLink, setDocumentLink] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const load = () => {
    setLoading(true)
    setError("")
    void getAdminCustomerVerifications(status, 25, 0).then((result) => {
      setPage(result)
      setSelected((current) => result.items.find((item) => item.id === current?.id) ?? result.items[0] ?? null)
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load customer identity checks.")).finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminCustomerVerifications, status])
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
  const openDocument = async () => {
    if (!selected) return
    setDocumentLink("")
    try { setDocumentLink((await getAdminCustomerVerificationDocument(selected.id)).url) }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open the private ID document.") }
  }
  return <div className="content console-content">
    <PageHeader title="Customer identity checks" description="Review customer identity documents separately from provider applications." action={<Button variant="secondary" onClick={onBack}>Provider applications</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="filters"><label>Status<select value={status} onChange={(event) => setStatus(event.target.value as AdminVerificationStatus)}><option value="in_review">In review</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="all">All</option></select></label><Button variant="secondary" onClick={load}>Refresh</Button></div>
    <section className="card table-card">{loading ? <p role="status">Loading customer checks…</p> : page.items.length ? <div className="table-wrap"><table><thead><tr><th>Customer</th><th>ID type</th><th>Status</th><th>Submitted</th><th>Review</th></tr></thead><tbody>{page.items.map((item) => <tr key={item.id}><td>{item.displayName}</td><td>{item.documentType.replace("_", " ")}</td><td>{item.status.replace(/_/g, " ")}</td><td>{new Date(item.submittedAt).toLocaleString()}</td><td><Button variant="secondary" onClick={() => { setSelected(item); setReason(""); setDocumentLink("") }}>Review</Button></td></tr>)}</tbody></table></div> : !error ? <EmptyState title="No customer checks" detail="No customer identity records match this status." /> : null}
      {selected?.status === "in_review" && <div className="card-actions"><div><strong>Private ID document</strong><div><Button variant="secondary" onClick={() => void openDocument()}>Create secure document link</Button>{documentLink && <a href={documentLink} target="_blank" rel="noreferrer">Open document (expires in 60 seconds)</a>}</div></div><label>Decision note (required to reject)<input value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} /></label><Button disabled={busy} onClick={() => void decide("verified")}>Approve customer identity</Button><Button variant="danger" disabled={busy || !reason.trim()} onClick={() => void decide("rejected")}>Reject</Button></div>}
      <p className="caption">Identity documents are private. Open only for review; secure links expire after 60 seconds.</p>
    </section>
  </div>
}

function Moderation() {
  const { getAdminModerationReports, decideAdminModerationReport } = useAuth()
  const [status, setStatus] = useState<AdminModerationStatus>("open")
  const [offset, setOffset] = useState(0)
  const [reports, setReports] = useState<AdminModerationReport[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<AdminModerationReport | null>(null)
  const [reason, setReason] = useState("")
  const [enforcement, setEnforcement] = useState<"none" | "suspend_account">("none")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const pageSize = 25
  const load = () => {
    setLoading(true)
    setError("")
    void getAdminModerationReports(status, pageSize, offset)
      .then((page) => {
        setReports(page.items)
        setTotal(page.total)
        setSelected((current) =>
          page.items.find((item) => item.id === current?.id) ??
          page.items[0] ??
          null,
        )
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load reports."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminModerationReports, status, offset])

  const decide = async (decision: "reviewing" | "resolved" | "dismissed") => {
    if (!selected) return
    if (decision === "dismissed" && !reason.trim()) {
      setError("Enter a reason before dismissing this report.")
      return
    }
    if (decision === "resolved" && enforcement !== "none" && !reason.trim()) {
      setError("Enter a reason before suspending an account.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const result = await decideAdminModerationReport(
        selected.id,
        decision,
        decision === "resolved" ? enforcement : "none",
        reason.trim(),
      )
      setReports((items) => items.map((item) =>
        item.id === result.id ? { ...item, status: result.status } : item,
      ))
      setSelected((item) => item ? { ...item, status: result.status } : item)
      setReason("")
      setEnforcement("none")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save report decision.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="Reports & moderation"
        description="Review user-submitted reports and record moderation outcomes."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <label>
        Report status
        <select value={status} onChange={(event) => {
          setStatus(event.target.value as AdminModerationStatus)
          setOffset(0)
        }}>
          <option value="open">Open</option>
          <option value="reviewing">Reviewing</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
          <option value="all">All</option>
        </select>
      </label>
      <section className="card">
        {loading ? <p role="status">Loading reports…</p> : reports.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Reason</th><th>Subject</th><th>Details</th><th>Status</th><th>Reported</th><th>Review</th></tr></thead>
              <tbody>{reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.reason.replace(/_/g, " ")}</td>
                  <td>{report.subjectType} · {report.subjectId}</td>
                  <td>{report.details}</td>
                  <td>{report.status}</td>
                  <td>{new Date(report.createdAt).toLocaleString()}</td>
                  <td><Button variant="secondary" onClick={() => {
                    setSelected(report)
                    setReason("")
                    setEnforcement("none")
                  }}>Review</Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !error ? <EmptyState title="No reports" detail="No reports match this status." /> : null}
        {selected && ["open", "reviewing"].includes(selected.status) && (
          <div className="card-actions">
            <label>
              Review note (required for dismissal or suspension)
              <input value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} />
            </label>
            {selected.subjectType === "account" && (
              <label>
                Account action
                <select value={enforcement} onChange={(event) =>
                  setEnforcement(event.target.value as "none" | "suspend_account")
                }>
                  <option value="none">No account action</option>
                  <option value="suspend_account">Suspend account</option>
                </select>
              </label>
            )}
            <Button disabled={saving} onClick={() => void decide("reviewing")}>Mark reviewing</Button>
            <Button disabled={saving || (enforcement === "suspend_account" && !reason.trim())} onClick={() => void decide("resolved")}>Resolve report</Button>
            <Button variant="danger" disabled={saving || !reason.trim()} onClick={() => void decide("dismissed")}>Dismiss</Button>
          </div>
        )}
        <div className="card-actions">
          <Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</Button>
          <span>{total ? `${offset + 1}–${Math.min(offset + reports.length, total)} of ${total}` : "0 reports"}</span>
          <Button variant="secondary" disabled={loading || offset + pageSize >= total} onClick={() => setOffset((value) => value + pageSize)}>Next</Button>
        </div>
      </section>
      <DemoNotice>
        Account suspension applies only to a resolved account report, requires a
        reason, is reversible by an admin, and does not ban Supabase identity or
        remove content. Warnings and job resolution are not implemented.
      </DemoNotice>
    </div>
  )
}

function Categories() {
  const { getAdminCategories, saveAdminCategory } = useAuth()
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [draft, setDraft] = useState({
    name: "",
    slug: "",
    active: true,
    sortOrder: 0,
  })
  const [editingSlug, setEditingSlug] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const load = () => {
    setLoading(true)
    setError("")
    void getAdminCategories()
      .then(setCategories)
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load categories."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminCategories])

  const saveCategory = async () => {
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const saved = await saveAdminCategory(draft)
      setCategories((items) =>
        [...items.filter((item) => item.id !== saved.id), saved].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
        ),
      )
      setEditingSlug("")
      setDraft({ name: "", slug: "", active: true, sortOrder: 0 })
      setMessage(`Saved category “${saved.name}”.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save category.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content console-content">
      <PageHeader
        title="Categories & fees"
        description="Manage persisted service categories and marketplace settings."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="settings-grid">
        <section className="card">
          <h2>Service categories</h2>
          {loading ? <p role="status">Loading categories…</p> : categories.length ? categories.map((category) => (
            <div className="setting-line" key={category.id}>
              <span>{category.name} · {category.active ? "active" : "inactive"}</span>
              <Button variant="ghost" onClick={() => {
                setEditingSlug(category.slug)
                setDraft({
                  name: category.name,
                  slug: category.slug,
                  active: !category.active,
                  sortOrder: category.sortOrder,
                })
              }}>Edit / toggle</Button>
            </div>
          )) : !loading && <p>No categories configured.</p>}
          <h3>{editingSlug ? "Edit category" : "Add category"}</h3>
          <label>
            Name
            <input maxLength={80} value={draft.name} onChange={(event) => {
              const name = event.target.value
              setDraft((current) => ({
                ...current,
                name,
                slug: editingSlug ? current.slug : name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
              }))
            }} />
          </label>
          <label>
            Slug
            <input maxLength={90} disabled={Boolean(editingSlug)} value={draft.slug} onChange={(event) =>
              setDraft((current) => ({ ...current, slug: event.target.value }))
            } />
          </label>
          <label>
            Sort order
            <input type="number" min="0" max="10000" value={draft.sortOrder} onChange={(event) =>
              setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))
            } />
          </label>
          {editingSlug && (
            <label>
              Active
              <select value={draft.active ? "yes" : "no"} onChange={(event) =>
                setDraft((current) => ({ ...current, active: event.target.value === "yes" }))
              }>
                <option value="yes">Active</option>
                <option value="no">Inactive</option>
              </select>
            </label>
          )}
          <div className="card-actions">
            <Button disabled={saving || !draft.name.trim() || !draft.slug.trim()} onClick={() => void saveCategory()}>
              {saving ? "Saving…" : "Save category"}
            </Button>
            {editingSlug && <Button variant="secondary" onClick={() => {
              setEditingSlug("")
              setDraft({ name: "", slug: "", active: true, sortOrder: 0 })
            }}>Cancel</Button>}
          </div>
        </section>
      </div>
      <DemoNotice>
        Category and settings records are persisted and audited. Commission
        calculation, promo codes, subscriptions, and job validation against this
        catalog are not implemented.
      </DemoNotice>
    </div>
  )
}

function AdApprovals() {
  const { getAdminAdCampaigns, decideAdminAdCampaign } = useAuth()
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [campaigns, setCampaigns] = useState<AdminAdCampaign[]>([])
  const [selected, setSelected] = useState<AdminAdCampaign | null>(null)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  const load = () => {
    setLoading(true)
    setError("")
    void getAdminAdCampaigns(status)
      .then((items) => {
        setCampaigns(items)
        setSelected((current) => items.find((item) => item.id === current?.id) ?? items[0] ?? null)
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load campaigns."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminAdCampaigns, status])
  const decide = async (decision: "approved" | "rejected") => {
    if (!selected) return
    if (decision === "rejected" && !reason.trim()) {
      setError("Enter a reason before rejecting a campaign.")
      return
    }
    setSaving(true)
    setError("")
    try {
      const updated = await decideAdminAdCampaign(selected.id, decision, reason.trim())
      setCampaigns((items) => items.map((item) => item.id === updated.id ? updated : item))
      setSelected(updated)
      setReason("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save campaign decision.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="Ad approvals & inventory"
        description="Review submitted campaigns and record audited decisions."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      <label>
        Campaign status
        <select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      </label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="card">
        {loading ? <p role="status">Loading campaigns…</p> : campaigns.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Advertiser</th><th>Campaign</th><th>Placement</th><th>Status</th><th>Submitted</th><th>Review</th></tr></thead>
              <tbody>{campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>{campaign.advertiserName}</td>
                  <td>{campaign.title}</td>
                  <td>{campaign.placement.replace(/_/g, " ")}</td>
                  <td>{campaign.status}</td>
                  <td>{new Date(campaign.createdAt).toLocaleString()}</td>
                  <td><Button variant="secondary" onClick={() => {
                    setSelected(campaign)
                    setReason("")
                  }}>Review</Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !error ? <EmptyState title="No campaigns" detail="No campaigns match this status." /> : null}
        {selected?.status === "pending" && (
          <div className="card-actions">
            <div>
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <p>{selected.advertiserName} · {selected.placement.replace(/_/g, " ")}</p>
              {selected.destinationUrl && <p>Destination: {selected.destinationUrl}</p>}
            </div>
            <label>
              Decision note (required to reject)
              <input value={reason} maxLength={1000} onChange={(event) => setReason(event.target.value)} />
            </label>
            <Button disabled={saving} onClick={() => void decide("approved")}>Approve</Button>
            <Button variant="danger" disabled={saving || !reason.trim()} onClick={() => void decide("rejected")}>Reject</Button>
          </div>
        )}
      </section>
      <section className="card">
        <h2>Inventory rules</h2>
        <p>
          Login/landing carousel: 2–3 cards. Consumer dashboard: one slim
          sponsored row. No ads in search, job, chat, payment, or provider
          dashboard.
        </p>
      </section>
      <DemoNotice>
        Campaign submissions and decisions are stored, but approval does not
        publish or serve ads; no advertiser portal or ad-serving integration is
        connected.
      </DemoNotice>
    </div>
  )
}

function AuditLog() {
  const { getAdminAuditEvents } = useAuth()
  const [events, setEvents] = useState<AdminAuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const pageSize = 25
  const load = () => {
    setLoading(true)
    setError("")
    void getAdminAuditEvents(pageSize, offset)
      .then((page) => {
        setEvents(page.items)
        setTotal(page.total)
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load audit events."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminAuditEvents, offset])
  return (
    <div className="content console-content">
      <PageHeader
        title="Audit log"
        description="Persisted admin actions and read events from the API."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <section className="card table-card">
        {loading ? <p role="status">Loading audit events…</p> : events.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Actor ID</th><th>Action</th><th>Target</th><th>Request ID</th></tr></thead>
              <tbody>{events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{event.actorUserId}</td>
                  <td>{event.action}</td>
                  <td>{event.targetType ? `${event.targetType}${event.targetId ? ` · ${event.targetId}` : ""}` : "—"}</td>
                  <td>{event.requestId}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !error ? <EmptyState title="No audit events" detail="Administrative events will appear here." /> : null}
        <div className="card-actions">
          <Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</Button>
          <span>{total ? `${offset + 1}–${Math.min(offset + events.length, total)} of ${total}` : "0 events"}</span>
          <Button variant="secondary" disabled={loading || offset + pageSize >= total} onClick={() => setOffset((value) => value + pageSize)}>Next</Button>
        </div>
      </section>
    </div>
  )
}

function Config() {
  const { getAdminSettings, saveAdminSettings } = useAuth()
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null)
  const [commission, setCommission] = useState("10")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const load = () => {
    setLoading(true)
    setError("")
    void getAdminSettings()
      .then((value) => {
        setSettings(value)
        setCommission(String(value.marketplaceCommissionPercent))
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load settings."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminSettings])
  const save = async () => {
    if (!settings) return
    const percent = Number(commission)
    if (!commission.trim() || !Number.isFinite(percent) || percent < 0 || percent > 30) {
      setError("Commission must be between 0 and 30 percent.")
      return
    }
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const saved = await saveAdminSettings({
        ...settings,
        marketplaceCommissionPercent: percent,
      })
      setSettings(saved)
      setMessage("Settings saved and recorded in the admin audit log.")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save settings.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="System configuration"
        description="Update allowlisted marketplace settings with audit history."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading ? <p role="status">Loading system settings…</p> : settings && (
        <div className="settings-grid">
          <section className="card setting-card">
            <h2>Marketplace</h2>
            <label>
              Marketplace commission (%)
              <input type="number" min="0" max="30" step="0.1" value={commission} onChange={(event) => setCommission(event.target.value)} />
            </label>
            <label className="setting-line">
              New provider applications enabled
              <input type="checkbox" checked={settings.newProviderApplicationsEnabled} onChange={(event) =>
                setSettings({ ...settings, newProviderApplicationsEnabled: event.target.checked })
              } />
            </label>
            <label className="setting-line">
              Accept ad campaign submissions
              <input type="checkbox" checked={settings.adsEnabled} onChange={(event) =>
                setSettings({ ...settings, adsEnabled: event.target.checked })
              } />
            </label>
            <Button disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save settings"}</Button>
          </section>
        </div>
      )}
      <DemoNotice>
        Provider-application and ad-submission switches are API-enforced. The
        commission rate is stored and audited but is not applied to charges:
        fee calculation is not implemented. Integration secrets and notification
        provider settings are intentionally not editable in the browser.
      </DemoNotice>
    </div>
  )
}

function AdminMonitoring() {
  const { getAdminMonitoring, getAdminMonitoringHistory } = useAuth()
  const [snapshot, setSnapshot] = useState<AdminMonitoringSnapshot | null>(null)
  const [history, setHistory] = useState<AdminMonitoringSnapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const load = () => {
    setLoading(true)
    setError("")
    void Promise.all([
      getAdminMonitoring(),
      getAdminMonitoringHistory(50),
    ])
      .then(([current, previous]) => {
        setSnapshot(current)
        setHistory(previous)
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load monitoring data."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminMonitoring, getAdminMonitoringHistory])
  return (
    <div className="content console-content">
      <PageHeader
        title="System monitoring"
        description="API, database, and moderation/verification queue signals."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p role="status">Checking service health…</p> : snapshot && (
        <>
          <div className="metrics">
            <Metric label="Database" value={snapshot.database === "ok" ? "Connected" : "Unavailable"} />
            <Metric label="API uptime" value={`${Math.floor(snapshot.uptimeSeconds / 60)} min`} />
            <Metric label="Pending verifications" value={snapshot.pendingVerifications.toLocaleString()} />
            <Metric label="Open reports" value={snapshot.openReports.toLocaleString()} />
            <Metric label="Heap usage" value={`${Math.round(snapshot.heapUsedBytes / snapshot.heapLimitBytes * 100)}%`} />
          </div>
          <section className="card">
            <div className="section-title">
              <h2>Current alerts</h2>
              <span>Checked {new Date(snapshot.checkedAt).toLocaleString()}</span>
            </div>
            {snapshot.alerts.length ? snapshot.alerts.map((alert) => (
              <p className="form-error" role="status" key={alert.code}>
                {alert.severity.toUpperCase()}: {alert.message}
              </p>
            )) : <p>No alerts from the current checks.</p>}
          </section>
          <section className="card">
            <h2>Recent recorded checks</h2>
            {history.length ? (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Checked</th><th>Database</th><th>Pending verifications</th><th>Open reports</th><th>Alerts</th></tr></thead>
                  <tbody>{history.map((item) => (
                    <tr key={item.checkedAt}>
                      <td>{new Date(item.checkedAt).toLocaleString()}</td>
                      <td>{item.database}</td>
                      <td>{item.pendingVerifications}</td>
                      <td>{item.openReports}</td>
                      <td>{item.alerts.length}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            ) : <p>No monitoring snapshots recorded yet.</p>}
          </section>
          <DemoNotice>
            Snapshots are recorded when an admin requests a health check and
            retain up to 1,000 records. No continuous collector or external
            notification delivery is configured.
          </DemoNotice>
        </>
      )}
    </div>
  )
}

export type AdminConsoleScreenKey =
  | "messages"
  | "monitoring"
  | "overview"
  | "users"
  | "verification"
  | "moderation"
  | "categories"
  | "adApprovals"
  | "audit"
  | "config"

export default function AdminConsoleScreen({ screen }: { screen: AdminConsoleScreenKey }) {
  switch (screen) {
    case "messages": return <AdminMessages />
    case "monitoring": return <AdminMonitoring />
    case "overview": return <Overview />
    case "users": return <Users />
    case "verification": return <Verification />
    case "moderation": return <Moderation />
    case "categories": return <Categories />
    case "adApprovals": return <AdApprovals />
    case "audit": return <AuditLog />
    case "config": return <Config />
    default: return null
  }
}

