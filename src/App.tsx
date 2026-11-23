import { lazy, Suspense, useEffect, useState } from "react"
import {
  AuthProvider,
  useAuth,
} from "./auth/AuthProvider"
import AuthExperience from "./auth/AuthExperience"
import ProviderApplicationScreen from "./auth/ProviderApplicationScreen"
import CustomerIdentityVerificationScreen from "./auth/CustomerIdentityVerificationScreen"
import {
  getAuthenticatedRoute,
  getWorkspaceRoute,
  navigation,
  roleHomes,
  roleScreens,
  workspaceLabels,
  workspacePath,
  workspaceRoles,
  type WorkspaceRoute,
} from "./app/access"
import { DemoContext } from "./demo/context"

const loadProviderDirectory = () => import("./features/customer/ProviderDirectory")
const loadCustomerScreens = () => import("./features/customer/CustomerScreens")
const loadMarketplaceOperations = () => import("./features/admin/MarketplaceOperations")
const loadAdminConsole = () => import("./features/admin/AdminConsoleScreens")
const loadNotifications = () => import("./features/marketplace/Notifications")
const loadProviderScreens = () => import("./features/provider/ProviderScreens")
const loadPrototypeScreens = () => import("./features/prototype/PrototypeScreens")
const loadLandingPage = () => import("./features/public/LandingPage")

const ProviderDirectory = lazy(loadProviderDirectory)
const ProviderProfile = lazy(async () => {
  const module = await loadProviderDirectory()
  return { default: module.ProviderProfile }
})
const CustomerScreens = lazy(loadCustomerScreens)
const MarketplaceOperationsPage = lazy(loadMarketplaceOperations)
const AdminConsoleScreen = lazy(loadAdminConsole)
const Notifications = lazy(loadNotifications)
const ProviderScreens = lazy(loadProviderScreens)
const PrototypeScreens = lazy(loadPrototypeScreens)
const LandingPage = lazy(loadLandingPage)
import {
  demoStorageKey,
  initialDemoStore,
  type DemoStore,
  type Role,
  type Screen,
} from "./demo/model"

