import { useState } from "react"
import { useDemoStore } from "../../demo/context"
import { Avatar, Badge, Button, DataTable, DemoNotice, Icon, Metric, PageHeader } from "../../shared/components/WorkspaceUi"

const photos = {
  wanjiku: "https://images.unsplash.com/photo-1713746965378-0140784d2ab9?auto=format&fit=crop&w=500&q=80",
}
function KnowledgeBase() {
  const [articles, setArticles] = useState([
    "Keeping your phone number private",
    "Understanding the demo escrow flow",
    "Updating provider availability",
  ])
  const [draft, setDraft] = useState("")
  return (
    <div className="content console-content">
      <PageHeader
        title="Knowledge base"
        description="Edit sample support articles in this browser."
      />
      <DemoNotice>
        Articles are stored only for this session and are not published to
        customers.
      </DemoNotice>
      <section className="form-card">
        {articles.map((article, index) => (
          <div className="setting-line" key={`${index}-${article}`}>
            <span>{article}</span>
            <Button
              variant="ghost"
              onClick={() =>
                setArticles(articles.filter((_, i) => i !== index))
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <label>
          New article title
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Write an article title"
          />
        </label>
        <Button
          onClick={() => {
            if (draft.trim()) {
              setArticles([...articles, draft.trim()])
              setDraft("")
            }
          }}
        >
          Add demo article
        </Button>
      </section>
    </div>
  )
}

function Disputes() {
  const { store, updateStore } = useDemoStore()
  const [message, setMessage] = useState("")
  const resolve = (result: string) => {
    updateStore({
      adminActions: [
        `Dispute demo resolution: ${result}`,
        ...store.adminActions,
      ],
    })
    setMessage(`${result} recorded locally. No money moved.`)
  }
  return (
    <div className="content console-content">
      <PageHeader
        eyebrow="Support operations"
        title="Dispute console"
        description="12 open · 3 nearing SLA"
        action={
          <Button
            variant="secondary"
            onClick={() => setMessage("SLA queue is demo data.")}
          >
            Queue settings
          </Button>
        }
      />
      <div className="split-console disputes">
        <section className="queue-list">
          {[
            ["#D-884 · Damaged tap", "SLA 18m"],
            ["#D-881 · Incomplete job", "SLA 42m"],
            ["#D-879 · Late cancellation", "SLA 1h 12m"],
          ].map((x, i) => (
            <button className={i === 0 ? "active" : ""} key={x[0]}>
              <span>
                <strong>{x[0]}</strong>
                <small>Wanjiku M. vs Brian O.</small>
              </span>
              <Badge tone="amber">{x[1]}</Badge>
            </button>
          ))}
        </section>
        <section className="card case-view">
          <div className="section-title">
            <div>
              <h2>Damaged tap after repair</h2>
              <span>Job #OJ-2751 · KES 3,200 in demo escrow</span>
            </div>
            <Badge tone="red">High priority</Badge>
          </div>
          <div className="case-columns">
            <div>
              <h3>Customer statement</h3>
              <p>
                “The replacement started leaking again the same evening. I
                shared a video in chat.”
              </p>
            </div>
            <div>
              <h3>Provider response</h3>
              <p>
                “The replacement part was customer-supplied. I offered to return
                tomorrow.”
              </p>
            </div>
          </div>
          <div className="evidence-row">
            <span>
              <Icon name="message" /> 18 sample chat messages
            </span>
            <span>
              <Icon name="layout" /> Sample evidence
            </span>
            <span>
              <Icon name="wallet" /> Demo payment
            </span>
          </div>
          <label>
            Resolution notes
            <textarea rows={4} placeholder="Document evidence and decision…" />
          </label>
          <div className="card-actions">
            <Button onClick={() => resolve("Partial refund")}>
              Simulate partial refund
            </Button>
            <Button variant="secondary" onClick={() => resolve("Full refund")}>
              Simulate full refund
            </Button>
            <Button variant="ghost" onClick={() => resolve("Force release")}>
              Simulate release
            </Button>
          </div>
          {message && <DemoNotice>{message}</DemoNotice>}
        </section>
      </div>
    </div>
  )
}

function Inbox() {
  const { store, updateStore } = useDemoStore()
  const [draft, setDraft] = useState("")
  const send = () => {
    if (!draft.trim()) return
    updateStore({ messages: [...store.messages, draft.trim()] })
    setDraft("")
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="Unified support inbox"
        description="Demo support replies are saved locally."
      />
      <div className="inbox-layout">
        <section className="queue-list">
          {[
            "Wanjiku M. · Payment question",
            "Amina H. · Verification delay",
            "Otieno B. · Withdrawal issue",
          ].map((x, i) => (
            <button className={i === 0 ? "active" : ""} key={x}>
              <span>
                <strong>{x}</strong>
                <small>{i * 8 + 2} min ago · Chat</small>
              </span>
              <i className="unread" />
            </button>
          ))}
        </section>
        <section className="card chat-view">
          <div className="chat-head">
            <Avatar src={photos.wanjiku} name="Wanjiku" />
            <div>
              <strong>Wanjiku Mwangi</strong>
              <span>Customer · 14 jobs · CSAT 4.8 (sample)</span>
            </div>
          </div>
          <div className="messages">
            {store.messages.map((text, index) => (
              <p
                className={index % 2 ? "outgoing" : "incoming"}
                key={`${index}-${text}`}
              >
                {text}
              </p>
            ))}
          </div>
          <label className="reply-box">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") send()
              }}
              placeholder="Write a reply…"
            />
            <Button onClick={send}>Send</Button>
          </label>
        </section>
        <aside className="card contact-card">
          <h2>Customer context</h2>
          <span>
            <small>Open jobs</small>
            <b>1</b>
          </span>
          <span>
            <small>Lifetime value</small>
            <b>KES 38,400 (sample)</b>
          </span>
          <span>
            <small>Previous tickets</small>
            <b>2</b>
          </span>
          <Button
            variant="secondary"
            onClick={() =>
              setDraft("Thanks for reaching out. I’m checking this for you.")
            }
          >
            Insert canned reply
          </Button>
        </aside>
      </div>
    </div>
  )
}

function Programmes() {
  const { store, updateStore } = useDemoStore()
  const [message, setMessage] = useState("")
  return (
    <div className="content console-content">
      <PageHeader
        eyebrow="Ajira Digital × OddJobs"
        title="Programmes & cohorts"
        description="Track learning, certification and work outcomes"
        action={
          <Button
            icon="plus"
            onClick={() =>
              setMessage(
                "A blank sample programme has been added to the local action log.",
              )
            }
          >
            Create programme
          </Button>
        }
      />
      <DemoNotice>
        Programme actions are local demo simulations; CSVs are not uploaded.
      </DemoNotice>
      {message && <DemoNotice>{message}</DemoNotice>}
      <div className="metrics">
        <Metric label="Active learners" value="1,284" delta="+86 this month" />
        <Metric label="Completion rate" value="78%" />
        <Metric label="Certified" value="892" />
        <Metric label="Placed in work" value="641" delta="72% of certified" />
      </div>
      <section className="card">
        <div className="section-title">
          <h2>Active cohorts</h2>
          <div className="card-actions">
            <label className="upload">
              <Icon name="plus" />
              <span>
                Choose CSV (demo)
                <input type="file" accept=".csv,text/csv" />
              </span>
            </label>
            <Button
              variant="secondary"
              onClick={() =>
                setMessage(
                  "Demo CSV invite recorded; file contents are not processed.",
                )
              }
            >
              Bulk CSV invite
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                updateStore({
                  adminActions: [
                    "Certificates issued in local partner demo",
                    ...store.adminActions,
                  ],
                })
                setMessage("Certificate issuance recorded in local demo state.")
              }}
            >
              Issue certificates
            </Button>
          </div>
        </div>
        <DataTable
          headers={["Programme", "Cohort", "Learners", "Progress", "Status"]}
          rows={[
            ["Nairobi Youth Services", "Cohort 4", "320", "82%", "Active"],
            ["Women in Skilled Trades", "June 2025", "180", "64%", "Active"],
            ["Coast Digital Services", "Cohort 2", "244", "100%", "Completed"],
          ]}
        />
      </section>
    </div>
  )
}

