import { useEffect, useState } from "react"
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
  type JobPaymentRecord,
  type AdminOverview as AdminOverviewData,
  type AdminAnalyticsFilters,
  type AdminAnalyticsReport,
  type AdminSystemSettings,
  type AdminUserSummary,
  type AdminMemberRole,
  type AdminTeamSummary,
  type AdminAlertSummary,
} from "../../auth/AuthProvider"
import { Badge, Button, DemoNotice, EmptyState, Icon, Metric, PageHeader } from "../../shared/components/WorkspaceUi"
import { AdminMessages } from "../marketplace/ServiceMessages"
import { IdentityVerification } from "./IdentityVerification"

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
      setError(caught instanceof Error ? caught.message : "Could not update the hiring restriction.")
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
        {loading ? <p role="status">Loading users…</p> : filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>User</th><th>ID</th><th>Roles</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.id}</td>
                  <td>{user.roles.join(", ") || "—"}</td>
                  <td><span>{user.status}</span>{user.commissionRestricted && <small className="caption"><Badge tone="amber">New hiring restricted</Badge></small>}{user.overdueCommissionCount > 0 && <small className="caption">{user.overdueCommissionCount} overdue commission{user.overdueCommissionCount === 1 ? "" : "s"} | KES {(user.overdueCommissionMinor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</small>}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td><div className="card-actions">{user.status === "suspended" && !user.roles.includes("admin") ? (
                    <Button variant="secondary" disabled={savingUserId === user.id} onClick={() => void reinstate(user.id)}>
                      {savingUserId === user.id ? "Restoring…" : "Reinstate"}
                    </Button>
                  ) : null}{!user.roles.includes("admin") && user.roles.includes("consumer") && (user.commissionRestricted || user.overdueCommissionCount > 0) && <Button variant="secondary" disabled={savingUserId === user.id} onClick={() => void toggleCommissionRestriction(user)}>{savingUserId === user.id ? "Saving…" : user.commissionRestricted ? "Release restriction" : "Restrict new hiring"}</Button>}</div></td>
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
        setError(caught instanceof Error ? caught.message : "Could not load reports."),
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
        {loading ? <p role="status">Loading reports…</p> : reports.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th className="moderation-number-heading">#</th><th>Reason</th><th>Subject</th><th>Details</th><th>Status</th><th>Reported</th><th>Review</th></tr></thead>
              <tbody>{reports.map((report, index) => (
                <tr key={report.id}>
                  <td className="moderation-number">{offset + index + 1}</td>
                  <td>{report.reason.replace(/_/g, " ")}</td>
                  <td>{report.subjectType === "job" ? `Job ID ${report.jobReference ?? report.subjectId}` : `${report.subjectType} | ${report.subjectId}`}</td>
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
  const { getAdminCategories, saveAdminCategory, getAdminSettings, saveAdminSettings, getAdminAuditEvents } = useAuth()
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
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null)
  const [commission, setCommission] = useState("10")
  const [audit, setAudit] = useState<AdminAuditEvent[]>([])
  const [savingCommission, setSavingCommission] = useState(false)

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
      setCategories((items) => [...items.filter((item) => item.id !== saved.id), saved].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)))
      load()
      setEditingSlug("")
      setDraft({ name: "", slug: "", active: true, sortOrder: 0 })
      setMessage(`Saved category “${saved.name}”.`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save category.")
    } finally {
      setSaving(false)
    }
  }

  const toggleCategory = async (category: AdminCategory) => {
    const active = !category.active
    if (active && category.openJobs > 0 && !window.confirm(`${category.openJobs} open job(s) already use this category. Existing jobs remain unchanged. Activate it for new jobs?`)) return
    if (!active && category.openJobs > 0 && !window.confirm(`${category.openJobs} open job(s) use this category. They remain unchanged, but new jobs can no longer select it. Continue?`)) return
    setSaving(true); setError(""); setMessage("")
    try {
      await saveAdminCategory({ name: category.name, slug: category.slug, active, sortOrder: category.sortOrder })
      setMessage(`${category.name} is now ${active ? "active" : "inactive"}.`)
      load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update category status.") }
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
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the commission rate.") }
    finally { setSavingCommission(false) }
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
        <section className="card table-card">
          <div className="section-title"><div><h2>Service categories</h2><p className="caption">Active categories appear in hirer job posting. Deactivation preserves existing jobs.</p></div><Badge>{categories.filter((item) => item.active).length} active</Badge></div>
          {loading ? <p role="status">Loading categories…</p> : categories.length ? <div className="table-wrap"><table><thead><tr><th>#</th><th>Category</th><th>Slug</th><th>Jobs</th><th>Open</th><th>Status</th><th>Actions</th></tr></thead><tbody>{categories.map((category, index) => <tr key={category.id}><td>{index + 1}</td><td><strong>{category.name}</strong><small className="caption">Sort {category.sortOrder}</small></td><td>{category.slug}</td><td>{category.totalJobs}</td><td>{category.openJobs}</td><td><Badge tone={category.active ? "green" : "amber"}>{category.active ? "Active" : "Inactive"}</Badge></td><td><div className="card-actions"><Button variant="ghost" disabled={saving} onClick={() => { setEditingSlug(category.slug); setDraft({ name: category.name, slug: category.slug, active: category.active, sortOrder: category.sortOrder }) }}>Edit</Button><Button variant="secondary" disabled={saving} onClick={() => void toggleCategory(category)}>{category.active ? "Deactivate" : "Activate"}</Button></div></td></tr>)}</tbody></table></div> : <EmptyState title="No categories configured" detail="Add the services hirers can choose when posting jobs." />}
          <h3>{editingSlug ? "Edit category" : "Add category"}</h3>
          <label>
            Name
            <input maxLength={80} disabled={Boolean(editingSlug && categories.find((item) => item.slug === editingSlug)?.totalJobs)} value={draft.name} onChange={(event) => {
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
        <section className="card setting-card">
          <h2>Marketplace commission</h2>
          <p className="caption">This rate is saved on new payment agreements when a hirer accepts a quote. Existing agreements keep their original rate.</p>
          <label>Commission rate (%)<input type="number" min="0" max="30" step="0.1" value={commission} onChange={(event) => setCommission(event.target.value)} /></label>
          <div className="metrics"><Metric label="Example job amount" value="KES 10,000" /><Metric label="OddJobs fee" value={`KES ${(10000 * Number(commission || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} /><Metric label="Worker share" value={`KES ${(10000 * (1 - Number(commission || 0) / 100)).toLocaleString(undefined, { maximumFractionDigits: 2 })}`} /></div>
          <Button disabled={savingCommission || !settings} onClick={() => void saveCommission()}>{savingCommission ? "Saving…" : "Save commission rate"}</Button>
          <p className="caption">Fee reporting and admin receipt verification are handled under Payments and worker earnings. Payment transfers are still recorded manually.</p>
        </section>
      </div>
      <section className="card table-card"><div className="section-title"><div><h2>Recent configuration changes</h2><p className="caption">Latest category and marketplace fee updates.</p></div></div>{audit.length ? <div className="table-wrap"><table><thead><tr><th>#</th><th>Change</th><th>Admin</th><th>When</th></tr></thead><tbody>{audit.map((event, index) => <tr key={event.id}><td>{index + 1}</td><td>{event.action === "admin.system_settings.update" ? `Commission updated${event.metadata.marketplaceCommissionPercent !== undefined ? ` to ${event.metadata.marketplaceCommissionPercent}%` : ""}` : `Category settings updated${event.metadata.slug ? ` | ${event.metadata.slug}` : ""}`}</td><td><code title={event.actorUserId}>{event.actorUserId.slice(0, 8)}</code></td><td>{new Date(event.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="caption">No configuration changes recorded yet.</p>}</section>
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
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load audit events."))
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
      {loading ? <p role="status">Loading audit events...</p> : events.length ? <div className="table-wrap">
        <table className="audit-table">
          <thead><tr><th>#</th><th>Time</th><th>Administrator</th><th>Action</th><th>Record</th><th>Details</th><th>Request ID</th></tr></thead>
          <tbody>{events.map((event, index) => <tr key={event.id}>
            <td>{offset + index + 1}</td>
            <td>{new Date(event.createdAt).toLocaleString()}</td>
            <td><strong>{event.actorDisplayName || "Admin"}</strong><small className="caption" title={event.actorUserId}>{event.actorUserId.slice(0, 8)}</small></td>
            <td>{auditActionLabel(event.action)}</td>
            <td>{event.targetType?.replaceAll("_", " ") || "System"}<small className="caption" title={event.targetId ?? ""}>{event.targetId ? event.targetId.slice(0, 12) : ""}</small></td>
            <td>{Object.entries(event.metadata).filter(([key]) => !["messageId", "limit", "offset", "search", "count"].includes(key)).map(([key, value]) => <small className="audit-detail" key={key}><strong>{key.replaceAll("_", " ")}:</strong> {String(value)}</small>)}</td>
            <td><code title={event.requestId}>{event.requestId.slice(0, 12)}</code></td>
          </tr>)}</tbody>
        </table>
      </div> : !error ? <EmptyState title="No audit events" detail="Administrative events will appear here." /> : null}
      <div className="card-actions">
        <Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</Button>
        <span>{total ? (offset + 1) + "-" + Math.min(offset + events.length, total) + " of " + total : "0 events"}</span>
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
  const [role, setRole] = useState<AdminMemberRole>("SUPPORT_AGENT")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const load = () => { setLoading(true); setError(""); void auth.getAdminTeam().then(setTeam).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load the admin team.")).finally(() => setLoading(false)) }
  useEffect(() => { load() }, [auth.getAdminTeam])
  const invite = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy("invite"); setError("")
    try { await auth.inviteAdminUser(email.trim(), role); setEmail(""); load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send the invitation.") }
    finally { setBusy("") }
  }
  const changeRole = async (userId: string, nextRole: AdminMemberRole) => {
    setBusy(userId); setError("")
    try {
      await auth.setAdminMemberRole(userId, nextRole)
      load()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the role.") }
    finally { setBusy("") }
  }
  const remove = async (userId: string, name: string) => {
    if (!window.confirm(`Remove admin access for ${name}? This action is recorded in the audit log.`)) return
    setBusy(userId); setError("")
    try { await auth.removeAdminMember(userId); load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove administrator access.") }
    finally { setBusy("") }
  }
  const revoke = async (id: string) => { setBusy(id); setError(""); try { await auth.revokeAdminInvitation(id); load() } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not revoke the invitation.") } finally { setBusy("") } }
  return <div className="content console-content">
    <PageHeader title="Admin team & access" description="Invite administrators, assign scoped roles, and review pending invitations." action={<Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <form className="card admin-invite-form" onSubmit={invite}>
      <div><h2>Invite an administrator</h2><p className="caption">An invitation is sent to their email and expires after seven days.</p></div>
      <label>Email address<input type="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@company.com" /></label>
      <label>Access role<select value={role} onChange={(event) => setRole(event.target.value as AdminMemberRole)}>{manageableAdminRoles.map((item) => <option value={item} key={item}>{adminRoleLabels[item]}</option>)}</select></label>
      <Button type="submit" disabled={busy === "invite" || !email.trim()}>{busy === "invite" ? "Sending…" : "Send invitation"}</Button>
    </form>
    <section className="card table-card admin-team-card">
      <div className="section-title"><div><h2>Administrators</h2><p className="caption">Roles limit which admin pages and actions each person can access.</p></div><span>{team?.members.length ?? 0} members</span></div>
      {loading ? <p role="status">Loading admin team…</p> : team?.members.length ? <div className="table-wrap"><table className="admin-team-table"><thead><tr><th>#</th><th>Administrator</th><th>Role</th><th>Joined</th><th>Access</th></tr></thead><tbody>{team.members.map((member, index) => <tr key={member.userId}><td>{index + 1}</td><td><strong>{member.displayName}</strong>{member.legacyOwner && <small className="caption">Legacy owner · protected</small>}</td><td>{member.legacyOwner ? <Badge tone="amber">Owner</Badge> : <select aria-label={`Role for ${member.displayName}`} value={member.role} disabled={busy === member.userId} onChange={(event) => void changeRole(member.userId, event.target.value as AdminMemberRole)}>{Object.entries(adminRoleLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>}</td><td>{new Date(member.joinedAt).toLocaleDateString()}</td><td>{member.legacyOwner ? <span className="caption">Existing admin</span> : <Button variant="secondary" disabled={busy === member.userId} onClick={() => void remove(member.userId, member.displayName)}>Remove</Button>}</td></tr>)}</tbody></table></div> : <EmptyState title="No administrators" detail="Invite someone to help manage OddJobs." />}
    </section>
    <section className="card table-card admin-team-card">
      <div className="section-title"><div><h2>Invitations</h2><p className="caption">Pending and recently completed invitations.</p></div><span>{team?.invitations.filter((item) => item.status === "PENDING").length ?? 0} pending</span></div>
      {team?.invitations.length ? <div className="table-wrap"><table className="admin-team-table"><thead><tr><th>#</th><th>Email</th><th>Role</th><th>Status</th><th>Expires</th><th>Action</th></tr></thead><tbody>{team.invitations.map((invitation, index) => <tr key={invitation.id}><td>{index + 1}</td><td>{invitation.email}</td><td>{adminRoleLabels[invitation.role]}</td><td><Badge tone={invitation.status === "PENDING" ? "amber" : invitation.status === "ACCEPTED" ? "green" : "neutral"}>{invitation.status.toLowerCase()}</Badge></td><td>{new Date(invitation.expiresAt).toLocaleDateString()}</td><td>{invitation.status === "PENDING" && <Button variant="secondary" disabled={busy === invitation.id} onClick={() => void revoke(invitation.id)}>Revoke</Button>}</td></tr>)}</tbody></table></div> : <EmptyState title="No invitations yet" detail="New invitations will appear here." />}
    </section>
  </div>
}

function AdminInviteAccept() {
  const auth = useAuth()
  const [invitation] = useState(() => ({ invitationId: new URLSearchParams(window.location.search).get("invitationId") ?? "", token: new URLSearchParams(window.location.search).get("token") ?? "" }))
  const [status, setStatus] = useState("Checking invitation…")
  const [error, setError] = useState("")
  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname)
    if (!invitation.invitationId || !invitation.token) { setError("The invitation link is incomplete. Ask the workspace owner to send a new invitation."); return }
    if (auth.loading) return
    if (!auth.profile) { setError("Sign in with the email address that received the invitation, then reopen its link."); return }
    void auth.acceptAdminInvitation(invitation.invitationId, invitation.token).then((result) => {
      setStatus("Invitation accepted. Opening your admin workspace…")
      window.location.replace(result.redirectTo)
    }).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "This invitation could not be accepted."))
  }, [auth.loading, auth.profile, auth.acceptAdminInvitation, invitation])
  return <div className="content console-content"><PageHeader title="Join the admin team" description="Accept a secure invitation to access the OddJobs admin workspace." />{error ? <p className="form-error" role="alert">{error}</p> : <p role="status">{status}</p>}</div>
}
function Payments() {
  const auth = useAuth()
  const [page, setPage] = useState<AdminJobPaymentPage | null>(null)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<JobPaymentStatus | "all">("all")
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState("")
  const [error, setError] = useState("")
  const pageSize = 25
  const load = () => {
    setLoading(true); setError("")
    void auth.getAdminJobPayments(search, status, pageSize, offset)
      .then(setPage)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load payment records."))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(), [search, status, offset, auth.getAdminJobPayments])
  const money = (minor: number) => `KES ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const resolve = async (paymentId: string) => {
    const decision = window.prompt("Resolve as paid or refunded? Enter paid or refunded.")?.trim().toLowerCase()
    if (decision !== "paid" && decision !== "refunded") return
    const reason = window.prompt("Enter the reason for this resolution (at least 10 characters).")?.trim() ?? ""
    if (reason.length < 10) { setError("Enter a resolution reason of at least 10 characters."); return }
    setBusyId(paymentId); setError("")
    try { await auth.resolveAdminJobPayment(paymentId, decision, reason); load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not resolve payment.") }
    finally { setBusyId("") }
  }
  const markCommission = async (paymentId: string) => {
    const receipt = window.prompt("Verify the OddJobs fee receipt reference reported by the hirer.")?.trim() ?? ""
    if (receipt.length < 3) return
    setBusyId(paymentId); setError("")
    try { await auth.recordAdminPlatformFeeReceipt(paymentId, receipt); load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not verify the platform fee receipt.") }
    finally { setBusyId("") }
  }
  const toggleHold = async (providerId: string, held: boolean) => {
    const reason = held ? (window.prompt("Why are you placing this worker's payout on hold? (minimum 10 characters)")?.trim() ?? "") : ""
    if (held && reason.length < 10) return
    setBusyId(providerId); setError("")
    try { await auth.setAdminProviderPayoutHold(providerId, held, reason); load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update payout hold.") }
    finally { setBusyId("") }
  }
  const toggleHirerRestriction = async (payment: JobPaymentRecord) => {
    const restricted = !payment.customerCommissionRestricted
    const reason = window.prompt(restricted ? "Reason for restricting new hirings (at least 10 characters):" : "Reason for releasing the hiring restriction (at least 10 characters):")?.trim() ?? ""
    if (reason.length < 10) { setError("Enter a reason of at least 10 characters."); return }
    setBusyId(payment.customerId); setError("")
    try { await auth.setAdminCommissionRestriction(payment.customerId, restricted, reason); load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update the hiring restriction.") }
    finally { setBusyId("") }
  }
  return <div className="content console-content">
    <PageHeader title="Payments and worker earnings" description="Search by job ID, worker, hirer, or payment reference. Financial figures include confirmed payments only." action={<Button variant="secondary" onClick={load}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {page && <div className="metrics"><Metric label="Confirmed gross payments" value={money(page.summary.paidGrossMinor)} /><Metric label="OddJobs fees on paid jobs" value={money(page.summary.commissionMinor)} /><Metric label="Worker earnings" value={money(page.summary.providerNetMinor)} /><Metric label="Fees due from hirers" value={money(page.summary.commissionDueMinor)} /><Metric label="Disputed payments" value={String(page.summary.disputedCount)} /></div>}
    <section className="card table-card"><div className="filters"><label>Search<input value={search} onChange={(event) => { setSearch(event.target.value); setOffset(0) }} placeholder="Job ID, payment ID, worker, hirer" /></label><label>Status<select value={status} onChange={(event) => { setStatus(event.target.value as JobPaymentStatus | "all"); setOffset(0) }}><option value="all">All statuses</option><option value="awaiting_payment">Awaiting payment</option><option value="reported">Reported</option><option value="paid">Paid</option><option value="disputed">Disputed</option><option value="refunded">Refunded</option></select></label></div>
      {loading ? <p role="status">Loading payments…</p> : page?.items.length ? <div className="table-wrap"><table><thead><tr><th>#</th><th>Job / payment</th><th>Worker</th><th>Hirer</th><th>Agreed</th><th>OddJobs fee</th><th>Worker share</th><th>Worker payment</th><th>Fee reconciliation</th></tr></thead><tbody>{page.items.map((payment, index) => <tr key={payment.id}><td>{offset + index + 1}</td><td><strong>{payment.jobReference}</strong><small className="caption">{payment.jobTitle}</small><small className="caption">{payment.paymentReference}</small></td><td>{payment.providerName}</td><td>{payment.customerName}</td><td>{money(payment.grossAmountMinor)}</td><td>{money(payment.commissionAmountMinor)} <small className="caption">({(payment.commissionBasisPoints / 100).toFixed(1)}%)</small></td><td>{money(payment.providerAmountMinor)}</td><td>{payment.method?.replace("_", " ") ?? "—"}<small className="caption">{payment.status.replaceAll("_", " ")}</small></td><td><Badge tone={payment.platformFeeStatus === "received" ? "green" : payment.platformFeeStatus === "disputed" ? "red" : "amber"}>{payment.platformFeeStatus.replaceAll("_", " ")}</Badge>{payment.commissionOverdue && <small className="caption">OVERDUE</small>}{payment.platformFeeStatus === "due" && payment.platformFeeDueAt && <small className="caption">Due {new Date(payment.platformFeeDueAt).toLocaleString()} {Date.now() > new Date(payment.platformFeeDueAt).getTime() ? "· OVERDUE" : ""}</small>}{payment.platformFeeStatus === "reported" && <div className="card-actions"><Button variant="secondary" disabled={busyId === payment.id} onClick={() => void markCommission(payment.id)}>Verify fee receipt</Button></div>}{payment.platformFeePaymentReference && <small className="caption">Hirer reference: {payment.platformFeePaymentReference}</small>}{payment.platformFeeReceiptReference && <small className="caption">Verified receipt: {payment.platformFeeReceiptReference}</small>}{(payment.commissionOverdue || payment.customerCommissionRestricted) && <div className="card-actions">{payment.customerCommissionRestricted && <Badge tone="amber">Hiring restricted</Badge>}<Button variant="secondary" disabled={busyId === payment.customerId} onClick={() => void toggleHirerRestriction(payment)}>{payment.customerCommissionRestricted ? "Release restriction" : "Restrict new hiring"}</Button></div>}</td></tr>)}</tbody></table></div> : !error && <EmptyState title="No payment records" detail="Accepted bids create payment agreements. Confirmed payments and disputes will appear here." />}
      <div className="card-actions"><Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</Button><span>{page?.total ? `${offset + 1}–${Math.min(offset + page.items.length, page.total)} of ${page.total}` : "0 payments"}</span><Button variant="secondary" disabled={loading || !page || offset + pageSize >= page.total} onClick={() => setOffset((value) => value + pageSize)}>Next</Button></div>
    </section>
    <section className="card table-card"><h2>Lifetime earnings by worker</h2>{page?.workers.length ? <div className="table-wrap"><table><thead><tr><th>#</th><th>Worker</th><th>Paid jobs</th><th>Agreed job totals</th><th>OddJobs fee share</th><th>Worker earnings</th><th>Worker payout hold</th></tr></thead><tbody>{page.workers.map((worker, index) => <tr key={worker.providerId}><td>{index + 1}</td><td>{worker.providerName}</td><td>{worker.paidJobs}</td><td>{money(worker.grossMinor)}</td><td>{money(worker.commissionMinor)}</td><td>{money(worker.netMinor)}</td><td>{worker.payoutHeld ? <><Badge tone="amber">Held</Badge> <Button variant="secondary" disabled={busyId === worker.providerId} onClick={() => void toggleHold(worker.providerId, false)}>Release hold</Button></> : <Button variant="secondary" disabled={busyId === worker.providerId} onClick={() => void toggleHold(worker.providerId, true)}>Place hold</Button>}</td></tr>)}</tbody></table></div> : <p className="caption">Worker totals appear after the first confirmed payment.</p>}</section>
    <p className="caption">Workers confirm their 90% share. Hirers report the separate 10% OddJobs fee and its receipt reference; admins verify that report here. Payment and payout rails are not integrated yet.</p>
  </div>
}

function Config() {
  const { getAdminSettings, saveAdminSettings } = useAuth()
  const [settings, setSettings] = useState<AdminSystemSettings | null>(null)
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
      })
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : "Could not load settings."),
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
        Provider-application and ad-submission switches are API-enforced. Commission settings are managed on Categories & fees and captured when a quote is accepted. Payments are recorded and reconciled manually; payment transfers are not integrated.
      </DemoNotice>
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
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load monitoring data."))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [getAdminMonitoring, getAdminMonitoringHistory, getAdminAlerts])
  useEffect(() => {
    const timer = window.setInterval(() => load(), 60_000)
    return () => window.clearInterval(timer)
  }, [getAdminMonitoring, getAdminMonitoringHistory, getAdminAlerts])
  const takeAlertAction = async (id: string, action: "acknowledge" | "assign" | "resolve") => {
    const reason = action === "resolve" ? window.prompt("Why is this alert resolved? Add a short note for the audit trail.")?.trim() ?? "" : undefined
    if (action === "resolve" && (reason?.length ?? 0) < 5) { setError("Add a resolution note of at least five characters."); return }
    setError("")
    try { await updateAdminAlert(id, action, reason); load() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update this alert.") }
  }
  const money = (minor: number) => new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(minor / 100)
  return <div className="content console-content admin-monitoring">
    <PageHeader title="System monitoring" description="Live API health and operational queues that need attention." action={<Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button>} />
    <p className="monitoring-live-status"><i /> Checks run automatically every minute while the API is running{lastUpdated ? " | Updated " + lastUpdated.toLocaleTimeString() : ""}{loading ? " | Refreshing..." : ""}</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && !snapshot ? <p role="status">Checking API and marketplace health...</p> : snapshot && <>
      <section className="metrics monitoring-metrics">
        <Metric label="API" value="Online" />
        <Metric label="Database" value={snapshot.database === "ok" ? "Connected" : "Unavailable"} />
        <Metric label="Database check" value={snapshot.database === "ok" ? snapshot.databaseLatencyMs + " ms" : "Failed"} />
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
        {alerts.filter((item) => item.status !== "resolved").length ? <div className="monitoring-alert-list">{alerts.filter((item) => item.status !== "resolved").map((alert, index) => <article className="monitoring-alert" key={alert.id}><span className={alert.severity === "critical" ? "critical" : "warning"}>{alert.severity}</span><strong>{alert.message}</strong><small>#{index + 1} · {alert.code.replaceAll("_", " ")} · First seen {new Date(alert.firstSeenAt).toLocaleString()} · Last seen {new Date(alert.lastSeenAt).toLocaleString()}</small><small>Status: {alert.status}{alert.assignedAdminName ? ` · Assigned to ${alert.assignedAdminName}` : " · Unassigned"}</small><div className="card-actions">{alert.status === "open" && <Button variant="secondary" onClick={() => void takeAlertAction(alert.id, "acknowledge")}>Acknowledge</Button>}<Button variant="secondary" onClick={() => void takeAlertAction(alert.id, "assign")}>Assign to me</Button><Button variant="secondary" onClick={() => void takeAlertAction(alert.id, "resolve")}>Resolve</Button></div></article>)}</div> : <p className="monitoring-clear"><i /> No active alerts. Current checks are healthy.</p>}
      </section>
      <section className="card monitoring-health-target"><div><h2>External uptime check</h2><p>Point your uptime monitor at the deployed API’s <code>/health/ready</code> endpoint. It reports process and database readiness independently of this admin session.</p></div><Badge tone="green">Ready endpoint available</Badge></section>
      <section className="card monitoring-history">
        <div className="section-title"><div><h2>Recent health checks</h2><p className="caption">Automated history, newest first. Up to 50 checks shown.</p></div><span>{history.length} checks</span></div>
        {history.length ? <div className="table-wrap"><table className="monitoring-table"><thead><tr><th>#</th><th>Checked</th><th>Database</th><th>Provider IDs</th><th>Reports</th><th>Heap</th><th>Alerts</th></tr></thead><tbody>{history.map((item, index) => <tr key={item.checkedAt}><td>{index + 1}</td><td>{new Date(item.checkedAt).toLocaleString()}</td><td><Badge tone={item.database === "ok" ? "green" : "red"}>{item.database}</Badge></td><td>{item.pendingVerifications}</td><td>{item.openReports}</td><td>{Math.round(item.heapUsedBytes / item.heapLimitBytes * 100)}%</td><td>{item.alerts.length ? <Badge tone="amber">{item.alerts.length}</Badge> : <span className="caption">Clear</span>}</td></tr>)}</tbody></table></div> : <p className="monitoring-clear">The first scheduled check is being recorded.</p>}
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
      {groups.map((group) => <div className="analytics-bar-group" key={group.from} title={group.from + (group.to !== group.from ? " to " + group.to : "") + ": " + group.posted + " posted, " + group.hired + " hired, " + group.completed + " completed"}>
        <span className="analytics-bar posted" style={{ height: Math.max(group.posted ? 3 : 0, group.posted / max * 100) + "%" }} />
        <span className="analytics-bar hired" style={{ height: Math.max(group.hired ? 3 : 0, group.hired / max * 100) + "%" }} />
        <span className="analytics-bar completed" style={{ height: Math.max(group.completed ? 3 : 0, group.completed / max * 100) + "%" }} />
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
      setError(caught instanceof Error ? caught.message : "Could not load analytics.")
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
  const percentChange = (value: number, prior: number) => prior ? `${value >= prior ? "+" : ""}${Math.round(((value - prior) / prior) * 100)}% vs previous period` : "No previous-period baseline"
  const setRange = (days: number) => {
    const nextFrom = nairobiDate(-(days - 1))
    const nextTo = nairobiDate()
    setFrom(nextFrom)
    setTo(nextTo)
    loadReport({ from: nextFrom, to: nextTo, category, status })
  }
  return <div className="content console-content admin-analytics">
    <PageHeader eyebrow="Marketplace performance" title="Analytics" description="Track marketplace activity, agreed job value, and commission reconciliation." action={<Button variant="secondary" onClick={() => loadReport()} disabled={loading}>Refresh</Button>} />
    <p className="analytics-live-status" aria-live="polite"><i /> {report ? "Live marketplace data" : "Connecting to marketplace data"}{lastUpdated ? " | Updated " + lastUpdated.toLocaleTimeString() : ""}{loading ? " | Refreshing..." : ""}</p>
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
    {loading && !report ? <p role="status">Loading analytics…</p> : report && <>
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
        {report.jobs.length ? <div className="table-wrap"><table className="analytics-table"><thead><tr><th>#</th><th>Job</th><th>Category</th><th>Proposals</th><th>Status</th><th>Posted</th></tr></thead><tbody>{report.jobs.map((job, index) => <tr key={job.reference}><td>{index + 1}</td><td><strong>{job.reference}</strong><small className="caption">{job.title}</small></td><td>{job.category}</td><td>{job.proposals}</td><td><Badge tone={job.status === "completed" ? "green" : job.status === "disputed" ? "red" : "amber"}>{job.status.replaceAll("_", " ")}</Badge></td><td>{new Date(job.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">No jobs match this period and filter.</p>}
      </section>
      <section className="card analytics-section">
        <div className="analytics-section-heading"><div><h2>Commission pipeline</h2><p>Current fee status for payment agreements attached to jobs posted in this period.</p></div><span>{report.commissions.length.toLocaleString()} shown</span></div>
        {report.commissions.length ? <div className="table-wrap"><table className="analytics-table"><thead><tr><th>#</th><th>Job</th><th>Hirer</th><th>Worker</th><th>Fee</th><th>Status</th><th>Due</th></tr></thead><tbody>{report.commissions.map((item, index) => <tr key={item.reference}><td>{index + 1}</td><td><strong>{item.reference}</strong><small className="caption">{item.title}</small></td><td>{item.customer}</td><td>{item.provider}</td><td>{money(item.feeMinor)}</td><td><Badge tone={item.status === "received" ? "green" : item.status === "disputed" ? "red" : "amber"}>{item.status}</Badge></td><td>{item.dueAt ? new Date(item.dueAt).toLocaleDateString() : "—"}</td></tr>)}</tbody></table></div> : <p className="analytics-empty">No payment agreements were created in this period.</p>}
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

