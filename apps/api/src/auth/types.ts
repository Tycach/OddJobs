export type AuthenticatedPrincipal = {
  id: string

  email: string | null

  phone: string | null

  displayName: string | null

  accountIntent?: "customer" | "supplier"
}

export type UserProfile = {
  id: string

  displayName: string

  avatarPath?: string | null

  status: string

  roles: string[]
}

export type ProviderApplicationInput = {
  publicName: string

  bio: string

  region: string

  identityDisclosureAccepted?: boolean

  documentType?: "national_id" | "passport"

  documentPath?: string

  skillsEvidence?: string
}

export type ProviderApplication = ProviderApplicationInput & {
  status: string
}

export type ProviderVerificationSummary = {
  status: string
  documentType: string | null
}

export type CustomerVerificationSummary = {
  status: string
  documentType: string | null
  submittedAt: string | null
  reviewReason?: string | null
}

export type MarketplaceJobStatus =
  | "open"
  | "awarded"
  | "in_progress"
  | "completion_pending"
  | "revision_requested"
  | "completed"
  | "cancelled"
  | "disputed"
  | "expired"

export type MarketplaceQuoteStatus =
  | "submitted"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "expired"

export type MarketplaceJob = {
  id: string
  jobReference: string
  customerId: string
  title: string
  description: string
  category: string
  locationLabel: string
  budgetMinor: number | null
  currency: string
  status: MarketplaceJobStatus
  requestedFor: string | null
  applicationDeadlineAt?: string | null
  dueAt?: string | null
  locationMode?: "onsite" | "remote" | "flexible"
  locationLatitude?: number | null
  locationLongitude?: number | null
  completionNote?: string | null
  revisionNote?: string | null
  media?: ServiceListingMedia[]
  createdAt: string
  updatedAt: string
  quoteCount: number
}

export type ServiceListingStatus = "open" | "claimed" | "in_progress" | "completion_pending" | "completed" | "cancelled"

export type ServiceListingMedia = {
  path: string
  contentType: string
  size: number
}

export type ServiceListing = {
  id: string
  jobReference: string
  providerId: string
  providerName: string
  customerId: string | null
  customerName: string | null
  title: string
  description: string
  category: string
  locationLabel: string
  budgetMinor: number | null
  currency: string
  status: ServiceListingStatus
  media: ServiceListingMedia[]
  claimExpiresAt: string | null
  createdAt: string
  updatedAt: string
  activity?: { actorName: string; action: string; requestId: string; createdAt: string }[]
}

export type ServiceListingReview = {
  id: string
  listingId: string
  listingTitle: string
  reviewerName: string
  revieweeName: string
  rating: number
  comment: string
  createdAt: string
}

export type ReviewableServiceListing = {
  listingId: string
  listingTitle: string
  revieweeName: string
}

export type ServiceListingReviewPage = {
  received: ServiceListingReview[]
  pending: ReviewableServiceListing[]
}

export type ServiceListingMessage = {
  id: string
  listingId: string
  senderId: string
  senderName: string
  body: string
  createdAt: string
}

export type AdminServiceListingMessage = ServiceListingMessage & {
  jobReference: string
  listingTitle: string
  providerName: string
  customerName: string
}

export type CreateServiceListingInput = Omit<ServiceListing, "id" | "jobReference" | "providerId" | "providerName" | "customerId" | "customerName" | "status" | "claimExpiresAt" | "createdAt" | "updatedAt" | "currency" | "activity" | "media"> & { media?: ServiceListingMedia[] }

export type MarketplaceQuote = {
  id: string
  jobId: string
  providerId: string
  providerName: string
  amountMinor: number
  currency: string
  message: string
  availability: string
  status: MarketplaceQuoteStatus
  createdAt: string
  updatedAt: string
}

export type MarketplaceProviderQuote = MarketplaceQuote & {
  jobReference: string
  jobTitle: string
  jobCategory: string
  jobLocationLabel: string
  jobStatus: string
}

export type MarketplaceProvider = {
  id: string
  userId: string
  publicName: string
  bio: string
  region: string
  avatarPath?: string | null
}

export type UpdateMarketplaceProviderProfileInput = {
  publicName: string
  bio: string
  region: string
}

