export type AuthenticatedPrincipal = {
  id: string

  email: string | null

  phone: string | null

  displayName: string | null
}

export type UserProfile = {
  id: string

  displayName: string

  status: string

  roles: string[]
}

export type ProviderApplicationInput = {
  publicName: string

  bio: string

  region: string
}

export type ProviderApplication = ProviderApplicationInput & {
  status: string
}

export type AdminUserSummary = {
  id: string

  displayName: string

  status: string

  roles: string[]

  createdAt: string
}

export type AdminAuditEvent = {
  id: string

  actorUserId: string

  action: string

  targetType: string | null

  targetId: string | null

  metadata: Record<string, string | number | boolean | null>

  requestId: string

  createdAt: string
}

export type AdminPage<T,> = {
  items: T[]

  total: number

  limit: number

  offset: number
}

export type AdminOverview = {
  totalUsers: number

  activeProviders: number

  pendingVerifications: number

  openJobs: number

  completedJobs: number

  disputedJobs: number
}

export type AdminVerificationSummary = {
  id: string

  userId: string

  displayName: string

  publicName: string

  region: string | null

  status: string

  submittedAt: string
}

export type AdminVerificationStatus = "all" | "not_started" | "in_review" | "verified" | "rejected"

export type AdminVerificationDecision = "verified" | "rejected"

export type AdminModerationStatus = "all" | "open" | "reviewing" | "resolved" | "dismissed"

export type AdminModerationDecision = "reviewing" | "resolved" | "dismissed"

export class ModerationEnforcementError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ModerationEnforcementError"
  }
}

export type AdminSystemSettings = {
  marketplaceCommissionPercent: number
  newProviderApplicationsEnabled: boolean
  adsEnabled: boolean
}

export type AdminCategory = {
  id: string
  name: string
  slug: string
  active: boolean
  sortOrder: number
}

export type AdminAdCampaign = {
  id: string
  advertiserName: string
  title: string
  description: string
  placement: string
  destinationUrl: string | null
  status: "pending" | "approved" | "rejected"
  decisionReason: string | null
  createdAt: string
}

export type AdminModerationReport = {
  id: string

  reporterUserId: string

  subjectType: string

  subjectId: string

  reason: string

  details: string

  status: string

  createdAt: string

  updatedAt: string
}

export type AdminMonitoringSnapshot = {
  checkedAt: string

  uptimeSeconds: number

  heapUsedBytes: number

  heapLimitBytes: number

  database: "ok" | "unavailable"

  pendingVerifications: number

  openReports: number

  alerts: {
    severity: "critical" | "warning"

    code: string

    message: string
  }[]
}

export interface AdminStore {
  getAdminOverview(): Promise<AdminOverview>

  listAdminUsers(
    limit: number,
    offset: number,
  ): Promise<AdminPage<AdminUserSummary>>

  listAdminVerifications(
    status: AdminVerificationStatus,

    limit: number,

    offset: number,
  ): Promise<AdminPage<AdminVerificationSummary>>

  decideAdminVerification(input: {
    actorUserId: string

    profileId: string

    decision: AdminVerificationDecision

    reason: string | null

    requestId: string
  }): Promise<AdminVerificationSummary | null>

  createModerationReport(input: {
    reporterUserId: string

    subjectType: string

    subjectId: string

    reason: string

    details: string
  }): Promise<AdminModerationReport>

  listAdminModerationReports(
    status: AdminModerationStatus,

    limit: number,

    offset: number,
  ): Promise<AdminPage<AdminModerationReport>>

  decideAdminModerationReport(input: {
    actorUserId: string

    reportId: string

    decision: AdminModerationDecision

    enforcement: "none" | "suspend_account"

    reason: string | null

    requestId: string
  }): Promise<AdminModerationReport | null>

  reinstateAdminSuspendedUser(input: {
    actorUserId: string
    userId: string
    requestId: string
  }): Promise<boolean>

  listAdminCategories(): Promise<AdminCategory[]>

  saveAdminCategory(input: {
    actorUserId: string
    category: { name: string; slug: string; active: boolean; sortOrder: number }
    requestId: string
  }): Promise<AdminCategory>

  getAdminSettings(): Promise<AdminSystemSettings>

  saveAdminSettings(input: {
    actorUserId: string
    settings: AdminSystemSettings
    requestId: string
  }): Promise<AdminSystemSettings>

  listAdminAdCampaigns(status: "all" | "pending" | "approved" | "rejected"): Promise<AdminAdCampaign[]>

  createAdCampaign(input: {
    advertiserId: string
    advertiserName: string
    title: string
    description: string
    placement: string
    destinationUrl: string | null
  }): Promise<AdminAdCampaign>

  decideAdminAdCampaign(input: {
    actorUserId: string
    campaignId: string
    decision: "approved" | "rejected"
    reason: string | null
    requestId: string
  }): Promise<AdminAdCampaign | null>

  recordAdminMonitoringSnapshot(input: {
    database: "ok" | "unavailable"
    pendingVerifications: number
    openReports: number
    heapUsedBytes: number
    heapLimitBytes: number
    alerts: AdminMonitoringSnapshot["alerts"]
  }): Promise<void>

  listAdminMonitoringHistory(limit: number): Promise<AdminMonitoringSnapshot[]>

  getAdminMonitoringSnapshot(): Promise<{
    pendingVerifications: number

    openReports: number
  }>

  listAdminAuditEvents(
    limit: number,

    offset: number,
  ): Promise<AdminPage<AdminAuditEvent>>

  recordAdminAuditEvent(
    event: Omit<AdminAuditEvent, "id" | "createdAt">,
  ): Promise<void>
}

export interface AccessTokenVerifier {
  verify(accessToken: string): Promise<AuthenticatedPrincipal | null>
}

export interface UserProfileStore {
  bootstrapProfile(principal: AuthenticatedPrincipal): Promise<UserProfile>

  getProfile(userId: string): Promise<UserProfile | null>

  recordPolicyConsents(
    userId: string,

    termsVersion: string,

    privacyVersion: string,
  ): Promise<void>

  submitProviderApplication(
    userId: string,

    application: ProviderApplicationInput,
  ): Promise<ProviderApplication>
}
