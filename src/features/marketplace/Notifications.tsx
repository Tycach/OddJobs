import { useCallback, useEffect, useState } from "react"
import { useAuth, type MarketplaceNotification } from "../../auth/AuthProvider"
import { Button } from "../../shared/components/WorkspaceUi"

export default function Notifications({ onOpenJob, role = "consumer" }: { onOpenJob: (jobId: string, type: string) => void; role?: "consumer" | "provider" }) {
  const auth = useAuth()
  const { getMarketplaceNotifications, markMarketplaceNotificationRead } = auth
  const [items, setItems] = useState<MarketplaceNotification[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selected, setSelected] = useState<MarketplaceNotification | null>(null)
  const [busyId, setBusyId] = useState("")

  const refresh = useCallback(async (append = false) => {
    setError("")
    try {
      const offset = append ? items.length : 0
      const page = await getMarketplaceNotifications(50, offset)
      setItems((current) => append ? [...current, ...page.items] : page.items)
      setTotal(page.total)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load notifications.")
    } finally {
      setLoading(false)
    }
  }, [getMarketplaceNotifications, items.length])

  useEffect(() => {
    void refresh()
    let unsubscribe: (() => void) | undefined
    try { unsubscribe = auth.subscribeMarketplaceChanges(() => void refresh()) } catch { /* Polling below remains available without realtime configuration. */ }
    const timer = window.setInterval(() => void refresh(), 15000)
    return () => { unsubscribe?.(); window.clearInterval(timer) }
  }, [auth.subscribeMarketplaceChanges, refresh])

  const markRead = async (notification: MarketplaceNotification) => {
    if (notification.readAt) return
    setBusyId(notification.id)
    try {
      await markMarketplaceNotificationRead(notification.id)
      setItems((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
      setSelected((current) => current?.id === notification.id ? { ...current, readAt: new Date().toISOString() } : current)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update this notification.")
    } finally { setBusyId("") }
  }

  const markAllRead = async () => {
    const unread = items.filter((item) => !item.readAt)
    await Promise.all(unread.map((item) => markRead(item)))
  }

  useEffect(() => {
    if (!selected) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null) }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selected])

  return <div className="content">
    <header className="page-header">
      <div>
        <span className="eyebrow">{role === "provider" ? "Worker updates" : "Marketplace updates"}</span>
        <h1>Notifications</h1>
        <p>{role === "provider" ? "Updates about jobs you bid on, proposal decisions, and awarded work." : "Updates about your job posts and worker proposals."}</p>
      </div>
      <div className="card-actions">
        <Button variant="secondary" onClick={() => void refresh()} disabled={loading}>Refresh</Button>
        <Button variant="secondary" onClick={() => void markAllRead()} disabled={!items.some((item) => !item.readAt) || Boolean(busyId)}>Mark all read</Button>
      </div>
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="card table-card">
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Update</th><th>Date</th><th>Status</th><th>Details</th></tr></thead>
          <tbody>
            {items.map((item, index) => <tr key={item.id} className={!item.readAt ? "notification-unread" : undefined}>
              <td>{index + 1}</td>
              <td><strong>{item.title}</strong><br /><small>{item.body}</small></td>
              <td>{new Date(item.createdAt).toLocaleString()}</td>
              <td>{item.title.includes("reminder closed") ? "No action needed" : item.readAt ? "Read" : "New"}</td>
              <td><Button variant="ghost" onClick={() => setSelected(item)}>View details</Button></td>
            </tr>)}
            {loading && !items.length && <tr><td colSpan={5}>Loading notifications…</td></tr>}
            {!loading && !error && !items.length && <tr><td colSpan={5}>You’re all caught up. New job and proposal updates will show here.</td></tr>}
          </tbody>
        </table>
      </div>
      {items.length < total && <div className="card-actions"><Button variant="secondary" disabled={loading} onClick={() => void refresh(true)}>Load more</Button></div>}
    </section>
    {selected && <div className="notification-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}>
      <section className="notification-modal" role="dialog" aria-modal="true" aria-labelledby="notification-title">
        <div className="notification-modal-heading"><div><span className="eyebrow">{selected.title.includes("reminder closed") ? "Closed reminder" : selected.readAt ? "Notification" : "New notification"}</span><h2 id="notification-title">{selected.title}</h2></div><button className="notification-modal-close" aria-label="Close details" onClick={() => setSelected(null)}>×</button></div>
        <p>{selected.body}</p>
        <small>{new Date(selected.createdAt).toLocaleString()}</small>
        <div className="card-actions">
          {selected.jobId && <Button onClick={() => { setSelected(null); onOpenJob(selected.jobId!, selected.type) }}>Open job</Button>}
          {!selected.readAt && <Button variant="secondary" disabled={busyId === selected.id} onClick={() => void markRead(selected)}>{busyId === selected.id ? "Saving…" : "Mark read"}</Button>}
          <Button variant="ghost" onClick={() => setSelected(null)}>Close</Button>
        </div>
      </section>
    </div>}
  </div>
}
