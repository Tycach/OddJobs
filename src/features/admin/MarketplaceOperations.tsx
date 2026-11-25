import { useEffect, useState } from "react"
import {
  useAuth,
  type AdminMarketplaceActivity,
  type AdminMarketplaceJob,
  type AdminMarketplaceJobFilters,
  type MarketplaceJobStatus,
  type AdminServiceListing,
} from "../../auth/AuthProvider"
import ListingMediaGallery from "../marketplace/ListingMediaGallery"

const statusOptions: ("all" | MarketplaceJobStatus)[] = [
  "all", "open", "awarded", "in_progress", "completion_pending", "revision_requested", "completed", "cancelled", "disputed", "expired",
]

function asUtcBoundary(date: string, end: boolean) {
  if (!date) return ""
  return new Date(`${date}T${end ? "23:59:59.999" : "00:00:00.000"}Z`).toISOString()
}

export default function MarketplaceOperations() {
  const { getAdminMarketplaceJobs, getAdminMarketplaceJob, getAdminMarketplaceActivity, getAdminServiceListings, releaseAdminServiceListing } = useAuth()
  const [status, setStatus] = useState<AdminMarketplaceJobFilters["status"]>("all")
  const [search, setSearch] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [offset, setOffset] = useState(0)
  const [jobs, setJobs] = useState<AdminMarketplaceJob[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<AdminMarketplaceJob | null>(null)
  const [events, setEvents] = useState<AdminMarketplaceActivity[]>([])
  const [activityOffset, setActivityOffset] = useState(0)
  const [activityTotal, setActivityTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activityLoading, setActivityLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState("")
  const [detailError, setDetailError] = useState("")
  const [listings, setListings] = useState<AdminServiceListing[]>([])
  const [listingSearch, setListingSearch] = useState("")
  const [listingOffset, setListingOffset] = useState(0)
  const [listingTotal, setListingTotal] = useState(0)
  const [listingError, setListingError] = useState("")
  const pageSize = 25
  const filters: AdminMarketplaceJobFilters = {
    status,
    search,
    from: asUtcBoundary(from, false),
    to: asUtcBoundary(to, true),
  }

  const loadJobs = () => {
    setLoading(true)
    setError("")
    void getAdminMarketplaceJobs(filters, pageSize, offset)
      .then((page) => {
        setJobs(page.items)
        setTotal(page.total)
        setSelected((current) => page.items.find((job) => job.id === current?.id) ?? null)
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load marketplace jobs."))
      .finally(() => setLoading(false))
  }
  useEffect(() => loadJobs(), [getAdminMarketplaceJobs, status, search, from, to, offset])
  useEffect(() => {
    let active = true
    void getAdminServiceListings(listingSearch, pageSize, listingOffset).then((page) => { if (active) { setListings(page.items); setListingTotal(page.total); setListingError("") } }).catch((caught: unknown) => { if (active) setListingError(caught instanceof Error ? caught.message : "Could not load provider listings.") })
    return () => { active = false }
  }, [getAdminServiceListings, listingSearch, listingOffset])

  const loadActivity = () => {
    setActivityLoading(true)
    void getAdminMarketplaceActivity(pageSize, activityOffset)
      .then((page) => {
        setEvents(page.items)
        setActivityTotal(page.total)
      })
      .catch((caught: unknown) => setDetailError(caught instanceof Error ? caught.message : "Could not load marketplace activity."))
      .finally(() => setActivityLoading(false))
  }
  useEffect(() => loadActivity(), [getAdminMarketplaceActivity, activityOffset])

  const openJob = async (jobId: string) => {
    setDetailLoading(true)
    setDetailError("")
    try {
      setSelected(await getAdminMarketplaceJob(jobId))
    } catch (caught) {
      setDetailError(caught instanceof Error ? caught.message : "Could not load this job case.")
    } finally {
      setDetailLoading(false)
    }
  }

  const releaseClaim = async (listingId: string) => {
    const reason = window.prompt("Why should this claim be released? (At least 10 characters)")?.trim() ?? ""
    if (!reason) return
    if (reason.length < 10) { setListingError("Enter a reason with at least 10 characters."); return }
    try {
      await releaseAdminServiceListing(listingId, reason)
      const page = await getAdminServiceListings(listingSearch, pageSize, listingOffset)
      setListings(page.items)
      setListingTotal(page.total)
      setListingError("")
    } catch (caught) {
      setListingError(caught instanceof Error ? caught.message : "Could not release this claim.")
    }
  }

  return (
    <div className="content console-content marketplace-operations">
      <header className="page-header">
        <div>
          <span className="eyebrow">Customer and provider operations</span>
          <h1>Marketplace operations</h1>
          <p>Search job cases, review quotes, and inspect the audited activity timeline.</p>
        </div>
        <button className="btn btn-secondary" onClick={() => { loadJobs(); loadActivity() }}>Refresh</button>
      </header>

      <section className="card table-card">
        <div className="section-title"><h2>Provider listings and customer claims</h2><span className="caption">Platform-wide view</span></div>
        <label className="search-box"><span>Search Job ID, listings, providers, or customers</span><input value={listingSearch} onChange={(event) => { setListingOffset(0); setListingSearch(event.target.value) }} placeholder="For example, OJ-0000000042" /></label>
        {listingError && <p className="form-error" role="alert">{listingError}</p>}
        <div className="table-wrap"><table><thead><tr><th className="listing-number-heading">#</th><th>Listing</th><th>Provider</th><th>Customer</th><th>Status</th><th>Claim expiry</th><th>Actions</th></tr></thead><tbody>{listings.map((listing, index) => <tr key={listing.id}><td className="listing-number">{listingOffset + index + 1}</td><td><strong>{listing.title}</strong><small className="caption">Job ID {listing.jobReference} · {listing.category} · {listing.locationLabel}</small><details><summary>Media ({listing.media?.length ?? 0})</summary><ListingMediaGallery media={listing.media ?? []} /></details><details><summary>Activity ({listing.activity?.length ?? 0})</summary><ol>{listing.activity?.map((event, index) => <li key={`${event.requestId}-${index}`}>{event.actorName}: {event.action} · {new Date(event.createdAt).toLocaleString()}</li>)}</ol></details></td><td>{listing.providerName}</td><td>{listing.customerName ?? "—"}</td><td><span className={`operations-status operations-status-${listing.status}`}>{listing.status.replace(/_/g, " ")}</span></td><td>{listing.claimExpiresAt ? new Date(listing.claimExpiresAt).toLocaleString() : "—"}</td><td>{listing.status === "claimed" && <button className="btn btn-secondary operations-action" onClick={() => void releaseClaim(listing.id)}>Release claim</button>}</td></tr>)}</tbody></table></div>
        {!listingError && listings.length === 0 && <p className="caption">No provider listings match this search.</p>}
        <div className="card-actions"><button className="btn btn-secondary" disabled={listingOffset === 0} onClick={() => setListingOffset((value) => Math.max(0, value - pageSize))}>Previous listings</button><button className="btn btn-secondary" disabled={listingOffset + pageSize >= listingTotal} onClick={() => setListingOffset((value) => value + pageSize)}>Next listings</button></div>
      </section>

      <section className="card admin-marketplace-filters">
        <label>
          Search jobs, customers, providers, or IDs
          <input value={search} onChange={(event) => { setOffset(0); setSearch(event.target.value) }} placeholder="Job title, party, category, or ID" />
        </label>
        <label>
          Status
          <select value={status} onChange={(event) => { setOffset(0); setStatus(event.target.value as typeof status) }}>
            {statusOptions.map((value) => <option key={value} value={value}>{value.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <label>From<input type="date" value={from} onChange={(event) => { setOffset(0); setFrom(event.target.value) }} /></label>
        <label>To<input type="date" value={to} onChange={(event) => { setOffset(0); setTo(event.target.value) }} /></label>
      </section>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="admin-marketplace-layout">
        <section className="card table-card">
          <h2>Job cases <span className="caption">{total} total</span></h2>
          {loading ? <p role="status">Loading jobs…</p> : jobs.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Job</th><th>Customer</th><th>Status</th><th>Quotes</th></tr></thead>
                <tbody>{jobs.map((job) => (
                  <tr key={job.id} className={selected?.id === job.id ? "selected-row" : ""}>
                    <td><button className="table-link" onClick={() => void openJob(job.id)}>{job.title}<small>Job ID {job.jobReference}</small></button></td>
                    <td>{job.customerDisplayName}</td>
                    <td><span className={`operations-status operations-status-${job.status}`}>{job.status.replace(/_/g, " ")}</span></td>
                    <td>{job.quoteCount}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : !error ? <p>No jobs match these filters.</p> : null}
          <div className="card-actions">
            <button className="btn btn-secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</button>
            <span>{total ? `${offset + 1}–${Math.min(offset + jobs.length, total)} of ${total}` : "0 jobs"}</span>
            <button className="btn btn-secondary" disabled={loading || offset + pageSize >= total} onClick={() => setOffset((value) => value + pageSize)}>Next</button>
          </div>
        </section>

        <section className="card admin-marketplace-case">
          <h2>Case details</h2>
          {detailError && <p className="form-error" role="alert">{detailError}</p>}
          {detailLoading ? <p role="status">Loading case…</p> : selected ? (
            <>
              <div className="admin-case-heading">
                <div><h3>{selected.title}</h3><span className="caption">Job ID {selected.jobReference}</span></div>
                <span className="badge badge-amber">{selected.status.replace(/_/g, " ")}</span>
              </div>
              <p>{selected.description}</p>
              <dl className="admin-case-facts">
                <div><dt>Customer</dt><dd>{selected.customerDisplayName}</dd></div>
                <div><dt>Area</dt><dd>{selected.locationLabel}</dd></div>
                <div><dt>Category</dt><dd>{selected.category}</dd></div>
                <div><dt>Budget</dt><dd>{selected.budgetMinor === null ? "Not specified" : `${selected.currency} ${(selected.budgetMinor / 100).toLocaleString()}`}</dd></div>
              </dl>
              <h3>Quotes ({selected.quotes.length})</h3>
              {selected.quotes.length ? selected.quotes.map((quote) => (
                <article className="admin-quote-card" key={quote.id}>
                  <div><strong>{quote.providerName}</strong><span className="badge badge-slate">{quote.status}</span></div>
                  <p>{quote.currency} {(quote.amountMinor / 100).toLocaleString()} · {quote.availability}</p>
                  <p>{quote.message}</p>
                  <small className="caption">Quote {quote.id}</small>
                </article>
              )) : <p className="caption">No quotes have been submitted.</p>}
              <h3>Timeline</h3>
              {selected.timeline.length ? (
                <ol className="admin-event-timeline">
                  {selected.timeline.map((event) => (
                    <li key={event.id}>
                      <strong>{event.action}</strong>
                      <span>{event.actorDisplayName} ({event.actorRole}) · {new Date(event.createdAt).toLocaleString()}</span>
                      <small>{Object.entries(event.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</small>
                    </li>
                  ))}
                </ol>
              ) : <p className="caption">No timeline events recorded.</p>}
            </>
          ) : <p className="caption">Choose a job to review its customer, quotes, and activity timeline.</p>}
        </section>
      </div>

      <section className="card table-card admin-marketplace-activity">
        <div className="section-title"><h2>Recent customer and provider activity</h2><span className="caption">{activityTotal} total events</span></div>
        {activityLoading ? <p role="status">Loading activity…</p> : events.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Job / quote</th><th>Request ID</th></tr></thead>
              <tbody>{events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString()}</td>
                  <td>{event.actorDisplayName}<small className="caption">{event.actorRole}</small></td>
                  <td>{event.action}</td>
                  <td>{event.jobId}{event.quoteId && <small className="caption">Quote {event.quoteId}</small>}</td>
                  <td>{event.requestId}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p>No marketplace activity recorded yet.</p>}
        <div className="card-actions">
          <button className="btn btn-secondary" disabled={activityLoading || activityOffset === 0} onClick={() => setActivityOffset((value) => Math.max(0, value - pageSize))}>Previous activity</button>
          <button className="btn btn-secondary" disabled={activityLoading || activityOffset + pageSize >= activityTotal} onClick={() => setActivityOffset((value) => value + pageSize)}>Next activity</button>
        </div>
      </section>
      <p className="caption">Operational reads are audited. This view omits private contact details; administrative intervention actions are not enabled here.</p>
    </div>
  )
}
