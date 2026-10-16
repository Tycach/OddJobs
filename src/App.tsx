import { createContext, useContext, useEffect, useState } from "react"

type Role = "consumer" | "provider" | "admin" | "support" | "partner"
type Screen = "welcome" | "home" | "search" | "map" | "profile" | "post" | "jobs" | "bids" | "checkout" | "track" | "chat" | "review" | "dispute" | "history" | "saved" | "notifications" | "settings" | "providerHome" | "onboarding" | "providerVerification" | "feed" | "jobDetail" | "management" | "wallet" | "reputation" | "training" | "plans" | "analytics" | "ads" | "overview" | "users" | "verification" | "categories" | "moderation" | "adApprovals" | "audit" | "config" | "disputes" | "inbox" | "knowledgeBase" | "programmes" | "impact" | "builder"

type DemoBid = {
  provider: string
  price: number
  timing: string
  pitch: string
  trust: number
}
type DemoJob = {
  id: string
  title: string
  category: string
  description: string
  budget: number
  location: string
  timing: string
  status: "Open" | "Active" | "Completed"
  bids: DemoBid[]
}
type DemoStore = {
  jobs: DemoJob[]
  selectedJobId: string
  selectedBid: DemoBid
  savedProviders: string[]
  messages: string[]
  transactions: string[]
  notifications: string[]
  language: "EN" | "SW"
  reduceAds: boolean
  notificationPreferences: {
    jobs: boolean
    messages: boolean
    promotions: boolean
  }
  verificationStatus: "Not started" | "In review" | "Certified"
  completedLessons: string[]
  featureFlags: Record<string, boolean>
  adminActions: string[]
}

const demoStorageKey = "oddjobs-demo-v1"
const initialDemoStore: DemoStore = {
  selectedJobId: "OJ-2841",
  selectedBid: {
    provider: "Amina Hassan",
    price: 2300,
    timing: "Tomorrow · 3 hours",
    pitch: "I can bring eco-friendly supplies and arrive by 9am.",
    trust: 96,
  },
  jobs: [
    {
      id: "OJ-2841",
      title: "Deep clean my 2-bedroom flat",
      category: "Cleaning",
      description:
        "Kitchen, two bathrooms, floors and windows. Please bring cleaning supplies.",
      budget: 2500,
      location: "Kilimani, Nairobi",
      timing: "This week",
      status: "Open",
      bids: [
        {
          provider: "Amina Hassan",
          price: 2300,
          timing: "Tomorrow · 3 hours",
          pitch: "I can bring eco-friendly supplies and arrive by 9am.",
          trust: 96,
        },
        {
          provider: "Grace Wairimu",
          price: 2150,
          timing: "Friday · 4 hours",
          pitch: "I specialise in deep cleans and have all required equipment.",
          trust: 94,
        },
        {
          provider: "Mercy Atieno",
          price: 2500,
          timing: "Tomorrow · 3 hours",
          pitch: "Available tomorrow morning. Windows included in my quote.",
          trust: 92,
        },
      ],
    },
  ],
  savedProviders: [],
  messages: [
    "Hi, will the provider see my phone number before I accept a bid?",
    "No. Your contact details stay private until you hire a provider.",
  ],
  transactions: [],
  notifications: ["Amina Hassan sent a quote for your cleaning job."],
  language: "EN",
  reduceAds: false,
  notificationPreferences: { jobs: true, messages: true, promotions: false },
  verificationStatus: "Not started",
  completedLessons: [],
  featureFlags: {
    "Escrow v2": true,
    "Provider live location": true,
    "Saved search alerts": false,
  },
  adminActions: [],
}

const DemoContext = createContext<{
  store: DemoStore
  updateStore: (
    update: Partial<DemoStore> | ((current: DemoStore) => DemoStore),
  ) => void
} | null>(null)

function useDemoStore() {
  const context = useContext(DemoContext)
  if (!context) throw new Error("DemoStoreProvider is required.")
  return context
}

const photos = {
  amina:
    "https://images.unsplash.com/photo-1764166471609-c75e2c6bfdb2?auto=format&fit=crop&w=500&q=80",
  otieno:
    "https://images.unsplash.com/photo-1592896653886-98a644767f2f?auto=format&fit=crop&w=500&q=80",
  wanjiku:
    "https://images.unsplash.com/photo-1713746965378-0140784d2ab9?auto=format&fit=crop&w=500&q=80",
  work: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80",
}

const roleHomes: Record<Role, Screen> = {
  consumer: "home",
  provider: "providerHome",
  admin: "overview",
  support: "disputes",
  partner: "programmes",
}

const roleScreens: Record<Role, readonly Screen[]> = {
  consumer: [
    "home",
    "search",
    "map",
    "profile",
    "post",
    "jobs",
    "bids",
    "checkout",
    "track",
    "chat",
    "review",
    "dispute",
    "history",
    "saved",
    "notifications",
    "settings",
  ],
  provider: [
    "providerHome",
    "onboarding",
    "providerVerification",
    "feed",
    "jobDetail",
    "management",
    "wallet",
    "reputation",
    "training",
    "plans",
    "analytics",
    "ads",
  ],
  admin: [
    "overview",
    "users",
    "verification",
    "categories",
    "moderation",
    "adApprovals",
    "audit",
    "config",
  ],
  support: ["disputes", "inbox", "moderation", "knowledgeBase"],
  partner: ["programmes", "impact", "builder"],
}

type WorkspaceRoute = {
  role: Role
  screen: Screen
}

type IconProps = {
  name: string
  size?: number
}

type JobCardProps = {
  job: string[]
  onClick?: () => void
}

type DataTableProps = {
  headers: string[]
  rows: string[][]
}

function getWorkspaceRoute(pathname: string): WorkspaceRoute {
  const [, roleSegment, screenSegment] = pathname.split("/")
  const role = ([
    "consumer",
    "provider",
    "admin",
    "support",
    "partner",
  ] as const).find((candidate) => candidate === roleSegment)

  if (!role) return { role: "consumer", screen: "welcome" }

  const screen = roleScreens[role].find(
    (candidate) => candidate === screenSegment,
  )
  return { role, screen: screen ?? roleHomes[role] }
}

function workspacePath({ role, screen }: WorkspaceRoute) {
  return screen === "welcome" ? "/" : `/${role}/${screen}`
}

const navigation: Record<Role, {
  label: string
  icon: string
  screen: Screen
}[]> = {
  consumer: [
    { label: "Discover", icon: "home", screen: "home" },
    { label: "Search", icon: "search", screen: "search" },
    { label: "Post a job", icon: "plus", screen: "post" },
    { label: "My jobs", icon: "briefcase", screen: "jobs" },
    { label: "Messages", icon: "message", screen: "chat" },
    { label: "Help & disputes", icon: "shield", screen: "dispute" },
    { label: "Saved providers", icon: "star", screen: "saved" },
    { label: "Job history", icon: "chart", screen: "history" },
    { label: "Notifications", icon: "bell", screen: "notifications" },
    { label: "Settings", icon: "settings", screen: "settings" },
  ],
  provider: [
    { label: "Dashboard", icon: "grid", screen: "providerHome" },
    { label: "Set up profile", icon: "users", screen: "onboarding" },
    { label: "Verification", icon: "shield", screen: "providerVerification" },
    { label: "Job feed", icon: "search", screen: "feed" },
    { label: "My jobs", icon: "briefcase", screen: "management" },
    { label: "Wallet", icon: "wallet", screen: "wallet" },
    { label: "Reputation", icon: "star", screen: "reputation" },
    { label: "Training", icon: "book", screen: "training" },
    { label: "Plans", icon: "chart", screen: "plans" },
    { label: "Analytics", icon: "chart", screen: "analytics" },
    { label: "Promote", icon: "megaphone", screen: "ads" },
  ],
  admin: [
    { label: "Overview", icon: "grid", screen: "overview" },
    { label: "Users & roles", icon: "users", screen: "users" },
    { label: "Verification", icon: "shield", screen: "verification" },
    { label: "Categories & fees", icon: "settings", screen: "categories" },
    { label: "Moderation", icon: "flag", screen: "moderation" },
    { label: "Ad approvals", icon: "megaphone", screen: "adApprovals" },
    { label: "Audit log", icon: "chart", screen: "audit" },
    { label: "System config", icon: "settings", screen: "config" },
  ],
  support: [
    { label: "Disputes", icon: "shield", screen: "disputes" },
    { label: "Support inbox", icon: "message", screen: "inbox" },
    { label: "Reports & flags", icon: "flag", screen: "moderation" },
    { label: "Knowledge base", icon: "book", screen: "knowledgeBase" },
  ],
  partner: [
    { label: "Programmes", icon: "briefcase", screen: "programmes" },
    { label: "Impact reports", icon: "chart", screen: "impact" },
    { label: "Landing pages", icon: "layout", screen: "builder" },
  ],
}

function Icon({ name, size = 20 }: IconProps) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="m3 10 9-7 9 7" />
        <path d="M5 9v11h14V9" />
        <path d="M9 20v-6h6v6" />
      </>
    ),
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
    briefcase: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V4h8v3M3 12h18" />
      </>
    ),
    message: (
      <>
        <path d="M21 12a8 8 0 0 1-8 8H5l-3 2 1-5a9 9 0 1 1 18-5Z" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    wallet: (
      <>
        <path d="M3 6h16a2 2 0 0 1 2 2v11H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14" />
        <path d="M16 12h5" />
      </>
    ),
    star: (
      <path d="m12 2 3 6 7 .9-5 4.8 1.3 6.8L12 17.3l-6.3 3.2L7 13.7 2 8.9 9 8Z" />
    ),
    book: (
      <>
        <path d="M4 3h12a2 2 0 0 1 2 2v16H6a2 2 0 0 1-2-2Z" />
        <path d="M8 7h6M8 11h6" />
      </>
    ),
    megaphone: (
      <>
        <path d="m3 11 14-6v14L3 13Z" />
        <path d="m7 14 2 6h4l-2-7M20 9v6" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21v-2a7 7 0 0 1 14 0v2M16 4a4 4 0 0 1 0 8M18 15a6 6 0 0 1 4 6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 2 4 5v6c0 5 3 9 8 11 5-2 8-6 8-11V5Z" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
    flag: (
      <>
        <path d="M5 22V3M5 4h13l-2 4 2 4H5" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </>
    ),
    chart: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    layout: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 9v12" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    location: (
      <>
        <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    arrow: <path d="m5 12 14 0m-5-5 5 5-5 5" />,
    check: <path d="m5 12 4 4L19 6" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.grid}
    </svg>
  )
}

function Button({
  children,
  variant = "primary",
  onClick,
  icon,
  disabled = false,
}: {
  children: React.ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  onClick?: () => void
  icon?: string
  disabled?: boolean
}) {
  return (
    <button
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
    </button>
  )
}

