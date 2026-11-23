import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth, type AdminServiceListingMessage, type MarketplaceConversation, type MarketplaceConversationMessage, type ServiceListing, type ServiceListingMessage } from "../../auth/AuthProvider"
import { useDemoStore } from "../../demo/context"
import { Badge, Button, EmptyState, PageHeader } from "../../shared/components/WorkspaceUi"

type MessageRole = "consumer" | "provider"
type MessageModalTarget = { kind: "marketplace" | "legacy"; id: string } | null
type InboxRow = { id: string; kind: "marketplace" | "legacy"; jobId: string; jobReference: string; title: string; person: string; status: string; latest: string; updatedAt: string; unread: number }

export function ServiceMessages({ role }: { role: MessageRole }) {
  const auth = useAuth()
  const { store, updateStore } = useDemoStore()
  const [conversations, setConversations] = useState<MarketplaceConversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState(store.selectedMarketplaceConversationId)
  const [jobMessages, setJobMessages] = useState<MarketplaceConversationMessage[]>([])
  const [jobDraft, setJobDraft] = useState("")
  const [jobSending, setJobSending] = useState(false)
  const [modalTarget, setModalTarget] = useState<MessageModalTarget>(null)
  const [listings, setListings] = useState<ServiceListing[]>([])
  const [marketplaceLoading, setMarketplaceLoading] = useState(true)
  const [activeId, setActiveId] = useState("")
  const [messages, setMessages] = useState<ServiceListingMessage[]>([])
  const [draft, setDraft] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [jobSearch, setJobSearch] = useState("")
  const active = listings.find((listing) => listing.id === activeId) ?? null
  const counterpart = active ? role === "consumer" ? active.providerName : active.customerName ?? "Customer" : ""
  const activeConversation = conversations.find((item) => item.id === activeConversationId) ?? null
  const modalConversation = modalTarget?.kind === "marketplace" ? conversations.find((item) => item.id === modalTarget.id) ?? null : null

  const loadConversations = useCallback(async () => {
    try {
      const result = await auth.getMarketplaceConversations(role)
      setConversations(result)
      setError("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load job conversations.")
    } finally {
      setMarketplaceLoading(false)
    }
  }, [auth.getMarketplaceConversations, role])

  const loadJobMessages = useCallback(async () => {
    if (!activeConversationId) { setJobMessages([]); return }
    try {
      setJobMessages(await auth.getMarketplaceConversationMessages(activeConversationId))
      setConversations((current) => current.map((item) => item.id === activeConversationId ? { ...item, unreadCount: 0 } : item))
      setError("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load messages for this job.")
    }
  }, [activeConversationId, auth.getMarketplaceConversationMessages])

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
    void loadConversations()
    const timer = window.setInterval(() => void loadConversations(), 15000)
    return () => window.clearInterval(timer)
  }, [loadConversations])

  useEffect(() => {
    if (modalTarget?.kind !== "marketplace") return
    void loadJobMessages()
    const timer = window.setInterval(() => void loadJobMessages(), 7000)
    return () => window.clearInterval(timer)
  }, [modalTarget, loadJobMessages])

  useEffect(() => {
    if (modalTarget?.kind !== "legacy") return
    void loadMessages()
    const timer = window.setInterval(() => void loadMessages(), 10000)
    return () => window.clearInterval(timer)
  }, [modalTarget, loadMessages])

  useEffect(() => {
    if (!modalTarget && store.selectedMarketplaceConversationId && conversations.some((item) => item.id === store.selectedMarketplaceConversationId)) {
      const item = conversations.find((conversation) => conversation.id === store.selectedMarketplaceConversationId)
      if (item) {
        setActiveConversationId(item.id)
        setModalTarget({ kind: "marketplace", id: item.id })
      }
    }
  }, [conversations, modalTarget, store.selectedMarketplaceConversationId])

  useEffect(() => {
    if (!modalTarget) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setModalTarget(null)
        updateStore({ selectedMarketplaceConversationId: "" })
      }
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [modalTarget, updateStore])

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

  const sendJobMessage = async () => {
    const body = jobDraft.trim()
    if (!body || !activeConversation || jobSending) return
    setJobSending(true)
    setError("")
    try {
      const sent = await auth.sendMarketplaceConversationMessage(activeConversation.id, body)
      setJobMessages((current) => [...current, sent])
      setJobDraft("")
      await loadConversations()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not send your message.")
    } finally {
      setJobSending(false)
    }
  }

  const inboxRows: InboxRow[] = [
    ...conversations.map((item) => ({ id: item.id, kind: "marketplace" as const, jobId: item.jobId, jobReference: item.jobReference, title: item.jobTitle, person: role === "consumer" ? item.providerName : item.customerName, status: item.jobStatus, latest: item.latestMessage ?? "Start the conversation.", updatedAt: item.latestMessageAt ?? item.updatedAt, unread: item.unreadCount })),
    ...listings.map((item) => ({ id: item.id, kind: "legacy" as const, jobId: item.id, jobReference: item.jobReference, title: item.title, person: role === "consumer" ? item.providerName : item.customerName ?? "Customer", status: item.status, latest: "Open to view booking messages.", updatedAt: item.updatedAt, unread: 0 })),
  ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const normalizedJobSearch = jobSearch.trim().toLocaleLowerCase()
  const visibleInboxRows = inboxRows.filter((item) => !normalizedJobSearch || [item.jobReference, item.title, item.person].some((value) => value.toLocaleLowerCase().includes(normalizedJobSearch)))

  return <div className="content narrow">
    <PageHeader title="Job messages" description={role === "provider" ? "Talk with customers about your active work and bookings." : "Talk with workers about your active jobs and bookings."} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="card marketplace-message-inbox">
      <div className="section-heading"><div><h2>All job conversations</h2><p>Marketplace jobs and existing bookings, in one inbox.</p></div><Badge>{inboxRows.length}</Badge></div>
      <label className="provider-proposal-search"><span>Search by Job ID, title, or worker</span><input value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} placeholder="For example, OJ-0000000042" /></label>
      {loading || marketplaceLoading ? <p role="status">Loading conversations…</p> : inboxRows.length === 0 ? <EmptyState title="No conversations yet" detail={role === "consumer" ? "Messages from workers and booked service providers will appear here." : "Message a job poster or open a booking to start a conversation."} /> : visibleInboxRows.length === 0 ? <EmptyState title="No matching conversations" detail="Try a different Job ID, job title, or worker name." /> : <div className="table-wrap"><table>
        <thead><tr><th>No.</th><th>Job</th><th>{role === "consumer" ? "Worker" : "Customer"}</th><th>Latest message</th><th>Updated</th><th>Status</th><th></th></tr></thead>
        <tbody>{visibleInboxRows.map((item, index) => <tr key={`${item.kind}-${item.id}`}>
          <td>{index + 1}</td><td><strong>{item.title}</strong><br /><small>Job ID {item.jobReference}</small></td>
          <td>{item.person}<br /><small>{role === "consumer" ? "Worker" : "Job poster"}</small></td>
          <td className="proposal-message-cell">{item.latest}{item.unread > 0 && <><br /><Badge tone="amber">{item.unread} unread</Badge></>}</td>
          <td>{new Date(item.updatedAt).toLocaleString()}</td><td><Badge>{item.status.replace(/_/g, " ")}</Badge></td>
          <td><Button variant="secondary" onClick={() => { setModalTarget({ kind: item.kind, id: item.id }); if (item.kind === "marketplace") { setActiveConversationId(item.id); updateStore({ selectedMarketplaceConversationId: item.id, selectedJobId: item.jobId }) } else { setActiveId(item.id); updateStore({ selectedMarketplaceConversationId: "", selectedJobId: item.jobId }) } }}>Open</Button></td>
        </tr>)}</tbody>
      </table></div>}
    </section>
    {modalTarget && (modalTarget.kind === "marketplace" ? modalConversation : active) && <div className="notification-modal-backdrop conversation-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setModalTarget(null); updateStore({ selectedMarketplaceConversationId: "" }) } }}>
      <section className="notification-modal conversation-modal" role="dialog" aria-modal="true" aria-labelledby="conversation-modal-title">
        <header className="conversation-modal-header"><div><h2 id="conversation-modal-title">{modalTarget.kind === "marketplace" ? modalConversation?.jobTitle : active?.title}</h2><p>{modalTarget.kind === "marketplace" ? `${role === "consumer" ? modalConversation?.providerName : modalConversation?.customerName} · Job ID ${modalConversation?.jobReference}` : `${counterpart} · Job ID ${active?.jobReference}`}</p></div><Button variant="ghost" onClick={() => { setModalTarget(null); updateStore({ selectedMarketplaceConversationId: "" }) }}>Close</Button></header>
        <div className="messages service-message-list conversation-modal-messages" aria-live="polite">{modalTarget.kind === "marketplace" ? jobMessages.length ? jobMessages.map((item) => <article className={item.senderId === auth.profile?.id ? "outgoing" : "incoming"} key={item.id}><strong>{item.senderName} <small>({item.senderRole === "provider" ? "Worker" : "Job poster"})</small></strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></article>) : <p className="service-message-empty">No messages yet. Start the conversation.</p> : messages.length ? messages.map((item) => <article className={item.senderId === auth.profile?.id ? "outgoing" : "incoming"} key={item.id}><strong>{item.senderId === auth.profile?.id ? "You" : item.senderName}</strong><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()}</small></article>) : <p className="service-message-empty">No messages yet. Start the conversation.</p>}</div>
        <form className="reply-box" onSubmit={(event) => { event.preventDefault(); void (modalTarget.kind === "marketplace" ? sendJobMessage() : send()) }}><input aria-label="Message text" maxLength={5000} value={modalTarget.kind === "marketplace" ? jobDraft : draft} onChange={(event) => modalTarget.kind === "marketplace" ? setJobDraft(event.target.value) : setDraft(event.target.value)} placeholder="Write a message…" /><Button disabled={modalTarget.kind === "marketplace" ? !jobDraft.trim() || jobSending : !draft.trim() || sending}>{modalTarget.kind === "marketplace" ? jobSending ? "Sending…" : "Send" : sending ? "Sending…" : "Send"}</Button></form>
      </section>
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
  const [search, setSearch] = useState("")
  const limit = 50
  const page = useMemo(() => Math.floor(offset / limit) + 1, [offset])
  const refresh = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const result = await auth.getAdminServiceListingMessages(limit, offset, search)
      setItems(result.items)
      setTotal(result.total)
    } catch (caught) {
      setItems([])
      setError(caught instanceof Error ? caught.message : "Could not load the admin message inbox.")
    } finally { setLoading(false) }
  }, [auth.getAdminServiceListingMessages, offset, search])
  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 15000)
    return () => window.clearInterval(timer)
  }, [refresh])
  return <div className="content console-content">
    <PageHeader title="Marketplace messages" description="Review messages exchanged on claimed marketplace jobs." action={<Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="card admin-message-inbox">
      <label className="provider-proposal-search"><span>Search messages by Job ID</span><input value={search} onChange={(event) => { setOffset(0); setSearch(event.target.value) }} placeholder="For example, OJ-0000000042" /></label>
      {loading ? <p role="status">Loading messages…</p> : items.length === 0 ? <EmptyState title="No messages found" detail="Messages will appear here when customers and providers contact each other about claimed jobs." /> : <div className="table-wrap"><table><thead><tr><th>Job</th><th>Participants</th><th>Message</th><th>Sent</th></tr></thead><tbody>{items.map((item, index) => <tr key={item.id}><td>{offset + index + 1}. {item.listingTitle}<br /><small>Job ID {item.jobReference}</small></td><td>{item.customerName} ↔ {item.providerName}<br /><small>Sent by {item.senderName}</small></td><td className="admin-message-body">{item.body}</td><td>{new Date(item.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div>}
      <div className="card-actions"><span>{total ? `Page ${page} · ${total} messages` : "0 messages"}</span><Button variant="secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - limit))}>Previous</Button><Button variant="secondary" disabled={loading || offset + limit >= total} onClick={() => setOffset((value) => value + limit)}>Next</Button></div>
    </section>
  </div>
}
