import { useEffect, useRef, useState } from "react"
import {
  useAuth,
  type AdminAdCampaign,
  type AdminAuditEvent,
  type AdminCategory,
  type AdminMonitoringSnapshot,
  type AdminModerationReport,
  type AdminModerationStatus,
  type AdminJobPaymentPage,
  type JobPaymentStatus,
  type PlatformFeeStatus,
  type JobPaymentRecord,
  type AdminOverview as AdminOverviewData,
  type AdminAnalyticsFilters,
  type AdminAnalyticsReport,
  type AdminSystemSettings,
  type AdminUserSummary,
  type AdminMemberRole,
  type AdminTeamSummary,
  type AdminAlertSummary,
  type AdminInvitationLink,
  type AdminVerificationSummary,
  type AdminCustomerVerificationSummary,
  type SupportCase,
} from "../../auth/AuthProvider"
import { Badge, Button, DemoNotice, EmptyState, Icon, Metric, PageHeader } from "../../shared/components/WorkspaceUi"
import { AdminMessages } from "../marketplace/ServiceMessages"
import { IdentityVerification } from "./IdentityVerification"
import AuthExperience from "../../auth/AuthExperience"

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
                  {j === 2? (
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

const commissionLabels: Record<PlatformFeeStatus, string> = {
  due: "Due",
  reported: "Under review",
  received: "Verified paid",
  disputed: "Disputed",
  needs_correction: "Needs correction",
}

function commissionEventLabel(action: string) {
  const labels: Record<string, string> = {
    "platform_fee.due": "Commission deadline set",
    "platform_fee.reported": "Hirer reported payment",
    "platform_fee.received": "Receipt verified",
    "platform_fee.correction_requested": "Correction requested",
    "platform_fee.reminder.manual": "Admin reminder sent",
    "platform_fee.reminder.due-soon": "Automatic due-soon reminder sent",
    "platform_fee.reminder.due": "Automatic due reminder sent",
    "platform_fee.reminder.overdue-24h": "Automatic overdue reminder sent",
    "platform_fee.reminder.overdue-72h": "Urgent automatic reminder sent",
  }
  return labels[action] ?? action.replaceAll("_", " ").replaceAll(".", " · ")
}

type PaymentActionKind = "resolve" | "verify-fee" | "correct-fee" | "remind" | "payout-hold" | "commission-restriction"
type PaymentActionRequest = { kind: PaymentActionKind; targetId: string; title: string; description: string; subject: string; defaultValue?: string; secondaryDefault?: string; mode?: "release" }

function PaymentActionDialog({
  request,
  busy,
  error,
  onClose,
  onSubmit,
}: {
  request: PaymentActionRequest | null
  busy: boolean
  error: string
  onClose: () => void
  onSubmit: (values: { value: string; secondaryValue: string }) => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [value, setValue] = useState("")
  const [secondaryValue, setSecondaryValue] = useState("")
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (request && !dialog.open) dialog.showModal()
    if (!request && dialog.open) dialog.close()
    if (request) {
      setValue(request.defaultValue ?? "")
      setSecondaryValue(request.secondaryDefault ?? "")
    }
  }, [request])
  const hasSecondary = request?.kind === "resolve"
  const isOptional = request?.kind === "remind" || request?.mode === "release"
  const minLength = request?.kind === "resolve" || request?.kind === "correct-fee" || request?.kind === "commission-restriction" || (request?.kind === "payout-hold" && request.defaultValue !== "release") ? 10 : 3
  return <dialog className="admin-payment-action-dialog" ref={dialogRef} aria-labelledby="payment-action-title" onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) onClose() }}>
    {request && <form onSubmit={(event) => { event.preventDefault(); onSubmit({ value, secondaryValue }) }}>
      <header className="admin-payment-action-header"><div><span className="eyebrow">Admin action</span><h2 id="payment-action-title">{request.title}</h2><p>{request.description}</p></div><button className="jobs-dialog-close" type="button" aria-label="Close dialog" disabled={busy} onClick={onClose}>×</button></header>
      {hasSecondary && <label className="admin-payment-action-field">Decision<select value={secondaryValue} onChange={(event) => setSecondaryValue(event.target.value)}><option value="paid">Mark as paid</option><option value="refunded">Mark as refunded</option></select></label>}
      <label className="admin-payment-action-field">{request.subject}{request.kind === "verify-fee" ? <input autoFocus required minLength={3} maxLength={120} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Enter the reference on the receipt" /> : request.kind === "remind" ? <textarea rows={3} maxLength={500} value={value} onChange={(event) => setValue(event.target.value)} placeholder="Add an optional note for the hirer" /> : <textarea rows={3} minLength={minLength} maxLength={1000} required={!isOptional} value={value} onChange={(event) => setValue(event.target.value)} placeholder={request.kind === "payout-hold" ? "Explain why this payout is being held" : "Add a clear note for the audit record"} />}</label>
      {request.kind === "verify-fee" && <small className="caption">The hirer’s submitted reference is filled in. Check it against the receipt before confirming.</small>}
      {request.kind === "remind" && <small className="caption">The hirer will receive a payment reminder. You can leave the note blank.</small>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <footer className="admin-payment-action-buttons"><Button variant="secondary" type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || (!isOptional && value.trim().length < minLength)}>{busy ? "Saving…" : "Confirm action"}</Button></footer>
    </form>}
  </dialog>
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
        description="A live snapshot of people, providers, and jobs across OddJobs."
        action={
          <Button variant="secondary" onClick={loadOverview}>
            Refresh
          </Button>
        }
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading? (
        <p role="status">Loading marketplace counts…</p>
      ) : overview? (
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
            Use these totals to spot activity that may need follow-up. Open
            Verification or Marketplace operations to review individual cases.
          </DemoNotice>
        </>
      ) : null}
    </div>
  )
}

type ActionQueueItem = {
  id: string
  kind: "ID check" | "Report" | "Support ticket" | "Commission"
  title: string
  detail: string
  updatedAt: string
  href: string
  priority: number
}