function Badge({
  children,
  tone = "green",
}: {
  children: React.ReactNode
  tone?: "green" | "amber" | "slate" | "red"
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

function Avatar({
  src,
  name,
  large = false,
}: {
  src: string
  name: string
  large?: boolean
}) {
  return (
    <img
      className={`avatar ${large ? "avatar-large" : ""}`}
      src={src}
      alt={`${name}, service provider`}
    />
  )
}

function ProviderCard({
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
        <div className="provider-title">
          <strong>{name}</strong>
          <span className="rating">★ 4.9</span>
        </div>
        <span>{service} · 1.8 km</span>
        <Badge>
          <Icon name="shield" size={13} /> OddJobs Certified
        </Badge>
        <div className="provider-price">
          From <strong>{price}</strong>
        </div>
      </div>
      <Icon name="chevron" size={18} />
    </button>
  )
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  )
}

function Metric({
  label,
  value,
  delta,
}: {
  label: string
  value: string
  delta?: string
}) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {delta && <small>{delta}</small>}
    </div>
  )
}

function Sponsored() {
  return (
    <div className="sponsored">
      <Badge tone="amber">Sponsored</Badge>
      <div>
        <strong>20% off quality cleaning supplies</strong>
        <span>Jumia Home · Nairobi</span>
      </div>
      <Icon name="arrow" size={18} />
    </div>
  )
}

