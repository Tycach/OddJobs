import { useCallback, useEffect, useState, type FormEvent } from "react"
import { useAuth, type CreateSupportCaseInput, type SupportCase, type SupportCaseMessage, type SupportCaseStatus, type SupportCategory } from "../../auth/AuthProvider"
import { Badge, Button, EmptyState } from "../../shared/components/WorkspaceUi"

const categories: { value: SupportCategory; label: string }[] = [
  { value: "general", label: "General help" },
  { value: "payment", label: "Payment or commission" },
  { value: "work_review", label: "Work review" },
  { value: "safety", label: "Safety concern" },
  { value: "account", label: "Account or verification" },
  { value: "other", label: "Other" },
]

const statusLabel: Record<SupportCaseStatus, string> = {
  open: "Open", in_progress: "In progress", waiting_on_user: "Waiting on you", resolved: "Resolved",
}

function SupportConversation({
  supportCase, messages, currentUserId, draft, setDraft, onSend, onClose, sending,
  adminMode, onStatusChange,
}: {
  supportCase: SupportCase; messages: SupportCaseMessage[]; currentUserId?: string
  draft: string; setDraft: (value: string) => void; onSend: () => void; onClose: () => void; sending: boolean
  adminMode?: boolean; onStatusChange?: (status: SupportCaseStatus) => void
}) {
  return <div className="notification-modal-backdrop support-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="notification-modal conversation-modal support-case-dialog" role="dialog" aria-modal="true" aria-labelledby="support-dialog-title">
      <header className="conversation-modal-header"><div><span className="eyebrow">{supportCase.caseReference} · {supportCase.requesterRole === "provider" ? "Worker" : "Hirer"}</span><h2 id="support-dialog-title">{supportCase.subject}</h2><p>{supportCase.jobReference} · {supportCase.jobTitle} · {supportCase.category.replaceAll("_", " ")}</p></div><div className="support-modal-actions">{adminMode && onStatusChange && <label>Case status<select value={supportCase.status} disabled={sending} onChange={(event) => onStatusChange(event.target.value as SupportCaseStatus)}>{Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}<Button variant="ghost" onClick={onClose}>Close</Button></div></header>
      <div className="messages service-message-list conversation-modal-messages" aria-live="polite">
        {messages.length ? messages.map((message) => <article key={message.id} className={message.senderId === currentUserId ? "outgoing" : "incoming"}>
          <strong>{message.senderName} <small>({message.senderRole === "provider" ? "Worker" : message.senderRole === "consumer" ? "Hirer" : "OddJobs Support"})</small></strong>
          <p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString()}</small>
        </article>) : <p className="service-message-empty">Loading case messages…</p>}
      </div>
      {supportCase.status === "resolved" ? <p className="support-resolved-note">This case is resolved. Send a reply to reopen it.</p> : null}
      <form className="reply-box" onSubmit={(event) => { event.preventDefault(); onSend() }}>
        <input aria-label="Reply to support case" maxLength={5000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a reply…" />
        <Button disabled={!draft.trim() || sending}>{sending ? "Sending…" : "Send"}</Button>
      </form>
    </section>
  </div>
}

export function UserSupportInbox({ role }: { role: "consumer" | "provider" }) {
  const auth = useAuth()
  const [cases, setCases] = useState<SupportCase[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [messages, setMessages] = useState<SupportCaseMessage[]>([])
  const [jobReference, setJobReference] = useState("")
  const [category, setCategory] = useState<SupportCategory>("general")
  const [subject, setSubject] = useState("")
  const [body, setBody] = useState("")
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const selected = cases.find((item) => item.id === selectedId) ?? null

  const refresh = useCallback(async () => {
    try { setCases(await auth.getSupportCases(role)); setError("") }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load your support cases.") }
    finally { setLoading(false) }
  }, [auth.getSupportCases, role])

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 15000); return () => window.clearInterval(timer) }, [refresh])
  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    let active = true
    const load = async () => {
      try { const result = await auth.getSupportCaseMessages(role, selectedId); if (active) setMessages(result) }
      catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Could not load this support conversation.") }
    }
    void load(); const timer = window.setInterval(() => void load(), 7000)
    return () => { active = false; window.clearInterval(timer) }
  }, [auth.getSupportCaseMessages, role, selectedId])

  const createCase = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (sending) return
    setSending(true); setError("")
    const input: CreateSupportCaseInput = { jobReference, category, subject, body }
    try {
      const created = await auth.createSupportCase(role, input)
      setCases((current) => [created, ...current]); setSelectedId(created.id)
      setJobReference(""); setSubject(""); setBody(""); setCategory("general")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send your support request.") }
    finally { setSending(false) }
  }

  const reply = async () => {
    const text = draft.trim(); if (!text || !selected || sending) return
    setSending(true); setError("")
    try {
      const message = await auth.sendSupportCaseMessage(role, selected.id, text)
      setMessages((current) => [...current, message]); setDraft(""); await refresh()
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send your reply.") }
    finally { setSending(false) }
  }

  return <section className="card support-user-inbox">
    <div className="section-heading"><div><span className="eyebrow">Private OddJobs help</span><h2>Support cases</h2><p>Contact the admin team about a specific job. This conversation is separate from your worker or hirer chat.</p></div><Badge>{cases.length}</Badge></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <form className="support-new-case" onSubmit={(event) => void createCase(event)}>
      <h3>Open a support case</h3>
      <div className="support-new-case-fields">
        <label>Job ID<input required value={jobReference} onChange={(event) => setJobReference(event.target.value.toUpperCase())} placeholder="Paste the Job ID from job details" maxLength={27} /></label>
        <label>Issue type<select value={category} onChange={(event) => setCategory(event.target.value as SupportCategory)}>{categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label className="support-subject-field">Subject<input required minLength={4} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Briefly describe what you need help with" /></label>
        <label className="support-message-field">Message<textarea required minLength={10} maxLength={5000} rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Include the relevant details so our team can help." /></label>
      </div>
      <div className="support-form-footer"><small>Submitting as <strong>{role === "provider" ? "Worker" : "Hirer"}</strong>. You must be a participant on this job.</small><Button disabled={sending || !jobReference.trim() || subject.trim().length < 4 || body.trim().length < 10}>{sending ? "Sending…" : "Send to Support"}</Button></div>
    </form>
    <div className="support-case-list-heading"><h3>Your cases</h3><Button variant="secondary" onClick={() => void refresh()}>Refresh</Button></div>
    {loading ? <p role="status">Loading support cases…</p> : cases.length ? <div className="table-wrap support-case-table-wrap"><table><thead><tr><th>Case</th><th>Job</th><th>Issue</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>{cases.map((item, index) => <tr key={item.id}>
      <td>{index + 1}. <strong>{item.caseReference}</strong><small className="caption">{item.requesterRole === "provider" ? "Worker" : "Hirer"}</small></td>
      <td><strong>{item.jobReference}</strong><small className="caption">{item.jobTitle}</small></td>
      <td><strong>{item.subject}</strong><small className="caption">{item.category.replaceAll("_", " ")}</small></td>
      <td><Badge tone={item.status === "resolved" ? "green" : item.status === "waiting_on_user" ? "amber" : "slate"}>{statusLabel[item.status]}</Badge></td>
      <td>{new Date(item.updatedAt).toLocaleString()}</td><td><Button variant="secondary" onClick={() => setSelectedId(item.id)}>Open</Button></td>
    </tr>)}</tbody></table></div> : <EmptyState title="No support cases" detail="Open a case above and it will appear here with replies from OddJobs Support." />}
    {selected && <SupportConversation supportCase={selected} messages={messages} currentUserId={auth.profile?.id} draft={draft} setDraft={setDraft} onSend={() => void reply()} onClose={() => setSelectedId("")} sending={sending} />}
  </section>
}

export function AdminSupportInbox() {
  const auth = useAuth()
  const [items, setItems] = useState<SupportCase[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<SupportCaseStatus | "all">("all")
  const [selectedId, setSelectedId] = useState("")
  const [messages, setMessages] = useState<SupportCaseMessage[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const limit = 25
  const selected = items.find((item) => item.id === selectedId) ?? null

  const refresh = useCallback(async () => {
    try {
      const page = await auth.getAdminSupportCases(search, status, limit, offset)
      setItems(page.items); setTotal(page.total); setError("")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load Support cases.") }
    finally { setLoading(false) }
  }, [auth.getAdminSupportCases, offset, search, status])

  useEffect(() => { void refresh(); const timer = window.setInterval(() => void refresh(), 15000); return () => window.clearInterval(timer) }, [refresh])
  useEffect(() => {
    if (!selectedId) { setMessages([]); return }
    let active = true
    const load = async () => {
      try { const result = await auth.getAdminSupportCaseMessages(selectedId); if (active) setMessages(result) }
      catch (caught) { if (active) setError(caught instanceof Error ? caught.message : "Could not load case messages.") }
    }
    void load(); const timer = window.setInterval(() => void load(), 7000)
    return () => { active = false; window.clearInterval(timer) }
  }, [auth.getAdminSupportCaseMessages, selectedId])

  const reply = async () => {
    const text = draft.trim(); if (!text || !selected || sending) return
    setSending(true); setError("")
    try { const message = await auth.sendAdminSupportMessage(selected.id, text); setMessages((current) => [...current, message]); setDraft(""); await refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send your reply.") }
    finally { setSending(false) }
  }

  const updateStatus = async (next: SupportCaseStatus) => {
    if (!selected) return
    setSending(true); setError("")
    try { const updated = await auth.updateAdminSupportCaseStatus(selected.id, next); setItems((current) => current.map((item) => item.id === updated.id ? updated : item)) }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update case status.") }
    finally { setSending(false) }
  }

  return <section className="card admin-support-inbox">
    <div className="section-heading"><div><span className="eyebrow">Admin queue</span><h2>Support inbox</h2><p>Cases from hirers and workers, tied to their Job ID.</p></div><Badge>{total}</Badge></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="support-admin-filters"><label>Search cases<input value={search} onChange={(event) => { setOffset(0); setSearch(event.target.value) }} placeholder="Case ID, Job ID, sender, or subject" /></label><label>Status<select value={status} onChange={(event) => { setOffset(0); setStatus(event.target.value as SupportCaseStatus | "all") }}><option value="all">All cases</option><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_on_user">Waiting on hirer / worker</option><option value="resolved">Resolved</option></select></label></div>
    {loading ? <p role="status">Loading Support cases…</p> : items.length ? <div className="table-wrap support-case-table-wrap"><table><thead><tr><th>#</th><th>Job</th><th>From</th><th>Case</th><th>Status</th><th>Updated</th><th></th></tr></thead><tbody>{items.map((item, index) => <tr key={item.id}>
      <td>{offset + index + 1}</td><td><strong>{item.jobReference}</strong><small className="caption">{item.jobTitle}</small></td>
      <td><strong>{item.requesterName}</strong><small className="caption">{item.requesterRole === "provider" ? "Worker" : "Hirer"}</small></td>
      <td><strong>{item.subject}</strong><small className="caption">{item.caseReference} · {item.category.replaceAll("_", " ")}</small></td>
      <td><Badge tone={item.status === "resolved" ? "green" : item.status === "waiting_on_user" ? "amber" : "slate"}>{statusLabel[item.status]}</Badge></td>
      <td>{new Date(item.updatedAt).toLocaleString()}</td><td><Button variant="secondary" onClick={() => setSelectedId(item.id)}>Review</Button></td>
    </tr>)}</tbody></table></div> : <EmptyState title="No support cases" detail="New job-linked messages from hirers and workers will appear here." />}
    <div className="card-actions"><span>{total ? `${offset + 1}–${Math.min(offset + items.length, total)} of ${total}` : "0 cases"}</span><Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((current) => Math.max(0, current - limit))}>Previous</Button><Button variant="secondary" disabled={loading || offset + limit >= total} onClick={() => setOffset((current) => current + limit)}>Next</Button></div>
    {selected && <SupportConversation supportCase={selected} messages={messages} currentUserId={auth.profile?.id} draft={draft} setDraft={setDraft} onSend={() => void reply()} onClose={() => setSelectedId("")} sending={sending} adminMode onStatusChange={(next) => void updateStatus(next)} />}
  </section>
}
