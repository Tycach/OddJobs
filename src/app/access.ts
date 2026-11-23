import type { Role, Screen } from "../demo/model"

export type WorkspaceRoute = {
  role: Role
  screen: Screen
}

export const workspaceRoles: readonly Role[] = [
  "consumer", "provider", "admin", "support", "partner",
]

export const prototypePreviewScreens: readonly Screen[] = [
  "home", "map", "settings", "checkout", "track",
  "chat", "review", "dispute", "history", "saved", "providerHome",
  "onboarding",
  "wallet", "reputation", "training", "plans", "analytics",
  "ads", "disputes", "inbox", "knowledgeBase", "programmes", "impact", "builder",
]

export const roleHomes: Record<Role, Screen> = {
  consumer: "home",
  provider: "feed",
  admin: "overview",
  support: "disputes",
  partner: "programmes",
}

export const workspaceLabels: Record<Role, string> = {
  consumer: "Hire a worker",
  provider: "Find work",
  admin: "Admin workspace",
  support: "Support workspace",
  partner: "Partner workspace",
}

export const roleScreens: Record<Role, readonly Screen[]> = {
  consumer: [
    "workspace", "login", "providerApply", "identityVerification", "home", "workFeed", "post", "jobs", "bids", "profile", "chat",
    "dispute", "history", "saved", "training", "analytics", "hiringAnalytics", "hiringGuide", "notifications", "settings",
  ],
  provider: [
    "login", "providerHome", "providerVerification", "profile", "feed", "jobDetail", "providerBids",
    "management", "wallet", "reputation",
    "notifications", "chat", "settings",
  ],
  admin: [
    "login", "overview", "users", "verification", "categories", "moderation",
    "adApprovals", "audit", "operations", "config", "monitoring", "messages", "settings",
  ],
  support: ["login", "disputes", "inbox", "knowledgeBase", "settings"],
  partner: ["login", "programmes", "impact", "builder", "settings"],
}

export const navigation: Record<Role, { label: string; icon: string; screen: Screen }[]> = {
  consumer: [
    { label: "Dashboard", icon: "grid", screen: "home" },
    { label: "Find workers", icon: "search", screen: "workFeed" },
    { label: "Saved workers", icon: "star", screen: "saved" },
    { label: "Post a job", icon: "plus", screen: "post" },
    { label: "My jobs", icon: "briefcase", screen: "jobs" },
    { label: "Hiring guide", icon: "book", screen: "training" },
    { label: "Analytics", icon: "chart", screen: "hiringAnalytics" },
    { label: "Messages", icon: "message", screen: "chat" },
    { label: "Help & disputes", icon: "shield", screen: "dispute" },
    { label: "Job history", icon: "chart", screen: "history" },
    { label: "Notifications", icon: "bell", screen: "notifications" },
    { label: "Settings", icon: "settings", screen: "settings" },
  ],
  provider: [
    { label: "Find jobs", icon: "search", screen: "feed" },
    { label: "Dashboard", icon: "grid", screen: "providerHome" },
    { label: "ID verification", icon: "shield", screen: "providerVerification" },
    { label: "My proposals", icon: "briefcase", screen: "providerBids" },
    { label: "My work", icon: "briefcase", screen: "management" },
    { label: "Wallet", icon: "wallet", screen: "wallet" },
    { label: "Reviews", icon: "star", screen: "reputation" },
    { label: "Notifications", icon: "bell", screen: "notifications" },
    { label: "Messages", icon: "message", screen: "chat" },
    { label: "Settings", icon: "settings", screen: "settings" },
  ],
  admin: [
    { label: "Overview", icon: "grid", screen: "overview" },
    { label: "Monitoring", icon: "chart", screen: "monitoring" },
    { label: "Users & roles", icon: "users", screen: "users" },
    { label: "Verification", icon: "shield", screen: "verification" },
    { label: "Categories & fees", icon: "settings", screen: "categories" },
    { label: "Moderation", icon: "flag", screen: "moderation" },
    { label: "Ad approvals", icon: "megaphone", screen: "adApprovals" },
    { label: "Audit log", icon: "chart", screen: "audit" },
    { label: "Marketplace operations", icon: "briefcase", screen: "operations" },
    { label: "Messages", icon: "message", screen: "messages" },
    { label: "Settings", icon: "settings", screen: "settings" },
    { label: "System config", icon: "settings", screen: "config" },
  ],
  support: [
    { label: "Disputes", icon: "shield", screen: "disputes" },
    { label: "Support inbox", icon: "message", screen: "inbox" },
    { label: "Knowledge base", icon: "book", screen: "knowledgeBase" },
    { label: "Settings", icon: "settings", screen: "settings" },
  ],
  partner: [
    { label: "Programmes", icon: "briefcase", screen: "programmes" },
    { label: "Impact reports", icon: "chart", screen: "impact" },
    { label: "Landing pages", icon: "layout", screen: "builder" },
    { label: "Settings", icon: "settings", screen: "settings" },
  ],
}

export function getWorkspaceRoute(pathname: string): WorkspaceRoute {
  const [, roleSegment, screenSegment] = pathname.split("/")
  const role = workspaceRoles.find((candidate) => candidate === roleSegment)

  if (!role) {
    if (pathname === "/login") return { role: "consumer", screen: "login" }
    return { role: "consumer", screen: "welcome" }
  }
  if (screenSegment === "workspace") return { role, screen: "workspace" }
  const screen = roleScreens[role].find((candidate) => candidate === screenSegment)
  return { role, screen: screen ?? roleHomes[role] }
}

export function getAuthenticatedRoute(
  pathname: string,
  authenticatedRoles: Role[],
): WorkspaceRoute {
  const requested = getWorkspaceRoute(pathname)
  const isPublicScreen = ["welcome", "workspace", "login"].includes(requested.screen)

  if (authenticatedRoles.length === 0) {
    return isPublicScreen
      ? requested
      : { role: requested.role, screen: "login" }
  }

  if (!authenticatedRoles.includes(requested.role)) {
    // Keep a workspace-specific login page open so it can explain the role mismatch.
    // Do not silently sign a customer into the provider (or other) dashboard.
    if (requested.screen === "login") return requested
    const defaultRole = authenticatedRoles[0] ?? "consumer"
    return { role: defaultRole, screen: roleHomes[defaultRole] }
  }

  if (requested.screen === "workspace") return requested
  if (isPublicScreen) return { role: requested.role, screen: roleHomes[requested.role] }
  return requested
}

export function workspacePath({ role, screen }: WorkspaceRoute) {
  return screen === "welcome" ? "/" : `/${role}/${screen}`
}
