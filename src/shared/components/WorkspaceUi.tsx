import { useEffect, useState, type ReactNode } from "react"

const adApi = import.meta.env.VITE_API_URL || "http://127.0.0.1:3000"
type LiveAd = { id: string; title: string; description: string; advertiserName: string; imageUrl: string | null; destinationUrl: string | null }

export function SponsoredAd({ placement }: { placement: "customer_landing" | "customer_dashboard" }) {
  const [ads, setAds] = useState<LiveAd[]>([])
  useEffect(() => {
    let cancelled = false
    void fetch(`${adApi}/v1/ads/live?placement=${placement}`).then(async (response) => response.ok ? await response.json() as LiveAd[] : []).then((items) => { if (!cancelled) setAds(items) }).catch(() => { if (!cancelled) setAds([]) })
    return () => { cancelled = true }
  }, [placement])
  useEffect(() => {
    if (!ads.length) return
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (!entry.isIntersecting) return
      const id = (entry.target as HTMLElement).dataset.adId
      if (id) void fetch(`${adApi}/v1/ads/${encodeURIComponent(id)}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "impression" }) }).catch(() => undefined)
      observer.unobserve(entry.target)
    }), { threshold: 0.5 })
    document.querySelectorAll("[data-ad-id]").forEach((item) => observer.observe(item))
    return () => observer.disconnect()
  }, [ads])
  if (!ads.length) return null
  return <div className="live-sponsored-list" aria-label="Sponsored listings">{ads.map((ad) => <article className="live-sponsored" data-ad-id={ad.id} key={ad.id}><Badge tone="amber">Sponsored</Badge>{ad.imageUrl && <img src={ad.imageUrl} alt="" loading="lazy" />}<div><strong>{ad.title}</strong><span>{ad.description}</span><small>{ad.advertiserName}</small></div>{ad.destinationUrl && <a href={ad.destinationUrl} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${ad.advertiserName}`} onClick={() => { void fetch(`${adApi}/v1/ads/${encodeURIComponent(ad.id)}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "click" }), keepalive: true }).catch(() => undefined) }}>Learn more <Icon name="arrow" size={16} /></a>}</article>)}</div>
}

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    shield: <><path d="M12 2 4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5Z" /><path d="m8 12 2.5 2.5L16 9" /></>,
    location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    message: <path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1-5a9 9 0 1 1 18-5Z" />,
    play: <><path d="m8 5 12 7-12 7Z" /></>,
    arrow: <path d="m5 12 14 0m-5-5 5 5-5 5" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    star: <path d="m12 2 3 6 7 .9-5 4.8 1.3 6.8L12 17.3l-6.3 3.2L7 13.7 2 8.9 9 8Z" />,
    layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 9v12" /></>,
    wallet: <><path d="M3 6h16a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14" /><path d="M16 12h5" /></>,
  }
  const path = paths[name] ?? <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{path}</svg>
}

export function Button({
  children,
  variant = "primary",
  onClick,
  icon,
  disabled = false,
  type,
}: {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  onClick?: () => void
  icon?: string
  disabled?: boolean
  type?: "button" | "submit" | "reset"
}) {
  return <button type={type} className={`btn btn-${variant}`} onClick={onClick} disabled={disabled}>{icon && <Icon name={icon} size={18} />}<span>{children}</span></button>
}

export function Badge({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "amber" | "slate" | "red" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Avatar({ src, name, large = false }: { src: string; name: string; large?: boolean }) {
  const className = `avatar ${large ? "avatar-large" : ""}`
  if (!src) {
    const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?"
    return <span className={`${className} avatar-fallback`} role="img" aria-label={name}>{initials}</span>
  }
  return <img className={className} src={src} alt={name} />
}

export function ProviderCard({
  name,
  service,
  image,
  price,
  onClick,
}: {
  name: string
  service: string
  image: string
  price: string
  onClick: () => void
}) {
  return (
    <button className="provider-card" onClick={onClick}>
      <div className="provider-image-wrap">
        <img src={image} alt={`${name}, ${service}`} />
        <span className="online-dot" aria-label="Available now" />
      </div>
      <div className="provider-copy">
        <div className="provider-title"><strong>{name}</strong><span className="rating">★ 4.9</span></div>
        <span>{service} · 1.8 km</span>
        <Badge><Icon name="shield" size={13} /> OddJobs Certified</Badge>
        <div className="provider-price">From <strong>{price}</strong></div>
      </div>
      <Icon name="chevron" size={18} />
    </button>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="heading-action">{action}</div>}</div>
}

export function Metric({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return <div className="metric-card"><span>{label}</span><strong>{value}</strong>{delta && <small>{delta}</small>}</div>
}

export function Sponsored() { return <SponsoredAd placement="customer_dashboard" /> }

export function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>{rows.map((row, rowIndex) => (
          <tr key={rowIndex}>{row.map((cell, cellIndex) => (
            <td key={`${rowIndex}-${cellIndex}`}>
              {cellIndex === 2
                ? <Badge tone={cell.includes("Reject") ? "red" : cell.includes("Pending") || cell.includes("SLA") ? "amber" : "green"}>{cell}</Badge>
                : cell}
            </td>
          ))}</tr>
        ))}</tbody>
      </table>
    </div>
  )
}

export function DemoNotice({ children = "This operational setting is stored by the API; no payment is made.", }: { children?: ReactNode }) {
  return <p className="demo-notice" role="note">{children}</p>
}

export function EmptyState({
  title,
  detail,
  action,
  actionLabel = "Try again",
}: {
  title: string
  detail: string
  action?: () => void
  actionLabel?: string
}) {
  return <div className="empty-state"><span><Icon name="search" size={26} /></span><h2>{title}</h2><p>{detail}</p>{action && <button className="btn btn-secondary" onClick={action}>{actionLabel}</button>}</div>
}
