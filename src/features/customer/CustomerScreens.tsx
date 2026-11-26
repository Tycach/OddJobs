import { useCallback, useEffect, useRef, useState } from "react"
import { useAuth, type AdminAuditEvent, type MarketplaceProvider, type ServiceListingMedia } from "../../auth/AuthProvider"
import { useDemoStore } from "../../demo/context"
import type { Screen } from "../../demo/model"
import { useMarketplaceJobData, useMarketplaceJobs, useMarketplaceProviders } from "../marketplace/hooks"
import { JobTimeline } from "../marketplace/JobTimeline"
import ListingMediaGallery from "../marketplace/ListingMediaGallery"
import { ListingReviewForm } from "../marketplace/ListingReviewForm"
import { ServiceMessages } from "../marketplace/ServiceMessages"
import { Avatar, Badge, Button, Icon, Metric, PageHeader, ProviderCard, Sponsored } from "../../shared/components/WorkspaceUi"
import { ProviderDirectoryCard, ProviderProfileModal } from "./ProviderDirectory"

const photos = {
  amina: "https://images.unsplash.com/photo-1764166471609-c75e2c6bfdb2?auto=format&fit=crop&w=500&q=80",
  otieno: "https://images.unsplash.com/photo-1592896653886-98a644767f2f?auto=format&fit=crop&w=500&q=80",
  wanjiku: "https://images.unsplash.com/photo-1713746965378-0140784d2ab9?auto=format&fit=crop&w=500&q=80",
  work: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80",
}
function Home({
  go,
  onOpenProvider,
}: {
  go: (s: Screen) => void
  onOpenProvider: (providerId: string) => void
}) {
  const { store } = useDemoStore()
  const auth = useAuth()
  const profile = auth.profile
  const { providers, loading, error } = useMarketplaceProviders("", "", 6)
  const categories = [
    ["Cleaning", "C"],
    ["Plumbing", "P"],
    ["Electrical", "E"],
    ["Care", "C"],
    ["Grooming", "G"],
    ["Tutoring", "T"],
    ["Moving", "M"],
    ["More", "..."],
  ]
  return (
    <div className="content consumer-content">
      <section className="welcome-row">
        <div>
          <span>Good morning, {profile?.displayName ?? "Wanjiku"}</span>
          <h1>What do you need help with?</h1>
        </div>
        <Button onClick={() => go("workFeed")}>Find providers</Button>
        <Avatar src={auth.getProfileAvatarUrl(profile?.avatarPath)} name={profile?.displayName ?? "Your profile"} />
      </section>
      <button className="search-box" onClick={() => go("search")}>
        <Icon name="search" />
        <span>Search cleaning, plumbing, tutoring…</span>
      </button>
      <section>
        <div className="section-title">
          <h2>Browse services</h2>
          <button onClick={() => go("search")}>See all</button>
        </div>
        <div className="category-grid">
          {categories.map(([name, icon]) => (
            <button key={name} onClick={() => go("search")}>
              <span>{icon}</span>
              <label>{name}</label>
            </button>
          ))}
        </div>
      </section>
      {!store.reduceAds && <Sponsored />}
      <section>
        <div className="section-title">
          <h2>Available near you</h2>
          <button onClick={() => go("search")}>Browse all providers</button>
        </div>
        <div className="providers-row">
          {loading && <p role="status">Loading approved providers…</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {providers.map((provider) => (
            <ProviderDirectoryCard
              key={provider.id}
              provider={provider}
              onClick={() => onOpenProvider(provider.id)}
            />
          ))}
          {!loading && !error && !providers.length && (
            <p className="caption">No approved providers are listed yet. You can still post a job and receive quotes.</p>
          )}
        </div>
      </section>
      <section className="trust-panel">
        <Icon name="shield" size={28} />
        <div>
          <strong>Hire with confidence</strong>
          <span>
            Approved providers can quote on your jobs. Payments are not enabled yet.
          </span>
        </div>
      </section>
    </div>
  )
}

function HiringDashboard({ go }: { go: (screen: Screen) => void }) {
  const { jobs, loading, error, refresh } = useMarketplaceJobs("consumer")
  const openJobs = jobs.filter((job) => job.status === "open")
  const jobsWithProposals = openJobs.filter((job) => job.quoteCount > 0).length
  const proposalsToReview = openJobs.reduce((total, job) => total + job.quoteCount, 0)
  const activeJobs = jobs.filter((job) => ["awarded", "in_progress", "completion_pending", "revision_requested"].includes(job.status))
  const completedJobs = jobs.filter((job) => job.status === "completed").length
  const value = (count: number) => loading? "…" : error? "—" : String(count)
  const nextJob = openJobs.find((job) => job.quoteCount > 0) ?? openJobs[0] ?? activeJobs[0]
  return <div className="content console-content">
    <PageHeader eyebrow="Hiring workspace" title="Your hiring dashboard" description="See your job posts, proposals, and active work in one place." action={<Button onClick={() => go("post")}>Post a job</Button>} />
    <div className="metrics">
      <Metric label="Open job posts" value={value(openJobs.length)} />
      <Metric label="Proposals to review" value={value(proposalsToReview)} />
      <Metric label="Active jobs" value={value(activeJobs.length)} />
      <Metric label="Completed jobs" value={value(completedJobs)} />
    </div>
    {error && <p className="form-error" role="alert">Your live job summary could not load. {error} <button className="btn btn-ghost" onClick={() => void refresh()}>Retry</button></p>}
    <div className="dashboard-grid">
      <section className="card">
        <div className="section-title"><h2>Next step</h2><Badge>{loading? "Loading" : nextJob? nextJob.status.replace(/_/g, " ") : "Ready"}</Badge></div>
        <h3>{nextJob?.title ?? "Find the right worker"}</h3>
        <p>{nextJob? `${nextJob.locationLabel} · ${nextJob.quoteCount} proposal${nextJob.quoteCount === 1? "" : "s"}` : "Post a job to receive proposals from workers."}</p>
        <div className="card-actions">
          <Button onClick={() => go(nextJob? "jobs" : "post")}>{nextJob? "Review my jobs" : "Post a job"}</Button>
          <Button variant="secondary" onClick={() => go("workFeed")}>Browse workers</Button>
        </div>
      </section>
      <section className="card">
        <h2>Hiring resources</h2>
        <p>Learn how to write a useful job post, compare proposals, and agree on the work before it starts.</p>
        <Button variant="secondary" onClick={() => go("training")}>Open hiring guide</Button>
      </section>
    </div>
    <div className="card-actions"><Button variant="ghost" onClick={() => go("hiringAnalytics")}>View hiring analytics</Button><Button variant="ghost" onClick={() => go("saved")}>View saved workers</Button></div>
  </div>
}

function HiringAnalytics({ go }: { go: (screen: Screen) => void }) {
  const { jobs, loading, error, refresh } = useMarketplaceJobs("consumer")
  const open = jobs.filter((job) => job.status === "open")
  const awarded = jobs.filter((job) => ["awarded", "in_progress", "completion_pending", "revision_requested", "completed"].includes(job.status))
  const completed = jobs.filter((job) => job.status === "completed").length
  const proposalCount = jobs.reduce((sum, job) => sum + job.quoteCount, 0)
  const jobsWithProposals = jobs.filter((job) => job.quoteCount > 0).length
  const hired = jobs.filter((job) => ["awarded", "in_progress", "completion_pending", "revision_requested", "completed"].includes(job.status)).length
  const hireRate = jobsWithProposals? Math.round((hired / jobsWithProposals) * 100) : null
  const metric = (count: number | string) => loading? "…" : error? "—" : String(count)
  return <div className="content console-content">
    <PageHeader title="Hiring analytics" description="Live activity from your job posts and worker proposals." action={<Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">Analytics could not load. {error}</p>}
    <div className="metrics">
      <Metric label="Jobs posted" value={metric(jobs.length)} />
      <Metric label="Open jobs" value={metric(open.length)} />
      <Metric label="Proposals received" value={metric(proposalCount)} />
      <Metric label="Jobs awarded" value={metric(awarded.length)} />
    </div>
    <div className="dashboard-grid">
      <section className="card"><h2>Hiring outcomes</h2><div className="review-facts"><span><small>Jobs with proposals</small><b>{metric(jobsWithProposals)}</b></span><span><small>Hire rate</small><b>{loading? "…" : error? "—" : hireRate === null? "No proposals yet" : `${hireRate}%`}</b></span><span><small>Completed jobs</small><b>{metric(completed)}</b></span></div><p className="caption">Hire rate is awarded jobs divided by jobs that received at least one proposal. No payment or spending figures are shown.</p></section>
      <section className="card"><h2>Keep your jobs moving</h2><p>Review proposals promptly and keep job details current so workers can make informed offers.</p><div className="card-actions"><Button onClick={() => go("jobs")}>Review proposals</Button><Button variant="secondary" onClick={() => go("post")}>Post another job</Button></div></section>
    </div>
  </div>
}

function HiringGuide({ go }: { go: (screen: Screen) => void }) {
  const guides = [
    ["Write a clear job post", "Describe the task, location, timing, and what a successful result looks like. Add photos only when they help explain the work."],
    ["Compare proposals fairly", "Review each worker’s price, availability, experience, profile, and customer reviews. Ask for clarification before choosing."],
    ["Agree on the scope", "Confirm what is included, when the work should happen, and any materials or access the worker needs."],
    ["Track the job", "Accept one proposal to award the job. Follow progress in My jobs and confirm completion after reviewing the submitted work."],
  ]
  return <div className="content narrow"><PageHeader eyebrow="Hiring workspace" title="Hiring guide" description="Practical steps for posting a job and working with independent workers." /><div className="job-list">{guides.map(([title, detail], index) => <section className="card" key={title}><Badge>Step {index + 1}</Badge><h2>{title}</h2><p>{detail}</p></section>)}</div><section className="card"><h2>Ready to hire?</h2><p>Post a job and compare proposals from workers who are available for your task.</p><div className="card-actions"><Button onClick={() => go("post")}>Post a job</Button><Button variant="secondary" onClick={() => go("jobs")}>View my jobs</Button></div></section></div>
}

function PostJob({ go }: { go: (s: Screen) => void }) {
  const { updateStore } = useDemoStore()
  const auth = useAuth()
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("")
  const [serviceCategories, setServiceCategories] = useState<{ name: string; slug: string }[]>([])
  const [description, setDescription] = useState("")
  const [budget, setBudget] = useState("")
  const [location, setLocation] = useState("")
  const [requestedDate, setRequestedDate] = useState("")
  const [applicationDeadline, setApplicationDeadline] = useState(
    () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  )
  const [dueDate, setDueDate] = useState("")
  const [locationMode, setLocationMode] = useState<"onsite" | "remote" | "flexible">("onsite")
  const [jobPin, setJobPin] = useState<{ latitude: number; longitude: number } | null>(null)
  const [shareExactLocation, setShareExactLocation] = useState(false)
  const [attachments, setAttachments] = useState<(ServiceListingMedia & { previewUrl: string; uploading: boolean })[]>([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const previewUrls = useRef(new Set<string>())
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])
  useEffect(() => {
    void auth.getMarketplaceCategories().then((items) => {
      setServiceCategories(items)
      setCategory((current) => items.some((item) => item.name === current)? current : items[0]?.name ?? "")
    }).catch((caught: unknown) => setError(caught instanceof Error? caught.message : "Could not load service categories."))
  }, [auth.getMarketplaceCategories])
  const addFiles = async (files: File[]) => {
    setUploadingMedia(true)
    setError("")
    let imageCount = attachments.filter((item) => item.contentType.startsWith("image/")).length
    let videoCount = attachments.filter((item) => item.contentType.startsWith("video/")).length
    try {
      for (const file of files) {
        const isImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type)
        const isVideo = ["video/mp4", "video/webm"].includes(file.type)
        if (!isImage && !isVideo) { setError("Choose JPG, PNG, WebP, MP4, or WebM files."); continue }
        if (file.size > 6 * 1024 * 1024) { setError(`${file.name} is larger than 6 MB.`); continue }
        if (isImage && imageCount >= 6) { setError("Attach up to six photos."); continue }
        if (isVideo && videoCount >= 1) { setError("Attach one video per job."); continue }
        if (isImage) imageCount += 1
        if (isVideo) videoCount += 1
        const previewUrl = URL.createObjectURL(file)
        previewUrls.current.add(previewUrl)
        setAttachments((current) => [...current, { path: "", contentType: file.type, size: file.size, previewUrl, uploading: true }])
        try {
          const uploaded = await auth.uploadServiceListingMedia(file)
          setAttachments((current) => current.map((item) => item.previewUrl === previewUrl? { ...uploaded, previewUrl, uploading: false } : item))
        } catch (caught) {
          previewUrls.current.delete(previewUrl)
          URL.revokeObjectURL(previewUrl)
          setAttachments((current) => current.filter((item) => item.previewUrl !== previewUrl))
          setError(caught instanceof Error? caught.message : "Could not upload this attachment.")
        }
      }
    } finally { setUploadingMedia(false) }
  }
  const removeAttachment = (item: ServiceListingMedia & { previewUrl: string }) => {
    previewUrls.current.delete(item.previewUrl)
    URL.revokeObjectURL(item.previewUrl)
    setAttachments((current) => current.filter((candidate) => candidate.previewUrl !== item.previewUrl))
    if (item.path) void auth.deleteServiceListingMedia(item.path).catch((caught: unknown) => setError(caught instanceof Error? caught.message : "Could not remove this attachment."))
  }
  const postJob = async () => {
    const parsedBudget = budget.trim()? Number(budget) : null
    if (
      !title.trim() ||
      !description.trim() ||
      !category.trim() ||
      !location.trim() ||
      (parsedBudget !== null &&
        (!Number.isFinite(parsedBudget) ||
          parsedBudget <= 0 ||
          Math.round(parsedBudget * 100) < 1 ||
          !Number.isSafeInteger(Math.round(parsedBudget * 100))))
    ) {
      setError(
        "Add a title, description, location, and a valid optional budget before posting.",
      )
      return
    }

    if (uploadingMedia || attachments.some((item) => !item.path)) { setError("Wait for all photos and videos to finish uploading."); return }
    setSubmitting(true)
    try {
      const job = await auth.createMarketplaceJob({
        title: title.trim(),
        category: category.trim(),
        description: description.trim(),
        locationLabel: location.trim(),
        budgetMinor:
          parsedBudget === null? null : Math.round(parsedBudget * 100),
        requestedFor: requestedDate
         ? new Date(`${requestedDate}T12:00:00`).toISOString()
          : null,
        applicationDeadlineAt: applicationDeadline
         ? new Date(`${applicationDeadline}T23:59:59.000Z`).toISOString()
          : null,
        dueAt: dueDate? new Date(`${dueDate}T23:59:59.000Z`).toISOString() : null,
        locationMode,
        locationLatitude: jobPin?.latitude ?? null,
        locationLongitude: jobPin?.longitude ?? null,
        shareExactLocationWithProvider: shareExactLocation,
        media: attachments.map(({ path, contentType, size }) => ({ path, contentType, size })),
      })
      updateStore({ selectedJobId: job.id })
      setError("")
      go("bids")
    } catch (requestError) {
      setError(
        requestError instanceof Error
         ? requestError.message
          : "We couldn’t post this job. Please try again.",
      )
    } finally {
      setSubmitting(false)
    }
  }
  const continueStep = () => {
    setError("")
    if (step === 1 && (!title.trim() || !description.trim())) {
      setError("Add a clear job title and describe the work before continuing.")
      return
    }
    if (step === 2) {
      const today = new Date().toISOString().slice(0, 10)
      if (!location.trim()) { setError("Add the work area. For remote work, enter an eligible area or ‘Anywhere’."); return }
      if (applicationDeadline < today) { setError("Choose an application closing date that is today or later."); return }
      if (requestedDate && requestedDate < today) { setError("Choose a preferred work date that is today or later."); return }
      if (dueDate && dueDate <= applicationDeadline) { setError("The work due date must be after applications close."); return }
      const parsedBudget = budget.trim()? Number(budget) : null
      if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget <= 0)) { setError("Enter a positive budget or leave it blank for open quotes."); return }
      if (shareExactLocation && !jobPin) { setError("Add a map pin before choosing to share the precise location with your selected worker."); return }
    }
    setStep((current) => current + 1)
  }
  return (
    <div className="content form-page">
      <PageHeader
        eyebrow={`Hirer job post · Step ${step} of 3`}
        title={
          step === 1
           ? "Tell us what you need"
            : step === 2
             ? "Where and when?"
              : "Review your job"
        }
        description={step === 1? "Describe the work so workers know what to quote." : step === 2? "Set the work area and timing. Nearby workers can discover pinned jobs by distance." : "Review what workers will see before publishing."}
      />
      <div className="progress">
        <i style={{ width: `${step * 33.3}%` }} />
      </div>
      <div className="form-card">
        {step === 1 && (
          <>
            <label>
              Job title
              <input
                maxLength={160}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="For example, Deep clean a two-bedroom apartment"
              />
            </label>
            <small>{title.length}/160 characters. A specific title attracts better-matched proposals.</small>
            <label>
              Category
              <select
                value={category}
                disabled={!serviceCategories.length}
                onChange={(event) => setCategory(event.target.value)}
              >
                {!serviceCategories.length && <option value="">No active categories available</option>}
                {serviceCategories.map((item) => <option key={item.slug} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            {!serviceCategories.length && <small className="form-error">Job posting is unavailable until an admin adds an active service category.</small>}
            <label>
              What needs to be done?
              <textarea
                rows={5}
                maxLength={5000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the tasks, size, materials, access instructions, and anything the worker should bring."
              />
            </label>
            <small>{description.length}/5000 characters. Keep private access codes and sensitive details out of a public job post.</small>
            <label className="listing-media-picker">
              <input type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" multiple disabled={uploadingMedia || submitting} onChange={(event) => { const files = Array.from(event.currentTarget.files ?? []); event.currentTarget.value = ""; void addFiles(files) }} />
              {uploadingMedia? "Uploading attachments…" : "Add job photos or video"}
            </label>
            <small>Attach up to 6 photos and 1 short video, up to 6 MB each. Providers who can bid will be able to view these files.</small>
            {attachments.length > 0 && <div className="listing-media-gallery listing-media-previews">{attachments.map((item) => <div className="listing-media-preview" key={item.previewUrl}>{item.contentType.startsWith("video/")? <video className="listing-media-item" src={item.previewUrl} controls playsInline preload="metadata" /> : <img className="listing-media-item" src={item.previewUrl} alt="Job attachment preview" />}{item.uploading && <span className="listing-media-status">Uploading…</span>}<button type="button" className="listing-media-remove" disabled={item.uploading} onClick={() => removeAttachment(item)}>Remove</button></div>)}</div>}
          </>
        )}
        {step === 2 && (
          <>
            <label>
              Budget (KES)
              <input
                inputMode="decimal"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <small>Set a target budget, or leave it blank to invite workers to send their quotes.</small>
            <label>
              Work area or neighborhood (shown to workers)
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                maxLength={160}
                placeholder={locationMode === "remote"? "Anywhere, Nairobi, or eligible region" : "For example, Kilimani, Nairobi"}
              />
            </label>
            <small>Workers see this area label. Keep street addresses and private access details out of it.</small>
            <label>
              Work location
              <select value={locationMode} onChange={(event) => { const mode = event.target.value as typeof locationMode; setLocationMode(mode); if (mode === "remote") { setJobPin(null); setShareExactLocation(false) } }}>
                <option value="onsite">On site</option>
                <option value="remote">Remote</option>
                <option value="flexible">Flexible</option>
              </select>
            </label>
            {locationMode !== "remote" && <div className="card-actions"><Button variant="secondary" onClick={() => {
              if (!navigator.geolocation) { setError("Location is not available in this browser."); return }
              navigator.geolocation.getCurrentPosition(
                (position) => { setJobPin({ latitude: Number(position.coords.latitude.toFixed(4)), longitude: Number(position.coords.longitude.toFixed(4)) }); setError("") },
                () => setError("We could not read your location. You can still post by area."),
                { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
              )
            }}>{jobPin? "Update approximate map pin" : "Add approximate map pin"}</Button>{jobPin && <><span className="caption">Pin saved privately for distance matching.</span><Button type="button" variant="ghost" onClick={() => { setJobPin(null); setShareExactLocation(false) }}>Remove pin</Button></>}</div>}
            {locationMode !== "remote" && <div className="safe-note"><Icon name="shield" /><span>Workers see your area and an approximate distance. Your precise pin stays hidden unless you opt in below.</span></div>}
            {locationMode !== "remote" && jobPin && <label className="checkbox-row"><input type="checkbox" checked={shareExactLocation} onChange={(event) => setShareExactLocation(event.target.checked)} /><span>Share this precise pin with the worker I select</span></label>}
            <div className="field-pair">
              <label>
                Preferred date
                <input
                  type="date"
                  value={requestedDate}
                  onChange={(event) => setRequestedDate(event.target.value)}
                />
              </label>
              <label>
                Applications close
                <input type="date" value={applicationDeadline} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setApplicationDeadline(event.target.value)} />
              </label>
            </div>
            <div className="field-pair">
              <label>
                Work due date
                <input type="date" value={dueDate} min={applicationDeadline? new Date(new Date(`${applicationDeadline}T00:00:00.000Z`).getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10) : undefined} onChange={(event) => setDueDate(event.target.value)} />
              </label>
            </div>
          </>
        )}
        {step === 3 && (
          <div className="job-review">
            <Badge>Visible to verified workers</Badge>
            <h2>{title}</h2>
            <p>{description}</p>
            <ListingMediaGallery media={attachments.filter((item) => item.path).map(({ path, contentType, size }) => ({ path, contentType, size }))} />
            <div className="review-facts">
              <span>
                <small>Budget</small>
                <b>
                  {budget
                   ? `KES ${Number(budget).toLocaleString()}`
                    : "Open to quotes"}
                </b>
              </span>
              <span>
                <small>Location</small>
                <b>{location || "Not set"}</b>
              </span>
              <span>
                <small>Timing</small>
                <b>{requestedDate || "Flexible"}</b>
              </span>
              <span>
                <small>Applications close</small>
                <b>{applicationDeadline || "7 days after posting"}</b>
              </span>
              {dueDate && <span><small>Work due</small><b>{dueDate}</b></span>}
              <span><small>Work mode</small><b>{locationMode}</b></span>
              {locationMode !== "remote" && <span><small>Location sharing</small><b>{shareExactLocation? "Precise pin shared after you select a worker" : "Area and approximate distance only"}</b></span>}
            </div>
            <p className="caption">Pinned jobs are ranked by distance for workers with a saved service area. Jobs without a pin remain findable by area and category.</p>
            <div className="safe-note">
              <Icon name="shield" />
              <span>
                Only verified workers can bid. You choose who to hire.
              </span>
            </div>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={() => {
                setError("")
                setStep(step - 1)
              }}
            >
              Back
            </Button>
          )}
          <Button
            disabled={submitting || uploadingMedia || attachments.some((item) => !item.path)}
            onClick={() =>
              step < 3
               ? continueStep()
                : void postJob()
            }
          >
            {step < 3? "Continue" : submitting? "Publishing…" : "Publish job"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Bids({ go, onOpenProvider }: { go: (s: Screen) => void; onOpenProvider: (providerId: string) => void }) {
  const { store, updateStore } = useDemoStore()
  const auth = useAuth()
  const [providerSummaries, setProviderSummaries] = useState<Record<string, { publicName: string; bio: string; region: string; rating: number; reviewCount: number; avatarPath?: string | null }>>({})
  const {
    jobs,
    loading: jobsLoading,
    error: jobsError,
    refresh: refreshJobs,
  } =
    useMarketplaceJobs("consumer")
  const selectedJob =
    jobs.find((item) => item.id === store.selectedJobId) ?? jobs[0]
  const {
    job,
    quotes,
    loading,
    error: jobError,
    refresh,
  } = useMarketplaceJobData(selectedJob?.id, "consumer")
  const [selectedQuoteId, setSelectedQuoteId] = useState("")
  const [actionError, setActionError] = useState("")
  const [accepting, setAccepting] = useState(false)
  const [openingConversation, setOpeningConversation] = useState(false)
  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshJobs()
      void refresh()
    }, 15000)
    return () => window.clearInterval(timer)
  }, [refresh, refreshJobs])
  const selectedQuote =
    quotes.find((quote) => quote.id === selectedQuoteId) ??
    quotes.find((quote) => quote.status === "accepted") ??
    quotes.find((quote) => quote.status === "submitted") ??
    quotes[0] ?? null

  useEffect(() => {
    let cancelled = false
    void Promise.all(quotes.map(async (quote) => {
      try {
        const [provider, reviews] = await Promise.all([
          auth.getMarketplaceProvider(quote.providerId, job.id),
          auth.getPublicProviderReviews(quote.providerId),
        ])
        const rating = reviews.length? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : 0
        return [quote.providerId, { publicName: provider.publicName, bio: provider.bio, region: provider.region, rating, reviewCount: reviews.length, avatarPath: provider.avatarPath }] as const
      } catch {
        return [quote.providerId, { publicName: quote.providerName, bio: "", region: "", rating: 0, reviewCount: 0, avatarPath: null }] as const
      }
    })).then((entries) => {
      if (!cancelled) setProviderSummaries(Object.fromEntries(entries))
    })
    return () => { cancelled = true }
  }, [auth.getMarketplaceProvider, auth.getPublicProviderReviews, quotes, job?.id])

  useEffect(() => {
    if (quotes.length && !quotes.some((quote) => quote.id === selectedQuoteId)) {
      setSelectedQuoteId((quotes.find((quote) => quote.status === "accepted") ?? quotes.find((quote) => quote.status === "submitted") ?? quotes[0]).id)
    }
  }, [quotes, selectedQuoteId])

  const acceptQuote = async () => {
    if (!job || !selectedQuote) return
    setAccepting(true)
    setActionError("")
    try {
      setSelectedQuoteId(selectedQuote.id)
      await auth.acceptMarketplaceQuote(job.id, selectedQuote.id)
      await refresh()
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
         ? requestError.message
          : "We couldn’t accept this quote. Please try again.",
      )
    } finally {
      setAccepting(false)
    }
  }

  const messageWorker = async (providerId: string) => {
    if (!job) return
    setOpeningConversation(true)
    setActionError("")
    try {
      const conversation = await auth.openMarketplaceConversation(job.id, "consumer", providerId)
      updateStore({ selectedJobId: job.id, selectedMarketplaceConversationId: conversation.id })
      go("chat")
    } catch (requestError) {
      setActionError(requestError instanceof Error? requestError.message : "Could not open this worker conversation.")
    } finally {
      setOpeningConversation(false)
    }
  }

  const openBidderProfile = (providerId: string) => {
    updateStore({ selectedJobId: job.id })
    onOpenProvider(providerId)
  }

  if (jobsLoading || (selectedJob && loading)) {
    return <p className="center-note">Loading your saved job and quotes…</p>
  }

  if (jobsError || jobError) {
    return (
      <div className="content">
        <PageHeader title="Proposals for your jobs" description="Live marketplace data." />
        <p className="form-error" role="alert">
          {jobsError || jobError}
        </p>
        <Button
          onClick={() =>
            jobsError? void refreshJobs() : void refresh()
          }
        >
          Retry
        </Button>
      </div>
    )
  }

  if (!job) {
    return (
      <div className="content">
        <PageHeader title="Proposals for your jobs" description="Compare provider bids for your posted jobs." />
        <EmptyState
          title="No posted jobs yet"
          detail="Post a job and compare proposals from verified providers."
          action={() => go("post")}
          actionLabel="Post a job"
        />
      </div>
    )
  }

  return (
    <div className="content">
      <PageHeader
        eyebrow={`${quotes.length} proposals · Job ID ${job.jobReference}`}
        title="Review worker proposals"
        description={job.title}
      />
      <label className="bid-job-picker">Your posted jobs
        <select value={job.id} onChange={(event) => { updateStore({ selectedJobId: event.target.value }); setSelectedQuoteId("") }}>
          {jobs.map((item) => <option key={item.id} value={item.id}>{item.title} · {item.status.replace(/_/g, " ")} · {item.quoteCount} proposal{item.quoteCount === 1? "" : "s"}</option>)}
        </select>
      </label>
      <JobTimeline job={job} />
      <ListingMediaGallery media={job.media ?? []} />
      <div className="bid-layout">
        <div className="bid-list card table-card"><div className="table-wrap"><table>
          <thead><tr><th>#</th><th>Worker</th><th>Rating</th><th>Proposal</th><th>Bid</th><th>Availability</th><th>Status</th><th></th></tr></thead>
          <tbody>{quotes.map((quote, index) => <tr key={quote.id} className={selectedQuote?.id === quote.id? "selected-proposal-row" : undefined}>
            <td>{index + 1}</td>
            <td><button className="table-link" onClick={() => openBidderProfile(quote.providerId)}>{providerSummaries[quote.providerId]?.publicName || quote.providerName}</button><br /><small>{providerSummaries[quote.providerId]?.region || "Area not provided"}</small>{providerSummaries[quote.providerId]?.bio && <p className="bidder-profile-bio">{providerSummaries[quote.providerId].bio}</p>}</td>
            <td>{providerSummaries[quote.providerId]?.reviewCount? providerSummaries[quote.providerId].rating.toFixed(1) + "? (" + providerSummaries[quote.providerId].reviewCount + ")" : "No reviews"}</td>
            <td className="proposal-message-cell">{quote.message}</td>
            <td>KES {(quote.amountMinor / 100).toLocaleString()}</td><td>{quote.availability}</td>
            <td><Badge tone={quote.status === "accepted"? "green" : quote.status === "submitted"? "amber" : undefined}>{quote.status}</Badge></td>
            <td><div className="card-actions"><Button variant="secondary" icon="message" disabled={(quote.status !== "submitted" && quote.status !== "accepted") || openingConversation} onClick={() => void messageWorker(quote.providerId)}>Message</Button><Button variant={selectedQuote?.id === quote.id? "primary" : "secondary"} disabled={quote.status !== "submitted" && quote.status !== "accepted"} onClick={() => setSelectedQuoteId(quote.id)}>{selectedQuote?.id === quote.id? "Selected" : "Review"}</Button></div></td>
          </tr>)}
          {!quotes.length && <tr><td colSpan={8}>No worker proposals have been submitted for this job yet.</td></tr>}
          </tbody>
        </table></div></div>
        <aside className="summary-card">
          <h2>{job.status === "open"? "Your selection" : "Job status"}</h2>
          {selectedQuote? (
            <>
              <div className="selected-person">
                <Avatar src={auth.getProfileAvatarUrl(providerSummaries[selectedQuote.providerId]?.avatarPath)} name={providerSummaries[selectedQuote.providerId]?.publicName || selectedQuote.providerName} />
                <span>
                  <strong>{providerSummaries[selectedQuote.providerId]?.publicName || selectedQuote.providerName}</strong>
                  <small>{selectedQuote.availability}</small>
                </span>
              </div>
              <Button variant="secondary" onClick={() => openBidderProfile(selectedQuote.providerId)}>
                View profile
              </Button>
              <div className="summary-line">
                <span>Worker bid</span>
                <strong>
                  KES {(selectedQuote.amountMinor / 100).toLocaleString()}
                </strong>
              </div>
              {job.status === "open" && selectedQuote.status === "submitted" && (
                <Button disabled={accepting} onClick={() => void acceptQuote()}>
                  {accepting? "Accepting…" : "Accept bid"}
                </Button>
              )}
              {job.status === "awarded" && (
                <p role="status">A worker has been selected for this job.</p>
              )}
            </>
          ) : (
            <p>No worker proposals yet. New bids will appear here automatically.</p>
          )}
          <p>
            Payments are disabled. Accepting a quote does not charge or transfer
            money.
          </p>
          {(jobError || actionError) && (
            <p className="form-error" role="alert">
              {actionError || jobError}
            </p>
          )}
        </aside>
      </div>
    </div>
  )
}

