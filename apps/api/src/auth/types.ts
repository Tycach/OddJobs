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
  shareExactLocationWithProvider?: boolean
  distanceKm?: number | null
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

export type JobPaymentMethod = "cash" | "manual_transfer"
export type JobPaymentStatus = "awaiting_payment" | "reported" | "paid" | "disputed" | "refunded"
export type PlatformFeeStatus = "due" | "reported" | "received" | "disputed"
export type JobPaymentRecord = {
  id: string
  paymentReference: string
  jobId: string
  jobReference: string
  jobTitle: string
  jobStatus: string
  quoteId: string
  customerId: string
  customerName: string
  providerId: string
  providerName: string
  grossAmountMinor: number
  commissionBasisPoints: number
  commissionAmountMinor: number
  providerAmountMinor: number
  currency: string
  method: JobPaymentMethod | null
  status: JobPaymentStatus
  reportedByUserId: string | null
  reportedAt: string | null
  confirmedByUserId: string | null
  confirmedAt: string | null
  platformFeeStatus: PlatformFeeStatus
  platformFeeReportedByUserId: string | null
  platformFeeReportedAt: string | null
  platformFeeDueAt: string | null
  platformFeePaymentReference: string | null
  platformFeeReceivedAt: string | null
  platformFeeReceiptReference: string | null
  disputeReason: string | null
  resolutionNote: string | null
  resolvedAt: string | null
  payoutHoldAt?: string | null
  payoutHoldReason?: string | null
  commissionOverdue?: boolean
  customerCommissionRestricted?: boolean
  customerRestrictionReason?: string | null
  createdAt: string
  updatedAt: string
}

export type ProviderWalletPayment = {
  id: string
  paymentReference: string
  jobId: string
  jobReference: string
  jobTitle: string
  customerName: string
  earningsMinor: number
  currency: string
  method: JobPaymentMethod | null
  status: JobPaymentStatus
  reportedByUserId: string | null
  reportedAt: string | null
  confirmedAt: string | null
  disputeReason: string | null
  createdAt: string
  updatedAt: string
}

export type AdminJobPaymentPage = AdminPage<JobPaymentRecord> & {
  summary: { paidGrossMinor: number; commissionMinor: number; providerNetMinor: number; commissionDueMinor: number; disputedCount: number }
  workers: Array<{ providerId: string; providerName: string; paidJobs: number; grossMinor: number; commissionMinor: number; netMinor: number; payoutHeld: boolean }>
}

export type MarketplaceProvider = {
  id: string
  userId: string
  publicName: string
  bio: string
  region: string
  serviceLatitude?: number | null
  serviceLongitude?: number | null
  maxTravelDistanceKm?: number
  avatarPath?: string | null
}

export type UpdateMarketplaceProviderProfileInput = {
  publicName: string
  bio: string
  region: string
  serviceLatitude?: number | null
  serviceLongitude?: number | null
  maxTravelDistanceKm?: number
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
  shareExactLocationWithProvider?: boolean
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

export type SupportCaseStatus = "open" | "in_progress" | "waiting_on_user" | "resolved"
export type SupportCategory = "general" | "payment" | "work_review" | "safety" | "account" | "other"
export type SupportCaseSummary = {
  id: string; caseReference: string; jobId: string; jobReference: string; jobTitle: string
  requesterId: string; requesterName: string; requesterRole: "consumer" | "provider"
  category: SupportCategory; subject: string; status: SupportCaseStatus
  latestMessage: string; updatedAt: string; createdAt: string
}
export type SupportCaseMessage = {
  id: string; caseId: string; senderId: string; senderName: string
  senderRole: "consumer" | "provider" | "admin" | "support"; body: string; createdAt: string
}
export type CreateSupportCaseInput = {
  jobReference: string; category: SupportCategory; subject: string; body: string
}

export class MarketplaceConflictError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MarketplaceConflictError"
  }
}