function ActionCenter() {
  const auth = useAuth()
  const [items, setItems] = useState<ActionQueueItem[]>([])
  const [counts, setCounts] = useState({ identity: 0, reports: 0, support: 0, commissions: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [limited, setLimited] = useState(false)

  const load = () => {
    setLoading(true)
    setError("")
    void Promise.allSettled([
      auth.getAdminVerifications("in_review", 100, 0),
      auth.getAdminCustomerVerifications("in_review", 100, 0),
      auth.getAdminModerationReports("open", 100, 0),
      auth.getAdminSupportCases("", "all", 100, 0),
      auth.getAdminJobPayments("", "all", "all", 100, 0),
    ]).then((results) => {
      const unavailable = results.filter((result) => result.status === "rejected").length
      setLimited(unavailable > 0)
      if (unavailable === results.length) {
        setError("Your role cannot view these action queues, or the queues are temporarily unavailable.")
        setItems([])
        setCounts({ identity: 0, reports: 0, support: 0, commissions: 0 })
        return
      }
      const valueAt = <T,>(index: number): T | null => {
        const result = results[index]
        return result?.status === "fulfilled"? result.value as T : null
      }
      const providers = valueAt<{ items: AdminVerificationSummary[] }>(0)?.items ?? []
      const hirers = valueAt<{ items: AdminCustomerVerificationSummary[] }>(1)?.items ?? []
      const reports = valueAt<{ items: AdminModerationReport[] }>(2)?.items ?? []
      const cases = valueAt<{ items: SupportCase[] }>(3)?.items ?? []
      const payments = valueAt<AdminJobPaymentPage>(4)?.items ?? []
      const queue: ActionQueueItem[] = [
        ...providers.map((item) => ({ id: `worker-${item.id}`, kind: "ID check" as const, title: item.displayName, detail: `Worker identity review · ${item.documentType ?? "Document submitted"}`, updatedAt: item.submittedAt, href: "/admin/verification", priority: 0 })),
        ...hirers.map((item) => ({ id: `hirer-${item.id}`, kind: "ID check" as const, title: item.displayName, detail: `Hirer identity review · ${item.documentType.replaceAll("_", " ")}`, updatedAt: item.submittedAt, href: "/admin/verification", priority: 0 })),
        ...reports.filter((item) => ["open", "reviewing"].includes(item.status)).map((item) => ({ id: `report-${item.id}`, kind: "Report" as const, title: item.jobReference? `Job ${item.jobReference}` : `${item.subjectType.replaceAll("_", " ")} report`, detail: `${item.reason.replaceAll("_", " ")} · ${item.details}`, updatedAt: item.createdAt, href: "/admin/moderation", priority: 1 })),
        ...cases.filter((item) => item.status !== "resolved").map((item) => ({ id: `case-${item.id}`, kind: "Support ticket" as const, title: `${item.caseReference} · ${item.subject}`, detail: `${item.requesterRole === "consumer"? "Hirer" : "Worker"} · Job ${item.jobReference} · ${item.requesterName}`, updatedAt: item.updatedAt, href: "/admin/messages", priority: 2 })),
        ...payments.filter((item) => item.platformFeeStatus === "reported" || item.platformFeeStatus === "needs_correction" || (item.platformFeeStatus === "due" && item.commissionOverdue)).map((item) => ({ id: `commission-${item.id}`, kind: "Commission" as const, title: `Job ${item.jobReference}`, detail: `${item.platformFeeStatus === "reported"? "Payment reported; receipt needs review" : item.platformFeeStatus === "needs_correction"? "Hirer needs to correct payment reference" : "Commission overdue"} · ${item.customerName} · KES ${(item.commissionAmountMinor / 100).toLocaleString()}`, updatedAt: item.platformFeeReportedAt ?? item.platformFeeDueAt ?? item.updatedAt, href: "/admin/payments", priority: item.commissionOverdue? 0 : 1 })),
      ]
      queue.sort((a, b) => a.priority - b.priority || new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
      setItems(queue)
      setCounts({
        identity: providers.length + hirers.length,
        reports: reports.filter((item) => ["open", "reviewing"].includes(item.status)).length,
        support: cases.filter((item) => item.status !== "resolved").length,
        commissions: payments.filter((item) => item.platformFeeStatus === "reported" || item.platformFeeStatus === "needs_correction" || (item.platformFeeStatus === "due" && item.commissionOverdue)).length,
      })
    }).catch(() => setError("Could not load the action center."))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [auth.getAdminVerifications, auth.getAdminCustomerVerifications, auth.getAdminModerationReports, auth.getAdminSupportCases, auth.getAdminJobPayments])

  return <div className="content console-content admin-action-center">
    <PageHeader eyebrow="Admin work queue" title="Action center" description="See the reviews, reports, support requests, and payments that need attention." action={<Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {limited && <p className="caption" role="status">Some queues are hidden because they are outside your access role.</p>}
    <div className="metrics four">
      <Metric label="ID checks" value={counts.identity.toLocaleString()} />
      <Metric label="Open reports" value={counts.reports.toLocaleString()} />
      <Metric label="Active support tickets" value={counts.support.toLocaleString()} />
      <Metric label="Commission follow-ups" value={counts.commissions.toLocaleString()} />
    </div>
    <section className="card table-card">
      <div className="section-title"><div><h2>Needs attention</h2><p className="caption">Items link to their full review pages. Oldest items appear first within each priority.</p></div><span>{items.length} items</span></div>
      {loading? <p role="status">Loading action queues...</p> : items.length? <div className="table-wrap"><table><thead><tr><th>#</th><th>Type</th><th>Case</th><th>Details</th><th>Last updated</th><th>Open</th></tr></thead><tbody>{items.slice(0, 50).map((item, index) => <tr key={item.id}><td>{index + 1}</td><td><Badge tone={item.priority === 0? "amber" : "neutral"}>{item.kind}</Badge></td><td><strong>{item.title}</strong></td><td>{item.detail}</td><td>{Number.isNaN(new Date(item.updatedAt).getTime())? "—" : new Date(item.updatedAt).toLocaleString()}</td><td><a className="btn btn-secondary" href={item.href}>Review</a></td></tr>)}</tbody></table></div> : !error? <EmptyState title="All caught up" detail="There are no pending reviews or follow-ups in the queues available to you." /> : null}
      {items.length > 50 && <p className="caption">Showing the 50 most urgent items. Use the linked pages to browse the full queues.</p>}
    </section>
  </div>
}

function Users() {
  const { getAdminUsers, reinstateAdminUser, setAdminCommissionRestriction } = useAuth()
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
        setError(caught instanceof Error? caught.message : "Could not load users."),
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
          user.id === userId? { ...user, status: "active" } : user,
        ),
      }))
    } catch (caught) {
      setError(caught instanceof Error? caught.message : "Could not reinstate account.")
    } finally {
      setSavingUserId("")
    }
  }

  const toggleCommissionRestriction = async (user: AdminUserSummary) => {
    const restricted = !user.commissionRestricted
    const prompt = restricted
     ? "Reason for temporarily restricting new hirings (at least 10 characters):"
      : "Reason for releasing the hiring restriction (at least 10 characters):"
    const reason = window.prompt(prompt)?.trim() ?? ""
    if (reason.length < 10) { setError("Enter a reason of at least 10 characters."); return }
    setSavingUserId(user.id); setError("")
    try {
      await setAdminCommissionRestriction(user.id, restricted, reason)
      loadUsers()
    } catch (caught) {
      setError(caught instanceof Error? caught.message : "Could not update the hiring restriction.")
    } finally { setSavingUserId("") }
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
        {loading? <p role="status">Loading users…</p> : filtered.length? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>ID</th><th>Roles</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.id}</td>
                  <td>{user.roles.join(", ") || "—"}</td>
                  <td><span>{user.status}</span>{user.commissionRestricted && <small className="caption"><Badge tone="amber">New hiring restricted</Badge></small>}{user.overdueCommissionCount > 0 && <small className="caption">{user.overdueCommissionCount} overdue commission{user.overdueCommissionCount === 1? "" : "s"} | KES {(user.overdueCommissionMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td><div className="card-actions">{user.status === "suspended" && !user.roles.includes("admin")? (
                    <Button variant="secondary" disabled={savingUserId === user.id} onClick={() => void reinstate(user.id)}>
                      {savingUserId === user.id? "Restoring…" : "Reinstate"}
                    </Button>
                  ) : null}{!user.roles.includes("admin") && user.roles.includes("consumer") && (user.commissionRestricted || user.overdueCommissionCount > 0) && <Button variant="secondary" disabled={savingUserId === user.id} onClick={() => void toggleCommissionRestriction(user)}>{savingUserId === user.id? "Saving…" : user.commissionRestricted? "Release restriction" : "Restrict new hiring"}</Button>}</div></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !error? (
          <EmptyState
            title={page.total? "No users match this search" : "No users yet"}
            detail="Search applies to the current page; use pagination to browse more users."
          />
        ) : null}
        <div className="card-actions">
          <Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>
            Previous
          </Button>
          <span>{page.total? `${offset + 1}–${Math.min(offset + page.items.length, page.total)} of ${page.total}` : "0 users"}</span>
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

function Moderation() {
  const { getAdminModerationReports, decideAdminModerationReport } = useAuth()
  const [status, setStatus] = useState<AdminModerationStatus>("open")
  const [jobSearch, setJobSearch] = useState("")
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
    void getAdminModerationReports(status, pageSize, offset, jobSearch)
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
        setError(caught instanceof Error? caught.message : "Could not load reports."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminModerationReports, status, offset, jobSearch])

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
        decision === "resolved"? enforcement : "none",
        reason.trim(),
      )
      setReports((items) => items.map((item) =>
        item.id === result.id? { ...item, status: result.status } : item,
      ))
      setSelected((item) => item? { ...item, status: result.status } : item)
      setReason("")
      setEnforcement("none")
    } catch (caught) {
      setError(caught instanceof Error? caught.message : "Could not save report decision.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="content console-content moderation-admin">
      <PageHeader
        title="Reports & moderation"
        description="Review user-submitted reports and record moderation outcomes."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="moderation-filters"><label>
        Search reports by Job ID
        <input value={jobSearch} onChange={(event) => { setJobSearch(event.target.value); setOffset(0) }} placeholder="For example, OJ-0000000042" />
      </label>
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
      </label></div>
      <section className="card moderation-queue">
        {loading? <p role="status">Loading reports…</p> : reports.length? (
          <div className="table-wrap">
            <table>
              <thead><tr><th className="moderation-number-heading">#</th><th>Reason</th><th>Subject</th><th>Details</th><th>Status</th><th>Reported</th><th>Review</th></tr></thead>
              <tbody>{reports.map((report, index) => (
                <tr key={report.id}>
                  <td className="moderation-number">{offset + index + 1}</td>
                  <td>{report.reason.replace(/_/g, " ")}</td>
                  <td>{report.subjectType === "job"? `Job ID ${report.jobReference ?? report.subjectId}` : `${report.subjectType} | ${report.subjectId}`}</td>
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
        ) : !error? <EmptyState title="No reports" detail="No reports match this status." /> : null}
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
          <span>{total? `${offset + 1}–${Math.min(offset + reports.length, total)} of ${total}` : "0 reports"}</span>
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
  const { getAdminCategories, saveAdminCategory, getAdminSettings, saveAdminSettings, getAdminAuditEvents } = useAuth()
  const [categories, setCategories] = useState<AdminCategory[]>([])
  const [draft, setDraft] = useState({
    name: "",
    slug: "",
    active: true,
    sortOrder: 0,
  })
  const [editingSlug, setEditingSlug] = useState("")
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null)
  const [commission, setCommission] = useState("10")
  const [audit, setAudit] = useState<AdminAuditEvent[]>([])
  const [savingCommission, setSavingCommission] = useState(false)

  const openNewCategory = () => {
    setEditingSlug("")
    setDraft({ name: "", slug: "", active: true, sortOrder: categories.reduce((highest, item) => Math.max(highest, item.sortOrder), 0) + 10 })
    setError("")
    setCategoryModalOpen(true)
  }
  const openCategoryEditor = (category: AdminCategory) => {
    setEditingSlug(category.slug)
    setDraft({ name: category.name, slug: category.slug, active: category.active, sortOrder: category.sortOrder })
    setError("")
    setCategoryModalOpen(true)
  }
  const closeCategoryEditor = () => {
    setCategoryModalOpen(false)
    setEditingSlug("")
    setDraft({ name: "", slug: "", active: true, sortOrder: 0 })
  }

  useEffect(() => {
    if (!categoryModalOpen) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape" && !saving) closeCategoryEditor() }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [categoryModalOpen, saving])

  const load = () => {
    setLoading(true)
    setError("")
    void Promise.all([getAdminCategories(), getAdminSettings(), getAdminAuditEvents(50, 0)])
      .then(([items, currentSettings, events]) => {
        setCategories(items)
        setSettings(currentSettings)
        setCommission(String(currentSettings.marketplaceCommissionPercent))
        setAudit(events.items.filter((event) => event.action.startsWith("admin.category") || event.action === "admin.system_settings.update").slice(0, 6))
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error? caught.message : "Could not load categories."),
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
      setCategories((items) => [...items.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
      load()
      closeCategoryEditor()
      setMessage(`Saved category: ${saved.name}.`)
    } catch (caught) {
      setError(caught instanceof Error? caught.message : "Could not save category.")
    } finally {
      setSaving(false)
    }
  }

  const toggleCategory = async (category: AdminCategory) => {
    const active = !category.active
    if (active && category.openJobs > 0 && !window.confirm(`${category.openJobs} open job(s) already use this category. Existing jobs will stay the same. Make it available for new jobs?`)) return
    if (!active && category.openJobs > 0 && !window.confirm(`${category.openJobs} open job(s) use this category. Existing jobs will stay the same, but hirers will not be able to choose it for new jobs. Continue?`)) return
    setSaving(true); setError(""); setMessage("")
    try {
      await saveAdminCategory({ name: category.name, slug: category.slug, active, sortOrder: category.sortOrder })
      setMessage(`${category.name} is now ${active? "active" : "inactive"}.`)
      load()
    } catch (caught) { setError(caught instanceof Error? caught.message : "Could not update category status.") }
    finally { setSaving(false) }
  }

  const saveCommission = async () => {
    if (!settings) return
    const percent = Number(commission)
    if (!Number.isFinite(percent) || percent < 0 || percent > 30) { setError("Commission must be between 0 and 30 percent."); return }
    setSavingCommission(true); setError(""); setMessage("")
    try {
      const saved = await saveAdminSettings({ ...settings, marketplaceCommissionPercent: percent })
      setSettings(saved); setCommission(String(saved.marketplaceCommissionPercent)); setMessage("Commission rate saved. New agreements will use this rate; existing agreements keep their original rate.")
      void getAdminAuditEvents(50, 0).then((events) => setAudit(events.items.filter((event) => event.action.startsWith("admin.category") || event.action === "admin.system_settings.update").slice(0, 6)))
    } catch (caught) { setError(caught instanceof Error? caught.message : "Could not save the commission rate.") }
    finally { setSavingCommission(false) }
  }

  return (
    <div className="content console-content">
      <PageHeader
        title="Categories & fees"
        description="Manage the services hirers can choose and set the OddJobs fee."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      {error && !categoryModalOpen && <p className="form-error" role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      <div className="settings-grid">
        <section className="card table-card">
          <div className="section-title"><div><h2>Service categories</h2><p className="caption">Hirers see active categories when posting a job. Turning one off won’t change existing jobs.</p></div><div className="card-actions"><Badge>{categories.filter((item) => item.active).length} active</Badge><Button onClick={openNewCategory}>Add category</Button></div></div>
          {loading? <p role="status">Loading service categories…</p> : categories.length? <div className="table-wrap"><table><thead><tr><th>#</th><th>Category</th><th>Jobs</th><th>Open jobs</th><th>Status</th><th>Actions</th></tr></thead><tbody>{categories.map((category, index) => <tr key={category.id}><td>{index + 1}</td><td><strong>{category.name}</strong></td><td>{category.totalJobs}</td><td>{category.openJobs}</td><td><Badge tone={category.active? "green" : "amber"}>{category.active? "Active" : "Inactive"}</Badge></td><td><div className="card-actions"><Button variant="ghost" disabled={saving} onClick={() => openCategoryEditor(category)}>Edit</Button><Button variant="secondary" disabled={saving} onClick={() => void toggleCategory(category)}>{category.active? "Hide from new jobs" : "Show for new jobs"}</Button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No service categories yet" detail="Add the services hirers can choose when posting a job." />}
        </section>
        <section className="card setting-card">
          <h2>Marketplace commission</h2>
          <p className="caption">This rate is saved on new payment agreements when a hirer accepts a quote. Existing agreements keep their original rate.</p>
          <label>Commission rate (%)<input type="number" min="0" max="30" step="0.1" value={commission} onChange={(event) => setCommission(event.target.value)} /></label>
          <div className="metrics"><Metric label="Example job amount" value="KES 10,000" /><Metric label="OddJobs fee" value={`KES ${(10000 * Number(commission || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} /><Metric label="Worker share" value={`KES ${(10000 * (1 - Number(commission || 0) / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} /></div>
          <Button disabled={savingCommission || !settings} onClick={() => void saveCommission()}>{savingCommission? "Saving…" : "Save commission rate"}</Button>
          <p className="caption">Fee reporting and admin receipt verification are handled under Payments and worker earnings. Payment transfers are still recorded manually.</p>
        </section>
      </div>
      {categoryModalOpen && <div className="category-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) closeCategoryEditor() }}>
        <section className="category-modal" role="dialog" aria-modal="true" aria-labelledby="category-modal-title">
          <header className="category-modal-heading"><div><span className="eyebrow">Service categories</span><h2 id="category-modal-title">{editingSlug ? `Edit ${draft.name}` : "Add a category"}</h2><p>{editingSlug ? "Update how this service appears to hirers." : "Add a service hirers can choose when posting a job."}</p></div><button type="button" className="category-modal-close" disabled={saving} onClick={closeCategoryEditor}>Close</button></header>
          {error && <p className="form-error" role="alert">{error}</p>}
          <label>Category name<input autoFocus maxLength={80} disabled={Boolean(editingSlug && categories.find((item) => item.slug === editingSlug)?.totalJobs)} value={draft.name} onChange={(event) => {
            const name = event.target.value
            setDraft((current) => ({ ...current, name, slug: editingSlug ? current.slug : name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") }))
          }} /></label>
          {editingSlug && categories.find((item) => item.slug === editingSlug)?.totalJobs ? <small className="caption">This name is locked because existing jobs use it. You can still change whether hirers can choose it and where it appears.</small> : <small className="caption">A category link is created automatically from the name.</small>}
          <label>Display order<input type="number" min="0" max="10000" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} /><small className="caption">Lower numbers appear earlier in the list.</small></label>
          <label>Available for new jobs<select value={draft.active ? "yes" : "no"} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.value === "yes" }))}><option value="yes">Yes, hirers can choose it</option><option value="no">No, hide it from new jobs</option></select></label>
          <div className="card-actions"><Button disabled={saving || !draft.name.trim() || !draft.slug.trim()} onClick={() => void saveCategory()}>{saving ? "Saving..." : editingSlug ? "Save changes" : "Add category"}</Button><Button variant="secondary" disabled={saving} onClick={closeCategoryEditor}>Cancel</Button></div>
        </section>
      </div>}
      <section className="card table-card"><div className="section-title"><div><h2>Recent updates</h2><p className="caption">Changes made to categories and the OddJobs fee.</p></div></div>{audit.length? <div className="table-wrap"><table><thead><tr><th>#</th><th>Change</th><th>Changed by</th><th>Date</th></tr></thead><tbody>{audit.map((event, index) => { const categoryName = categories.find((item) => item.id === event.targetId)?.name ?? "Service category"; const change = event.action === "admin.system_settings.update" ? `OddJobs fee updated${event.metadata.marketplaceCommissionPercent !== undefined ? ` to ${event.metadata.marketplaceCommissionPercent}%` : ""}` : `${categoryName} ${event.metadata.active === true ? "made available for new jobs" : event.metadata.active === false ? "hidden from new jobs" : "updated"}`; return <tr key={event.id}><td>{index + 1}</td><td>{change}</td><td>{event.actorDisplayName || "Administrator"}</td><td>{new Date(event.createdAt).toLocaleString()}</td></tr> })}</tbody></table></div> : <p className="caption">No updates have been made yet.</p>}</section>
    </div>
  )
}

function AdApprovals() {
  const { getAdminAdCampaigns, decideAdminAdCampaign, markAdminAdCampaignPaid, createAdminAdCampaign } = useAuth()
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("pending")
  const [campaigns, setCampaigns] = useState<AdminAdCampaign[]>([])
  const [selected, setSelected] = useState<AdminAdCampaign | null>(null)
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [paymentReference, setPaymentReference] = useState("")
  const [newCampaign, setNewCampaign] = useState({ advertiserName: "", title: "", description: "", placement: "customer_landing" as "customer_landing" | "customer_dashboard", destinationUrl: "", imageUrl: "", startAt: "", endAt: "", price: "" })
  const [creating, setCreating] = useState(false)

  const load = () => {
    setLoading(true)
    setError("")
    void getAdminAdCampaigns(status)
      .then((items) => {
        setCampaigns(items)
        setSelected((current) => items.find((item) => item.id === current?.id) ?? items[0] ?? null)
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error? caught.message : "Could not load campaigns."),
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
      setCampaigns((items) => items.map((item) => item.id === updated.id? updated : item))
      setSelected(updated)
      setReason("")
    } catch (caught) {
      setError(caught instanceof Error? caught.message : "Could not save campaign decision.")
    } finally {
      setSaving(false)
    }
  }
  const markPaid = async () => {
    if (!selected || !paymentReference.trim()) { setError("Enter the payment reference before confirming payment."); return }
    setSaving(true); setError("")
    try { const updated = await markAdminAdCampaignPaid(selected.id, paymentReference.trim()); setCampaigns((items) => items.map((item) => item.id === updated.id ? updated : item)); setSelected(updated); setPaymentReference("") }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Payment could not be recorded.") }
    finally { setSaving(false) }
  }
  const createCampaign = async () => {
    setCreating(true); setError("")
    try {
      await createAdminAdCampaign({ advertiserName: newCampaign.advertiserName.trim(), title: newCampaign.title.trim(), description: newCampaign.description.trim(), placement: newCampaign.placement, ...(newCampaign.destinationUrl.trim() ? { destinationUrl: newCampaign.destinationUrl.trim() } : {}), ...(newCampaign.imageUrl.trim() ? { imageUrl: newCampaign.imageUrl.trim() } : {}), ...(newCampaign.startAt ? { startAt: new Date(newCampaign.startAt).toISOString() } : {}), ...(newCampaign.endAt ? { endAt: new Date(newCampaign.endAt).toISOString() } : {}), ...(newCampaign.price ? { priceMinor: Math.round(Number(newCampaign.price) * 100) } : {}) })
      setNewCampaign({ advertiserName: "", title: "", description: "", placement: "customer_landing", destinationUrl: "", imageUrl: "", startAt: "", endAt: "", price: "" })
      setStatus("pending"); load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create campaign.") }
    finally { setCreating(false) }
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="Ad approvals & inventory"
        description="Review submitted campaigns and record audited decisions."
        action={<Button variant="secondary" onClick={load}>Refresh</Button>}
      />
      <details className="admin-ad-create"><summary>Create a campaign</summary><div className="admin-ad-create-grid"><label>Advertiser<input value={newCampaign.advertiserName} onChange={(event) => setNewCampaign({ ...newCampaign, advertiserName: event.target.value })} /></label><label>Headline<input maxLength={120} value={newCampaign.title} onChange={(event) => setNewCampaign({ ...newCampaign, title: event.target.value })} /></label><label className="wide">Description<textarea rows={2} maxLength={500} value={newCampaign.description} onChange={(event) => setNewCampaign({ ...newCampaign, description: event.target.value })} /></label><label>Placement<select value={newCampaign.placement} onChange={(event) => setNewCampaign({ ...newCampaign, placement: event.target.value as typeof newCampaign.placement })}><option value="customer_landing">OddJobs home page</option><option value="customer_dashboard">Hirer workspace</option></select></label><label>Campaign fee (KES)<input type="number" min="1" value={newCampaign.price} onChange={(event) => setNewCampaign({ ...newCampaign, price: event.target.value })} /></label><label>Start<input type="datetime-local" value={newCampaign.startAt} onChange={(event) => setNewCampaign({ ...newCampaign, startAt: event.target.value })} /></label><label>End<input type="datetime-local" value={newCampaign.endAt} onChange={(event) => setNewCampaign({ ...newCampaign, endAt: event.target.value })} /></label><label>Destination link<input type="url" value={newCampaign.destinationUrl} onChange={(event) => setNewCampaign({ ...newCampaign, destinationUrl: event.target.value })} /></label><label>Image link<input type="url" value={newCampaign.imageUrl} onChange={(event) => setNewCampaign({ ...newCampaign, imageUrl: event.target.value })} /></label></div><Button disabled={creating || !newCampaign.advertiserName.trim() || !newCampaign.title.trim() || !newCampaign.description.trim()} onClick={() => void createCampaign()}>{creating ? "Saving…" : "Send for approval"}</Button></details>
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
        {loading? <p role="status">Loading campaigns…</p> : campaigns.length? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Advertiser</th><th>Campaign</th><th>Placement</th><th>Campaign status</th><th>Fee</th><th>Payment</th><th>Dates</th><th>Activity</th><th>Review</th></tr></thead>
              <tbody>{campaigns.map((campaign, index) => (
                <tr key={campaign.id}>
                  <td>{index + 1}</td>
                  <td>{campaign.advertiserName}</td>
                  <td>{campaign.title}</td>
                  <td>{campaign.placement.replace(/_/g, " ")}</td>
                  <td>{campaign.status}</td>
                  <td>{campaign.priceMinor ? `KES ${(campaign.priceMinor / 100).toLocaleString()}` : "To be agreed"}</td>
                  <td>{campaign.paymentStatus ?? "pending"}</td>
                  <td>{campaign.startAt ? new Date(campaign.startAt).toLocaleDateString() : "Start after payment"}{campaign.endAt ? ` – ${new Date(campaign.endAt).toLocaleDateString()}` : ""}</td>
                  <td>{campaign.impressions ?? 0} views · {campaign.clicks ?? 0} clicks</td>
                  <td><Button variant="secondary" onClick={() => {
                    setSelected(campaign)
                    setReason("")
                  }}>Review</Button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : !error? <EmptyState title="No campaigns" detail="No campaigns match this status." /> : null}
        {selected?.status === "pending" && (
          <div className="card-actions">
            <div>
              <h3>{selected.title}</h3>
              <p>{selected.description}</p>
              <p>{selected.advertiserName} | {selected.placement.replace(/_/g, " ")}</p>
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
        {selected?.status === "approved" && selected.paymentStatus !== "received" && <div className="card-actions"><div><h3>{selected.title}</h3><p>Approved campaign · {selected.priceMinor ? `KES ${(selected.priceMinor / 100).toLocaleString()}` : "Fee to be agreed"}</p></div><label>Payment reference<input value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} placeholder="Receipt or transaction number" /></label><Button disabled={saving || !paymentReference.trim()} onClick={() => void markPaid()}>{saving ? "Saving…" : "Confirm payment received"}</Button></div>}
        {selected?.paymentStatus === "received" && <p className="safe-note">Payment recorded{selected.paymentReference ? ` · ${selected.paymentReference}` : ""}. The campaign can appear within its scheduled dates. Views: {selected.impressions ?? 0}; clicks: {selected.clicks ?? 0}.</p>}
      </section>
      <section className="card">
        <h2>Inventory rules</h2>
        <p>
          Login/landing carousel: 2–3 cards. Consumer dashboard: one slim
          sponsored row. No ads in search, job, chat, payment, or provider
          dashboard.
        </p>
      </section>
    </div>
  )
}

function auditActionLabel(action: string) {
  const labels: Record<string, string> = {
    "admin.verification.verified": "Provider ID approved",
    "admin.verification.rejected": "Provider ID rejected",
    "admin.customer_verification.verified": "Hirer ID approved",
    "admin.customer_verification.rejected": "Hirer ID rejected",
    "admin.moderation.resolved": "Report resolved",
    "admin.moderation.dismissed": "Report dismissed",
    "admin.platform_fee.received": "Commission receipt verified",
    "admin.commission.restriction_placed": "Hirer account restricted",
    "admin.commission.restriction_released": "Hirer restriction released",
    "admin.provider.payout_hold": "Worker payout held",
    "admin.provider.payout_hold_removed": "Worker payout hold removed",
    "admin.support.case.replied": "Support case reply sent",
    "admin.support.case.status_changed": "Support case status changed",
  }
  if (labels[action]) return labels[action]
  return action.replace(/^admin\./, "").split(".").map((part) =>
    part.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
  ).join(" / ")
}

function AuditLog() {
  const { getAdminAuditEvents } = useAuth()
  const [events, setEvents] = useState<AdminAuditEvent[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [action, setAction] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [filters, setFilters] = useState({ search: "", action: "", from: "", to: "" })
  const pageSize = 25
  const load = () => {
    setLoading(true)
    setError("")
    void getAdminAuditEvents(pageSize, offset, filters)
      .then((page) => {
        setEvents(page.items)
        setTotal(page.total)
      })
      .catch((caught: unknown) => setError(caught instanceof Error? caught.message : "Could not load audit events."))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminAuditEvents, offset, filters])
  const applyFilters = (event: React.FormEvent) => { event.preventDefault(); setOffset(0); setFilters({ search, action, from, to }) }
  return <div className="content console-content">
    <PageHeader title="Audit log" description="Admin decisions and sensitive record access, with a trace back to the request." action={<Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <form className="card audit-filters" onSubmit={applyFilters}>
      <label>Search records<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Administrator, action, record ID" /></label>
      <label>Action contains<input value={action} onChange={(event) => setAction(event.target.value)} placeholder="e.g. verification" /></label>
      <label>From<input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>To<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      <Button type="submit" disabled={loading}>Apply filters</Button>
      <Button type="button" variant="secondary" disabled={loading} onClick={() => { setSearch(""); setAction(""); setFrom(""); setTo(""); setOffset(0); setFilters({ search: "", action: "", from: "", to: "" }) }}>Clear</Button>
    </form>
    <section className="card table-card">
      {loading? <p role="status">Loading audit events...</p> : events.length? <div className="table-wrap">
        <table className="audit-table">
          <thead><tr><th>#</th><th>Time</th><th>Administrator</th><th>Action</th><th>Record</th><th>Details</th><th>Request ID</th></tr></thead>
          <tbody>{events.map((event, index) => <tr key={event.id}>
            <td>{offset + index + 1}</td>
            <td>{new Date(event.createdAt).toLocaleString()}</td>
            <td><strong>{event.actorDisplayName || "Admin"}</strong><small className="caption" title={event.actorUserId}>{event.actorUserId.slice(0, 8)}</small></td>
            <td>{auditActionLabel(event.action)}</td>
            <td>{event.targetType?.replaceAll("_", " ") || "System"}<small className="caption" title={event.targetId ?? ""}>{event.targetId? event.targetId.slice(0, 12) : ""}</small></td>
            <td>{Object.entries(event.metadata).filter(([key]) => !["messageId", "limit", "offset", "search", "count"].includes(key)).map(([key, value]) => <small className="audit-detail" key={key}><strong>{key.replaceAll("_", " ")}:</strong> {String(value)}</small>)}</td>
            <td><code title={event.requestId}>{event.requestId.slice(0, 12)}</code></td>
          </tr>)}</tbody>
        </table>
      </div> : !error? <EmptyState title="No audit events" detail="Administrative events will appear here." /> : null}
      <div className="card-actions">
        <Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</Button>
        <span>{total? (offset + 1) + "-" + Math.min(offset + events.length, total) + " of " + total : "0 events"}</span>
        <Button variant="secondary" disabled={loading || offset + pageSize >= total} onClick={() => setOffset((value) => value + pageSize)}>Next</Button>
      </div>
    </section>
  </div>
}

const adminRoleLabels: Record<AdminMemberRole, string> = {
  OWNER: "Owner", ADMIN: "Administrator", OPERATIONS_ADMIN: "Operations", VERIFICATION_REVIEWER: "Verification reviewer",
  MODERATION_REVIEWER: "Moderation reviewer", SUPPORT_AGENT: "Support agent", FINANCE_REVIEWER: "Finance reviewer", ANALYST: "Analyst",
}
const manageableAdminRoles: AdminMemberRole[] = ["ADMIN", "OPERATIONS_ADMIN", "VERIFICATION_REVIEWER", "MODERATION_REVIEWER", "SUPPORT_AGENT", "FINANCE_REVIEWER", "ANALYST"]

function AdminTeam() {
  const auth = useAuth()
  const [team, setTeam] = useState<AdminTeamSummary | null>(null)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<AdminMemberRole>("ADMIN")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [createdInvite, setCreatedInvite] = useState<AdminInvitationLink | null>(null)
  const [copied, setCopied] = useState(false)
  const load = () => { setLoading(true); setError(""); void auth.getAdminTeam().then(setTeam).catch((caught: unknown) => setError(caught instanceof Error? caught.message : "Could not load the admin team.")).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [auth.getAdminTeam])
  const invite = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy("invite"); setError("")
    try { const invitation = await auth.inviteAdminUser(email.trim(), role); setCreatedInvite(invitation); setCopied(false); setEmail(""); load() }
    catch (caught) { setError(caught instanceof Error? caught.message : "Could not send the invitation.") }
    finally { setBusy("") }
  }
  const changeRole = async (userId: string, nextRole: AdminMemberRole) => {
    setBusy(userId); setError("")
    try {
      await auth.setAdminMemberRole(userId, nextRole)
      load()
    } catch (caught) { setError(caught instanceof Error? caught.message : "Could not update the role.") }
    finally { setBusy("") }
  }
  const remove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove admin access for ${name}? This action is recorded in the audit log.`)) return
    setBusy(userId); setError("")
    try { await auth.removeAdminMember(userId); load() }
    catch (caught) { setError(caught instanceof Error? caught.message : "Could not remove administrator access.") }
    finally { setBusy("") }
  }
  const revoke = async (id: string) => { setBusy(id); setError(""); try { await auth.revokeAdminInvitation(id); load() } catch (caught) { setError(caught instanceof Error? caught.message : "Could not revoke the invitation.") } finally { setBusy("") } }
  return <div className="content console-content">
    <PageHeader title="Admin team & access" description="Invite administrators, assign scoped roles, and review pending invitations." action={<Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <form className="card admin-invite-form" onSubmit={invite}>
      <div><h2>Create a one-time access link</h2><p className="caption">Share the link directly with the invited person. It expires after 72 hours and can be redeemed once. Administrator grants the full admin workspace; narrower roles show only their assigned pages.</p></div>
      <label>Email address<input type="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></label>
      <label>Access role<select value={role} onChange={(event) => setRole(event.target.value as AdminMemberRole)}>{manageableAdminRoles.map((item) => <option value={item} key={item}>{adminRoleLabels[item]}</option>)}</select></label>
      <Button type="submit" disabled={busy === "invite" || !email.trim()}>{busy === "invite"? "Creating link…" : "Create access link"}</Button>
    </form>
    {createdInvite && <section className="card admin-generated-link" aria-live="polite"><div><Badge tone="green">Link created</Badge><h2>Share with {createdInvite.email}</h2><p className="caption">{adminRoleLabels[createdInvite.role]} · expires {new Date(createdInvite.expiresAt).toLocaleString()}. This link is shown only once; copy it now.</p></div><input readOnly aria-label="One-time admin access link" value={createdInvite.inviteUrl} onFocus={(event) => event.currentTarget.select()} /><div className="card-actions"><Button onClick={() => { void navigator.clipboard.writeText(createdInvite.inviteUrl).then(() => setCopied(true)).catch(() => setError("Clipboard access failed. Select and copy the link manually.")) }}>{copied? "Copied" : "Copy link"}</Button><Button variant="secondary" onClick={() => setCreatedInvite(null)}>Done</Button></div></section>}
    <section className="card table-card admin-team-card">
      <div className="section-title"><div><h2>Administrators</h2><p className="caption">Roles limit which admin pages and actions each person can access.</p></div><span>{team?.members.length ?? 0} members</span></div>
      {loading? <p role="status">Loading admin team…</p> : team?.members.length? <div className="table-wrap"><table className="admin-team-table"><thead><tr><th>#</th><th>Administrator</th><th>Role</th><th>Joined</th><th>Access</th></tr></thead><tbody>{team.members.map((member, index) => <tr key={member.userId}><td>{index + 1}</td><td><strong>{member.displayName}</strong>{member.legacyOwner && <small className="caption">Legacy owner · protected</small>}</td><td>{member.legacyOwner? <Badge tone="amber">Owner</Badge> : <select aria-label={`Role for ${member.displayName}`} value={member.role} disabled={busy === member.userId} onChange={(event) => void changeRole(member.userId, event.target.value as AdminMemberRole)}>{Object.entries(adminRoleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}</td><td>{new Date(member.joinedAt).toLocaleDateString()}</td><td>{member.legacyOwner? <span className="caption">Existing admin</span> : <Button variant="secondary" disabled={busy === member.userId} onClick={() => void remove(member.userId, member.displayName)}>Remove</Button>}</td></tr>)}</tbody></table></div> : <EmptyState title="No administrators" detail="Invite someone to help manage OddJobs." />}
    </section>
    <section className="card table-card admin-team-card">
      <div className="section-title"><div><h2>Invitations</h2><p className="caption">Pending and recently completed invitations.</p></div><span>{team?.invitations.filter((item) => item.status === "PENDING").length ?? 0} pending</span></div>
      {team?.invitations.length? <div className="table-wrap"><table className="admin-team-table"><thead><tr><th>#</th><th>Email</th><th>Role</th><th>Status</th><th>Created / redeemed</th><th>Expires</th><th>Action</th></tr></thead><tbody>{team.invitations.map((invitation, index) => <tr key={invitation.id}><td>{index + 1}</td><td>{invitation.email}</td><td>{adminRoleLabels[invitation.role]}</td><td><Badge tone={invitation.status === "PENDING"? "amber" : invitation.status === "ACCEPTED"? "green" : "neutral"}>{invitation.status.toLowerCase()}</Badge></td><td>{new Date(invitation.createdAt).toLocaleString()}{invitation.acceptedAt && <small className="caption">Redeemed {new Date(invitation.acceptedAt).toLocaleString()}</small>}</td><td>{new Date(invitation.expiresAt).toLocaleString()}</td><td>{invitation.status === "PENDING" && <Button variant="secondary" disabled={busy === invitation.id} onClick={() => void revoke(invitation.id)}>Revoke</Button>}</td></tr>)}</tbody></table></div> : <EmptyState title="No invitations yet" detail="New access links will appear here." />}
    </section>
  </div>
}

function AdminInviteAccept() {
  const auth = useAuth()
  const [invitation] = useState(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const search = new URLSearchParams(window.location.search)
    const fromUrl = {
      invitationId: hash.get("invitationId") ?? search.get("invitationId") ?? "",
      token: hash.get("token") ?? search.get("token") ?? "",
      email: hash.get("email") ?? search.get("email") ?? "",
    }
    if (fromUrl.invitationId && fromUrl.token) return fromUrl
    try {
      const saved = localStorage.getItem("oddjobs.pendingAdminInvitation")
      if (saved) {
        const parsed = JSON.parse(saved) as { invitationId?: string; token?: string; email?: string }
        if (parsed.invitationId && parsed.token) return {
          invitationId: parsed.invitationId,
          token: parsed.token,
          email: parsed.email ?? "",
        }
      }
    } catch {
      localStorage.removeItem("oddjobs.pendingAdminInvitation")
    }
    return fromUrl
  })
  const [error, setError] = useState("")
  const [validationError, setValidationError] = useState("")
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname)
    if (!invitation.invitationId || !invitation.token) { setError("The invitation link is incomplete. Ask the workspace owner to send a new invitation."); return }
    localStorage.setItem("oddjobs.pendingAdminInvitation", JSON.stringify(invitation))
    window.dispatchEvent(new Event("oddjobs:admin-invite-pending"))
  }, [invitation])
  useEffect(() => {
    const onInvitationResult = (event: Event) => {
      const detail = (event as CustomEvent<{ error?: string }>).detail
      setValidationError(detail?.error ?? "")
    }
    window.addEventListener("oddjobs:admin-invite-result", onInvitationResult)
    return () => window.removeEventListener("oddjobs:admin-invite-result", onInvitationResult)
  }, [])
  const isAuthenticated = Boolean(auth.profile)
  const confirmationRedirect = new URL(window.location.pathname, window.location.origin)
  confirmationRedirect.hash = new URLSearchParams(invitation).toString()
  if (auth.loading) return <div className="auth-shell"><p className="center-note" role="status">Checking your invitation…</p></div>
  if (error) return <div className="auth-shell"><section className="admin-invite-error"><h1>Invitation link unavailable</h1><p role="alert">{error}</p><a className="btn btn-secondary" href="/">Return to OddJobs</a></section></div>
  if (isAuthenticated) return <div className="auth-shell"><section className="admin-invite-error"><h1>{validationError? "Invitation could not be redeemed" : "Checking your admin access"}</h1><p role={validationError? "alert" : "status"}>{validationError || "We’re validating the invitation against your signed-in email."}</p><button className="btn btn-secondary" onClick={() => { setValidationError(""); void auth.signOut() }}>Switch account</button></section></div>
  return <AuthExperience initialRole="admin" initialStage="signup" initialIdentifier={invitation.email} adminInvitationSignup adminInvitationRedirectUrl={confirmationRedirect.toString()} chooseWorkspace={() => window.location.assign("/consumer/login")} changeWorkspace={() => window.location.assign("/")} goHome={() => window.location.assign("/")} />
}
function Payments() {
  const auth = useAuth()
  const [page, setPage] = useState<AdminJobPaymentPage | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<JobPaymentStatus | "all">("all")
  const [commissionStatus, setCommissionStatus] = useState<PlatformFeeStatus | "overdue" | "all">("all")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const [paymentAction, setPaymentAction] = useState<PaymentActionRequest | null>(null)
  const [paymentActionError, setPaymentActionError] = useState("")
  const pageSize = 25
  const actionPayment = page?.items.find((payment) => payment.id === paymentAction?.targetId) ?? null
  const load = () => {
    setLoading(true); setError("")
    void auth.getAdminJobPayments(search, status, commissionStatus, pageSize, offset)
      .then(setPage)
      .catch((caught: unknown) => setError(caught instanceof Error? caught.message : "Could not load payment records."))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [search, status, commissionStatus, offset, auth.getAdminJobPayments])
  const money = (minor: number) => `KES ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const openPaymentAction = (request: PaymentActionRequest) => { setPaymentActionError(""); setPaymentAction(request) }
  const submitPaymentAction = async ({ value, secondaryValue }: { value: string; secondaryValue: string }) => {
    if (!paymentAction) return
    const { kind, targetId } = paymentAction
    const held = kind === "payout-hold" && paymentAction.mode !== "release"
    const restricted = kind === "commission-restriction" && paymentAction.mode !== "release"
    const busyTarget = kind === "payout-hold" || kind === "commission-restriction" ? targetId : targetId
    setBusyId(busyTarget); setPaymentActionError("")
    try {
      if (kind === "resolve") await auth.resolveAdminJobPayment(targetId, secondaryValue as "paid" | "refunded", value.trim())
      else if (kind === "verify-fee") await auth.recordAdminPlatformFeeReceipt(targetId, value.trim())
      else if (kind === "correct-fee") await auth.requestAdminPlatformFeeCorrection(targetId, value.trim())
      else if (kind === "remind") await auth.sendAdminPlatformFeeReminder(targetId, value.trim())
      else if (kind === "payout-hold") await auth.setAdminProviderPayoutHold(targetId, held, value.trim())
      else await auth.setAdminCommissionRestriction(targetId, restricted, value.trim())
      setPaymentAction(null)
      load()
    } catch (caught) {
      setPaymentActionError(caught instanceof Error ? caught.message : "Could not complete this action. Please try again.")
    } finally { setBusyId("") }
  }
  return <div className="content console-content">
    <PageHeader title="Payments and worker earnings" description="Search by job ID, worker, hirer, or payment reference. Financial figures include confirmed payments only." action={<Button variant="secondary" onClick={load}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {page && <div className="admin-payment-summary-groups"><section className="admin-payment-summary-group"><h2>Worker payments</h2><div className="metrics"><Metric label="Confirmed job payments" value={money(page.summary.paidGrossMinor)} /><Metric label="Paid to workers" value={money(page.summary.providerNetMinor)} /><Metric label="Disputed worker payments" value={String(page.summary.disputedCount)} /></div></section><section className="admin-payment-summary-group"><h2>OddJobs fees</h2><div className="metrics"><Metric label="Require hirer action" value={money(page.summary.commissionDueMinor)} /><Metric label="Awaiting admin review" value={money(page.summary.commissionReportedMinor)} /><Metric label="Verified received" value={money(page.summary.commissionReceivedMinor)} /><Metric label="Under dispute" value={money(page.summary.commissionDisputedMinor)} /></div></section></div>}
    <section className="card table-card admin-payments-table-card"><div className="filters"><label>Search<input value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0) }} placeholder="Job ID, payment ID, worker, hirer" /></label><label>Worker payment<select value={status} onChange={(event) => { setStatus(event.target.value as JobPaymentStatus | "all"); setOffset(0) }}><option value="all">All statuses</option><option value="awaiting_payment">Awaiting payment</option><option value="reported">Reported</option><option value="paid">Paid</option><option value="disputed">Disputed</option><option value="refunded">Refunded</option></select></label><label>OddJobs commission<select value={commissionStatus} onChange={(event) => { setCommissionStatus(event.target.value as PlatformFeeStatus | "overdue" | "all"); setOffset(0) }}><option value="all">All commission statuses</option><option value="overdue">Overdue</option><option value="due">Due</option><option value="reported">Reported — review needed</option><option value="needs_correction">Needs correction</option><option value="received">Verified</option><option value="disputed">Disputed</option></select></label></div>
      {loading? <p role="status">Loading payments...</p> : page?.items.length? <div className="table-wrap"><table className="admin-payments-table"><thead><tr><th>#</th><th>Job / payment</th><th>Worker</th><th>Hirer</th><th>Agreed</th><th>OddJobs fee</th><th>Worker share</th><th>Worker payment</th><th>Commission review</th></tr></thead><tbody>{page.items.map((payment, index) => <tr key={payment.id}><td>{offset + index + 1}</td><td><strong>{payment.jobReference}</strong><small className="caption">{payment.jobTitle}</small><small className="caption">{payment.paymentReference}</small></td><td>{payment.providerName}</td><td>{payment.customerName}</td><td>{money(payment.grossAmountMinor)}</td><td>{money(payment.commissionAmountMinor)} <small className="caption">({(payment.commissionBasisPoints / 100).toFixed(1)}%)</small></td><td>{money(payment.providerAmountMinor)}</td><td>{payment.method?.replace("_", " ") ?? "—"}<small className="caption">{payment.status.replaceAll("_", " ")}</small>{payment.status === "disputed" && <div className="card-actions"><Button variant="secondary" disabled={busyId === payment.id} onClick={() => openPaymentAction({ kind: "resolve", targetId: payment.id, title: "Resolve payment dispute", description: `Record the final outcome for ${payment.jobReference}. This decision is added to the payment history.`, subject: "Resolution note", secondaryDefault: "paid" })}>Resolve dispute</Button></div>}</td><td><Badge tone={payment.platformFeeStatus === "received"? "green" : payment.platformFeeStatus === "disputed"? "red" : payment.platformFeeStatus === "needs_correction"? "amber" : "neutral"}>{commissionLabels[payment.platformFeeStatus]}</Badge>{payment.platformFeeDueAt && (payment.platformFeeStatus === "due" || payment.platformFeeStatus === "needs_correction") && <small className="caption">Due {new Date(payment.platformFeeDueAt).toLocaleString()}{payment.commissionOverdue? " · OVERDUE" : ""}</small>}{payment.platformFeePaymentReference && <small className="caption">Hirer reference: {payment.platformFeePaymentReference}</small>}{payment.platformFeeCorrectionReason && <small className="form-error">Correction requested: {payment.platformFeeCorrectionReason}</small>}{payment.platformFeeReceiptReference && <small className="caption">Verified receipt: {payment.platformFeeReceiptReference}</small>}{payment.platformFeeStatus === "reported" && <div className="card-actions"><Button variant="secondary" disabled={busyId === payment.id} onClick={() => openPaymentAction({ kind: "verify-fee", targetId: payment.id, title: "Verify fee payment", description: `Check the hirer’s reference for ${payment.jobReference} against the receipt before confirming.`, subject: "Receipt reference", defaultValue: payment.platformFeePaymentReference ?? "" })}>Verify receipt</Button><Button variant="secondary" disabled={busyId === payment.id} onClick={() => openPaymentAction({ kind: "correct-fee", targetId: payment.id, title: "Request a correction", description: `Tell ${payment.customerName} what needs to be corrected for ${payment.jobReference}.`, subject: "What needs correcting?" })}>Request correction</Button></div>}{(payment.platformFeeStatus === "due" || payment.platformFeeStatus === "needs_correction") && <div className="card-actions">{payment.commissionOverdue && <Button variant="secondary" disabled={busyId === payment.id} onClick={() => openPaymentAction({ kind: "remind", targetId: payment.id, title: "Send payment reminder", description: `Send ${payment.customerName} a reminder about the overdue OddJobs fee for ${payment.jobReference}.`, subject: "Note to hirer" })}>Send reminder</Button>}{payment.customerCommissionRestricted? <Badge tone="amber">New hiring restricted</Badge> : payment.commissionOverdue && <Button variant="secondary" disabled={busyId === payment.customerId} onClick={() => openPaymentAction({ kind: "commission-restriction", targetId: payment.customerId, title: "Restrict new hiring", description: `Pause new job postings and hiring for ${payment.customerName} while overdue fees are resolved. Existing jobs and Support remain available.`, subject: "Reason for restriction" })}>Restrict new hiring</Button>}{payment.customerCommissionRestricted && <Button variant="secondary" disabled={busyId === payment.customerId} onClick={() => openPaymentAction({ kind: "commission-restriction", targetId: payment.customerId, title: "Restore hiring access", description: `Restore new job posting and hiring for ${payment.customerName}.`, subject: "Reason for restoring access", defaultValue: "Restriction reviewed and access restored.", mode: "release" })}>Release restriction</Button>}</div>}{payment.platformFeeEvents.length > 0 && <details className="payment-history-details"><summary>Activity history ({payment.platformFeeEvents.length})</summary><ol>{payment.platformFeeEvents.map((event, eventIndex) => <li key={`${event.action}-${event.createdAt}-${eventIndex}`}><strong>{commissionEventLabel(event.action)}</strong><small className="caption">{new Date(event.createdAt).toLocaleString()}{event.action === "platform_fee.correction_requested" && typeof event.metadata.reason === "string"? ` · ${event.metadata.reason}` : event.action === "platform_fee.reminder.manual" && typeof event.metadata.note === "string" && event.metadata.note? ` · ${event.metadata.note}` : ""}</small></li>)}</ol></details>}</td></tr>)}</tbody></table></div> : !error && <EmptyState title="No payment records" detail="Accepted bids create payment agreements. Confirmed payments and disputes will appear here." />}
      <div className="card-actions"><Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</Button><span>{page?.total? `${offset + 1}–${Math.min(offset + page.items.length, page.total)} of ${page.total}` : "0 payments"}</span><Button variant="secondary" disabled={loading || !page || offset + pageSize >= page.total} onClick={() => setOffset((value) => value + pageSize)}>Next</Button></div>
    </section>
    <section className="card table-card"><h2>Lifetime earnings by worker</h2>{page?.workers.length? <div className="table-wrap"><table><thead><tr><th>#</th><th>Worker</th><th>Paid jobs</th><th>Agreed job totals</th><th>OddJobs fee share</th><th>Worker earnings</th><th>Worker payout hold</th></tr></thead><tbody>{page.workers.map((worker, index) => <tr key={worker.providerId}><td>{index + 1}</td><td>{worker.providerName}</td><td>{worker.paidJobs}</td><td>{money(worker.grossMinor)}</td><td>{money(worker.commissionMinor)}</td><td>{money(worker.netMinor)}</td><td>{worker.payoutHeld? <><Badge tone="amber">Held</Badge> <Button variant="secondary" disabled={busyId === worker.providerId} onClick={() => openPaymentAction({ kind: "payout-hold", targetId: worker.providerId, title: "Release payout hold", description: `Allow payouts for ${worker.providerName} to resume.`, subject: "Reason for releasing hold", defaultValue: "Payout hold reviewed and released.", mode: "release" })}>Release hold</Button></> : <Button variant="secondary" disabled={busyId === worker.providerId} onClick={() => openPaymentAction({ kind: "payout-hold", targetId: worker.providerId, title: "Place payout hold", description: `Pause payouts to ${worker.providerName} until the issue has been reviewed.`, subject: "Reason for payout hold" })}>Place hold</Button>}</td></tr>)}</tbody></table></div> : <p className="caption">Worker totals appear after the first confirmed payment.</p>}</section>
    <p className="caption">Workers confirm their 90% share. Hirers report the separate 10% OddJobs fee and its receipt reference; admins verify that report here. Payment and payout rails are not integrated yet.</p>
    <PaymentActionDialog request={paymentAction} busy={Boolean(busyId)} error={paymentActionError} onClose={() => setPaymentAction(null)} onSubmit={(values) => void submitPaymentAction(values)} />
  </div>
}

function Config() {
  const { getAdminSettings, saveAdminSettings } = useAuth()
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null)
  const [savedSettings, setSavedSettings] = useState<AdminSystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const hasChanges = Boolean(settings && savedSettings && (
    settings.newProviderApplicationsEnabled !== savedSettings.newProviderApplicationsEnabled ||
    settings.adsEnabled !== savedSettings.adsEnabled
  ))
  const load = () => {
    setLoading(true)
    setError("")
    void getAdminSettings()
      .then((value) => {
        setSettings(value)
        setSavedSettings(value)
        setMessage("")
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error? caught.message : "Could not load settings."),
      )
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [getAdminSettings])
  const save = async () => {
    if (!settings) return
    setSaving(true)
    setError("")
    setMessage("")
    try {
      const saved = await saveAdminSettings({
        ...settings,
      })
      setSettings(saved)
      setSavedSettings(saved)
      setMessage("Your marketplace settings have been saved.")
    } catch (caught) {
      setError(caught instanceof Error? caught.message : "Could not save settings.")
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="System configuration"
        description="Choose which marketplace activity is currently open."
        action={<Button variant="secondary" disabled={loading || saving} onClick={load}>Refresh</Button>}
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="config-success" role="status">{message}</p>}
      {loading? <p role="status">Loading marketplace settings...</p> : settings && (
        <div className="config-layout">
          <section className="card config-settings-card">
            <div className="config-settings-heading">
              <div><span className="eyebrow">MARKETPLACE</span><h2>What is open to members</h2></div>
              <span className={`config-save-state ${hasChanges ? "pending" : "saved"}`}>
                {hasChanges ? "Unsaved changes" : "All changes saved"}
              </span>
            </div>
            <div className="config-toggle-list">
              <div className="config-toggle-row">
                <div className="config-toggle-copy">
                  <strong>New worker applications</strong>
                  <span>{settings.newProviderApplicationsEnabled ? "Workers can apply to join OddJobs." : "New workers cannot apply to join right now."}</span>
                </div>
                <button type="button" className={`switch ${settings.newProviderApplicationsEnabled ? "on" : ""}`} role="switch" aria-checked={settings.newProviderApplicationsEnabled} aria-label="Allow new worker applications" disabled={saving} onClick={() => setSettings({ ...settings, newProviderApplicationsEnabled: !settings.newProviderApplicationsEnabled })}><i /></button>
              </div>
              <div className="config-toggle-row">
                <div className="config-toggle-copy">
                  <strong>Advertise on OddJobs</strong>
                  <span>{settings.adsEnabled ? "New advertising campaigns can be submitted for review." : "New advertising campaigns are paused."}</span>
                </div>
                <button type="button" className={`switch ${settings.adsEnabled ? "on" : ""}`} role="switch" aria-checked={settings.adsEnabled} aria-label="Allow advertising campaign submissions" disabled={saving} onClick={() => setSettings({ ...settings, adsEnabled: !settings.adsEnabled })}><i /></button>
              </div>
            </div>
            <div className="config-save-row">
              <span>{hasChanges ? "Save to apply your updates across the marketplace." : "Changes are recorded in the admin activity history."}</span>
              <Button disabled={saving || !hasChanges} onClick={() => void save()}>{saving ? "Saving..." : "Save changes"}</Button>
            </div>
          </section>
          <aside className="card config-help-card">
            <span className="eyebrow">OTHER SETTINGS</span>
            <h2>Where to manage the rest</h2>
            <div><strong>Service fees</strong><p>Manage categories and commission rates in Categories &amp; fees.</p></div>
            <div><strong>Admin access</strong><p>Invite administrators and manage their access from Admin team.</p></div>
            <div><strong>Payments</strong><p>Review reported worker payments and OddJobs fees in Payments &amp; wallets.</p></div>
          </aside>
        </div>
      )}
    </div>
  )
}

function AdminMonitoring() {
  const { getAdminMonitoring, getAdminMonitoringHistory, getAdminAlerts, updateAdminAlert } = useAuth()
  const [snapshot, setSnapshot] = useState<AdminMonitoringSnapshot | null>(null)
  const [history, setHistory] = useState<AdminMonitoringSnapshot[]>([])
  const [alerts, setAlerts] = useState<AdminAlertSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const load = () => {
    setLoading(true)
    setError("")
    void Promise.all([getAdminMonitoring(), getAdminMonitoringHistory(50), getAdminAlerts(50)])
      .then(([current, previous, managedAlerts]) => {
        setSnapshot(current)
        setHistory(previous)
        setAlerts(managedAlerts)
        setLastUpdated(new Date())
      })
      .catch((caught: unknown) => setError(caught instanceof Error? caught.message : "Could not load monitoring data."))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [getAdminMonitoring, getAdminMonitoringHistory, getAdminAlerts])
  useEffect(() => {
    const timer = window.setInterval(() => load(), 60_000)
    return () => window.clearInterval(timer)
  }, [getAdminMonitoring, getAdminMonitoringHistory, getAdminAlerts])
  const takeAlertAction = async (id: string, action: "acknowledge" | "assign" | "resolve") => {
    const reason = action === "resolve"? window.prompt("Why is this alert resolved? Add a short note for the audit trail.")?.trim() ?? "" : undefined
    if (action === "resolve" && (reason?.length ?? 0) < 5) { setError("Add a resolution note of at least five characters."); return }
    setError("")
    try { await updateAdminAlert(id, action, reason); load() }
    catch (caught) { setError(caught instanceof Error? caught.message : "Could not update this alert.") }
  }
  const money = (minor: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(minor / 100)
  return <div className="content console-content admin-monitoring">
    <PageHeader title="System monitoring" description="Live API health and operational queues that need attention." action={<Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>} />
    <p className="monitoring-live-status"><i /> Checks run automatically every minute while the API is running{lastUpdated? " | Updated " + lastUpdated.toLocaleTimeString() : ""}{loading? " | Refreshing..." : ""}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && !snapshot? <p role="status">Checking API and marketplace health...</p> : snapshot && <>
      <section className="metrics monitoring-metrics">
        <Metric label="API" value="Online" />
        <Metric label="Database" value={snapshot.database === "ok"? "Connected" : "Unavailable"} />
        <Metric label="Database check" value={snapshot.database === "ok"? snapshot.databaseLatencyMs + " ms" : "Failed"} />
        <Metric label="API uptime" value={Math.floor(snapshot.uptimeSeconds / 3600) + "h " + Math.floor(snapshot.uptimeSeconds % 3600 / 60) + "m"} />
        <Metric label="Provider ID checks" value={snapshot.pendingVerifications.toLocaleString()} />
        <Metric label="Hirer ID checks" value={(snapshot.pendingCustomerVerifications ?? 0).toLocaleString()} />
        <Metric label="Open reports" value={snapshot.openReports.toLocaleString()} />
        <Metric label="Active support cases" value={(snapshot.openSupportCases ?? 0).toLocaleString()} />
        <Metric label="Overdue commissions" value={(snapshot.overdueCommissionCount ?? 0).toLocaleString()} />
        <Metric label="Overdue commission value" value={money(snapshot.overdueCommissionMinor ?? 0)} />
        <Metric label="API memory" value={Math.round(snapshot.heapUsedBytes / snapshot.heapLimitBytes * 100) + "%"} />
      </section>
      <section className="card monitoring-alerts">
        <div className="section-title"><div><h2>Managed alerts</h2><p className="caption">Alerts stay open until the condition clears or an administrator resolves them.</p></div><span>{alerts.filter((item) => item.status !== "resolved").length} active</span></div>
        {alerts.filter((item) => item.status !== "resolved").length? <div className="monitoring-alert-list">{alerts.filter((item) => item.status !== "resolved").map((alert, index) => <article className="monitoring-alert" key={alert.id}><span className={alert.severity === "critical"? "critical" : "warning"}>{alert.severity}</span><strong>{alert.message}</strong><small>#{index + 1} · {alert.code.replaceAll("_", " ")} · First seen {new Date(alert.firstSeenAt).toLocaleString()} · Last seen {new Date(alert.lastSeenAt).toLocaleString()}</small><small>Status: {alert.status}{alert.assignedAdminName? ` · Assigned to ${alert.assignedAdminName}` : " · Unassigned"}</small><div className="card-actions">{alert.status === "open" && <Button variant="secondary" onClick={() => void takeAlertAction(alert.id, "acknowledge")}>Acknowledge</Button>}<Button variant="secondary" onClick={() => void takeAlertAction(alert.id, "assign")}>Assign to me</Button><Button variant="secondary" onClick={() => void takeAlertAction(alert.id, "resolve")}>Resolve</Button></div></article>)}</div> : <p className="monitoring-clear"><i /> No active alerts. Current checks are healthy.</p>}
      </section>
      <section className="card monitoring-health-target"><div><h2>External uptime check</h2><p>Point your uptime monitor at the deployed API’s <code>/health/ready</code> endpoint. It reports process and database readiness independently of this admin session.</p></div><Badge tone="green">Ready endpoint available</Badge></section>
      <section className="card monitoring-history">
        <div className="section-title"><div><h2>Recent health checks</h2><p className="caption">Automated history, newest first. Up to 50 checks shown.</p></div><span>{history.length} checks</span></div>
        {history.length? <div className="table-wrap"><table className="monitoring-table"><thead><tr><th>#</th><th>Checked</th><th>Database</th><th>Provider IDs</th><th>Reports</th><th>Heap</th><th>Alerts</th></tr></thead><tbody>{history.map((item, index) => <tr key={item.checkedAt}><td>{index + 1}</td><td>{new Date(item.checkedAt).toLocaleString()}</td><td><Badge tone={item.database === "ok"? "green" : "red"}>{item.database}</Badge></td><td>{item.pendingVerifications}</td><td>{item.openReports}</td><td>{Math.round(item.heapUsedBytes / item.heapLimitBytes * 100)}%</td><td>{item.alerts.length? <Badge tone="amber">{item.alerts.length}</Badge> : <span className="caption">Clear</span>}</td></tr>)}</tbody></table></div> : <p className="monitoring-clear">The first scheduled check is being recorded.</p>}
      </section>
    </>}
  </div>
}
function nairobiDate(offsetDays = 0) {
  const date = new Date()
  date.setDate(date.getDate() + offsetDays)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date)
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "00"
  return `${part("year")}-${part("month")}-${part("day")}`
}

function AnalyticsTrend({ series }: { series: AdminAnalyticsReport["series"] }) {
  const groupSize = Math.max(1, Math.ceil(series.length / 24))
  const groups: { from: string; to: string; posted: number; hired: number; completed: number }[] = []
  for (let index = 0; index < series.length; index += groupSize) {
    const points = series.slice(index, index + groupSize)
    groups.push({
      from: points[0].date,
      to: points[points.length - 1].date,
      posted: points.reduce((sum, point) => sum + point.jobsPosted, 0),
      hired: points.reduce((sum, point) => sum + point.hiredJobs, 0),
      completed: points.reduce((sum, point) => sum + point.completedJobs, 0),
    })
  }
  const max = Math.max(1, ...groups.flatMap((group) => [group.posted, group.hired, group.completed]))
  const labels = [...new Set([0, Math.floor((groups.length - 1) / 2), groups.length - 1])]
  return <div className="analytics-chart" role="img" aria-label="Grouped bars show jobs posted, hired, and completed">
    <div className="analytics-bars">
      {groups.map((group) => <div className="analytics-bar-group" key={group.from} title={group.from + (group.to !== group.from? " to " + group.to : "") + ": " + group.posted + " posted, " + group.hired + " hired, " + group.completed + " completed"}>
        <span className="analytics-bar posted" style={{ height: Math.max(group.posted? 3 : 0, group.posted / max * 100) + "%" }} />
        <span className="analytics-bar hired" style={{ height: Math.max(group.hired? 3 : 0, group.hired / max * 100) + "%" }} />
        <span className="analytics-bar completed" style={{ height: Math.max(group.completed? 3 : 0, group.completed / max * 100) + "%" }} />
      </div>)}
    </div>
    <div className="analytics-chart-dates">{labels.map((index) => <span key={index}>{groups[index]?.from.slice(5)}</span>)}</div>
    <div className="analytics-legend"><span><i className="posted" />Posted</span><span><i className="hired" />Hired</span><span><i className="completed" />Completed</span></div>
  </div>
}
function Analytics() {
  const { getAdminAnalytics } = useAuth()
  const [from, setFrom] = useState(() => nairobiDate(-29))
  const [to, setTo] = useState(() => nairobiDate())
  const [category, setCategory] = useState("all")
  const [status, setStatus] = useState<AdminAnalyticsFilters["status"]>("all")
  const [report, setReport] = useState<AdminAnalyticsReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const loadReport = (filters: AdminAnalyticsFilters = { from, to, category, status }) => {
    setLoading(true)
    setError("")
    void getAdminAnalytics(filters).then((nextReport) => {
      setReport(nextReport)
      setLastUpdated(new Date())
    }).catch((caught: unknown) => {
      setError(caught instanceof Error? caught.message : "Could not load analytics.")
    }).finally(() => setLoading(false))
  }
  useEffect(() => { loadReport() }, [getAdminAnalytics])
  useEffect(() => {
    const timer = window.setInterval(() => loadReport(), 60_000)
    return () => window.clearInterval(timer)
  }, [getAdminAnalytics, from, to, category, status])

  const money = (minor: number) => new Intl.NumberFormat("en-KE", {
    style: "currency", currency: report?.currency ?? "KES", maximumFractionDigits: 0,
  }).format(minor / 100)
  const percentChange = (value: number, prior: number) => prior? `${value >= prior? "+" : ""}${Math.round(((value - prior) / prior) * 100)}% vs previous period` : "No previous-period baseline"
  const setRange = (days: number) => {
    const nextFrom = nairobiDate(-(days - 1))
    const nextTo = nairobiDate()
    setFrom(nextFrom)
    setTo(nextTo)
    loadReport({ from: nextFrom, to: nextTo, category, status })
  }
  return <div className="content console-content admin-analytics">
    <PageHeader eyebrow="Marketplace performance" title="Analytics" description="Track marketplace activity, agreed job value, and commission reconciliation." action={<Button variant="secondary" onClick={() => loadReport()} disabled={loading}>Refresh</Button>} />
    <p className="analytics-live-status" aria-live="polite"><i /> {report? "Live marketplace data" : "Connecting to marketplace data"}{lastUpdated? " | Updated " + lastUpdated.toLocaleTimeString() : ""}{loading? " | Refreshing..." : ""}</p>
    <section className="card analytics-filters" aria-label="Analytics filters">
      <div className="analytics-presets">
        <button type="button" onClick={() => setRange(7)}>7 days</button>
        <button type="button" onClick={() => setRange(30)}>30 days</button>
        <button type="button" onClick={() => setRange(90)}>90 days</button>
      </div>
      <label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
      <label>To<input type="date" value={to} min={from} max={nairobiDate()} onChange={(event) => setTo(event.target.value)} /></label>
      <label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All categories</option>{(report?.categories ?? []).map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <label>Job status<select value={status} onChange={(event) => setStatus(event.target.value as AdminAnalyticsFilters["status"])}><option value="all">All statuses</option><option value="open">Open</option><option value="hired">Hired / in progress</option><option value="completed">Completed</option><option value="cancelled">Cancelled / expired</option><option value="disputed">Disputed</option></select></label>
      <Button onClick={() => loadReport()}>Apply filters</Button>
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && !report? <p role="status">Loading analytics…</p> : report && <>
      <p className="analytics-period-note">Job activity uses the job creation date. Commission receipts use the receipt date. Current overdue fees are a live balance and are not limited to this date range.</p>
      <section className="metrics analytics-metrics">
        <Metric label="Jobs posted" value={report.current.jobsPosted.toLocaleString()} />
        <Metric label="With proposals" value={report.current.jobsWithProposals.toLocaleString()} />
        <Metric label="Hired" value={report.current.hiredJobs.toLocaleString()} />
        <Metric label="Completed" value={report.current.completedJobs.toLocaleString()} />
      </section>
      <div className="analytics-comparison">
        <span>{percentChange(report.current.jobsPosted, report.previous.jobsPosted)}</span>
        <span>Previous period: {report.previous.jobsPosted.toLocaleString()} jobs | {report.previous.hiredJobs.toLocaleString()} hired | {report.previous.completedJobs.toLocaleString()} completed</span>
      </div>
      <div className="analytics-finance-grid">
        <section className="card analytics-finance-card"><span>Agreed job value</span><strong>{money(report.current.agreedGrossMinor)}</strong><small>{percentChange(report.current.agreedGrossMinor, report.previous.agreedGrossMinor)}</small><small>Value agreed on accepted quotes; not a cash receipt.</small></section>
        <section className="card analytics-finance-card"><span>Expected commission</span><strong>{money(report.current.expectedCommissionMinor)}</strong><small>From agreements attached to jobs posted in this period.</small></section>
        <section className="card analytics-finance-card"><span>Reported by hirers</span><strong>{money(report.current.reportedCommissionMinor)}</strong><small>Current reported status for this period's job cohort.</small></section>
        <section className="card analytics-finance-card"><span>Verified commission</span><strong>{money(report.current.verifiedCommissionMinor)}</strong><small>{percentChange(report.current.verifiedCommissionMinor, report.previous.verifiedCommissionMinor)} | receipt date in selected period</small></section>
        <section className="card analytics-finance-card analytics-overdue"><span>Currently overdue</span><strong>{money(report.current.overdueCommissionMinor)}</strong><small>{report.current.overdueCommissionCount.toLocaleString()} commission records need follow-up.</small></section>
      </div>
      <section className="card analytics-section">
        <div className="analytics-section-heading"><div><h2>Marketplace activity</h2><p>Daily jobs posted, hired, and completed.</p></div><span>{report.series.length} days</span></div>
        <AnalyticsTrend series={report.series} />
      </section>
      <section className="card analytics-section">
        <div className="analytics-section-heading"><div><h2>Jobs in this period</h2><p>Newest first | up to 100 records.</p></div><span>{report.jobs.length.toLocaleString()} shown</span></div>
        {report.jobs.length? <div className="table-wrap"><table className="analytics-table"><thead><tr><th>#</th><th>Job</th><th>Category</th><th>Proposals</th><th>Status</th><th>Posted</th></tr></thead><tbody>{report.jobs.map((job, index) => <tr key={job.reference}><td>{index + 1}</td><td><strong>{job.reference}</strong><small className="caption">{job.title}</small></td><td>{job.category}</td><td>{job.proposals}</td><td><Badge tone={job.status === "completed"? "green" : job.status === "disputed"? "red" : "amber"}>{job.status.replaceAll("_", " ")}</Badge></td><td>{new Date(job.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">No jobs match this period and filter.</p>}
      </section>
      <section className="card analytics-section">
        <div className="analytics-section-heading"><div><h2>Commission pipeline</h2><p>Current fee status for payment agreements attached to jobs posted in this period.</p></div><span>{report.commissions.length.toLocaleString()} shown</span></div>
        {report.commissions.length? <div className="table-wrap"><table className="analytics-table"><thead><tr><th>#</th><th>Job</th><th>Hirer</th><th>Worker</th><th>Fee</th><th>Status</th><th>Due</th></tr></thead><tbody>{report.commissions.map((item, index) => <tr key={item.reference}><td>{index + 1}</td><td><strong>{item.reference}</strong><small className="caption">{item.title}</small></td><td>{item.customer}</td><td>{item.provider}</td><td>{money(item.feeMinor)}</td><td><Badge tone={item.status === "received"? "green" : item.status === "disputed"? "red" : "amber"}>{item.status}</Badge></td><td>{item.dueAt? new Date(item.dueAt).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">No payment agreements were created in this period.</p>}
      </section>
    </>}
  </div>
}

export type AdminConsoleScreenKey =
  | "payments"
  | "analytics"
  | "messages"
  | "monitoring"
  | "overview"
  | "actionCenter"
  | "users"
  | "verification"
  | "moderation"
  | "categories"
  | "adApprovals"
  | "audit"
  | "config"
  | "team"
  | "acceptInvite"

export default function AdminConsoleScreen({ screen }: { screen: AdminConsoleScreenKey }) {
  switch (screen) {
    case "payments": return <Payments />
    case "analytics": return <Analytics />
    case "messages": return <AdminMessages />
    case "monitoring": return <AdminMonitoring />
    case "overview": return <Overview />
    case "actionCenter": return <ActionCenter />
    case "users": return <Users />
    case "verification": return <IdentityVerification />
    case "moderation": return <Moderation />
    case "categories": return <Categories />
    case "adApprovals": return <AdApprovals />
    case "audit": return <AuditLog />
    case "config": return <Config />
    case "team": return <AdminTeam />
    case "acceptInvite": return <AdminInviteAccept />
    default: return null
  }
}