function Checkout({ go }: { go: (s: Screen) => void }) {
  return (
    <div className="content narrow">
      <PageHeader
        eyebrow="Payments disabled"
        title="Payment is not available yet"
        description="No payment method will be charged and no demo payment will change a job’s status."
      />
      <div className="checkout-card">
        <p>
          Customers can accept provider quotes without a payment. Payment
          integration will be enabled only after a provider and settlement
          safeguards are configured.
        </p>
        <Button onClick={() => go("jobs")}>Back to my jobs</Button>
      </div>
    </div>
  )
}

function Tracking({ go }: { go: (s: Screen) => void }) {
  const { store, updateStore } = useDemoStore()
  const job =
    store.jobs.find((item) => item.id === store.selectedJobId) ?? store.jobs[0]
  const [notice, setNotice] = useState("")
  return (
    <div className="content">
      <PageHeader
        eyebrow={`Job ID ${job.id}`}
        title={`${store.selectedBid.provider.split(" ")[0]} is on the way`}
        description="Illustrative status · live location is not connected"
      />
      <div className="track-grid">
        <main className="card">
          <div className="map-placeholder">
            <div className="map-roads" />
            <span className="map-pin">
              <Avatar src={photos.amina} name="Amina" />
            </span>
            <div className="eta">
              <strong>12 min</strong>
              <span>2.4 km away</span>
            </div>
          </div>
          <div className="provider-contact">
            <Avatar src={photos.amina} name="Amina" />
            <div>
              <strong>{store.selectedBid.provider}</strong>
              <span>{job.category} · sample location</span>
            </div>
            <Button
              variant="secondary"
              icon="message"
              onClick={() => go("chat")}
            >
              Chat
            </Button>
            <a className="btn btn-ghost" href="tel:+254700000000">
              Call (demo)
            </a>
          </div>
        </main>
        <aside className="card timeline-card">
          <h2>Job status</h2>
          <DemoNotice>
            Timeline is sample data; no live tracking available.
          </DemoNotice>
          <div className="timeline">
            <div className="done">
              <i>
                <Icon name="check" size={14} />
              </i>
              <span>
                <b>Accepted</b>
                <small>Demo booking</small>
              </span>
            </div>
            <div className="current">
              <i />
              <span>
                <b>On the way</b>
                <small>Estimated · sample</small>
              </span>
            </div>
            <div>
              <i />
              <span>
                <b>In progress</b>
                <small>Up next</small>
              </span>
            </div>
            <div>
              <i />
              <span>
                <b>Done</b>
                <small>Payment ready to release</small>
              </span>
            </div>
          </div>
          <Button onClick={() => go("chat")}>Open job chat</Button>
          <Button
            onClick={() => {
              updateStore({
                jobs: store.jobs.map((item) =>
                  item.id === job.id? { ...item, status: "Completed" } : item,
                ),
              })
              go("review")
            }}
          >
            Confirm completion & review
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              setNotice("Reschedule/cancellation is a demo request only.")
            }
          >
            Reschedule or cancel
          </Button>
          <Button variant="danger" onClick={() => go("dispute")}>
            Open a dispute
          </Button>
          {notice && <DemoNotice>{notice}</DemoNotice>}
        </aside>
      </div>
    </div>
  )
}

