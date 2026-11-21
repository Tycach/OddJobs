import type { MarketplaceJob } from "../../auth/AuthProvider"

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString() : "Not set"
}

export function JobTimeline({ job }: { job: MarketplaceJob }) {
  const applicationLabel = job.status === "expired" ? "Applications closed" : "Applications close"
  return (
    <section className="job-timeline" aria-label="Job timeline">
      <h2>Job timeline</h2>
      <ol>
        <li className="complete">
          <span className="job-timeline-marker" aria-hidden="true" />
          <div><strong>Job posted</strong><time>{formatDate(job.createdAt)}</time></div>
        </li>
        <li className={job.status === "open" ? "current" : "complete"}>
          <span className="job-timeline-marker" aria-hidden="true" />
          <div><strong>{applicationLabel}</strong><time>{formatDate(job.applicationDeadlineAt)}</time></div>
        </li>
        <li className={job.status === "awarded" ? "current" : ["in_progress", "completion_pending", "revision_requested", "completed"].includes(job.status) ? "complete" : ""}>
          <span className="job-timeline-marker" aria-hidden="true" />
          <div><strong>Preferred start</strong><time>{formatDate(job.requestedFor)}</time></div>
        </li>
        <li className={job.status === "completed" ? "complete" : job.status === "completion_pending" || job.status === "revision_requested" ? "current" : ""}>
          <span className="job-timeline-marker" aria-hidden="true" />
          <div><strong>Work due</strong><time>{formatDate(job.dueAt)}</time></div>
        </li>
        <li className="current">
          <span className="job-timeline-marker" aria-hidden="true" />
          <div><strong>Status: {job.status.replace(/_/g, " ")}</strong><time>Updated {formatDate(job.updatedAt)}</time></div>
        </li>
      </ol>
    </section>
  )
}
