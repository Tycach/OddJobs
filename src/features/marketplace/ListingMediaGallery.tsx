import { useEffect, useRef, useState } from "react"
import { useAuth, type ServiceListingMedia } from "../../auth/AuthProvider"

export default function ListingMediaGallery({
  media,
}: {
  media: ServiceListingMedia[]
}) {
  const { getServiceListingMediaUrl } = useAuth()
  const [expanded, setExpanded] = useState<ServiceListingMedia | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (expanded && !dialog.open) dialog.showModal()
    if (!expanded && dialog.open) dialog.close()
  }, [expanded])
  if (!media.length) return null

  return (
    <>
      <div className="listing-media-gallery" aria-label="Listing photos and videos">
        {media.map((item) => {
          const src = getServiceListingMediaUrl(item.path)
          return item.contentType.startsWith("video/") ? (
            <div className="listing-media-open" key={item.path}>
              <video className="listing-media-item" src={src} controls playsInline preload="metadata" aria-label="Video attached to this listing" />
              <button type="button" onClick={() => setExpanded(item)}>View full size</button>
            </div>
          ) : (
            <button className="listing-media-open" type="button" key={item.path} onClick={() => setExpanded(item)} aria-label="View photo full size">
              <img className="listing-media-item" src={src} alt="Work photo attached to this listing" loading="lazy" />
              <span>View full size</span>
            </button>
          )
        })}
      </div>
      <dialog className="listing-media-dialog" ref={dialogRef} onClose={() => setExpanded(null)} onClick={(event) => { if (event.target === dialogRef.current) setExpanded(null) }}>
        <button className="listing-media-dialog-close" type="button" onClick={() => setExpanded(null)} aria-label="Close full size media">Close</button>
        {expanded && (expanded.contentType.startsWith("video/") ? <video src={getServiceListingMediaUrl(expanded.path)} controls autoPlay playsInline /> : <img src={getServiceListingMediaUrl(expanded.path)} alt="Work sample enlarged" />)}
      </dialog>
    </>
  )
}