function Impact() {
  return (
    <div className="content console-content">
      <PageHeader
        title="Impact & placement"
        description="Outcomes from January – June 2025"
        action={<Button>Export funder report</Button>}
      />
      <div className="metrics">
        <Metric label="Course completions" value="1,046" delta="+24%" />
        <Metric label="Jobs completed" value="8,921" />
        <Metric label="Provider earnings" value="KES 31.4M" delta="+18%" />
        <Metric label="Women participants" value="62%" />
      </div>
      <div className="analytics-grid">
        <section className="card chart-card">
          <h2>Monthly earnings after certification</h2>
          <div className="bar-chart tall">
            {[28, 36, 48, 55, 68, 82].map((v, i) => (
              <i key={i} style={{ height: `${v}%` }} />
            ))}
          </div>
          <div className="chart-labels">
            <span>Jan</span>
            <span>Feb</span>
            <span>Mar</span>
            <span>Apr</span>
            <span>May</span>
            <span>Jun</span>
          </div>
        </section>
        <section className="card">
          <h2>Placement by category</h2>
          <div className="donut" />
          <div className="legend">
            <span>
              <i />
              Cleaning 38%
            </span>
            <span>
              <i />
              Care 24%
            </span>
            <span>
              <i />
              Repairs 21%
            </span>
            <span>
              <i />
              Other 17%
            </span>
          </div>
        </section>
      </div>
    </div>
  )
}