function preloadPage(screen: Screen, role: Role) {
  const customerPage = ["home", "workFeed", "map", "post", "jobs", "bids", "checkout", "track", "chat", "review", "dispute", "history", "saved", "settings", "hiringAnalytics", "hiringGuide"]
  const providerPage = ["providerHome", "listingCreate", "onboarding", "providerVerification", "identityVerification", "feed", "jobDetail", "providerBids", "management", "wallet", "reputation", "training", "plans", "analytics", "ads"]
  const adminPage = ["messages", "overview", "monitoring", "users", "verification", "categories", "moderation", "adApprovals", "config"]
  let load: (() => Promise<unknown>) | undefined

  if (screen === "welcome") load = loadLandingPage
  else if (screen === "search" || (screen === "profile" && role === "consumer")) load = loadProviderDirectory
  else if (screen === "profile" || (role === "consumer" && (customerPage.includes(screen) || screen === "payments" || screen === "analytics" || screen === "training"))) load = loadCustomerScreens
  else if (screen === "notifications") load = loadNotifications
  else if (screen === "operations") load = loadMarketplaceOperations
  else if (role === "admin" && (adminPage.includes(screen) || screen === "payments")) load = loadAdminConsole
  else if (role === "provider" && providerPage.includes(screen)) load = loadProviderScreens
  else if (["disputes", "inbox", "knowledgeBase", "programmes", "impact", "builder"].includes(screen)) load = loadPrototypeScreens

  if (load) void load().catch(() => undefined)
}
type IconProps = {
  name: string
  size?: number
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
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    logout: (
      <>
        <path d="M10 17l5-5-5-5M15 12H3" />
        <path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
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

function Avatar({
  src,
  name,
  large = false,
}: {
  src: string | null
  name: string
  large?: boolean
}) {
  if (!src) {
    const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?"
    return <span className={`avatar avatar-fallback ${large ? "avatar-large" : ""}`} role="img" aria-label={name}>{initials}</span>
  }
  return (
    <img
      className={`avatar ${large ? "avatar-large" : ""}`}
      src={src}
      alt={`${name}, service provider`}
    />
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
  const auth = useAuth()
  const authenticatedRoles =
    auth.profile?.roles.filter((candidate): candidate is Role =>
      workspaceRoles.includes(candidate as Role),
    ) ?? []
  const [route, setRoute] = useState<WorkspaceRoute>(() =>
    getAuthenticatedRoute(window.location.pathname, []),
  )
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(
    () => new URLSearchParams(window.location.search).get("provider"),
  )
  const [selectedDisputeListingId, setSelectedDisputeListingId] = useState<string | null>(null)
  const [routeNotice, setRouteNotice] = useState("")
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [store, setStore] = useState<DemoStore>(readDemoStore)
  const [storageError, setStorageError] = useState("")
  const [online, setOnline] = useState(navigator.onLine)
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false)
  const { role, screen } = route
  const workspaceNavigation = navigation[role]
  useEffect(() => {
    if (role !== "provider" || screen !== "profile") return
    const nextRoute: WorkspaceRoute = { role: "provider", screen: "settings" }
    window.history.replaceState(null, "", workspacePath(nextRoute))
    setRoute(nextRoute)
  }, [role, screen])
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
    const hasRequestedRole = authenticatedRoles.includes(nextRole)
    const requestedScreen =
      auth.profile && !hasRequestedRole ? "login" : nextScreen
    const nextRoute = {
      role: nextRole,
      screen: roleScreens[nextRole].includes(requestedScreen)
        ? requestedScreen
        : roleHomes[nextRole],
    }
    window.history.pushState(null, "", workspacePath(nextRoute))
    setRoute(nextRoute)
    if (nextRoute.screen !== "profile") setSelectedProviderId(null)
    setRouteNotice(
      auth.profile && !hasRequestedRole
        ? `This account does not have access to ${workspaceLabels[nextRole]}. Sign in with an account for that workspace.`
        : "",
    )
    setMobileMenuOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }
  const go = (next: Screen) => navigate(role, next)
  const openProvider = (providerId: string) => {
    navigate("consumer", "profile")
    setSelectedProviderId(providerId)
    window.history.replaceState(
      null,
      "",
      `${workspacePath({ role: "consumer", screen: "profile" })}?provider=${encodeURIComponent(providerId)}`,
    )
  }
  const openDispute = (listingId: string) => {
    setSelectedDisputeListingId(listingId)
    navigate("consumer", "dispute")
  }
  const chooseWorkspace = (next: Role) => {
    navigate(next, "login")
  }
  const clearAuthSession = () => {
    void auth.signOut().catch((error: unknown) => {
      console.error("Unable to sign out of OddJobs.", error)
      setStorageError("Your session could not be cleared. Please try again.")
    })
  }
  const signOutAndReturnToLogin = async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await auth.signOut()
      setStorageError("")
      setMobileMenuOpen(false)
      const nextRoute: WorkspaceRoute = { role, screen: "login" }
      window.history.replaceState(null, "", workspacePath(nextRoute))
      setRoute(nextRoute)
      window.scrollTo({ top: 0, behavior: "smooth" })
    } catch (error) {
      console.error("Unable to sign out of OddJobs.", error)
      setStorageError(
        error instanceof Error
          ? error.message
          : "Your session could not be cleared. Please try again.",
      )
    } finally {
      setSigningOut(false)
    }
  }
  const goWelcome = () => {
    clearAuthSession()
    const nextRoute: WorkspaceRoute = { role: "consumer", screen: "welcome" }
    window.history.pushState(null, "", workspacePath(nextRoute))
    setRoute(nextRoute)
    setMobileMenuOpen(false)
  }
  const goWorkspacePicker = () => {
    if (!auth.profile) {
      navigate("consumer", "workspace")
      return
    }

    void auth
      .refreshProfile()
      .then((profile) => {
        const availableRoles =
          profile?.roles.filter((candidate): candidate is Role =>
            workspaceRoles.includes(candidate as Role),
          ) ?? []
        const pickerRole = availableRoles.includes(role)
          ? role
          : (availableRoles[0] ?? role)
        const nextRoute = { role: pickerRole, screen: "workspace" as const }
        window.history.pushState(null, "", workspacePath(nextRoute))
        setRoute(nextRoute)
        setMobileMenuOpen(false)
        window.scrollTo({ top: 0, behavior: "smooth" })
      })
      .catch((error: unknown) => {
        console.error("Unable to refresh available workspaces.", error)
        setStorageError("Your workspaces could not be refreshed. Please try again.")
      })
  }

  useEffect(() => {
    if (!mobileMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", closeOnEscape)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [mobileMenuOpen])

  useEffect(() => {
    if (auth.loading) return
    const syncRoute = () => {
      setSelectedProviderId(new URLSearchParams(window.location.search).get("provider"))
      const requestedRoute = getWorkspaceRoute(window.location.pathname)
      const wasWorkspaceLogin = requestedRoute.screen === "login"
      if (
        authenticatedRoles.length > 0 &&
        !authenticatedRoles.includes(requestedRoute.role) &&
        (wasWorkspaceLogin ||
          window.location.pathname.startsWith(`/${requestedRoute.role}`))
      ) {
        const attempted = workspaceLabels[requestedRoute.role]
        const available = workspaceLabels[authenticatedRoles[0] ?? "consumer"]
        setRouteNotice(
          `This account does not have access to ${attempted}. You are signed in to ${available}.`,
        )
      } else {
        setRouteNotice("")
      }
      const nextRoute = getAuthenticatedRoute(window.location.pathname, authenticatedRoles)
      setRoute(nextRoute)
      const canonicalPath = workspacePath(nextRoute)
      if (window.location.pathname !== canonicalPath) {
        window.history.replaceState(null, "", canonicalPath)
      }
    }
    window.addEventListener("popstate", syncRoute)
    syncRoute()
    return () => window.removeEventListener("popstate", syncRoute)
  }, [auth.loading, auth.profile])

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

  if (auth.loading) {
    return (
      <div className="auth-shell">
        <p className="center-note">Checking your accountâ€¦</p>
      </div>
    )
  }

  if (auth.recovery) {
    return (
      <DemoContext.Provider value={{ store, updateStore }}>
        <AuthExperience
          initialRole="consumer"
          initialStage="recovery"
          chooseWorkspace={chooseWorkspace}
          changeWorkspace={goWorkspacePicker}
          goHome={goWelcome}
        />
      </DemoContext.Provider>
    )
  }

  if (auth.policyConsentRequired) {
    return (
      <DemoContext.Provider value={{ store, updateStore }}>
        <AuthExperience
          initialRole="consumer"
          initialStage="policyConsent"
          chooseWorkspace={chooseWorkspace}
          changeWorkspace={goWorkspacePicker}
          goHome={goWelcome}
        />
      </DemoContext.Provider>
    )
  }

  const renderScreen = () => {
    switch (screen) {
      case "welcome":
        return null
      case "workspace":
        if (!auth.profile) return null
        return (
          <div className="content narrow">
            <PageHeader
              title="Choose a workspace"
              description="Switch between the workspaces assigned to your account."
            />
            <section className="surface">
              <div className="card-actions">
                {authenticatedRoles.map((availableRole) => (
                  <Button
                    key={availableRole}
                    variant={availableRole === role ? "secondary" : "primary"}
                    onClick={() =>
                      navigate(availableRole, roleHomes[availableRole])
                    }
                  >
                    {workspaceLabels[availableRole]}
                  </Button>
                ))}
                {authenticatedRoles.includes("consumer") &&
                  !authenticatedRoles.includes("provider") && (
                    <Button
                      variant="secondary"
                      onClick={() => navigate("consumer", "providerApply")}
                    >
                      Apply to offer services
                    </Button>
                  )}
              </div>
              <p className="auth-terms">
                Providers can publish up to ten service listings before ID approval. Approval removes the listing limit.
              </p>
              <Button
                variant="secondary"
                icon="logout"
                disabled={signingOut}
                onClick={() => void signOutAndReturnToLogin()}
              >
                {signingOut ? "Signing outâ€¦" : "Sign out"}
              </Button>
            </section>
          </div>
        )
      case "providerApply":
        return (
          <ProviderApplicationScreen
            onComplete={() => {
              void auth.refreshProfile().then((profile) => {
                if (profile?.roles.includes("provider")) navigate("provider", "feed")
                else setRouteNotice("Your provider access could not be confirmed. Please retry or contact support.")
              }).catch((error: unknown) => {
                setRouteNotice(error instanceof Error ? error.message : "Your provider access could not be confirmed. Please try again.")
              })
            }}
          />
        )
      case "home":
        return <CustomerScreens screen="home" go={go} onOpenProvider={openProvider} />
      case "workFeed":
        return <CustomerScreens screen="workFeed" go={go} onOpenProvider={openProvider} />
      case "search":
        return <ProviderDirectory onOpenProvider={openProvider} />
      case "map":
        return <CustomerScreens screen="map" go={go} onOpenProvider={openProvider} />
      case "profile":
        return role === "provider" ? <CustomerScreens screen="settings" go={go} onOpenProvider={openProvider} /> : <ProviderProfile providerId={selectedProviderId} onPostJob={() => go("post")} />
      case "post":
        return <CustomerScreens screen="post" go={go} onOpenProvider={openProvider} />
      case "jobs":
        return <CustomerScreens screen="jobs" go={go} onOpenProvider={openProvider} />
      case "bids":
        return role === "provider" ? <ProviderScreens screen="providerBids" go={go} /> : <CustomerScreens screen="bids" go={go} onOpenProvider={openProvider} />
      case "checkout":
        return <CustomerScreens screen="checkout" go={go} onOpenProvider={openProvider} />
      case "track":
        return <CustomerScreens screen="track" go={go} onOpenProvider={openProvider} />
      case "chat":
        return role === "provider" ? <ProviderScreens screen="chat" go={go} /> : <CustomerScreens screen="chat" go={go} onOpenProvider={openProvider} />
      case "review":
        return <CustomerScreens screen="review" go={go} onOpenProvider={openProvider} />
      case "dispute":
        return <CustomerScreens screen="dispute" go={go} onOpenProvider={openProvider} disputeListingId={selectedDisputeListingId} />
      case "history":
        return <CustomerScreens screen="history" go={go} onOpenProvider={openProvider} onOpenDispute={openDispute} />
      case "saved":
        return <CustomerScreens screen="saved" go={go} onOpenProvider={openProvider} />
      case "notifications":
        return (
          <Notifications
            role={role === "provider" ? "provider" : "consumer"}
            onOpenJob={(jobId, notificationType) => {
              updateStore({ selectedJobId: jobId })
              go(notificationType.startsWith("listing.") ? role === "provider" ? "management" : "workFeed" : role === "provider" ? "jobDetail" : "bids")
            }}
          />
        )
      case "settings":
        return <CustomerScreens screen="settings" go={go} onOpenProvider={openProvider} />
      case "providerHome":
        return <ProviderScreens screen="providerHome" go={go} />
      case "listingCreate":
        return <ProviderScreens screen="listingCreate" go={go} />
      case "onboarding":
        return <ProviderScreens screen="onboarding" go={go} />
      case "providerVerification":
        return <ProviderScreens screen="providerVerification" go={go} />
      case "identityVerification":
        return <CustomerIdentityVerificationScreen go={go} />
      case "feed":
        return <ProviderScreens screen="feed" go={go} />
      case "jobDetail":
        return <ProviderScreens screen="jobDetail" go={go} />
      case "providerBids":
        return <ProviderScreens screen="providerBids" go={go} />
      case "management":
        return <ProviderScreens screen="management" go={go} />
      case "wallet":
        return <ProviderScreens screen="wallet" go={go} />
      case "reputation":
        return <ProviderScreens screen="reputation" go={go} />
      case "training":
        return role === "consumer" ? <CustomerScreens screen="hiringGuide" go={go} onOpenProvider={openProvider} /> : <ProviderScreens screen="training" go={go} />
      case "plans":
        return <ProviderScreens screen="plans" go={go} />
      case "analytics":
        return role === "consumer" ? <CustomerScreens screen="hiringAnalytics" go={go} onOpenProvider={openProvider} /> : <ProviderScreens screen="analytics" go={go} />
      case "hiringAnalytics":
        return <CustomerScreens screen="hiringAnalytics" go={go} onOpenProvider={openProvider} />
      case "hiringGuide":
        return <CustomerScreens screen="hiringGuide" go={go} onOpenProvider={openProvider} />
      case "ads":
        return <ProviderScreens screen="ads" go={go} />
      case "messages":
        return <AdminConsoleScreen screen="messages" />
      case "overview":
        return <AdminConsoleScreen screen="overview" />
      case "monitoring":
        return <AdminConsoleScreen screen="monitoring" />
      case "users":
        return <AdminConsoleScreen screen="users" />
      case "verification":
        return <AdminConsoleScreen screen="verification" />
      case "categories":
        return <AdminConsoleScreen screen="categories" />
      case "moderation":
        return <AdminConsoleScreen screen="moderation" />
      case "adApprovals":
        return <AdminConsoleScreen screen="adApprovals" />
      case "audit":
        return <AdminConsoleScreen screen="audit" />
      case "payments":
        return role === "consumer" ? <CustomerScreens screen="payments" go={go} onOpenProvider={openProvider} /> : <AdminConsoleScreen screen="payments" />
      case "operations":
        return <MarketplaceOperationsPage />
      case "config":
        return <AdminConsoleScreen screen="config" />
      case "disputes":
        return <PrototypeScreens screen="disputes" />
      case "inbox":
        return <PrototypeScreens screen="inbox" />
      case "knowledgeBase":
        return <PrototypeScreens screen="knowledgeBase" />
      case "programmes":
        return <PrototypeScreens screen="programmes" />
      case "impact":
        return <PrototypeScreens screen="impact" />
      case "builder":
        return <PrototypeScreens screen="builder" />
    }
  }
  if (screen === "welcome") {
    return (
      <Suspense fallback={<p className="center-note" role="status">Loading OddJobsâ€¦</p>}>
        <LandingPage
          onSignIn={() => navigate("consumer", "workspace")}
          onLogin={(nextRole) => navigate(nextRole, "login")}
        />
      </Suspense>
    )
  }
  if (screen === "workspace" || screen === "login")
    return (
      <DemoContext.Provider value={{ store, updateStore }}>
        <AuthExperience
          key={`${role}-${screen}`}
          initialRole={screen === "login" ? role : null}
          initialStage={screen === "workspace" ? "role" : "login"}
          chooseWorkspace={chooseWorkspace}
          changeWorkspace={goWorkspacePicker}
          goHome={goWelcome}
        />
      </DemoContext.Provider>
    )
  return (
    <DemoContext.Provider value={{ store, updateStore }}>
      <div className={`app role-${role}`}>
        <header className="topbar">
          <button
            className="mobile-menu-toggle"
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-controls="mobile-navigation"
            aria-expanded={mobileMenuOpen}
            onClick={() => setMobileMenuOpen((open) => !open)}
          >
            <Icon name={mobileMenuOpen ? "close" : "menu"} />
          </button>
          <button className="brand" onClick={goWelcome}>
            <span>O</span>
            <strong>
              OddJobs<em>.com</em>
            </strong>
          </button>
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
                  roleScreens[role].includes("notifications")
                    ? "notifications"
                    : roleHomes[role],
                )
              }
            >
              <Icon name="bell" />
              <i />
            </button>
            <Avatar
              src={auth.getProfileAvatarUrl(auth.profile?.avatarPath)}
              name={auth.profile?.displayName ?? "Current user"}
            />
          </div>
        </header>
        {mobileMenuOpen && (
          <>
            <button
              className="mobile-menu-backdrop"
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside
              className="mobile-drawer"
              id="mobile-navigation"
              aria-label={`${role} workspace navigation`}
            >
              <div className="mobile-drawer-heading">
                <span className="workspace-label">
                  {role === "consumer" ? "Your account" : `${role} workspace`}
                </span>
                <button
                  className="icon-button"
                  aria-label="Close menu"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Icon name="close" />
                </button>
              </div>
              <nav className="mobile-drawer-links" aria-label="Workspace pages">
                {workspaceNavigation.map((item) => (
                  <button
                    key={item.screen}
                    className={screen === item.screen ? "active" : ""}
                    aria-current={screen === item.screen ? "page" : undefined}
                    onPointerEnter={() => preloadPage(item.screen, role)}
                    onPointerDown={() => preloadPage(item.screen, role)}
                    onFocus={() => preloadPage(item.screen, role)}
                    onClick={() => go(item.screen)}
                  >
                    <Icon name={item.icon} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </nav>
              <button
                className="mobile-drawer-language mobile-workspace-change"
                onClick={() => {
                  setMobileMenuOpen(false)
                  goWorkspacePicker()
                }}
              >
                <Icon name="users" />
                <span>Change workspace</span>
                <Icon name="chevron" size={16} />
              </button>
              <button
                className="mobile-drawer-language"
                onClick={() =>
                  updateStore({
                    language: store.language === "EN" ? "SW" : "EN",
                  })
                }
              >
                <Icon name="globe" />
                <span>Language</span>
                <strong>
                  {store.language} / {store.language === "EN" ? "SW" : "EN"}
                </strong>
              </button>
              <button
                className="mobile-drawer-language mobile-sign-out"
                disabled={signingOut}
                onClick={() => void signOutAndReturnToLogin()}
              >
                <Icon name="logout" />
                <span>{signingOut ? "Signing outâ€¦" : "Sign out"}</span>
              </button>
            </aside>
          </>
        )}
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
            {role === "consumer" ? "HIRING WORKSPACE" : role === "provider" ? "WORKER WORKSPACE" : `${role} workspace`}
          </div>
          <nav>
            {workspaceNavigation.map((n) => (
              <button
                key={n.screen}
                className={screen === n.screen || (role === "provider" && screen === "profile" && n.screen === "settings") ? "active" : ""}
                onPointerEnter={() => preloadPage(n.screen, role)}
                onPointerDown={() => preloadPage(n.screen, role)}
                onFocus={() => preloadPage(n.screen, role)}
                onClick={() => go(n.screen)}
              >
                <Icon name={n.icon} />
                <span>{n.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button onClick={goWorkspacePicker}>
              <Icon name="users" />
              <span>Change workspace</span>
            </button>
            <button onClick={() => navigate(role, "settings")}>
              <Icon name="settings" />
              <span>Settings</span>
            </button>
            <button
              disabled={signingOut}
              onClick={() => void signOutAndReturnToLogin()}
            >
              <Icon name="logout" />
              <span>{signingOut ? "Signing outâ€¦" : "Sign out"}</span>
            </button>
            {role === "consumer" && <button className="support-mini" onClick={() => navigate("consumer", "dispute")}>
              <Icon name="message" />
              <div>
                <strong>Need help?</strong>
                <span>Help with a job</span>
              </div>
            </button>}
          </div>
        </aside>
        <main className="main">
          {routeNotice && (
            <div className="content route-access-notice" role="status">
              <p>{routeNotice}</p>
              <button type="button" onClick={() => setRouteNotice("")}>Dismiss</button>
            </div>
          )}
          <Suspense fallback={<div className="page-loading-skeleton" role="status" aria-label="Loading page"><span /><span /><span /></div>}>
            {renderScreen()}
          </Suspense>
        </main>
      </div>
    </DemoContext.Provider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