function Review({ go }: { go: (s: Screen) => void }) {
  const auth = useAuth()
  const [page, setPage] = useState<import("../../auth/AuthProvider").ServiceListingReviewPage | null>(null)
  const [error, setError] = useState("")
  const refresh = () => auth.getServiceListingReviews("consumer").then(setPage).catch((caught: unknown) => setError(caught instanceof Error? caught.message : "Could not load your reviews."))
  useEffect(() => { void refresh() }, [auth.getServiceListingReviews])
  return <div className="content narrow"><PageHeader title="Review completed work" description="Customers and providers can review each other after both confirm a job is complete." />{error && <p className="form-error" role="alert">{error}</p>}{!page? <p role="status">Loading completed jobs…</p> : page.pending.length === 0 ? <section className="card"><h2>No reviews waiting</h2><p>When you confirm a completed job, you can leave the provider a review here.</p><Button variant="secondary" onClick={() => go("history")}>View my jobs</Button></section> : page.pending.map((item) => <ListingReviewForm key={item.listingId} listingId={item.listingId} listingTitle={item.listingTitle} revieweeName={item.revieweeName} onSaved={() => void refresh()} />)}{page?.received.length? <section className="card reputation-section"><h2>Reviews about you</h2>{page.received.map((review) => <article className="review-card" key={review.id}><div className="review-head"><div><strong>{review.reviewerName}</strong><small>{review.listingTitle} · {new Date(review.createdAt).toLocaleDateString()}</small></div><span className="rating">{"â˜…".repeat(review.rating)}{"â˜†".repeat(5 - review.rating)}</span></div>{review.comment && <p>{review.comment}</p>}</article>)}</section> : null}</div>
}