function Builder() {
  const [published, setPublished] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <div className="content console-content">
      <PageHeader
        title="Campaign page builder"
        description="Create a co-branded enrolment experience"
        action={
          <Button onClick={() => setPublished(true)}>
            Publish demo preview
          </Button>
        }
      />
      <DemoNotice>
        Publishing and links are preview-only; no public page is deployed.
      </DemoNotice>
      {published && (
        <DemoNotice>
          Campaign preview marked published in this session.
        </DemoNotice>
      )}
      <div className="builder-grid">
        <section className="form-card">
          <label>
            Campaign name
            <input defaultValue="Nairobi Youth Skills 2025" />
          </label>
          <label>
            Headline
            <input defaultValue="Build skills. Find work. Grow your future." />
          </label>
          <label>
            Partner logo
            <div className="upload">
              <Icon name="plus" />
              <span>
                Upload PNG or SVG
                <input type="file" accept="image/png,image/svg+xml" />
              </span>
            </div>
          </label>
          <label>
            Tracking link
            <div className="copy-field">
              <input readOnly value="oddjobs.com/p/ajira-2025" />
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard
                    ?.writeText("https://oddjobs.com/p/ajira-2025")
                    .then(() => setCopied(true))
                    .catch(() => setCopied(false))
                }}
              >
                Copy
              </Button>
            </div>
          </label>
          {copied && <DemoNotice>Link copied.</DemoNotice>}
        </section>
        <aside className="landing-preview">
          <div className="preview-nav">
            <strong>
              Ajira × <b>OddJobs</b>
            </strong>
            <span>EN · SW</span>
          </div>
          <Badge>Applications open</Badge>
          <h2>Build skills. Find work. Grow your future.</h2>
          <p>Free practical training and access to verified jobs in Nairobi.</p>
          <Button onClick={() => setPublished(true)}>
            Preview application flow
          </Button>
        </aside>
      </div>
    </div>
  )
}

export type PrototypeScreenKey = "knowledgeBase" | "disputes" | "inbox" | "programmes" | "impact" | "builder"

export default function PrototypeScreens({ screen }: { screen: PrototypeScreenKey }) {
  switch (screen) {
    case "knowledgeBase": return <KnowledgeBase />
    case "disputes": return <Disputes />
    case "inbox": return <Inbox />
    case "programmes": return <Programmes />
    case "impact": return <Impact />
    case "builder": return <Builder />
    default: return null
  }
}