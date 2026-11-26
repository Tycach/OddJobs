import { useEffect, useState } from "react"
import { useAuth, type MarketplaceProvider, type ServiceListing, type ServiceListingReview } from "../../auth/AuthProvider"
import { useMarketplaceProviders } from "../marketplace/hooks"
import { Avatar, Badge, Button } from "../../shared/components/WorkspaceUi"
import ListingMediaGallery from "../marketplace/ListingMediaGallery"
import { useDemoStore } from "../../demo/context"

export default function ProviderDirectory() {
  const [search, setSearch] = useState("")
  const [region, setRegion] = useState("")
  const [offset, setOffset] = useState(0)
  const [viewingProviderId, setViewingProviderId] = useState<string | null>(null)
  const pageSize = 25
  const { getProfileAvatarUrl } = useAuth()
  const { providers, total, loading, error, refresh } = useMarketplaceProviders(search, region, pageSize, offset)

  return (
    <div className="content">
      <header className="page-header">
        <div>
      <span className="eyebrow">Verified worker directory</span>
          <h1>Find trusted workers</h1>
          <p>Browse public profiles for approved OddJobs workers.</p>
        </div>
      </header>
      <div className="provider-directory-filters">
        <label className="search-box active">
          <span aria-hidden="true">⌕</span>
          <input
            aria-label="Search workers"
            value={search}
            onChange={(event) => { setOffset(0); setSearch(event.target.value) }}
            placeholder="Search skill, worker, or area"
          />
        </label>
        <label>
          Service area
          <input
            value={region}
            onChange={(event) => { setOffset(0); setRegion(event.target.value) }}
            placeholder="For example, Nairobi"
          />
        </label>
      </div>
      <p className="caption">{total} verified {total === 1 ? "worker profile" : "worker profiles"}</p>
      {error && (
        <p className="form-error" role="alert">
          {error} <button type="button" onClick={() => void refresh()}>Retry</button>
        </p>
      )}
      {loading ? (
        <p className="center-note" role="status">Finding approved workers…</p>
      ) : providers.length ? (
        <section className="card table-card provider-directory-table"><div className="table-wrap"><table><thead><tr><th>#</th><th>Worker</th><th>Service area</th><th>About</th><th></th></tr></thead><tbody>{providers.map((provider, index) => <tr key={provider.id}><td>{offset + index + 1}</td><td><div className="provider-table-person"><Avatar src={getProfileAvatarUrl(provider.avatarPath)} name={provider.publicName} /><div><strong>{provider.publicName}</strong><small><Badge tone="green">Verified worker</Badge></small></div></div></td><td>{provider.region || "Not listed"}</td><td className="provider-table-bio">{provider.bio || "No profile description yet."}</td><td><Button variant="secondary" onClick={() => setViewingProviderId(provider.id)}>View profile</Button></td></tr>)}</tbody></table></div></section>
      ) : !error ? (
        <section className="card">
          <h2>No workers found</h2>
          <p>Try another service or area. New approved profiles will appear here.</p>
        </section>
      ) : null}
      {total > pageSize && (
        <div className="card-actions">
          <button className="btn btn-secondary" disabled={loading || offset === 0} onClick={() => setOffset((value) => Math.max(0, value - pageSize))}>Previous</button>
          <span>{offset + 1}–{Math.min(offset + providers.length, total)} of {total}</span>
          <button className="btn btn-secondary" disabled={loading || offset + pageSize >= total} onClick={() => setOffset((value) => value + pageSize)}>Next</button>
        </div>
      )}
      <p className="caption">
        Contact details are not shown here. Post a job and review proposals from workers.
      </p>
      {viewingProviderId && <ProviderProfileModal providerId={viewingProviderId} onClose={() => setViewingProviderId(null)} />}
    </div>
  )
}


export function ProviderDirectoryCard({
  provider,
  onClick,
}: {
  provider: MarketplaceProvider
  onClick: () => void
}) {
  const { getProfileAvatarUrl } = useAuth()
  return (
    <button className="card provider-directory-card" onClick={onClick}>
      <Avatar src={getProfileAvatarUrl(provider.avatarPath)} name={provider.publicName} />
      <span className="badge badge-green">Approved worker</span>
      <h2>{provider.publicName}</h2>
      <p className="provider-directory-region">{provider.region || "Service area not listed"}</p>
      <p>{provider.bio || "This worker has not added a service description yet."}</p>
      <span className="provider-directory-link">View public profile →</span>
    </button>
  )
}