function Welcome({ enter }: { enter: (role: Role) => void }) {
  const { store, updateStore } = useDemoStore()
  const [stage, setStage] = useState<"phone" | "otp" | "role">("phone")
  const [authMode, setAuthMode] = useState<"phone" | "email">("phone")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [otp, setOtp] = useState("")
  const [authError, setAuthError] = useState("")
  const [adIndex, setAdIndex] = useState(0)
  const ads = [
    ["Safaricom Home Fibre", "Stay connected from KES 2,999"],
    ["Jumia Home", "20% off cleaning supplies"],
    ["M-KOPA Solar", "Flexible pay-as-you-go energy"],
  ]
  useEffect(() => {
    const timer = window.setInterval(
      () => setAdIndex((index) => (index + 1) % ads.length),
      5000,
    )
    return () => window.clearInterval(timer)
  }, [])
  return (
    <div className="auth-shell">
      <header className="auth-nav">
        <div className="brand">
          <span>O</span>
          <strong>
            OddJobs<em>.com</em>
          </strong>
        </div>
        <button
          className="lang"
          onClick={() =>
            updateStore({ language: store.language === "EN" ? "SW" : "EN" })
          }
        >
          {store.language}{" "}
          <span>/ {store.language === "EN" ? "SW" : "EN"}</span>
        </button>
      </header>
      <main className="auth-main">
        <section className="auth-story">
          <Badge>Trusted across Nairobi</Badge>
          <h1>
            Good work.
            <br />
            Good people.
            <br />
            <em>Done safely.</em>
          </h1>
          <p>
            Hire vetted local professionals, pay securely with M-Pesa, and
            release payment only when the job is done.
          </p>
          <div className="auth-trust">
            <span>
              <Icon name="shield" />
              <b>Verified providers</b>
            </span>
            <span>
              <Icon name="wallet" />
              <b>M-Pesa escrow</b>
            </span>
            <span>
              <Icon name="star" />
              <b>Real reviews</b>
            </span>
          </div>
          <div className="auth-image">
            <img
              src={photos.amina}
              alt="A trusted OddJobs service professional"
            />
            <div>
              <span className="rating">★★★★★</span>
              <strong>“Reliable help, right when I needed it.”</strong>
              <small>Wanjiku · Kilimani</small>
            </div>
          </div>
        </section>
        <section className="auth-card">
          {stage === "phone" && (
            <>
              <div>
                <div className="eyebrow">Welcome to OddJobs</div>
                <h2>Let’s get you started</h2>
                <p>Enter your phone number to sign in or create an account.</p>
              </div>
              {authMode === "phone" ? (
                <label>
                  Phone number
                  <div className="phone-input">
                    <span>+254</span>
                    <input
                      value={phone}
                      onChange={(event) =>
                        setPhone(
                          event.target.value.replace(/\D/g, "").slice(0, 9),
                        )
                      }
                      placeholder="712 345 678"
                      autoFocus
                    />
                  </div>
                </label>
              ) : (
                <label>
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>
              )}
              <DemoNotice>
                Prototype sign-in only. Demo OTP: 1234. No SMS, email, or
                account is created.
              </DemoNotice>
              <Button
                onClick={() => {
                  if (authMode === "phone" && phone.length < 9) {
                    setAuthError("Enter a valid 9-digit Kenyan phone number.")
                    return
                  }
                  if (
                    authMode === "email" &&
                    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                  ) {
                    setAuthError("Enter a valid email address.")
                    return
                  }
                  setAuthError("")
                  setStage("otp")
                }}
              >
                Continue with {authMode}
              </Button>
              <div className="or">
                <span>or</span>
              </div>
              <Button
                variant="secondary"
                onClick={() => {
                  setAuthMode(authMode === "phone" ? "email" : "phone")
                  setAuthError("")
                }}
              >
                Use {authMode === "phone" ? "email" : "phone"} instead
              </Button>
              {authError && (
                <p className="form-error" role="alert">
                  {authError}
                </p>
              )}
              <small className="terms">
                By continuing, you agree to our Terms and Privacy Policy.
              </small>
            </>
          )}
          {stage === "otp" && (
            <>
              <button className="back-link" onClick={() => setStage("phone")}>
                ← Back
              </button>
              <div>
                <div className="eyebrow">Demo sign in</div>
                <h2>Enter the demo code</h2>
                <p>
                  Code 1234 · destination{" "}
                  {authMode === "phone" ? `+254 ${phone}` : email}.
                </p>
              </div>
              <label>
                Verification code
                <input
                  inputMode="numeric"
                  value={otp}
                  maxLength={4}
                  onChange={(event) =>
                    setOtp(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="4-digit code"
                />
              </label>
              <Button
                onClick={() => {
                  if (otp !== "1234") {
                    setAuthError("That demo code is incorrect. Use 1234.")
                    return
                  }
                  setAuthError("")
                  setStage("role")
                }}
              >
                Verify demo code
              </Button>
              {authError && (
                <p className="form-error" role="alert">
                  {authError}
                </p>
              )}
              <button
                className="text-link"
                onClick={() => {
                  setOtp("")
                  setAuthError("Demo code reset. Use 1234.")
                }}
              >
                Resend demo code
              </button>
            </>
          )}
          {stage === "role" && (
            <>
              <div>
                <div className="eyebrow">One last thing</div>
                <h2>How will you use OddJobs?</h2>
                <p>You can switch modes any time from your account.</p>
              </div>
              <button className="role-choice" onClick={() => enter("consumer")}>
                <span>
                  <Icon name="search" />
                </span>
                <div>
                  <strong>Hire someone</strong>
                  <small>Find trusted help for home and work</small>
                </div>
                <Icon name="chevron" />
              </button>
              <button className="role-choice" onClick={() => enter("provider")}>
                <span>
                  <Icon name="briefcase" />
                </span>
                <div>
                  <strong>Offer services</strong>
                  <small>Find jobs and grow your income</small>
                </div>
                <Icon name="chevron" />
              </button>
            </>
          )}
          {!store.reduceAds && (
            <div className="auth-ad" aria-live="polite">
              <Badge tone="amber">Sponsored</Badge>
              <span>
                <b>{ads[adIndex][0]}</b>
                <small>{ads[adIndex][1]}</small>
              </span>
              <span className="ad-dots">
                {ads.map((_, index) => (
                  <i
                    key={index}
                    className={index === adIndex ? "active" : ""}
                  />
                ))}
              </span>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function Home({ go }: { go: (s: Screen) => void }) {
  const { store } = useDemoStore()
  const categories = [
    ["Cleaning", "⌁"],
    ["Plumbing", "◉"],
    ["Electrical", "ϟ"],
    ["Care", "♡"],
    ["Grooming", "✦"],
    ["Tutoring", "A+"],
    ["Moving", "□"],
    ["More", "•••"],
  ]
  return (
    <div className="content consumer-content">
      <section className="welcome-row">
        <div>
          <span>Good morning, Wanjiku</span>
          <h1>What do you need help with?</h1>
        </div>
        <Avatar src={photos.wanjiku} name="Wanjiku" />
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
          <span className="live-label">
            <i /> Live
          </span>
        </div>
        <div className="providers-row">
          <ProviderCard
            name="Amina Hassan"
            service="Home cleaning"
            image={photos.amina}
            price="KES 800"
            onClick={() => go("profile")}
          />
          <ProviderCard
            name="Brian Otieno"
            service="Plumbing & repairs"
            image={photos.otieno}
            price="KES 1,200"
            onClick={() => go("profile")}
          />
        </div>
      </section>
      <section className="trust-panel">
        <Icon name="shield" size={28} />
        <div>
          <strong>Hire with confidence</strong>
          <span>
            Vetted providers. M-Pesa escrow. Support when you need it.
          </span>
        </div>
      </section>
    </div>
  )
}

function SearchResults({ go }: { go: (s: Screen) => void }) {
  const { store } = useDemoStore()
  const [query, setQuery] = useState("Home cleaning")
  const [activeFilters, setActiveFilters] = useState<string[]>([
    "Available now",
  ])
  const [sortBy, setSortBy] = useState<"distance" | "price">("distance")
  const queryTokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean)
  const providers = [
    {
      name: "Amina Hassan",
      service: "Home & office cleaning",
      image: photos.amina,
      price: "KES 800",
      distance: 1.8,
    },
    {
      name: "Grace Wairimu",
      service: "Deep cleaning specialist",
      image: photos.wanjiku,
      price: "KES 1,000",
      distance: 2.4,
    },
    {
      name: "Mercy Atieno",
      service: "Laundry & home cleaning",
      image: photos.work,
      price: "KES 700",
      distance: 3.1,
    },
    {
      name: "Brian Otieno",
      service: "Plumbing & repairs",
      image: photos.otieno,
      price: "KES 1,200",
      distance: 1.8,
    },
  ]
  const filteredProviders = providers.filter((provider) => {
    const matchesQuery = queryTokens.every((token) =>
      `${provider.name} ${provider.service}`.toLowerCase().includes(token),
    )
    const matchesAvailable =
      !activeFilters.includes("Available now") ||
      provider.name !== "Mercy Atieno"
    const matchesVerified =
      !activeFilters.includes("Verified only") ||
      provider.name !== "Mercy Atieno"
    const matchesRating =
      !activeFilters.includes("4.5+ rating") || provider.name !== "Mercy Atieno"
    return matchesQuery && matchesAvailable && matchesVerified && matchesRating
  })
  const shownProviders = filteredProviders.sort((left, right) =>
    sortBy === "price"
      ? Number(left.price.replace(/\D/g, "")) -
        Number(right.price.replace(/\D/g, ""))
      : left.distance - right.distance,
  )
  const toggleFilter = (filter: string) => {
    if (filter === "Distance" || filter === "Price") {
      setSortBy(filter === "Price" ? "price" : "distance")
      return
    }
    setActiveFilters((current) =>
      current.includes(filter)
        ? current.filter((item) => item !== filter)
        : [...current, filter],
    )
  }
  return (
    <div className="content">
      <PageHeader
        eyebrow="Nairobi · 12 nearby"
        title="Cleaning professionals"
        description="Vetted help, available when you need it."
      />
      <div className="search-box active">
        <Icon name="search" />
        <input
          aria-label="Search services"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button aria-label="Clear search" onClick={() => setQuery("")}>
          <Icon name="close" size={17} />
        </button>
      </div>
      {query && (
        <div className="suggestions">
          <button onClick={() => setQuery("Home cleaning")}>
            Home cleaning in Kilimani
          </button>
          <button onClick={() => setQuery("Plumbing")}>
            Plumbing near Nairobi
          </button>
        </div>
      )}
      <div className="filters">
        {[
          "Available now",
          "Distance",
          "Price",
          "4.5+ rating",
          "Verified only",
        ].map((filter) => (
          <button
            key={filter}
            className={
              filter === "Distance" || filter === "Price"
                ? sortBy === filter.toLowerCase()
                  ? "active"
                  : ""
                : activeFilters.includes(filter)
                  ? "active"
                  : ""
            }
            aria-pressed={
              filter === "Distance" || filter === "Price"
                ? sortBy === filter.toLowerCase()
                : activeFilters.includes(filter)
            }
            onClick={() => toggleFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </div>
      <div className="results-toolbar">
        <span>
          <strong>{shownProviders.length} providers</strong>
        </span>
        <div className="view-toggle">
          <button className="active" aria-pressed="true">
            List
          </button>
          <button onClick={() => go("map")}>Map</button>
        </div>
      </div>
      {shownProviders.length ? (
        <div className="result-list">
          {shownProviders.map((provider) => (
            <div className="provider-result" key={provider.name}>
              <ProviderCard {...provider} onClick={() => go("profile")} />
              <span className="caption">
                {provider.distance} km away{" "}
                {store.savedProviders.includes(provider.name) ? "· Saved" : ""}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No providers match these filters"
          detail="Try a broader search or remove a filter."
          action={() => {
            setQuery("")
            setActiveFilters([])
          }}
          actionLabel="Clear filters"
        />
      )}
    </div>
  )
}

function Profile({ go }: { go: (s: Screen) => void }) {
  const { store, updateStore } = useDemoStore()
  const [notice, setNotice] = useState("")
  const saved = store.savedProviders.includes("Amina Hassan")
  return (
    <div className="content profile-page">
      <div className="profile-hero">
        <img src={photos.amina} alt="Amina Hassan" />
        <div className="profile-intro">
          <Badge>
            <Icon name="shield" size={13} /> OddJobs Certified
          </Badge>
          <h1>Amina Hassan</h1>
          <p>Home cleaning specialist · Kilimani</p>
          <div className="profile-stats">
            <span>
              <b>4.9</b> 128 reviews
            </span>
            <span>
              <b>96%</b> trust score
            </span>
            <span>
              <b>214</b> jobs
            </span>
          </div>
        </div>
      </div>
      <div className="profile-grid">
        <main>
          <section className="card">
            <div className="section-title">
              <h2>Services & rates</h2>
            </div>
            <div className="service-line">
              <span>
                Standard home cleaning
                <small>2–3 hours · supplies included</small>
              </span>
              <strong>KES 1,200</strong>
            </div>
            <div className="service-line">
              <span>
                Deep cleaning<small>4–6 hours · supplies included</small>
              </span>
              <strong>KES 2,800</strong>
            </div>
          </section>
          <section className="card">
            <h2>Why customers choose Amina</h2>
            <div className="proof-grid">
              <span>
                <Icon name="check" /> Responds in 8 min
              </span>
              <span>
                <Icon name="check" /> Verified ID
              </span>
              <span>
                <Icon name="check" /> 98% on time
              </span>
              <span>
                <Icon name="check" /> Repeat favourite
              </span>
            </div>
          </section>
          <section className="card">
            <div className="section-title">
              <h2>Recent work</h2>
              <span>Before / after portfolio</span>
            </div>
            <div className="gallery">
              <img src={photos.work} alt="Kitchen before cleaning" />
              <img
                src="https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=600&q=80"
                alt="Kitchen after cleaning"
              />
            </div>
          </section>
          <section className="card review-card">
            <div className="review-head">
              <Avatar src={photos.wanjiku} name="Wanjiku" />
              <div>
                <strong>Wanjiku M.</strong>
                <span className="rating">★★★★★</span>
              </div>
              <small>2 weeks ago</small>
            </div>
            <p>
              “Amina arrived on time and left our flat spotless. Very clear
              communication throughout.”
            </p>
          </section>
        </main>
        <aside className="booking-card">
          <span>Standard cleaning from</span>
          <strong>KES 1,200</strong>
          <p>No payment until you choose a quote.</p>
          <Button onClick={() => go("post")}>Request a quote</Button>
          <Button variant="secondary" icon="message" onClick={() => go("chat")}>
            Message Amina
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              updateStore({
                savedProviders: saved
                  ? store.savedProviders.filter(
                      (name) => name !== "Amina Hassan",
                    )
                  : [...store.savedProviders, "Amina Hassan"],
              })
              setNotice(
                saved
                  ? "Amina removed from saved providers."
                  : "Amina added to saved providers.",
              )
            }}
          >
            {saved ? "Remove favourite" : "Save provider"}
          </Button>
          {notice && <small role="status">{notice}</small>}
        </aside>
      </div>
    </div>
  )
}

function PostJob({ go }: { go: (s: Screen) => void }) {
  const { store, updateStore } = useDemoStore()
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState("Deep clean my 2-bedroom flat")
  const [category, setCategory] = useState("Cleaning")
  const [description, setDescription] = useState(
    "Kitchen, two bathrooms, floors and windows. Please bring cleaning supplies.",
  )
  const [budget, setBudget] = useState("2500")
  const [location, setLocation] = useState("Kilimani, Nairobi")
  const [timing, setTiming] = useState("This week")
  const [error, setError] = useState("")
  const postJob = () => {
    if (
      !title.trim() ||
      !description.trim() ||
      !Number.isFinite(Number(budget)) ||
      Number(budget) <= 0 ||
      !location.trim()
    ) {
      setError(
        "Add a title, description, valid budget, and location before posting.",
      )
      return
    }
    const id = `OJ-${Date.now().toString().slice(-6)}`
    const job: DemoJob = {
      id,
      title: title.trim(),
      category,
      description: description.trim(),
      budget: Number(budget),
      location: location.trim(),
      timing,
      status: "Open",
      bids: initialDemoStore.jobs[0].bids,
    }
    updateStore((current) => ({
      ...current,
      jobs: [job, ...current.jobs],
      selectedJobId: id,
      selectedBid: job.bids[0],
      notifications: [
        `Your job "${job.title}" is posted.`,
        ...current.notifications,
      ],
    }))
    setError("")
    go("bids")
  }
  return (
    <div className="content form-page">
      <PageHeader
        eyebrow={`Step ${step} of 3`}
        title={
          step === 1
            ? "Tell us what you need"
            : step === 2
              ? "Where and when?"
              : "Review your job"
        }
        description="Clear details help you get accurate quotes."
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
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label>
              Category
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {[
                  "Cleaning",
                  "Plumbing",
                  "Electrical",
                  "Care",
                  "Grooming",
                  "Tutoring",
                  "Moving",
                  "Repairs",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label>
              What needs to be done?
              <textarea
                rows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <label className="upload">
              <Icon name="plus" />
              <span>
                <strong>Add photos or video</strong>
                <small>
                  Media attachments are not stored in this local demo.
                </small>
              </span>
              <input type="file" accept="image/*,video/*" multiple />
            </label>
          </>
        )}
        {step === 2 && (
          <>
            <label>
              Budget (KES)
              <input
                inputMode="numeric"
                value={budget}
                onChange={(event) => setBudget(event.target.value)}
              />
            </label>
            <label>
              Location
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </label>
            <div className="field-pair">
              <label>
                Preferred date
                <input type="date" />
              </label>
              <label>
                Time window
                <select onChange={(event) => setTiming(event.target.value)}>
                  <option>9:00 – 12:00</option>
                  <option>12:00 – 15:00</option>
                  <option>Flexible</option>
                </select>
              </label>
            </div>
            <label>
              Urgency
              <div className="choice-row">
                {["This week", "Today", "Flexible"].map((item) => (
                  <button
                    type="button"
                    className={timing === item ? "selected" : ""}
                    key={item}
                    onClick={() => setTiming(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </label>
            <label>
              Who can bid?
              <select>
                <option>Open to all vetted providers</option>
                <option>Invite a provider</option>
              </select>
            </label>
          </>
        )}
        {step === 3 && (
          <div className="job-review">
            <Badge>Open to vetted providers</Badge>
            <h2>{title}</h2>
            <p>{description}</p>
            <div className="review-facts">
              <span>
                <small>Budget</small>
                <b>KES {Number(budget || 0).toLocaleString()}</b>
              </span>
              <span>
                <small>Location</small>
                <b>{location}</b>
              </span>
              <span>
                <small>Timing</small>
                <b>{timing}</b>
              </span>
            </div>
            <div className="safe-note">
              <Icon name="shield" />
              <span>
                Only verified providers can bid. You choose who to hire.
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
            onClick={() =>
              step < 3 ? (setError(""), setStep(step + 1)) : postJob()
            }
          >
            {step < 3 ? "Continue" : "Post job"}
          </Button>
        </div>
      </div>
    </div>
  )
}

function Bids({ go }: { go: (s: Screen) => void }) {
  const { store, updateStore } = useDemoStore()
  const job =
    store.jobs.find((item) => item.id === store.selectedJobId) ?? store.jobs[0]
  const selected = store.selectedBid
  return (
    <div className="content">
      <PageHeader
        eyebrow={`${job.bids.length} bids · Job #${job.id}`}
        title="Choose the right provider"
        description={job.title}
      />
      <div className="bid-layout">
        <div className="bid-list">
          {job.bids.map((bid) => (
            <button
              className={`bid-card ${
                selected.provider === bid.provider ? "selected" : ""
              }`}
              onClick={() => updateStore({ selectedBid: bid })}
              key={bid.provider}
            >
              <div className="bid-person">
                <Avatar
                  src={
                    bid.provider === "Amina Hassan"
                      ? photos.amina
                      : bid.provider === "Grace Wairimu"
                        ? photos.wanjiku
                        : photos.work
                  }
                  name={bid.provider}
                />
                <div>
                  <strong>{bid.provider}</strong>
                  <span className="rating">★ 4.9 · {bid.trust}% trust</span>
                </div>
                <Badge>Verified</Badge>
              </div>
              <p>{bid.pitch}</p>
              <div className="bid-bottom">
                <span>
                  <small>Quote</small>
                  <b>KES {bid.price.toLocaleString()}</b>
                </span>
                <span>
                  <small>Timing</small>
                  <b>{bid.timing}</b>
                </span>
                <span className="select-circle">
                  <Icon name="check" size={16} />
                </span>
              </div>
            </button>
          ))}
        </div>
        <aside className="summary-card">
          <h2>Your selection</h2>
          <div className="selected-person">
            <Avatar
              src={
                selected.provider === "Amina Hassan"
                  ? photos.amina
                  : selected.provider === "Grace Wairimu"
                    ? photos.wanjiku
                    : photos.work
              }
              name={selected.provider}
            />
            <span>
              <strong>{selected.provider}</strong>
              <small>OddJobs Certified · {selected.trust}% trust</small>
            </span>
          </div>
          <div className="summary-line">
            <span>Provider quote</span>
            <strong>KES {selected.price.toLocaleString()}</strong>
          </div>
          <p>Review the fee breakdown before paying safely with M-Pesa.</p>
          <Button onClick={() => go("checkout")}>Hire & pay safely</Button>
        </aside>
      </div>
    </div>
  )
}

function Checkout({ go }: { go: (s: Screen) => void }) {
  const { store, updateStore } = useDemoStore()
  const [paid, setPaid] = useState(false)
  const job =
    store.jobs.find((item) => item.id === store.selectedJobId) ?? store.jobs[0]
  const bid = store.selectedBid
  const fee = Math.round(bid.price * 0.1)
  const confirmDemoPayment = () => {
    setPaid(true)
    updateStore((current) => ({
      ...current,
      jobs: current.jobs.map((item) =>
        item.id === current.selectedJobId
          ? { ...item, status: "Active" }
          : item,
      ),
      transactions: [
        `Demo escrow · ${job.id} · KES ${(bid.price + fee).toLocaleString()}`,
        ...current.transactions,
      ],
      notifications: [
        `Demo payment secured for ${job.title}.`,
        ...current.notifications,
      ],
    }))
  }
  return (
    <div className="content narrow">
      <PageHeader
        eyebrow="Demo checkout"
        title={paid ? "Demo payment confirmed" : "Pay with M-Pesa"}
        description={
          paid
            ? `${bid.provider} has been booked for ${bid.timing.toLowerCase()}.`
            : "No real M-Pesa prompt is sent in this prototype."
        }
      />
      <div className="checkout-card">
        {paid ? (
          <div className="payment-success">
            <span>
              <Icon name="check" size={32} />
            </span>
            <h2>KES {(bid.price + fee).toLocaleString()} demo escrow</h2>
            <p>Demo receipt for job #{job.id} · no money moved.</p>
          </div>
        ) : (
          <>
            <div className="booking-provider">
              <Avatar
                src={
                  bid.provider === "Amina Hassan"
                    ? photos.amina
                    : bid.provider === "Grace Wairimu"
                      ? photos.wanjiku
                      : photos.work
                }
                name={bid.provider}
              />
              <div>
                <strong>{job.title}</strong>
                <span>
                  {bid.provider} · {bid.timing}
                </span>
              </div>
            </div>
            <div className="fee-lines">
              <span>
                <label>Provider quote</label>
                <b>KES {bid.price.toLocaleString()}</b>
              </span>
              <span>
                <label>OddJobs protection fee (10%)</label>
                <b>KES {fee.toLocaleString()}</b>
              </span>
              <span className="total">
                <label>Total</label>
                <b>KES {(bid.price + fee).toLocaleString()}</b>
              </span>
            </div>
            <label>
              M-Pesa phone number
              <div className="phone-input">
                <span>+254</span>
                <input defaultValue="712 345 831" />
              </div>
            </label>
            <div className="safe-note">
              <Icon name="shield" />
              <span>
                <strong>Your money is held safely</strong> until you confirm the
                job is done. Demo only—no real payment is processed.
              </span>
            </div>
          </>
        )}
        <Button onClick={() => (paid ? go("track") : confirmDemoPayment())}>
          {paid ? "Track your job" : "Simulate M-Pesa payment"}
        </Button>
        {!paid && (
          <small className="center-note">
            Demo only: no STK push will be sent.
          </small>
        )}
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
        eyebrow={`Job #${job.id}`}
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
                  item.id === job.id ? { ...item, status: "Completed" } : item,
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
  const { store, updateStore } = useDemoStore()
  const [complete, setComplete] = useState(false)
  const job =
    store.jobs.find((item) => item.id === store.selectedJobId) ?? store.jobs[0]
  const bid = store.selectedBid
  const [rating, setRating] = useState(5)
  const [tip, setTip] = useState(200)
  const [review, setReview] = useState("")
  const finishDemoJob = () => {
    setComplete(true)
    updateStore((current) => ({
      ...current,
      jobs: current.jobs.map((item) =>
        item.id === current.selectedJobId
          ? { ...item, status: "Completed" }
          : item,
      ),
      transactions: [
        `Demo release · ${job.id} · KES ${bid.price.toLocaleString()}`,
        ...current.transactions,
      ],
      notifications: [
        `Your review for ${bid.provider} was saved locally.`,
        ...current.notifications,
      ],
    }))
  }
  return (
    <div className="content narrow">
      <PageHeader
        eyebrow="Final step"
        title={
          complete
            ? "Thank you, Wanjiku"
            : `How did ${bid.provider.split(" ")[0]} do?`
        }
        description={
          complete
            ? "Your review helps build a trusted community."
            : "Confirm completion to simulate releasing the demo escrow."
        }
      />
      <div className="checkout-card">
        {complete ? (
          <div className="payment-success">
            <span>
              <Icon name="check" size={32} />
            </span>
            <h2>Demo payment released</h2>
            <p>
              KES {bid.price.toLocaleString()} marked as released to{" "}
              {bid.provider}. Tip: KES {tip}. No money moved.
            </p>
            <p>
              {rating} stars · {review || "No written review"}
            </p>
          </div>
        ) : (
          <>
            <div className="review-provider">
              <Avatar
                src={
                  bid.provider === "Amina Hassan"
                    ? photos.amina
                    : bid.provider === "Grace Wairimu"
                      ? photos.wanjiku
                      : photos.work
                }
                name={bid.provider}
                large
              />
              <strong>{bid.provider}</strong>
              <span>{job.title}</span>
            </div>
            <div className="stars" aria-label={`${rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  aria-pressed={rating === value}
                  onClick={() => setRating(value)}
                >
                  {value <= rating ? "★" : "☆"}
                </button>
              ))}
            </div>
            <label>
              Share a few words
              <textarea
                rows={4}
                value={review}
                onChange={(event) => setReview(event.target.value)}
                placeholder="What went well?"
              />
            </label>
            <label>
              Add a tip
              <div className="choice-row">
                {[0, 100, 200, 500].map((value) => (
                  <button
                    key={value}
                    className={tip === value ? "selected" : ""}
                    onClick={() => setTip(value)}
                  >
                    {value ? `KES ${value}` : "No tip"}
                  </button>
                ))}
              </div>
            </label>
            <label className="upload">
              <Icon name="plus" />
              <span>Add review photos (local demo preview)</span>
              <input type="file" accept="image/*" multiple />
            </label>
          </>
        )}
        <Button onClick={() => (complete ? go("home") : finishDemoJob())}>
          {complete ? "Back to home" : "Confirm completion & simulate release"}
        </Button>
        {!complete && (
          <Button variant="ghost" onClick={() => go("disputes")}>
            Report a problem / dispute
          </Button>
        )}
      </div>
    </div>
  )
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
  const { store, updateStore } = useDemoStore()
  const [tab, setTab] = useState<DemoJob["status"]>("Open")
  const jobsForTab = store.jobs.filter((job) => job.status === tab)
  return (
    <div className="content">
      <PageHeader
        title="My jobs"
        description="Keep track of quotes, bookings, and finished work."
        action={<Button onClick={() => go("post")}>Post a job</Button>}
      />
      <div className="filters">
        {(["Open", "Active", "Completed"] as const).map((status) => (
          <button
            className={tab === status ? "active" : ""}
            key={status}
            onClick={() => setTab(status)}
          >
            {status} ·{" "}
            {store.jobs.filter((job) => job.status === status).length}
          </button>
        ))}
      </div>
      <div className="job-list">
        {jobsForTab.map((job) => (
          <section className="card job-summary" key={job.id}>
            <Badge>{job.status}</Badge>
            <h2>{job.title}</h2>
            <p>
              {job.category} · {job.location} · KES{" "}
              {job.budget.toLocaleString()}
            </p>
            <div className="card-actions">
              <Button
                onClick={() => {
                  updateStore({
                    selectedJobId: job.id,
                    selectedBid: job.bids[0] ?? store.selectedBid,
                  })
                  if (job.status === "Open") go("bids")
                  else if (job.status === "Active") go("track")
                  else go("history")
                }}
              >
                {job.status === "Open"
                  ? `${job.bids.length} bids · Compare`
                  : job.status === "Active"
                    ? "Track job"
                    : "View history"}
              </Button>
              {job.status === "Open" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    updateStore({ selectedJobId: job.id })
                    go("post")
                  }}
                >
                  Edit as new job
                </Button>
              )}
            </div>
          </section>
        ))}
        {!jobsForTab.length && (
          <EmptyState
            title={`No ${tab.toLowerCase()} jobs yet`}
            detail="Jobs you post and complete will appear here."
            action={() => go("post")}
            actionLabel="Post your first job"
          />
        )}
      </div>
    </div>
  )
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
                selected === name ? "selected" : ""
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
            <small>Available now · ★ 4.9 · from KES 800</small>
          </span>
        </div>
        <Button onClick={() => go("profile")}>View provider</Button>
      </div>
    </div>
  )
}

function Chat() {
  const { store, updateStore } = useDemoStore()
  const [draft, setDraft] = useState("")
  const send = () => {
    if (!draft.trim()) return
    updateStore({ messages: [...store.messages, draft.trim()] })
    setDraft("")
  }
  return (
    <div className="content narrow">
      <PageHeader
        title="Job messages"
        description={`Conversation for job #${store.selectedJobId}`}
      />
      <DemoNotice>
        Messages are saved in this browser. No message is sent to another
        person.
      </DemoNotice>
      <section className="card chat-view chat-screen">
        <div className="chat-head">
          <Avatar
            src={
              store.selectedBid.provider === "Amina Hassan"
                ? photos.amina
                : store.selectedBid.provider === "Grace Wairimu"
                  ? photos.wanjiku
                  : photos.work
            }
            name={store.selectedBid.provider}
          />
          <div>
            <strong>{store.selectedBid.provider}</strong>
            <span>Provider · Job #{store.selectedJobId}</span>
          </div>
        </div>
        <div className="messages">
          {store.messages.map((message, index) => (
            <p
              className={index % 2 ? "outgoing" : "incoming"}
              key={`${index}-${message}`}
            >
              {message}
              <small>{index % 2 ? " · Read" : " · 9:41 AM"}</small>
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
            aria-label="Message text"
            placeholder="Write a message…"
          />
          <Button onClick={send}>Send</Button>
        </label>
        <label className="upload">
          <Icon name="plus" />
          <span>Attach photos in this demo (not uploaded)</span>
          <input type="file" accept="image/*,video/*" multiple />
        </label>
      </section>
    </div>
  )
}

function History() {
  const { store } = useDemoStore()
  const completed = store.jobs.filter((job) => job.status === "Completed")
  return (
    <div className="content">
      <PageHeader
        title="Job history"
        description="Completed jobs, demo receipts, and rebooking."
      />
      <section className="card">
        <h2>Demo receipts</h2>
        {store.transactions.map((item, index) => (
          <p className="history-row" key={`${index}-${item}`}>
            {item}
          </p>
        ))}
        {!store.transactions.length && (
          <p className="caption">
            No transactions yet. Completed demo activity appears here.
          </p>
        )}
      </section>
      <div className="job-list">
        {completed.map((job) => (
          <section className="card job-summary" key={job.id}>
            <Badge>Completed</Badge>
            <h2>{job.title}</h2>
            <p>{job.location}</p>
          </section>
        ))}
      </div>
    </div>
  )
}

function SavedProviders({ go }: { go: (screen: Screen) => void }) {
  const { store, updateStore } = useDemoStore()
  const providers = [
    {
      name: "Amina Hassan",
      service: "Home cleaning",
      image: photos.amina,
      price: "KES 800",
    },
    {
      name: "Grace Wairimu",
      service: "Deep cleaning",
      image: photos.wanjiku,
      price: "KES 1,000",
    },
    {
      name: "Brian Otieno",
      service: "Plumbing & repairs",
      image: photos.otieno,
      price: "KES 1,200",
    },
  ].filter((item) => store.savedProviders.includes(item.name))
  return (
    <div className="content">
      <PageHeader
        title="Saved providers"
        description="Your trusted shortlist for later."
      />
      <div className="result-list">
        {providers.map((provider) => (
          <div key={provider.name}>
            <ProviderCard {...provider} onClick={() => go("profile")} />
            <Button
              variant="ghost"
              onClick={() =>
                updateStore({
                  savedProviders: store.savedProviders.filter(
                    (name) => name !== provider.name,
                  ),
                })
              }
            >
              Remove from saved
            </Button>
          </div>
        ))}
      </div>
      {!providers.length && (
        <EmptyState
          title="No saved providers yet"
          detail="Save a provider from their profile to find them here."
          action={() => go("search")}
          actionLabel="Discover providers"
        />
      )}
    </div>
  )
}

function Notifications() {
  const { store, updateStore } = useDemoStore()
  return (
    <div className="content">
      <PageHeader
        title="Notifications"
        description="Updates from your jobs and providers."
        action={
          <Button
            variant="secondary"
            onClick={() => updateStore({ notifications: [] })}
          >
            Mark all read
          </Button>
        }
      />
      {store.notifications.length ? (
        <div className="job-list">
          {store.notifications.map((item, index) => (
            <section className="card notification-row" key={`${index}-${item}`}>
              <span className="unread" />
              <p>{item}</p>
              <small>Saved on this device</small>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="You’re all caught up"
          detail="New job and message updates will show here."
        />
      )}
    </div>
  )
}

function CustomerDispute() {
  const { store, updateStore } = useDemoStore()
  const [reason, setReason] = useState("Incomplete or poor-quality work")
  const [details, setDetails] = useState("")
  const [submitted, setSubmitted] = useState(false)
  return (
    <div className="content narrow">
      <PageHeader
        title={submitted ? "Dispute submitted" : "Get help with your job"}
        description={`Job #${store.selectedJobId} · ${store.selectedBid.provider}`}
      />
      {submitted ? (
        <section className="card">
          <Badge tone="amber">Demo dispute opened</Badge>
          <h2>Support will review your sample report</h2>
          <p>No actual case or payment hold was created.</p>
        </section>
      ) : (
        <section className="form-card">
          <DemoNotice>
            Submitting this form creates a local sample only. No support team is
            contacted.
          </DemoNotice>
          <label>
            Issue
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            >
              <option>Incomplete or poor-quality work</option>
              <option>Provider did not arrive</option>
              <option>Payment or refund question</option>
              <option>Safety concern</option>
            </select>
          </label>
          <label>
            Details
            <textarea
              rows={5}
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Describe what happened."
            />
          </label>
          <Button
            disabled={!details.trim()}
            onClick={() => {
              updateStore({
                notifications: [
                  `Demo dispute opened: ${reason}`,
                  ...store.notifications,
                ],
                adminActions: [
                  `Customer dispute: ${reason} — ${details}`,
                  ...store.adminActions,
                ],
              })
              setSubmitted(true)
            }}
          >
            Submit demo dispute
          </Button>
        </section>
      )}
    </div>
  )
}

function Settings() {
  const { store, updateStore } = useDemoStore()
  return (
    <div className="content narrow">
      <PageHeader
        title="Settings"
        description="Local demo preferences for this device."
      />
      <section className="card setting-card">
        <label>
          Language preference
          <select
            value={store.language}
            onChange={(event) =>
              updateStore({ language: event.target.value as "EN" | "SW" })
            }
          >
            <option value="EN">English</option>
            <option value="SW">Kiswahili preference</option>
          </select>
        </label>
        <DemoNotice>
          Some sample content remains in English in this prototype.
        </DemoNotice>
        <label className="preference-line">
          <input
            type="checkbox"
            checked={store.reduceAds}
            onChange={(event) =>
              updateStore({ reduceAds: event.target.checked })
            }
          />{" "}
          Reduce sponsored content
        </label>
        <h2>Notifications</h2>
        {(["jobs", "messages", "promotions"] as const).map((key) => (
          <label className="preference-line" key={key}>
            <input
              type="checkbox"
              checked={store.notificationPreferences[key]}
              onChange={(event) =>
                updateStore({
                  notificationPreferences: {
                    ...store.notificationPreferences,
                    [key]: event.target.checked,
                  },
                })
              }
            />
            {key[0].toUpperCase() + key.slice(1)} updates
          </label>
        ))}
        <Button
          variant="danger"
          onClick={() => {
            window.localStorage.removeItem(demoStorageKey)
            window.location.assign("/")
          }}
        >
          Reset local demo data
        </Button>
      </section>
    </div>
  )
}

const jobs = [
  ["Fix leaking kitchen tap", "Westlands · 3.2 km", "KES 2,000", "92% match"],
  ["Install two ceiling lights", "Kilimani · 1.8 km", "KES 3,500", "88% match"],
  ["Repair shower pressure", "Lavington · 4.1 km", "KES 2,800", "81% match"],
]

function ProviderDashboard({ go }: { go: (s: Screen) => void }) {
  const { store } = useDemoStore()
  return (
    <div className="content console-content">
      <PageHeader
        eyebrow="Tuesday, 24 June"
        title="Good morning, Otieno"
        description="You have 3 new matches nearby."
        action={<Button onClick={() => go("feed")}>Find work</Button>}
      />
      <div className="metrics">
        <Metric label="Available to withdraw" value="KES 18,450" />
        <Metric label="Pending in escrow" value="KES 6,200" />
        <Metric label="Jobs this month" value="17" delta="+12% from May" />
        <Metric label="Your rating" value="4.9" delta="Top 5% in Nairobi" />
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="section-title">
            <h2>Today’s job</h2>
            <Badge>In progress</Badge>
          </div>
          <div className="next-job">
            <div className="time-block">
              <strong>10:00</strong>
              <span>AM</span>
            </div>
            <div>
              <strong>Repair kitchen sink</strong>
              <span>Wanjiku M. · Kilimani · 2.1 km</span>
            </div>
          </div>
          <div className="card-actions">
            <Button onClick={() => go("management")}>Update status</Button>
            <Button
              variant="secondary"
              icon="message"
              onClick={() => go("chat")}
            >
              Message
            </Button>
          </div>
        </section>
        <section className="card profile-meter">
          <div className="section-title">
            <h2>Profile strength</h2>
            <strong>84%</strong>
          </div>
          <div className="meter">
            <i />
          </div>
          <p>Add two more portfolio photos to improve your ranking.</p>
          <Button variant="secondary" onClick={() => go("onboarding")}>
            Complete profile
          </Button>
        </section>
      </div>
      <section>
        <div className="section-title">
          <h2>Best matches for you</h2>
          <button onClick={() => go("feed")}>View all jobs</button>
        </div>
        <div className="job-row">
          {jobs.map((j) => (
            <JobCard job={j} key={j[0]} onClick={() => go("feed")} />
          ))}
        </div>
      </section>
    </div>
  )
}

function JobCard({ job, onClick }: JobCardProps) {
  return (
    <button className="job-card" onClick={onClick}>
      <div>
        <Badge>{job[3]}</Badge>
        <span>Posted 8 min ago</span>
      </div>
      <h3>{job[0]}</h3>
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
  const { store, updateStore } = useDemoStore()
  const available = store.jobs.filter((job) => job.status === "Open")
  return (
    <div className="content">
      <PageHeader
        title="Jobs matched to you"
        description="Fresh opportunities around Nairobi"
      />
      <div className="filters">
        <button className="active">Best match</button>
        <button>Within 5 km</button>
        <button>Today</button>
        <button>KES 2k+</button>
      </div>
      <DemoNotice>
        Sample Nairobi opportunities are stored locally for this prototype.
      </DemoNotice>
      <div className="job-feed">
        {available.map((job) => (
          <JobCard
            key={job.id}
            job={[
              job.title,
              job.location,
              `KES ${job.budget.toLocaleString()}`,
              `${job.bids.length} bids`,
            ]}
            onClick={() => {
              updateStore({ selectedJobId: job.id })
              go("jobDetail")
            }}
          />
        ))}
      </div>
      {!available.length && (
        <EmptyState
          title="No open jobs right now"
          detail="New customer jobs will appear in your feed."
        />
      )}
    </div>
  )
}

function ProviderOnboarding() {
  const [saved, setSaved] = useState(false)
  return (
    <div className="content narrow">
      <PageHeader
        eyebrow="Provider setup · 1 of 1"
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
          <select multiple size={4}>
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
  const { store, updateStore } = useDemoStore()
  const [evidence, setEvidence] = useState("")
  return (
    <div className="content narrow">
      <PageHeader
        title="Provider verification"
        description="Submit identity and skills evidence for a review simulation."
      />
      <DemoNotice>
        Do not upload real identity documents to this local demo.
      </DemoNotice>
      <section className="form-card">
        <div className="safe-note">
          <Icon name="shield" />
          <span>
            Status: <strong>{store.verificationStatus}</strong>
          </span>
        </div>
        <label>
          Identity document
          <select>
            <option>National ID</option>
            <option>Passport</option>
          </select>
        </label>
        <label className="upload">
          <Icon name="plus" />
          <span>
            Choose ID image · demo only
            <input type="file" accept="image/*" />
          </span>
        </label>
        <label>
          Skills evidence
          <textarea
            rows={3}
            placeholder="Describe training, licences, or relevant experience."
          />
        </label>
        <label className="upload">
          <Icon name="plus" />
          <span>
            Attach certificates or work samples
            <input type="file" accept="image/*,.pdf" multiple />
          </span>
        </label>
        <Button
          disabled={
            store.verificationStatus === "In review" ||
            store.verificationStatus === "Certified"
          }
          onClick={() =>
            updateStore({
              verificationStatus: "In review",
              notifications: [
                "Your demo verification was submitted for review.",
                ...store.notifications,
              ],
            })
          }
        >
          Submit for demo review
        </Button>
        {store.verificationStatus === "In review" && (
          <Button
            variant="secondary"
            onClick={() => updateStore({ verificationStatus: "Certified" })}
          >
            Simulate admin certification
          </Button>
        )}
        {store.verificationStatus === "Certified" && (
          <Badge>
            <Icon name="shield" size={13} /> OddJobs Certified · demo
          </Badge>
        )}
      </section>
    </div>
  )
}

function ProviderJobDetail({ go }: { go: (screen: Screen) => void }) {
  const { store, updateStore } = useDemoStore()
  const job =
    store.jobs.find((item) => item.id === store.selectedJobId) ?? store.jobs[0]
  const [price, setPrice] = useState(String(job.budget))
  const [timing, setTiming] = useState("Tomorrow morning")
  const [pitch, setPitch] = useState(
    "I can complete this work carefully and bring the required supplies.",
  )
  const [message, setMessage] = useState("")
  const submitBid = () => {
    const amount = Number(price)
    if (!Number.isFinite(amount) || amount <= 0 || !pitch.trim()) {
      setMessage("Enter a valid quote and a short message.")
      return
    }
    const bid: DemoBid = {
      provider: "Otieno Demo",
      price: amount,
      timing,
      pitch: pitch.trim(),
      trust: 90,
    }
    updateStore((current) => ({
      ...current,
      jobs: current.jobs.map((item) =>
        item.id === job.id
          ? {
              ...item,
              bids: [
                ...item.bids.filter(
                  (existing) => existing.provider !== bid.provider,
                ),
                bid,
              ],
            }
          : item,
      ),
      notifications: [
        `Your demo quote was added to ${job.title}.`,
        ...current.notifications,
      ],
    }))
    setMessage("Demo bid added to this job.")
  }
  return (
    <div className="content narrow">
      <PageHeader
        eyebrow={`Job #${job.id}`}
        title={job.title}
        description={`${job.category} · ${job.location} · Budget up to KES ${job.budget.toLocaleString()}`}
      />
      <section className="card">
        <p>{job.description}</p>
        <p className="caption">
          Customer timing: {job.timing} · {job.bids.length} bids received
        </p>
        <div className="form-card">
          <label>
            Your quote (KES)
            <input
              inputMode="numeric"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
          </label>
          <label>
            When can you start?
            <select
              value={timing}
              onChange={(event) => setTiming(event.target.value)}
            >
              <option>Today after 2pm</option>
              <option>Tomorrow morning</option>
              <option>Within a week</option>
            </select>
          </label>
          <label>
            Message
            <textarea
              rows={4}
              value={pitch}
              onChange={(event) => setPitch(event.target.value)}
            />
          </label>
          <label className="upload">
            <Icon name="plus" />
            <span>
              Add quote attachments
              <input type="file" accept="image/*,.pdf" multiple />
            </span>
          </label>
          <Button onClick={submitBid}>Submit demo bid</Button>
          {message && <DemoNotice>{message}</DemoNotice>}
        </div>
        <Button variant="ghost" onClick={() => go("chat")}>
          Open job conversation
        </Button>
      </section>
    </div>
  )
}

function JobManagement({ go }: { go: (screen: Screen) => void }) {
  const { store, updateStore } = useDemoStore()
  const advance = (job: DemoJob) => {
    const status: DemoJob["status"] =
      job.status === "Open"
        ? "Active"
        : job.status === "Active"
          ? "Completed"
          : "Completed"
    updateStore({
      jobs: store.jobs.map((item) =>
        item.id === job.id ? { ...item, status } : item,
      ),
      notifications: [
        `${job.title} marked ${status.toLowerCase()} in the demo.`,
        ...store.notifications,
      ],
    })
  }
  return (
    <div className="content">
      <PageHeader
        title="My jobs"
        description="Manage your demo bookings and job progress."
      />
      <DemoNotice>
        Job states update locally; customer and provider workspaces share this
        demo data.
      </DemoNotice>
      <div className="job-list">
        {store.jobs.map((job) => (
          <section className="card job-summary" key={job.id}>
            <Badge>{job.status}</Badge>
            <h2>{job.title}</h2>
            <p>
              {job.location} · {job.bids.length} bids
            </p>
            <div className="card-actions">
              <Button onClick={() => advance(job)}>
                {job.status === "Open"
                  ? "Accept demo job"
                  : job.status === "Active"
                    ? "Mark demo work complete"
                    : "Completed"}
              </Button>
              {job.status === "Active" && (
                <Button variant="secondary" onClick={() => go("chat")}>
                  Message customer
                </Button>
              )}
              <label className="upload">
                <Icon name="plus" />
                <span>
                  Upload proof of work
                  <input type="file" accept="image/*" multiple />
                </span>
              </label>
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function Wallet() {
  const { store, updateStore } = useDemoStore()
  const [message, setMessage] = useState("")
  const transactions = [
    ...store.transactions,
    "Cleaning · #OJ-2819 · Completed · + KES 2,300",
    "Plumbing · #OJ-2798 · Completed · + KES 3,800",
  ]
  return (
    <div className="content console-content">
      <PageHeader
        title="Wallet"
        description="Track demo earnings and simulated M-Pesa payouts"
        action={
          <Button
            onClick={() => {
              updateStore({
                transactions: [
                  `Demo withdrawal requested · ${new Date().toLocaleString()}`,
                  ...store.transactions,
                ],
              })
              setMessage(
                "Demo withdrawal recorded locally; no M-Pesa payout was made.",
              )
            }}
          >
            Simulate withdrawal
          </Button>
        }
      />
      {message && <DemoNotice>{message}</DemoNotice>}
      <DemoNotice>
        All balances and transactions are sample data; no funds move.
      </DemoNotice>
      <div className="wallet-hero">
        <span>Available balance</span>
        <strong>KES 18,450</strong>
        <small>Pending in escrow: KES 6,200</small>
      </div>
      <section className="card">
        <div className="section-title">
          <h2>Recent transactions</h2>
          <Button
            variant="secondary"
            onClick={() =>
              setMessage(
                "PDF export is unavailable in this browser-only prototype.",
              )
            }
          >
            Export statement
          </Button>
        </div>
        <DataTable
          headers={["Transaction", "Date", "Status", "Amount"]}
          rows={transactions.map((item) => [
            item.split(" · ")[0],
            new Date().toLocaleDateString(),
            "Demo",
            "+ KES 2,300",
          ])}
        />
      </section>
    </div>
  )
}

function Reputation() {
  return (
    <div className="content console-content">
      <PageHeader
        title="Your reputation"
        description="Strong service builds lasting trust"
      />
      <div className="reputation-hero">
        <div>
          <span>Your rating</span>
          <strong>4.9</strong>
          <div className="rating">★★★★★ · 128 reviews</div>
        </div>
        <div className="score-ring">
          <strong>96</strong>
          <span>Trust score</span>
        </div>
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <h2>What clients value</h2>
          {[
            "Quality of work  98%",
            "Communication  96%",
            "On-time arrival  94%",
          ].map((x, i) => (
            <div className="rank-row" key={x}>
              <span>{x}</span>
              <div>
                <i style={{ width: `${98 - i * 2}%` }} />
              </div>
            </div>
          ))}
        </section>
        <section className="card tips">
          <h2>Improve your ranking</h2>
          <p>
            <Icon name="check" /> Reply to new messages within 10 minutes.
          </p>
          <p>
            <Icon name="check" /> Add 2 recent work photos.
          </p>
          <p>
            <Icon name="check" /> Complete the electrical safety course.
          </p>
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

function DataTable({ headers, rows }: DataTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>
                  {j === 2 ? (
                    <Badge
                      tone={
                        cell.includes("Reject")
                          ? "red"
                          : cell.includes("Pending") || cell.includes("SLA")
                            ? "amber"
                            : "green"
                      }
                    >
                      {cell}
                    </Badge>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Overview() {
  return (
    <div className="content console-content">
      <PageHeader
        eyebrow="Live marketplace"
        title="Marketplace overview"
        description="Tuesday, 24 June 2025"
        action={<Button variant="secondary">Export report</Button>}
      />
      <div className="metrics six">
        <Metric
          label="Gross marketplace value"
          value="KES 24.8M"
          delta="+14.2%"
        />
        <Metric label="Net take rate" value="10.4%" delta="+0.6 pts" />
        <Metric label="Active providers" value="8,421" delta="+8.1%" />
        <Metric label="Job fill rate" value="82.6%" delta="+3.4 pts" />
        <Metric label="Avg. rating" value="4.72" />
        <Metric label="Open disputes" value="28" delta="0.8% of jobs" />
      </div>
      <div className="analytics-grid">
        <section className="card chart-card">
          <div className="section-title">
            <div>
              <h2>Jobs and GMV</h2>
              <span>Last 30 days</span>
            </div>
            <Badge>+14.2%</Badge>
          </div>
          <div className="bar-chart">
            {[42, 56, 48, 70, 64, 78, 73, 86, 92, 81, 96, 88].map((v, i) => (
              <i key={i} style={{ height: `${v}%` }} />
            ))}
          </div>
          <div className="chart-labels">
            <span>1 Jun</span>
            <span>8 Jun</span>
            <span>15 Jun</span>
            <span>24 Jun</span>
          </div>
        </section>
        <section className="card">
          <h2>Supply vs demand</h2>
          <div className="heatmap">
            {["Cleaning", "Plumbing", "Electrical", "Care", "Tutoring"].map(
              (x, i) => (
                <div key={x}>
                  <span>{x}</span>
                  <i className={`heat heat-${i}`} />
                  <b>{[1.4, 2.8, 3.2, 0.8, 1.9][i]}×</b>
                </div>
              ),
            )}
          </div>
          <p className="caption">Demand ratio by active provider · Nairobi</p>
        </section>
      </div>
      <section className="card">
        <div className="section-title">
          <h2>Marketplace attention</h2>
          <button>View all</button>
        </div>
        <DataTable
          headers={["Item", "Area", "Priority", "Owner", "Status"]}
          rows={[
            ["Provider demand gap", "Embakasi", "High", "Supply ops", "Open"],
            [
              "Verification backlog",
              "Nairobi",
              "Medium",
              "Trust team",
              "Pending",
            ],
            ["Payment success rate", "M-Pesa", "Normal", "Finance", "Resolved"],
          ]}
        />
      </section>
    </div>
  )
}

function Users() {
  const { store, updateStore } = useDemoStore()
  const [query, setQuery] = useState("")
  const [role, setRole] = useState("All")
  const [status, setStatus] = useState("All")
  const users = [
    ["Wanjiku Mwangi", "Customer", "Kilimani", "14", "Active"],
    ["Brian Otieno", "Provider", "Westlands", "228", "Active"],
    ["Amina Hassan", "Provider", "Eastleigh", "214", "Active"],
    ["John Kariuki", "Provider", "Thika", "31", "Pending review"],
    ["Mary Njeri", "Moderator", "Nairobi", "—", "Active"],
  ]
  const filtered = users.filter(
    (row) =>
      row.join(" ").toLowerCase().includes(query.toLowerCase()) &&
      (role === "All" || row[1] === role) &&
      (status === "All" || row[4] === status),
  )
  return (
    <div className="content console-content">
      <PageHeader
        title="Users & roles"
        description="Sample user directory · permission matrix and audit are demo-only"
        action={
          <Button
            icon="plus"
            onClick={() =>
              updateStore({
                adminActions: [
                  "Invite user opened in demo",
                  ...store.adminActions,
                ],
              })
            }
          >
            Invite user
          </Button>
        }
      />
      <div className="admin-toolbar">
        <div className="search-box active">
          <Icon name="search" />
          <input
            aria-label="Search users"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, phone or ID"
          />
        </div>
        <div className="filters">
          <select
            aria-label="Filter by role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {["All", "Customer", "Provider", "Moderator"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            {["All", "Active", "Pending review"].map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>
      <section className="card table-card">
        <DataTable
          headers={["User", "Role", "Location", "Jobs", "Status"]}
          rows={filtered}
        />
        {!filtered.length && (
          <EmptyState
            title="No matching users"
            detail="Change the search or role/status filters."
            action={() => {
              setQuery("")
              setRole("All")
              setStatus("All")
            }}
            actionLabel="Clear filters"
          />
        )}
        <div className="card-actions">
          <Button
            variant="secondary"
            onClick={() =>
              updateStore({
                adminActions: [
                  `Bulk action applied to ${filtered.length} sample users`,
                  ...store.adminActions,
                ],
              })
            }
          >
            Bulk action on filtered demo users
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              updateStore({
                adminActions: [
                  "Permission matrix viewed",
                  ...store.adminActions,
                ],
              })
            }
          >
            View permission matrix
          </Button>
          <Button
            variant="secondary"
            onClick={() =>
              updateStore({
                adminActions: [
                  "User list export simulated",
                  ...store.adminActions,
                ],
              })
            }
          >
            Export demo list
          </Button>
        </div>
      </section>
    </div>
  )
}

function Verification() {
  const { store, updateStore } = useDemoStore()
  const [status, setStatus] = useState("Review needed")
  const [reason, setReason] = useState("")
  const [selected, setSelected] = useState("John Kariuki · Electrician")
  const decide = (next: string) => {
    if (next === "Rejected" && !reason.trim()) {
      setStatus("Add a rejection reason first.")
      return
    }
    setStatus(next)
    updateStore({
      verificationStatus:
        next === "Approved & certified" ? "Certified" : "In review",
      adminActions: [
        `${selected}: ${next}${reason ? ` — ${reason}` : ""}`,
        ...store.adminActions,
      ],
    })
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="Verification queue"
        description="Sample identity evidence only—no real documents are shown."
        action={
          <Button
            variant="secondary"
            onClick={() => decide("Bulk certification simulated")}
          >
            Bulk certify sample
          </Button>
        }
      />
      <DemoNotice>
        Do not upload or treat personal identity information in this demo as
        real.
      </DemoNotice>
      <div className="split-console">
        <section className="queue-list">
          {[
            "John Kariuki · Electrician",
            "Halima Noor · Cleaner",
            "Kevin Ouma · Plumber",
            "Faith Njeri · Caregiver",
          ].map((x, i) => (
            <button
              className={selected === x ? "active" : ""}
              key={x}
              onClick={() => {
                setSelected(x)
                setStatus("Review needed")
              }}
            >
              <Avatar src={i % 2 ? photos.amina : photos.otieno} name={x} />
              <span>
                <strong>{x}</strong>
                <small>Submitted {i + 1}h ago</small>
              </span>
              <Icon name="chevron" size={16} />
            </button>
          ))}
        </section>
        <section className="card document-view">
          <div className="section-title">
            <div>
              <Badge tone="amber">{status}</Badge>
              <h2>{selected.split(" · ")[0]}</h2>
            </div>
            <span>Demo application</span>
          </div>
          <div className="id-document">
            <Icon name="layout" size={36} />
            <span>Placeholder identity document</span>
            <strong>Sample data only · not an ID scan</strong>
          </div>
          <div className="detail-grid">
            <span>
              <small>ID number</small>
              <b>•••••• 204 · sample</b>
            </span>
            <span>
              <small>Category</small>
              <b>{selected.split(" · ")[1]}</b>
            </span>
            <span>
              <small>Skills evidence</small>
              <b>Sample pending</b>
            </span>
            <span>
              <small>Duplicate check</small>
              <b>Not connected</b>
            </span>
          </div>
          <label>
            Decision notes / rejection reason
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Enter a reason for rejection…"
            />
          </label>
          <div className="card-actions">
            <Button onClick={() => decide("Approved & certified")}>
              Approve & certify demo
            </Button>
            <Button variant="danger" onClick={() => decide("Rejected")}>
              Reject with reason
            </Button>
            <Button
              variant="ghost"
              onClick={() => decide("Certification revoked")}
            >
              Revoke demo
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}

function Moderation() {
  const { store, updateStore } = useDemoStore()
  const [message, setMessage] = useState("")
  const reports = [
    ["Harassment in chat", "Job #OJ-2801", "Critical", "8 min ago", "SLA 22m"],
    [
      "Misleading portfolio",
      "Provider #P-1882",
      "High",
      "31 min ago",
      "Pending",
    ],
    ["Off-platform payment", "Job #OJ-2744", "High", "2h ago", "Pending"],
    ["Spam message", "User #U-9931", "Low", "4h ago", "Resolved"],
  ]
  const action = (label: string) => {
    updateStore({ adminActions: [label, ...store.adminActions] })
    setMessage(`${label} recorded in the demo audit trail.`)
  }
  return (
    <div className="content console-content">
      <PageHeader
        title="Reports & moderation"
        description="Demo priority queue and simulated actions"
      />
      <DemoNotice>
        Actions below update only local demo state; no account or content is
        changed on a service.
      </DemoNotice>
      <section className="card">
        <div className="card-actions">
          {["Hide selected", "Warn user", "Suspend account", "Escalate"].map(
            (label) => (
              <Button
                key={label}
                variant="secondary"
                onClick={() => action(label)}
              >
                {label}
              </Button>
            ),
          )}
        </div>
        {message && <DemoNotice>{message}</DemoNotice>}
        <DataTable
          headers={["Report", "Subject", "Priority", "Reported", "Status"]}
          rows={reports}
        />
      </section>
    </div>
  )
}

function Categories() {
  const [fee, setFee] = useState("10")
  const [message, setMessage] = useState("")
  return (
    <div className="content console-content">
      <PageHeader
        title="Categories & fees"
        description="Edit local demo marketplace configuration."
      />
      <DemoNotice>
        Changes here are local samples; no production pricing is altered.
      </DemoNotice>
      <div className="settings-grid">
        <section className="card">
          <h2>Service categories</h2>
          {[
            "Cleaning",
            "Plumbing",
            "Electrical",
            "Care",
            "Grooming",
            "Tutoring",
            "Moving",
            "Repairs",
          ].map((name, index) => (
            <div className="setting-line" key={name}>
              <span>
                {index < 3 ? "↳ " : ""}
                {name}
              </span>
              <Button
                variant="ghost"
                onClick={() =>
                  setMessage(`${name} category selected for demo editing.`)
                }
              >
                Edit
              </Button>
            </div>
          ))}
          <Button
            onClick={() =>
              setMessage("New demo category added to the action preview.")
            }
          >
            Add category
          </Button>
        </section>
        <section className="card setting-card">
          <h2>Fees and plans</h2>
          <label>
            Marketplace commission (%)
            <input
              inputMode="decimal"
              value={fee}
              onChange={(event) => setFee(event.target.value)}
            />
          </label>
          <Button
            onClick={() => setMessage(`Demo commission saved at ${fee}%.`)}
          >
            Save demo commission
          </Button>
          <label>
            Promo codes
            <input placeholder="Create a promo code" />
          </label>
          <Button
            variant="secondary"
            onClick={() => setMessage("Demo promo code created.")}
          >
            Create promo code
          </Button>
          <h3>Subscription plan editor</h3>
          <textarea
            rows={4}
            defaultValue={
              "Basic · KES 0\nPro · KES 499/month\nElite · KES 1,499/month"
            }
          />
          <Button
            variant="secondary"
            onClick={() =>
              setMessage("Plan changes saved in local demo state.")
            }
          >
            Save demo plans
          </Button>
        </section>
      </div>
      {message && <DemoNotice>{message}</DemoNotice>}
    </div>
  )
}

function AdApprovals() {
  const [status, setStatus] = useState("Pending review")
  return (
    <div className="content console-content">
      <PageHeader
        title="Ad approvals & inventory"
        description="Manage the allowed sponsored placements."
      />
      <DemoNotice>
        Strict demo placements: login/landing carousel and one consumer
        dashboard row only.
      </DemoNotice>
      <section className="card">
        <div className="section-title">
          <div>
            <Badge tone="amber">{status}</Badge>
            <h2>Jumia Home · cleaning supplies</h2>
          </div>
          <span>Sample campaign · Nairobi</span>
        </div>
        <Sponsored />
        <p>
          Requested placement: consumer dashboard · frequency cap: 1 per
          dashboard view.
        </p>
        <div className="card-actions">
          <Button onClick={() => setStatus("Approved · demo")}>
            Approve demo ad
          </Button>
          <Button variant="danger" onClick={() => setStatus("Rejected · demo")}>
            Reject demo ad
          </Button>
        </div>
      </section>
      <section className="card">
        <h2>Inventory rules</h2>
        <p>
          Login/landing carousel: 2–3 cards. Consumer dashboard: one slim
          sponsored row. No ads in search, job, chat, payment, or provider
          dashboard.
        </p>
      </section>
    </div>
  )
}

function AuditLog() {
  const { store } = useDemoStore()
  return (
    <div className="content console-content">
      <PageHeader
        title="Audit log"
        description="Local prototype activity log; not a security audit trail."
      />
      <DemoNotice>
        Browser storage can be edited by the user. Do not rely on this log for
        production accountability.
      </DemoNotice>
      {store.adminActions.length ? (
        <DataTable
          headers={["Action", "Scope", "Status"]}
          rows={store.adminActions.map((action) => [
            action,
            "Local demo",
            "Simulated",
          ])}
        />
      ) : (
        <EmptyState
          title="No demo actions yet"
          detail="Actions taken in the admin and support previews will appear here."
        />
      )}
    </div>
  )
}

function Config() {
  const { store, updateStore } = useDemoStore()
  const groups = [
    [
      "Feature flags",
      "Escrow v2",
      "Provider live location",
      "Saved search alerts",
    ],
    [
      "Payments",
      "M-Pesa integration (demo)",
      "Payout retries",
      "Platform fee: 10%",
    ],
    [
      "Notifications",
      "SMS · Africa's Talking (demo)",
      "Email · SendGrid (demo)",
      "WhatsApp disabled",
    ],
    [
      "Data retention",
      "Chat: 24 months",
      "ID documents: 7 years",
      "Audit logs: indefinite",
    ],
  ]
  return (
    <div className="content console-content">
      <PageHeader
        title="System configuration"
        description="Manage local demo flags; integrations are not connected."
      />
      <DemoNotice>
        Never enter production payment keys in this browser-only prototype.
      </DemoNotice>
      <div className="settings-grid">
        {groups.map(([title, ...items]) => (
          <section className="card setting-card" key={title}>
            <Icon name="settings" />
            <h2>{title}</h2>
            {items.map((item, i) => (
              <div className="setting-line" key={item}>
                <span>{item}</span>
                <button
                  className={`switch ${
                    (store.featureFlags[item] ?? i !== 2) ? "on" : ""
                  }`}
                  aria-label={`Toggle ${item}`}
                  aria-pressed={store.featureFlags[item] ?? i !== 2}
                  onClick={() =>
                    updateStore({
                      featureFlags: {
                        ...store.featureFlags,
                        [item]: !(store.featureFlags[item] ?? i !== 2),
                      },
                    })
                  }
                >
                  <i />
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
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

function readDemoStore(): DemoStore {
  try {
    const saved = window.localStorage.getItem(demoStorageKey)
    if (!saved) return initialDemoStore
    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== "object")
      throw new Error("Saved demo data is not an object.")
    return { ...initialDemoStore, ...parsed as Partial<DemoStore> }
  } catch (error) {
    console.error("Unable to load OddJobs demo data.", error)
    return initialDemoStore
  }
}

function AppShell() {
  const [route, setRoute] = useState<WorkspaceRoute>(() =>
    getWorkspaceRoute(window.location.pathname),
  )
  const [store, setStore] = useState<DemoStore>(readDemoStore)
  const [storageError, setStorageError] = useState("")
  const [online, setOnline] = useState(navigator.onLine)
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false)
  const { role, screen } = route
  const updateStore = (
    update: Partial<DemoStore> | ((current: DemoStore) => DemoStore),
  ) => {
    setStore((current) =>
      typeof update === "function"
        ? update(current)
        : { ...current, ...update },
    )
  }
  const navigate = (nextRole: Role, nextScreen: Screen) => {
    const nextRoute = {
      role: nextRole,
      screen: roleScreens[nextRole].includes(nextScreen)
        ? nextScreen
        : roleHomes[nextRole],
    }
    window.history.pushState(null, "", workspacePath(nextRoute))
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const go = (next: Screen) => navigate(role, next)
  const switchRole = (next: Role) => navigate(next, roleHomes[next])
  const goWelcome = () => {
    const nextRoute: WorkspaceRoute = { role: "consumer", screen: "welcome" }
    window.history.pushState(null, "", workspacePath(nextRoute))
    setRoute(nextRoute)
  }

  useEffect(() => {
    const syncRoute = () => {
      const nextRoute = getWorkspaceRoute(window.location.pathname)
      setRoute(nextRoute)
      const canonicalPath = workspacePath(nextRoute)
      if (window.location.pathname !== canonicalPath) {
        window.history.replaceState(null, "", canonicalPath)
      }
    }
    window.addEventListener("popstate", syncRoute)
    syncRoute()
    return () => window.removeEventListener("popstate", syncRoute)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem(demoStorageKey, JSON.stringify(store))
      setStorageError("")
    } catch (error) {
      console.error("Unable to save OddJobs demo data.", error)
      setStorageError("Demo changes could not be saved on this device.")
    }
  }, [store])

  useEffect(() => {
    const setConnected = () => {
      setOnline(navigator.onLine)
      setOfflineBannerDismissed(false)
    }
    window.addEventListener("online", setConnected)
    window.addEventListener("offline", setConnected)
    return () => {
      window.removeEventListener("online", setConnected)
      window.removeEventListener("offline", setConnected)
    }
  }, [])

  const renderScreen = () => {
    switch (screen) {
      case "welcome":
        return null
      case "home":
        return <Home go={go} />
      case "search":
        return <SearchResults go={go} />
      case "map":
        return <MapView go={go} />
      case "profile":
        return <Profile go={go} />
      case "post":
        return <PostJob go={go} />
      case "jobs":
        return <ConsumerJobs go={go} />
      case "bids":
        return <Bids go={go} />
      case "checkout":
        return <Checkout go={go} />
      case "track":
        return <Tracking go={go} />
      case "chat":
        return <Chat />
      case "review":
        return <Review go={go} />
      case "dispute":
        return <CustomerDispute />
      case "history":
        return <History />
      case "saved":
        return <SavedProviders go={go} />
      case "notifications":
        return <Notifications />
      case "settings":
        return <Settings />
      case "providerHome":
        return <ProviderDashboard go={go} />
      case "onboarding":
        return <ProviderOnboarding />
      case "providerVerification":
        return <ProviderVerification />
      case "feed":
        return <JobFeed go={go} />
      case "jobDetail":
        return <ProviderJobDetail go={go} />
      case "management":
        return <JobManagement go={go} />
      case "wallet":
        return <Wallet />
      case "reputation":
        return <Reputation />
      case "training":
        return <Training />
      case "plans":
        return <Plans />
      case "analytics":
        return <ProviderAnalytics />
      case "ads":
        return <AdCreator />
      case "overview":
        return <Overview />
      case "users":
        return <Users />
      case "verification":
        return <Verification />
      case "categories":
        return <Categories />
      case "moderation":
        return <Moderation />
      case "adApprovals":
        return <AdApprovals />
      case "audit":
        return <AuditLog />
      case "config":
        return <Config />
      case "disputes":
        return <Disputes />
      case "inbox":
        return <Inbox />
      case "knowledgeBase":
        return <KnowledgeBase />
      case "programmes":
        return <Programmes />
      case "impact":
        return <Impact />
      case "builder":
        return <Builder />
    }
  }
  if (screen === "welcome")
    return (
      <DemoContext.Provider value={{ store, updateStore }}>
        <Welcome enter={(next) => navigate(next, roleHomes[next])} />
      </DemoContext.Provider>
    )
  return (
    <DemoContext.Provider value={{ store, updateStore }}>
      <div className={`app role-${role}`}>
        <header className="topbar">
          <button className="brand" onClick={goWelcome}>
            <span>O</span>
            <strong>
              OddJobs<em>.com</em>
            </strong>
          </button>
          <div className="role-switcher" aria-label="Preview workspace">
            <span className="workspace-preview-label">Preview</span>
            {([
              "consumer",
              "provider",
              "admin",
              "support",
              "partner",
            ] as Role[]).map((r) => (
              <button
                key={r}
                className={role === r ? "active" : ""}
                onClick={() => switchRole(r)}
              >
                {r === "consumer"
                  ? "Hire"
                  : r === "provider"
                    ? "Work"
                    : r[0].toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <div className="top-actions">
            <button
              className="lang"
              onClick={() =>
                updateStore({ language: store.language === "EN" ? "SW" : "EN" })
              }
            >
              {store.language}{" "}
              <span>/ {store.language === "EN" ? "SW" : "EN"}</span>
            </button>
            <button
              className="icon-button"
              aria-label="Notifications"
              onClick={() =>
                navigate(
                  role,
                  role === "consumer" ? "notifications" : roleHomes[role],
                )
              }
            >
              <Icon name="bell" />
              <i />
            </button>
            <Avatar
              src={role === "provider" ? photos.otieno : photos.wanjiku}
              name="Current user"
            />
          </div>
        </header>
        {(!online || storageError) && !offlineBannerDismissed && (
          <button
            className="network-banner"
            onClick={() => setOfflineBannerDismissed(true)}
          >
            <span>
              <i /> {storageError ? "Storage warning" : "Offline mode"}
            </span>
            <b>{storageError || "Saved demo content is available"}</b>
            <Icon name="close" size={16} />
          </button>
        )}
        <aside className="sidebar">
          <div className="workspace-label">
            {role === "consumer" ? "Your account" : `${role} workspace`}
          </div>
          <nav>
            {navigation[role].map((n) => (
              <button
                key={n.screen}
                className={screen === n.screen ? "active" : ""}
                onClick={() => go(n.screen)}
              >
                <Icon name={n.icon} />
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              onClick={() =>
                navigate(
                  role,
                  role === "consumer"
                    ? "settings"
                    : role === "provider"
                      ? "onboarding"
                      : role === "support"
                        ? "knowledgeBase"
                        : role === "partner"
                          ? "builder"
                          : "config",
                )
              }
            >
              <Icon name="settings" />
              <span>
                {role === "consumer"
                  ? "Settings"
                  : role === "provider"
                    ? "Profile settings"
                    : role === "support"
                      ? "Knowledge base"
                      : role === "partner"
                        ? "Campaign settings"
                        : "System config"}
              </span>
            </button>
            <div className="support-mini">
              <Icon name="message" />
              <div>
                <strong>Need help?</strong>
                <span>Prototype support inbox</span>
              </div>
            </div>
          </div>
        </aside>
        <main className="main">{renderScreen()}</main>
        <nav className="bottom-nav" aria-label={`${role} workspace pages`}>
          {navigation[role].map((n) => (
            <button
              key={n.screen}
              className={screen === n.screen ? "active" : ""}
              aria-current={screen === n.screen ? "page" : undefined}
              onClick={() => go(n.screen)}
            >
              <Icon name={n.icon} />
              <span>{n.label.split(" ")[0]}</span>
            </button>
          ))}
        </nav>
      </div>
    </DemoContext.Provider>
  )
}

export default function App() {
  return <AppShell />
}
