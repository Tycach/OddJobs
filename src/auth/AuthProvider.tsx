import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js"

import { POLICY_VERSIONS } from "./TermsDialog"

export type AuthMethod = "phone" | "email"

export type OAuthProvider = "apple" | "google"

export type ProviderApplication = {
  publicName: string

  bio: string

  region: string

  documentType: "national_id" | "passport"

  documentPath?: string | null

  skillsEvidence: string

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

export type AuthProfile = {
  id: string

  displayName: string

  avatarPath?: string | null

  status: string

  roles: string[]
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
export type ServiceListingMessage = { id: string; listingId: string; senderId: string; senderName: string; body: string; createdAt: string }
export type AdminServiceListingMessage = ServiceListingMessage & { jobReference: string; listingTitle: string; providerName: string; customerName: string }
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
export type ReviewableServiceListing = { listingId: string; listingTitle: string; revieweeName: string }
export type ServiceListingReviewPage = { received: ServiceListingReview[]; pending: ReviewableServiceListing[] }
export type ServiceListingInput = Pick<ServiceListing, "title" | "description" | "category" | "locationLabel" | "budgetMinor"> & { media?: ServiceListingMedia[] }

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

export type MarketplaceConversation = {
  id: string
  jobId: string
  jobReference: string
  jobTitle: string
  jobStatus: MarketplaceJobStatus
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

export type MarketplaceConversationMessage = {
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
export type SupportCase = {
  id: string; caseReference: string; jobId: string; jobReference: string; jobTitle: string
  requesterId: string; requesterName: string; requesterRole: "consumer" | "provider"
  category: SupportCategory; subject: string; status: SupportCaseStatus
  latestMessage: string; updatedAt: string; createdAt: string
}
export type SupportCaseMessage = {
  id: string; caseId: string; senderId: string; senderName: string
  senderRole: "consumer" | "provider" | "admin" | "support"; body: string; createdAt: string
}
export type CreateSupportCaseInput = { jobReference: string; category: SupportCategory; subject: string; body: string }

export type MarketplaceProviderQuote = MarketplaceQuote & {
  jobReference: string
  jobTitle: string
  jobCategory: string
  jobLocationLabel: string
  jobStatus: string
}

export type JobPaymentMethod = "cash" | "manual_transfer"
export type JobPaymentStatus = "awaiting_payment" | "reported" | "paid" | "disputed" | "refunded"
export type JobPaymentRecord = {
  id: string; paymentReference: string; jobId: string; jobReference: string; jobTitle: string; jobStatus: string; quoteId: string
  customerId: string; customerName: string; providerId: string; providerName: string
  grossAmountMinor: number; commissionBasisPoints: number; commissionAmountMinor: number; providerAmountMinor: number
  currency: string; method: JobPaymentMethod | null; status: JobPaymentStatus
  reportedByUserId: string | null; reportedAt: string | null; confirmedByUserId: string | null; confirmedAt: string | null
  platformFeeStatus: "due" | "reported" | "received" | "disputed"
  platformFeeReportedByUserId: string | null; platformFeeReportedAt: string | null; platformFeeDueAt: string | null; platformFeePaymentReference: string | null
  platformFeeReceivedAt: string | null; platformFeeReceiptReference: string | null
  disputeReason: string | null; resolutionNote: string | null; resolvedAt: string | null
  payoutHoldAt?: string | null; payoutHoldReason?: string | null; createdAt: string; updatedAt: string
  commissionOverdue?: boolean; customerCommissionRestricted?: boolean; customerRestrictionReason?: string | null
}
export type AdminJobPaymentPage = AdminPage<JobPaymentRecord> & {
  summary: { paidGrossMinor: number; commissionMinor: number; providerNetMinor: number; commissionDueMinor: number; disputedCount: number }
  workers: Array<{ providerId: string; providerName: string; paidJobs: number; grossMinor: number; commissionMinor: number; netMinor: number; payoutHeld: boolean }>
}
export type ProviderWalletPayment = Pick<JobPaymentRecord, "id" | "paymentReference" | "jobId" | "jobReference" | "jobTitle" | "customerName" | "currency" | "method" | "status" | "reportedByUserId" | "reportedAt" | "confirmedAt" | "disputeReason" | "createdAt" | "updatedAt"> & { earningsMinor: number }

export type MarketplaceProvider = {
  id: string
  userId?: string
  publicName: string
  bio: string
  region: string
  serviceLatitude?: number | null
  serviceLongitude?: number | null
  maxTravelDistanceKm?: number
  avatarPath?: string | null
}

export type MarketplaceProviderProfileInput = Pick<MarketplaceProvider, "publicName" | "bio" | "region"> & Pick<MarketplaceProvider, "serviceLatitude" | "serviceLongitude" | "maxTravelDistanceKm">

export type MarketplaceNotification = {
  id: string
  type: string
  title: string
  body: string
  jobId: string | null
  readAt: string | null
  createdAt: string
}

export type MarketplaceJobInput = {
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

export type MarketplaceQuoteInput = {
  amountMinor: number
  message: string
  availability: string
}

export type MarketplaceJobTransition =
  | "start"
  | "submit-completion"
  | "confirm-completion"
  | "request-revision"
  | "cancel"

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

export type AdminMemberRole = "OWNER" | "ADMIN" | "OPERATIONS_ADMIN" | "VERIFICATION_REVIEWER" | "MODERATION_REVIEWER" | "SUPPORT_AGENT" | "FINANCE_REVIEWER" | "ANALYST"
export type AdminMemberSummary = { userId: string; displayName: string; role: AdminMemberRole; legacyOwner: boolean; joinedAt: string }
export type AdminInvitationSummary = { id: string; email: string; role: AdminMemberRole; status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED"; invitedByName: string; createdAt: string; expiresAt: string }
export type AdminTeamSummary = { members: AdminMemberSummary[]; invitations: AdminInvitationSummary[] }
export type AdminAlertSummary = { id: string; code: string; severity: "critical" | "warning"; message: string; status: "open" | "acknowledged" | "resolved"; firstSeenAt: string; lastSeenAt: string; acknowledgedAt: string | null; assignedAdminId: string | null; assignedAdminName: string | null; resolvedAt: string | null; resolutionNote: string | null }
export type AdminAccess = { role: AdminMemberRole; screens: string[] }

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

export type AdminMarketplaceJob = MarketplaceJob & {
  customerDisplayName: string
  quotes: MarketplaceQuote[]
  timeline: AdminMarketplaceActivity[]
}

export type AdminMarketplaceJobFilters = {
  status: "all" | MarketplaceJobStatus
  search: string
  from: string
  to: string
}

export type AdminServiceListing = ServiceListing

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
  documentType: string | null
  skillsEvidence: string | null
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

export type AdminModerationStatus = "all" | "open" | "reviewing" | "resolved" | "dismissed"

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

export type AdminModerationDecision = "reviewing" | "resolved" | "dismissed"

export type AdminCategory = {
  id: string
  name: string
  slug: string
  active: boolean
  sortOrder: number
  totalJobs: number
  openJobs: number
}

export type MarketplaceServiceCategory = { name: string; slug: string }

export type AdminSystemSettings = {
  marketplaceCommissionPercent: number
  newProviderApplicationsEnabled: boolean
  adsEnabled: boolean
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

type AuthContextValue = {
  configured: boolean

  loading: boolean

  profile: AuthProfile | null

  recovery: boolean

  rememberMe: boolean


  policyConsentRequired: boolean

  setRememberMe: (remember: boolean) => void

  acceptCurrentPolicies: () => Promise<void>

  refreshProfile: () => Promise<AuthProfile | null>

  requestOtp: (
    method: AuthMethod,

    identifier: string,

    signup?: { displayName: string; intent: "customer" | "supplier" },
  ) => Promise<string | null>

  signInWithPassword: (
    method: AuthMethod,

    identifier: string,

    password: string,
  ) => Promise<string | null>

  signUp: (
    method: AuthMethod,

    identifier: string,

    password: string,

    displayName: string,

    intent: "customer" | "supplier",
  ) => Promise<{ error: string | null; needsVerification: boolean }>

  signInWithOAuth: (provider: OAuthProvider, role?: "consumer" | "provider") => Promise<string | null>

  requestPasswordReset: (email: string, role?: "consumer" | "provider") => Promise<string | null>

  updatePassword: (password: string) => Promise<string | null>

  completePasswordRecovery: () => void

  verifyOtp: (
    method: AuthMethod,

    identifier: string,

    token: string,
  ) => Promise<string | null>

  resendOtp: (method: AuthMethod, identifier: string) => Promise<string | null>

  submitProviderApplication: (
    application: Omit<ProviderApplication, "status"> & { document: File; identityDisclosureAccepted: boolean },
  ) => Promise<ProviderApplication>

  getProviderVerification: () => Promise<ProviderVerificationSummary>
  getCustomerVerification: () => Promise<CustomerVerificationSummary>
  submitCustomerVerification: (input: { documentType: "national_id" | "passport"; document: File; identityDisclosureAccepted: boolean }) => Promise<CustomerVerificationSummary>
  updateProfile: (displayName: string, avatarFile?: File) => Promise<AuthProfile>
  getProfileAvatarUrl: (avatarPath?: string | null) => string

  getAdminUsers: (
    limit: number,
    offset: number,
  ) => Promise<AdminPage<AdminUserSummary>>

  reinstateAdminUser: (userId: string) => Promise<void>
  setAdminCommissionRestriction: (userId: string, restricted: boolean, reason: string) => Promise<{ restricted: boolean; reason: string | null }>

  getAdminAuditEvents: (
    limit: number,

    offset: number,
  ) => Promise<AdminPage<AdminAuditEvent>>
  getAdminAccess: () => Promise<AdminAccess>
  getAdminTeam: () => Promise<AdminTeamSummary>
  setAdminMemberRole: (userId: string, role: AdminMemberRole) => Promise<void>
  removeAdminMember: (userId: string) => Promise<void>
  inviteAdminUser: (email: string, role: AdminMemberRole) => Promise<AdminInvitationSummary>
  revokeAdminInvitation: (invitationId: string) => Promise<void>
  acceptAdminInvitation: (invitationId: string, token: string) => Promise<{ role: AdminMemberRole; redirectTo: string }>
  getAdminAlerts: (limit?: number) => Promise<AdminAlertSummary[]>
  updateAdminAlert: (alertId: string, action: "acknowledge" | "assign" | "resolve", reason?: string) => Promise<AdminAlertSummary>

  getAdminMarketplaceActivity: (
    limit: number,
    offset: number,
  ) => Promise<AdminPage<AdminMarketplaceActivity>>

  getAdminMarketplaceJobs: (
    filters: AdminMarketplaceJobFilters,
    limit: number,
    offset: number,
  ) => Promise<AdminPage<AdminMarketplaceJob>>

  getAdminMarketplaceJob: (jobId: string) => Promise<AdminMarketplaceJob>
  getAdminServiceListings: (search: string, limit: number, offset: number) => Promise<AdminPage<AdminServiceListing>>
  releaseAdminServiceListing: (listingId: string, reason: string) => Promise<AdminServiceListing>

  getAdminOverview: () => Promise<AdminOverview>
  getAdminAnalytics: (filters: AdminAnalyticsFilters) => Promise<AdminAnalyticsReport>

  getAdminVerifications: (
    status: AdminVerificationStatus,

    limit: number,

    offset: number,
  ) => Promise<AdminPage<AdminVerificationSummary>>

  getAdminVerificationDocument: (profileId: string) => Promise<{ url: string; expiresInSeconds: number }>

  decideAdminVerification: (
    profileId: string,

    decision: "verified" | "rejected",

    reason?: string,
  ) => Promise<AdminVerificationSummary>

  getAdminCustomerVerifications: (status: AdminVerificationStatus, limit: number, offset: number) => Promise<AdminPage<AdminCustomerVerificationSummary>>
  getAdminCustomerVerificationDocument: (verificationId: string) => Promise<{ url: string; expiresInSeconds: number }>
  decideAdminCustomerVerification: (verificationId: string, decision: "verified" | "rejected", reason?: string) => Promise<AdminCustomerVerificationSummary>

  createModerationReport: (report: {
    subjectType: "account" | "job" | "provider_profile" | "message"

    subjectId: string

    reason: "harassment" | "fraud" | "spam" | "unsafe" | "off_platform_payment" | "other"

    details: string
  }) => Promise<{ id: string; status: string; createdAt: string }>

  getAdminModerationReports: (
    status: AdminModerationStatus,

    limit: number,

    offset: number,
    search?: string,
  ) => Promise<AdminPage<AdminModerationReport>>

  decideAdminModerationReport: (
    reportId: string,

    decision: AdminModerationDecision,

    enforcement: "none" | "suspend_account",

    reason?: string,
  ) => Promise<{ id: string; status: string }>

  getAdminMonitoring: () => Promise<AdminMonitoringSnapshot>

  getAdminMonitoringHistory: (limit: number) => Promise<AdminMonitoringSnapshot[]>

  getAdminCategories: () => Promise<AdminCategory[]>
  getMarketplaceCategories: () => Promise<MarketplaceServiceCategory[]>

  saveAdminCategory: (category: Omit<AdminCategory, "id" | "totalJobs" | "openJobs">) => Promise<AdminCategory>

  getAdminSettings: () => Promise<AdminSystemSettings>

  saveAdminSettings: (settings: AdminSystemSettings) => Promise<AdminSystemSettings>

  getAdminAdCampaigns: (status: "all" | "pending" | "approved" | "rejected") => Promise<AdminAdCampaign[]>

  decideAdminAdCampaign: (
    campaignId: string,
    decision: "approved" | "rejected",
    reason?: string,
  ) => Promise<AdminAdCampaign>

  getMarketplaceJobs: (
    view: "consumer" | "provider" | "feed",
  ) => Promise<MarketplaceJob[]>

  getMarketplaceProviders: (
    search: string,
    region: string,
    limit: number,
    offset: number,
  ) => Promise<AdminPage<MarketplaceProvider>>

  getMarketplaceProvider: (providerId: string, jobId?: string) => Promise<MarketplaceProvider>
  updateMarketplaceProviderProfile: (input: MarketplaceProviderProfileInput) => Promise<MarketplaceProvider>
  getSavedProviders: () => Promise<MarketplaceProvider[]>
  saveProvider: (providerId: string) => Promise<void>
  removeSavedProvider: (providerId: string) => Promise<void>
  getPublicProviderReviews: (providerId: string) => Promise<ServiceListingReview[]>

  getMarketplaceNotifications: (limit: number, offset: number) => Promise<AdminPage<MarketplaceNotification>>

  markMarketplaceNotificationRead: (notificationId: string) => Promise<void>

  getMarketplaceJob: (
    jobId: string,
    role: "consumer" | "provider",
  ) => Promise<MarketplaceJob>
  getJobPayments: (role: "consumer" | "provider") => Promise<JobPaymentRecord[]>
  getProviderWalletPayments: () => Promise<ProviderWalletPayment[]>
  reportJobPayment: (jobId: string, method: JobPaymentMethod) => Promise<JobPaymentRecord>
  reportHirerPlatformFee: (jobId: string, paymentReference: string) => Promise<JobPaymentRecord>
  confirmJobPayment: (jobId: string) => Promise<JobPaymentRecord>
  disputeJobPayment: (jobId: string, reason: string) => Promise<JobPaymentRecord>

  getMarketplaceQuotes: (
    jobId: string,
    role: "consumer" | "provider",
  ) => Promise<MarketplaceQuote[]>

  getMyMarketplaceQuotes: () => Promise<MarketplaceProviderQuote[]>

  createMarketplaceJob: (input: MarketplaceJobInput) => Promise<MarketplaceJob>

  submitMarketplaceQuote: (
    jobId: string,
    input: MarketplaceQuoteInput,
  ) => Promise<MarketplaceQuote>

  acceptMarketplaceQuote: (
    jobId: string,
    quoteId: string,
  ) => Promise<MarketplaceJob>

  transitionMarketplaceJob: (
    jobId: string,
    transition: MarketplaceJobTransition,
    details?: { note: string },
  ) => Promise<MarketplaceJob>

  getMarketplaceConversations: (role: "consumer" | "provider") => Promise<MarketplaceConversation[]>
  openMarketplaceConversation: (jobId: string, role: "consumer" | "provider", providerId?: string) => Promise<MarketplaceConversation>
  getMarketplaceConversationMessages: (conversationId: string) => Promise<MarketplaceConversationMessage[]>
  sendMarketplaceConversationMessage: (conversationId: string, body: string) => Promise<MarketplaceConversationMessage>
  getSupportCases: (role: "consumer" | "provider") => Promise<SupportCase[]>
  createSupportCase: (role: "consumer" | "provider", input: CreateSupportCaseInput) => Promise<SupportCase>
  getSupportCaseMessages: (role: "consumer" | "provider", caseId: string) => Promise<SupportCaseMessage[]>
  sendSupportCaseMessage: (role: "consumer" | "provider", caseId: string, body: string) => Promise<SupportCaseMessage>

  getServiceListings: (role: "consumer" | "provider", view: "feed" | "mine") => Promise<ServiceListing[]>
  createServiceListing: (input: ServiceListingInput) => Promise<ServiceListing>
  uploadServiceListingMedia: (file: File) => Promise<ServiceListingMedia>
  deleteServiceListingMedia: (path: string) => Promise<void>
  getServiceListingMediaUrl: (path: string) => string
  claimServiceListing: (listingId: string) => Promise<ServiceListing>
  transitionServiceListing: (listingId: string, transition: "start" | "submit-completion" | "confirm-completion" | "cancel" | "close") => Promise<ServiceListing>
  getServiceListingReviews: (role: "consumer" | "provider") => Promise<ServiceListingReviewPage>
  createServiceListingReview: (listingId: string, rating: number, comment: string) => Promise<ServiceListingReview>
  getServiceListingMessages: (listingId: string, role: "consumer" | "provider") => Promise<ServiceListingMessage[]>
  sendServiceListingMessage: (listingId: string, role: "consumer" | "provider", body: string) => Promise<ServiceListingMessage>
  getAdminServiceListingMessages: (limit: number, offset: number, search?: string) => Promise<AdminPage<AdminServiceListingMessage>>
  getAdminSupportCases: (search: string, status: SupportCaseStatus | "all", limit: number, offset: number) => Promise<AdminPage<SupportCase>>
  getAdminSupportCaseMessages: (caseId: string) => Promise<SupportCaseMessage[]>
  sendAdminSupportMessage: (caseId: string, body: string) => Promise<SupportCaseMessage>
  updateAdminSupportCaseStatus: (caseId: string, status: SupportCaseStatus) => Promise<SupportCase>
  getAdminJobPayments: (search: string, status: JobPaymentStatus | "all", limit: number, offset: number) => Promise<AdminJobPaymentPage>
  resolveAdminJobPayment: (paymentId: string, resolution: "paid" | "refunded", reason: string) => Promise<JobPaymentRecord>
  recordAdminPlatformFeeReceipt: (paymentId: string, receiptReference: string) => Promise<JobPaymentRecord>
  setAdminProviderPayoutHold: (providerId: string, held: boolean, reason: string) => Promise<void>

  subscribeMarketplaceChanges: (onChange: () => void) => () => void

  signOut: () => Promise<void>
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL

const supabaseApiKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY

const apiUrl = (import.meta.env.VITE_API_URL || "http://127.0.0.1:3000")

  .replace(/\/$/, "")

type AuthHotData = {
  rememberSessionState?: { current: boolean }
  supabaseClient?: SupabaseClient
}

const authHotData = import.meta.hot?.data as AuthHotData | undefined
const rememberSessionState = authHotData?.rememberSessionState ?? {
  current: window.localStorage.getItem("oddjobs-auth-remember-session") === "1",
}
if (authHotData) authHotData.rememberSessionState = rememberSessionState

const authStorage = {
  getItem: async (key: string) =>
    window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key),

  setItem: async (key: string, value: string) => {
    const target = rememberSessionState.current ? window.localStorage : window.sessionStorage

    const other = rememberSessionState.current ? window.sessionStorage : window.localStorage

    other.removeItem(key)

    target.setItem(key, value)
  },

  removeItem: async (key: string) => {
    window.localStorage.removeItem(key)

    window.sessionStorage.removeItem(key)
  },
}

const supabase: SupabaseClient | null =
  supabaseUrl && supabaseApiKey
    ? authHotData?.supabaseClient ?? createClient(supabaseUrl, supabaseApiKey, {
        auth: {
          autoRefreshToken: true,

          detectSessionInUrl: true,

          persistSession: true,

          storage: authStorage,
        },
      })
    : null
if (authHotData && supabase) authHotData.supabaseClient = supabase

const AuthContext = createContext<AuthContextValue | null>(null)

function getAuthErrorMessage(
  error: { message: string; code?: string } | null,

  fallback: string,
) {
  if (!error) return fallback

  const code = error.code?.toLowerCase() ?? ""

  const message = error.message.toLowerCase()

  if (
    message.includes("provider is not enabled") ||
    message.includes("unsupported provider")
  ) {
    return "This sign-in provider is not enabled in Supabase Auth. Enable it and configure its provider credentials in the Supabase dashboard."
  }

  if (
    message.includes("redirect") &&
    (message.includes("not allowed") || message.includes("allowlist"))
  ) {
    return "The sign-in return URL is not allowed in Supabase Auth. Add this app’s root URL to the Auth redirect URL allowlist."
  }

  if (
    code.includes("rate_limit") ||
    code.includes("too_many") ||
    message.includes("rate limit") ||
    message.includes("too many requests")
  ) {
    return "There have been too many attempts. Please wait a few minutes and try again."
  }

  if (
    code.includes("email_not_confirmed") ||
    message.includes("email not confirmed")
  ) {
    return "Please verify your email using the link we sent before signing in."
  }

  if (
    code.includes("invalid_credentials") ||
    message.includes("invalid login credentials")
  ) {
    return "Those sign-in details don’t match. Check them and try again."
  }

  if (
    code.includes("otp_expired") ||
    code.includes("token_expired") ||
    message.includes("expired")
  ) {
    return "That verification link or code has expired. Request a new one and try again."
  }

  if (
    code.includes("invalid_otp") ||
    code.includes("otp_invalid") ||
    message.includes("invalid otp") ||
    message.includes("invalid token")
  ) {
    return "That verification code doesn’t look right. Check it and try again."
  }

  if (code.includes("weak_password") || message.includes("weak password")) {
    return "Choose a stronger password and try again."
  }

  return fallback
}

function getApiErrorMessage(status: number, fallback: string) {
  if (status === 401) return "Please sign in again and retry."

  if (status === 429) {
    return "There have been too many attempts. Please wait a few minutes and try again."
  }

  if (status >= 500) {
    return "This service is temporarily unavailable. Please try again shortly."
  }

  return fallback
}

async function fetchAccountRequest(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15000)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Your connection is taking longer than expected. Please try again.")
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

function withTimeout<T>(promise: Promise<T>, durationMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Account verification timed out. Please sign in again.")),
      durationMs,
    )
    promise.then(
      (value) => {
        window.clearTimeout(timeout)
        resolve(value)
      },
      (error: unknown) => {
        window.clearTimeout(timeout)
        reject(error)
      },
    )
  })
}

async function postPolicyConsent(
  accessToken: string,

  termsVersion: string,

  privacyVersion: string,
) {
  const consentResponse = await fetchAccountRequest(`${apiUrl}/v1/me/policy-consents`, {
    method: "POST",

    headers: {
      Authorization: `Bearer ${accessToken}`,

      "Content-Type": "application/json",
    },

    body: JSON.stringify({ termsVersion, privacyVersion }),
  })

  if (!consentResponse.ok) {
    throw new Error(
      getApiErrorMessage(
        consentResponse.status,

        "We couldn’t save your policy acceptance. Please try again.",
      ),
    )
  }
}

async function fetchProfile(
  session: Session,
): Promise<{ profile: AuthProfile; policyConsentRequired: boolean }> {
  const headers = { Authorization: `Bearer ${session.access_token}` }

  let response = await fetchAccountRequest(`${apiUrl}/v1/me`, { headers })

  if (response.status === 404) {
    response = await fetchAccountRequest(`${apiUrl}/v1/me/bootstrap`, {
      method: "POST",

      headers,
    })
  }

  if (!response.ok) {
    throw new Error(
      getApiErrorMessage(
        response.status,

        "We couldn’t load your profile. Please try again.",
      ),
    )
  }

  const profile = (await response.json()) as AuthProfile

  const metadata = session.user.user_metadata

  const termsVersion = metadata?.oddjobs_terms_version

  const privacyVersion = metadata?.oddjobs_privacy_version

  const policyConsentRequired =
    termsVersion !== POLICY_VERSIONS.terms ||
    privacyVersion !== POLICY_VERSIONS.privacy

  if (!policyConsentRequired) {
    await postPolicyConsent(
      session.access_token,

      POLICY_VERSIONS.terms,

      POLICY_VERSIONS.privacy,
    )
  }

  return { profile, policyConsentRequired }
}

async function adminRequest(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  if (!supabase) {
    throw new Error(
      "Account services are temporarily unavailable. Please try again later.",
    )
  }

  const { data, error } = await supabase.auth.getSession()

  if (error) {
    throw new Error(
      getAuthErrorMessage(error, "Please sign in again and retry."),
    )
  }

  if (!data.session) throw new Error("Please sign in to continue.")

  const sendWithSession = (accessToken: string) => {
    const headers = new Headers(init?.headers)
    headers.set("Authorization", `Bearer ${accessToken}`)
    return fetch(`${apiUrl}${path}`, { ...init, headers })
  }

  const response = await sendWithSession(data.session.access_token)
  if (response.status !== 401) return response

  // An access token can expire between getSession() and the API request.
  // Refresh once so callers do not fail because they used a stale session token.
  const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
  if (refreshError || !refreshed.session) return response
  return sendWithSession(refreshed.session.access_token)
}

function getAdminResponseError(status: number) {
  return new Error(
    status === 403
      ? "Your account is not authorized to view admin data."
      : getApiErrorMessage(
          status,

          "We couldn’t load this admin data. Please try again.",
        ),
  )
}

async function fetchAdminPage<T>(
  resource: "users" | "audit" | "verification" | "customer-verification" | "moderation" | "marketplace/activity" | "messages",

  limit: number,

  offset: number,

  status?: AdminVerificationStatus | AdminModerationStatus,
  searchValue?: string,
): Promise<AdminPage<T>> {
  const search = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  })

  if (status) search.set("status", status)
  if (searchValue?.trim()) search.set("search", searchValue.trim())

  const response = await adminRequest(`/v1/admin/${resource}?${search}`)

  if (!response.ok) throw getAdminResponseError(response.status)

  return (await response.json()) as AdminPage<T>
}

async function fetchAdminOverview(): Promise<AdminOverview> {
  const response = await adminRequest("/v1/admin/overview")

  if (!response.ok) throw getAdminResponseError(response.status)

  return (await response.json()) as AdminOverview
}

async function fetchAdminAnalytics(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsReport> {
  const query = new URLSearchParams(filters)
  const response = await adminRequest(`/v1/admin/analytics?${query.toString()}`)
  if (!response.ok) throw getAdminResponseError(response.status)
  return (await response.json()) as AdminAnalyticsReport
}

async function postAdminAction<T>(
  path: string,
  body: unknown,
  method: "POST" | "PUT" | "PATCH" = "POST",
): Promise<T> {
  const response = await adminRequest(path, {
    method,

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error || getAdminResponseError(response.status).message)
  }

  return (await response.json()) as T
}

const marketplaceReadCache = new Map<string, { expiresAt: number; value?: unknown; pending?: Promise<unknown> }>()
const MARKETPLACE_READ_CACHE_MS = 8_000

function invalidateMarketplaceReadCache() {
  marketplaceReadCache.clear()
}

async function marketplaceRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase()
  const userId = supabase
    ? (await supabase.auth.getSession()).data.session?.user.id ?? "anonymous"
    : "anonymous"
  const cacheKey = `${userId}:${path}`
  if (method === "GET") {
    const cached = marketplaceReadCache.get(cacheKey)
    if (cached?.value !== undefined && cached.expiresAt > Date.now()) return cached.value as T
    if (cached?.pending) return cached.pending as Promise<T>
  }

  const request = (async () => {
    const response = await adminRequest(path, init)
    if (!response.ok) {
      const fallback =
        response.status === 403
          ? "Your account cannot access this marketplace data."
          : response.status === 404
            ? "This job or quote is no longer available."
            : response.status === 409
              ? "This job has changed. Refresh and try again."
              : "We could not complete that marketplace action. Please try again."
      const payload = await response.clone().json().catch(() => null) as
        | { error?: unknown; message?: unknown }
        | null
      const serverMessage =
        typeof payload?.error === "string"
          ? payload.error
          : typeof payload?.message === "string"
            ? payload.message
            : fallback
      throw new Error(getApiErrorMessage(response.status, serverMessage))
    }
    const value = (await response.json()) as T
    if (method === "GET") {
      marketplaceReadCache.set(cacheKey, { value, expiresAt: Date.now() + MARKETPLACE_READ_CACHE_MS })
    } else invalidateMarketplaceReadCache()
    return value
  })()

  if (method === "GET") marketplaceReadCache.set(cacheKey, { expiresAt: 0, pending: request })
  try {
    return await request
  } catch (error) {
    if (method === "GET" && marketplaceReadCache.get(cacheKey)?.pending === request) {
      marketplaceReadCache.delete(cacheKey)
    }
    throw error
  }
}

function marketplacePost<T>(path: string, body?: unknown): Promise<T> {
  return marketplaceRequest<T>(path, {
    method: "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<AuthProfile | null>(null)

  const [loading, setLoading] = useState(Boolean(supabase))

  const [recovery, setRecovery] = useState(false)


  const [policyConsentRequired, setPolicyConsentRequired] = useState(false)

  useEffect(() => {
    if (!supabase) return

    let active = true

    let loadingToken: string | null = null

    const loadProfile = async (session: Session | null) => {
      if (!session) {
        loadingToken = null

        setPolicyConsentRequired(false)

        setProfile(null)

        setLoading(false)

        return
      }

      if (loadingToken === session.access_token) return

      loadingToken = session.access_token

      setLoading(true)

      try {
        const result = await withTimeout(fetchProfile(session), 20000)

        if (active && loadingToken === session.access_token) {
          setProfile(result.profile)

          setPolicyConsentRequired(result.policyConsentRequired)
        }
      } catch (error) {
        console.error(
          "Unable to load the authenticated OddJobs profile.",

          error,
        )

        if (active && loadingToken === session.access_token) {
          loadingToken = null
          setProfile(null)
          setLoading(false)
        }
      } finally {
        if (active && loadingToken === session.access_token) setLoading(false)
      }
    }

    void withTimeout(supabase.auth.getSession(), 15000)
      .then(({ data, error }) => {
        if (error) console.error("Unable to restore the Supabase session.", error)

        if (active) void loadProfile(data.session)
      })
      .catch((error: unknown) => {
        console.error("Unable to verify the saved account session.", error)
        if (active) {
          setProfile(null)
          setLoading(false)
        }
      })

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true)

      if (active) void loadProfile(session)
    })

    return () => {
      active = false

      data.subscription.unsubscribe()
    }
  }, [])

  const acceptCurrentPolicies = async () => {
    if (!supabase) {
      throw new Error(
        "Account services are temporarily unavailable. Please try again later.",
      )
    }

    const updateResult = await supabase.auth.updateUser({
      data: {
        oddjobs_terms_version: POLICY_VERSIONS.terms,

        oddjobs_privacy_version: POLICY_VERSIONS.privacy,
      },
    })

    if (updateResult.error) {
      throw new Error(
        getAuthErrorMessage(
          updateResult.error,

          "We couldn’t save your policy acceptance. Please try again.",
        ),
      )
    }

    const sessionResult = await supabase.auth.getSession()

    if (sessionResult.error) {
      throw new Error(
        getAuthErrorMessage(
          sessionResult.error,

          "We couldn’t confirm your sign-in. Please sign in again.",
        ),
      )
    }

    if (!sessionResult.data.session) {
      throw new Error("Sign in again to save your policy acceptance.")
    }

    await postPolicyConsent(
      sessionResult.data.session.access_token,

      POLICY_VERSIONS.terms,

      POLICY_VERSIONS.privacy,
    )

    setPolicyConsentRequired(false)
  }

  const refreshProfile = useCallback(async () => {
    if (!supabase) {
      throw new Error(
        "Account services are temporarily unavailable. Please try again later.",
      )
    }

    const { data, error } = await withTimeout(supabase.auth.getSession(), 15000)
    if (error) {
      throw new Error(
        getAuthErrorMessage(error, "Please sign in again and retry."),
      )
    }

    if (!data.session) {
      setProfile(null)
      setPolicyConsentRequired(false)
      return null
    }

    setLoading(true)
    try {
      const result = await withTimeout(fetchProfile(data.session), 20000)
      setProfile(result.profile)
      setPolicyConsentRequired(result.policyConsentRequired)
      return result.profile
    } finally {
      setLoading(false)
    }
  }, [])

  const requestOtp = async (
    method: AuthMethod,

    identifier: string,

    signup?: { displayName: string; intent: "customer" | "supplier" },
  ) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }

    const options = signup
      ? {
          shouldCreateUser: true,

          data: {
            full_name: signup.displayName,

            oddjobs_terms_version: POLICY_VERSIONS.terms,

            oddjobs_privacy_version: POLICY_VERSIONS.privacy,

            ...(signup.intent === "supplier"
              ? { account_intent: signup.intent }
              : {}),
          },
        }
      : { shouldCreateUser: false }

    const result =
      method === "phone"
        ? await supabase.auth.signInWithOtp({
            phone: identifier,

            options,
          })
        : await supabase.auth.signInWithOtp({
            email: identifier,

            options,
          })

    return result.error
      ? getAuthErrorMessage(
          result.error,

          "We couldn’t send a verification code. Please try again shortly.",
        )
      : null
  }

  const signInWithPassword = async (
    method: AuthMethod,

    identifier: string,

    password: string,
  ) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }

    const result =
      method === "phone"
        ? await supabase.auth.signInWithPassword({
            phone: identifier,

            password,
          })
        : await supabase.auth.signInWithPassword({
            email: identifier,

            password,
          })

    return result.error
      ? getAuthErrorMessage(
          result.error,

          "We couldn’t sign you in. Please check your details and try again.",
        )
      : null
  }

  const signUp = async (
    method: AuthMethod,

    identifier: string,

    password: string,

    displayName: string,

    intent: "customer" | "supplier",
  ) => {
    if (!supabase) {
      return {
        error:
          "Account services are temporarily unavailable. Please try again later.",

        needsVerification: false,
      }
    }

    const options = {
      data: {
        full_name: displayName,

        oddjobs_terms_version: POLICY_VERSIONS.terms,

        oddjobs_privacy_version: POLICY_VERSIONS.privacy,

        ...(intent === "supplier" ? { account_intent: intent } : {}),
      },

      emailRedirectTo: `${window.location.origin}/${intent === "supplier" ? "provider" : "consumer"}/login`,
    }

    const result =
      method === "phone"
        ? await supabase.auth.signUp({
            phone: identifier,

            password,

            options,
          })
        : await supabase.auth.signUp({
            email: identifier,

            password,

            options,
          })

    const needsVerification = !result.error && !result.data.session

    return {
      error: result.error
        ? getAuthErrorMessage(
            result.error,

            "We couldn’t create your account right now. Please try again shortly.",
          )
        : null,

      needsVerification,
    }
  }

  const signInWithOAuth = async (provider: OAuthProvider, role: "consumer" | "provider" = "consumer") => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,

      options: { redirectTo: `${window.location.origin}/${role}/login` },
    })

    return error
      ? getAuthErrorMessage(
          error,

          "We couldn’t start sign-in with that option. Please try again.",
        )
      : null
  }

  const requestPasswordReset = async (email: string, role: "consumer" | "provider" = "consumer") => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/${role}/login`,
    })

    return error
      ? getAuthErrorMessage(
          error,

          "We couldn’t send a reset link. Please try again shortly.",
        )
      : null
  }

  const updatePassword = async (password: string) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }

    const { error } = await supabase.auth.updateUser({ password })

    return error
      ? getAuthErrorMessage(
          error,

          "We couldn’t update your password. Please try again.",
        )
      : null
  }

  const verifyOtp = async (
    method: AuthMethod,

    identifier: string,

    token: string,
  ) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }

    const result =
      method === "phone"
        ? await supabase.auth.verifyOtp({
            phone: identifier,

            token,

            type: "sms",
          })
        : await supabase.auth.verifyOtp({
            email: identifier,

            token,

            type: "email",
          })

    return result.error
      ? getAuthErrorMessage(
          result.error,

          "We couldn’t verify that code. Please try again.",
        )
      : null
  }

  const resendOtp = async (method: AuthMethod, identifier: string) => {
    if (!supabase) {
      return "Account services are temporarily unavailable. Please try again later."
    }

    const result =
      method === "phone"
        ? await supabase.auth.resend({ type: "sms", phone: identifier })
        : await supabase.auth.signInWithOtp({
            email: identifier,

            options: { shouldCreateUser: false },
          })

    return result.error
      ? getAuthErrorMessage(
          result.error,

          "We couldn’t send a new verification code. Please try again.",
        )
      : null
  }

  const submitProviderApplication = async (
    application: Omit<ProviderApplication, "status"> & { document: File; identityDisclosureAccepted: boolean },
  ): Promise<ProviderApplication> => {
    if (!supabase) {
      throw new Error(
        "Account services are temporarily unavailable. Please try again later.",
      )
    }

    const { data, error } = await supabase.auth.getSession()

    if (error) {
      throw new Error(
        getAuthErrorMessage(
          error,

          "We couldn’t confirm your sign-in. Please sign in again.",
        ),
      )
    }

    if (!data.session) {
      throw new Error(
        "Please sign in before submitting your supplier application.",
      )
    }

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"])
    if (!allowedTypes.has(application.document.type)) {
      throw new Error("Upload a JPG, PNG, WebP, or PDF identity document.")
    }
    if (application.document.size < 1 || application.document.size > 8 * 1024 * 1024) {
      throw new Error("The identity document must be 8 MB or smaller.")
    }
    const extension = application.document.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "file"
    const documentPath = `${data.session.user.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage
      .from("provider-verification")
      .upload(documentPath, application.document, {
        cacheControl: "0",
        contentType: application.document.type,
        upsert: false,
      })
    if (uploadError) {
      throw new Error("Could not upload your ID securely. Check the connection and try again.")
    }

    const { document, ...applicationDetails } = application
    const response = await fetch(`${apiUrl}/v1/provider-applications`, {
      method: "POST",

      headers: {
        Authorization: `Bearer ${data.session.access_token}`,

        "Content-Type": "application/json",
      },

      body: JSON.stringify({ ...applicationDetails, documentPath }),
    })

    if (!response.ok) {
      await supabase.storage.from("provider-verification").remove([documentPath])
      const responseBody = (await response.json().catch(() => null)) as { error?: unknown } | null
      const serverMessage = typeof responseBody?.error === "string" ? responseBody.error : "Provider application could not be submitted. Please try again."
      throw new Error(getApiErrorMessage(response.status, serverMessage))
    }
    const result = (await response.json()) as ProviderApplication
    if (result.documentPath !== documentPath) {
      await supabase.storage.from("provider-verification").remove([documentPath])
    }

    const metadataResult = await supabase.auth.updateUser({
      data: { account_intent: null },
    })

    if (metadataResult.error) {
      throw new Error(
        "Your application was received, but we couldn’t finish updating your account. Please contact support if you need help.",
      )
    }

    await refreshProfile()

    return result
  }

  const getProviderVerification = useCallback(async (): Promise<ProviderVerificationSummary> => {
    if (!supabase) throw new Error("Account services are temporarily unavailable.")
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) throw new Error("Sign in again to view your verification status.")
    const response = await fetch(`${apiUrl}/v1/provider-verification`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    })
    if (!response.ok) throw new Error(getApiErrorMessage(response.status, "Could not load your verification status."))
    return await response.json() as ProviderVerificationSummary
  }, [])

  const getCustomerVerification = useCallback(async (): Promise<CustomerVerificationSummary> => {
    if (!supabase) throw new Error("Account services are temporarily unavailable.")
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) throw new Error("Sign in again to view your identity status.")
    const response = await fetch(`${apiUrl}/v1/customer-verification`, { headers: { Authorization: `Bearer ${session.access_token}` }, cache: "no-store" })
    if (!response.ok) throw new Error(getApiErrorMessage(response.status, "Could not load your identity status."))
    return await response.json() as CustomerVerificationSummary
  }, [])

  const submitCustomerVerification = useCallback(async (input: { documentType: "national_id" | "passport"; document: File; identityDisclosureAccepted: boolean }): Promise<CustomerVerificationSummary> => {
    if (!supabase) throw new Error("Account services are temporarily unavailable.")
    if (!input.identityDisclosureAccepted) throw new Error("Confirm the identity-document disclosure before submitting.")
    if (!new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]).has(input.document.type)) throw new Error("Upload a JPG, PNG, WebP, or PDF identity document.")
    if (input.document.size < 1 || input.document.size > 8 * 1024 * 1024) throw new Error("The identity document must be 8 MB or smaller.")
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) throw new Error("Sign in again before submitting your identity document.")
    const extension = input.document.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "file"
    const documentPath = `${session.user.id}/${crypto.randomUUID()}.${extension}`
    const { error: uploadError } = await supabase.storage.from("customer-verification").upload(documentPath, input.document, { cacheControl: "0", contentType: input.document.type, upsert: false })
    if (uploadError) throw new Error("Could not upload your ID securely. Check the connection and try again.")
    const response = await fetch(`${apiUrl}/v1/customer-verification`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: input.documentType, documentPath, identityDisclosureAccepted: true }),
    })
    if (!response.ok) {
      await supabase.storage.from("customer-verification").remove([documentPath])
      const responseBody = (await response.json().catch(() => null)) as { error?: unknown } | null
      const serverMessage = typeof responseBody?.error === "string" ? responseBody.error : "Could not submit your identity check."
      throw new Error(getApiErrorMessage(response.status, serverMessage))
    }
    return await response.json() as CustomerVerificationSummary
  }, [])

  const updateProfile = useCallback(async (displayName: string, avatarFile?: File): Promise<AuthProfile> => {
    if (!supabase) throw new Error("Account services are temporarily unavailable.")
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) throw new Error("Sign in again before updating your profile.")
    let avatarPath: string | undefined
    if (avatarFile) {
      if (!new Set(["image/jpeg", "image/png", "image/webp"]).has(avatarFile.type)) throw new Error("Choose a JPG, PNG, or WebP profile photo.")
      if (avatarFile.size < 1 || avatarFile.size > 2 * 1024 * 1024) throw new Error("Profile photos must be 2 MB or smaller.")
      const extension = avatarFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg"
      avatarPath = `${session.user.id}/${crypto.randomUUID()}.${extension}`
      const { error: uploadError } = await supabase.storage.from("account-avatars").upload(avatarPath, avatarFile, { cacheControl: "3600", contentType: avatarFile.type, upsert: false })
      if (uploadError) throw new Error("Could not upload your profile photo. Try again.")
    }
    const response = await fetch(`${apiUrl}/v1/me`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: displayName.trim(), ...(avatarPath ? { avatarPath } : {}) }),
    })
    if (!response.ok) {
      if (avatarPath) await supabase.storage.from("account-avatars").remove([avatarPath])
      throw new Error(getApiErrorMessage(response.status, "Could not save your profile."))
    }
    const updated = await response.json() as AuthProfile
    setProfile(updated)
    return updated
  }, [])

  const getProfileAvatarUrl = useCallback((avatarPath?: string | null) => {
    if (!supabase || !avatarPath) return ""
    return supabase.storage.from("account-avatars").getPublicUrl(avatarPath).data.publicUrl
  }, [])

  const signOut = async () => {
    if (!supabase) return

    const { error } = await supabase.auth.signOut()

    if (error) {
      throw new Error(
        getAuthErrorMessage(
          error,

          "We couldn’t sign you out. Please try again.",
        ),
      )
    }
  }

  const getAdminUsers = useCallback(
    (limit: number, offset: number) =>
      fetchAdminPage<AdminUserSummary>("users", limit, offset),

    [],
  )

  const reinstateAdminUser = useCallback(async (userId: string) => {
    const result = await postAdminAction<{ userId: string; status: string }>(
      `/v1/admin/users/${encodeURIComponent(userId)}/reinstate`,
      {},
    )
    if (result.status !== "active") {
      throw new Error("The account reinstatement was not confirmed.")
    }
  }, [])

  const setAdminCommissionRestriction = useCallback((userId: string, restricted: boolean, reason: string) => postAdminAction<{ restricted: boolean; reason: string | null }>(`/v1/admin/users/${encodeURIComponent(userId)}/commission-restriction`, { restricted, reason }, "PATCH"), [])

  const getAdminAuditEvents = useCallback(
    async (limit: number, offset: number, filters: { search?: string; action?: string; from?: string; to?: string } = {}) => {
      const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
      for (const [key, value] of Object.entries(filters)) if (value?.trim()) query.set(key, value.trim())
      const response = await adminRequest(`/v1/admin/audit?${query}`)
      if (!response.ok) throw getAdminResponseError(response.status)
      return (await response.json()) as AdminPage<AdminAuditEvent>
    },

    [],
  )

  const getAdminAccess = useCallback(async () => {
    const response = await adminRequest("/v1/admin/access")
    if (!response.ok) throw getAdminResponseError(response.status)
    return (await response.json()) as AdminAccess
  }, [])
  const getAdminTeam = useCallback(async () => {
    const response = await adminRequest("/v1/admin/team")
    if (!response.ok) throw getAdminResponseError(response.status)
    return (await response.json()) as AdminTeamSummary
  }, [])
  const setAdminMemberRole = useCallback(async (userId: string, role: AdminMemberRole) => {
    await postAdminAction<{ updated: boolean }>(`/v1/admin/team/members/${encodeURIComponent(userId)}`, { role }, "PATCH")
  }, [])
  const removeAdminMember = useCallback(async (userId: string) => {
    const response = await adminRequest(`/v1/admin/team/members/${encodeURIComponent(userId)}`, { method: "DELETE" })
    if (!response.ok) throw getAdminResponseError(response.status)
  }, [])
  const inviteAdminUser = useCallback((email: string, role: AdminMemberRole) => postAdminAction<AdminInvitationSummary>("/v1/admin/team/invitations", { email, role }), [])
  const revokeAdminInvitation = useCallback(async (invitationId: string) => {
    const response = await adminRequest(`/v1/admin/team/invitations/${encodeURIComponent(invitationId)}`, { method: "DELETE" })
    if (!response.ok) throw getAdminResponseError(response.status)
  }, [])
  const acceptAdminInvitation = useCallback(async (invitationId: string, token: string) => {
    const result = await postAdminAction<{ accepted: boolean; role: AdminMemberRole; redirectTo: string }>("/v1/admin/invitations/accept", { invitationId, token })
    return { role: result.role, redirectTo: result.redirectTo }
  }, [])
  const getAdminAlerts = useCallback(async (limit = 50) => {
    const response = await adminRequest(`/v1/admin/monitoring/alerts?limit=${limit}`)
    if (!response.ok) throw getAdminResponseError(response.status)
    return (await response.json()) as AdminAlertSummary[]
  }, [])
  const updateAdminAlert = useCallback((alertId: string, action: "acknowledge" | "assign" | "resolve", reason?: string) => postAdminAction<AdminAlertSummary>(`/v1/admin/monitoring/alerts/${encodeURIComponent(alertId)}`, { action, ...(reason ? { reason } : {}) }, "PATCH"), [])

  const getAdminMarketplaceActivity = useCallback(
    (limit: number, offset: number) =>
      fetchAdminPage<AdminMarketplaceActivity>(
        "marketplace/activity",
        limit,
        offset,
      ),
    [],
  )

  const getAdminMarketplaceJobs = useCallback(
    async (
      filters: AdminMarketplaceJobFilters,
      limit: number,
      offset: number,
    ) => {
      const query = new URLSearchParams({
        status: filters.status,
        search: filters.search,
        limit: String(limit),
        offset: String(offset),
      })
      if (filters.from) query.set("from", filters.from)
      if (filters.to) query.set("to", filters.to)
      const response = await adminRequest(`/v1/admin/marketplace/jobs?${query}`)
      if (!response.ok) throw getAdminResponseError(response.status)
      return (await response.json()) as AdminPage<AdminMarketplaceJob>
    },
    [],
  )

  const getAdminMarketplaceJob = useCallback(
    async (jobId: string) => {
      const response = await adminRequest(
        `/v1/admin/marketplace/jobs/${encodeURIComponent(jobId)}`,
      )
      if (!response.ok) throw getAdminResponseError(response.status)
      return (await response.json()) as AdminMarketplaceJob
    },
    [],
  )

  const getAdminOverview = useCallback(() => fetchAdminOverview(), [])
  const getAdminAnalytics = useCallback((filters: AdminAnalyticsFilters) => fetchAdminAnalytics(filters), [])

  const getAdminVerifications = useCallback(
    (status: AdminVerificationStatus, limit: number, offset: number) =>
      fetchAdminPage<AdminVerificationSummary>(
        "verification",

        limit,

        offset,

        status,
      ),

    [],
  )

  const getAdminVerificationDocument = useCallback(async (profileId: string) => {
    const response = await adminRequest(`/v1/admin/verification/${encodeURIComponent(profileId)}/document`)
    if (!response.ok) throw getAdminResponseError(response.status)
    return await response.json() as { url: string; expiresInSeconds: number }
  }, [])

  const decideAdminVerification = useCallback(
    (profileId: string, decision: "verified" | "rejected", reason?: string) =>
      postAdminAction<AdminVerificationSummary>(
        `/v1/admin/verification/${encodeURIComponent(profileId)}/decision`,

        { decision, ...(reason ? { reason } : {}) },
      ),

    [],
  )

  const getAdminCustomerVerifications = useCallback((status: AdminVerificationStatus, limit: number, offset: number) => fetchAdminPage<AdminCustomerVerificationSummary>("customer-verification", limit, offset, status), [])

  const getAdminCustomerVerificationDocument = useCallback(async (verificationId: string) => {
    const response = await adminRequest(`/v1/admin/customer-verification/${encodeURIComponent(verificationId)}/document`)
    if (!response.ok) throw getAdminResponseError(response.status)
    return await response.json() as { url: string; expiresInSeconds: number }
  }, [])

  const decideAdminCustomerVerification = useCallback((verificationId: string, decision: "verified" | "rejected", reason?: string) => postAdminAction<AdminCustomerVerificationSummary>(`/v1/admin/customer-verification/${encodeURIComponent(verificationId)}/decision`, { decision, ...(reason ? { reason } : {}) }), [])

  const createModerationReport = useCallback(
    (report: Parameters<AuthContextValue["createModerationReport"]>[0]) =>
      postAdminAction<{ id: string; status: string; createdAt: string }>(
        "/v1/reports",

        report,
      ),

    [],
  )

  const getAdminModerationReports = useCallback(
    (status: AdminModerationStatus, limit: number, offset: number, searchValue = "") =>
      fetchAdminPage<AdminModerationReport>(
        "moderation",

        limit,

        offset,

        status,
        searchValue,
      ),

    [],
  )

  const decideAdminModerationReport = useCallback(
    (
      reportId: string,
      decision: AdminModerationDecision,
      enforcement: "none" | "suspend_account",
      reason?: string,
    ) =>
      postAdminAction<{ id: string; status: string }>(
        `/v1/admin/moderation/${encodeURIComponent(reportId)}/decision`,

        { decision, enforcement, ...(reason ? { reason } : {}) },
      ),

    [],
  )

  const getAdminMonitoring = useCallback(async () => {
    const response = await adminRequest("/v1/admin/monitoring")

    if (!response.ok) throw getAdminResponseError(response.status)

    return (await response.json()) as AdminMonitoringSnapshot
  }, [])

  const getAdminMonitoringHistory = useCallback(async (limit: number) => {
    const response = await adminRequest(
      `/v1/admin/monitoring/history?limit=${encodeURIComponent(String(limit))}`,
    )
    if (!response.ok) throw getAdminResponseError(response.status)
    return (await response.json()) as AdminMonitoringSnapshot[]
  }, [])

  const getAdminCategories = useCallback(async () => {
    const response = await adminRequest("/v1/admin/categories")
    if (!response.ok) throw getAdminResponseError(response.status)
    return (await response.json()) as AdminCategory[]
  }, [])

  const getMarketplaceCategories = useCallback(() => marketplaceRequest<MarketplaceServiceCategory[]>("/v1/marketplace/categories"), [])

  const saveAdminCategory = useCallback(
    (category: Omit<AdminCategory, "id" | "totalJobs" | "openJobs">) =>
      postAdminAction<AdminCategory>("/v1/admin/categories", category, "PUT"),
    [],
  )

  const getAdminSettings = useCallback(async () => {
    const response = await adminRequest("/v1/admin/settings")
    if (!response.ok) throw getAdminResponseError(response.status)
    return (await response.json()) as AdminSystemSettings
  }, [])

  const saveAdminSettings = useCallback(
    (settings: AdminSystemSettings) =>
      postAdminAction<AdminSystemSettings>("/v1/admin/settings", settings, "PUT"),
    [],
  )

  const getAdminAdCampaigns = useCallback(async (
    status: "all" | "pending" | "approved" | "rejected",
  ) => {
    const response = await adminRequest(
      `/v1/admin/ads?status=${encodeURIComponent(status)}`,
    )
    if (!response.ok) throw getAdminResponseError(response.status)
    return (await response.json()) as AdminAdCampaign[]
  }, [])

  const decideAdminAdCampaign = useCallback(
    (
      campaignId: string,
      decision: "approved" | "rejected",
      reason?: string,
    ) =>
      postAdminAction<AdminAdCampaign>(
        `/v1/admin/ads/${encodeURIComponent(campaignId)}/decision`,
        { decision, ...(reason ? { reason } : {}) },
      ),
    [],
  )

  const getMarketplaceJobs = useCallback(
    (view: "consumer" | "provider" | "feed") =>
      marketplaceRequest<MarketplaceJob[]>(
        `/v1/jobs?view=${encodeURIComponent(view)}`,
      ),
    [],
  )

  const getAdminServiceListings = useCallback((search: string, limit: number, offset: number) => adminRequest(`/v1/admin/listings?search=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`).then(async (response) => {
    if (!response.ok) throw getAdminResponseError(response.status)
    return await response.json() as AdminPage<AdminServiceListing>
  }), [])

  const releaseAdminServiceListing = useCallback((listingId: string, reason: string) => postAdminAction<AdminServiceListing>(`/v1/admin/listings/${encodeURIComponent(listingId)}/release`, { reason }), [])

  const getServiceListings = useCallback(
    (role: "consumer" | "provider", view: "feed" | "mine") => marketplaceRequest<ServiceListing[]>(`/v1/listings?role=${role}&view=${view}`),
    [],
  )

  const createServiceListing = useCallback((input: ServiceListingInput) => marketplacePost<ServiceListing>("/v1/listings", input), [])

  const uploadServiceListingMedia = useCallback(async (file: File): Promise<ServiceListingMedia> => {
    if (!supabase) throw new Error("Media storage is unavailable.")
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) throw new Error("Sign in again before uploading listing media.")

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"])
    if (!allowedTypes.has(file.type)) throw new Error("Use a JPG, PNG, WebP, MP4, or WebM file.")
    if (file.size < 1 || file.size > 6 * 1024 * 1024) throw new Error("Each photo or video must be 6 MB or smaller.")

    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "media"
    const path = `${session.user.id}/${crypto.randomUUID()}.${extension}`
    const { error } = await supabase.storage.from("listing-media").upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    })
    if (error) throw new Error("Could not upload this file. Check your connection and try again.")
    return { path, contentType: file.type, size: file.size }
  }, [])

  const deleteServiceListingMedia = useCallback(async (path: string) => {
    if (!supabase) throw new Error("Media storage is unavailable.")
    const { data: { session } } = await supabase.auth.getSession()
    if (!session || !path.startsWith(`${session.user.id}/`)) {
      throw new Error("You can only remove media you uploaded.")
    }
    const { error } = await supabase.storage.from("listing-media").remove([path])
    if (error) throw new Error("Could not remove this file. Try again.")
  }, [])

  const getServiceListingMediaUrl = useCallback((path: string) => {
    if (!supabase || !supabaseUrl) return ""
    const segments = path.replace(/^\/+/, "").split("/")
    if (!segments.length || segments.some((segment) => !segment || segment === "." || segment === "..")) return ""
    const safePath = segments.map((segment) => encodeURIComponent(segment)).join("/")
    const publicUrl = new URL(supabaseUrl)
    publicUrl.pathname = `/storage/v1/object/public/listing-media/${safePath}`
    return publicUrl.toString()
  }, [])

  const claimServiceListing = useCallback((listingId: string) => marketplacePost<ServiceListing>(`/v1/listings/${encodeURIComponent(listingId)}/claim`, {}), [])

  const transitionServiceListing = useCallback((listingId: string, transition: "start" | "submit-completion" | "confirm-completion" | "cancel" | "close") => marketplacePost<ServiceListing>(`/v1/listings/${encodeURIComponent(listingId)}/${transition}`, {}), [])

  const getServiceListingReviews = useCallback((role: "consumer" | "provider") => marketplaceRequest<ServiceListingReviewPage>(`/v1/reviews?role=${role}`), [])

  const createServiceListingReview = useCallback((listingId: string, rating: number, comment: string) => marketplacePost<ServiceListingReview>(`/v1/listings/${encodeURIComponent(listingId)}/reviews`, { rating, comment }), [])

  const getServiceListingMessages = useCallback((listingId: string, role: "consumer" | "provider") => marketplaceRequest<ServiceListingMessage[]>(`/v1/listings/${encodeURIComponent(listingId)}/messages?role=${role}`), [])

  const sendServiceListingMessage = useCallback((listingId: string, role: "consumer" | "provider", body: string) => marketplacePost<ServiceListingMessage>(`/v1/listings/${encodeURIComponent(listingId)}/messages?role=${role}`, { body }), [])

  const getAdminServiceListingMessages = useCallback((limit: number, offset: number, searchValue = "") => fetchAdminPage<AdminServiceListingMessage>("messages", limit, offset, undefined, searchValue), [])
  const getAdminSupportCases = useCallback(async (search: string, status: SupportCaseStatus | "all", limit: number, offset: number) => {
    const query = new URLSearchParams({ search, status, limit: String(limit), offset: String(offset) })
    const response = await adminRequest(`/v1/admin/support/cases?${query}`)
    if (!response.ok) throw getAdminResponseError(response.status)
    return await response.json() as AdminPage<SupportCase>
  }, [])
  const getAdminSupportCaseMessages = useCallback(async (caseId: string) => {
    const response = await adminRequest(`/v1/admin/support/cases/${encodeURIComponent(caseId)}/messages`)
    if (!response.ok) throw getAdminResponseError(response.status)
    return await response.json() as SupportCaseMessage[]
  }, [])
  const sendAdminSupportMessage = useCallback((caseId: string, body: string) => postAdminAction<SupportCaseMessage>(`/v1/admin/support/cases/${encodeURIComponent(caseId)}/messages`, { body }), [])
  const updateAdminSupportCaseStatus = useCallback((caseId: string, status: SupportCaseStatus) => postAdminAction<SupportCase>(`/v1/admin/support/cases/${encodeURIComponent(caseId)}/status`, { status }, "PATCH"), [])

  const getAdminJobPayments = useCallback(async (search: string, status: JobPaymentStatus | "all", limit: number, offset: number) => {
    const query = new URLSearchParams({ search, status, limit: String(limit), offset: String(offset) })
    const response = await adminRequest(`/v1/admin/payments?${query}`)
    if (!response.ok) throw getAdminResponseError(response.status)
    return await response.json() as AdminJobPaymentPage
  }, [])
  const resolveAdminJobPayment = useCallback((paymentId: string, resolution: "paid" | "refunded", reason: string) => postAdminAction<JobPaymentRecord>(`/v1/admin/payments/${encodeURIComponent(paymentId)}/resolve`, { resolution, reason }), [])
  const recordAdminPlatformFeeReceipt = useCallback((paymentId: string, receiptReference: string) => postAdminAction<JobPaymentRecord>(`/v1/admin/payments/${encodeURIComponent(paymentId)}/platform-fee/confirm`, { receiptReference }), [])
  const setAdminProviderPayoutHold = useCallback(async (providerId: string, held: boolean, reason: string) => {
    const response = await adminRequest(`/v1/admin/providers/${encodeURIComponent(providerId)}/payout-hold`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ held, reason }) })
    if (!response.ok) throw getAdminResponseError(response.status)
  }, [])

  const getMarketplaceProviders = useCallback(
    (search: string, region: string, limit = 25, offset = 0) => {
      const query = new URLSearchParams({
        search,
        region,
        limit: String(limit),
        offset: String(offset),
      })
      return marketplaceRequest<AdminPage<MarketplaceProvider>>(
        `/v1/providers?${query}`,
      )
    },
    [],
  )

  const getMarketplaceProvider = useCallback(
    (providerId: string, jobId?: string) =>
      marketplaceRequest<MarketplaceProvider>(
        `/v1/providers/${encodeURIComponent(providerId)}${jobId ? `?jobId=${encodeURIComponent(jobId)}` : ""}`,
      ),
    [],
  )

  const updateMarketplaceProviderProfile = useCallback(
    (input: MarketplaceProviderProfileInput) => marketplaceRequest<MarketplaceProvider>("/v1/me/provider-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
    [],
  )

  const getSavedProviders = useCallback(
    () => marketplaceRequest<MarketplaceProvider[]>("/v1/me/saved-providers"),
    [],
  )

  const saveProvider = useCallback(async (providerId: string) => {
    await marketplacePost<{ saved: boolean }>("/v1/me/saved-providers", { providerId })
  }, [])

  const removeSavedProvider = useCallback(async (providerId: string) => {
    await marketplaceRequest<{ saved: boolean }>(`/v1/me/saved-providers/${encodeURIComponent(providerId)}`, { method: "DELETE" })
  }, [])

  const getPublicProviderReviews = useCallback((providerId: string) => marketplaceRequest<ServiceListingReview[]>(`/v1/providers/${encodeURIComponent(providerId)}/reviews`), [])

  const getMarketplaceNotifications = useCallback(
    (limit = 50, offset = 0) =>
      marketplaceRequest<AdminPage<MarketplaceNotification>>(
        `/v1/notifications?limit=${limit}&offset=${offset}`,
      ),
    [],
  )

  const markMarketplaceNotificationRead = useCallback(
    async (notificationId: string) => {
      await marketplacePost<{ read: boolean }>(
        `/v1/notifications/${encodeURIComponent(notificationId)}/read`,
        {},
      )
    },
    [],
  )

  const getMarketplaceJob = useCallback(
    (jobId: string, role: "consumer" | "provider") =>
      marketplaceRequest<MarketplaceJob>(
        `/v1/jobs/${encodeURIComponent(jobId)}?role=${role}`,
      ),
    [],
  )

  const getJobPayments = useCallback((role: "consumer" | "provider") => marketplaceRequest<JobPaymentRecord[]>(`/v1/me/payments?role=${role}`), [])
  const getProviderWalletPayments = useCallback(() => marketplaceRequest<ProviderWalletPayment[]>("/v1/me/payments?role=provider"), [])
  const reportJobPayment = useCallback((jobId: string, method: JobPaymentMethod) => marketplacePost<JobPaymentRecord>(`/v1/jobs/${encodeURIComponent(jobId)}/payment/report`, { method }), [])
  const reportHirerPlatformFee = useCallback((jobId: string, paymentReference: string) => marketplacePost<JobPaymentRecord>(`/v1/jobs/${encodeURIComponent(jobId)}/platform-fee/report`, { paymentReference }), [])
  const confirmJobPayment = useCallback((jobId: string) => marketplacePost<JobPaymentRecord>(`/v1/jobs/${encodeURIComponent(jobId)}/payment/confirm`, {}), [])
  const disputeJobPayment = useCallback((jobId: string, reason: string) => marketplacePost<JobPaymentRecord>(`/v1/jobs/${encodeURIComponent(jobId)}/payment/dispute`, { reason }), [])

  const getMarketplaceQuotes = useCallback(
    (jobId: string, role: "consumer" | "provider") =>
      marketplaceRequest<MarketplaceQuote[]>(
        `/v1/jobs/${encodeURIComponent(jobId)}/quotes?role=${role}`,
      ),
    [],
  )

  const getMyMarketplaceQuotes = useCallback(
    () => marketplaceRequest<MarketplaceProviderQuote[]>("/v1/me/quotes"),
    [],
  )

  const createMarketplaceJob = useCallback(
    (input: MarketplaceJobInput) =>
      marketplacePost<MarketplaceJob>("/v1/jobs", input),
    [],
  )

  const submitMarketplaceQuote = useCallback(
    (jobId: string, input: MarketplaceQuoteInput) =>
      marketplacePost<MarketplaceQuote>(
        `/v1/jobs/${encodeURIComponent(jobId)}/quotes`,
        input,
      ),
    [],
  )

  const acceptMarketplaceQuote = useCallback(
    (jobId: string, quoteId: string) =>
      marketplacePost<MarketplaceJob>(
        `/v1/jobs/${encodeURIComponent(jobId)}/quotes/${encodeURIComponent(quoteId)}/accept`,
      ),
    [],
  )

  const transitionMarketplaceJob = useCallback(
    (jobId: string, transition: MarketplaceJobTransition, details?: { note: string }) =>
      marketplacePost<MarketplaceJob>(
        `/v1/jobs/${encodeURIComponent(jobId)}/${transition}`,
        details ?? {},
      ),
    [],
  )

  const getMarketplaceConversations = useCallback(
    (role: "consumer" | "provider") => marketplaceRequest<MarketplaceConversation[]>(`/v1/job-conversations?role=${role}`),
    [],
  )

  const openMarketplaceConversation = useCallback(
    (jobId: string, role: "consumer" | "provider", providerId?: string) => marketplacePost<MarketplaceConversation>(
      `/v1/jobs/${encodeURIComponent(jobId)}/conversations?role=${role}`,
      providerId ? { providerId } : {},
    ),
    [],
  )

  const getMarketplaceConversationMessages = useCallback(
    (conversationId: string) => marketplaceRequest<MarketplaceConversationMessage[]>(`/v1/job-conversations/${encodeURIComponent(conversationId)}/messages`),
    [],
  )

  const sendMarketplaceConversationMessage = useCallback(
    (conversationId: string, body: string) => marketplacePost<MarketplaceConversationMessage>(`/v1/job-conversations/${encodeURIComponent(conversationId)}/messages`, { body }),
    [],
  )

  const getSupportCases = useCallback((role: "consumer" | "provider") => marketplaceRequest<SupportCase[]>(`/v1/support/cases?role=${role}`), [])
  const createSupportCase = useCallback((role: "consumer" | "provider", input: CreateSupportCaseInput) => marketplacePost<SupportCase>(`/v1/support/cases?role=${role}`, input), [])
  const getSupportCaseMessages = useCallback((role: "consumer" | "provider", caseId: string) => marketplaceRequest<SupportCaseMessage[]>(`/v1/support/cases/${encodeURIComponent(caseId)}/messages?role=${role}`), [])
  const sendSupportCaseMessage = useCallback((role: "consumer" | "provider", caseId: string, body: string) => marketplacePost<SupportCaseMessage>(`/v1/support/cases/${encodeURIComponent(caseId)}/messages?role=${role}`, { body }), [])

  const subscribeMarketplaceChanges = useCallback((onChange: () => void) => {
    if (!supabase) {
      throw new Error("Realtime services are not configured.")
    }

    const refreshAfterChange = () => {
      invalidateMarketplaceReadCache()
      onChange()
    }
    const channel = supabase
      .channel(`marketplace:${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "jobs" },
        refreshAfterChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "quotes" },
        refreshAfterChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_listings" },
        refreshAfterChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "saved_providers" },
        refreshAfterChange,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "provider_profiles" },
        refreshAfterChange,
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error("Unable to subscribe to marketplace updates.", status)
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        configured: Boolean(supabase),

        loading,

        profile,

        recovery,

        rememberMe: rememberSessionState.current,


        policyConsentRequired,

        setRememberMe: (remember) => {
          rememberSessionState.current = remember

          window.localStorage.setItem(
            "oddjobs-auth-remember-session",

            remember ? "1" : "0",
          )
        },

        acceptCurrentPolicies,

        refreshProfile,

        requestOtp,

        signInWithPassword,

        signUp,

        signInWithOAuth,

        requestPasswordReset,

        updatePassword,

        completePasswordRecovery: () => setRecovery(false),

        verifyOtp,

        resendOtp,

        submitProviderApplication,

        getProviderVerification,
        getCustomerVerification,
        submitCustomerVerification,
        updateProfile,
        getProfileAvatarUrl,

        getAdminUsers,

        reinstateAdminUser,

        setAdminCommissionRestriction,

        getAdminAuditEvents,
        getAdminAccess,
        getAdminTeam,
        setAdminMemberRole,
        removeAdminMember,
        inviteAdminUser,
        revokeAdminInvitation,
        acceptAdminInvitation,
        getAdminAlerts,
        updateAdminAlert,

        getAdminMarketplaceActivity,

        getAdminMarketplaceJobs,

        getAdminMarketplaceJob,
        getAdminServiceListings,
        releaseAdminServiceListing,

        getAdminOverview,
        getAdminAnalytics,

        getAdminVerifications,

        getAdminVerificationDocument,

        decideAdminVerification,
        getAdminCustomerVerifications,
        getAdminCustomerVerificationDocument,
        decideAdminCustomerVerification,

        createModerationReport,

        getAdminModerationReports,

        decideAdminModerationReport,

        getAdminMonitoring,

        getAdminMonitoringHistory,

        getAdminCategories,

        getMarketplaceCategories,

        saveAdminCategory,

        getAdminSettings,

        saveAdminSettings,

        getAdminAdCampaigns,

        decideAdminAdCampaign,

        getMarketplaceJobs,
        getServiceListings,
        createServiceListing,
        uploadServiceListingMedia,
        deleteServiceListingMedia,
        getServiceListingMediaUrl,
        claimServiceListing,
        transitionServiceListing,
        getServiceListingReviews,
        createServiceListingReview,
        getServiceListingMessages,
        sendServiceListingMessage,
        getAdminServiceListingMessages,
        getAdminSupportCases,
        getAdminSupportCaseMessages,
        sendAdminSupportMessage,
        updateAdminSupportCaseStatus,
        getAdminJobPayments,
        resolveAdminJobPayment,
        recordAdminPlatformFeeReceipt,
        setAdminProviderPayoutHold,

        getMarketplaceProviders,

        getMarketplaceProvider,
        updateMarketplaceProviderProfile,
        getSavedProviders,
        saveProvider,
        removeSavedProvider,
        getPublicProviderReviews,

        getMarketplaceNotifications,

        markMarketplaceNotificationRead,

        getMarketplaceJob,

        getMarketplaceQuotes,
        getMyMarketplaceQuotes,

        createMarketplaceJob,

        submitMarketplaceQuote,

        acceptMarketplaceQuote,

        transitionMarketplaceJob,
        getJobPayments,
        getProviderWalletPayments,
        reportJobPayment,
        reportHirerPlatformFee,
        confirmJobPayment,
        disputeJobPayment,
        getMarketplaceConversations,
        openMarketplaceConversation,
        getMarketplaceConversationMessages,
        sendMarketplaceConversationMessage,
        getSupportCases,
        createSupportCase,
        getSupportCaseMessages,
        sendSupportCaseMessage,

        subscribeMarketplaceChanges,

        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) throw new Error("AuthProvider is required.")

  return context
}
