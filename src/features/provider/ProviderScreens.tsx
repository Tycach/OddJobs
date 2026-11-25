import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth, type MarketplaceProvider, type ServiceListingMedia } from "../../auth/AuthProvider"
import { useDemoStore } from "../../demo/context"
import type { Screen } from "../../demo/model"
import { useMarketplaceJobData, useMarketplaceJobs } from "../marketplace/hooks"
import { JobTimeline } from "../marketplace/JobTimeline"
import { Badge, Button, DemoNotice, EmptyState, Icon, Metric, PageHeader, Sponsored } from "../../shared/components/WorkspaceUi"
import ListingMediaGallery from "../marketplace/ListingMediaGallery"
import { ListingReviewForm } from "../marketplace/ListingReviewForm"
import { ServiceMessages } from "../marketplace/ServiceMessages"

type JobCardProps = { job: string[]; number?: number; onClick?: () => void }
type DataTableProps = { headers: string[]; rows: string[][] }

function DataTable({ headers, rows }: DataTableProps) {
  return <div className="table-wrap"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`}>{cellIndex === 2 ? <Badge tone={cell.includes("Reject") ? "red" : cell.includes("Pending") || cell.includes("SLA") ? "amber" : "green"}>{cell}</Badge> : cell}</td>)}</tr>)}</tbody></table></div>
}
function ProviderDashboard({ go }: { go: (s: Screen) => void }) {
  const auth = useAuth()
  const { jobs: awardedJobs, loading: awardedLoading, error: awardedError, refresh: refreshAwarded } = useMarketplaceJobs("provider")
  const { jobs: customerJobs, loading: feedLoading, error: feedError, refresh: refreshFeed } = useMarketplaceJobs("feed")
  const [proposals, setProposals] = useState<import("../../auth/AuthProvider").MarketplaceProviderQuote[]>([])
  const [proposalsLoading, setProposalsLoading] = useState(true)
  const [proposalsError, setProposalsError] = useState("")
  const refreshProposals = useCallback(async () => {
    try {
      setProposals(await auth.getMyMarketplaceQuotes())
      setProposalsError("")
    } catch (caught) {
      setProposalsError(caught instanceof Error ? caught.message : "Could not load your proposals.")
    } finally {
      setProposalsLoading(false)
    }
  }, [auth.getMyMarketplaceQuotes])
  useEffect(() => {
    void refreshProposals()
    const timer = window.setInterval(() => {
      void refreshProposals()
      void refreshAwarded()
      void refreshFeed()
    }, 20000)
    return () => window.clearInterval(timer)
  }, [refreshAwarded, refreshFeed, refreshProposals])
  const currentWork = awardedJobs.find((job) => job.status === "in_progress") ?? awardedJobs[0] ?? null
  const nextOpportunity = customerJobs.find((item) => item.status === "open") ?? null
  const loading = proposalsLoading || awardedLoading || feedLoading
  const dashboardError = [proposalsError, awardedError, feedError].filter(Boolean).join(" ")
  const metric = (value: number) => loading ? "..." : dashboardError ? "—" : String(value)
  const activeProposals = proposals.filter((proposal) => proposal.status === "submitted").length
  const activeWork = awardedJobs.filter((job) => ["accepted", "in_progress", "completion_pending"].includes(job.status)).length
  return (
    <div className="content console-content">
      <PageHeader
        eyebrow="Worker workspace"
        title="Your work dashboard"
        description="Track your proposals, awarded jobs, and work in progress. Updates automatically."
        action={<Button onClick={() => go("feed")}>Find jobs</Button>}
      />
      <div className="metrics">
        <Metric label="Open jobs" value={metric(customerJobs.filter((item) => item.status === "open").length)} />
        <Metric label="Proposals sent" value={metric(proposals.length)} />
        <Metric label="Awaiting customer review" value={metric(activeProposals)} />
        <Metric label="Active awarded work" value={metric(activeWork)} />
      </div>
      {dashboardError && <p className="form-error" role="alert">Some live dashboard data could not be loaded. {dashboardError}</p>}
      <div className="dashboard-grid">
        <section className="card">
          <div className="section-title">
            <h2>Your work</h2>
            <Badge>{loading ? "Updating" : currentWork ? "In progress" : nextOpportunity ? "Jobs available" : "No active work"}</Badge>
          </div>
          <div className="next-job">
            <div className="time-block">
              <strong>{loading ? "..." : activeWork}</strong>
              <span>active</span>
            </div>
            <div>
              <strong>{currentWork?.title ?? nextOpportunity?.title ?? (dashboardError ? "Live job data unavailable" : "No active work yet")}</strong>
              <span>{currentWork ? `${currentWork.locationLabel} · ${currentWork.status.replace(/_/g, " ")}` : nextOpportunity ? `${nextOpportunity.locationLabel} · ${nextOpportunity.quoteCount} proposal${nextOpportunity.quoteCount === 1 ? "" : "s"} received` : dashboardError ? "Refresh after the marketplace connection is restored" : "Browse jobs and send a proposal to get started"}</span>
            </div>
          </div>
          <div className="card-actions">
            <Button onClick={() => go(awardedJobs.length ? "management" : "feed")}>{awardedJobs.length ? "View my work" : "Browse jobs"}</Button>
            <Button variant="secondary" onClick={() => go("providerBids")}>Track my proposals</Button>
          </div>
        </section>
        <section className="card profile-meter">
          <div className="section-title">
            <h2>Make your profile stand out</h2>
          </div>
          <p>Keep your profile current. Hirers can review your experience, service area, and reviews alongside your bids.</p>
          <Button variant="secondary" onClick={() => go("settings")}>
            Edit my profile
          </Button>
        </section>
      </div>
    </div>
  )
}
function JobCard({ job, number, onClick }: JobCardProps) {
  return (
    <button className="job-card" onClick={onClick}>
      <div>
        <Badge tone="slate">Job #{number ?? "—"}</Badge>
        <span>{job[4] ?? "Open job"}</span>
      </div>
      <h3>{job[0]}</h3>
      {job[5] && <small>{job[5]}</small>}
      <p>
        <Icon name="location" size={16} />
        {job[1]}
      </p>
      <strong>{job[2]}</strong>
      <span>Open budget · View details</span>
    </button>
  )
}

function JobFeed({ go }: { go: (screen: Screen) => void }) {
  const { updateStore } = useDemoStore()
  const auth = useAuth()
  const { jobs, loading, error, refresh } = useMarketplaceJobs("feed")
  const [searchDraft, setSearchDraft] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("open")
  const [distanceFilter, setDistanceFilter] = useState("preferred")
  const [workerProfile, setWorkerProfile] = useState<MarketplaceProvider | null>(null)
  useEffect(() => {
    if (!auth.profile?.id) return
    let active = true
    void auth.getMarketplaceProvider(auth.profile.id).then((profile) => { if (active) setWorkerProfile(profile) }).catch(() => { if (active) setWorkerProfile(null) })
    return () => { active = false }
  }, [auth.getMarketplaceProvider, auth.profile?.id])
  const hasSavedLocation = workerProfile?.serviceLatitude != null && workerProfile.serviceLongitude != null
  const activeDistanceLimit = distanceFilter === "preferred"
    ? hasSavedLocation ? workerProfile.maxTravelDistanceKm ?? 25 : null
    : distanceFilter === "all" ? null : Number(distanceFilter)
  const categories = [...new Set(jobs.map((job) => job.category).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const filteredJobs = jobs.filter((job) => {
    const query = searchTerm.trim().toLocaleLowerCase()
    const matchesSearch = !query || [job.jobReference, job.title, job.description, job.category, job.locationLabel].some((value) => value.toLocaleLowerCase().includes(query))
    const matchesCategory = categoryFilter === "all" || job.category === categoryFilter
    const matchesStatus = statusFilter === "all" || (statusFilter === "open" ? job.status === "open" : job.status !== "open")
    const matchesDistance = activeDistanceLimit === null || job.distanceKm === null || job.distanceKm === undefined || job.distanceKm <= activeDistanceLimit
    return matchesSearch && matchesCategory && matchesStatus && matchesDistance
  })
  return (
    <div className="content">
      <PageHeader
        title="Jobs matched to you"
        description="Browse hirer-posted jobs. Nearby jobs are ranked using your saved service area."
      />
      <section className="card">
        <form className="job-feed-search" onSubmit={(event) => { event.preventDefault(); setSearchTerm(searchDraft) }}>
          <label className="job-feed-search-field"><span>Search jobs</span><input aria-label="Search jobs" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Job title, skill, description, or area" /></label>
          <label><span>Category</span><select aria-label="Filter jobs by category" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="all">All categories</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label><span>Status</span><select aria-label="Filter jobs by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="open">Open for proposals</option><option value="taken">Taken jobs</option><option value="all">All jobs</option></select></label>
          <label><span>Distance</span><select aria-label="Filter jobs by distance" value={distanceFilter} onChange={(event) => setDistanceFilter(event.target.value)}><option value="preferred">My travel range{hasSavedLocation ? ` (${workerProfile.maxTravelDistanceKm ?? 25} km)` : " (set in profile)"}</option><option value="5">Within 5 km</option><option value="10">Within 10 km</option><option value="25">Within 25 km</option><option value="50">Within 50 km</option><option value="100">Within 100 km</option><option value="all">Any distance</option></select></label>
          <Button icon="search" type="submit">Search jobs</Button>
          {(searchDraft || searchTerm || categoryFilter !== "all" || statusFilter !== "open" || distanceFilter !== "preferred") && <Button variant="ghost" type="button" onClick={() => { setSearchDraft(""); setSearchTerm(""); setCategoryFilter("all"); setStatusFilter("open"); setDistanceFilter("preferred") }}>Clear</Button>}
        </form>
        <p className="caption job-feed-count">{filteredJobs.length} {filteredJobs.length === 1 ? "job" : "jobs"} found</p>
        {!hasSavedLocation && <div className="safe-note"><Icon name="location" /><span>Save an approximate service location in My profile to see distance estimates and nearby matches. Jobs without map pins remain visible by area.</span><Button variant="secondary" onClick={() => go("settings")}>Set my service area</Button></div>}
        {hasSavedLocation && <p className="caption">Distance estimates use your saved service area. Exact job pins stay private unless the hirer chooses to share one after selecting a worker.</p>}
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
          <Button variant="ghost" onClick={() => void refresh()}>
            Retry
          </Button>
        </p>
      )}
      <div className="job-feed">
        {filteredJobs.map((job, index) => (
          <JobCard
            key={job.id}
            number={index + 1}
            job={[
              job.title,
              `${job.locationLabel}${job.distanceKm == null ? " · Distance unavailable" : ` · ${job.distanceKm.toFixed(1)} km from your area`}`,
              job.budgetMinor === null
                ? "Open budget"
                : `KES ${(job.budgetMinor / 100).toLocaleString()}`,
              `${job.quoteCount} proposals`,
              job.status === "open" ? "Open for proposals" : `Taken · ${job.status.replace(/_/g, " ")}`,
              `Job ID ${job.jobReference}`,
            ]}
            onClick={() => {
              updateStore({ selectedJobId: job.id, selectedJobNumber: index + 1 })
              go("jobDetail")
            }}
          />
        ))}
      </div>
      {loading && <p className="center-note">Loading open jobs…</p>}
      {!loading && !error && jobs.length > 0 && filteredJobs.length === 0 && <EmptyState title="No matching jobs" detail="Try another search term, category, or distance range." />}
      {!loading && !error && !jobs.length && (
        <EmptyState
          title="No customer jobs available right now"
          detail="Open jobs will appear here. Taken jobs remain visible while work is active."
        />
      )}
    </div>
  )
}

function ProviderBids({ go }: { go: (screen: Screen) => void }) {
  const auth = useAuth()
  const { updateStore } = useDemoStore()
  const [quotes, setQuotes] = useState<import("../../auth/AuthProvider").MarketplaceProviderQuote[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [view, setView] = useState<"active" | "all">("active")
  const [search, setSearch] = useState("")
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setQuotes(await auth.getMyMarketplaceQuotes())
      setError("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load your bids.")
    } finally {
      setLoading(false)
    }
  }, [auth.getMyMarketplaceQuotes])
  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 15000)
    return () => window.clearInterval(timer)
  }, [refresh])
  const openJob = (jobId: string) => {
    updateStore({ selectedJobId: jobId, selectedJobNumber: 0 })
    go("jobDetail")
  }
  const activeQuotes = quotes.filter((quote) => quote.status === "submitted" || quote.status === "accepted")
  const visibleQuotes = (view === "active" ? activeQuotes : quotes).filter((quote) => {
    const term = search.trim().toLocaleLowerCase()
    return !term || [quote.jobReference, quote.jobTitle, quote.jobCategory, quote.jobLocationLabel, quote.message, quote.availability].some((field) => field.toLocaleLowerCase().includes(term))
  })
  const statusTone = (status: string) => status === "accepted" ? "green" as const : status === "submitted" ? "amber" as const : status === "declined" || status === "expired" ? "red" as const : "slate" as const
  return (
    <div className="content">
      <PageHeader title="My bids and proposals" description="Track active bids, accepted work, and the status of every proposal." action={<Button variant="secondary" onClick={() => go("feed")}>Browse jobs</Button>} />
      {error && <p className="form-error" role="alert">{error}<Button variant="ghost" onClick={() => void refresh()}>Retry</Button></p>}
      <div className="proposal-summary-cards">
        <section className="card"><span>Active proposals</span><strong>{activeQuotes.filter((quote) => quote.status === "submitted").length}</strong></section>
        <section className="card"><span>Accepted bids</span><strong>{activeQuotes.filter((quote) => quote.status === "accepted").length}</strong></section>
        <section className="card"><span>All bids</span><strong>{quotes.length}</strong></section>
      </div>
      <section className="card provider-proposal-table-card">
        <div className="provider-proposal-toolbar">
          <label className="provider-proposal-search"><span>Search your bids</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by job, category, area, or proposal" /></label>
          <div className="filters" aria-label="Proposal filter">
            <button type="button" className={view === "active" ? "active" : ""} onClick={() => setView("active")}>Active ({activeQuotes.length})</button>
            <button type="button" className={view === "all" ? "active" : ""} onClick={() => setView("all")}>All bids ({quotes.length})</button>
          </div>
        </div>
        {loading ? <p role="status">Loading your bids...</p> : error ? null : visibleQuotes.length ? <div className="table-wrap"><table className="provider-proposal-table">
          <thead><tr><th>No.</th><th>Job</th><th>Category and area</th><th>Your bid</th><th>Availability</th><th>Your proposal</th><th>Status</th><th>Updated</th><th></th></tr></thead>
          <tbody>{visibleQuotes.map((quote, index) => <tr key={quote.id}>
            <td>{index + 1}</td>
            <td><strong>{quote.jobTitle}</strong><br /><small>Job ID {quote.jobReference}</small></td>
            <td>{quote.jobCategory}<br /><small>{quote.jobLocationLabel}</small></td>
            <td><strong>KES {(quote.amountMinor / 100).toLocaleString()}</strong></td>
            <td>{quote.availability}</td>
            <td className="provider-proposal-message">{quote.message}</td>
            <td><Badge tone={statusTone(quote.status)}>{quote.status.replace(/_/g, " ")}</Badge></td>
            <td>{new Date(quote.updatedAt).toLocaleDateString()}</td>
            <td><Button variant="secondary" onClick={() => openJob(quote.jobId)}>View job</Button></td>
          </tr>)}</tbody>
        </table></div> : quotes.length ? <EmptyState title="No bids match this search" detail="Try a different job title, category, area, or proposal keyword." /> : <EmptyState title="No bids yet" detail="Bids you submit on customer jobs will appear here. Browse open jobs to find work." action={() => go("feed")} actionLabel="Browse jobs" />}
        <div className="card-actions"><span>{loading ? "Updating..." : `${visibleQuotes.length} ${visibleQuotes.length === 1 ? "bid" : "bids"} shown`}</span><Button variant="secondary" disabled={loading} onClick={() => void refresh()}>Refresh bids</Button></div>
      </section>
    </div>
  )
}
function ProviderOnboarding() {
  const [saved, setSaved] = useState(false)
  const [category, setCategory] = useState("Cleaning")
  return (
    <div className="content narrow">
      <PageHeader
        eyebrow="Worker setup · 1 of 1"
        title="Create your service profile"
        description="Tell Nairobi customers what you can help with."
      />
      <section className="form-card">
        <label>
          Profile photo
          <input type="file" accept="image/*" />
        </label>
        <label>
          About your work
          <textarea
            rows={4}
            placeholder="Share your experience and what makes your service reliable."
          />
        </label>
        <label>
          Service categories
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {[
              "Cleaning",
              "Plumbing",
              "Electrical",
              "Care",
              "Grooming",
              "Tutoring",
              "Moving",
            ].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Pricing model
          <select>
            <option>Fixed quote</option>
            <option>Hourly rate</option>
            <option>On-site estimate</option>
          </select>
        </label>
        <label>
          Starting rate (KES)
          <input inputMode="numeric" placeholder="e.g. 1,200" />
        </label>
        <label>
          Service area
          <input defaultValue="Nairobi, Kilimani" />
        </label>
        <label>
          Availability
          <input type="datetime-local" />
        </label>
        <label className="upload">
          <Icon name="plus" />
          <span>
            Choose portfolio photos
            <input type="file" accept="image/*" multiple />
          </span>
        </label>
        <Button onClick={() => setSaved(true)}>Save demo profile</Button>
        {saved && <DemoNotice>Profile saved for this demo session.</DemoNotice>}
      </section>
    </div>
  )
}

function ProviderVerification() {
  const auth = useAuth()
  const [evidence, setEvidence] = useState("")
  const [documentType, setDocumentType] = useState<"national_id" | "passport">("national_id")
  const [document, setDocument] = useState<File | null>(null)
  const [region, setRegion] = useState("")
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [verificationStatus, setVerificationStatus] = useState("not_started")
  const [identityDisclosureAccepted, setIdentityDisclosureAccepted] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    void auth.getProviderVerification().then((verification) => {
      setVerificationStatus(verification.status)
      setSubmitted(verification.status === "in_review")
      if (verification.documentType === "national_id" || verification.documentType === "passport") {
        setDocumentType(verification.documentType)
      }
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Could not load your verification status.")
    })
  }, [auth.getProviderVerification])
  const submit = async () => {
    if (!identityDisclosureAccepted) {
      setError("Confirm that OddJobs may process your ID for identity review.")
      return
    }
    if (!document) {
      setError("Choose a national ID or passport image/PDF.")
      return
    }
    setBusy(true)
    setError("")
    try {
      const result = await auth.submitProviderApplication({
        publicName: auth.profile?.displayName || "Worker",
        bio: evidence.trim() || "Worker identity verification",
        region: region.trim() || "Kenya",
        documentType,
        document,
        skillsEvidence: evidence.trim(),
        identityDisclosureAccepted,
      })
      setVerificationStatus(result.status)
      setSubmitted(result.status === "in_review")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not submit your ID for review.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="content narrow">
      <PageHeader title="Worker ID verification" description="Submit your national ID and work experience evidence for administrator review." />
      <DemoNotice>Your ID is private and reviewed only by authorized OddJobs administrators.</DemoNotice>
      <section className="form-card">
        <div className="safe-note"><Icon name="shield" /><span>Status: <strong>{verificationStatus.replace(/_/g, " ")}</strong></span></div>
        <label>Identity document type
          <select value={documentType} onChange={(event) => setDocumentType(event.target.value as "national_id" | "passport")}>
            <option value="national_id">National ID</option><option value="passport">Passport</option>
          </select>
        </label>
        <label className="upload"><Icon name="plus" /><span>{document?.name || "Choose ID image or PDF (up to 8 MB)"}
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(event) => setDocument(event.target.files?.[0] ?? null)} />
        </span></label>
        <label>Skills evidence<textarea value={evidence} onChange={(event) => setEvidence(event.target.value)} rows={3} maxLength={2000} placeholder="Describe training, licences, or relevant experience." /></label>
        <label>Work area<input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="e.g. Nairobi" /></label>
        <label className="checkbox-row"><input type="checkbox" checked={identityDisclosureAccepted} onChange={(event) => setIdentityDisclosureAccepted(event.target.checked)} /><span>I understand authorized OddJobs administrators will review my ID to verify my worker account. The document is private; its retention period will be published before production.</span></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {verificationStatus === "verified" ? <p role="status">Your identity is already approved. No new application was created.</p> : submitted ? <p role="status">Your identity documents were submitted to the live review queue.</p> : <Button disabled={busy} onClick={() => void submit()}>{busy ? "Uploading securely..." : "Submit for identity review"}</Button>}
      </section>
    </div>
  )
}

function ProviderJobDetail({ go }: { go: (screen: Screen) => void }) {
  const { store, updateStore } = useDemoStore()
  const auth = useAuth()
  const { job, quotes, loading, error, refresh } = useMarketplaceJobData(
    store.selectedJobId,
    "provider",
  )
  const [price, setPrice] = useState("")
  const [timing, setTiming] = useState("")
  const [pitch, setPitch] = useState(
    "",
  )
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [editingQuote, setEditingQuote] = useState(false)
  const openConversation = async () => {
    if (!job) return
    try {
      const conversation = await auth.openMarketplaceConversation(job.id, "provider")
      updateStore({ selectedJobId: job.id, selectedMarketplaceConversationId: conversation.id })
      go("chat")
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not open this job conversation.")
    }
  }
  const ownQuote = quotes.find((quote) => quote.status === "accepted") ?? quotes.find((quote) => quote.status === "submitted") ?? quotes[quotes.length - 1] ?? null

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 15000)
    return () => window.clearInterval(timer)
  }, [refresh])

  useEffect(() => {
    if (!price && job?.budgetMinor !== null && job?.budgetMinor !== undefined) {
      setPrice(String(job.budgetMinor / 100))
    }
  }, [job, price])

  const submitQuote = async () => {
    const amount = Number(price)
    if (
      !job ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      Math.round(amount * 100) < 1 ||
      !Number.isSafeInteger(Math.round(amount * 100)) ||
      !pitch.trim() ||
      !timing.trim()
    ) {
      setMessage("Enter a valid quote and a short message.")
      return
    }
    setSubmitting(true)
    try {
      await auth.submitMarketplaceQuote(job.id, {
        amountMinor: Math.round(amount * 100),
        availability: timing.trim(),
        message: pitch.trim(),
      })
      setMessage("Your quote was sent to the customer.")
      setEditingQuote(false)
      await refresh()
    } catch (requestError) {
      setMessage(
        requestError instanceof Error
          ? requestError.message
          : "We couldn’t submit your quote. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="center-note">Loading job details…</p>

  if (error || !job) {
    return (
      <div className="content narrow">
        <PageHeader title="Job details" description="Live marketplace data." />
        <p className={error ? "form-error" : "caption"} role={error ? "alert" : undefined}>
          {error || "Select an open job from the provider feed."}
        </p>
        <Button onClick={() => go("feed")}>Back to job feed</Button>
      </div>
    )
  }

  return (
    <div className="content narrow">
      <PageHeader
        eyebrow={`Job ID ${job.jobReference}`}
        title={job.title}
        action={<Button variant="secondary" onClick={() => go("settings")}>Edit my profile</Button>}
        description={`${job.category} · ${job.locationLabel}${
          job.budgetMinor === null
            ? ""
            : ` · Budget up to KES ${(job.budgetMinor / 100).toLocaleString()}`
        }`}
      />
      <section className="card">
        {job.distanceKm != null && <p className="safe-note"><Icon name="location" /><span>About {job.distanceKm.toFixed(1)} km from your saved service area.</span></p>}
        {job.locationLatitude == null && job.locationMode !== "remote" && <p className="caption">The hirer has shared an area label. The exact pin is available only if they choose to share it after selecting a worker.</p>}
        <p>{job.description}</p>
        <ListingMediaGallery media={job.media ?? []} />
        {job.locationLatitude != null && job.locationLongitude != null && <div className="map-preview"><h2>Approximate job location</h2><iframe title={`Map showing ${job.title}`} loading="lazy" src={`https://www.openstreetmap.org/export/embed.html?bbox=${job.locationLongitude - 0.025}%2C${job.locationLatitude - 0.025}%2C${job.locationLongitude + 0.025}%2C${job.locationLatitude + 0.025}&layer=mapnik&marker=${job.locationLatitude}%2C${job.locationLongitude}`} /><a href={`https://www.openstreetmap.org/?mlat=${job.locationLatitude}&mlon=${job.locationLongitude}#map=14/${job.locationLatitude}/${job.locationLongitude}`} target="_blank" rel="noreferrer">Open map</a></div>}
        <div className="review-facts">
          {job.requestedFor && <span><small>Preferred start</small><b>{new Date(job.requestedFor).toLocaleDateString()}</b></span>}
          {job.applicationDeadlineAt && <span><small>Applications close</small><b>{new Date(job.applicationDeadlineAt).toLocaleString()}</b></span>}
          {job.dueAt && <span><small>Work due</small><b>{new Date(job.dueAt).toLocaleString()}</b></span>}
          <span><small>Work mode</small><b>{job.locationMode}</b></span>
        </div>
        <JobTimeline job={job} />
        <p className="caption">
          {job.quoteCount} proposals received
        </p>
        {ownQuote && !editingQuote ? (
          <div className="form-card">
            <Badge>{ownQuote.status}</Badge>
            <h2>Your proposal</h2>
            <p>{ownQuote.message}</p>
            <p>
              KES {(ownQuote.amountMinor / 100).toLocaleString()} ·{" "}
              {ownQuote.availability}
            </p>
            {ownQuote.status === "submitted" && job.status === "open" && <Button variant="secondary" onClick={() => { setPrice(String(ownQuote.amountMinor / 100)); setTiming(ownQuote.availability); setPitch(ownQuote.message); setEditingQuote(true) }}>Edit proposal</Button>}
          </div>
        ) : job.status !== "open" ? (
          <p className="caption">This job is no longer accepting quotes.</p>
        ) : (
          <div className="form-card">
            <label>
              Your quote (KES)
              <input
                inputMode="decimal"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="Enter your price"
              />
            </label>
            <label>
              When can you start?
              <input
                value={timing}
                onChange={(event) => setTiming(event.target.value)}
                placeholder="For example, tomorrow morning"
              />
            </label>
            <label>
              Message to the customer
              <textarea
                rows={4}
                value={pitch}
                onChange={(event) => setPitch(event.target.value)}
                placeholder="Explain how you will complete the work."
              />
            </label>
            <Button disabled={submitting} onClick={() => void submitQuote()}>
              {submitting ? "Sending proposal…" : ownQuote ? "Update proposal" : "Place a bid"}
            </Button>
            {message && (
              <p className={message.startsWith("Your quote") ? "" : "form-error"} role="status">
                {message}
              </p>
            )}
          </div>
        )}
        {(job.status === "open" || ownQuote?.status === "accepted" || ownQuote?.status === "submitted") && <Button variant="secondary" icon="message" onClick={() => void openConversation()}>Send message to customer</Button>}
        <Button variant="ghost" onClick={() => go("feed")}>
          Back to job feed
        </Button>
      </section>
    </div>
  )
}

