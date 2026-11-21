import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth, type AdminServiceListingMessage, type ServiceListing, type ServiceListingMessage } from "../../auth/AuthProvider"
import { Badge, Button, EmptyState, PageHeader } from "../../shared/components/WorkspaceUi"

type MessageRole = "consumer" | "provider"

export function ServiceMessages({ role }: { role: MessageRole }) {
  const auth = useAuth()
  const [listings, setListings] = useState<ServiceListing[]>([])
  const [activeId, setActiveId] = useState("")
  const [messages, setMessages] = useState<ServiceListingMessage[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const active = listings.find((listing) => listing.id === activeId) ?? null
  const counterpart = active ? role === "consumer" ? active.providerName : active.customerName ?? "Customer" : ""

  const loadThreads = useCallback(async () => {
    setError("")
    try {
      const result = await auth.getServiceListings(role, "mine")
      const threads = result.filter((item) => item.status !== "open" && item.status !== "cancelled")
      setListings(threads)
      setActiveId((current) => threads.some((item) => item.id === current) ? current : threads[0]?.id ?? "")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your job conversations.")
    } finally {
      setLoading(false)
    }
  }, [auth.getServiceListings, role])

  const loadMessages = useCallback(async () => {
    if (!activeId) { setMessages([]); return }
    try {
      setMessages(await auth.getServiceListingMessages(activeId, role))
      setError("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load messages for this job.")
    }
  }, [activeId, auth.getServiceListingMessages, role])

  useEffect(() => {
    void loadThreads()
    const timer = window.setInterval(() => void loadThreads(), 30000)
    return () => window.clearInterval(timer)
  }, [loadThreads])
  useEffect(() => {
    void loadMessages()
    if (!activeId) return
    const timer = window.setInterval(() => void loadMessages(), 10000)
    return () => window.clearInterval(timer)
  }, [activeId, loadMessages])

  const send = async () => {
    const body = draft.trim()
    if (!body || !active || sending) return
    setSending(true)
    setError("")
    try {
      const sent = await auth.sendServiceListingMessage(active.id, role, body)
      setMessages((current) => [...current, sent])
      setDraft("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send your message.")
    } finally {
      setSending(false)
    }
  }

  return <div className="content narrow">
    <PageHeader title="Job messages" description={role === "provider" ? "Talk with customers about your active work and bookings." : "Talk with workers about your active jobs and bookings."} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading ? <p role="status">Loading your conversations…</p> : listings.length === 0 ? <EmptyState title="No job conversations yet" detail={role === "provider" ? "Conversations for your active bookings will appear here." : "Conversations for your active jobs will appear here."} /> : <div className="service-message-layout">
      <nav className="card service-message-threads" aria-label="Job conversations">
        <h2>Your jobs</h2>
        {listings.map((item) => <button type="button" className={item.id === activeId ? "service-message-thread active" : "service-message-thread"} key={item.id} onClick={() => setActiveId(item.id)}><strong>{item.title}</strong><span>{role === "consumer" ? item.providerName : item.customerName ?? "Customer"}</span><Badge>{item.status.replace(/_/g, " ")}</Badge></button>)}
      </nav>
      {active && <section className="card service-message-panel">
        <header className="service-message-header"><div><strong>{counterpart}</strong><span>{active.title}</span></div><span>{active.status.replace(/_/g, " ")}</span></header>
        <div className="messages service-message-list" aria-live="polite">{messages.length ? messages.map((message) => <article className={message.senderId === auth.profile?.id ? "outgoing" : "incoming"} key={message.id}><strong>{message.senderId === auth.profile?.id ? "You" : message.senderName}</strong><p>{message.body}</p><small>{new Date(message.createdAt).toLocaleString()}</small></article>) : <p className="service-message-empty">No messages yet. Start the conversation.</p>}</div>
        <form className="reply-box" onSubmit={(event) => { event.preventDefault(); void send() }}><input aria-label="Message text" maxLength={5000} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Write a message…" /><Button disabled={!draft.trim() || sending}>{sending ? "Sending…" : "Send"}</Button></form>
      </section>}
    </div>}
  </div>
}

export function AdminMessages() {
  const auth = useAuth()
  const [items, setItems] = useState<AdminServiceListingMessage[]>([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const limit = 50
  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset])
  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await auth.getAdminServiceListingMessages(limit, offset)
      setItems(result.items)
      setTotal(result.total)
    } catch (caught) {
      setItems([])
      setError(caught instanceof Error ? caught.message : "Could not load the admin message inbox.")
    } finally { setLoading(false) }
  }, [auth.getAdminServiceListingMessages, offset])
  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 15000)
    return () => window.clearInterval(timer)
  }, [refresh])
  return <div className="content console-content">
    <PageHeader title="Marketplace messages" description="Review messages exchanged on claimed marketplace jobs." action={<Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="card admin-message-inbox">
      {loading ? <p role="status">Loading messages…</p> : items.length === 0 ? <EmptyState title="No messages found" detail="Messages will appear here when customers and providers contact each other about claimed jobs." /> : <div className="table-wrap"><table><thead><tr><th>Job</th><th>Participants</th><th>Message</th><th>Sent</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.listingTitle}</td><td>{item.customerName} ↔ {item.providerName}<br /><small>Sent by {item.senderName}</small></td><td className="admin-message-body">{item.body}</td><td>{new Date(item.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
      <div className="card-actions"><span>{total ? `Page ${page} · ${total} messages` : "0 messages"}</span><Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - limit))}>Previous</Button><Button variant="secondary" disabled={loading || offset + limit >= total} onClick={() => setOffset((value) => value + limit)}>Next</Button></div>
    </section>
  </div>
}