export function ProviderProfile({
  providerId,
  onPostJob,
  isOwnProfile = false,
  showPostJobAction = true,
}: {
  providerId: string | null
  onPostJob: () => void
  isOwnProfile?: boolean
  showPostJobAction?: boolean
}) {
  const { store } = useDemoStore()
  const { getMarketplaceProvider, getPublicProviderReviews, getProfileAvatarUrl, getServiceListings, getSavedProviders, saveProvider, removeSavedProvider } = useAuth()
  const [provider, setProvider] = useState<MarketplaceProvider | null>(null)
  const [reviews, setReviews] = useState<ServiceListingReview[]>([])
  const [workSamples, setWorkSamples] = useState<ServiceListing[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [isSaved, setIsSaved] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState("")

  useEffect(() => {
    let active = true
    if (isOwnProfile || !providerId) return () => { active = false }
    void getSavedProviders().then((savedProviders) => {
      if (active) setIsSaved(savedProviders.some((saved) => saved.id === providerId || saved.userId === providerId))
    }).catch(() => { if (active) setIsSaved(false) })
    return () => { active = false }
  }, [getSavedProviders, isOwnProfile, providerId])

  const toggleSaved = async () => {
    if (!provider || saveLoading) return
    setSaveLoading(true)
    setSaveError("")
    try {
      if (isSaved) await removeSavedProvider(provider.id)
      else await saveProvider(provider.id)
      setIsSaved(!isSaved)
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : "Could not update your saved providers.")
    } finally {
      setSaveLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    setProvider(null)
    setReviews([])
    setWorkSamples([])
    setError("")
    if (!providerId) {
      setLoading(false)
      setError("Choose a provider from the directory to view their profile.")
      return () => { active = false }
    }
    setLoading(true)
    const role = isOwnProfile ? "provider" : "consumer"
    void Promise.allSettled([
      getMarketplaceProvider(providerId, !isOwnProfile && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(store.selectedJobId) ? store.selectedJobId : undefined),
      getPublicProviderReviews(providerId),
      getServiceListings(role, isOwnProfile ? "mine" : "feed"),
    ]).then(([profileResult, reviewsResult, listingsResult]) => {
      if (!active) return
      if (profileResult.status === "fulfilled") setProvider(profileResult.value)
      else setError(profileResult.reason instanceof Error ? profileResult.reason.message : "Could not load this provider profile.")
      if (reviewsResult.status === "fulfilled") setReviews(reviewsResult.value)
      if (listingsResult.status === "fulfilled") {
        const providerUserId = profileResult.status === "fulfilled" ? profileResult.value.userId : null
        setWorkSamples(listingsResult.value.filter((listing) => (listing.providerId === providerId || listing.providerId === providerUserId) && listing.status === "open"))
      }
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [getMarketplaceProvider, getPublicProviderReviews, getServiceListings, isOwnProfile, providerId, store.selectedJobId])

  if (loading) return <p className="center-note" role="status">Loading provider profile…</p>
  if (error || !provider) {
    return (
      <div className="content narrow">
        <p className={error ? "form-error" : "caption"} role={error ? "alert" : undefined}>
          {error || "Provider profile not found."}
        </p>
      </div>
    )
  }

  return (
    <div className="content narrow">
      <section className="card provider-profile-card">
        <span className={isOwnProfile ? "badge" : "badge badge-green"}>{isOwnProfile ? "My profile" : "Worker profile"}</span>
        <Avatar large src={getProfileAvatarUrl(provider.avatarPath)} name={provider.publicName} />
        <h1>{provider.publicName}</h1>
        {!isOwnProfile && <Button variant={isSaved ? "secondary" : "primary"} disabled={saveLoading} onClick={() => void toggleSaved()}>{saveLoading ? "Saving…" : isSaved ? "Remove from saved" : "Save worker"}</Button>}
        {saveError && <p className="form-error" role="alert">{saveError}</p>}
        <p className="provider-directory-region">{provider.region || "Service area not listed"}</p>
        <p>{provider.bio || "This provider has not added a service description yet."}</p>
        <section className="provider-profile-reviews">
          <h2>{isOwnProfile ? "Skills and work samples" : "Services and work samples"}</h2>
          {workSamples.length ? workSamples.map((sample) => <article className="card job-summary" key={sample.id}><Badge>{sample.category}</Badge><h3>{sample.title}</h3><p>{sample.description}</p><p className="caption">{sample.locationLabel}{sample.budgetMinor !== null ? ` · From KES ${(sample.budgetMinor / 100).toLocaleString()}` : ""}</p><ListingMediaGallery media={sample.media ?? []} /></article>) : <p>This provider has not published service photos or work samples yet.</p>}
        </section>
        <section className="provider-profile-reviews">
          <h2>Customer reviews</h2>
          {reviews.length === 0 ? <p>No completed-job reviews yet.</p> : <><p className="rating">{(reviews.reduce((sum, item) => sum + item.rating, 0) / reviews.length).toFixed(1)} / 5 · {reviews.length} verified {reviews.length === 1 ? "review" : "reviews"}</p>{reviews.map((review) => <article className="review-card" key={review.id}><div className="review-head"><div><strong>{review.reviewerName}</strong><small>{review.listingTitle} · {new Date(review.createdAt).toLocaleDateString()}</small></div><span className="rating">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div>{review.comment && <p>{review.comment}</p>}</article>)}</>}
        </section>
        <p className="caption">Private contact details stay hidden. Message this worker through the conversation attached to your job.</p>
        {showPostJobAction && <button className="btn btn-primary" onClick={onPostJob}>{isOwnProfile ? "Back to worker dashboard" : "Post a job"}</button>}
      </section>
    </div>
  )
}

export function ProviderProfileModal({ providerId, onClose }: { providerId: string; onClose: () => void }) {
  return <div className="provider-profile-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="provider-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="worker-profile-modal-title"><div className="provider-profile-dialog-heading"><div><span className="eyebrow">Approved worker</span><h2 id="worker-profile-modal-title">Worker profile</h2></div><button type="button" className="notification-modal-close" onClick={onClose} aria-label="Close worker profile">×</button></div><ProviderProfile providerId={providerId} onPostJob={onClose} showPostJobAction={false} /></section></div>
}