function JobManagement({ go }: { go: (screen: Screen) => void }) {
  const auth = useAuth()
  const { updateStore } = useDemoStore()
  const { jobs, loading, error, refresh } = useMarketplaceJobs("provider")
  const [actionError, setActionError] = useState("")
  const [workNotes, setWorkNotes] = useState<Record<string, string>>({})
  const transition = async (
    jobId: string,
    action: "start" | "submit-completion",
    note?: string,
  ) => {
    try {
      setActionError("")
      await auth.transitionMarketplaceJob(jobId, action, note ? { note } : undefined)
      await refresh()
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "We couldn’t update this job. Please try again.",
      )
    }
  }
  const openConversation = async (jobId: string) => {
    try {
      const conversation = await auth.openMarketplaceConversation(jobId, "provider")
      updateStore({ selectedJobId: jobId, selectedMarketplaceConversationId: conversation.id })
      go("chat")
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : "Could not open this job conversation.")
    }
  }
  return (
    <div className="content">
      <PageHeader
        title="My jobs"
        description="Manage jobs awarded to you by customers."
      />
      {(error || actionError) && (
        <p className="form-error" role="alert">
          {actionError || error}
        </p>
      )}
      <div className="job-list">
        {jobs.map((job) => (
          <section className="card job-summary" key={job.id}>
            <Badge>{job.status.replace(/_/g, " ")}</Badge>
            <h2>{job.title}</h2>
            <p>
              {job.locationLabel} · Job ID {job.jobReference}
            </p>
            {job.dueAt && <p className="caption">Work due {new Date(job.dueAt).toLocaleString()}</p>}
            {job.completionNote && job.status === "completion_pending" && (
              <div className="safe-note"><span><strong>Work submitted</strong><br />{job.completionNote}</span></div>
            )}
            {job.revisionNote && job.status === "revision_requested" && (
              <div className="safe-note"><span><strong>Customer requested a revision</strong><br />{job.revisionNote}</span></div>
            )}
            <div className="card-actions">
              {job.status === "awarded" && (
                <Button icon="play" onClick={() => void transition(job.id, "start")}>
                  Start work
                </Button>
              )}
              {job.status !== "open" && <Button variant="secondary" icon="message" onClick={() => void openConversation(job.id)}>Message customer</Button>}
              {(job.status === "in_progress" || job.status === "revision_requested") && (
                <div className="form-card">
                  <label>{job.status === "revision_requested" ? "Describe the revised work" : "Describe the work you completed"}
                    <textarea rows={4} minLength={10} maxLength={5000} value={workNotes[job.id] ?? ""} onChange={(event) => setWorkNotes((current) => ({ ...current, [job.id]: event.target.value }))} placeholder="Summarize the completed work and anything the customer should know." />
                  </label>
                  <Button disabled={(workNotes[job.id] ?? "").trim().length < 10} onClick={() => void transition(job.id, "submit-completion", workNotes[job.id]?.trim())}>{job.status === "revision_requested" ? "Submit revised work" : "Submit work for review"}</Button>
                </div>
              )}
              {job.status === "completion_pending" && (
                <p className="caption">Waiting for the customer to confirm completion.</p>
              )}
              {job.status === "completed" && (
                <p className="caption">The customer confirmed this job complete.</p>
              )}
            </div>
          </section>
        ))}
        {loading && <p className="center-note">Loading your awarded jobs…</p>}
        {!loading && !error && !jobs.length && (
          <EmptyState
            title="No jobs awarded yet"
            detail="When a customer accepts your quote, the job will appear here."
            action={() => go("feed")}
            actionLabel="Browse open jobs"
          />
        )}
      </div>
    </div>
  )
}