export interface MarketplaceStore {
  hasActiveCommissionRestriction?(userId: string): Promise<boolean>
  listActiveServiceCategories?(): Promise<Array<{ name: string; slug: string }>>
  listMyJobPayments?(userId: string, role: "consumer" | "provider"): Promise<JobPaymentRecord[]>
  reportJobPayment?(userId: string, jobId: string, method: JobPaymentMethod, requestId: string): Promise<JobPaymentRecord | null>
  reportPlatformFee?(userId: string, jobId: string, paymentReference: string, requestId: string): Promise<JobPaymentRecord | null>
  confirmJobPayment?(userId: string, jobId: string, requestId: string): Promise<JobPaymentRecord | null>
  disputeJobPayment?(userId: string, jobId: string, reason: string, requestId: string): Promise<JobPaymentRecord | null>
  listJobConversations?(userId: string, role: "consumer" | "provider"): Promise<JobConversation[]>
  openJobConversation?(userId: string, role: "consumer" | "provider", jobId: string, providerId?: string): Promise<JobConversation | null>
  listJobConversationMessages?(userId: string, conversationId: string): Promise<JobConversationMessage[] | null>
  createJobConversationMessage?(userId: string, conversationId: string, body: string, requestId: string): Promise<JobConversationMessage | null>
  listSupportCases?(userId: string, role: "consumer" | "provider"): Promise<SupportCaseSummary[]>
  createSupportCase?(userId: string, role: "consumer" | "provider", input: CreateSupportCaseInput, requestId: string): Promise<SupportCaseSummary | null>
  listSupportCaseMessages?(userId: string, role: "consumer" | "provider", caseId: string): Promise<SupportCaseMessage[] | null>
  createSupportCaseMessage?(userId: string, role: "consumer" | "provider", caseId: string, body: string, requestId: string): Promise<SupportCaseMessage | null>
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

  commissionRestricted: boolean

  commissionRestrictionReason: string | null

  overdueCommissionCount: number

  overdueCommissionMinor: number

  createdAt: string
}

export type AdminAuditEvent = {
  id: string

  actorUserId: string

  actorDisplayName?: string | null

  action: string

  targetType: string | null

  targetId: string | null

  metadata: Record<string, string | number | boolean | null>

  requestId: string

  createdAt: string
}

export type AdminAuditFilters = {
  search: string
  action: string
  from: string
  to: string
}

export type AdminMemberRole = "OWNER" | "ADMIN" | "OPERATIONS_ADMIN" | "VERIFICATION_REVIEWER" | "MODERATION_REVIEWER" | "SUPPORT_AGENT" | "FINANCE_REVIEWER" | "ANALYST"

export type AdminMemberSummary = {
  userId: string
  displayName: string
  role: AdminMemberRole
  legacyOwner: boolean
  joinedAt: string
}

export type AdminInvitationSummary = {
  id: string
  email: string
  role: AdminMemberRole
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"
  invitedByName: string
  createdAt: string
  expiresAt: string
}

export type AdminTeamSummary = {
  members: AdminMemberSummary[]
  invitations: AdminInvitationSummary[]
}