export type MarketplaceNotification = {
  id: string
  type: string
  title: string
  body: string
  jobId: string | null
  readAt: string | null
  createdAt: string
}

export type AdminMarketplaceJob = MarketplaceJob & {
  customerDisplayName: string
  quotes: MarketplaceQuote[]
  timeline: AdminMarketplaceActivity[]
}

export type AdminMarketplaceJobFilters = {
  status: "all" | MarketplaceJobStatus
  search: string
  from: string | null
  to: string | null
}

export type AdminMarketplaceActivity = {
  id: string
  actorUserId: string
  actorDisplayName: string
  actorRole: "consumer" | "provider" | "admin"
  action: string
  jobId: string
  quoteId: string | null
  metadata: Record<string, string | number | boolean | null>
  requestId: string
  createdAt: string
}

export type CreateMarketplaceJobInput = {
  title: string
  description: string
  category: string
  locationLabel: string
  budgetMinor: number | null
  requestedFor?: string | null
  applicationDeadlineAt?: string | null
  dueAt?: string | null
  locationMode?: "onsite" | "remote" | "flexible"
  locationLatitude?: number | null
  locationLongitude?: number | null
  media?: ServiceListingMedia[]
}

export type SubmitMarketplaceQuoteInput = {
  amountMinor: number
  message: string
  availability: string
}

export type JobConversation = {
  id: string
  jobId: string
  jobReference: string
  jobTitle: string
  jobStatus: MarketplaceJob["status"]
  customerId: string
  customerName: string
  providerId: string
  providerName: string
  quoteId: string | null
  latestMessage: string | null
  latestMessageAt: string | null
  unreadCount: number
  updatedAt: string
}

export type JobConversationMessage = {
  id: string
  conversationId: string
  jobId: string
  senderId: string
  senderName: string
  senderRole: "consumer" | "provider"
  body: string
  readAt: string | null
  createdAt: string
}

export class MarketplaceConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MarketplaceConflictError"
  }
}

export interface MarketplaceStore {
  listJobConversations?(userId: string, role: "consumer" | "provider"): Promise<JobConversation[]>
  openJobConversation?(userId: string, role: "consumer" | "provider", jobId: string, providerId?: string): Promise<JobConversation | null>
  listJobConversationMessages?(userId: string, conversationId: string): Promise<JobConversationMessage[] | null>
  createJobConversationMessage?(userId: string, conversationId: string, body: string, requestId: string): Promise<JobConversationMessage | null>
  listServiceListings?(userId: string, role: "consumer" | "provider", view: "feed" | "mine"): Promise<ServiceListing[]>
  createServiceListing?(userId: string, input: CreateServiceListingInput, requestId: string): Promise<ServiceListing>
  claimServiceListing?(userId: string, listingId: string, requestId: string): Promise<ServiceListing | null>
  transitionServiceListing?(userId: string, listingId: string, transition: "start" | "submit_completion" | "confirm_completion" | "cancel" | "close", requestId: string): Promise<ServiceListing | null>
  listServiceListingMessages?(userId: string, role: "consumer" | "provider", listingId: string): Promise<ServiceListingMessage[] | null>
  createServiceListingMessage?(userId: string, role: "consumer" | "provider", listingId: string, body: string): Promise<ServiceListingMessage | null>
  listServiceListingReviews?(userId: string, role: "consumer" | "provider"): Promise<ServiceListingReviewPage>
  listPublicProviderReviews?(providerId: string): Promise<ServiceListingReview[]>
  createServiceListingReview?(userId: string, listingId: string, rating: number, comment: string, requestId: string): Promise<ServiceListingReview>
  listAdminServiceListings?(query: string, limit: number, offset: number): Promise<AdminPage<ServiceListing>>
  releaseAdminServiceListing?(adminUserId: string, listingId: string, reason: string, requestId: string): Promise<ServiceListing | null>

  listProviders?(input: {
    search: string
    region: string
    limit: number
    offset: number
  }): Promise<AdminPage<MarketplaceProvider>>

  getProvider?(providerId: string, requesterUserId?: string, quoteJobId?: string): Promise<MarketplaceProvider | null>