function EmptyState({
  title,
  detail,
  action,
  actionLabel,
}: {
  title: string
  detail: string
  action?: () => void
  actionLabel?: string
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon name="search" size={26} />
      </span>
      <h2>{title}</h2>
      <p>{detail}</p>
      {action && (
        <Button variant="secondary" onClick={action}>
          {actionLabel ?? "Try again"}
        </Button>
      )}
    </div>
  )
}

function DemoNotice({
  children = "Demo mode: changes are stored in this browser only. No real services or payments are contacted.",
}: {
  children?: React.ReactNode
}) {
  return (
    <p className="demo-notice" role="note">
      {children}
    </p>
  )
}

function ConsumerJobs({ go }: { go: (screen: Screen) => void }) {
  const { updateStore } = useDemoStore()
  const auth = useAuth()
  const { jobs, loading, error, refresh } = useMarketplaceJobs("consumer")
  const [jobPayments, setJobPayments] = useState<import("../../auth/AuthProvider").JobPaymentRecord[]>([])
  const [paymentBusyId, setPaymentBusyId] = useState("")
  const [paymentMethods, setPaymentMethods] = useState<Record<string, import("../../auth/AuthProvider").JobPaymentMethod>>({})
  const [tab, setTab] = useState<"open" | "active" | "completed">("open")
  const [actionError, setActionError] = useState("")
  const [actionNotice, setActionNotice] = useState("")
  const [jobActionBusyId, setJobActionBusyId] = useState("")
  const jobActionInFlight = useRef(new Set<string>())
  const [selectedJobId, setSelectedJobId] = useState("")
  const [confirmWithdrawal, setConfirmWithdrawal] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState<Record<string, string>>({})
  const jobDialogRef = useRef<HTMLDialogElement>(null)
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null
  const activeStatuses = ["awarded", "in_progress", "completion_pending", "revision_requested"]
  const jobsForTab = jobs.filter((job) => tab === "open"
   ? job.status === "open"
    : tab === "active"
     ? activeStatuses.includes(job.status)
      : ["completed", "cancelled", "disputed", "expired"].includes(job.status))

  useEffect(() => {
    const dialog = jobDialogRef.current
    if (!dialog) return
    if (selectedJob && !dialog.open) dialog.showModal()
    if (!selectedJob && dialog.open) dialog.close()
  }, [selectedJob?.id])
  useEffect(() => setConfirmWithdrawal(false), [selectedJobId])

  const refreshPayments = useCallback(async () => {
    try { setJobPayments(await auth.getJobPayments("consumer")) }
    catch (caught) { setActionError(caught instanceof Error? caught.message : "Could not load payment history.") }
  }, [auth.getJobPayments])
  useEffect(() => { void refreshPayments() }, [refreshPayments])

  const transition = async (jobId: string, action: "confirm-completion" | "request-revision" | "cancel", note?: string) => {
    if (jobActionInFlight.current.has(jobId)) return
    jobActionInFlight.current.add(jobId)
    setJobActionBusyId(jobId)
    try {
      setActionError("")
      setActionNotice("")
      await auth.transitionMarketplaceJob(jobId, action, note? { note } : undefined)
      await refresh()
      await refreshPayments()
      if (action === "cancel") {
        setSelectedJobId("")
        setActionNotice("Job withdrawn. It no longer appears in workers’ open job search.")
      } else setActionNotice("Job updated.")
    } catch (caught) {
      setActionError(caught instanceof Error? caught.message : "We could not update this job. Please try again.")
    } finally {
      jobActionInFlight.current.delete(jobId)
      setJobActionBusyId("")
    }
  }

  const reportPayment = async (jobId: string) => {
    setPaymentBusyId(jobId); setActionError(""); setActionNotice("")
    try { await auth.reportJobPayment(jobId, paymentMethods[jobId] ?? "cash"); await refreshPayments(); setActionNotice("Payment report saved.") }
    catch (caught) { setActionError(caught instanceof Error? caught.message : "Could not record this payment.") }
    finally { setPaymentBusyId("") }
  }
  const disputePayment = async (jobId: string) => {
    const reason = window.prompt("Explain the payment issue (at least 10 characters).")
    if (!reason?.trim()) return
    setPaymentBusyId(jobId); setActionError("")
    try { await auth.disputeJobPayment(jobId, reason.trim()); await refreshPayments() }
    catch (caught) { setActionError(caught instanceof Error? caught.message : "Could not open a payment dispute.") }
    finally { setPaymentBusyId("") }
  }
  const openBids = (jobId: string) => {
    updateStore({ selectedJobId: jobId })
    setSelectedJobId("")
    go("bids")
  }

  return (
    <div className="content">
      <PageHeader title="My jobs" description="Track proposals, active work, and completed jobs." action={<Button onClick={() => go("workFeed")}>Find providers</Button>} />
      <div className="filters">
        {(["open", "active", "completed"] as const).map((status) => (
          <button className={tab === status? "active" : ""} key={status} onClick={() => setTab(status)}>
            {status[0].toUpperCase() + status.slice(1)} · {jobs.filter((job) => status === "open"? job.status === "open" : status === "active"? activeStatuses.includes(job.status) : ["completed", "cancelled", "disputed", "expired"].includes(job.status)).length}
          </button>
        ))}
      </div>
      {error && <p className="form-error" role="alert">{error} <Button variant="ghost" onClick={() => void refresh()}>Retry</Button></p>}
      {actionError && !selectedJob && <p className="form-error" role="alert">{actionError}</p>}
      {actionNotice && <p className="form-success" role="status">{actionNotice}</p>}
      <div className="card jobs-table-card">
        <div className="table-wrap jobs-table-wrap">
          <table className="jobs-table">
            <thead><tr><th scope="col">#</th><th scope="col">Job</th><th scope="col">Job ID</th><th scope="col">Status</th><th scope="col">Proposals</th><th scope="col">Budget</th><th scope="col">Due</th><th scope="col">Actions</th></tr></thead>
            <tbody>
              {!loading && jobsForTab.map((job, index) => (
                <tr key={job.id}>
                  <td>{index + 1}</td>
                  <td><strong>{job.title}</strong><small className="jobs-table-subtitle">{job.category} · {job.locationLabel}</small></td>
                  <td><span className="job-reference">{job.jobReference}</span></td>
                  <td><Badge tone={job.status === "completed"? "green" : job.status === "cancelled" || job.status === "disputed"? "red" : job.status === "open"? "blue" : "amber"}>{job.status.replaceAll("_", " ")}</Badge></td>
                  <td>{job.quoteCount}</td>
                  <td>{job.budgetMinor === null? "Open budget" : `KES ${(job.budgetMinor / 100).toLocaleString()}`}</td>
                  <td>{job.dueAt? new Date(job.dueAt).toLocaleDateString() : "—"}</td>
                  <td><div className="jobs-table-actions"><Button variant="secondary" onClick={() => { setActionError(""); setActionNotice(""); setSelectedJobId(job.id) }}>Details</Button>{job.status === "open" && <Button variant="ghost" onClick={() => openBids(job.id)}>Compare</Button>}</div></td>
                </tr>
              ))}
              {!loading && !error && !jobsForTab.length && <tr><td colSpan={8} className="jobs-table-empty">No {tab} jobs yet. Jobs you post will appear here.</td></tr>}
            </tbody>
          </table>
        </div>
        {loading && <p className="center-note">Loading your jobs…</p>}
      </div>
      <dialog className="jobs-detail-dialog" ref={jobDialogRef} aria-labelledby="jobs-detail-title" onClose={() => { setSelectedJobId(""); setConfirmWithdrawal(false) }} onClick={(event) => { if (event.target === jobDialogRef.current) setSelectedJobId("") }}>
        {selectedJob && <>
          <header className="jobs-detail-header"><div><p className="eyebrow">{selectedJob.jobReference}</p><h2 id="jobs-detail-title">{selectedJob.title}</h2></div><button type="button" className="jobs-dialog-close" onClick={() => setSelectedJobId("")} aria-label="Close job details">×</button></header>
          <div className="jobs-detail-body">
            <div className="jobs-detail-meta"><span><small>Status</small><Badge>{selectedJob.status.replaceAll("_", " ")}</Badge></span><span><small>Category and location</small><strong>{selectedJob.category} · {selectedJob.locationLabel}</strong></span><span><small>Budget</small><strong>{selectedJob.budgetMinor === null? "Open budget" : `KES ${(selectedJob.budgetMinor / 100).toLocaleString()}`}</strong></span><span><small>Proposals</small><strong>{selectedJob.quoteCount}</strong></span></div>
            {selectedJob.applicationDeadlineAt && selectedJob.status === "open" && <p className="caption">Applications close {new Date(selectedJob.applicationDeadlineAt).toLocaleString()}</p>}
            {selectedJob.dueAt && <p className="caption">Work due {new Date(selectedJob.dueAt).toLocaleString()}</p>}
            {selectedJob.completionNote && selectedJob.status === "completion_pending" && <><div className="safe-note"><span><strong>Worker submission</strong><br />{selectedJob.completionNote}</span></div><ListingMediaGallery media={selectedJob.completionMedia ?? []} /></>}
            {selectedJob.revisionNote && selectedJob.status === "revision_requested" && <div className="safe-note"><span><strong>Revision requested</strong><br />{selectedJob.revisionNote}</span></div>}
            {(() => {
              const payment = jobPayments.find((item) => item.jobId === selectedJob.id)
              if (!payment) return null
              const money = (minor: number) => `${payment.currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              return <section className="jobs-payment-summary"><h3>Payment · {payment.paymentReference}</h3><p>Worker share: <strong>{money(payment.providerAmountMinor)}</strong> <Badge tone={payment.status === "paid"? "green" : payment.status === "disputed"? "red" : "amber"}>{payment.status.replaceAll("_", " ")}</Badge></p><p>OddJobs fee (hirer responsibility): <strong>{money(payment.commissionAmountMinor)}</strong> <Badge tone={payment.platformFeeStatus === "received"? "green" : payment.platformFeeStatus === "disputed"? "red" : "amber"}>{payment.platformFeeStatus.replaceAll("_", " ")}</Badge></p>{payment.status === "awaiting_payment" && selectedJob.status === "completed" && <><label>Worker payment method<select value={paymentMethods[selectedJob.id] ?? "cash"} onChange={(event) => setPaymentMethods((current) => ({ ...current, [selectedJob.id]: event.target.value as import("../../auth/AuthProvider").JobPaymentMethod }))}><option value="cash">Cash</option><option value="manual_transfer">Manual transfer / M-Pesa</option></select></label><Button disabled={paymentBusyId === selectedJob.id} onClick={() => void reportPayment(selectedJob.id)}>Record worker payment</Button></>}{payment.status === "reported" && <Button variant="secondary" disabled={paymentBusyId === selectedJob.id} onClick={() => void disputePayment(selectedJob.id)}>Flag payment issue</Button>}{payment.status === "disputed" && <p className="form-error">Payment is under review{payment.disputeReason? `: ${payment.disputeReason}` : ""}</p>}{payment.status === "paid" && <p className="form-success">Worker confirmed receipt of {money(payment.providerAmountMinor)}.</p>}<Button variant="secondary" onClick={() => { setSelectedJobId(""); go("payments") }}>Manage payments and fees</Button></section>
            })()}
            {selectedJob.status === "completion_pending" && <section className="jobs-detail-actions"><Button disabled={jobActionBusyId === selectedJob.id} onClick={() => void transition(selectedJob.id, "confirm-completion")}>{jobActionBusyId === selectedJob.id ? "Saving…" : "Approve completed work"}</Button><label>Request a revision<textarea rows={3} minLength={10} maxLength={5000} value={revisionNotes[selectedJob.id] ?? ""} onChange={(event) => setRevisionNotes((current) => ({ ...current, [selectedJob.id]: event.target.value }))} placeholder="What needs to change?" /></label><Button variant="secondary" disabled={jobActionBusyId === selectedJob.id || (revisionNotes[selectedJob.id] ?? "").trim().length < 10} onClick={() => void transition(selectedJob.id, "request-revision", revisionNotes[selectedJob.id]?.trim())}>{jobActionBusyId === selectedJob.id ? "Saving…" : "Request revision"}</Button></section>}
            {selectedJob.status === "awarded" && <Button variant="secondary" onClick={() => openBids(selectedJob.id)}>View selected provider</Button>}
            {selectedJob.status === "open" && <div className="jobs-detail-actions"><Button onClick={() => openBids(selectedJob.id)}>Compare {selectedJob.quoteCount} proposals</Button>{confirmWithdrawal? <div className="jobs-withdraw-confirm"><p>Withdraw this job? Workers will no longer see it in job search. Its history remains available to you.</p><Button variant="ghost" onClick={() => setConfirmWithdrawal(false)}>Keep job</Button><Button variant="danger" onClick={() => void transition(selectedJob.id, "cancel")}>Withdraw job</Button></div> : <Button variant="ghost" onClick={() => setConfirmWithdrawal(true)}>Withdraw job</Button>}</div>}
          </div>
          {actionError && <p className="form-error jobs-dialog-error" role="alert">{actionError}</p>}
        </>}
      </dialog>
    </div>
  )
}
function HirerPayments() {
  const auth = useAuth()
  const [payments, setPayments] = useState<import("../../auth/AuthProvider").JobPaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [methodByJob, setMethodByJob] = useState<Record<string, import("../../auth/AuthProvider").JobPaymentMethod>>({})
  const [feeReferenceByJob, setFeeReferenceByJob] = useState<Record<string, string>>({})
  const [feeReferenceErrors, setFeeReferenceErrors] = useState<Record<string, string>>({})
  const [feeReportErrors, setFeeReportErrors] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState("")
  const refresh = useCallback(async () => {
    setLoading(true)
    try { setPayments(await auth.getJobPayments("consumer")); setError("") }
    catch (caught) { setError(caught instanceof Error? caught.message : "Could not load hirer payments.") }
    finally { setLoading(false) }
  }, [auth.getJobPayments])
  useEffect(() => { void refresh() }, [refresh])
  const money = (minor: number, currency: string) => `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const paymentTotal = (items: import("../../auth/AuthProvider").JobPaymentRecord[], amount: (item: import("../../auth/AuthProvider").JobPaymentRecord) => number) => {
    const totals = new Map<string, number>()
    for (const item of items) totals.set(item.currency, (totals.get(item.currency) ?? 0) + amount(item))
    return totals.size ? [...totals].map(([currency, total]) => money(total, currency)).join(" · ") : money(0, "KES")
  }
  const filtered = payments.filter((item) => `${item.jobReference} ${item.paymentReference} ${item.jobTitle} ${item.providerName}`.toLowerCase().includes(search.toLowerCase()))
  const paidToWorkers = paymentTotal(payments.filter((item) => item.status === "paid"), (item) => item.providerAmountMinor)
  const workerAwaitingConfirmation = paymentTotal(payments.filter((item) => item.status === "awaiting_payment" || item.status === "reported"), (item) => item.providerAmountMinor)
  const feeNeedsAction = paymentTotal(payments.filter((item) => item.jobStatus === "completed" && item.status === "paid" && (item.platformFeeStatus === "due" || item.platformFeeStatus === "needs_correction")), (item) => item.commissionAmountMinor)
  const feeUnderReview = paymentTotal(payments.filter((item) => item.platformFeeStatus === "reported"), (item) => item.commissionAmountMinor)
  const feeVerified = paymentTotal(payments.filter((item) => item.platformFeeStatus === "received"), (item) => item.commissionAmountMinor)
  const feeDisputed = paymentTotal(payments.filter((item) => item.platformFeeStatus === "disputed"), (item) => item.commissionAmountMinor)
  const reportWorkerPayment = async (jobId: string) => {
    setBusyId(jobId); setError("")
    try { await auth.reportJobPayment(jobId, methodByJob[jobId] ?? "cash"); await refresh() }
    catch (caught) { setError(caught instanceof Error? caught.message : "Could not report the worker payment.") }
    finally { setBusyId("") }
  }
  const reportFee = async (jobId: string) => {
    const reference = feeReferenceByJob[jobId]?.trim() ?? ""
    if (reference.length < 3) {
      setFeeReferenceErrors((current) => ({ ...current, [jobId]: "Enter the payment reference from your receipt (at least 3 characters)." }))
      return
    }
    setBusyId(jobId); setError("")
    setFeeReferenceErrors((current) => ({ ...current, [jobId]: "" }))
    setFeeReportErrors((current) => ({ ...current, [jobId]: "" }))
    try { await auth.reportHirerPlatformFee(jobId, reference); await refresh() }
    catch (caught) { setFeeReportErrors((current) => ({ ...current, [jobId]: caught instanceof Error? caught.message : "Could not report this payment. Please try again." })) }
    finally { setBusyId("") }
  }
  return <div className="content console-content">
    <PageHeader title="Payments & fees" description="Track what you pay workers and what you owe OddJobs for each completed job." action={<Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>} />
    {!error && <div className="dashboard-grid"><Metric label="Paid to workers" value={paidToWorkers} /><Metric label="Worker payments awaiting confirmation" value={workerAwaitingConfirmation} /><Metric label="OddJobs fees requiring action" value={feeNeedsAction} /><Metric label="OddJobs fees under review" value={feeUnderReview} /><Metric label="OddJobs fees verified paid" value={feeVerified} /><Metric label="Fees under dispute" value={feeDisputed} /></div>}
    <section className="card table-card"><label>Search by job or payment ID<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="OJ-… or PAY-… or job title" /></label>
      {loading? <p role="status">Loading payment history…</p> : error? <p className="form-error" role="alert">{error}</p> : filtered.length? <div className="table-wrap"><table><thead><tr><th>#</th><th>Job / payment</th><th>Worker</th><th>Accepted total</th><th>Worker receives</th><th>OddJobs fee you owe</th><th>Worker payment</th><th>Platform fee</th></tr></thead><tbody>{filtered.map((payment, index) => <tr key={payment.id}><td>{index + 1}</td><td><strong>{payment.jobReference}</strong><small className="caption">{payment.paymentReference} · {payment.jobTitle}</small></td><td>{payment.providerName}</td><td>{money(payment.grossAmountMinor, payment.currency)}</td><td>{money(payment.providerAmountMinor, payment.currency)}</td><td>{money(payment.commissionAmountMinor, payment.currency)}</td><td><Badge tone={payment.status === "paid"? "green" : payment.status === "disputed"? "red" : "amber"}>{payment.status.replaceAll("_", " ")}</Badge>{payment.status === "awaiting_payment" && payment.jobStatus === "completed" && <div className="payment-action"><select aria-label={`Payment method for ${payment.jobReference}`} value={methodByJob[payment.jobId] ?? "cash"} onChange={(event) => setMethodByJob((current) => ({ ...current, [payment.jobId]: event.target.value as import("../../auth/AuthProvider").JobPaymentMethod }))}><option value="cash">Cash</option><option value="manual_transfer">Manual transfer</option></select><Button disabled={busyId === payment.jobId} onClick={() => void reportWorkerPayment(payment.jobId)}>Report paid</Button></div>}{payment.status === "reported" && <small className="caption">Waiting for worker confirmation</small>}</td><td className="commission-cell">
  <Badge tone={payment.platformFeeStatus === "received"? "green" : payment.platformFeeStatus === "disputed"? "red" : payment.platformFeeStatus === "needs_correction"? "amber" : payment.platformFeeStatus === "reported"? "neutral" : "amber"}>
    {{ due: "Due", reported: "Under review", received: "Verified paid", disputed: "Disputed", needs_correction: "Correction needed" }[payment.platformFeeStatus]}
  </Badge>
  {payment.platformFeeStatus === "due" && payment.status !== "paid" && <small className="caption">Due after the worker confirms payment.</small>}
  {payment.platformFeeDueAt && (payment.platformFeeStatus === "due" || payment.platformFeeStatus === "needs_correction") && payment.status === "paid" && <small className="caption">Pay by {new Date(payment.platformFeeDueAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short" })}{Date.now() > new Date(payment.platformFeeDueAt).getTime() && ["due", "needs_correction"].includes(payment.platformFeeStatus)? " - Overdue" : ""}</small>}
  {payment.platformFeeStatus === "needs_correction" && payment.platformFeeCorrectionReason && <small className="form-error">Please correct: {payment.platformFeeCorrectionReason}</small>}
  {(payment.platformFeeStatus === "due" || payment.platformFeeStatus === "needs_correction") && payment.jobStatus === "completed" && payment.status === "paid" && <div className="payment-action"><input aria-label={`OddJobs fee receipt reference for ${payment.jobReference}`} aria-describedby={`fee-reference-help-${payment.jobId}`} aria-invalid={Boolean(feeReferenceErrors[payment.jobId])} value={feeReferenceByJob[payment.jobId] ?? ""} onChange={(event) => { setFeeReferenceByJob((current) => ({ ...current, [payment.jobId]: event.target.value })); setFeeReferenceErrors((current) => ({ ...current, [payment.jobId]: "" })) }} placeholder="Payment reference" /><small id={`fee-reference-help-${payment.jobId}`} className={feeReferenceErrors[payment.jobId] ? "form-error" : "caption"} role={feeReferenceErrors[payment.jobId] ? "alert" : undefined}>{feeReferenceErrors[payment.jobId] || "Enter the M-Pesa or bank reference from your receipt."}</small><Button variant="secondary" disabled={busyId === payment.jobId} onClick={() => void reportFee(payment.jobId)}>{busyId === payment.jobId ? "Submitting…" : "Report fee paid"}</Button>{feeReportErrors[payment.jobId] && <small className="form-error" role="alert">{feeReportErrors[payment.jobId]}</small>}</div>}
  {payment.platformFeeStatus === "reported" && <small className="caption">Reference {payment.platformFeePaymentReference ?? "submitted"}. OddJobs is reviewing it; reminders are paused.</small>}
  {payment.platformFeeStatus === "received" && <small className="caption">Verified{payment.platformFeeReceiptReference? ` - Receipt ${payment.platformFeeReceiptReference}` : ""}{payment.platformFeeReceivedAt? ` - ${new Date(payment.platformFeeReceivedAt).toLocaleDateString("en-KE")}` : ""}</small>}
  {payment.platformFeeEvents.length > 0 && <details className="payment-history-details"><summary>Payment activity ({payment.platformFeeEvents.length})</summary><ol>{[...payment.platformFeeEvents].reverse().map((event, eventIndex) => <li key={`${event.action}-${event.createdAt}-${eventIndex}`}><strong>{{ "platform_fee.reported": "Payment reported", "platform_fee.received": "Payment verified", "platform_fee.correction_requested": "Correction requested", "platform_fee.reminder.manual": "Admin reminder", "platform_fee.reminder.due-soon": "Reminder sent", "platform_fee.reminder.due": "Reminder sent", "platform_fee.reminder.overdue-24h": "Overdue reminder", "platform_fee.reminder.overdue-72h": "Urgent reminder" }[event.action] ?? "Payment update"}</strong><small className="caption">{new Date(event.createdAt).toLocaleString("en-KE")}{typeof event.metadata.reason === "string"? ` - ${event.metadata.reason}` : typeof event.metadata.note === "string" && event.metadata.note? ` - ${event.metadata.note}` : ""}</small></li>)}</ol></details>}
</td></tr>)}</tbody></table></div> : <EmptyState title="No job payment records" detail="Accepted bids will appear here with the worker amount and your OddJobs fee shown separately." />}
    </section>
    <p className="caption">The accepted bid total is the hirer’s total obligation: 90% is allocated to the worker and 10% to OddJobs. Worker payment confirmation and OddJobs fee verification are separate. Transfers are reported manually; the app does not collect funds yet.</p>
  </div>
}

function WorkFeed({ onOpenProvider, go }: { onOpenProvider: (providerId: string) => void; go: (s: Screen) => void }) {
  const auth = useAuth()
  const { updateStore } = useDemoStore()
  const [view, setView] = useState<"workers" | "proposals">("workers")
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState("")
  const [viewingWorkerId, setViewingWorkerId] = useState<string | null>(null)
  const { providers, total: workerTotal, loading: workersLoading, error: workersError, refresh: refreshWorkers } = useMarketplaceProviders(search, region, 50)
  const { jobs, loading: jobsLoading, error: jobsError, refresh: refreshJobs } = useMarketplaceJobs("consumer")
  const [proposalRows, setProposalRows] = useState<Array<{ job: import("../../auth/AuthProvider").MarketplaceJob; quote: import("../../auth/AuthProvider").MarketplaceQuote }>>([])
  const [proposalsLoading, setProposalsLoading] = useState(false)
  const [proposalsError, setProposalsError] = useState("")
  const jobsWithProposals = jobs.filter((job) => job.quoteCount > 0 && ["open", "awarded"].includes(job.status))

  useEffect(() => {
    let active = true
    setProposalsLoading(true)
    setProposalsError("")
    void Promise.all(jobsWithProposals.map(async (job) => {
      const quotes = await auth.getMarketplaceQuotes(job.id, "consumer")
      return quotes.filter((quote) => quote.status === "submitted" || quote.status === "accepted").map((quote) => ({ job, quote }))
    })).then((groups) => {
      if (active) setProposalRows(groups.flat().sort((a, b) => new Date(b.quote.createdAt).getTime() - new Date(a.quote.createdAt).getTime()))
    }).catch((caught: unknown) => {
      if (active) setProposalsError(caught instanceof Error? caught.message : "Could not load worker proposals.")
    }).finally(() => { if (active) setProposalsLoading(false) })
    return () => { active = false }
  }, [auth.getMarketplaceQuotes, jobs])

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    try { unsubscribe = auth.subscribeMarketplaceChanges(() => { void refreshJobs(); void refreshWorkers() }) } catch { /* Periodic refresh below covers unavailable realtime subscriptions. */ }
    const timer = window.setInterval(() => { void refreshJobs(); void refreshWorkers() }, 20000)
    return () => { unsubscribe?.(); window.clearInterval(timer) }
  }, [auth.subscribeMarketplaceChanges, refreshJobs, refreshWorkers])

  const reviewProposals = (jobId: string) => {
    updateStore({ selectedJobId: jobId })
    go("bids")
  }

  return <div className="content">
    <PageHeader title="Find workers" description="Browse approved worker profiles or review proposals submitted for your jobs." action={<Button variant="secondary" onClick={() => { void refreshWorkers(); void refreshJobs() }}>Refresh</Button>} />
    <div className="filters">
      <button className={view === "workers"? "active" : ""} onClick={() => setView("workers")}>Worker directory</button>
      <button className={view === "proposals"? "active" : ""} onClick={() => setView("proposals")}>Submitted proposals ({proposalRows.length})</button>
    </div>
    {view === "workers"? <>
      <div className="provider-directory-filters">
        <label>Search workers<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, skill, or service" /></label>
        <label>Service area<input value={region} onChange={(event) => setRegion(event.target.value)} placeholder="For example, Nairobi" /></label>
      </div>
      {workersError && <p className="form-error" role="alert">{workersError}</p>}
      <p className="caption">{workerTotal} approved {workerTotal === 1? "worker profile" : "worker profiles"}</p>
      {workersLoading? <p role="status">Loading workers…</p> : providers.length? <section className="card table-card provider-directory-table"><div className="table-wrap"><table><thead><tr><th>#</th><th>Worker</th><th>Service area</th><th>About</th><th></th></tr></thead><tbody>{providers.map((worker, index) => <tr key={worker.id}><td>{index + 1}</td><td><div className="provider-table-person"><Avatar src={auth.getProfileAvatarUrl(worker.avatarPath)} name={worker.publicName} /><div><strong>{worker.publicName}</strong><small><Badge tone="green">Verified worker</Badge></small></div></div></td><td>{worker.region || "Not listed"}</td><td className="provider-table-bio">{worker.bio || "No profile description yet."}</td><td><Button variant="secondary" onClick={() => setViewingWorkerId(worker.id)}>View</Button></td></tr>)}</tbody></table></div></section> : !workersError? <EmptyState title="No workers found" detail="Try another skill or service area. Approved worker profiles will appear here." /> : null}
    </> : <>
      <p className="caption">Proposals submitted by workers for your open jobs. Review a job to compare bids and select a worker.</p>
      {jobsError && <p className="form-error" role="alert">{jobsError}</p>}
      {proposalsError && <p className="form-error" role="alert">{proposalsError}</p>}
      <section className="card table-card"><div className="table-wrap"><table>
        <thead><tr><th>#</th><th>Job</th><th>Worker</th><th>Bid</th><th>Availability</th><th>Proposal</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {proposalRows.map(({ job, quote }, index) => <tr key={quote.id}>
            <td>{index + 1}</td><td><strong>{job.title}</strong><br /><small>{job.category} · {job.locationLabel}</small></td>
            <td><button className="table-link" onClick={() => onOpenProvider(quote.providerId)}>{quote.providerName}</button></td>
            <td>KES {(quote.amountMinor / 100).toLocaleString()}</td><td>{quote.availability}</td><td className="proposal-message-cell">{quote.message}</td>
            <td><Badge tone={quote.status === "accepted"? "green" : "amber"}>{quote.status === "accepted"? "selected" : "awaiting review"}</Badge></td>
            <td><Button variant="secondary" onClick={() => reviewProposals(job.id)}>Review bids</Button></td>
          </tr>)}
          {(jobsLoading || proposalsLoading) && !proposalRows.length && <tr><td colSpan={8}>Loading worker proposals…</td></tr>}
          {!jobsLoading && !proposalsLoading && !jobsError && !proposalsError && !proposalRows.length && <tr><td colSpan={8}>No proposals yet. Post a job to receive worker bids.</td></tr>}
        </tbody>
      </table></div></section>
      {!proposalRows.length && !jobsLoading && !proposalsLoading && <div className="card-actions"><Button onClick={() => go("post")}>Post a job</Button></div>}
    </>}
    {viewingWorkerId && <ProviderProfileModal providerId={viewingWorkerId} onClose={() => setViewingWorkerId(null)} />}
  </div>
}

function MapView({ go }: { go: (screen: Screen) => void }) {
  const [selected, setSelected] = useState("Amina Hassan")
  return (
    <div className="content">
      <PageHeader
        title="Nearby providers"
        description="Illustrative map preview · locations are sample data."
        action={
          <Button variant="secondary" onClick={() => go("search")}>
            Back to list
          </Button>
        }
      />
      <div className="map-demo">
        <div className="map-road-label">NAIROBI · KILIMANI</div>
        {["Amina Hassan", "Grace Wairimu", "Brian Otieno"].map(
          (name, index) => (
            <button
              className={`map-marker marker-${index} ${
                selected === name? "selected" : ""
              }`}
              key={name}
              onClick={() => setSelected(name)}
              aria-label={`Show ${name}`}
            >
              <Icon name="location" size={22} />
            </button>
          ),
        )}
      </div>
      <div className="card map-preview">
        <div className="selected-person">
          <Avatar
            src={
              selected === "Amina Hassan"
               ? photos.amina
                : selected === "Grace Wairimu"
                 ? photos.wanjiku
                  : photos.otieno
            }
            name={selected}
          />
          <span>
            <strong>{selected}</strong>
            <small>Available now - ? 4.9 - from KES 800</small>
          </span>
        </div>
        <Button onClick={() => go("profile")}>View provider</Button>
      </div>
    </div>
  )
}

function Chat() {
  return <ServiceMessages role="consumer" />
}

function History({ go }: { go: (screen: Screen) => void }) {
  const auth = useAuth()
  const { updateStore } = useDemoStore()
  const { jobs, loading, error, refresh } = useMarketplaceJobs("consumer")
  const [workerNames, setWorkerNames] = useState<Record<string, string>>({})
  const historyJobs = jobs
    .filter((job) => ["awarded", "in_progress", "completion_pending", "revision_requested", "completed"].includes(job.status))
    .sort((first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime())

  useEffect(() => {
    let active = true
    void Promise.all(historyJobs.map(async (job) => {
      try {
        const quotes = await auth.getMarketplaceQuotes(job.id, "consumer")
        const accepted = quotes.find((quote) => quote.status === "accepted")
        return [job.id, accepted?.providerName ?? "Worker selected"] as const
      } catch {
        return [job.id, "Worker details unavailable"] as const
      }
    })).then((entries) => {
      if (active) setWorkerNames(Object.fromEntries(entries))
    })
    return () => { active = false }
  }, [auth.getMarketplaceQuotes, jobs])

  const openJob = (jobId: string) => {
    updateStore({ selectedJobId: jobId })
    go("bids")
  }

  return <div className="content">
    <PageHeader title="Job history" description="Jobs awarded to workers and their live progress or completion status." action={<Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="card">
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Job</th><th>Worker</th><th>Status</th><th>Area</th><th>Last updated</th><th></th></tr></thead>
          <tbody>
            {historyJobs.map((job, index) => <tr key={job.id}>
              <td>{index + 1}</td>
              <td><strong>{job.title}</strong><br /><small>{job.category} · {job.jobReference}</small></td>
              <td>{workerNames[job.id] ?? "Loading…"}</td>
              <td><Badge tone={job.status === "completed"? "green" : job.status === "revision_requested"? "red" : "amber"}>{job.status === "awarded"? "worker selected" : job.status.replace(/_/g, " ")}</Badge></td>
              <td>{job.locationLabel}</td>
              <td>{new Date(job.updatedAt).toLocaleString()}</td>
              <td><Button variant="ghost" onClick={() => openJob(job.id)}>View job</Button></td>
            </tr>)}
            {!loading && !error && historyJobs.length === 0 && <tr><td colSpan={7}>No jobs have been awarded to a worker yet.</td></tr>}
            {loading && <tr><td colSpan={7}>Loading live job history…</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
    {!historyJobs.length && !loading && !error && <div className="card-actions"><Button onClick={() => go("workFeed")}>Find workers</Button></div>}
  </div>
}
function SavedProviders({ go, onOpenProvider }: { go: (screen: Screen) => void; onOpenProvider: (providerId: string) => void }) {
  const auth = useAuth()
  const [providers, setProviders] = useState<import("../../auth/AuthProvider").MarketplaceProvider[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [removingId, setRemovingId] = useState("")
  const refresh = useCallback(async () => {
    setError("")
    try { setProviders(await auth.getSavedProviders()) }
    catch (caught) { setError(caught instanceof Error? caught.message : "Could not load saved workers.") }
    finally { setLoading(false) }
  }, [auth.getSavedProviders])
  useEffect(() => {
    void refresh()
    let unsubscribe: (() => void) | undefined
    try { unsubscribe = auth.subscribeMarketplaceChanges(() => void refresh()) } catch { /* Polling below keeps the saved list current without realtime configuration. */ }
    const timer = window.setInterval(() => void refresh(), 20000)
    return () => { unsubscribe?.(); window.clearInterval(timer) }
  }, [auth.subscribeMarketplaceChanges, refresh])
  const remove = async (providerId: string) => {
    setRemovingId(providerId)
    setError("")
    try { await auth.removeSavedProvider(providerId); setProviders((items) => items.filter((item) => item.id !== providerId)) }
    catch (caught) { setError(caught instanceof Error? caught.message : "Could not remove this provider.") }
    finally { setRemovingId("") }
  }
  return <div className="content">
    <PageHeader title="Saved workers" description="Your personal shortlist of approved workers." action={<Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading? <p role="status">Loading your saved workers…</p> : providers.length? <div className="provider-directory-grid">
      {providers.map((provider) => <section className="saved-provider-item" key={provider.id}>
        <ProviderDirectoryCard provider={provider} onClick={() => onOpenProvider(provider.id)} />
        <Button variant="ghost" disabled={removingId === provider.id} onClick={() => void remove(provider.id)}>{removingId === provider.id? "Removing…" : "Remove from saved"}</Button>
      </section>)}
    </div> : !error? <EmptyState title="No saved workers yet" detail="Open an approved worker profile and save it to keep it on your shortlist." action={() => go("workFeed")} actionLabel="Find workers" /> : null}
  </div>
}
function CustomerDispute({ listingId, onBack }: { listingId: string | null; onBack: () => void }) {
  const auth = useAuth()
  const [listings, setListings] = useState<import("../../auth/AuthProvider").ServiceListing[]>([])
  const { jobs: marketplaceJobs, loading: marketplaceJobsLoading, error: marketplaceJobsError } = useMarketplaceJobs("consumer")
  const [jobSearch, setJobSearch] = useState("")
  const [selectedId, setSelectedId] = useState(listingId ?? "")
  const [reason, setReason] = useState<"other" | "unsafe" | "fraud" | "harassment" | "off_platform_payment">("other")
  const [details, setDetails] = useState("")
  const [report, setReport] = useState<{ id: string; status: string; createdAt: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    void auth.getServiceListings("consumer", "mine").then((items) => { if (active) setListings(items) }).catch((caught: unknown) => { if (active) setError(caught instanceof Error? caught.message : "Could not load your jobs.") }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [auth.getServiceListings])
  useEffect(() => { if (listingId) setSelectedId(listingId) }, [listingId])
  const reportableJobs = [
    ...listings.map((item) => ({ id: item.id, jobReference: item.jobReference, title: item.title, counterpart: item.providerName, status: item.status })),
    ...marketplaceJobs.map((item) => ({ id: item.id, jobReference: item.jobReference, title: item.title, counterpart: "Marketplace worker", status: item.status })),
  ]
  const search = jobSearch.trim().toLocaleLowerCase()
  const filteredJobs = reportableJobs.filter((item) => !search || [item.jobReference, item.title, item.counterpart].some((value) => value.toLocaleLowerCase().includes(search)))
  const selected = reportableJobs.find((item) => item.id === selectedId)
  const submit = async () => {
    if (!selected) { setError("Choose one of your jobs."); return }
    setBusy(true)
    setError("")
    try {
      setReport(await auth.createModerationReport({ subjectType: "job", subjectId: selected.id, reason, details: details.trim() }))
    } catch (caught) {
      setError(caught instanceof Error? caught.message : "Could not submit your report.")
    } finally {
      setBusy(false)
    }
  }
  return <div className="content narrow">
    <PageHeader title={report? "Report submitted" : "Get help with your job"} description={selected? `Job ID ${selected.jobReference} · ${selected.title} · ${selected.counterpart}` : "Choose a job from your history to contact support about it."} />
    {(error || marketplaceJobsError) && <p className="form-error" role="alert">{error || marketplaceJobsError}</p>}
    {report? <section className="card"><Badge tone="green">Received</Badge><h2>Your report is in the support queue</h2><p>Job ID: {selected?.jobReference ?? "Unavailable"}</p><p>Report reference: {report.id}</p><p>Status: {report.status.replace(/_/g, " ")}</p><Button onClick={onBack}>Back to job history</Button></section> : <section className="form-card">
      {loading || marketplaceJobsLoading? <p role="status">Loading your jobs…</p> : <>
        <label>Search jobs by ID or title<input value={jobSearch} onChange={(event) => setJobSearch(event.target.value)} placeholder="For example, OJ-0000000042" /></label>
        <label>Job<select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}><option value="">Choose a job</option>{filteredJobs.map((item) => <option key={item.id} value={item.id}>{item.jobReference} · {item.title} · {item.status.replace(/_/g, " ")}</option>)}</select></label>
      </>}
      <label>Issue<select value={reason} onChange={(event) => setReason(event.target.value as typeof reason)}><option value="other">Work quality, missed visit, or other issue</option><option value="unsafe">Safety concern</option><option value="harassment">Harassment</option><option value="fraud">Fraud</option><option value="off_platform_payment">Asked to pay outside OddJobs</option></select></label>
      <label>Details<textarea rows={5} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} placeholder="Describe what happened and what help you need." /></label>
      <div className="card-actions"><Button variant="secondary" onClick={onBack}>Cancel</Button><Button disabled={busy || loading || !selected || details.trim().length < 10} onClick={() => void submit()}>{busy? "Submitting…" : "Submit report"}</Button></div>
    </section>}
  </div>
}
function Settings({ go }: { go: (s: Screen) => void }) {
  const auth = useAuth()
  const isAdmin = auth.profile?.roles.includes("admin") ?? false
  const hasProviderRole = auth.profile?.roles.includes("provider") ?? false
  const [workerProfile, setWorkerProfile] = useState<MarketplaceProvider | null>(null)
  const [workerName, setWorkerName] = useState("")
  const [workerRegion, setWorkerRegion] = useState("")
  const [workerBio, setWorkerBio] = useState("")
  const [workerServiceLatitude, setWorkerServiceLatitude] = useState<number | null>(null)
  const [workerServiceLongitude, setWorkerServiceLongitude] = useState<number | null>(null)
  const [workerTravelDistance, setWorkerTravelDistance] = useState("25")
  const [workerProfileLoading, setWorkerProfileLoading] = useState(false)
  const [workerProfileSaving, setWorkerProfileSaving] = useState(false)
  const [workerProfileNotice, setWorkerProfileNotice] = useState("")
  const [workerProfileError, setWorkerProfileError] = useState("")
  const [displayName, setDisplayName] = useState(auth.profile?.displayName ?? "")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState("")
  const [profileBusy, setProfileBusy] = useState(false)
  const [profileMessage, setProfileMessage] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordMessage, setPasswordMessage] = useState("")
  const [adminActivity, setAdminActivity] = useState<AdminAuditEvent[]>([])
  useEffect(() => { setDisplayName(auth.profile?.displayName ?? "") }, [auth.profile?.displayName])
  useEffect(() => {
    if (!isAdmin) return
    void auth.getAdminAuditEvents(25, 0).then((page) => setAdminActivity(page.items.filter((event) => event.actorUserId === auth.profile?.id).slice(0, 5))).catch(() => setAdminActivity([]))
  }, [auth.getAdminAuditEvents, auth.profile?.id, isAdmin])
  useEffect(() => {
    if (profileMessage !== "Your account profile was updated.") return
    const timeout = window.setTimeout(() => setProfileMessage(""), 3000)
    return () => window.clearTimeout(timeout)
  }, [profileMessage])
  useEffect(() => {
    if (!hasProviderRole || !auth.profile?.id) return
    let current = true
    setWorkerProfileLoading(true)
    setWorkerProfileError("")
    void auth.getMarketplaceProvider(auth.profile.id).then((profile) => {
      if (!current) return
      setWorkerProfile(profile)
      setWorkerName(profile.publicName)
      setWorkerRegion(profile.region)
      setWorkerBio(profile.bio)
      setWorkerServiceLatitude(profile.serviceLatitude ?? null)
      setWorkerServiceLongitude(profile.serviceLongitude ?? null)
      setWorkerTravelDistance(String(profile.maxTravelDistanceKm ?? 25))
    }).catch((caught: unknown) => {
      if (current) setWorkerProfileError(caught instanceof Error? caught.message : "Could not load your profile.")
    }).finally(() => { if (current) setWorkerProfileLoading(false) })
    return () => { current = false }
  }, [auth.getMarketplaceProvider, auth.profile?.id, hasProviderRole])
  useEffect(() => {
    if (!avatarFile) { setAvatarPreview(""); return }
    const previewUrl = URL.createObjectURL(avatarFile)
    setAvatarPreview(previewUrl)
    return () => URL.revokeObjectURL(previewUrl)
  }, [avatarFile])
  const saveProfile = async () => {
    setProfileBusy(true)
    setProfileMessage("")
    try { await auth.updateProfile(displayName, avatarFile ?? undefined); setAvatarFile(null); setProfileMessage("Your account profile was updated.") }
    catch (caught) { setProfileMessage(caught instanceof Error? caught.message : "Could not update your profile.") }
    finally { setProfileBusy(false) }
  }
  const savePassword = async () => {
    if (newPassword.length < 8) { setPasswordMessage("Use at least 8 characters for your password."); return }
    if (newPassword !== confirmPassword) { setPasswordMessage("The passwords do not match."); return }
    setPasswordBusy(true); setPasswordMessage("")
    try {
      const error = await auth.updatePassword(newPassword)
      if (error) { setPasswordMessage(error); return }
      setNewPassword(""); setConfirmPassword(""); setPasswordMessage("Password updated successfully.")
    } catch (caught) { setPasswordMessage(caught instanceof Error? caught.message : "Could not update your password.") }
    finally { setPasswordBusy(false) }
  }
  const saveWorkerProfile = async () => {
    setWorkerProfileSaving(true)
    setWorkerProfileError("")
    setWorkerProfileNotice("")
    try {
      const saved = await auth.updateMarketplaceProviderProfile({ publicName: workerName, region: workerRegion, bio: workerBio, serviceLatitude: workerServiceLatitude, serviceLongitude: workerServiceLongitude, maxTravelDistanceKm: Number(workerTravelDistance) })
      setWorkerProfile(saved)
      setWorkerName(saved.publicName)
      setWorkerRegion(saved.region)
      setWorkerBio(saved.bio)
      setWorkerServiceLatitude(saved.serviceLatitude ?? null)
      setWorkerServiceLongitude(saved.serviceLongitude ?? null)
      setWorkerTravelDistance(String(saved.maxTravelDistanceKm ?? 25))
      setWorkerProfileNotice("Your profile is saved and will appear to hirers reviewing your bids.")
    } catch (caught) {
      setWorkerProfileError(caught instanceof Error? caught.message : "Could not save your profile.")
    } finally {
      setWorkerProfileSaving(false)
    }
  }
  return (
    <div className="content narrow">
      <PageHeader
        title={isAdmin? "Admin account" : "Settings"}
        description={isAdmin? "Manage your admin profile and sign-in security." : hasProviderRole? "Manage your account and the profile hirers see with your bids." : "Manage your account and identity details."}
      />
      {hasProviderRole && <section className="card setting-card account-settings-card">
        <h2>My profile</h2>
        <p className="caption">This information is shown to hirers when they review your proposal. Your private contact details are not included.</p>
        {workerProfileLoading? <p role="status">Loading your profile…</p> : <>
          <label>Public name<input value={workerName} maxLength={120} onChange={(event) => setWorkerName(event.target.value)} placeholder="Name shown to hirers" /></label>
          <label>Service area<input value={workerRegion} maxLength={120} onChange={(event) => setWorkerRegion(event.target.value)} placeholder="For example, Westlands, Nairobi" /></label>
          <div className="form-card"><h3>Jobs near my service area</h3><p className="caption">Save an approximate location so nearby jobs appear first. Your coordinates stay private; hirers and other workers see your service area text only.</p><div className="card-actions"><Button variant="secondary" type="button" onClick={() => {
            if (!navigator.geolocation) { setWorkerProfileError("Location is not available in this browser."); return }
            navigator.geolocation.getCurrentPosition((position) => { setWorkerServiceLatitude(Number(position.coords.latitude.toFixed(4))); setWorkerServiceLongitude(Number(position.coords.longitude.toFixed(4))); setWorkerProfileError("") }, () => setWorkerProfileError("We could not read your location. You can still browse jobs without distance sorting."), { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 })
          }}>{workerServiceLatitude === null? "Use approximate current location" : "Update my approximate location"}</Button>{workerServiceLatitude !== null && <Button variant="ghost" type="button" onClick={() => { setWorkerServiceLatitude(null); setWorkerServiceLongitude(null) }}>Remove location</Button>}</div><label>Maximum travel distance (km)<input type="number" min={1} max={250} step={1} value={workerTravelDistance} onChange={(event) => setWorkerTravelDistance(event.target.value)} /></label><small>Choose from 1 to 250 km. Distance is used to rank jobs and filter your feed.</small></div>
          <label>About me and my experience<textarea rows={5} value={workerBio} maxLength={2000} onChange={(event) => setWorkerBio(event.target.value)} placeholder="Describe your skills, experience, and how you work." /></label>
          {workerProfileError && <p className="form-error" role="alert">{workerProfileError}</p>}
          {workerProfileNotice && <p className="form-success" role="status">{workerProfileNotice}</p>}
          <Button disabled={workerProfileSaving || !workerName.trim() || !workerProfile || Number(workerTravelDistance) < 1 || Number(workerTravelDistance) > 250 || !Number.isInteger(Number(workerTravelDistance)) || (workerName.trim() === workerProfile.publicName && workerRegion.trim() === workerProfile.region && workerBio.trim() === workerProfile.bio && workerServiceLatitude === (workerProfile.serviceLatitude ?? null) && workerServiceLongitude === (workerProfile.serviceLongitude ?? null) && Number(workerTravelDistance) === (workerProfile.maxTravelDistanceKm ?? 25))} onClick={() => void saveWorkerProfile()}>{workerProfileSaving? "Saving…" : "Save my profile"}</Button>
        </>}
      </section>}
      <section className="card setting-card account-settings-card">
        <h2>{isAdmin? "Admin profile" : "Account profile"}</h2>
        <label>Profile photo<div className="account-avatar-edit"><Avatar src={avatarPreview || auth.getProfileAvatarUrl(auth.profile?.avatarPath)} name={displayName || "Your profile"} /><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} /></div><small>JPG, PNG, or WebP; up to 2 MB.</small></label>
        <label>Display name<input value={displayName} maxLength={120} onChange={(event) => setDisplayName(event.target.value)} /></label>
        {profileMessage && <p className={profileMessage.startsWith("Your account")? "form-success" : "form-error"} role="status">{profileMessage}</p>}
        <div className="card-actions"><Button disabled={profileBusy || !displayName.trim() || (displayName.trim() === auth.profile?.displayName && !avatarFile)} onClick={() => void saveProfile()}>{profileBusy? "Saving…" : "Save profile"}</Button>{!isAdmin && auth.profile?.roles.includes("consumer") && <Button variant="secondary" onClick={() => go("identityVerification")}>Hirer ID verification</Button>}{!isAdmin && auth.profile?.roles.includes("provider") && <Button variant="secondary" onClick={() => go("providerVerification")}>Worker ID verification</Button>}</div>
      </section>
      {isAdmin && <>
        <section className="card setting-card account-settings-card">
          <h2>Sign-in security</h2>
          <p className="caption">Set a strong password that you do not use on other sites.</p>
          <label>New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
          <label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          {passwordMessage && <p className={passwordMessage.includes("successfully")? "form-success" : "form-error"} role="status">{passwordMessage}</p>}
          <Button disabled={passwordBusy || newPassword.length < 8 || !confirmPassword} onClick={() => void savePassword()}>{passwordBusy? "Updating…" : "Update password"}</Button>
        </section>
        <section className="card setting-card account-settings-card">
          <h2>Admin access</h2>
          <div className="setting-line"><span>Workspace roles</span><strong>{auth.profile?.roles.join(", ") || "—"}</strong></div>
          <div className="setting-line"><span>Account status</span><Badge tone={auth.profile?.status === "active"? "green" : "amber"}>{auth.profile?.status ?? "Unknown"}</Badge></div>
          <p className="caption">Identity document reviews are handled from Verification. In-app alerts are available from the notification bell; email and push delivery are not configured.</p>
        </section>
        <section className="card table-card account-settings-card">
          <div className="section-title"><div><h2>Recent admin activity</h2><p className="caption">Latest actions recorded for this account.</p></div></div>
          {adminActivity.length? <div className="table-wrap"><table><thead><tr><th>#</th><th>Action</th><th>Time</th></tr></thead><tbody>{adminActivity.map((event, index) => <tr key={event.id}><td>{index + 1}</td><td>{event.action.replaceAll("_", " ").replaceAll(".", " · ")}</td><td>{new Date(event.createdAt).toLocaleString()}</td></tr>)}</tbody></table></div> : <p className="caption">No recent admin actions found.</p>}
        </section>
      </>}
    </div>
  )
}

export type CustomerScreenKey =
  | "payments"
  | "home"
  | "hiringAnalytics"
  | "hiringGuide"
  | "post"
  | "jobs"
  | "bids"
  | "checkout"
  | "track"
  | "chat"
  | "review"
  | "dispute"
  | "history"
  | "saved"
  | "settings"
  | "map"
  | "workFeed"

export default function CustomerScreens({ screen, go, onOpenProvider, disputeListingId = null, onOpenDispute = () => {} }: {
  screen: CustomerScreenKey
  go: (screen: Screen) => void
  onOpenProvider: (providerId: string) => void
  disputeListingId?: string | null
  onOpenDispute?: (listingId: string) => void
}) {
  switch (screen) {
    case "payments": return <HirerPayments />
    case "home": return <HiringDashboard go={go} />
    case "hiringAnalytics": return <HiringAnalytics go={go} />
    case "hiringGuide": return <HiringGuide go={go} />
    case "post": return <PostJob go={go} />
    case "jobs": return <ConsumerJobs go={go} />
    case "bids": return <Bids go={go} onOpenProvider={onOpenProvider} />
    case "checkout": return <Checkout go={go} />
    case "track": return <Tracking go={go} />
    case "chat": return <Chat />
    case "review": return <Review go={go} />
    case "dispute": return <CustomerDispute listingId={disputeListingId} onBack={() => go("history")} />
    case "history": return <History go={go} />
    case "saved": return <SavedProviders go={go} onOpenProvider={onOpenProvider} />
    case "settings": return <Settings go={go} />
    case "map": return <MapView go={go} />
    case "workFeed": return <WorkFeed onOpenProvider={onOpenProvider} go={go} />
    default: return null
  }
}