export type AdminAlertSummary = {
  id: string
  code: string
  severity: "critical" | "warning"
  message: string
  status: "open" | "acknowledged" | "resolved"
  firstSeenAt: string
  lastSeenAt: string
  acknowledgedAt: string | null
  assignedAdminId: string | null
  assignedAdminName: string | null
  resolvedAt: string | null
  resolutionNote: string | null
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

export type AdminAnalyticsFilters = {
  from: string
  to: string
  category: string
  status: "all" | "open" | "hired" | "completed" | "cancelled" | "disputed"
}

export type AdminAnalyticsReport = {
  currency: string
  categories: string[]
  current: {
    jobsPosted: number
    jobsWithProposals: number
    hiredJobs: number
    completedJobs: number
    agreedGrossMinor: number
    expectedCommissionMinor: number
    reportedCommissionMinor: number
    verifiedCommissionMinor: number
    overdueCommissionMinor: number
    overdueCommissionCount: number
  }
  previous: {
    jobsPosted: number
    hiredJobs: number
    completedJobs: number
    agreedGrossMinor: number
    verifiedCommissionMinor: number
  }
  series: { date: string; jobsPosted: number; hiredJobs: number; completedJobs: number; agreedGrossMinor: number; verifiedCommissionMinor: number }[]
  jobs: { reference: string; title: string; category: string; status: string; proposals: number; createdAt: string }[]
  commissions: { reference: string; title: string; customer: string; provider: string; feeMinor: number; status: string; dueAt: string | null; updatedAt: string }[]
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
  totalJobs: number
  openJobs: number
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

  databaseLatencyMs?: number

  pendingVerifications: number

  pendingCustomerVerifications?: number

  openReports: number

  openSupportCases?: number

  overdueCommissionCount?: number

  overdueCommissionMinor?: number

  alerts: {
    severity: "critical" | "warning"

    code: string

    message: string
  }[]
}

export interface AdminStore {
  getAdminMemberRole?(userId: string): Promise<AdminMemberRole | null>
  listAdminTeam?(): Promise<AdminTeamSummary>
  createAdminInvitation?(input: { id: string; email: string; role: AdminMemberRole; tokenHash: string; invitedBy: string; expiresAt: Date }): Promise<AdminInvitationSummary>
  revokeAdminInvitation?(invitationId: string, actorUserId: string): Promise<boolean>
  setAdminMemberRole?(input: { userId: string; role: AdminMemberRole; actorUserId: string }): Promise<boolean>
  removeAdminMember?(input: { userId: string; actorUserId: string }): Promise<boolean>
  acceptAdminInvitation?(input: { invitationId: string; email: string; tokenHash: string; userId: string; displayName: string }): Promise<AdminMemberRole | null>
  listAdminAlerts?(limit: number): Promise<AdminAlertSummary[]>
  syncAdminAlerts?(alerts: AdminMonitoringSnapshot["alerts"]): Promise<void>
  updateAdminAlert?(input: { actorUserId: string; alertId: string; action: "acknowledge" | "assign" | "resolve"; assignedAdminId?: string | null; reason?: string }): Promise<AdminAlertSummary | null>
  listAdminSupportCases?(search: string, status: SupportCaseStatus | "all", limit: number, offset: number): Promise<AdminPage<SupportCaseSummary>>
  listAdminSupportCaseMessages?(caseId: string): Promise<SupportCaseMessage[] | null>
  createAdminSupportCaseMessage?(adminUserId: string, caseId: string, body: string, requestId: string): Promise<SupportCaseMessage | null>
  setAdminSupportCaseStatus?(adminUserId: string, caseId: string, status: SupportCaseStatus, requestId: string): Promise<SupportCaseSummary | null>
  listAdminJobPayments?(search: string, status: JobPaymentStatus | "all", limit: number, offset: number): Promise<AdminJobPaymentPage>
  setAdminCommissionRestriction?(input: { actorUserId: string; userId: string; restricted: boolean; reason: string; requestId: string }): Promise<{ restricted: boolean; reason: string | null } | null>
  resolveAdminJobPayment?(input: { actorUserId: string; paymentId: string; resolution: "paid" | "refunded"; reason: string; requestId: string }): Promise<JobPaymentRecord | null>
  setAdminProviderPayoutHold?(input: { actorUserId: string; providerId: string; held: boolean; reason: string; requestId: string }): Promise<boolean>
  recordAdminPlatformFeeReceipt?(input: { actorUserId: string; paymentId: string; receiptReference: string; requestId: string }): Promise<JobPaymentRecord | null>
  getAdminOverview(): Promise<AdminOverview>
  getAdminAnalytics(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsReport>

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
    pendingCustomerVerifications: number
    openReports: number
    openSupportCases: number
    overdueCommissionCount: number
    overdueCommissionMinor: number
  }>

  listAdminAuditEvents(limit: number, offset: number, filters?: AdminAuditFilters): Promise<AdminPage<AdminAuditEvent>>

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