  updateProviderProfile?(userId: string, input: UpdateMarketplaceProviderProfileInput): Promise<MarketplaceProvider | null>

  listSavedProviders?(customerId: string): Promise<MarketplaceProvider[]>

  saveProvider?(customerId: string, providerId: string): Promise<boolean>

  removeSavedProvider?(customerId: string, providerId: string): Promise<void>

  listNotifications?(userId: string, limit: number, offset: number): Promise<AdminPage<MarketplaceNotification>>

  markNotificationRead?(userId: string, notificationId: string): Promise<boolean>

  listJobs(
    userId: string,
    role: "consumer" | "provider",
    view: "mine" | "feed",
  ): Promise<MarketplaceJob[]>

  getJob(
    userId: string,
    role: "consumer" | "provider",
    jobId: string,
  ): Promise<MarketplaceJob | null>

  listQuotes(
    userId: string,
    role: "consumer" | "provider",
    jobId: string,
  ): Promise<MarketplaceQuote[] | null>

  listProviderQuotes?(userId: string): Promise<MarketplaceProviderQuote[]>

  createJob(
    userId: string,
    input: CreateMarketplaceJobInput,
    requestId: string,
  ): Promise<MarketplaceJob>

  submitQuote(
    userId: string,
    jobId: string,
    input: SubmitMarketplaceQuoteInput,
    requestId: string,
  ): Promise<MarketplaceQuote | null>

  acceptQuote(
    userId: string,
    jobId: string,
    quoteId: string,
    requestId: string,
  ): Promise<MarketplaceJob | null>

  transitionJob(
    userId: string,
    jobId: string,
    transition: "start" | "submit_completion" | "confirm_completion" | "request_revision" | "cancel",
    requestId: string,
    details?: { note: string },
  ): Promise<MarketplaceJob | null>
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

  documentType?: string | null

  skillsEvidence?: string | null
}

export type AdminCustomerVerificationSummary = {
  id: string
  userId: string
  displayName: string
  status: string
  submittedAt: string
  documentType: string
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

  jobReference: string | null

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

  getAdminVerificationDocument?(profileId: string): Promise<string | null>

  decideAdminVerification(input: {
    actorUserId: string

    profileId: string

    decision: AdminVerificationDecision

    reason: string | null

    requestId: string
  }): Promise<AdminVerificationSummary | null>

  listAdminCustomerVerifications?(status: AdminVerificationStatus, limit: number, offset: number): Promise<AdminPage<AdminCustomerVerificationSummary>>

  getAdminCustomerVerificationDocument?(verificationId: string): Promise<string | null>

  decideAdminCustomerVerification?(input: { actorUserId: string; verificationId: string; decision: AdminVerificationDecision; reason: string | null; requestId: string }): Promise<AdminCustomerVerificationSummary | null>

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
    search?: string,
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

  listAdminMarketplaceActivity(
    limit: number,
    offset: number,
  ): Promise<AdminPage<AdminMarketplaceActivity>>

  listAdminServiceListingMessages?(limit: number, offset: number, search?: string): Promise<AdminPage<AdminServiceListingMessage>>

  listAdminMarketplaceJobs?(input: {
    filters: AdminMarketplaceJobFilters
    limit: number
    offset: number
  }): Promise<AdminPage<AdminMarketplaceJob>>

  getAdminMarketplaceJob?(jobId: string): Promise<AdminMarketplaceJob | null>

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

  updateProfile?(userId: string, displayName: string, avatarPath?: string): Promise<UserProfile | null>

  canSaveProfileAvatar?(): Promise<boolean>

  recordPolicyConsents(
    userId: string,

    termsVersion: string,

    privacyVersion: string,
  ): Promise<void>

  submitProviderApplication(
    userId: string,

    application: ProviderApplicationInput,
  ): Promise<ProviderApplication>

  getProviderVerification?(userId: string): Promise<ProviderVerificationSummary | null>
  getCustomerVerification?(userId: string): Promise<CustomerVerificationSummary | null>
  submitCustomerVerification?(userId: string, documentType: "national_id" | "passport", documentPath: string): Promise<CustomerVerificationSummary>
}