function ListingCreate({ go }: { go: (screen: Screen) => void }) {
  const auth = useAuth()
  const [listingCount, setListingCount] = useState<number | null>(null)
  const [verificationStatus, setVerificationStatus] = useState("not_started")
  const [limitLoading, setLimitLoading] = useState(true)
  const [form, setForm] = useState({ title: "", description: "", category: "Cleaning", locationLabel: "", budget: "" })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [mediaError, setMediaError] = useState("")
  const [media, setMedia] = useState<(ServiceListingMedia & { previewUrl: string; uploading: boolean })[]>([])
  const previewUrls = useRef(new Set<string>())
  const listingLimit = verificationStatus === "verified" ? Number.POSITIVE_INFINITY : 10
  const listingLimitReached = listingCount !== null && listingCount >= listingLimit

  useEffect(() => {
    void Promise.all([
      auth.getServiceListings("provider", "mine"),
      auth.getProviderVerification(),
    ]).then(([listings, verification]) => {
      setListingCount(listings.length)
      setVerificationStatus(verification.status)
    }).catch((caught: unknown) => {
      setError(caught instanceof Error ? caught.message : "Could not load your listing allowance.")
    }).finally(() => setLimitLoading(false))
  }, [auth.getServiceListings, auth.getProviderVerification])

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const addFiles = async (files: File[]) => {
    setMediaError("")
    setUploading(true)
    let imageCount = media.filter((item) => item.contentType.startsWith("image/")).length
    let videoCount = media.filter((item) => item.contentType.startsWith("video/")).length

    try {
      for (const file of files) {
        const isImage = file.type.startsWith("image/")
        const isVideo = file.type.startsWith("video/")
        if (!isImage && !isVideo) {
          setMediaError("Choose JPG, PNG, WebP, MP4, or WebM files.")
          continue
        }
        if (file.size > 6 * 1024 * 1024) {
          setMediaError(`${file.name} is larger than 6 MB. Please choose a smaller file.`)
          continue
        }
        if (isImage && imageCount >= 6) {
          setMediaError("Add up to six photos.")
          continue
        }
        if (isVideo && videoCount >= 1) {
          setMediaError("Add one video per listing.")
          continue
        }
        if (isImage) imageCount += 1
        if (isVideo) videoCount += 1

        const previewUrl = URL.createObjectURL(file)
        previewUrls.current.add(previewUrl)
        setMedia((current) => [...current, {
          path: "",
          contentType: file.type,
          size: file.size,
          previewUrl,
          uploading: true,
        }])
        try {
          const uploaded = await auth.uploadServiceListingMedia(file)
          setMedia((current) => current.map((item) => item.previewUrl === previewUrl
            ? { ...uploaded, previewUrl, uploading: false }
            : item))
        } catch (caught) {
          previewUrls.current.delete(previewUrl)
          URL.revokeObjectURL(previewUrl)
          setMedia((current) => current.filter((item) => item.previewUrl !== previewUrl))
          setMediaError(caught instanceof Error ? caught.message : "Could not upload this file.")
        }
      }
    } finally {
      setUploading(false)
    }
  }

  const removeMedia = (item: ServiceListingMedia & { previewUrl: string }) => {
    previewUrls.current.delete(item.previewUrl)
    URL.revokeObjectURL(item.previewUrl)
    setMedia((current) => current.filter((candidate) => candidate.previewUrl !== item.previewUrl))
    if (item.path) void auth.deleteServiceListingMedia(item.path).catch((caught: unknown) => {
      setMediaError(caught instanceof Error ? caught.message : "Could not remove this file.")
    })
  }

  const submit = async () => {
    if (listingLimitReached) {
      setError(verificationStatus === "verified"
        ? "Your verified provider account can publish without a listing limit."
        : "You have reached the 10-listing limit. Submit your ID for review; approval unlocks unlimited listings.")
      return
    }
    if (!form.title.trim() || !form.description.trim() || !form.locationLabel.trim()) { setError("Add a title, description, and service area."); return }
    if (uploading || media.some((item) => !item.path)) { setError("Wait for all media to finish uploading."); return }
    setSaving(true)
    try {
      await auth.createServiceListing({ title: form.title.trim(), description: form.description.trim(), category: form.category, locationLabel: form.locationLabel.trim(), budgetMinor: form.budget.trim() ? Math.round(Number(form.budget) * 100) : null, media: media.map(({ path, contentType, size }) => ({ path, contentType, size })) })
      setListingCount((count) => count === null ? null : count + 1)
      go("management")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not publish this listing.") }
    finally { setSaving(false) }
  }
  return (
    <div className="content narrow">
      <PageHeader title="Publish a service profile" description="Show customers your services. Customers hire through job posts and reviewed provider proposals." />
      <p className="demo-notice" role="status">{limitLoading ? "Checking your provider listing allowance…" : verificationStatus === "verified" ? "ID approved: you can publish unlimited service listings." : `${verificationStatus === "in_review" ? "ID review pending" : "ID verification not submitted"}: ${listingCount ?? 0} of 10 listings used. Approval unlocks unlimited listings.`}</p>
      {!limitLoading && verificationStatus !== "verified" && listingCount !== null && listingCount >= listingLimit && <div className="card-actions">{verificationStatus === "in_review" ? <p role="status">Your identity review is pending. Approval will unlock unlimited listings.</p> : <Button onClick={() => go("providerVerification")}>Submit identity verification</Button>}</div>}
      <section className="form-card listing-create-form">
        <label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label>Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{["Cleaning", "Plumbing", "Electrical", "Care", "Grooming", "Tutoring", "Moving", "Repairs"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Description<textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
        <label>Service area<input value={form.locationLabel} onChange={(event) => setForm({ ...form, locationLabel: event.target.value })} /></label>
        <label>Price (KES, optional)<input inputMode="decimal" value={form.budget} onChange={(event) => setForm({ ...form, budget: event.target.value })} /></label>
        <div className="listing-media-upload">
          <div><strong>Photos and video</strong><p>Add up to 6 photos and 1 short video. JPG, PNG, WebP, MP4, or WebM · up to 6 MB each.</p></div>
          <label className="listing-media-picker">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
              multiple
              disabled={uploading || saving || limitLoading || listingLimitReached}
              onChange={(event) => {
                const files = Array.from(event.currentTarget.files ?? [])
                event.currentTarget.value = ""
                void addFiles(files)
              }}
            />
            {uploading ? "Uploading…" : "Choose photos or video"}
          </label>
          <p className="listing-media-privacy">Listing media is visible to customers. Only upload images or videos you own, and avoid showing private addresses, contact details, or people without their permission.</p>
          {mediaError && <p className="form-error" role="alert">{mediaError}</p>}
          {!!media.length && <div className="listing-media-gallery listing-media-previews">{media.map((item) => <div className="listing-media-preview" key={item.previewUrl}>{item.contentType.startsWith("video/") ? <video className="listing-media-item" src={item.previewUrl} controls playsInline preload="metadata" /> : <img className="listing-media-item" src={item.previewUrl} alt="Preview of listing media" />}{item.uploading && <span className="listing-media-status">Uploading…</span>}<button type="button" className="listing-media-remove" disabled={item.uploading} onClick={() => removeMedia(item)} aria-label="Remove attached media">Remove</button></div>)}</div>}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <Button disabled={saving || uploading || limitLoading || listingLimitReached || media.some((item) => !item.path)} onClick={() => void submit()}>{saving ? "Publishing…" : "Publish listing"}</Button>
      </section>
    </div>
  )
}

function ProviderListings({ go }: { go: (screen: Screen) => void }) {
  const auth = useAuth()
  const [listings, setListings] = useState<import("../../auth/AuthProvider").ServiceListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const refresh = async () => { try { setListings(await auth.getServiceListings("provider", "mine")); setError("") } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load your listings.") } finally { setLoading(false) } }
  useEffect(() => {
    void refresh()
    let unsubscribe: (() => void) | undefined
    try { unsubscribe = auth.subscribeMarketplaceChanges(() => void refresh()) } catch { /* Realtime is optional; manual refresh remains available. */ }
    const poll = window.setInterval(() => void refresh(), 20000)
    return () => { unsubscribe?.(); window.clearInterval(poll) }
  }, [auth.subscribeMarketplaceChanges])
  const transition = async (id: string, action: "start" | "submit-completion" | "close") => { try { await auth.transitionServiceListing(id, action); await refresh() } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not update listing."); await refresh() } }
  return <div className="content"><PageHeader title="My service profiles and legacy bookings" description="Customers can browse these service profiles. New work starts with a customer job post and provider proposals; existing bookings remain available below." action={<Button onClick={() => go("listingCreate")}>Publish a service profile</Button>} />{error && <p className="form-error" role="alert">{error}</p>}{loading ? <p role="status">Loading your service profiles…</p> : listings.length ? <div className="job-list">{listings.map((item) => <section className="card job-summary" key={item.id}><Badge>{item.status.replace(/_/g, " ")}</Badge><h2>{item.title}</h2><p>{item.category} · {item.locationLabel}</p><ListingMediaGallery media={item.media ?? []} /><p>{item.customerName ? `Existing booking with ${item.customerName}` : "Service profile — new customers engage by posting a job and reviewing proposals."}</p>{item.claimExpiresAt && <p className="caption">Existing booking start deadline: {new Date(item.claimExpiresAt).toLocaleString()}</p>}<div className="card-actions">{item.status === "open" && <Button variant="secondary" onClick={() => void transition(item.id, "close")}>Unpublish service</Button>}{item.status === "claimed" && <Button onClick={() => void transition(item.id, "start")}>Start existing booking</Button>}{item.status === "in_progress" && <Button onClick={() => void transition(item.id, "submit-completion")}>Submit completion</Button>}</div></section>)}</div> : <EmptyState title="No service profiles yet" detail="Publish your services so customers can view your profile. They will hire by posting a job and reviewing proposals." />}</div>
}

function Wallet() {
  const auth = useAuth()
  const [payments, setPayments] = useState<import("../../auth/AuthProvider").ProviderWalletPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [workingId, setWorkingId] = useState("")
  const refresh = useCallback(async () => {
    try { setPayments(await auth.getProviderWalletPayments()); setError("") }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load your wallet.") }
    finally { setLoading(false) }
  }, [auth.getProviderWalletPayments])
  useEffect(() => { void refresh() }, [refresh])
  const paid = payments.filter((payment) => payment.status === "paid")
  const earnings = paid.reduce((sum, payment) => sum + payment.earningsMinor, 0)
  const awaiting = payments.filter((payment) => payment.status === "awaiting_payment" || payment.status === "reported").reduce((sum, payment) => sum + payment.earningsMinor, 0)
  const format = (minor: number, currency = "KES") => `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const confirm = async (jobId: string) => {
    setWorkingId(jobId); setError("")
    try { await auth.confirmJobPayment(jobId); await refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not confirm payment.") }
    finally { setWorkingId("") }
  }
  const dispute = async (jobId: string) => {
    const reason = window.prompt("Tell us what is wrong with this reported payment (at least 10 characters).")
    if (!reason?.trim()) return
    setWorkingId(jobId); setError("")
    try { await auth.disputeJobPayment(jobId, reason.trim()); await refresh() }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open a payment dispute.") }
    finally { setWorkingId("") }
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="Wallet"
        description="Track your own earnings from completed jobs."
        action={<Button variant="secondary" onClick={() => void refresh()}>Refresh wallet</Button>}
      />
      {!error && <div className="dashboard-grid">
        <Metric label="Confirmed worker earnings" value={format(earnings)} />
        <Metric label="Your earnings awaiting confirmation" value={format(awaiting)} />
      </div>}
      <section className="card">
        <div className="section-title">
          <h2>Job payment history</h2>
        </div>
        {loading ? <p role="status">Loading wallet…</p> : error ? <p className="form-error" role="alert">{error}</p> : payments.length ? <div className="table-wrap"><table><thead><tr><th>#</th><th>Job</th><th>Hirer</th><th>Your earnings</th><th>Payment method</th><th>Status</th><th>Action</th></tr></thead><tbody>{payments.map((payment, index) => <tr key={payment.id}><td>{index + 1}</td><td><strong>{payment.jobReference}</strong><small className="caption">{payment.jobTitle}</small><small className="caption">{payment.paymentReference}</small></td><td>{payment.customerName}</td><td><strong>{format(payment.earningsMinor, payment.currency)}</strong></td><td>{payment.method?.replace("_", " ") ?? "—"}</td><td><Badge tone={payment.status === "paid" ? "green" : payment.status === "disputed" ? "red" : "amber"}>{payment.status.replaceAll("_", " ")}</Badge><small className="caption">{payment.confirmedAt ? new Date(payment.confirmedAt).toLocaleDateString() : payment.reportedAt ? `Reported ${new Date(payment.reportedAt).toLocaleDateString()}` : ""}</small></td><td>{payment.status === "reported" && payment.reportedByUserId !== auth.profile?.id ? <div className="card-actions"><Button disabled={workingId === payment.jobId} onClick={() => void confirm(payment.jobId)}>Confirm received</Button><Button variant="secondary" disabled={workingId === payment.jobId} onClick={() => void dispute(payment.jobId)}>Dispute</Button></div> : payment.status === "disputed" ? <Badge tone="amber">Under review</Badge> : payment.status === "paid" ? <Badge>Confirmed</Badge> : <span>Waiting for hirer</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="No job payments yet" detail="After payment for a completed job is reported and you confirm receiving your share, earnings will appear here." />}
      </section>
      <p className="caption">This page only shows payments made to you. Cash and manual transfers require your confirmation. Withdrawals are not yet connected to a payment provider.</p>
    </div>
  )
}

function Reputation() {
  const auth = useAuth()
  const [reviewPage, setReviewPage] = useState<import("../../auth/AuthProvider").ServiceListingReviewPage | null>(null)
  const [error, setError] = useState("")
  const refreshReviews = () => auth.getServiceListingReviews("provider").then(setReviewPage).catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load reviews."))
  useEffect(() => { void refreshReviews() }, [auth.getServiceListingReviews])
  const average = reviewPage?.received.length ? reviewPage.received.reduce((sum, item) => sum + item.rating, 0) / reviewPage.received.length : null
  return (
    <div className="content console-content">
      <PageHeader
        title="Your reputation"
        description="Strong service builds lasting trust"
      />
      <div className="reputation-hero">
        <div>
          <span>Your rating</span>
          <strong>{average === null ? "—" : average.toFixed(1)}</strong>
          <div className="rating">{reviewPage ? reviewPage.received.length + " completed-job reviews" : "Loading reviews…"}</div>
        </div>
        <div className="score-ring">
          <strong>{reviewPage ? reviewPage.received.length : "—"}</strong>
          <span>Completed jobs</span>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <h2>Reviews about you</h2>
          {error && <p className="form-error" role="alert">{error}</p>}
          {!reviewPage ? <p role="status">Loading reviews…</p> : reviewPage.received.length === 0 ? <p>No customer reviews yet.</p> : reviewPage.received.map((review) => <article className="review-card" key={review.id}><div className="review-head"><div><strong>{review.reviewerName}</strong><small>{review.listingTitle} · {new Date(review.createdAt).toLocaleDateString()}</small></div><span className="rating">{"â˜…".repeat(review.rating)}{"â˜†".repeat(5 - review.rating)}</span></div>{review.comment && <p>{review.comment}</p>}</article>)}
</section>
        <section className="card tips">
          <h2>Review customers</h2>
          {!reviewPage ? null : reviewPage.pending.length === 0 ? <p className="caption">No completed jobs are waiting for your review.</p> : reviewPage.pending.map((item) => <ListingReviewForm key={item.listingId} listingId={item.listingId} listingTitle={item.listingTitle} revieweeName={item.revieweeName} onSaved={() => void refreshReviews()} />)}
        </section>
      </div>
    </div>
  )
}

function Training() {
  const { store, updateStore } = useDemoStore()
  const courses = [
    "Home electrical safety",
    "Customer care essentials",
    "M-Pesa & job payments",
    "Growing your service business",
  ]
  return (
    <div className="content console-content">
      <PageHeader
        title="Training centre"
        description="Build skills, earn certificates, win more work"
      />
      <div className="featured-course">
        <div>
          <Badge>Recommended</Badge>
          <h2>Home electrical safety</h2>
          <p>Learn safe diagnosis, PPE standards and customer handover.</p>
          <Button
            onClick={() =>
              updateStore({
                completedLessons: store.completedLessons.includes(courses[0])
                  ? store.completedLessons
                  : [...store.completedLessons, courses[0]],
              })
            }
          >
            {store.completedLessons.includes(courses[0])
              ? "Course completed"
              : "Complete demo course"}
          </Button>
        </div>
        <div className="course-progress">
          <strong>
            {store.completedLessons.includes(courses[0]) ? "100%" : "64%"}
          </strong>
          <span>
            {store.completedLessons.includes(courses[0])
              ? "Certificate earned"
              : "3 of 5 lessons"}
          </span>
        </div>
      </div>
      <div className="course-grid">
        {courses.slice(1).map((x, i) => (
          <section className="card course-card" key={x}>
            <span>0{i + 1}</span>
            <h3>{x}</h3>
            <p>Short practical lessons · {20 + i * 5} min</p>
            <Badge tone="slate">
              {store.completedLessons.includes(x)
                ? "Certificate earned"
                : "Not started"}
            </Badge>
            <Button
              variant="secondary"
              onClick={() =>
                updateStore({
                  completedLessons: [
                    ...new Set([...store.completedLessons, x]),
                  ],
                })
              }
            >
              {store.completedLessons.includes(x)
                ? "Completed"
                : "Complete demo course"}
            </Button>
          </section>
        ))}
      </div>
    </div>
  )
}

function Plans() {
  const [plan, setPlan] = useState("Basic")
  return (
    <div className="content">
      <PageHeader
        title="Provider plans"
        description="Compare demo plans; no real billing is enabled."
      />
      <DemoNotice>
        Plan selection is saved only for this page session. Subscription billing
        needs a backend.
      </DemoNotice>
      <div className="course-grid">
        {[
          ["Basic", "KES 0", "Standard listing · 5 bids per month"],
          [
            "Pro",
            "KES 499 / month",
            "More bids · profile insights · priority support",
          ],
          [
            "Elite",
            "KES 1,499 / month",
            "Featured placement · advanced analytics · boosts",
          ],
        ].map(([name, price, detail]) => (
          <section className="card course-card" key={name}>
            <Badge tone={name === plan ? "green" : "slate"}>
              {name === plan ? "Selected" : "Plan"}
            </Badge>
            <h2>{name}</h2>
            <strong>{price}</strong>
            <p>{detail}</p>
            <Button
              variant={name === plan ? "secondary" : "primary"}
              onClick={() => setPlan(name)}
            >
              {name === plan ? "Current demo plan" : "Select demo plan"}
            </Button>
          </section>
        ))}
      </div>
    </div>
  )
}

function ProviderAnalytics() {
  return (
    <div className="content console-content">
      <PageHeader
        title="Performance analytics"
        description="Illustrative local metrics for your provider profile."
      />
      <div className="metrics">
        <Metric label="Profile views" value="1,284" delta="+12%" />
        <Metric label="Quote requests" value="86" />
        <Metric label="Bid win rate" value="34%" />
        <Metric label="Repeat customers" value="62%" />
      </div>
      <section className="card chart-card">
        <h2>Weekly profile views</h2>
        <div className="bar-chart">
          {[35, 48, 52, 44, 68, 74, 88].map((value, index) => (
            <i key={index} style={{ height: `${value}%` }} />
          ))}
        </div>
        <p className="caption">
          Demo data only; analytics are not connected to actual traffic.
        </p>
      </section>
    </div>
  )
}

function AdCreator() {
  const [submitted, setSubmitted] = useState(false)
  return (
    <div className="content">
      <PageHeader
        title="Promote your service"
        description="Create a clearly labelled campaign for approved consumer placements."
      />
      <DemoNotice>
        Ad submission is simulated. This prototype never renders provider ads in
        the dashboard.
      </DemoNotice>
      <div className="builder-grid">
        <section className="form-card">
          <label>
            Short headline
            <input defaultValue="Reliable plumbing, available today" />
          </label>
          <label>
            Target category
            <select>
              <option>Plumbing</option>
              <option>Cleaning</option>
              <option>Repairs</option>
            </select>
          </label>
          <div className="field-pair">
            <label>
              Location
              <input defaultValue="Nairobi" />
            </label>
            <label>
              Daily budget (KES)
              <input inputMode="numeric" defaultValue="500" />
            </label>
          </div>
          <label>
            Duration
            <select>
              <option>7 days</option>
              <option>14 days</option>
              <option>30 days</option>
            </select>
          </label>
          <label className="upload">
            <Icon name="plus" />
            <span>
              Upload creative
              <input type="file" accept="image/*" />
            </span>
          </label>
          <Button onClick={() => setSubmitted(true)}>
            Submit for demo review
          </Button>
          {submitted && (
            <DemoNotice>
              Your sample campaign was submitted locally for approval.
            </DemoNotice>
          )}
        </section>
        <aside>
          <div className="eyebrow">
            Customer preview · approved placement only
          </div>
          <Sponsored />
          <p className="caption">
            Ads are shown only on login/landing and consumer dashboard slots;
            never in job, search or payment flows.
          </p>
        </aside>
      </div>
    </div>
  )
}

export type ProviderScreenKey =
  | "providerHome"
  | "chat"
  | "listingCreate"
  | "feed"
  | "onboarding"
  | "providerVerification"
  | "jobDetail"
  | "management"
  | "wallet"
  | "reputation"
  | "training"
  | "plans"
  | "analytics"
  | "ads"

export default function ProviderScreens({ screen, go }: { screen: ProviderScreenKey; go: (screen: Screen) => void }) {
  switch (screen) {
    case "providerHome": return <ProviderDashboard go={go} />
    case "chat": return <ServiceMessages role="provider" />
    case "feed": return <JobFeed go={go} />
    case "onboarding": return <ProviderOnboarding />
    case "providerVerification": return <ProviderVerification />
    case "jobDetail": return <ProviderJobDetail go={go} />
    case "providerBids": return <ProviderBids go={go} />
    case "management": return <JobManagement go={go} />
    case "listingCreate": return <ListingCreate go={go} />
    case "wallet": return <Wallet />
    case "reputation": return <Reputation />
    case "training": return <Training />
    case "plans": return <Plans />
    case "analytics": return <ProviderAnalytics />
    case "ads": return <AdCreator />
    default: return null
  }
}
