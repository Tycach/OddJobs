import { useState } from "react"
import { useAuth } from "../../auth/AuthProvider"
import { Button } from "../../shared/components/WorkspaceUi"

export function ListingReviewForm({
  listingId,
  listingTitle,
  revieweeName,
  onSaved,
}: {
  listingId: string
  listingTitle: string
  revieweeName: string
  onSaved: () => void
}) {
  const { createServiceListingReview } = useAuth()
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const save = async () => {
    setBusy(true)
    setError("")
    try {
      await createServiceListingReview(listingId, rating, comment)
      onSaved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your review.")
    } finally {
      setBusy(false)
    }
  }
  return <section className="card review-editor" aria-label={`Review ${revieweeName}`}>
    <h3>Review {revieweeName}</h3>
    <p className="caption">Completed job: {listingTitle}</p>
    <div className="stars" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} aria-label={`${value} star${value === 1 ? "" : "s"}`} aria-pressed={rating === value} onClick={() => setRating(value)}>{value <= rating ? "★" : "☆"}</button>)}
    </div>
    <label className="review-comment-label">Share details (optional)
      <textarea maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Describe how the work went." />
    </label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <Button disabled={busy} onClick={() => void save()}>{busy ? "Saving review…" : "Submit review"}</Button>
  </section>
}
