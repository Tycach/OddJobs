import { PrismaPg } from "@prisma/adapter-pg"
import { randomUUID } from "node:crypto"

import { PrismaClient, type Prisma } from "./generated/prisma/client.ts"

import {
  MarketplaceConflictError,
  ModerationEnforcementError,
} from "./auth/types.js"

import type {
  AuthenticatedPrincipal,
  AdminAuditEvent,
  AdminAuditFilters,
  AdminAlertSummary,
  AdminMemberRole,
  AdminTeamSummary,
  AdminInvitationSummary,
  AdminAdCampaign,
  AdminCategory,
  AdminMarketplaceActivity,
  AdminMarketplaceJob,
  AdminMarketplaceJobFilters,
  MarketplaceNotification,
  ServiceListing,
  ServiceListingMessage,
  AdminServiceListingMessage,
  ServiceListingReview,
  ServiceListingReviewPage,
  ServiceListingMedia,
  CreateServiceListingInput,
  AdminModerationDecision,
  AdminModerationReport,
  AdminModerationStatus,
  AdminMonitoringSnapshot,
  AdminSystemSettings,
  AdminOverview,
  AdminAnalyticsFilters,
  AdminAnalyticsReport,
  AdminPage,
  AdminJobPaymentPage,
  AdminCommissionFilter,
  AdminStore,
  AdminVerificationDecision,
  AdminVerificationSummary,
  AdminCustomerVerificationSummary,
  AdminUserSummary,
  AdminVerificationStatus,
  ProviderApplication,
  ProviderApplicationInput,
  ProviderVerificationSummary,
  CustomerVerificationSummary,
  CreateMarketplaceJobInput,
  MarketplaceJob,
  MarketplaceProvider,
  MarketplaceQuote,
  MarketplaceProviderQuote,
  MarketplaceStore,
  JobConversation as JobConversationDto,
  JobConversationMessage,
  SupportCaseMessage,
  SupportCaseStatus,
  SupportCategory,
  SupportCaseSummary,
  CreateSupportCaseInput,
  JobPaymentRecord,
  JobPaymentMethod,
  JobPaymentStatus,
  SubmitMarketplaceQuoteInput,
  UserProfile,
  UserProfileStore,
} from "./auth/types.js"

export interface ReadinessDatabase {
  check(): Promise<void>

  close(): Promise<void>
}

function calculateDistanceKm(origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }): number {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const latitudeDelta = radians(destination.latitude - origin.latitude)
  const longitudeDelta = radians(destination.longitude - origin.longitude)
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(origin.latitude)) * Math.cos(radians(destination.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const verificationStatusToDatabase = {
  not_started: "NOT_STARTED",

  in_review: "IN_REVIEW",

  verified: "VERIFIED",

  rejected: "REJECTED",
} as const

const moderationStatusToDatabase = {
  open: "OPEN",

  reviewing: "REVIEWING",

  resolved: "RESOLVED",

  dismissed: "DISMISSED",
} as const

const moderationDecisionToDatabase = {
  reviewing: "REVIEWING",

  resolved: "RESOLVED",

  dismissed: "DISMISSED",
} as const

const defaultAdminSettings: AdminSystemSettings = {
  marketplaceCommissionPercent: 10,
  newProviderApplicationsEnabled: true,
  adsEnabled: true,
}

const jobPaymentRelations = {
  job: { select: { id: true, publicReference: true, title: true, status: true } },
  customer: { select: { id: true, displayName: true } },
  provider: { select: { id: true, displayName: true, providerProfile: { select: { payoutHoldAt: true, payoutHoldReason: true } } } },
  events: { select: { action: true, actorId: true, metadata: true, createdAt: true }, orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.JobPaymentInclude

type HydratedJobPayment = Prisma.JobPaymentGetPayload<{ include: typeof jobPaymentRelations }>

const supportCaseRelations = {
  job: { select: { id: true, publicReference: true, title: true } },
  requester: { select: { id: true, displayName: true } },
  messages: { orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }], take: 1 },
} satisfies Prisma.SupportCaseInclude

type HydratedSupportCase = Prisma.SupportCaseGetPayload<{ include: typeof supportCaseRelations }>

function mapSupportCase(row: HydratedSupportCase): SupportCaseSummary {
  return {
    id: row.id, caseReference: row.caseReference,
    jobId: row.job.id, jobReference: row.job.publicReference, jobTitle: row.job.title,
    requesterId: row.requester.id, requesterName: row.requester.displayName,
    requesterRole: row.requesterRole.toLowerCase() as SupportCaseSummary["requesterRole"],
    category: row.category.toLowerCase() as SupportCategory,
    subject: row.subject, status: row.status.toLowerCase() as SupportCaseStatus,
    latestMessage: row.messages[0]?.body ?? "", updatedAt: row.updatedAt.toISOString(), createdAt: row.createdAt.toISOString(),
  }
}

function mapSupportMessage(row: { id: string; caseId: string; senderId: string; senderRole: string; body: string; createdAt: Date; sender: { displayName: string } }): SupportCaseMessage {
  return { id: row.id, caseId: row.caseId, senderId: row.senderId, senderName: row.sender.displayName, senderRole: row.senderRole.toLowerCase() as SupportCaseMessage["senderRole"], body: row.body, createdAt: row.createdAt.toISOString() }
}

function mapJobPayment(row: HydratedJobPayment): JobPaymentRecord {
  return {
    id: row.id,
    paymentReference: row.paymentReference,
    jobId: row.jobId,
    jobReference: row.job.publicReference,
    jobTitle: row.job.title,
    jobStatus: row.job.status.toLowerCase() as JobPaymentRecord["jobStatus"],
    quoteId: row.quoteId,
    customerId: row.customerId,
    customerName: row.customer.displayName,
    providerId: row.providerId,
    providerName: row.provider.displayName,
    grossAmountMinor: Number(row.grossAmountMinor),
    commissionBasisPoints: row.commissionBasisPoints,
    commissionAmountMinor: Number(row.commissionAmountMinor),
    providerAmountMinor: Number(row.providerAmountMinor),
    currency: row.currency.trim(),
    method: row.method?.toLowerCase() as JobPaymentRecord["method"] ?? null,
    status: row.status.toLowerCase() as JobPaymentRecord["status"],
    reportedByUserId: row.reportedByUserId,
    reportedAt: row.reportedAt?.toISOString() ?? null,
    confirmedByUserId: row.confirmedByUserId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    platformFeeStatus: row.platformFeeStatus.toLowerCase() as JobPaymentRecord["platformFeeStatus"],
    platformFeeReportedByUserId: row.platformFeeReportedByUserId,
    platformFeeReportedAt: row.platformFeeReportedAt?.toISOString() ?? null,
    platformFeeDueAt: row.platformFeeDueAt?.toISOString() ?? null,
    platformFeePaymentReference: row.platformFeePaymentReference,
    platformFeeReceivedAt: row.platformFeeReceivedAt?.toISOString() ?? null,
    platformFeeReceiptReference: row.platformFeeReceiptReference,
    platformFeeCorrectionReason: row.platformFeeCorrectionReason,
    platformFeeReminderCycle: row.platformFeeReminderCycle,
    platformFeeEvents: row.events.map((event) => ({ action: event.action, actorId: event.actorId, metadata: event.metadata as Record<string, string | number | boolean | null>, createdAt: event.createdAt.toISOString() })),
    disputeReason: row.disputeReason,
    resolutionNote: row.resolutionNote,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    payoutHoldAt: row.provider.providerProfile?.payoutHoldAt?.toISOString() ?? null,
    payoutHoldReason: row.provider.providerProfile?.payoutHoldReason ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export class PrismaDatabase
  implements ReadinessDatabase, UserProfileStore, AdminStore, MarketplaceStore
{
  readonly client: PrismaClient
  private avatarPathColumnAvailable: Promise<boolean> | null = null

  constructor(connectionString: string, poolMax = 5) {
    const adapter = new PrismaPg({
      connectionString,

      max: poolMax,

      connectionTimeoutMillis: 3000,

      idleTimeoutMillis: 30000,
    })

    this.client = new PrismaClient({ adapter })
  }

  private hasAvatarPathColumn(): Promise<boolean> {
    if (!this.avatarPathColumnAvailable) {
      this.avatarPathColumnAvailable = this.client.$queryRaw<{ column_exists: boolean }[]>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'avatar_path'
        ) AS column_exists
      `.then((rows) => rows[0]?.column_exists ?? false)
    }
    return this.avatarPathColumnAvailable
  }

  async canSaveProfileAvatar(): Promise<boolean> {
    return this.hasAvatarPathColumn()
  }

  private mapServiceListing(listing: {
    id: string; publicReference: string; providerId: string; claimedByCustomerId: string | null; title: string; description: string; media: Prisma.JsonValue;
    category: string; locationLabel: string; budgetMinor: bigint | null; currency: string; status: string;
    claimExpiresAt: Date | null; createdAt: Date; updatedAt: Date;
    provider: { displayName: string }; claimedByCustomer?: { displayName: string } | null;
    activity?: { action: string; requestId: string; createdAt: Date; actor: { displayName: string } | null }[];
  }): ServiceListing {
    return {
      id: listing.id, jobReference: listing.publicReference, providerId: listing.providerId, providerName: listing.provider.displayName,
      customerId: listing.claimedByCustomerId, customerName: listing.claimedByCustomer?.displayName ?? null,
      title: listing.title, description: listing.description, category: listing.category,
      locationLabel: listing.locationLabel, budgetMinor: listing.budgetMinor === null ? null : Number(listing.budgetMinor),
      media: Array.isArray(listing.media) ? listing.media as unknown as ServiceListingMedia[] : [],
      currency: listing.currency.trim(), status: listing.status.toLowerCase() as ServiceListing["status"],
      claimExpiresAt: listing.claimExpiresAt?.toISOString() ?? null,
      createdAt: listing.createdAt.toISOString(), updatedAt: listing.updatedAt.toISOString(),
      ...(listing.activity ? { activity: listing.activity.map((event) => ({ actorName: event.actor?.displayName ?? "System", action: event.action, requestId: event.requestId, createdAt: event.createdAt.toISOString() })) } : {}),
    }
  }

  async listServiceListings(userId: string, role: "consumer" | "provider", view: "feed" | "mine"): Promise<ServiceListing[]> {
    const now = new Date()
    const expiredClaims = await this.client.serviceListing.findMany({
      where: { status: "CLAIMED", claimExpiresAt: { lt: now } },
      select: { id: true, providerId: true, claimedByCustomerId: true, title: true },
    })
    if (expiredClaims.length) {
      await this.client.$transaction(async (transaction) => {
        for (const claim of expiredClaims) {
          const released = await transaction.serviceListing.updateMany({
            where: { id: claim.id, status: "CLAIMED", claimExpiresAt: { lt: now } },
            data: { status: "OPEN", claimedByCustomerId: null, claimExpiresAt: null },
          })
          if (!released.count) continue
          const requestId = `claim-expiry:${claim.id}:${now.getTime()}`.slice(0, 80)
          await transaction.serviceListingActivity.create({ data: { listingId: claim.id, actorUserId: null, action: "listing.claim_expired", metadata: {}, requestId } })
          for (const userId of [claim.claimedByCustomerId, claim.providerId]) {
            if (!userId) continue
            await transaction.marketplaceNotification.create({ data: {
              userId, type: "listing.claim_expired", title: "A listing claim expired",
              body: `The unstarted claim for “${claim.title}” expired. The listing is open again.`, jobId: claim.id,
              dedupeKey: `${requestId}:${userId}`.slice(0, 180),
            } })
          }
        }
      })
    }
    const where = role === "consumer"
      ? view === "feed" ? { status: "OPEN" as const, providerId: { not: userId } } : { claimedByCustomerId: userId }
      : { providerId: userId }
    const listings = await this.client.serviceListing.findMany({
      where,
      include: { provider: { select: { displayName: true } }, claimedByCustomer: { select: { displayName: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })
    return listings.map((listing) => this.mapServiceListing(listing))
  }

  private mapServiceListingMessage(message: { id: string; listingId: string; senderId: string; body: string; createdAt: Date; sender: { displayName: string } }): ServiceListingMessage {
    return { id: message.id, listingId: message.listingId, senderId: message.senderId, senderName: message.sender.displayName, body: message.body, createdAt: message.createdAt.toISOString() }
  }

  private mapJobConversation(conversation: {
    id: string; jobId: string; quoteId: string | null; updatedAt: Date;
    job: { publicReference: string; title: string; status: string };
    customer: { id: string; displayName: string };
    provider: { id: string; displayName: string };
    messages: { body: string; createdAt: Date }[];
    unreadCount: number;
  }): JobConversationDto {
    const latest = conversation.messages[0]
    return {
      id: conversation.id,
      jobId: conversation.jobId,
      jobReference: conversation.job.publicReference,
      jobTitle: conversation.job.title,
      jobStatus: conversation.job.status.toLowerCase() as JobConversationDto["jobStatus"],
      customerId: conversation.customer.id,
      customerName: conversation.customer.displayName,
      providerId: conversation.provider.id,
      providerName: conversation.provider.displayName,
      quoteId: conversation.quoteId,
      latestMessage: latest?.body ?? null,
      latestMessageAt: latest?.createdAt.toISOString() ?? null,
      unreadCount: conversation.unreadCount,
      updatedAt: conversation.updatedAt.toISOString(),
    }
  }

  private async getJobConversationDto(conversationId: string, userId: string): Promise<JobConversationDto | null> {
    const conversation = await this.client.jobConversation.findFirst({
      where: { id: conversationId, OR: [{ customerId: userId }, { providerId: userId }] },
      include: {
        job: { select: { publicReference: true, title: true, status: true } },
        customer: { select: { id: true, displayName: true } },
        provider: { select: { id: true, displayName: true } },
        messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
      },
    })
    if (!conversation) return null
    const unreadCount = await this.client.message.count({
      where: { conversationId, senderId: { not: userId }, readAt: null },
    })
    return this.mapJobConversation({ ...conversation, unreadCount })
  }

  async listJobConversations(userId: string, role: "consumer" | "provider"): Promise<JobConversationDto[]> {
    const conversations = await this.client.jobConversation.findMany({
      where: role === "consumer" ? { customerId: userId } : { providerId: userId },
      include: {
        job: { select: { publicReference: true, title: true, status: true } },
        customer: { select: { id: true, displayName: true } },
        provider: { select: { id: true, displayName: true } },
        messages: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1 },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    })
    return Promise.all(conversations.map(async (conversation) => {
      const unreadCount = await this.client.message.count({
        where: { conversationId: conversation.id, senderId: { not: userId }, readAt: null },
      })
      return this.mapJobConversation({ ...conversation, unreadCount })
    }))
  }

  async openJobConversation(userId: string, role: "consumer" | "provider", jobId: string, requestedProviderId?: string): Promise<JobConversationDto | null> {
    const job = await this.client.job.findUnique({
      where: { id: jobId },
      select: { id: true, customerId: true, status: true, title: true },
    })
    if (!job) return null
    const providerId = role === "provider" ? userId : requestedProviderId
    if (!providerId || job.customerId === providerId) return null
    const existing = await this.client.jobConversation.findUnique({
      where: { jobId_providerId: { jobId, providerId } },
      select: { id: true, customerId: true },
    })
    if (existing && existing.customerId !== job.customerId) return null

    const eligibleQuote = await this.client.quote.findFirst({
      where: {
        jobId,
        providerId,
        status: { in: ["SUBMITTED", "ACCEPTED"] },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: { id: true },
    })
    if (role === "consumer" && !eligibleQuote && !existing) return null
    if (!existing && job.status !== "OPEN" && !eligibleQuote) return null

    let conversationId = existing?.id
    if (!conversationId) {
      try {
        const created = await this.client.jobConversation.create({
          data: {
            jobId,
            customerId: job.customerId,
            providerId,
            quoteId: eligibleQuote?.id ?? null,
          },
          select: { id: true },
        })
        conversationId = created.id
      } catch (error) {
        if (!(typeof error === "object" && error !== null && "code" in error && error.code === "P2002")) throw error
        const concurrent = await this.client.jobConversation.findUnique({
          where: { jobId_providerId: { jobId, providerId } },
          select: { id: true },
        })
        conversationId = concurrent?.id
      }
    } else if (eligibleQuote) {
      await this.client.jobConversation.update({
        where: { id: conversationId },
        data: { quoteId: eligibleQuote.id },
      })
    }
    return conversationId ? this.getJobConversationDto(conversationId, userId) : null
  }

  async listJobConversationMessages(userId: string, conversationId: string): Promise<JobConversationMessage[] | null> {
    return this.client.$transaction(async (transaction) => {
      const conversation = await transaction.jobConversation.findFirst({
        where: { id: conversationId, OR: [{ customerId: userId }, { providerId: userId }] },
        select: { id: true, jobId: true, customerId: true },
      })
      if (!conversation) return null
      await transaction.message.updateMany({
        where: { conversationId, senderId: { not: userId }, readAt: null },
        data: { readAt: new Date() },
      })
      const messages = await transaction.message.findMany({
        where: { conversationId },
        include: { sender: { select: { displayName: true } } },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
      return messages.map((message) => ({
        id: message.id,
        conversationId,
        jobId: message.jobId,
        senderId: message.senderId,
        senderName: message.sender.displayName,
        senderRole: message.senderId === conversation.customerId ? "consumer" : "provider",
        body: message.body,
        readAt: message.readAt?.toISOString() ?? null,
        createdAt: message.createdAt.toISOString(),
      }))
    })
  }

  async createJobConversationMessage(userId: string, conversationId: string, body: string, requestId: string): Promise<JobConversationMessage | null> {
    return this.client.$transaction(async (transaction) => {
      const conversation = await transaction.jobConversation.findFirst({
        where: { id: conversationId, OR: [{ customerId: userId }, { providerId: userId }] },
        include: { job: { select: { title: true } } },
      })
      if (!conversation) return null
      const recipientUserId = conversation.customerId === userId ? conversation.providerId : conversation.customerId
      const message = await transaction.message.create({
        data: { jobId: conversation.jobId, conversationId, senderId: userId, body: body.trim() },
        include: { sender: { select: { displayName: true } } },
      })
      await transaction.jobConversation.update({ where: { id: conversationId }, data: { updatedAt: message.createdAt } })
      await this.enqueueMarketplaceEvent(transaction, {
        requestId,
        eventType: "message.received",
        jobId: conversation.jobId,
        quoteId: conversation.quoteId,
        recipientUserId,
        title: "New message about your job",
        body: `${message.sender.displayName} sent a message about ${conversation.job.title}.`,
        payload: { conversationId },
      })
      return {
        id: message.id,
        conversationId,
        jobId: message.jobId,
        senderId: message.senderId,
        senderName: message.sender.displayName,
        senderRole: message.senderId === conversation.customerId ? "consumer" : "provider",
        body: message.body,
        readAt: null,
        createdAt: message.createdAt.toISOString(),
      }
    })
  }

  async listSupportCases(userId: string, role: "consumer" | "provider"): Promise<SupportCaseSummary[]> {
    const rows = await this.client.supportCase.findMany({
      where: { requesterId: userId, requesterRole: role.toUpperCase() as "CONSUMER" | "PROVIDER" },
      include: supportCaseRelations,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    })
    return rows.map(mapSupportCase)
  }

  async createSupportCase(userId: string, role: "consumer" | "provider", input: CreateSupportCaseInput, requestId: string): Promise<SupportCaseSummary | null> {
    const job = await this.client.job.findUnique({ where: { publicReference: input.jobReference.trim().toUpperCase() }, select: { id: true, customerId: true } })
    if (!job) return null
    const eligible = role === "consumer"
      ? job.customerId === userId
      : Boolean(await this.client.quote.findFirst({ where: { jobId: job.id, providerId: userId }, select: { id: true } }))
    if (!eligible) return null
    return this.client.$transaction(async (transaction) => {
      const supportCase = await transaction.supportCase.create({
        data: {
          jobId: job.id, requesterId: userId,
          requesterRole: role.toUpperCase() as "CONSUMER" | "PROVIDER",
          category: input.category.toUpperCase() as "GENERAL" | "PAYMENT" | "WORK_REVIEW" | "SAFETY" | "ACCOUNT" | "OTHER",
          subject: input.subject.trim(),
          messages: { create: { senderId: userId, senderRole: role.toUpperCase() as "CONSUMER" | "PROVIDER", body: input.body.trim() } },
        }, include: supportCaseRelations,
      })
      const administrators = await transaction.userRoleAssignment.findMany({ where: { role: "ADMIN" }, select: { userId: true } })
      if (administrators.length) await transaction.marketplaceNotification.createMany({
        data: [...new Set(administrators.map((item) => item.userId))].map((adminId) => ({
          userId: adminId, type: "support.case_created", title: "New job support case",
          body: `${supportCase.requester.displayName} (${role === "provider" ? "Worker" : "Hirer"}) needs help with ${supportCase.job.publicReference}: ${supportCase.subject}`,
          jobId: supportCase.jobId, dedupeKey: `support-case:${supportCase.id}:created:${adminId}`.slice(0, 180),
        })), skipDuplicates: true,
      })
      await transaction.outboxEvent.create({ data: {
        eventType: "support.case.created", aggregateType: "support_case", aggregateId: supportCase.id,
        payload: { jobId: supportCase.jobId, requesterId: userId, requesterRole: role, caseReference: supportCase.caseReference },
        requestId, dedupeKey: `support-case:${supportCase.id}:created`.slice(0, 180),
      } })
      return mapSupportCase(supportCase)
    })
  }

  async listSupportCaseMessages(userId: string, role: "consumer" | "provider", caseId: string): Promise<SupportCaseMessage[] | null> {
    const supportCase = await this.client.supportCase.findFirst({ where: { id: caseId, requesterId: userId, requesterRole: role.toUpperCase() as "CONSUMER" | "PROVIDER" }, select: { id: true } })
    if (!supportCase) return null
    const messages = await this.client.supportMessage.findMany({ where: { caseId }, include: { sender: { select: { displayName: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    return messages.map(mapSupportMessage)
  }

  async createSupportCaseMessage(userId: string, role: "consumer" | "provider", caseId: string, body: string, requestId: string): Promise<SupportCaseMessage | null> {
    return this.client.$transaction(async (transaction) => {
      const supportCase = await transaction.supportCase.findFirst({ where: { id: caseId, requesterId: userId, requesterRole: role.toUpperCase() as "CONSUMER" | "PROVIDER" }, include: { job: { select: { publicReference: true } } } })
      if (!supportCase) return null
      const message = await transaction.supportMessage.create({ data: { caseId, senderId: userId, senderRole: role.toUpperCase() as "CONSUMER" | "PROVIDER", body: body.trim() }, include: { sender: { select: { displayName: true } } } })
      await transaction.supportCase.update({ where: { id: caseId }, data: { status: "OPEN", resolvedAt: null, updatedAt: message.createdAt } })
      const administrators = await transaction.userRoleAssignment.findMany({ where: { role: "ADMIN" }, select: { userId: true } })
      if (administrators.length) await transaction.marketplaceNotification.createMany({
        data: [...new Set(administrators.map((item) => item.userId))].map((adminId) => ({
          userId: adminId, type: "support.message_received", title: "New reply on a support case",
          body: `${message.sender.displayName} (${role === "provider" ? "Worker" : "Hirer"}) replied on ${supportCase.job.publicReference}.`,
          jobId: supportCase.jobId, dedupeKey: `support-case:${caseId}:message:${message.id}:${adminId}`.slice(0, 180),
        })), skipDuplicates: true,
      })
      await transaction.outboxEvent.create({ data: {
        eventType: "support.message.received", aggregateType: "support_case", aggregateId: caseId,
        payload: { jobId: supportCase.jobId, messageId: message.id, senderRole: role }, requestId,
        dedupeKey: `support-case:${caseId}:message:${message.id}`.slice(0, 180),
      } })
      return mapSupportMessage(message)
    })
  }

  async listAdminSupportCases(search: string, status: SupportCaseStatus | "all", limit: number, offset: number): Promise<AdminPage<SupportCaseSummary>> {
    const needle = search.trim()
    const where: Prisma.SupportCaseWhereInput = {
      ...(status === "all" ? {} : { status: status.toUpperCase() as "OPEN" | "IN_PROGRESS" | "WAITING_ON_USER" | "RESOLVED" }),
      ...(needle ? { OR: [
        { caseReference: { contains: needle, mode: "insensitive" } },
        { subject: { contains: needle, mode: "insensitive" } },
        { job: { publicReference: { contains: needle, mode: "insensitive" } } },
        { requester: { displayName: { contains: needle, mode: "insensitive" } } },
      ] } : {}),
    }
    const [rows, total] = await Promise.all([
      this.client.supportCase.findMany({ where, include: supportCaseRelations, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: offset, take: limit }),
      this.client.supportCase.count({ where }),
    ])
    return { items: rows.map(mapSupportCase), total, limit, offset }
  }

  async listAdminSupportCaseMessages(caseId: string): Promise<SupportCaseMessage[] | null> {
    const exists = await this.client.supportCase.findUnique({ where: { id: caseId }, select: { id: true } })
    if (!exists) return null
    const messages = await this.client.supportMessage.findMany({ where: { caseId }, include: { sender: { select: { displayName: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    return messages.map(mapSupportMessage)
  }

  async createAdminSupportCaseMessage(adminUserId: string, caseId: string, body: string, requestId: string): Promise<SupportCaseMessage | null> {
    return this.client.$transaction(async (transaction) => {
      const supportCase = await transaction.supportCase.findUnique({ where: { id: caseId }, include: { job: { select: { publicReference: true } }, requester: { select: { id: true } } } })
      if (!supportCase) return null
      const message = await transaction.supportMessage.create({ data: { caseId, senderId: adminUserId, senderRole: "ADMIN", body: body.trim() }, include: { sender: { select: { displayName: true } } } })
      await transaction.supportCase.update({ where: { id: caseId }, data: { status: "WAITING_ON_USER", assignedAdminId: adminUserId, resolvedAt: null, updatedAt: message.createdAt } })
      await transaction.marketplaceNotification.create({ data: {
        userId: supportCase.requester.id, type: "support.admin_reply", title: "OddJobs Support replied",
        body: `Support replied to your case about ${supportCase.job.publicReference}: ${supportCase.subject}`,
        jobId: supportCase.jobId, dedupeKey: `support-case:${caseId}:message:${message.id}:${supportCase.requester.id}`.slice(0, 180),
      } })
      await transaction.outboxEvent.create({ data: {
        eventType: "support.admin_reply", aggregateType: "support_case", aggregateId: caseId,
        recipientUserId: supportCase.requester.id, payload: { jobId: supportCase.jobId, messageId: message.id },
        requestId, dedupeKey: `support-case:${caseId}:message:${message.id}`.slice(0, 180),
      } })
      return mapSupportMessage(message)
    })
  }

  async setAdminSupportCaseStatus(adminUserId: string, caseId: string, status: SupportCaseStatus, requestId: string): Promise<SupportCaseSummary | null> {
    return this.client.$transaction(async (transaction) => {
      const current = await transaction.supportCase.findUnique({ where: { id: caseId }, select: { id: true, requesterId: true, jobId: true, subject: true, job: { select: { publicReference: true } } } })
      if (!current) return null
      const now = new Date()
      const updated = await transaction.supportCase.update({ where: { id: caseId }, data: {
        status: status.toUpperCase() as "OPEN" | "IN_PROGRESS" | "WAITING_ON_USER" | "RESOLVED",
        resolvedAt: status === "resolved" ? now : null,
        ...(status === "in_progress" ? { assignedAdminId: adminUserId } : {}),
      } })
      await transaction.marketplaceNotification.create({ data: {
        userId: current.requesterId, type: "support.case_status", title: `Support case ${status.replaceAll("_", " ")}`,
        body: `Your case ${current.job.publicReference} · ${current.subject} is now ${status.replaceAll("_", " ")}.`,
        jobId: current.jobId, dedupeKey: `support-case:${caseId}:status:${requestId}:${current.requesterId}`.slice(0, 180),
      } })
      await transaction.outboxEvent.create({ data: {
        eventType: "support.case.status_changed", aggregateType: "support_case", aggregateId: caseId,
        recipientUserId: current.requesterId, payload: { status }, requestId,
        dedupeKey: `support-case:${caseId}:status:${requestId}`.slice(0, 180),
      } })
      const row = await transaction.supportCase.findUnique({ where: { id: updated.id }, include: supportCaseRelations })
      return row ? mapSupportCase(row) : null
    })
  }

  async listServiceListingMessages(userId: string, role: "consumer" | "provider", listingId: string): Promise<ServiceListingMessage[] | null> {
    const listing = await this.client.serviceListing.findUnique({ where: { id: listingId }, select: { providerId: true, claimedByCustomerId: true } })
    if (!listing || (role === "provider" ? listing.providerId !== userId : listing.claimedByCustomerId !== userId)) return null
    const messages = await this.client.serviceListingMessage.findMany({ where: { listingId }, include: { sender: { select: { displayName: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] })
    return messages.map((message) => this.mapServiceListingMessage(message))
  }

  async createServiceListingMessage(userId: string, role: "consumer" | "provider", listingId: string, body: string): Promise<ServiceListingMessage | null> {
    return this.client.$transaction(async (transaction) => {
      const listing = await transaction.serviceListing.findUnique({ where: { id: listingId }, select: { providerId: true, claimedByCustomerId: true, status: true, title: true } })
      if (!listing || listing.status === "OPEN" || listing.status === "CANCELLED" || !listing.claimedByCustomerId) return null
      const participantId = role === "provider" ? listing.providerId : listing.claimedByCustomerId
      if (participantId !== userId) return null
      const recipientUserId = role === "provider" ? listing.claimedByCustomerId : listing.providerId
      const message = await transaction.serviceListingMessage.create({ data: { listingId, senderId: userId, body: body.trim() }, include: { sender: { select: { displayName: true } } } })
      await transaction.marketplaceNotification.create({ data: {
        userId: recipientUserId,
        type: "message.received",
        title: "New job message",
        body: `New message about ${listing.title}.`,
        jobId: listingId,
        dedupeKey: `message:${message.id}`.slice(0, 180),
      } })
      return this.mapServiceListingMessage(message)
    })
  }

  async listAdminServiceListingMessages(limit: number, offset: number, search = ""): Promise<AdminPage<AdminServiceListingMessage>> {
    const normalized = search.trim().toUpperCase().replace(/\s+/g, "")
    const listing = normalized ? await this.client.serviceListing.findUnique({ where: { publicReference: normalized }, select: { id: true } }) : null
    const where = normalized ? { listingId: { in: listing ? [listing.id] : [] } } : {}
    const [messages, total] = await this.client.$transaction([
      this.client.serviceListingMessage.findMany({ where, include: { sender: { select: { displayName: true } }, listing: { include: { provider: { select: { displayName: true } }, claimedByCustomer: { select: { displayName: true } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: offset, take: limit }),
      this.client.serviceListingMessage.count({ where }),
    ])
    return {
      items: messages.map((message) => ({ ...this.mapServiceListingMessage(message), jobReference: message.listing.publicReference, listingTitle: message.listing.title, providerName: message.listing.provider.displayName, customerName: message.listing.claimedByCustomer?.displayName ?? "Customer" })),
      total,
      limit,
      offset,
    }
  }

  async createServiceListing(userId: string, input: CreateServiceListingInput, requestId: string): Promise<ServiceListing> {
    return this.client.$transaction(async (transaction) => {
      const lockedProfile = await transaction.$queryRaw<{ id: string }[]>`
        SELECT id FROM public.provider_profiles WHERE user_id = ${userId}::uuid FOR UPDATE
      `
      if (!lockedProfile.length) {
        throw new MarketplaceConflictError("Submit a provider application before posting listings.")
      }
      const provider = await transaction.providerProfile.findUnique({
        where: { userId },
        select: { verificationStatus: true },
      })
      const existingListings = await transaction.serviceListing.count({ where: { providerId: userId } })
      if (provider?.verificationStatus !== "VERIFIED" && existingListings >= 10) {
        throw new MarketplaceConflictError(
          "You have reached the 10-listing limit. Submit your ID for review; approval unlocks unlimited listings.",
        )
      }
      const listing = await transaction.serviceListing.create({
        data: {
          providerId: userId,
          ...input,
          media: (input.media ?? []) as Prisma.InputJsonValue,
          budgetMinor: input.budgetMinor === null ? null : BigInt(input.budgetMinor),
          currency: "KES",
        },
        include: { provider: { select: { displayName: true } } },
      })
      await transaction.serviceListingActivity.create({
        data: {
          listingId: listing.id,
          actorUserId: userId,
          action: "listing.created",
          metadata: { title: listing.title },
          requestId,
        },
      })
      return this.mapServiceListing(listing)
    })
  }

  async claimServiceListing(userId: string, listingId: string, requestId: string): Promise<ServiceListing | null> {
    const claimExpiresAt = new Date(Date.now() + 15 * 60 * 1000)
    return this.client.$transaction(async (transaction) => {
      const claim = await transaction.serviceListing.updateMany({
        where: { id: listingId, status: "OPEN", providerId: { not: userId } },
        data: { status: "CLAIMED", claimedByCustomerId: userId, claimExpiresAt },
      })
      if (claim.count !== 1) throw new MarketplaceConflictError("This listing has already been claimed or is no longer available.")
      const listing = await transaction.serviceListing.findUnique({
        where: { id: listingId }, include: { provider: { select: { displayName: true } }, claimedByCustomer: { select: { displayName: true } } },
      })
      if (!listing) return null
      await transaction.serviceListingActivity.create({ data: { listingId: listing.id, actorUserId: userId, action: "listing.claimed", metadata: { providerId: listing.providerId }, requestId } })
      await transaction.marketplaceNotification.create({ data: {
        userId: listing.providerId, type: "listing.claimed", title: "A customer claimed your listing",
        body: `${listing.claimedByCustomer?.displayName ?? "A customer"} claimed “${listing.title}”.`, jobId: listing.id,
        dedupeKey: `${requestId}:listing.claimed:${listing.providerId}`.slice(0, 180),
      } })
      return this.mapServiceListing(listing)
    })
  }

  async transitionServiceListing(userId: string, listingId: string, transition: "start" | "submit_completion" | "confirm_completion" | "cancel" | "close", requestId: string): Promise<ServiceListing | null> {
    const listing = await this.client.serviceListing.findUnique({ where: { id: listingId }, select: { providerId: true, claimedByCustomerId: true, status: true } })
    if (!listing) return null
    const providerAction = transition === "start" || transition === "submit_completion" || transition === "close"
    if (providerAction ? listing.providerId !== userId : listing.claimedByCustomerId !== userId) return null
    const transitions = {
      start: ["CLAIMED", "IN_PROGRESS"], submit_completion: ["IN_PROGRESS", "COMPLETION_PENDING"],
      confirm_completion: ["COMPLETION_PENDING", "COMPLETED"], cancel: ["CLAIMED", "CANCELLED"], close: ["OPEN", "CANCELLED"],
    } as const
    const [expected, next] = transitions[transition]
    return this.client.$transaction(async (transaction) => {
      const changed = await transaction.serviceListing.updateMany({
        where: { id: listingId, status: expected, ...(transition === "start" ? { claimExpiresAt: { gt: new Date() } } : {}) },
        data: { status: next, ...(transition === "start" ? { claimExpiresAt: null } : {}) },
      })
      if (!changed.count) throw new MarketplaceConflictError("The listing status changed. Refresh and try again.")
      const updated = await transaction.serviceListing.findUnique({ where: { id: listingId }, include: { provider: { select: { displayName: true } }, claimedByCustomer: { select: { displayName: true } } } })
      if (!updated) return null
      await transaction.serviceListingActivity.create({ data: { listingId: listingId, actorUserId: userId, action: `listing.${transition}`, metadata: { from: expected.toLowerCase(), to: next.toLowerCase() }, requestId } })
      const recipientUserId = providerAction ? updated.claimedByCustomerId : updated.providerId
      const notificationTitle = transition === "start" ? "The provider started work" : transition === "submit_completion" ? "Work is ready to review" : transition === "confirm_completion" ? "The customer confirmed completion" : "A customer cancelled the claim"
      const notificationBody = transition === "start" ? `${updated.provider.displayName} started “${updated.title}”.` : transition === "submit_completion" ? `${updated.provider.displayName} marked “${updated.title}” complete.` : transition === "confirm_completion" ? `The customer confirmed “${updated.title}” is complete.` : `The customer cancelled the claim for “${updated.title}”.`
      if (recipientUserId) await transaction.marketplaceNotification.create({ data: {
        userId: recipientUserId, type: `listing.${transition}`, title: notificationTitle, body: notificationBody,
        jobId: listingId, dedupeKey: `${requestId}:listing.${transition}:${recipientUserId}`.slice(0, 180),
      } })
      return this.mapServiceListing(updated)
    })
  }

  async listServiceListingReviews(userId: string, role: "consumer" | "provider"): Promise<ServiceListingReviewPage> {
    const reviewReleaseCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const [receivedRows, pendingRows] = await this.client.$transaction([
      this.client.serviceListingReview.findMany({
        where: {
          revieweeUserId: userId,
          OR: [
            { createdAt: { lte: reviewReleaseCutoff } },
            { listing: { reviews: { some: { reviewerUserId: { not: userId } } } } },
          ],
        },
        include: {
          listing: { select: { title: true } },
          reviewer: { select: { displayName: true } },
          reviewee: { select: { displayName: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      this.client.serviceListing.findMany({
        where: {
          status: "COMPLETED",
          ...(role === "provider" ? { providerId: userId } : { claimedByCustomerId: userId }),
          reviews: { none: { reviewerUserId: userId } },
        },
        include: {
          provider: { select: { displayName: true } },
          claimedByCustomer: { select: { displayName: true } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      }),
    ])
    return {
      received: receivedRows.map((review) => ({
        id: review.id,
        listingId: review.listingId,
        listingTitle: review.listing.title,
        reviewerName: review.reviewer.displayName,
        revieweeName: review.reviewee.displayName,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt.toISOString(),
      })),
      pending: pendingRows.map((listing) => ({
        listingId: listing.id,
        listingTitle: listing.title,
        revieweeName: role === "provider"
          ? listing.claimedByCustomer?.displayName ?? "Customer"
          : listing.provider.displayName,
      })),
    }
  }

  async listPublicProviderReviews(providerId: string): Promise<ServiceListingReview[]> {
    const profile = await this.client.providerProfile.findFirst({
      where: { OR: [{ id: providerId }, { userId: providerId }], verificationStatus: "VERIFIED", user: { status: "ACTIVE" } },
      select: { userId: true },
    })
    if (!profile) return []
    const reviewReleaseCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    const rows = await this.client.serviceListingReview.findMany({
      where: {
        revieweeUserId: profile.userId,
        OR: [
          { createdAt: { lte: reviewReleaseCutoff } },
          { listing: { reviews: { some: { reviewerUserId: { not: profile.userId } } } } },
        ],
      },
      include: { listing: { select: { title: true } }, reviewer: { select: { displayName: true } }, reviewee: { select: { displayName: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })
    return rows.map((review) => ({
      id: review.id,
      listingId: review.listingId,
      listingTitle: review.listing.title,
      reviewerName: review.reviewer.displayName,
      revieweeName: review.reviewee.displayName,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.toISOString(),
    }))
  }

  async createServiceListingReview(
    userId: string,
    listingId: string,
    rating: number,
    comment: string,
    requestId: string,
  ): Promise<ServiceListingReview> {
    try {
      return await this.client.$transaction(async (transaction) => {
        const listing = await transaction.serviceListing.findUnique({
          where: { id: listingId },
          include: {
            provider: { select: { displayName: true } },
            claimedByCustomer: { select: { id: true, displayName: true } },
          },
        })
        if (!listing || listing.status !== "COMPLETED" || !listing.claimedByCustomer) {
          throw new MarketplaceConflictError("Reviews are available after both sides confirm a completed job.")
        }
        const isProvider = listing.providerId === userId
        const isCustomer = listing.claimedByCustomer.id === userId
        if (!isProvider && !isCustomer) {
          throw new MarketplaceConflictError("Only people who took part in this completed job can review each other.")
        }
        const revieweeUserId = isProvider ? listing.claimedByCustomer.id : listing.providerId
        const revieweeName = isProvider
          ? listing.claimedByCustomer.displayName
          : listing.provider.displayName
        const reviewerName = isProvider
          ? listing.provider.displayName
          : listing.claimedByCustomer.displayName
        const review = await transaction.serviceListingReview.create({
          data: { listingId, reviewerUserId: userId, revieweeUserId, rating, comment: comment.trim() },
        })
        return {
          id: review.id,
          listingId,
          listingTitle: listing.title,
          reviewerName,
          revieweeName,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt.toISOString(),
        }
      })
    } catch (error) {
      if (error instanceof MarketplaceConflictError) throw error
      if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
        throw new MarketplaceConflictError("You have already reviewed this completed job.")
      }
      throw error
    }
  }

  async listAdminServiceListings(query: string, limit: number, offset: number): Promise<AdminPage<ServiceListing>> {
    const search = query.trim()
    const referenceSearch = search.toUpperCase().replace(/\s+/g, "")
    const where = search
      ? {
          OR: [
            { publicReference: referenceSearch },
            { title: { contains: search, mode: "insensitive" as const } },
            { category: { contains: search, mode: "insensitive" as const } },
            { provider: { displayName: { contains: search, mode: "insensitive" as const } } },
            { claimedByCustomer: { displayName: { contains: search, mode: "insensitive" as const } } },
          ],
        }
      : {}
    const [listings, total] = await this.client.$transaction([
      this.client.serviceListing.findMany({ where, include: { provider: { select: { displayName: true } }, claimedByCustomer: { select: { displayName: true } }, activity: { include: { actor: { select: { displayName: true } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, skip: offset }),
      this.client.serviceListing.count({ where }),
    ])
    return { items: listings.map((listing) => this.mapServiceListing(listing)), total, limit, offset }
  }

  async releaseAdminServiceListing(adminUserId: string, listingId: string, reason: string, requestId: string): Promise<ServiceListing | null> {
    return this.client.$transaction(async (transaction) => {
      const listing = await transaction.serviceListing.findUnique({
        where: { id: listingId },
        include: { provider: { select: { displayName: true } }, claimedByCustomer: { select: { displayName: true } } },
      })
      if (!listing) return null
      if (listing.status !== "CLAIMED") throw new MarketplaceConflictError("Only a not-yet-started claim can be released.")
      const updatedCount = await transaction.serviceListing.updateMany({
        where: { id: listingId, status: "CLAIMED" },
        data: { status: "OPEN", claimedByCustomerId: null, claimExpiresAt: null },
      })
      if (!updatedCount.count) throw new MarketplaceConflictError("The listing changed. Refresh and try again.")
      await transaction.serviceListingActivity.create({ data: { listingId, actorUserId: adminUserId, action: "listing.admin_released", metadata: { reason }, requestId } })
      await transaction.adminAuditEvent.create({ data: { actorUserId: adminUserId, action: "service_listing.claim_released", targetType: "service_listing", targetId: listingId, metadata: { reason }, requestId } })
      for (const userId of [listing.claimedByCustomerId, listing.providerId]) {
        if (!userId) continue
        await transaction.marketplaceNotification.create({ data: {
          userId, type: "listing.admin_released", title: "A listing claim was released by support",
          body: `The claim for “${listing.title}” was released. Contact support if you need more information.`, jobId: listingId,
          dedupeKey: `${requestId}:listing.admin_released:${userId}`.slice(0, 180),
        } })
      }
      return this.mapServiceListing(await transaction.serviceListing.findUniqueOrThrow({ where: { id: listingId }, include: { provider: { select: { displayName: true } }, claimedByCustomer: { select: { displayName: true } } } }))
    })
  }

  async check(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`
  }

  private async enqueueMarketplaceEvent(
    transaction: Prisma.TransactionClient,
    input: {
      requestId: string
      eventType: string
      jobId: string
      quoteId?: string | null
      recipientUserId?: string | null
      title?: string
      body?: string
      payload?: Record<string, string | number | boolean | null>
    },
  ): Promise<void> {
    const recipient = input.recipientUserId ?? null
    const dedupeKey = `${input.requestId}:${input.eventType}:${recipient ?? "platform"}`.slice(0, 180)
    const payload = {
      jobId: input.jobId,
      quoteId: input.quoteId ?? null,
      ...(input.payload ?? {}),
    }
    await transaction.outboxEvent.upsert({
      where: { dedupeKey },
      create: {
        eventType: input.eventType,
        aggregateType: "job",
        aggregateId: input.jobId,
        recipientUserId: recipient,
        payload,
        requestId: input.requestId,
        dedupeKey,
      },
      update: {},
    })
    if (!recipient || !input.title || !input.body) return
    await transaction.marketplaceNotification.upsert({
      where: { dedupeKey },
      create: {
        userId: recipient,
        type: input.eventType,
        title: input.title,
        body: input.body,
        jobId: input.jobId,
        dedupeKey,
      },
      update: {},
    })
  }

  async bootstrapProfile(
    principal: AuthenticatedPrincipal,
  ): Promise<UserProfile> {
    const avatarColumnAvailable = await this.hasAvatarPathColumn()
    const displayName =
      principal.displayName?.trim() ||
      principal.phone ||
      principal.email?.split("@")[0] ||
      "OddJobs member"

    const user = await this.client.$transaction(async (transaction) => {
      const initialRoles = principal.accountIntent === "supplier"
        ? [{ role: "PROVIDER" as const }]
        : [{ role: "CONSUMER" as const }]
      const profile = await transaction.user.upsert({
        where: { id: principal.id },

        create: {
          id: principal.id,

          displayName: displayName.slice(0, 120),

          status: "ACTIVE",

          roleAssignments: { create: initialRoles },
        },

        update: {},

        select: {
          id: true,
          displayName: true,
          status: true,
          ...(avatarColumnAvailable ? { avatarPath: true } : {}),
          roleAssignments: { select: { role: true } },
        },
      })

      // Ensure supplier accounts always have a provider role and profile, including accounts
      // bootstrapped before provider access was enabled at signup.
      if (principal.accountIntent === "supplier") {
        await transaction.providerProfile.upsert({
          where: { userId: principal.id },
          create: {
            userId: principal.id,
            publicName: displayName.slice(0, 120),
            verificationStatus: "NOT_STARTED",
          },
          update: {},
        })
        await transaction.userRoleAssignment.upsert({
          where: { userId_role: { userId: principal.id, role: "PROVIDER" } },
          create: { userId: principal.id, role: "PROVIDER" },
          update: {},
        })
      }

      return profile
    })

    const resolvedProfile = await this.getProfile(principal.id)
    if (resolvedProfile) return resolvedProfile

    return {
      id: user.id,

      displayName: user.displayName,

      avatarPath: "avatarPath" in user ? user.avatarPath : null,

      status: user.status.toLowerCase(),

      roles: user.roleAssignments.map((assignment) =>
        assignment.role.toLowerCase(),
      ),
    }
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const avatarColumnAvailable = await this.hasAvatarPathColumn()
    const user = await this.client.user.findUnique({
      where: { id: userId },

      select: {
        id: true,
        displayName: true,
        status: true,
        ...(avatarColumnAvailable ? { avatarPath: true } : {}),
        roleAssignments: { select: { role: true } },
        providerProfile: { select: { verificationStatus: true } },
      },
    })

    if (!user) return null

    const roles = user.roleAssignments.map((assignment) => assignment.role)
    const providerWorkspaceEligible =
      user.status === "ACTIVE" && user.providerProfile !== null

    if (user.providerProfile) {
      const removeConsumerRole = roles.includes("CONSUMER")
      const addProviderRole = providerWorkspaceEligible && !roles.includes("PROVIDER")
      const removeIneligibleProviderRole =
        !providerWorkspaceEligible && roles.includes("PROVIDER")

      if (removeConsumerRole || addProviderRole || removeIneligibleProviderRole) {
        await this.client.$transaction(async (transaction) => {
          if (removeConsumerRole) {
            await transaction.userRoleAssignment.deleteMany({
              where: { userId, role: "CONSUMER" },
            })
          }
          if (addProviderRole) {
            await transaction.userRoleAssignment.upsert({
              where: { userId_role: { userId, role: "PROVIDER" } },
              create: { userId, role: "PROVIDER" },
              update: {},
            })
          }
          if (removeIneligibleProviderRole) {
            await transaction.userRoleAssignment.deleteMany({
              where: { userId, role: "PROVIDER" },
            })
          }
        })
      }

      const exclusiveRoles = roles.filter((role) =>
        role !== "CONSUMER" && (providerWorkspaceEligible || role !== "PROVIDER"),
      )
      if (providerWorkspaceEligible && !exclusiveRoles.includes("PROVIDER")) {
        exclusiveRoles.push("PROVIDER")
      }
      return {
        id: user.id,
        displayName: user.displayName,
        avatarPath: "avatarPath" in user ? user.avatarPath : null,
        status: user.status.toLowerCase(),
        roles: exclusiveRoles.map((role) => role.toLowerCase()),
      }
    }

    return {
      id: user.id,

      displayName: user.displayName,

      avatarPath: "avatarPath" in user ? user.avatarPath : null,

      status: user.status.toLowerCase(),

      roles: roles.map((role) => role.toLowerCase()),
    }
  }

  async updateProfile(userId: string, displayName: string, avatarPath?: string): Promise<UserProfile | null> {
    if (avatarPath !== undefined && !(await this.hasAvatarPathColumn())) return null
    await this.client.user.updateMany({ where: { id: userId, status: "ACTIVE" }, data: { displayName, ...(avatarPath === undefined ? {} : { avatarPath }) } })
    return this.getProfile(userId)
  }

  async listAdminUsers(
    limit: number,

    offset: number,
  ): Promise<AdminPage<AdminUserSummary>> {
    const [users, total] = await this.client.$transaction([
      this.client.user.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],

        skip: offset,

        take: limit,

        select: {
          id: true,

          displayName: true,

          status: true,

          createdAt: true,

          roleAssignments: { select: { role: true } },
        },
      }),

      this.client.user.count(),
    ])

    const ids = users.map((user) => user.id)
    const [restrictions, overdue] = ids.length ? await Promise.all([
      this.client.accountRestriction.findMany({ where: { userId: { in: ids }, type: "COMMISSION", releasedAt: null }, select: { userId: true, reason: true } }),
      this.client.jobPayment.groupBy({ by: ["customerId"], where: { customerId: { in: ids }, status: "PAID", platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] }, platformFeeDueAt: { lte: new Date() } }, _count: { _all: true }, _sum: { commissionAmountMinor: true } }),
    ]) : [[], []]
    const activeRestrictions = new Map(restrictions.map((item) => [item.userId, item.reason]))
    const overdueFees = new Map(overdue.map((item) => [item.customerId, { count: item._count._all, amount: Number(item._sum.commissionAmountMinor ?? 0n) }]))

    return {
      items: users.map((user) => ({
        id: user.id,

        displayName: user.displayName,

        status: user.status.toLowerCase(),

        roles: user.roleAssignments.map((assignment) =>
          assignment.role.toLowerCase(),
        ),

        createdAt: user.createdAt.toISOString(),
        commissionRestricted: activeRestrictions.has(user.id),
        commissionRestrictionReason: activeRestrictions.get(user.id) ?? null,
        overdueCommissionCount: overdueFees.get(user.id)?.count ?? 0,
        overdueCommissionMinor: overdueFees.get(user.id)?.amount ?? 0,
      })),

      total,

      limit,

      offset,
    }
  }

  async hasActiveCommissionRestriction(userId: string): Promise<boolean> {
    return Boolean(await this.client.accountRestriction.findFirst({ where: { userId, type: "COMMISSION", releasedAt: null }, select: { id: true } }))
  }

  async getAdminOverview(): Promise<AdminOverview> {
    const [
      totalUsers,

      activeProviders,

      pendingVerifications,

      openJobs,

      completedJobs,

      disputedJobs,
    ] = await this.client.$transaction([
      this.client.user.count(),

      this.client.userRoleAssignment.count({
        where: { role: "PROVIDER", user: { status: "ACTIVE" } },
      }),

      this.client.providerProfile.count({
        where: { verificationStatus: "IN_REVIEW" },
      }),

      this.client.job.count({ where: { status: "OPEN" } }),

      this.client.job.count({ where: { status: "COMPLETED" } }),

      this.client.job.count({ where: { status: "DISPUTED" } }),
    ])

    return {
      totalUsers,

      activeProviders,

      pendingVerifications,

      openJobs,

      completedJobs,

      disputedJobs,
    }
  }

  async getAdminAnalytics(filters: AdminAnalyticsFilters): Promise<AdminAnalyticsReport> {
    const toBoundary = (day: string) => new Date(`${day}T00:00:00+03:00`)
    const from = toBoundary(filters.from)
    const toExclusive = toBoundary(filters.to)
    toExclusive.setUTCDate(toExclusive.getUTCDate() + 1)
    const duration = Math.max(1, Math.round((toExclusive.getTime() - from.getTime()) / 86_400_000))
    const previousTo = new Date(from)
    const previousFrom = new Date(previousTo)
    previousFrom.setUTCDate(previousFrom.getUTCDate() - duration)
    const statusMap: Record<AdminAnalyticsFilters["status"], string[] | null> = {
      all: null, open: ["OPEN"], hired: ["AWARDED", "IN_PROGRESS", "COMPLETION_PENDING", "REVISION_REQUESTED"],
      completed: ["COMPLETED"], cancelled: ["CANCELLED", "EXPIRED"], disputed: ["DISPUTED"],
    }
    const paymentJobFilter = {
      ...(filters.category !== "all" ? { category: filters.category } : {}),
      ...(statusMap[filters.status] ? { status: { in: statusMap[filters.status] as never[] } } : {}),
    }
    const hasPaymentJobFilter = Object.keys(paymentJobFilter).length > 0
    const baseWhere = (start: Date, end: Date): Prisma.JobWhereInput => ({
      createdAt: { gte: start, lt: end },
      ...(filters.category !== "all" ? { category: filters.category } : {}),
      ...(statusMap[filters.status] ? { status: { in: statusMap[filters.status] as never[] } } : {}),
    })
    const [currentJobs, previousJobs, receivedRows, overdueRows, previousReceipts, categoryRows] = await this.client.$transaction([
      this.client.job.findMany({
        where: baseWhere(from, toExclusive), orderBy: { createdAt: "desc" },
        select: {
          publicReference: true, title: true, category: true, status: true, createdAt: true,
          quotes: { select: { status: true } },
          payment: { select: { grossAmountMinor: true, commissionAmountMinor: true, currency: true, platformFeeStatus: true, platformFeeDueAt: true, updatedAt: true, customer: { select: { displayName: true } }, provider: { select: { displayName: true } } } },
        },
      }),
      this.client.job.findMany({
        where: baseWhere(previousFrom, previousTo),
        select: { status: true, quotes: { select: { status: true } }, payment: { select: { grossAmountMinor: true } } },
      }),
      this.client.jobPayment.findMany({
        where: { platformFeeStatus: "RECEIVED", platformFeeReceivedAt: { gte: from, lt: toExclusive }, ...(hasPaymentJobFilter ? { job: paymentJobFilter } : {}) },
        select: { commissionAmountMinor: true, platformFeeReceivedAt: true },
      }),
      this.client.jobPayment.findMany({
        where: { status: { not: "REFUNDED" }, platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] }, platformFeeDueAt: { lt: new Date() }, ...(hasPaymentJobFilter ? { job: paymentJobFilter } : {}) },
        select: { commissionAmountMinor: true },
      }),
      this.client.jobPayment.aggregate({
        where: { platformFeeStatus: "RECEIVED", platformFeeReceivedAt: { gte: previousFrom, lt: from }, ...(hasPaymentJobFilter ? { job: paymentJobFilter } : {}) },
        _sum: { commissionAmountMinor: true },
      }),
      this.client.job.findMany({ distinct: ["category"], orderBy: { category: "asc" }, select: { category: true } }),
    ])
    const toMinor = (value: bigint | null | undefined) => Number(value ?? 0n)
    const isHired = (job: { quotes: { status: string }[] }) => job.quotes.some((quote) => quote.status === "ACCEPTED")
    const isProposal = (job: { quotes: { status: string }[] }) => job.quotes.some((quote) => quote.status === "SUBMITTED" || quote.status === "ACCEPTED")
    const previous = {
      jobsPosted: previousJobs.length,
      hiredJobs: previousJobs.filter(isHired).length,
      completedJobs: previousJobs.filter((job) => job.status === "COMPLETED").length,
      agreedGrossMinor: previousJobs.reduce((sum, job) => sum + toMinor(job.payment?.grossAmountMinor), 0),
      verifiedCommissionMinor: toMinor(previousReceipts._sum?.commissionAmountMinor),
    }
    const current = {
      jobsPosted: currentJobs.length,
      jobsWithProposals: currentJobs.filter(isProposal).length,
      hiredJobs: currentJobs.filter(isHired).length,
      completedJobs: currentJobs.filter((job) => job.status === "COMPLETED").length,
      agreedGrossMinor: currentJobs.reduce((sum, job) => sum + toMinor(job.payment?.grossAmountMinor), 0),
      expectedCommissionMinor: currentJobs.reduce((sum, job) => sum + toMinor(job.payment?.commissionAmountMinor), 0),
      reportedCommissionMinor: currentJobs.filter((job) => job.payment?.platformFeeStatus === "REPORTED").reduce((sum, job) => sum + toMinor(job.payment?.commissionAmountMinor), 0),
      verifiedCommissionMinor: receivedRows.reduce((sum, row) => sum + toMinor(row.commissionAmountMinor), 0),
      overdueCommissionMinor: overdueRows.reduce((sum, row) => sum + toMinor(row.commissionAmountMinor), 0),
      overdueCommissionCount: overdueRows.length,
    }
    const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit" }).format(date)
    const buckets = new Map<string, AdminAnalyticsReport["series"][number]>()
    for (let cursor = new Date(from); cursor < toExclusive; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = dayKey(cursor)
      buckets.set(date, { date, jobsPosted: 0, hiredJobs: 0, completedJobs: 0, agreedGrossMinor: 0, verifiedCommissionMinor: 0 })
    }
    for (const job of currentJobs) {
      const bucket = buckets.get(dayKey(job.createdAt))
      if (!bucket) continue
      bucket.jobsPosted += 1
      if (isHired(job)) bucket.hiredJobs += 1
      if (job.status === "COMPLETED") bucket.completedJobs += 1
      bucket.agreedGrossMinor += toMinor(job.payment?.grossAmountMinor)
    }
    for (const receipt of receivedRows) {
      if (!receipt.platformFeeReceivedAt) continue
      const bucket = buckets.get(dayKey(receipt.platformFeeReceivedAt))
      if (bucket) bucket.verifiedCommissionMinor += toMinor(receipt.commissionAmountMinor)
    }
    const currency = currentJobs.find((job) => job.payment?.currency)?.payment?.currency ?? "KES"
    const jobs = currentJobs.slice(0, 100).map((job) => ({
      reference: job.publicReference, title: job.title, category: job.category, status: job.status.toLowerCase(),
      proposals: job.quotes.filter((quote) => quote.status === "SUBMITTED" || quote.status === "ACCEPTED").length,
      createdAt: job.createdAt.toISOString(),
    }))
    const commissions = currentJobs.filter((job) => job.payment).slice(0, 100).map((job) => ({
      reference: job.publicReference, title: job.title, customer: job.payment!.customer.displayName, provider: job.payment!.provider.displayName,
      feeMinor: toMinor(job.payment!.commissionAmountMinor), status: job.payment!.platformFeeStatus.toLowerCase(),
      dueAt: job.payment!.platformFeeDueAt?.toISOString() ?? null, updatedAt: job.payment!.updatedAt.toISOString(),
    }))
    return { currency, categories: categoryRows.map((row) => row.category), current, previous, series: [...buckets.values()], jobs, commissions }
  }

  async listAdminVerifications(
    status: AdminVerificationStatus,

    limit: number,

    offset: number,
  ): Promise<AdminPage<AdminVerificationSummary>> {
    const where =
      status === "all"
        ? {}
        : { verificationStatus: verificationStatusToDatabase[status] }

    const [profiles, total] = await this.client.$transaction([
      this.client.providerProfile.findMany({
        where,

        orderBy: [{ createdAt: "desc" }, { id: "asc" }],

        skip: offset,

        take: limit,

        select: {
          id: true,

          userId: true,

          publicName: true,

          region: true,

          verificationDocumentType: true,

          skillsEvidence: true,

          verificationStatus: true,

          createdAt: true,

          user: { select: { displayName: true } },
        },
      }),

      this.client.providerProfile.count({ where }),
    ])

    return {
      items: profiles.map((profile) => ({
        id: profile.id,

        userId: profile.userId,

        displayName: profile.user.displayName,

        publicName: profile.publicName,

        region: profile.region,

        documentType: profile.verificationDocumentType,

        skillsEvidence: profile.skillsEvidence,

        status: profile.verificationStatus.toLowerCase(),

        submittedAt: profile.createdAt.toISOString(),
      })),

      total,

      limit,

      offset,
    }
  }

  async getAdminVerificationDocument(profileId: string): Promise<string | null> {
    const profile = await this.client.providerProfile.findUnique({
      where: { id: profileId },
      select: { verificationDocumentPath: true },
    })
    return profile?.verificationDocumentPath ?? null
  }

  async listAdminCustomerVerifications(status: AdminVerificationStatus, limit: number, offset: number): Promise<AdminPage<AdminCustomerVerificationSummary>> {
    const where = status === "all" ? {} : { status: verificationStatusToDatabase[status] }
    const [rows, total] = await this.client.$transaction([
      this.client.customerIdentityVerification.findMany({ where, include: { user: { select: { displayName: true } } }, orderBy: [{ submittedAt: "desc" }, { id: "asc" }], skip: offset, take: limit }),
      this.client.customerIdentityVerification.count({ where }),
    ])
    return {
      items: rows.map((row) => ({ id: row.id, userId: row.userId, displayName: row.user.displayName, status: row.status.toLowerCase(), submittedAt: row.submittedAt.toISOString(), documentType: row.documentType })),
      total,
      limit,
      offset,
    }
  }

  async getAdminCustomerVerificationDocument(verificationId: string): Promise<string | null> {
    const row = await this.client.customerIdentityVerification.findUnique({ where: { id: verificationId }, select: { documentPath: true } })
    return row?.documentPath ?? null
  }

  async decideAdminCustomerVerification(input: { actorUserId: string; verificationId: string; decision: AdminVerificationDecision; reason: string | null; requestId: string }): Promise<AdminCustomerVerificationSummary | null> {
    return this.client.$transaction(async (transaction) => {
      const result = await transaction.customerIdentityVerification.updateMany({
        where: { id: input.verificationId, status: "IN_REVIEW" },
        data: {
          status: input.decision === "verified" ? "VERIFIED" : "REJECTED",
          reviewedAt: new Date(),
          reviewedByUserId: input.actorUserId,
          reviewReason: input.reason,
        },
      })
      if (!result.count) return null
      const row = await transaction.customerIdentityVerification.findUnique({ where: { id: input.verificationId }, include: { user: { select: { displayName: true } } } })
      return row ? { id: row.id, userId: row.userId, displayName: row.user.displayName, status: row.status.toLowerCase(), submittedAt: row.submittedAt.toISOString(), documentType: row.documentType } : null
    })
  }

  async decideAdminVerification(input: {
    actorUserId: string

    profileId: string

    decision: AdminVerificationDecision

    reason: string | null

    requestId: string
  }): Promise<AdminVerificationSummary | null> {
    return this.client.$transaction(async (transaction) => {
      const decision = input.decision === "verified" ? "VERIFIED" : "REJECTED"

      const application = await transaction.providerProfile.findUnique({
        where: { id: input.profileId },

        select: {
          userId: true,

          verificationStatus: true,

          verificationDocumentType: true,

          verificationDocumentPath: true,

          user: { select: { status: true } },
        },
      })

      if (
        !application ||
        application.verificationStatus !== "IN_REVIEW" ||
        !application.verificationDocumentType ||
        !application.verificationDocumentPath ||
        application.user.status !== "ACTIVE"
      ) {
        return null
      }

      const updated = await transaction.providerProfile.updateMany({
        where: { id: input.profileId, verificationStatus: "IN_REVIEW" },

        data: { verificationStatus: decision },
      })

      if (updated.count !== 1) return null

      if (input.decision === "verified") {
        await transaction.userRoleAssignment.upsert({
          where: {
            userId_role: { userId: application.userId, role: "PROVIDER" },
          },

          create: { userId: application.userId, role: "PROVIDER" },

          update: {},
        })
      } else {
        await transaction.userRoleAssignment.deleteMany({
          where: { userId: application.userId, role: "PROVIDER" },
        })
      }

      await transaction.providerVerificationReview.create({
        data: {
          providerProfileId: input.profileId,

          actorUserId: input.actorUserId,

          decision,

          reason: input.reason,

          requestId: input.requestId,
        },
      })

      await transaction.adminAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,

          action: `admin.verification.${input.decision}`,

          targetType: "provider_profile",

          targetId: input.profileId,

          metadata: {
            reason: input.reason,
            providerRoleGranted: input.decision === "verified",
          },

          requestId: input.requestId,
        },
      })

      const profile = await transaction.providerProfile.findUnique({
        where: { id: input.profileId },

        select: {
          id: true,

          userId: true,

          publicName: true,

          region: true,

          verificationDocumentType: true,

          skillsEvidence: true,

          verificationStatus: true,

          createdAt: true,

          user: { select: { displayName: true } },
        },
      })

      if (!profile) return null

      return {
        id: profile.id,

        userId: profile.userId,

        displayName: profile.user.displayName,

        publicName: profile.publicName,

        region: profile.region,

        documentType: profile.verificationDocumentType,

        skillsEvidence: profile.skillsEvidence,

        status: profile.verificationStatus.toLowerCase(),

        submittedAt: profile.createdAt.toISOString(),
      }
    })
  }

  async createModerationReport(input: {
    reporterUserId: string

    subjectType: string

    subjectId: string

    reason: string

    details: string
  }): Promise<AdminModerationReport> {
    if (input.subjectType === "job") {
      const [listing, job] = await Promise.all([
        this.client.serviceListing.findUnique({ where: { id: input.subjectId }, select: { providerId: true, claimedByCustomerId: true } }),
        this.client.job.findUnique({ where: { id: input.subjectId }, select: { customerId: true, quotes: { select: { providerId: true } } } }),
      ])
      const isListingParticipant = !!listing && (listing.providerId === input.reporterUserId || listing.claimedByCustomerId === input.reporterUserId)
      const isJobParticipant = !!job && (job.customerId === input.reporterUserId || job.quotes.some((quote) => quote.providerId === input.reporterUserId))
      if (!isListingParticipant && !isJobParticipant) throw new MarketplaceConflictError("You can only report a job you took part in.")
    }
    const report = await this.client.moderationReport.create({
      data: input,
    })

    return this.mapModerationReport(report)
  }

  async listAdminModerationReports(
    status: AdminModerationStatus,

    limit: number,

    offset: number,
    search = "",
  ): Promise<AdminPage<AdminModerationReport>> {
    const normalized = search.trim().toUpperCase().replace(/\s+/g, "")
    let matchingJobIds: string[] | null = null
    if (normalized) {
      const [job, listing] = await Promise.all([
        this.client.job.findUnique({ where: { publicReference: normalized }, select: { id: true } }),
        this.client.serviceListing.findUnique({ where: { publicReference: normalized }, select: { id: true } }),
      ])
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search.trim())
      matchingJobIds = [job?.id, listing?.id, ...(isUuid ? [search.trim()] : [])].filter((id): id is string => Boolean(id))
    }
    const where = {
      ...(status === "all" ? {} : { status: moderationStatusToDatabase[status] }),
      ...(matchingJobIds === null ? {} : { subjectType: "job", subjectId: { in: matchingJobIds } }),
    }

    const [reports, total] = await this.client.$transaction([
      this.client.moderationReport.findMany({
        where,

        orderBy: [{ createdAt: "desc" }, { id: "asc" }],

        skip: offset,

        take: limit,
      }),

      this.client.moderationReport.count({ where }),
    ])

    const jobIds = reports.filter((report) => report.subjectType === "job").map((report) => report.subjectId)
    const [marketplaceJobs, legacyListings] = await Promise.all([
      jobIds.length ? this.client.job.findMany({ where: { id: { in: jobIds } }, select: { id: true, publicReference: true } }) : [],
      jobIds.length ? this.client.serviceListing.findMany({ where: { id: { in: jobIds } }, select: { id: true, publicReference: true } }) : [],
    ])
    const references = new Map([...marketplaceJobs, ...legacyListings].map((item) => [item.id, item.publicReference]))
    return {
      items: reports.map((report) => ({ ...this.mapModerationReport(report), jobReference: report.subjectType === "job" ? references.get(report.subjectId) ?? null : null })),

      total,

      limit,

      offset,
    }
  }

  async decideAdminModerationReport(input: {
    actorUserId: string

    reportId: string

    decision: AdminModerationDecision

    enforcement: "none" | "suspend_account"

    reason: string | null

    requestId: string
  }): Promise<AdminModerationReport | null> {
    return this.client.$transaction(async (transaction) => {
      const status = moderationDecisionToDatabase[input.decision]

      const updated = await transaction.moderationReport.updateMany({
        where: { id: input.reportId, status: { in: ["OPEN", "REVIEWING"] } },

        data: {
          status,

          decisionReason: input.reason,

          reviewedByUserId: input.actorUserId,

          reviewedAt: new Date(),
        },
      })

      if (updated.count !== 1) return null

      if (input.enforcement === "suspend_account") {
        const report = await transaction.moderationReport.findUnique({
          where: { id: input.reportId },
          select: { subjectType: true, subjectId: true },
        })
        if (!report || report.subjectType !== "account") {
          throw new ModerationEnforcementError("Account suspension requires an account report.")
        }
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(report.subjectId)) {
          throw new ModerationEnforcementError("The reported account ID is invalid.")
        }
        const target = await transaction.user.findUnique({
          where: { id: report.subjectId },
          select: {
            id: true,
            status: true,
            roleAssignments: { select: { role: true } },
          },
        })
        if (
          !target ||
          target.id === input.actorUserId ||
          target.status !== "ACTIVE" ||
          target.roleAssignments.some((assignment) => assignment.role === "ADMIN")
        ) {
          throw new ModerationEnforcementError("The reported account cannot be suspended.")
        }
        await transaction.user.update({
          where: { id: target.id },
          data: { status: "SUSPENDED" },
        })
        await transaction.adminUserEnforcement.create({
          data: {
            userId: target.id,
            reportId: input.reportId,
            actorUserId: input.actorUserId,
            reason: input.reason ?? "Suspended after moderation review.",
          },
        })
      }

      await transaction.adminAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,

          action: `admin.moderation.${input.decision}`,

          targetType: "moderation_report",

          targetId: input.reportId,

          metadata: { reason: input.reason, enforcement: input.enforcement },

          requestId: input.requestId,
        },
      })

      const report = await transaction.moderationReport.findUnique({
        where: { id: input.reportId },
      })

      return report ? this.mapModerationReport(report) : null
    })
  }

  async reinstateAdminSuspendedUser(input: {
    actorUserId: string
    userId: string
    requestId: string
  }): Promise<boolean> {
    return this.client.$transaction(async (transaction) => {
      const enforcement = await transaction.adminUserEnforcement.findFirst({
        where: { userId: input.userId, releasedAt: null },
        orderBy: { createdAt: "desc" },
      })
      if (!enforcement) return false
      const updated = await transaction.user.updateMany({
        where: { id: input.userId, status: "SUSPENDED" },
        data: { status: "ACTIVE" },
      })
      if (updated.count !== 1) return false
      await transaction.adminUserEnforcement.update({
        where: { id: enforcement.id },
        data: { releasedBy: input.actorUserId, releasedAt: new Date() },
      })
      await transaction.adminAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          action: "admin.moderation.account_reinstated",
          targetType: "user",
          targetId: input.userId,
          metadata: { enforcementId: enforcement.id },
          requestId: input.requestId,
        },
      })
      return true
    })
  }

  async listAdminCategories(): Promise<AdminCategory[]> {
    const categories = await this.client.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, active: true, sortOrder: true },
    })
    return Promise.all(categories.map(async (category) => {
      const [totalJobs, openJobs] = await Promise.all([
        this.client.job.count({ where: { category: { equals: category.name, mode: "insensitive" } } }),
        this.client.job.count({ where: { category: { equals: category.name, mode: "insensitive" }, status: "OPEN" } }),
      ])
      return { ...category, totalJobs, openJobs }
    }))
  }

  async listActiveServiceCategories(): Promise<Array<{ name: string; slug: string }>> {
    return this.client.serviceCategory.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { name: true, slug: true } })
  }

  async saveAdminCategory(input: {
    actorUserId: string
    category: { name: string; slug: string; active: boolean; sortOrder: number }
    requestId: string
  }): Promise<AdminCategory> {
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.serviceCategory.findUnique({ where: { slug: input.category.slug }, select: { name: true } })
      if (existing && existing.name.toLowerCase() !== input.category.name.trim().toLowerCase()) {
        const used = await transaction.job.count({ where: { category: { equals: existing.name, mode: "insensitive" } } })
        if (used > 0) throw new MarketplaceConflictError("This category is already attached to existing jobs. Create a new category and deactivate this one instead of renaming it.")
      }
      const category = await transaction.serviceCategory.upsert({
        where: { slug: input.category.slug },
        create: input.category,
        update: {
          name: input.category.name,
          active: input.category.active,
          sortOrder: input.category.sortOrder,
        },
        select: { id: true, name: true, slug: true, active: true, sortOrder: true },
      })
      await transaction.adminAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          action: "admin.category.save",
          targetType: "service_category",
          targetId: category.id,
          metadata: { slug: category.slug, active: category.active },
          requestId: input.requestId,
        },
      })
      const [totalJobs, openJobs] = await Promise.all([
        transaction.job.count({ where: { category: { equals: category.name, mode: "insensitive" } } }),
        transaction.job.count({ where: { category: { equals: category.name, mode: "insensitive" }, status: "OPEN" } }),
      ])
      return { ...category, totalJobs, openJobs }
    })
  }

  async getAdminSettings(): Promise<AdminSystemSettings> {
    const stored = await this.client.adminSetting.findUnique({
      where: { key: "marketplace" },
      select: { value: true },
    })
    return { ...defaultAdminSettings, ...(stored?.value as Partial<AdminSystemSettings> | undefined) }
  }

  async saveAdminSettings(input: {
    actorUserId: string
    settings: AdminSystemSettings
    requestId: string
  }): Promise<AdminSystemSettings> {
    return this.client.$transaction(async (transaction) => {
      await transaction.adminSetting.upsert({
        where: { key: "marketplace" },
        create: {
          key: "marketplace",
          value: input.settings,
          updatedBy: input.actorUserId,
        },
        update: { value: input.settings, updatedBy: input.actorUserId },
      })
      await transaction.adminAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          action: "admin.system_settings.update",
          targetType: "admin_setting",
          targetId: "marketplace",
          metadata: input.settings,
          requestId: input.requestId,
        },
      })
      return input.settings
    })
  }

  async listAdminAdCampaigns(
    status: "all" | "pending" | "approved" | "rejected",
  ): Promise<AdminAdCampaign[]> {
    const rows = await this.client.adCampaign.findMany({
      where: status === "all" ? {} : { status: status.toUpperCase() as "PENDING" | "APPROVED" | "REJECTED" },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    })
    const eventCounts = rows.length ? await this.client.adCampaignEvent.groupBy({ by: ["campaignId", "eventType"], where: { campaignId: { in: rows.map((row) => row.id) } }, _count: true }) : []
    return rows.map((row) => ({
      id: row.id,
      advertiserName: row.advertiserName,
      title: row.title,
      description: row.description,
      placement: row.placement,
      destinationUrl: row.destinationUrl,
      status: row.status.toLowerCase() as AdminAdCampaign["status"],
      decisionReason: row.decisionReason,
      createdAt: row.createdAt.toISOString(),
      imageUrl: row.imageUrl,
      startAt: row.startAt?.toISOString() ?? null,
      endAt: row.endAt?.toISOString() ?? null,
      priceMinor: row.priceMinor === null ? null : Number(row.priceMinor),
      paymentStatus: row.paymentStatus as "pending" | "received",
      paymentReference: row.paymentReference,
      impressions: eventCounts.find((event) => event.campaignId === row.id && event.eventType === "impression")?._count ?? 0,
      clicks: eventCounts.find((event) => event.campaignId === row.id && event.eventType === "click")?._count ?? 0,
    }))
  }

  async createAdCampaign(input: {
    advertiserId: string | null
    advertiserName: string
    title: string
    description: string
    placement: string
    destinationUrl: string | null
    imageUrl?: string | null
    startAt?: Date | null
    endAt?: Date | null
    priceMinor?: bigint | null
  }): Promise<AdminAdCampaign> {
    const row = await this.client.adCampaign.create({ data: input })
    return {
      id: row.id,
      advertiserName: row.advertiserName,
      title: row.title,
      description: row.description,
      placement: row.placement,
      destinationUrl: row.destinationUrl,
      status: row.status.toLowerCase() as AdminAdCampaign["status"],
      decisionReason: row.decisionReason,
      createdAt: row.createdAt.toISOString(),
      imageUrl: row.imageUrl,
      startAt: row.startAt?.toISOString() ?? null,
      endAt: row.endAt?.toISOString() ?? null,
      priceMinor: row.priceMinor === null ? null : Number(row.priceMinor),
      paymentStatus: row.paymentStatus as "pending" | "received",
      paymentReference: row.paymentReference,
      impressions: 0,
      clicks: 0,
    }
  }

  async decideAdminAdCampaign(input: {
    actorUserId: string
    campaignId: string
    decision: "approved" | "rejected"
    reason: string | null
    requestId: string
  }): Promise<AdminAdCampaign | null> {
    return this.client.$transaction(async (transaction) => {
      const status = input.decision === "approved" ? "APPROVED" : "REJECTED"
      const updated = await transaction.adCampaign.updateMany({
        where: { id: input.campaignId, status: "PENDING" },
        data: {
          status,
          decisionReason: input.reason,
          reviewedBy: input.actorUserId,
          reviewedAt: new Date(),
        },
      })
      if (updated.count !== 1) return null
      await transaction.adminAuditEvent.create({
        data: {
          actorUserId: input.actorUserId,
          action: `admin.ad.${input.decision}`,
          targetType: "ad_campaign",
          targetId: input.campaignId,
          metadata: { reason: input.reason },
          requestId: input.requestId,
        },
      })
      const row = await transaction.adCampaign.findUnique({ where: { id: input.campaignId } })
      if (!row) return null
      return {
        id: row.id,
        advertiserName: row.advertiserName,
        title: row.title,
        description: row.description,
        placement: row.placement,
        destinationUrl: row.destinationUrl,
        status: row.status.toLowerCase() as AdminAdCampaign["status"],
        decisionReason: row.decisionReason,
        createdAt: row.createdAt.toISOString(),
        imageUrl: row.imageUrl,
        startAt: row.startAt?.toISOString() ?? null,
        endAt: row.endAt?.toISOString() ?? null,
        priceMinor: row.priceMinor === null ? null : Number(row.priceMinor),
        paymentStatus: row.paymentStatus as "pending" | "received",
        paymentReference: row.paymentReference,
        impressions: 0,
        clicks: 0,
      }
    })
  }

  async listLiveAds(placement: string) {
    const now = new Date()
    return this.client.adCampaign.findMany({
      where: { placement, status: "APPROVED", paymentStatus: "received", AND: [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gt: now } }] },
      ] },
      select: { id: true, title: true, description: true, advertiserName: true, imageUrl: true, destinationUrl: true },
      orderBy: [{ reviewedAt: "desc" }, { createdAt: "desc" }], take: 3,
    })
  }

  async recordAdCampaignEvent(campaignId: string, eventType: "impression" | "click") {
    const now = new Date()
    const campaign = await this.client.adCampaign.findFirst({ where: { id: campaignId, status: "APPROVED", paymentStatus: "received", AND: [{ OR: [{ startAt: null }, { startAt: { lte: now } }] }, { OR: [{ endAt: null }, { endAt: { gt: now } }] }] }, select: { id: true } })
    if (!campaign) return false
    await this.client.adCampaignEvent.create({ data: { campaignId, eventType } })
    return true
  }

  async markAdCampaignPaid(input: { actorUserId: string; campaignId: string; reference: string; requestId: string }): Promise<AdminAdCampaign | null> {
    return this.client.$transaction(async (transaction) => {
      const updated = await transaction.adCampaign.updateMany({ where: { id: input.campaignId, status: "APPROVED" }, data: { paymentStatus: "received", paymentReference: input.reference } })
      if (!updated.count) return null
      await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: "admin.ad.payment_received", targetType: "ad_campaign", targetId: input.campaignId, metadata: { reference: input.reference }, requestId: input.requestId } })
      const row = await transaction.adCampaign.findUnique({ where: { id: input.campaignId } })
      if (!row) return null
      const events = await transaction.adCampaignEvent.groupBy({ by: ["eventType"], where: { campaignId: row.id }, _count: true })
      return { id: row.id, advertiserName: row.advertiserName, title: row.title, description: row.description, placement: row.placement, destinationUrl: row.destinationUrl, status: row.status.toLowerCase() as AdminAdCampaign["status"], decisionReason: row.decisionReason, createdAt: row.createdAt.toISOString(), imageUrl: row.imageUrl, startAt: row.startAt?.toISOString() ?? null, endAt: row.endAt?.toISOString() ?? null, priceMinor: row.priceMinor === null ? null : Number(row.priceMinor), paymentStatus: row.paymentStatus as "pending" | "received", paymentReference: row.paymentReference, impressions: events.find((event) => event.eventType === "impression")?._count ?? 0, clicks: events.find((event) => event.eventType === "click")?._count ?? 0 }
    })
  }

  async recordAdminMonitoringSnapshot(input: {
    database: "ok" | "unavailable"
    pendingVerifications: number
    openReports: number
    heapUsedBytes: number
    heapLimitBytes: number
    alerts: AdminMonitoringSnapshot["alerts"]
  }): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      await transaction.adminMonitoringSnapshot.create({
        data: { ...input, heapUsedBytes: BigInt(input.heapUsedBytes), heapLimitBytes: BigInt(input.heapLimitBytes) },
      })
      const old = await transaction.adminMonitoringSnapshot.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10000,
        select: { id: true },
      })
      if (old.length) {
        await transaction.adminMonitoringSnapshot.deleteMany({
          where: { id: { notIn: old.map((entry) => entry.id) } },
        })
      }
    })
  }

  async listAdminMonitoringHistory(limit: number): Promise<AdminMonitoringSnapshot[]> {
    const rows = await this.client.adminMonitoringSnapshot.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    })
    return rows.map((row) => ({
      checkedAt: row.createdAt.toISOString(),
      uptimeSeconds: 0,
      heapUsedBytes: Number(row.heapUsedBytes),
      heapLimitBytes: Number(row.heapLimitBytes),
      database: row.database as "ok" | "unavailable",
      pendingVerifications: row.pendingVerifications,
      openReports: row.openReports,
      alerts: row.alerts as AdminMonitoringSnapshot["alerts"],
    }))
  }

  async getAdminMonitoringSnapshot(): Promise<{
    pendingVerifications: number
    pendingCustomerVerifications: number
    openReports: number
    openSupportCases: number
    overdueCommissionCount: number
    overdueCommissionMinor: number
  }> {
    const [pendingVerifications, pendingCustomerVerifications, openReports, openSupportCases, overdueCommissions] = await this.client.$transaction([
      this.client.providerProfile.count({
        where: { verificationStatus: "IN_REVIEW" },
      }),
      this.client.customerIdentityVerification.count({ where: { status: "IN_REVIEW" } }),
      this.client.moderationReport.count({
        where: { status: { in: ["OPEN", "REVIEWING"] } },
      }),
      this.client.supportCase.count({ where: { status: { not: "RESOLVED" } } }),
      this.client.jobPayment.aggregate({
        where: { status: "PAID", platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] }, platformFeeDueAt: { lte: new Date() } },
        _count: { _all: true },
        _sum: { commissionAmountMinor: true },
      }),
    ])

    return {
      pendingVerifications,
      pendingCustomerVerifications,
      openReports,
      openSupportCases,
      overdueCommissionCount: overdueCommissions._count._all,
      overdueCommissionMinor: Number(overdueCommissions._sum.commissionAmountMinor ?? 0n),
    }
  }

  private mapModerationReport(
    report: Awaited<ReturnType<PrismaClient["moderationReport"]["findUniqueOrThrow"]>>,
  ): AdminModerationReport {
    return {
      id: report.id,

      reporterUserId: report.reporterUserId,

      subjectType: report.subjectType,

      subjectId: report.subjectId,

      jobReference: null,

      reason: report.reason,

      details: report.details,

      status: report.status.toLowerCase(),

      createdAt: report.createdAt.toISOString(),

      updatedAt: report.updatedAt.toISOString(),
    }
  }

  async getAdminMemberRole(userId: string): Promise<AdminMemberRole | null> {
    const member = await this.client.adminMember.findUnique({ where: { userId }, select: { role: true } })
    return member?.role ?? null
  }

  async listAdminTeam(): Promise<AdminTeamSummary> {
    const [users, invites] = await this.client.$transaction([
      this.client.user.findMany({
        where: { roleAssignments: { some: { role: "ADMIN" } } },
        include: { adminMembership: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
      this.client.adminInvitation.findMany({
        include: { inviter: { select: { displayName: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: 100,
      }),
    ])
    const now = new Date()
    return {
      members: users.map((user) => ({
        userId: user.id,
        displayName: user.displayName,
        role: user.adminMembership?.role ?? "OWNER",
        legacyOwner: !user.adminMembership,
        joinedAt: (user.adminMembership?.createdAt ?? user.createdAt).toISOString(),
      })),
      invitations: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: invite.status === "PENDING" && invite.expiresAt <= now ? "EXPIRED" : invite.status,
        invitedByName: invite.inviter.displayName,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
        acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        revokedAt: invite.revokedAt?.toISOString() ?? null,
      })),
    }
  }

  async createAdminInvitation(input: { id: string; email: string; role: AdminMemberRole; tokenHash: string; invitedBy: string; expiresAt: Date }): Promise<AdminInvitationSummary> {
    const email = input.email.trim().toLowerCase()
    return this.client.$transaction(async (transaction) => {
      const existing = await transaction.adminInvitation.findFirst({ where: { email, status: "PENDING", expiresAt: { gt: new Date() } }, select: { id: true } })
      if (existing) throw new MarketplaceConflictError("A pending invitation already exists for this email.")
      const inviter = await transaction.user.findUnique({ where: { id: input.invitedBy }, select: { displayName: true } })
      if (!inviter) throw new MarketplaceConflictError("The inviting administrator could not be found.")
      const invite = await transaction.adminInvitation.create({
        data: { id: input.id, email, role: input.role, tokenHash: input.tokenHash, invitedBy: input.invitedBy, expiresAt: input.expiresAt },
      })
      await transaction.adminAuditEvent.create({
        data: { actorUserId: input.invitedBy, action: "admin.invitation.created", targetType: "admin_invitation", targetId: invite.id, metadata: { email, role: input.role }, requestId: "admin-invite:" + invite.id },
      })
      return { id: invite.id, email: invite.email, role: invite.role, status: invite.status, invitedByName: inviter.displayName, createdAt: invite.createdAt.toISOString(), expiresAt: invite.expiresAt.toISOString(), acceptedAt: null, revokedAt: null }
    })
  }

  async revokeAdminInvitation(invitationId: string, actorUserId: string): Promise<boolean> {
    return this.client.$transaction(async (transaction) => {
      const invite = await transaction.adminInvitation.findFirst({ where: { id: invitationId, status: "PENDING" } })
      if (!invite) return false
      const now = new Date()
      await transaction.adminInvitation.update({ where: { id: invite.id }, data: { status: "REVOKED", revokedAt: now, tokenHash: "revoked-" + invite.id.replaceAll("-", "") } })
      await transaction.adminAuditEvent.create({
        data: { actorUserId, action: "admin.invitation.revoked", targetType: "admin_invitation", targetId: invite.id, metadata: { email: invite.email, role: invite.role }, requestId: "admin-invite-revoke:" + invite.id },
      })
      return true
    })
  }

  async setAdminMemberRole(input: { userId: string; role: AdminMemberRole; actorUserId: string }): Promise<boolean> {
    return this.client.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({ where: { id: input.userId }, include: { adminMembership: true, roleAssignments: true } })
      if (!target?.roleAssignments.some((assignment) => assignment.role === "ADMIN") || !target.adminMembership) return false
      if (target.adminMembership.role === "OWNER" && input.role !== "OWNER") {
        const [explicitOwners, legacyOwners] = await Promise.all([
          transaction.adminMember.count({ where: { role: "OWNER" } }),
          transaction.user.count({ where: { adminMembership: null, roleAssignments: { some: { role: "ADMIN" } } } }),
        ])
        if (explicitOwners + legacyOwners <= 1) throw new MarketplaceConflictError("At least one admin owner must remain.")
      }
      await transaction.adminMember.update({ where: { userId: input.userId }, data: { role: input.role, assignedBy: input.actorUserId } })
      await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: "admin.member.role_changed", targetType: "admin_member", targetId: input.userId, metadata: { previousRole: target.adminMembership.role, role: input.role }, requestId: "admin-member-role:" + input.userId + ":" + Date.now() } })
      return true
    })
  }

  async removeAdminMember(input: { userId: string; actorUserId: string }): Promise<boolean> {
    return this.client.$transaction(async (transaction) => {
      const target = await transaction.user.findUnique({ where: { id: input.userId }, include: { adminMembership: true, roleAssignments: true } })
      if (!target?.roleAssignments.some((assignment) => assignment.role === "ADMIN") || !target.adminMembership) return false
      if (target.adminMembership.role === "OWNER") {
        const [explicitOwners, legacyOwners] = await Promise.all([
          transaction.adminMember.count({ where: { role: "OWNER" } }),
          transaction.user.count({ where: { adminMembership: null, roleAssignments: { some: { role: "ADMIN" } } } }),
        ])
        if (explicitOwners + legacyOwners <= 1) throw new MarketplaceConflictError("At least one admin owner must remain.")
      }
      await transaction.adminMember.delete({ where: { userId: input.userId } })
      await transaction.userRoleAssignment.deleteMany({ where: { userId: input.userId, role: "ADMIN" } })
      await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: "admin.member.removed", targetType: "admin_member", targetId: input.userId, metadata: { displayName: target.displayName, role: target.adminMembership.role }, requestId: "admin-member-remove:" + input.userId + ":" + Date.now() } })
      return true
    })
  }

  async acceptAdminInvitation(input: { invitationId: string; email: string; tokenHash: string; userId: string; displayName: string }): Promise<AdminMemberRole | null> {
    return this.client.$transaction(async (transaction) => {
      const now = new Date()
      const invite = await transaction.adminInvitation.findFirst({
        where: { id: input.invitationId, email: input.email.trim().toLowerCase(), tokenHash: input.tokenHash, status: "PENDING", expiresAt: { gt: now } },
      })
      if (!invite) return null
      const consumed = await transaction.adminInvitation.updateMany({
        where: { id: invite.id, status: "PENDING", tokenHash: input.tokenHash, expiresAt: { gt: now } },
        data: { status: "ACCEPTED", acceptedBy: input.userId, acceptedAt: now, tokenHash: "accepted-" + invite.id.replaceAll("-", "") },
      })
      if (consumed.count !== 1) return null
      await transaction.userRoleAssignment.upsert({
        where: { userId_role: { userId: input.userId, role: "ADMIN" } },
        create: { userId: input.userId, role: "ADMIN" },
        update: {},
      })
      await transaction.adminMember.upsert({
        where: { userId: input.userId },
        create: { userId: input.userId, role: invite.role, assignedBy: invite.invitedBy },
        update: { role: invite.role, assignedBy: invite.invitedBy },
      })
      await transaction.adminAuditEvent.create({
        data: { actorUserId: input.userId, action: "admin.invitation.accepted", targetType: "admin_member", targetId: input.userId, metadata: { email: invite.email, role: invite.role, invitedBy: invite.invitedBy }, requestId: "admin-invite-accept:" + invite.id },
      })
      return invite.role
    })
  }

  private mapAdminAlert(row: {
    id: string; code: string; severity: string; message: string; status: string; firstSeenAt: Date; lastSeenAt: Date;
    acknowledgedAt: Date | null; assignedAdminId: string | null; resolvedAt: Date | null; resolutionNote: string | null;
    assignee?: { displayName: string } | null
  }): AdminAlertSummary {
    return {
      id: row.id, code: row.code, severity: row.severity as "critical" | "warning", message: row.message,
      status: row.status.toLowerCase() as AdminAlertSummary["status"], firstSeenAt: row.firstSeenAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(), acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null,
      assignedAdminId: row.assignedAdminId, assignedAdminName: row.assignee?.displayName ?? null,
      resolvedAt: row.resolvedAt?.toISOString() ?? null, resolutionNote: row.resolutionNote,
    }
  }

  async listAdminAlerts(limit: number): Promise<AdminAlertSummary[]> {
    const rows = await this.client.adminAlert.findMany({
      include: { assignee: { select: { displayName: true } } },
      orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }, { id: "asc" }],
      take: limit,
    })
    return rows.map((row) => this.mapAdminAlert(row))
  }

  async syncAdminAlerts(alerts: AdminMonitoringSnapshot["alerts"]): Promise<void> {
    await this.client.$transaction(async (transaction) => {
      const activeKeys = alerts.map((alert) => "monitoring:" + alert.code)
      for (const alert of alerts) {
        const dedupeKey = "monitoring:" + alert.code
        const existing = await transaction.adminAlert.findUnique({ where: { dedupeKey }, select: { id: true, status: true } })
        if (existing) {
          await transaction.adminAlert.update({ where: { id: existing.id }, data: { severity: alert.severity, message: alert.message, lastSeenAt: new Date(), ...(existing.status === "RESOLVED" ? { status: "OPEN" as const, acknowledgedAt: null, acknowledgedBy: null, resolvedAt: null, resolvedBy: null, resolutionNote: null } : {}) } })
        } else {
          await transaction.adminAlert.create({ data: { code: alert.code, dedupeKey, severity: alert.severity, message: alert.message } })
        }
      }
      const active = await transaction.adminAlert.findMany({ where: { dedupeKey: { not: null }, status: { in: ["OPEN", "ACKNOWLEDGED"] } }, select: { id: true, dedupeKey: true } })
      for (const row of active) {
        if (row.dedupeKey && !activeKeys.includes(row.dedupeKey)) {
          await transaction.adminAlert.update({ where: { id: row.id }, data: { status: "RESOLVED", resolvedAt: new Date(), resolutionNote: "Condition cleared automatically." } })
        }
      }
    })
  }

  async updateAdminAlert(input: { actorUserId: string; alertId: string; action: "acknowledge" | "assign" | "resolve"; assignedAdminId?: string | null; reason?: string }): Promise<AdminAlertSummary | null> {
    return this.client.$transaction(async (transaction) => {
      const current = await transaction.adminAlert.findUnique({ where: { id: input.alertId } })
      if (!current) return null
      if (input.action === "assign" && input.assignedAdminId) {
        const admin = await transaction.userRoleAssignment.findFirst({ where: { userId: input.assignedAdminId, role: "ADMIN" }, select: { id: true } })
        if (!admin) throw new MarketplaceConflictError("Alerts can only be assigned to an admin account.")
      }
      const now = new Date()
      const data = input.action === "acknowledge"
        ? { status: "ACKNOWLEDGED" as const, acknowledgedAt: now, acknowledgedBy: input.actorUserId }
        : input.action === "assign"
          ? { assignedAdminId: input.assignedAdminId ?? null }
          : { status: "RESOLVED" as const, resolvedAt: now, resolvedBy: input.actorUserId, resolutionNote: input.reason?.trim() ?? "" }
      const updated = await transaction.adminAlert.update({ where: { id: current.id }, data, include: { assignee: { select: { displayName: true } } } })
      await transaction.adminAlertEvent.create({ data: { alertId: current.id, actorId: input.actorUserId, action: input.action, reason: input.reason?.trim() || null } })
      await transaction.adminAuditEvent.create({
        data: { actorUserId: input.actorUserId, action: "admin.alert." + input.action, targetType: "admin_alert", targetId: current.id, metadata: { code: current.code, reason: input.reason?.trim() ?? "", assignedAdminId: input.assignedAdminId ?? "" }, requestId: "admin-alert:" + current.id + ":" + now.getTime() },
      })
      return this.mapAdminAlert(updated)
    })
  }

  async listAdminAuditEvents(
    limit: number,
    offset: number,
    filters: AdminAuditFilters = { search: "", action: "", from: "", to: "" },
  ): Promise<AdminPage<AdminAuditEvent>> {
    const matchingActors = filters.search.trim()
      ? await this.client.user.findMany({ where: { displayName: { contains: filters.search.trim(), mode: "insensitive" } }, select: { id: true } })
      : []
    const search = filters.search.trim()
    const createdAt: Prisma.DateTimeFilter<"AdminAuditEvent"> = {}
    if (filters.from) createdAt.gte = new Date(filters.from + "T00:00:00+03:00")
    if (filters.to) createdAt.lt = new Date(new Date(filters.to + "T00:00:00+03:00").getTime() + 86_400_000)
    const searchTerms: Prisma.AdminAuditEventWhereInput[] = search ? [
        { action: { contains: search, mode: "insensitive" } },
        { targetType: { contains: search, mode: "insensitive" } },
        { targetId: { contains: search, mode: "insensitive" } },
        ...(matchingActors.length ? [{ actorUserId: { in: matchingActors.map((actor) => actor.id) } }] : []),
        ...( /^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(search) ? [{ actorUserId: search }] : []),
      ] : []
    const where: Prisma.AdminAuditEventWhereInput = {
      ...(filters.action ? { action: { contains: filters.action, mode: "insensitive" } } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
      ...(searchTerms.length ? { OR: searchTerms } : {}),
    }
    const [events, total] = await this.client.$transaction([
      this.client.adminAuditEvent.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],

        skip: offset,

        take: limit,
      }),

      this.client.adminAuditEvent.count({ where }),
    ])
    const eventActorIds = [...new Set(events.map((event) => event.actorUserId))]
    const actors = eventActorIds.length
      ? await this.client.user.findMany({ where: { id: { in: eventActorIds } }, select: { id: true, displayName: true } })
      : []
    const actorNames = new Map(actors.map((actor) => [actor.id, actor.displayName]))

    return {
      items: events.map((event) => ({
        id: event.id,

        actorUserId: event.actorUserId,

        actorDisplayName: actorNames.get(event.actorUserId) ?? null,

        action: event.action,

        targetType: event.targetType,

        targetId: event.targetId,

        metadata: event.metadata as AdminAuditEvent["metadata"],

        requestId: event.requestId,

        createdAt: event.createdAt.toISOString(),
      })),

      total,

      limit,

      offset,
    }
  }

  async listAdminMarketplaceActivity(
    limit: number,
    offset: number,
  ): Promise<AdminPage<AdminMarketplaceActivity>> {
    const [events, total] = await this.client.$transaction([
      this.client.marketplaceActivityEvent.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
        include: { actor: { select: { displayName: true } } },
      }),
      this.client.marketplaceActivityEvent.count(),
    ])

    return {
      items: events.map((event) => ({
        id: event.id,
        actorUserId: event.actorUserId,
        actorDisplayName: event.actor.displayName,
        actorRole: event.actorRole as AdminMarketplaceActivity["actorRole"],
        action: event.action,
        jobId: event.jobId,
        quoteId: event.quoteId,
        metadata: event.metadata as AdminMarketplaceActivity["metadata"],
        requestId: event.requestId,
        createdAt: event.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    }
  }

  async listAdminMarketplaceJobs(input: {
    filters: AdminMarketplaceJobFilters
    limit: number
    offset: number
  }): Promise<AdminPage<AdminMarketplaceJob>> {
    const { filters, limit, offset } = input
    const search = filters.search.trim()
    const referenceSearch = search.toUpperCase().replace(/\s+/g, "")
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search)
    const where = {
      ...(filters.status === "all" ? {} : {
        status: filters.status.toUpperCase() as
          | "OPEN"
          | "AWARDED"
          | "IN_PROGRESS"
          | "COMPLETION_PENDING"
          | "COMPLETED"
          | "CANCELLED"
          | "DISPUTED",
      }),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from ? { gte: new Date(filters.from) } : {}),
              ...(filters.to ? { lte: new Date(filters.to) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              ...(isUuid ? [{ id: search }] : []),
              { publicReference: referenceSearch },
              { title: { contains: search, mode: "insensitive" as const } },
              { category: { contains: search, mode: "insensitive" as const } },
              { locationLabel: { contains: search, mode: "insensitive" as const } },
              { customer: { displayName: { contains: search, mode: "insensitive" as const } } },
              {
                quotes: {
                  some: {
                    provider: { displayName: { contains: search, mode: "insensitive" as const } },
                  },
                },
              },
            ],
          }
        : {}),
    }
    const include = {
      customer: { select: { displayName: true } },
      quotes: { include: { provider: { select: { displayName: true } } }, orderBy: { createdAt: "asc" as const } },
      _count: { select: { quotes: true } },
    }
    const [jobs, total] = await this.client.$transaction([
      this.client.job.findMany({
        where,
        include,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
      }),
      this.client.job.count({ where }),
    ])

    return {
      items: jobs.map((job) => ({
        ...this.mapMarketplaceJob(job),
        customerDisplayName: job.customer.displayName,
        quotes: job.quotes.map((quote) => this.mapMarketplaceQuote(quote)),
        timeline: [],
      })),
      total,
      limit,
      offset,
    }
  }

  async getAdminMarketplaceJob(jobId: string): Promise<AdminMarketplaceJob | null> {
    const job = await this.client.job.findUnique({
      where: { id: jobId },
      include: {
        customer: { select: { displayName: true } },
        quotes: { include: { provider: { select: { displayName: true } } }, orderBy: { createdAt: "asc" } },
        _count: { select: { quotes: true } },
      },
    })
    if (!job) return null

    const events = await this.client.marketplaceActivityEvent.findMany({
      where: { jobId },
      include: { actor: { select: { displayName: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })
    return {
      ...this.mapMarketplaceJob(job),
      customerDisplayName: job.customer.displayName,
      quotes: job.quotes.map((quote) => this.mapMarketplaceQuote(quote)),
      timeline: events.map((event) => ({
        id: event.id,
        actorUserId: event.actorUserId,
        actorDisplayName: event.actor.displayName,
        actorRole: event.actorRole as AdminMarketplaceActivity["actorRole"],
        action: event.action,
        jobId: event.jobId,
        quoteId: event.quoteId,
        metadata: event.metadata as AdminMarketplaceActivity["metadata"],
        requestId: event.requestId,
        createdAt: event.createdAt.toISOString(),
      })),
    }
  }

  async recordAdminAuditEvent(
    event: Omit<AdminAuditEvent, "id" | "createdAt">,
  ): Promise<void> {
    await this.client.adminAuditEvent.create({
      data: event,
    })
  }

  async recordPolicyConsents(
    userId: string,

    termsVersion: string,

    privacyVersion: string,
  ): Promise<void> {
    await this.client.policyConsent.createMany({
      data: [
        { userId, document: "TERMS", version: termsVersion },

        { userId, document: "PRIVACY", version: privacyVersion },
      ],

      skipDuplicates: true,
    })
  }

  async submitProviderApplication(
    userId: string,

    application: ProviderApplicationInput,
  ): Promise<ProviderApplication> {
    const profile = await this.client.$transaction(async (transaction) => {
      let providerProfile = await transaction.providerProfile.upsert({
        where: { userId },

        create: {
          userId,

          publicName: application.publicName,

          bio: application.bio,

          region: application.region,

          verificationDocumentType: application.documentType ?? null,

          verificationDocumentPath: application.documentPath ?? null,

          skillsEvidence: application.skillsEvidence ?? null,

          verificationStatus: "IN_REVIEW",
        },

        update: {},
      })

      if (
        providerProfile.verificationStatus === "NOT_STARTED" ||
        providerProfile.verificationStatus === "REJECTED" ||
        providerProfile.verificationStatus === "IN_REVIEW"
      ) {
        providerProfile = await transaction.providerProfile.update({
          where: { userId },
          data: {
            publicName: application.publicName,
            bio: application.bio,
            region: application.region,

            verificationDocumentType: application.documentType ?? null,

            verificationDocumentPath: application.documentPath ?? null,

            skillsEvidence: application.skillsEvidence ?? null,
            verificationStatus: "IN_REVIEW",
          },
        })
      }

      await transaction.userRoleAssignment.upsert({
        where: { userId_role: { userId, role: "PROVIDER" } },
        create: { userId, role: "PROVIDER" },
        update: {},
      })

      return providerProfile
    })

    return {
      publicName: profile.publicName,

      bio: profile.bio ?? "",

      region: profile.region ?? "",

      ...(profile.verificationDocumentType ? { documentType: profile.verificationDocumentType as "national_id" | "passport" } : application.documentType ? { documentType: application.documentType as "national_id" | "passport" } : {}),

      ...(profile.verificationDocumentPath ? { documentPath: profile.verificationDocumentPath } : application.documentPath ? { documentPath: application.documentPath } : {}),

      ...(profile.skillsEvidence ? { skillsEvidence: profile.skillsEvidence } : application.skillsEvidence ? { skillsEvidence: application.skillsEvidence } : {}),

      status: profile.verificationStatus.toLowerCase(),
    }
  }

  async getProviderVerification(userId: string): Promise<ProviderVerificationSummary | null> {
    const profile = await this.client.providerProfile.findUnique({
      where: { userId },
      select: { verificationStatus: true, verificationDocumentType: true },
    })
    if (!profile) return null
    return {
      status: profile.verificationStatus.toLowerCase(),
      documentType: profile.verificationDocumentType,
    }
  }

  async getCustomerVerification(userId: string): Promise<CustomerVerificationSummary | null> {
    const record = await this.client.customerIdentityVerification.findUnique({ where: { userId } })
    return record ? {
      status: record.status.toLowerCase(),
      documentType: record.documentType,
      submittedAt: record.submittedAt.toISOString(),
      reviewReason: record.reviewReason,
    } : null
  }

  async submitCustomerVerification(
    userId: string,
    documentType: "national_id" | "passport",
    documentPath: string,
  ): Promise<CustomerVerificationSummary> {
    const existing = await this.client.customerIdentityVerification.findUnique({ where: { userId } })
    if (existing?.status === "IN_REVIEW" || existing?.status === "VERIFIED") {
      throw new MarketplaceConflictError("Your identity check is already submitted or approved.")
    }
    const record = await this.client.customerIdentityVerification.upsert({
      where: { userId },
      create: { userId, documentType, documentPath, status: "IN_REVIEW" },
      update: { documentType, documentPath, status: "IN_REVIEW", submittedAt: new Date(), reviewedAt: null, reviewedByUserId: null, reviewReason: null },
    })
    return {
      status: record.status.toLowerCase(),
      documentType: record.documentType,
      submittedAt: record.submittedAt.toISOString(),
      reviewReason: record.reviewReason,
    }
  }

  private mapMarketplaceJob(
    job: {
      id: string
      publicReference: string
      customerId: string
      title: string
      description: string
      category: string
      locationLabel: string
      budgetMinor: bigint | null
      currency: string
      status: string
      requestedFor: Date | null
      applicationDeadlineAt: Date | null
      dueAt: Date | null
      locationMode: string
      locationLatitude: number | null
      locationLongitude: number | null
      shareExactLocationWithProvider: boolean
      completionNote: string | null
      completionMedia: Prisma.JsonValue
      revisionNote: string | null
      media: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
      _count: { quotes: number }
    },
    options: { includePreciseLocation?: boolean; distanceKm?: number | null } = {},
  ): MarketplaceJob {
    const budgetMinor =
      job.budgetMinor === null ? null : Number(job.budgetMinor)
    if (budgetMinor !== null && !Number.isSafeInteger(budgetMinor)) {
      throw new Error("Stored job budget exceeds the supported currency range.")
    }

    return {
      id: job.id,
      jobReference: job.publicReference,
      customerId: job.customerId,
      title: job.title,
      description: job.description,
      category: job.category,
      locationLabel: job.locationLabel,
      budgetMinor,
      currency: job.currency.trim(),
      status: job.status.toLowerCase() as MarketplaceJob["status"],
      requestedFor: job.requestedFor?.toISOString() ?? null,
      applicationDeadlineAt: job.applicationDeadlineAt?.toISOString() ?? null,
      dueAt: job.dueAt?.toISOString() ?? null,
      locationMode: job.locationMode.toLowerCase() as NonNullable<MarketplaceJob["locationMode"]>,
      locationLatitude: options.includePreciseLocation === false ? null : job.locationLatitude,
      locationLongitude: options.includePreciseLocation === false ? null : job.locationLongitude,
      shareExactLocationWithProvider: job.shareExactLocationWithProvider,
      distanceKm: options.distanceKm ?? null,
      completionNote: job.completionNote,
      completionMedia: Array.isArray(job.completionMedia) ? job.completionMedia as ServiceListingMedia[] : [],
      revisionNote: job.revisionNote,
      media: Array.isArray(job.media) ? job.media as ServiceListingMedia[] : [],
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      quoteCount: job._count.quotes,
    }
  }

  private mapMarketplaceQuote(quote: {
    id: string
    jobId: string
    providerId: string
    amountMinor: bigint
    currency: string
    message: string
    availability: string
    status: string
    createdAt: Date
    updatedAt: Date
    provider: { displayName: string }
  }): MarketplaceQuote {
    const amountMinor = Number(quote.amountMinor)
    if (!Number.isSafeInteger(amountMinor)) {
      throw new Error("Stored quote exceeds the supported currency range.")
    }

    return {
      id: quote.id,
      jobId: quote.jobId,
      providerId: quote.providerId,
      providerName: quote.provider.displayName,
      amountMinor,
      currency: quote.currency.trim(),
      message: quote.message,
      availability: quote.availability,
      status: quote.status.toLowerCase() as MarketplaceQuote["status"],
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
    }
  }

  async listProviders(input: {
    search: string
    region: string
    limit: number
    offset: number
  }): Promise<AdminPage<MarketplaceProvider>> {
    const avatarColumnAvailable = await this.hasAvatarPathColumn()
    const search = input.search.trim()
    const region = input.region.trim()
    const base = {
      verificationStatus: "VERIFIED" as const,
      user: {
        status: "ACTIVE" as const,
        roleAssignments: { some: { role: "PROVIDER" as const } },
      },
    }
    const where = {
      ...base,
      ...(region
        ? { region: { contains: region, mode: "insensitive" as const } }
        : {}),
      ...(search
        ? {
            OR: [
              { publicName: { contains: search, mode: "insensitive" as const } },
              { bio: { contains: search, mode: "insensitive" as const } },
              { region: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    }
    const [providers, total] = await this.client.$transaction([
      this.client.providerProfile.findMany({
        where,
        select: { id: true, userId: true, publicName: true, bio: true, region: true, user: { select: avatarColumnAvailable ? { avatarPath: true } : { id: true } } },
        orderBy: [{ publicName: "asc" }, { id: "asc" }],
        skip: input.offset,
        take: input.limit,
      }),
      this.client.providerProfile.count({ where }),
    ])
    return {
      items: providers.map((provider) => ({
        id: provider.id,
        userId: provider.userId,
        publicName: provider.publicName,
        bio: provider.bio ?? "",
        region: provider.region ?? "",
        avatarPath: "avatarPath" in provider.user && typeof provider.user.avatarPath === "string" ? provider.user.avatarPath : null,
      })),
      total,
      limit: input.limit,
      offset: input.offset,
    }
  }

  async getProvider(providerId: string, requesterUserId?: string, quoteJobId?: string): Promise<MarketplaceProvider | null> {
    const avatarColumnAvailable = await this.hasAvatarPathColumn()
    const hasBidContext = Boolean(requesterUserId && quoteJobId && await this.client.job.findFirst({
      where: {
        id: quoteJobId,
        customerId: requesterUserId,
        quotes: { some: { providerId, status: { in: ["SUBMITTED", "ACCEPTED"] } } },
      },
      select: { id: true },
    }))
    const provider = await this.client.providerProfile.findFirst({
      where: {
        OR: [
          {
            OR: [{ id: providerId }, { userId: providerId }],
            verificationStatus: "VERIFIED",
            user: {
              status: "ACTIVE" as const,
              roleAssignments: { some: { role: "PROVIDER" as const } },
            },
          },
          ...(requesterUserId && providerId === requesterUserId
            ? [{
                userId: requesterUserId,
                user: {
                  status: "ACTIVE" as const,
                  roleAssignments: { some: { role: "PROVIDER" as const } },
                },
              }]
            : []),
          ...(hasBidContext
            ? [{
                OR: [{ id: providerId }, { userId: providerId }],
                user: {
                  status: "ACTIVE" as const,
                  roleAssignments: { some: { role: "PROVIDER" as const } },
                },
              }]
            : []),
        ],
      },
      select: { id: true, userId: true, publicName: true, bio: true, region: true, serviceLatitude: true, serviceLongitude: true, maxTravelDistanceKm: true },
    })
    const account = provider && avatarColumnAvailable ? await this.client.user.findUnique({ where: { id: provider.userId }, select: { avatarPath: true } }) : null
    return provider
      ? {
          id: provider.id,
          userId: provider.userId,
          publicName: provider.publicName,
          bio: provider.bio ?? "",
          region: provider.region ?? "",
          ...(requesterUserId === provider.userId ? {
            serviceLatitude: provider.serviceLatitude,
            serviceLongitude: provider.serviceLongitude,
            maxTravelDistanceKm: provider.maxTravelDistanceKm,
          } : {}),
          avatarPath: account?.avatarPath ?? null,
        }
      : null
  }

  async updateProviderProfile(userId: string, input: import("./auth/types.js").UpdateMarketplaceProviderProfileInput): Promise<MarketplaceProvider | null> {
    const updated = await this.client.providerProfile.updateMany({
      where: {
        userId,
        user: {
          status: "ACTIVE",
          roleAssignments: { some: { role: "PROVIDER" } },
        },
      },
      data: {
        publicName: input.publicName,
        bio: input.bio,
        region: input.region,
        ...(input.serviceLatitude !== undefined ? { serviceLatitude: input.serviceLatitude } : {}),
        ...(input.serviceLongitude !== undefined ? { serviceLongitude: input.serviceLongitude } : {}),
        ...(input.maxTravelDistanceKm !== undefined ? { maxTravelDistanceKm: input.maxTravelDistanceKm } : {}),
      },
    })
    if (updated.count !== 1) return null
    return this.getProvider(userId, userId)
  }

  async listSavedProviders(customerId: string): Promise<MarketplaceProvider[]> {
    const saved = await this.client.savedProvider.findMany({
      where: {
        customerId,
        providerProfile: {
          verificationStatus: "VERIFIED",
          user: {
            status: "ACTIVE",
            roleAssignments: { some: { role: "PROVIDER" } },
          },
        },
      },
      include: {
        providerProfile: {
          select: {
            id: true,
            userId: true,
            publicName: true,
            bio: true,
            region: true,
            user: { select: { avatarPath: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { providerProfileId: "asc" }],
    })
    return saved.map(({ providerProfile }) => ({
      id: providerProfile.id,
      userId: providerProfile.userId,
      publicName: providerProfile.publicName,
      bio: providerProfile.bio ?? "",
      region: providerProfile.region ?? "",
      avatarPath: providerProfile.user.avatarPath,
    }))
  }

  async saveProvider(customerId: string, providerId: string): Promise<boolean> {
    const provider = await this.client.providerProfile.findFirst({
      where: {
        OR: [{ id: providerId }, { userId: providerId }],
        verificationStatus: "VERIFIED",
        user: {
          status: "ACTIVE",
          roleAssignments: { some: { role: "PROVIDER" } },
        },
      },
      select: { id: true },
    })
    if (!provider) return false
    await this.client.savedProvider.upsert({
      where: { customerId_providerProfileId: { customerId, providerProfileId: provider.id } },
      create: { customerId, providerProfileId: provider.id },
      update: {},
    })
    return true
  }

  async removeSavedProvider(customerId: string, providerId: string): Promise<void> {
    const provider = await this.client.providerProfile.findFirst({
      where: { OR: [{ id: providerId }, { userId: providerId }] },
      select: { id: true },
    })
    if (!provider) return
    await this.client.savedProvider.deleteMany({
      where: { customerId, providerProfileId: provider.id },
    })
  }

  async listNotifications(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<AdminPage<MarketplaceNotification>> {
    const [rows, total] = await this.client.$transaction([
      this.client.marketplaceNotification.findMany({
        where: { userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: offset,
        take: limit,
      }),
      this.client.marketplaceNotification.count({ where: { userId } }),
    ])
    return {
      items: rows.map((row) => ({
        id: row.id,
        type: row.type,
        title: row.title,
        body: row.body,
        jobId: row.jobId,
        readAt: row.readAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    }
  }

  async markNotificationRead(userId: string, notificationId: string): Promise<boolean> {
    const result = await this.client.marketplaceNotification.updateMany({
      where: { id: notificationId, userId, readAt: null },
      data: { readAt: new Date() },
    })
    if (result.count === 1) return true
    return Boolean(await this.client.marketplaceNotification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    }))
  }

  async listJobs(
    userId: string,
    role: "consumer" | "provider",
    view: "mine" | "feed",
  ): Promise<MarketplaceJob[]> {
    await this.client.job.updateMany({
      where: {
        status: "OPEN",
        applicationDeadlineAt: { lte: new Date() },
        quotes: { none: { status: "SUBMITTED" } },
      },
      data: { status: "EXPIRED" },
    })
    const now = new Date()
    const where: Prisma.JobWhereInput =
      role === "consumer"
        ? { customerId: userId }
        : view === "feed"
          ? {
              customerId: { not: userId },
              OR: [
                { status: { in: ["AWARDED", "IN_PROGRESS", "COMPLETION_PENDING", "REVISION_REQUESTED"] } },
                { status: "OPEN" as const, OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: now } }] },
              ],
            }
          : {
              quotes: {
                some: { providerId: userId, status: "ACCEPTED" as const },
              },
            }

    const [jobs, providerLocation] = await Promise.all([
      this.client.job.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
        include: { _count: { select: { quotes: true } } },
      }),
      role === "provider" ? this.client.providerProfile.findUnique({
        where: { userId },
        select: { serviceLatitude: true, serviceLongitude: true },
      }) : Promise.resolve(null),
    ])

    const origin = providerLocation?.serviceLatitude == null || providerLocation.serviceLongitude == null
      ? null
      : { latitude: providerLocation.serviceLatitude, longitude: providerLocation.serviceLongitude }
    const mapped = jobs.map((job) => {
      const distanceKm = origin && job.locationLatitude != null && job.locationLongitude != null
        ? calculateDistanceKm(origin, { latitude: job.locationLatitude, longitude: job.locationLongitude })
        : null
      const includePreciseLocation = role === "consumer"
        || (role === "provider" && view === "mine" && job.shareExactLocationWithProvider)
      return this.mapMarketplaceJob(job, { includePreciseLocation, distanceKm })
    })
    if (role === "provider" && view === "feed") {
      return mapped.sort((a, b) => (a.distanceKm ?? Number.POSITIVE_INFINITY) - (b.distanceKm ?? Number.POSITIVE_INFINITY)
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return mapped
  }

  async getJob(
    userId: string,
    role: "consumer" | "provider",
    jobId: string,
  ): Promise<MarketplaceJob | null> {
    const now = new Date()
    const where: Prisma.JobWhereInput =
      role === "consumer"
        ? { id: jobId, customerId: userId }
        : {
            id: jobId,
            customerId: { not: userId },
            OR: [
              { status: { in: ["AWARDED", "IN_PROGRESS", "COMPLETION_PENDING", "REVISION_REQUESTED"] } },
              { status: "OPEN" as const, OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: now } }] },
              { quotes: { some: { providerId: userId } } },
            ],
          }

    const job = await this.client.job.findFirst({
      where,
      include: { _count: { select: { quotes: true } } },
    })

    if (!job) return null
    if (role === "consumer") return this.mapMarketplaceJob(job)
    const [accepted, providerLocation] = await Promise.all([
      this.client.quote.findFirst({ where: { jobId, providerId: userId, status: "ACCEPTED" }, select: { id: true } }),
      this.client.providerProfile.findUnique({ where: { userId }, select: { serviceLatitude: true, serviceLongitude: true } }),
    ])
    const distanceKm = providerLocation?.serviceLatitude != null && providerLocation.serviceLongitude != null && job.locationLatitude != null && job.locationLongitude != null
      ? calculateDistanceKm({ latitude: providerLocation.serviceLatitude, longitude: providerLocation.serviceLongitude }, { latitude: job.locationLatitude, longitude: job.locationLongitude })
      : null
    return this.mapMarketplaceJob(job, { includePreciseLocation: Boolean(accepted && job.shareExactLocationWithProvider), distanceKm })
  }

  async getJobHirerSummary(providerUserId: string, jobId: string) {
    const now = new Date()
    const job = await this.client.job.findFirst({
      where: { id: jobId, customerId: { not: providerUserId }, OR: [
        { status: { in: ["AWARDED", "IN_PROGRESS", "COMPLETION_PENDING", "REVISION_REQUESTED"] } },
        { status: "OPEN", OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: now } }] },
        { quotes: { some: { providerId: providerUserId } } },
      ] },
      select: { customer: { select: { displayName: true, createdAt: true, customerVerification: { select: { status: true } }, _count: { select: { customerJobs: { where: { status: "COMPLETED" } } } } } } },
    })
    if (!job) return null
    return { displayName: job.customer.displayName, memberSince: job.customer.createdAt.toISOString(), verified: job.customer.customerVerification?.status === "VERIFIED", completedJobs: job.customer._count.customerJobs }
  }

  async listQuotes(
    userId: string,
    role: "consumer" | "provider",
    jobId: string,
  ): Promise<MarketplaceQuote[] | null> {
    const now = new Date()
    const where: Prisma.JobWhereInput =
        role === "consumer"
          ? { id: jobId, customerId: userId }
          : {
              id: jobId,
              customerId: { not: userId },
              OR: [
                { status: { in: ["AWARDED", "IN_PROGRESS", "COMPLETION_PENDING", "REVISION_REQUESTED"] } },
                { status: "OPEN" as const, OR: [{ applicationDeadlineAt: null }, { applicationDeadlineAt: { gt: now } }] },
                { quotes: { some: { providerId: userId } } },
              ],
            }
    const job = await this.client.job.findFirst({ where,
      select: { id: true },
    })

    if (!job) return null

    const quotes = await this.client.quote.findMany({
      where: {
        jobId,
        ...(role === "provider" ? { providerId: userId } : {}),
      },
      include: { provider: { select: { displayName: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      distinct: ["providerId"],
    })

    return quotes.map((quote) => this.mapMarketplaceQuote(quote))
  }

  async listProviderQuotes(userId: string): Promise<MarketplaceProviderQuote[]> {
    const quotes = await this.client.quote.findMany({
      where: { providerId: userId },
      include: {
        provider: { select: { displayName: true } },
        job: { select: { publicReference: true, title: true, category: true, locationLabel: true, status: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      distinct: ["jobId", "providerId"],
    })
    return quotes.map((quote) => ({
      ...this.mapMarketplaceQuote(quote),
      jobReference: quote.job.publicReference,
      jobTitle: quote.job.title,
      jobCategory: quote.job.category,
      jobLocationLabel: quote.job.locationLabel,
      jobStatus: quote.job.status.toLowerCase(),
    }))
  }

  async createJob(
    userId: string,
    input: CreateMarketplaceJobInput,
    requestId: string,
  ): Promise<MarketplaceJob> {
    const now = Date.now()
    const applicationDeadlineAt = input.applicationDeadlineAt
      ? new Date(input.applicationDeadlineAt)
      : new Date(now + 7 * 24 * 60 * 60 * 1000)
    const dueAt = input.dueAt ? new Date(input.dueAt) : null
    const requestedFor = input.requestedFor ? new Date(input.requestedFor) : null
    if (
      Number.isNaN(applicationDeadlineAt.getTime()) ||
      applicationDeadlineAt.getTime() <= now ||
      (dueAt && (Number.isNaN(dueAt.getTime()) || dueAt <= applicationDeadlineAt)) ||
      (requestedFor && Number.isNaN(requestedFor.getTime())) ||
      ((input.locationLatitude ?? null) === null) !== ((input.locationLongitude ?? null) === null) ||
      (input.shareExactLocationWithProvider && input.locationLatitude == null)
    ) {
      throw new MarketplaceConflictError("Use a future application deadline and a work due date after it. Provide both map coordinates together.")
    }
    const job = await this.client.$transaction(async (transaction) => {
      const created = await transaction.job.create({
        data: {
          customerId: userId,
          title: input.title,
          description: input.description,
          category: input.category,
          locationLabel: input.locationLabel,
          budgetMinor:
            input.budgetMinor === null ? null : BigInt(input.budgetMinor),
          currency: "KES",
          requestedFor: input.requestedFor
            ? requestedFor
            : null,
          applicationDeadlineAt,
          dueAt,
          locationMode: (input.locationMode ?? "onsite").toUpperCase() as "ONSITE" | "REMOTE" | "FLEXIBLE",
          locationLatitude: input.locationLatitude ?? null,
          locationLongitude: input.locationLongitude ?? null,
          shareExactLocationWithProvider: input.shareExactLocationWithProvider ?? false,
          media: input.media ?? [],
        },
        include: { _count: { select: { quotes: true } } },
      })
      await transaction.marketplaceActivityEvent.create({
        data: {
          actorUserId: userId,
          actorRole: "consumer",
          action: "job.created",
          jobId: created.id,
          metadata: { title: created.title, category: created.category },
          requestId,
        },
      })
      await this.enqueueMarketplaceEvent(transaction, {
        requestId,
        eventType: "job.created",
        jobId: created.id,
        payload: { category: created.category },
      })
      return created
    })

    return this.mapMarketplaceJob(job)
  }

  async submitQuote(
    userId: string,
    jobId: string,
    input: SubmitMarketplaceQuoteInput,
    requestId: string,
  ): Promise<MarketplaceQuote | null> {
    // Self-quote guard: a provider must never quote their own job, even when
    // the account also carries the consumer role. The SQL condition below also
    // excludes the user's own jobs, but this explicit check makes the rule
    // auditable at the application layer as well.
    {
      const jobBefore =
        await this.client.job.findUnique({
          where: { id: jobId },
          select: { customerId: true },
        });
      if (jobBefore?.customerId === userId) {
        throw new MarketplaceConflictError(
          "You cannot submit a quote on your own job.",
        );
      }
    }

    try {
      return await this.client.$transaction(async (transaction) => {
        const openJobs = await transaction.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM public.jobs
          WHERE id = ${jobId}::uuid
            AND customer_id <> ${userId}::uuid
            AND status = 'OPEN'
            AND (application_deadline_at IS NULL OR application_deadline_at > NOW())
          FOR UPDATE
        `
        if (!openJobs.length) return null

        const existingQuote = await transaction.quote.findFirst({
          where: { jobId, providerId: userId, status: "SUBMITTED" },
          select: { id: true, revision: true },
        })

        const jobRow = await transaction.job.findUnique({
          where: { id: jobId },
          select: {
            id: true,
            customerId: true,
            status: true,
            requestedFor: true,
            customer: { select: { status: true } },
          },
        })
        if (!jobRow || jobRow.customerId === userId) {
          throw new MarketplaceConflictError(
            "This job is no longer accepting quotes.",
          )
        }

        const providerProfile =
          await this.client.providerProfile.findUnique({
            where: { userId },
            select: { verificationStatus: true },
          })
        const isEligibleProvider =
          providerProfile?.verificationStatus === "VERIFIED"

        if (!isEligibleProvider) {
          throw new MarketplaceConflictError(
            "Only approved providers can submit quotes to open jobs.",
          )
        }

        const latestQuote = await transaction.quote.aggregate({
          where: { jobId, providerId: userId },
          _max: { revision: true },
        })
        const quoteData = {
          revision: (latestQuote._max.revision ?? 0) + 1,
          amountMinor: BigInt(input.amountMinor),
          currency: "KES",
          message: input.message,
          availability: input.availability,
        }
        const quote = existingQuote
          ? await transaction.quote.update({
              where: { id: existingQuote.id },
              data: quoteData,
              include: { provider: { select: { displayName: true } } },
            })
          : await transaction.quote.create({
              data: { jobId, providerId: userId, ...quoteData },
              include: { provider: { select: { displayName: true } } },
            })
        await transaction.marketplaceActivityEvent.create({
          data: {
            actorUserId: userId,
            actorRole: "provider",
            action: existingQuote ? "quote.updated" : "quote.submitted",
            jobId,
            quoteId: quote.id,
            metadata: { amountMinor: input.amountMinor },
            requestId,
          },
        })
        await this.enqueueMarketplaceEvent(transaction, {
          requestId,
          eventType: "quote.submitted",
          jobId,
          quoteId: quote.id,
          recipientUserId: jobRow.customerId,
          title: existingQuote ? "A worker updated their proposal" : "A worker submitted a proposal",
          body: existingQuote ? `${quote.provider.displayName} updated their proposal for your job.` : `${quote.provider.displayName} submitted a proposal for your job.`,
          payload: { amountMinor: input.amountMinor },
        })

        return this.mapMarketplaceQuote(quote)
      }, { maxWait: 10000, timeout: 20000 })
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new MarketplaceConflictError(
          "You have already submitted a quote for this job.",
        )
      }
      throw error
    }
  }

  async acceptQuote(
    userId: string,
    jobId: string,
    quoteId: string,
    requestId: string,
  ): Promise<MarketplaceJob | null> {
    return this.client.$transaction(async (transaction) => {
      const ownedJob = await transaction.job.findFirst({
        where: { id: jobId, customerId: userId },
        select: { id: true },
      })
      if (!ownedJob) return null

      const jobUpdate = await transaction.job.updateMany({
        where: { id: jobId, customerId: userId, status: "OPEN" },
        data: { status: "AWARDED" },
      })
      if (jobUpdate.count !== 1) {
        throw new MarketplaceConflictError(
          "This job is no longer open for quote acceptance.",
        )
      }

      const quoteUpdate = await transaction.quote.updateMany({
        where: { id: quoteId, jobId, status: "SUBMITTED" },
        data: { status: "ACCEPTED" },
      })
      if (quoteUpdate.count !== 1) {
        throw new MarketplaceConflictError(
          "This quote is no longer available.",
        )
      }

      const declinedQuotes = await transaction.quote.findMany({
        where: { jobId, id: { not: quoteId }, status: "SUBMITTED" },
        select: { id: true, providerId: true },
      })
      const acceptedQuote = await transaction.quote.findUnique({
        where: { id: quoteId },
        select: { id: true, providerId: true, amountMinor: true, currency: true },
      })
      if (!acceptedQuote) {
        throw new MarketplaceConflictError(
          "The accepted quote could not be found. Refresh the job and try again.",
        )
      }
      const settingsRow = await transaction.adminSetting.findUnique({ where: { key: "marketplace" }, select: { value: true } })
      const settings = { ...defaultAdminSettings, ...(settingsRow?.value as Partial<AdminSystemSettings> | undefined) }
      const commissionBasisPoints = Math.round(settings.marketplaceCommissionPercent * 100)
      const commissionAmountMinor = (acceptedQuote.amountMinor * BigInt(commissionBasisPoints) + 5000n) / 10000n
      const payment = await transaction.jobPayment.create({
        data: {
          jobId,
          quoteId: acceptedQuote.id,
          customerId: userId,
          providerId: acceptedQuote.providerId,
          grossAmountMinor: acceptedQuote.amountMinor,
          commissionBasisPoints,
          commissionAmountMinor,
          providerAmountMinor: acceptedQuote.amountMinor - commissionAmountMinor,
          currency: acceptedQuote.currency,
        },
      })
      await transaction.jobPaymentEvent.create({
        data: { paymentId: payment.id, actorId: userId, action: "payment.agreed", metadata: { grossAmountMinor: Number(acceptedQuote.amountMinor), commissionBasisPoints }, requestId },
      })
      await transaction.quote.updateMany({
        where: { jobId, id: { not: quoteId }, status: "SUBMITTED" },
        data: { status: "DECLINED" },
      })
      await transaction.marketplaceActivityEvent.create({
        data: {
          actorUserId: userId,
          actorRole: "consumer",
          action: "quote.accepted",
          jobId,
          quoteId,
          metadata: {},
          requestId,
        },
      })
      await this.enqueueMarketplaceEvent(transaction, {
        requestId,
        eventType: "quote.accepted",
        jobId,
        quoteId,
        recipientUserId: acceptedQuote.providerId,
        title: "Your quote was accepted",
        body: "The customer accepted your quote. Review the job before starting work.",
      })
      if (declinedQuotes.length > 0) {
        await transaction.marketplaceActivityEvent.createMany({
          data: declinedQuotes.map((quote) => ({
            actorUserId: userId,
            actorRole: "consumer",
            action: "quote.declined",
            jobId,
            quoteId: quote.id,
            metadata: { reason: "Another quote was accepted." },
            requestId,
          })),
        })
        for (const quote of declinedQuotes) {
          await this.enqueueMarketplaceEvent(transaction, {
            requestId,
            eventType: "quote.declined",
            jobId,
            quoteId: quote.id,
            recipientUserId: quote.providerId,
            title: "This job selected another quote",
            body: "The customer selected another provider. This quote is no longer actionable.",
            payload: { reason: "Another quote was accepted." },
          })
        }
      }

      const acceptedJob = await transaction.job.findUnique({
        where: { id: jobId },
        include: { _count: { select: { quotes: true } } },
      })
      return acceptedJob ? this.mapMarketplaceJob(acceptedJob) : null
    })
  }

  async transitionJob(
    userId: string,
    jobId: string,
    transition: "start" | "submit_completion" | "confirm_completion" | "request_revision" | "cancel",
    requestId: string,
    details?: { note: string; media?: ServiceListingMedia[] },
  ): Promise<MarketplaceJob | null> {
    const providerTransition = transition === "start" || transition === "submit_completion"
    const where =
      transition === "confirm_completion" || transition === "request_revision"
        ? { id: jobId, customerId: userId }
        : transition === "cancel"
          ? { id: jobId, customerId: userId }
          : {
              id: jobId,
              quotes: {
                some: {
                  providerId: userId,
                  status: "ACCEPTED" as const,
                },
              },
            }

    const job = await this.client.job.findFirst({
      where,
      include: {
        _count: { select: { quotes: true } },
        quotes: { select: { providerId: true, status: true } },
      },
    })
    if (!job) return null

    // Confirming completion is safe to retry. A double click or a delayed
    // response can otherwise turn the second, already-satisfied request into
    // a misleading conflict for the hirer.
    if (transition === "confirm_completion" && job.status === "COMPLETED") {
      return this.mapMarketplaceJob(job, { includePreciseLocation: job.customerId === userId || job.shareExactLocationWithProvider })
    }

    const expectedStatus = transition === "start"
      ? "AWARDED"
      : transition === "submit_completion"
        ? job.status
        : transition === "confirm_completion" || transition === "request_revision"
          ? "COMPLETION_PENDING"
          : "OPEN"
    const nextStatus = transition === "start"
      ? "IN_PROGRESS"
      : transition === "submit_completion"
        ? "COMPLETION_PENDING"
        : transition === "confirm_completion"
          ? "COMPLETED"
          : transition === "request_revision"
            ? "REVISION_REQUESTED"
            : "CANCELLED"

    if (transition === "submit_completion" && !["IN_PROGRESS", "REVISION_REQUESTED"].includes(job.status)) {
      throw new MarketplaceConflictError("Work can only be submitted while the job is in progress or a revision is requested.")
    }
    if (transition === "request_revision" && !details?.note.trim()) {
      throw new MarketplaceConflictError("Add a short note explaining the requested revision.")
    }

    const updatedJob = await this.client.$transaction(async (transaction) => {
      const update = await transaction.job.updateMany({
        where: { ...where, status: expectedStatus },
        data: {
          status: nextStatus,
          ...(transition === "submit_completion"
            ? { completionNote: details?.note.trim() || null, completionMedia: details?.media ?? [], revisionNote: null, completionSubmittedAt: new Date() }
            : transition === "request_revision"
              ? { revisionNote: details?.note.trim() || null, completionSubmittedAt: null }
            : {}),
        },
      })
      if (update.count !== 1) {
        throw new MarketplaceConflictError(
          "The job status changed. Refresh the page and try again.",
        )
      }
      await transaction.marketplaceActivityEvent.create({
        data: {
          actorUserId: userId,
          actorRole: providerTransition ? "provider" : "consumer",
          action: `job.${transition === "submit_completion" ? "completion_submitted" : transition === "confirm_completion" ? "completion_confirmed" : transition === "request_revision" ? "revision_requested" : transition === "cancel" ? "withdrawn" : transition}`,
          jobId,
          metadata:
            transition === "cancel"
              ? { reason: "Poster withdrew this open job." }
              : transition === "submit_completion" || transition === "request_revision"
                ? { from: expectedStatus.toLowerCase(), to: nextStatus.toLowerCase(), note: details?.note.trim() ?? "" }
              : { from: expectedStatus.toLowerCase(), to: nextStatus.toLowerCase() },
          requestId,
        },
      })
      let recipients: string[] = []
      if (providerTransition) recipients = [job.customerId]
      else if (transition === "confirm_completion") {
        recipients = job.quotes
          .filter((quote) => quote.status === "ACCEPTED")
          .map((quote) => quote.providerId)
      } else if (transition === "request_revision") {
        recipients = job.quotes
          .filter((quote) => quote.status === "ACCEPTED")
          .map((quote) => quote.providerId)
      } else if (transition === "cancel") {
        recipients = job.quotes
          .filter((quote) => quote.status === "SUBMITTED")
          .map((quote) => quote.providerId)
      }
      const eventType = `job.${transition === "submit_completion" ? "completion_submitted" : transition === "confirm_completion" ? "completion_confirmed" : transition === "request_revision" ? "revision_requested" : transition === "cancel" ? "withdrawn" : transition}`
      const title = transition === "start"
        ? "Work has started"
        : transition === "submit_completion"
          ? "Worker submitted work for review"
          : transition === "confirm_completion"
            ? "The job was marked complete"
            : transition === "request_revision"
              ? "The customer requested a revision"
              : "A job you quoted was withdrawn"
      const body = transition === "start"
        ? "The selected worker started work on your job."
        : transition === "submit_completion"
          ? "The worker submitted the work for review. Review the job and confirm or request a revision."
          : transition === "confirm_completion"
            ? "The customer confirmed that the work is complete."
            : transition === "request_revision"
              ? "The customer requested a change before approving the work."
              : "The customer withdrew this open job."
      if (recipients.length === 0) {
        await this.enqueueMarketplaceEvent(transaction, {
          requestId,
          eventType,
          jobId,
          payload: { from: expectedStatus.toLowerCase(), to: nextStatus.toLowerCase() },
        })
      }
      for (const recipientUserId of new Set(recipients)) {
        await this.enqueueMarketplaceEvent(transaction, {
          requestId,
          eventType,
          jobId,
          recipientUserId,
          title,
          body,
          payload: { from: expectedStatus.toLowerCase(), to: nextStatus.toLowerCase() },
        })
      }

      return transaction.job.findUnique({
        where: { id: jobId },
        include: { _count: { select: { quotes: true } } },
      })
    })
    return updatedJob
      ? this.mapMarketplaceJob(updatedJob, { includePreciseLocation: updatedJob.customerId === userId || updatedJob.shareExactLocationWithProvider })
      : null
  }

  async listMyJobPayments(userId: string, role: "consumer" | "provider"): Promise<JobPaymentRecord[]> {
    const rows = await this.client.jobPayment.findMany({
      where: role === "consumer" ? { customerId: userId } : { providerId: userId },
      include: jobPaymentRelations,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    })
    const now = new Date()
    return rows.map((row) => ({
      ...mapJobPayment(row),
      commissionOverdue: row.status === "PAID"
        && (row.platformFeeStatus === "DUE" || row.platformFeeStatus === "NEEDS_CORRECTION")
        && Boolean(row.platformFeeDueAt && row.platformFeeDueAt <= now),
    }))
  }

  /** Idempotent hourly safety net for hirer review and commission reminders. */
  async runMarketplaceReminders(now = new Date()): Promise<{ completionReviews: number; commissions: number }> {
    const reviewThresholds = [24, 72]
    const pendingReviews = await this.client.job.findMany({
      where: { status: "COMPLETION_PENDING", completionSubmittedAt: { not: null } },
      select: { id: true, title: true, publicReference: true, customerId: true, completionSubmittedAt: true },
    })
    let completionReviews = 0
    for (const job of pendingReviews) {
      const submittedAt = job.completionSubmittedAt
      if (!submittedAt) continue
      const elapsedHours = (now.getTime() - submittedAt.getTime()) / 3_600_000
      const reminders = reviewThresholds.filter((hours) => elapsedHours >= hours)
      if (!reminders.length) continue
      const created = await this.client.marketplaceNotification.createMany({
        data: reminders.map((hours) => ({
          userId: job.customerId, type: "job.completion_review_reminder",
          title: hours === 24 ? "Work is waiting for your review" : "Work review is overdue",
          body: `Job ${job.publicReference}: ${job.title} has been waiting ${hours} hours. Review the submission and confirm completion or request a revision.`,
          jobId: job.id, dedupeKey: `review-reminder:${job.id}:${hours}h:${job.customerId}`.slice(0, 180),
        })), skipDuplicates: true,
      })
      completionReviews += created.count
    }

    const duePayments = await this.client.jobPayment.findMany({
      where: { status: "PAID", platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] }, platformFeeDueAt: { not: null } },
      select: { id: true, jobId: true, customerId: true, paymentReference: true, currency: true, commissionAmountMinor: true, platformFeeDueAt: true, platformFeeReminderCycle: true, job: { select: { publicReference: true, title: true } } },
    })
    const feeStages = [
      { key: "due-soon", offsetHours: -24, title: "OddJobs commission due tomorrow" },
      { key: "due", offsetHours: 0, title: "OddJobs commission is due today" },
      { key: "overdue-24h", offsetHours: 24, title: "OddJobs commission is overdue" },
      { key: "overdue-72h", offsetHours: 72, title: "Urgent: OddJobs commission remains unpaid" },
    ]
    let commissions = 0
    for (const payment of duePayments) {
      const dueAt = payment.platformFeeDueAt
      if (!dueAt) continue
      const eligible = feeStages.filter((stage) => now.getTime() >= dueAt.getTime() + stage.offsetHours * 3_600_000)
      const stage = eligible.at(-1)
      if (!stage) continue
      const amount = new Intl.NumberFormat("en-KE", { style: "currency", currency: payment.currency.trim() }).format(Number(payment.commissionAmountMinor) / 100)
      const deadline = dueAt.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })
      const created = await this.client.$transaction(async (transaction) => {
        const current = await transaction.jobPayment.findFirst({ where: { id: payment.id, status: "PAID", platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] } }, select: { id: true } })
        if (!current) return 0
        const key = `commission-reminder:${payment.id}:${payment.platformFeeReminderCycle}:${stage.key}:${payment.customerId}`.slice(0, 180)
        const notificationResult = await transaction.marketplaceNotification.createMany({ data: [{
          userId: payment.customerId, type: "payment.platform_fee_reminder", title: stage.title,
          body: `Job ${payment.job.publicReference}: ${amount} for ${payment.job.title} was due by ${deadline}. Pay OddJobs and report the transfer reference in Payment history.`,
          jobId: payment.jobId, dedupeKey: key,
        }], skipDuplicates: true })
        if (notificationResult.count) await transaction.jobPaymentEvent.create({ data: {
          paymentId: payment.id, actorId: null, action: `platform_fee.reminder.${stage.key}`,
          metadata: { amountMinor: Number(payment.commissionAmountMinor), dueAt: dueAt.toISOString(), stage: stage.key, cycle: payment.platformFeeReminderCycle },
          requestId: `fee-reminder:${payment.id}:${payment.platformFeeReminderCycle}:${stage.key}`.slice(0, 80),
        } })
        return notificationResult.count
      })
      commissions += created
    }
    return { completionReviews, commissions }
  }

  async reportJobPayment(userId: string, jobId: string, method: JobPaymentMethod, requestId: string): Promise<JobPaymentRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const job = await transaction.job.findFirst({ where: { id: jobId, customerId: userId, status: "COMPLETED" }, select: { id: true } })
      if (!job) return null
      const payment = await transaction.jobPayment.findUnique({ where: { jobId } })
      if (!payment) return null
      if (payment.status !== "AWAITING_PAYMENT") {
        if (payment.status === "REPORTED" && payment.reportedByUserId === userId && payment.method?.toLowerCase() === method) {
          const current = await transaction.jobPayment.findUnique({ where: { id: payment.id }, include: jobPaymentRelations })
          return current ? mapJobPayment(current) : null
        }
        throw new MarketplaceConflictError("This job already has a reported or settled payment.")
      }
      const updated = await transaction.jobPayment.update({
        where: { id: payment.id },
        data: { status: "REPORTED", method: method.toUpperCase() as "CASH" | "MANUAL_TRANSFER", reportedByUserId: userId, reportedAt: new Date() },
      })
      await transaction.jobPaymentEvent.create({ data: { paymentId: payment.id, actorId: userId, action: "payment.reported", metadata: { method }, requestId } })
      const hydrated = await transaction.jobPayment.findUnique({ where: { id: updated.id }, include: jobPaymentRelations })
      return hydrated ? mapJobPayment(hydrated) : null
    })
  }

  async reportPlatformFee(userId: string, jobId: string, paymentReference: string, requestId: string): Promise<JobPaymentRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const payment = await transaction.jobPayment.findFirst({ where: { jobId, customerId: userId, status: "PAID", job: { status: "COMPLETED" } }, include: { job: { select: { publicReference: true } }, customer: { select: { displayName: true } } } })
      if (!payment) return null
      if (payment.platformFeeStatus !== "DUE" && payment.platformFeeStatus !== "NEEDS_CORRECTION") {
        if (payment.platformFeeReportedByUserId === userId && payment.platformFeePaymentReference === paymentReference.trim()) {
          const current = await transaction.jobPayment.findUnique({ where: { id: payment.id }, include: jobPaymentRelations })
          return current ? mapJobPayment(current) : null
        }
        throw new MarketplaceConflictError("The platform fee has already been reported or received.")
      }
      const updated = await transaction.jobPayment.update({ where: { id: payment.id }, data: {
        platformFeeStatus: "REPORTED", platformFeeReportedByUserId: userId,
        platformFeeReportedAt: new Date(), platformFeePaymentReference: paymentReference.trim(), platformFeeCorrectionReason: null,
      } })
      await transaction.jobPaymentEvent.create({ data: { paymentId: payment.id, actorId: userId, action: "platform_fee.reported", metadata: { paymentReference: paymentReference.trim(), amountMinor: Number(payment.commissionAmountMinor) }, requestId } })
      await transaction.marketplaceNotification.updateMany({
        where: { userId, jobId: payment.jobId, type: { in: ["payment.platform_fee_reminder", "payment.platform_fee_manual_reminder"] } },
        data: { readAt: new Date(), title: "Payment reported — reminder closed", body: `You reported the OddJobs fee for Job ${payment.job.publicReference}. This reminder is closed while OddJobs reviews your payment reference.` },
      })
      const administrators = await transaction.userRoleAssignment.findMany({ where: { role: "ADMIN" }, select: { userId: true } })
      if (administrators.length) await transaction.marketplaceNotification.createMany({
        data: [...new Set(administrators.map((item) => item.userId))].map((adminId) => ({
          userId: adminId, type: "payment.platform_fee_reported", title: "Commission receipt needs review",
          body: `${payment.customer.displayName} reported a fee payment for ${payment.job.publicReference}. Verify the reference in Payments & wallets.`,
          jobId: payment.jobId, dedupeKey: `commission-reported:${payment.id}:${adminId}`.slice(0, 180),
        })), skipDuplicates: true,
      })
      const hydrated = await transaction.jobPayment.findUnique({ where: { id: updated.id }, include: jobPaymentRelations })
      return hydrated ? mapJobPayment(hydrated) : null
    })
  }

  async requestAdminPlatformFeeCorrection(input: { actorUserId: string; paymentId: string; reason: string; requestId: string }): Promise<JobPaymentRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const payment = await transaction.jobPayment.findFirst({ where: { id: input.paymentId, platformFeeStatus: "REPORTED" }, include: { job: { select: { publicReference: true } } } })
      if (!payment) return null
      const reason = input.reason.trim()
      if (reason.length < 10) throw new MarketplaceConflictError("Provide a clear correction reason of at least 10 characters.")
      const nextCycle = payment.platformFeeReminderCycle + 1
      const updated = await transaction.jobPayment.update({ where: { id: payment.id }, data: {
        platformFeeStatus: "NEEDS_CORRECTION", platformFeeCorrectionReason: reason,
        platformFeeReminderCycle: nextCycle,
      } })
      await transaction.jobPaymentEvent.create({ data: { paymentId: payment.id, actorId: input.actorUserId, action: "platform_fee.correction_requested", metadata: { reason, cycle: nextCycle }, requestId: input.requestId } })
      await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: "admin.platform_fee.correction_requested", targetType: "job_payment", targetId: payment.id, metadata: { jobId: payment.jobId, reason }, requestId: input.requestId } })
      await transaction.marketplaceNotification.create({ data: {
        userId: payment.customerId, type: "payment.platform_fee_correction", title: "Action needed: update your commission payment reference",
        body: `Job ${payment.job.publicReference}: OddJobs could not verify your payment reference. ${reason} Please update the reference in Payments & fees.`,
        jobId: payment.jobId, dedupeKey: `commission-correction:${payment.id}:${nextCycle}`.slice(0, 180),
      } })
      const hydrated = await transaction.jobPayment.findUnique({ where: { id: updated.id }, include: jobPaymentRelations })
      return hydrated ? mapJobPayment(hydrated) : null
    })
  }

  async sendAdminPlatformFeeReminder(input: { actorUserId: string; paymentId: string; note: string; requestId: string }): Promise<JobPaymentRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const payment = await transaction.jobPayment.findFirst({
        where: { id: input.paymentId, status: "PAID", platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] } },
        include: { job: { select: { publicReference: true } }, customer: { select: { displayName: true } } },
      })
      if (!payment) return null
      if (!payment.platformFeeDueAt || payment.platformFeeDueAt > new Date()) {
        throw new MarketplaceConflictError("Manual reminders can only be sent after the commission deadline.")
      }
      const recent = await transaction.jobPaymentEvent.findFirst({
        where: { paymentId: payment.id, action: "platform_fee.reminder.manual", createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { createdAt: true },
      })
      if (recent) throw new MarketplaceConflictError(`A manual reminder was sent ${Math.ceil((Date.now() - recent.createdAt.getTime()) / 3_600_000)} hours ago. You can send another after 24 hours.`)
      const note = input.note.trim()
      const amount = new Intl.NumberFormat("en-KE", { style: "currency", currency: payment.currency.trim() }).format(Number(payment.commissionAmountMinor) / 100)
      const due = payment.platformFeeDueAt?.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" }) ?? "the stated deadline"
      const body = `Admin reminder: ${amount} for Job ${payment.job.publicReference} was due by ${due}. Please report the payment reference in Payments & fees.${note ? ` Note: ${note}` : ""}`
      await transaction.marketplaceNotification.create({ data: {
        userId: payment.customerId, type: "payment.platform_fee_manual_reminder", title: "Reminder: OddJobs commission payment needed",
        body, jobId: payment.jobId, dedupeKey: `commission-manual:${payment.id}:${randomUUID()}`.slice(0, 180),
      } })
      await transaction.jobPaymentEvent.create({ data: { paymentId: payment.id, actorId: input.actorUserId, action: "platform_fee.reminder.manual", metadata: { note, cycle: payment.platformFeeReminderCycle }, requestId: input.requestId } })
      await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: "admin.commission.reminder_sent", targetType: "job_payment", targetId: payment.id, metadata: { jobId: payment.jobId, note }, requestId: input.requestId } })
      const hydrated = await transaction.jobPayment.findUnique({ where: { id: payment.id }, include: jobPaymentRelations })
      return hydrated ? mapJobPayment(hydrated) : null
    })
  }

  async confirmJobPayment(userId: string, jobId: string, requestId: string): Promise<JobPaymentRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const payment = await transaction.jobPayment.findUnique({ where: { jobId } })
      if (!payment || payment.providerId !== userId) return null
      if (payment.status === "PAID" && payment.confirmedByUserId === userId) {
        const current = await transaction.jobPayment.findUnique({ where: { id: payment.id }, include: jobPaymentRelations })
        return current ? mapJobPayment(current) : null
      }
      if (payment.status !== "REPORTED" || payment.reportedByUserId === userId) {
        throw new MarketplaceConflictError("Only the worker can confirm a payment reported by the hirer.")
      }
      const confirmedAt = new Date()
      const platformFeeDueAt = new Date(confirmedAt.getTime() + 48 * 60 * 60 * 1000)
      const updated = await transaction.jobPayment.update({ where: { id: payment.id }, data: { status: "PAID", confirmedByUserId: userId, confirmedAt, platformFeeDueAt } })
      await transaction.jobPaymentEvent.create({ data: { paymentId: payment.id, actorId: userId, action: "payment.confirmed", metadata: { providerAmountMinor: Number(payment.providerAmountMinor) }, requestId } })
      await transaction.jobPaymentEvent.create({ data: { paymentId: payment.id, actorId: userId, action: "platform_fee.due", metadata: { amountMinor: Number(payment.commissionAmountMinor), dueAt: platformFeeDueAt.toISOString() }, requestId: `${requestId}:commission-due`.slice(0, 80) } })
      await this.enqueueMarketplaceEvent(transaction, {
        requestId: `${requestId}:commission-due`.slice(0, 80), eventType: "payment.platform_fee_due", jobId: payment.jobId,
        recipientUserId: payment.customerId, title: "OddJobs commission is due",
        body: `Your OddJobs fee of ${new Intl.NumberFormat("en-KE", { style: "currency", currency: payment.currency.trim() }).format(Number(payment.commissionAmountMinor) / 100)} is due by ${platformFeeDueAt.toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })}. Report the payment reference in your payment history.`,
        payload: { paymentId: payment.id, amountMinor: Number(payment.commissionAmountMinor), dueAt: platformFeeDueAt.toISOString() },
      })
      const hydrated = await transaction.jobPayment.findUnique({ where: { id: updated.id }, include: jobPaymentRelations })
      return hydrated ? mapJobPayment(hydrated) : null
    })
  }

  async disputeJobPayment(userId: string, jobId: string, reason: string, requestId: string): Promise<JobPaymentRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const payment = await transaction.jobPayment.findUnique({ where: { jobId } })
      if (!payment || ![payment.customerId, payment.providerId].includes(userId)) return null
      if (payment.status !== "REPORTED") throw new MarketplaceConflictError("Only a reported payment can be disputed.")
      const updated = await transaction.jobPayment.update({ where: { id: payment.id }, data: { status: "DISPUTED", disputeReason: reason.trim() } })
      await transaction.jobPaymentEvent.create({ data: { paymentId: payment.id, actorId: userId, action: "payment.disputed", metadata: { reason: reason.trim() }, requestId } })
      const hydrated = await transaction.jobPayment.findUnique({ where: { id: updated.id }, include: jobPaymentRelations })
      return hydrated ? mapJobPayment(hydrated) : null
    })
  }

  async listAdminJobPayments(search: string, status: JobPaymentStatus | "all", commissionStatus: AdminCommissionFilter, limit: number, offset: number): Promise<AdminJobPaymentPage> {
    const needle = search.trim()
    const isPaymentUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(needle)
    const where: Prisma.JobPaymentWhereInput = {
      ...(status === "all" ? {} : { status: status.toUpperCase() as "AWAITING_PAYMENT" | "REPORTED" | "PAID" | "DISPUTED" | "REFUNDED" }),
      ...(commissionStatus === "all" ? {} : commissionStatus === "overdue"
        ? { status: "PAID" as const, platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] }, platformFeeDueAt: { lte: new Date() } }
        : { platformFeeStatus: commissionStatus.toUpperCase() as "DUE" | "REPORTED" | "RECEIVED" | "DISPUTED" | "NEEDS_CORRECTION" }),
      ...(needle ? { OR: [
        ...(isPaymentUuid ? [{ id: { equals: needle } }, { jobId: { equals: needle } }] : []),
        { paymentReference: { contains: needle, mode: "insensitive" as const } },
        { job: { publicReference: { contains: needle, mode: "insensitive" as const } } },
        { provider: { displayName: { contains: needle, mode: "insensitive" as const } } },
        { customer: { displayName: { contains: needle, mode: "insensitive" as const } } },
      ] } : {}),
    }
    const [rows, total, paid, commissionOutstanding, commissionReported, commissionReceived, commissionDisputed, disputedCount, groups] = await Promise.all([
      this.client.jobPayment.findMany({ where, include: jobPaymentRelations, orderBy: [{ createdAt: "desc" }, { id: "asc" }], skip: offset, take: limit }),
      this.client.jobPayment.count({ where }),
      this.client.jobPayment.aggregate({ where: { status: "PAID" }, _sum: { grossAmountMinor: true, commissionAmountMinor: true, providerAmountMinor: true } }),
      this.client.jobPayment.aggregate({ where: { status: "PAID", job: { status: "COMPLETED" }, platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] } }, _sum: { commissionAmountMinor: true } }),
      this.client.jobPayment.aggregate({ where: { platformFeeStatus: "REPORTED" }, _sum: { commissionAmountMinor: true } }),
      this.client.jobPayment.aggregate({ where: { platformFeeStatus: "RECEIVED" }, _sum: { commissionAmountMinor: true } }),
      this.client.jobPayment.aggregate({ where: { platformFeeStatus: "DISPUTED" }, _sum: { commissionAmountMinor: true } }),
      this.client.jobPayment.count({ where: { status: "DISPUTED" } }),
      this.client.jobPayment.groupBy({ by: ["providerId"], where: { status: "PAID" }, _count: { _all: true }, _sum: { grossAmountMinor: true, commissionAmountMinor: true, providerAmountMinor: true } }),
    ])
    const providerIds = groups.map((item) => item.providerId)
    const [users, profiles] = providerIds.length ? await Promise.all([
      this.client.user.findMany({ where: { id: { in: providerIds } }, select: { id: true, displayName: true } }),
      this.client.providerProfile.findMany({ where: { userId: { in: providerIds } }, select: { userId: true, payoutHoldAt: true } }),
    ]) : [[], []]
    const customerIds = [...new Set(rows.map((item) => item.customerId))]
    const customerRestrictions = customerIds.length ? await this.client.accountRestriction.findMany({ where: { userId: { in: customerIds }, type: "COMMISSION", releasedAt: null }, select: { userId: true, reason: true } }) : []
    const restrictionByCustomer = new Map(customerRestrictions.map((item) => [item.userId, item.reason]))
    const userNames = new Map(users.map((item) => [item.id, item.displayName]))
    const heldProviders = new Set(profiles.filter((item) => item.payoutHoldAt).map((item) => item.userId))
    return {
      items: rows.map((row) => ({ ...mapJobPayment(row), commissionOverdue: row.status === "PAID" && ["DUE", "NEEDS_CORRECTION"].includes(row.platformFeeStatus) && Boolean(row.platformFeeDueAt && row.platformFeeDueAt <= new Date()), customerCommissionRestricted: restrictionByCustomer.has(row.customerId), customerRestrictionReason: restrictionByCustomer.get(row.customerId) ?? null })), total, limit, offset,
      summary: {
        paidGrossMinor: Number(paid._sum.grossAmountMinor ?? 0n),
        providerNetMinor: Number(paid._sum.providerAmountMinor ?? 0n),
        commissionDueMinor: Number(commissionOutstanding._sum.commissionAmountMinor ?? 0n),
        commissionReportedMinor: Number(commissionReported._sum.commissionAmountMinor ?? 0n),
        commissionReceivedMinor: Number(commissionReceived._sum.commissionAmountMinor ?? 0n),
        commissionDisputedMinor: Number(commissionDisputed._sum.commissionAmountMinor ?? 0n),
        disputedCount,
      },
      workers: groups.map((item) => ({ providerId: item.providerId, providerName: userNames.get(item.providerId) ?? "Worker", paidJobs: item._count._all, grossMinor: Number(item._sum.grossAmountMinor ?? 0n), commissionMinor: Number(item._sum.commissionAmountMinor ?? 0n), netMinor: Number(item._sum.providerAmountMinor ?? 0n), payoutHeld: heldProviders.has(item.providerId) })),
    }
  }

  async resolveAdminJobPayment(input: { actorUserId: string; paymentId: string; resolution: "paid" | "refunded"; reason: string; requestId: string }): Promise<JobPaymentRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const payment = await transaction.jobPayment.findFirst({ where: { id: input.paymentId, status: "DISPUTED" } })
      if (!payment) return null
      const now = new Date()
      const updated = await transaction.jobPayment.update({ where: { id: payment.id }, data: {
        status: input.resolution.toUpperCase() as "PAID" | "REFUNDED",
        ...(input.resolution === "paid" ? { confirmedAt: now, confirmedByUserId: input.actorUserId, platformFeeDueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000) } : {}),
        resolutionNote: input.reason.trim(), resolvedAt: now, resolvedByUserId: input.actorUserId,
      } })
      await transaction.jobPaymentEvent.create({ data: { paymentId: payment.id, actorId: input.actorUserId, action: `payment.${input.resolution}`, metadata: { reason: input.reason.trim() }, requestId: input.requestId } })
      await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: `admin.payment.${input.resolution}`, targetType: "job_payment", targetId: payment.id, metadata: { jobId: payment.jobId, reason: input.reason.trim() }, requestId: input.requestId } })
      const hydrated = await transaction.jobPayment.findUnique({ where: { id: updated.id }, include: jobPaymentRelations })
      return hydrated ? mapJobPayment(hydrated) : null
    })
  }

  async recordAdminPlatformFeeReceipt(input: { actorUserId: string; paymentId: string; receiptReference: string; requestId: string }): Promise<JobPaymentRecord | null> {
    return this.client.$transaction(async (transaction) => {
      const payment = await transaction.jobPayment.findFirst({ where: { id: input.paymentId, platformFeeStatus: "REPORTED" }, include: { job: { select: { publicReference: true } } } })
      if (!payment) return null
      const receivedAt = new Date()
      const updated = await transaction.jobPayment.update({ where: { id: payment.id }, data: { platformFeeStatus: "RECEIVED", platformFeeReceivedAt: receivedAt, platformFeeReceiptReference: input.receiptReference.trim(), platformFeeCorrectionReason: null } })
      await transaction.jobPaymentEvent.create({ data: { paymentId: payment.id, actorId: input.actorUserId, action: "platform_fee.received", metadata: { receiptReference: input.receiptReference.trim(), amountMinor: Number(payment.commissionAmountMinor) }, requestId: input.requestId } })
      await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: "admin.platform_fee.received", targetType: "job_payment", targetId: payment.id, metadata: { receiptReference: input.receiptReference.trim(), amountMinor: Number(payment.commissionAmountMinor) }, requestId: input.requestId } })
      await transaction.marketplaceNotification.create({ data: {
        userId: payment.customerId, type: "payment.platform_fee_verified", title: "OddJobs commission verified",
        body: `Your OddJobs commission of ${new Intl.NumberFormat("en-KE", { style: "currency", currency: payment.currency.trim() }).format(Number(payment.commissionAmountMinor) / 100)} for Job ${payment.job.publicReference} has been verified.`,
        jobId: payment.jobId, dedupeKey: `commission-verified:${payment.id}`.slice(0, 180),
      } })
      const overdue = await transaction.jobPayment.count({ where: { customerId: payment.customerId, status: "PAID", platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] }, platformFeeDueAt: { lte: new Date() } } })
      if (overdue === 0) {
        const restriction = await transaction.accountRestriction.findFirst({ where: { userId: payment.customerId, type: "COMMISSION", releasedAt: null } })
        if (restriction) {
          const now = new Date()
          await transaction.accountRestriction.update({ where: { id: restriction.id }, data: { releasedAt: now, releasedByUserId: input.actorUserId, releaseReason: "Automatically released after all overdue commissions were verified." } })
          await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: "admin.commission.restriction_auto_released", targetType: "user", targetId: payment.customerId, metadata: { reason: "All overdue commissions verified." }, requestId: input.requestId } })
          await transaction.marketplaceNotification.create({ data: { userId: payment.customerId, type: "account_restriction_released", title: "Hiring access restored", body: "Your overdue OddJobs commissions have been verified. You can post and hire for new jobs again.", dedupeKey: `commission-release-${restriction.id}` } })
        }
      }
      const hydrated = await transaction.jobPayment.findUnique({ where: { id: updated.id }, include: jobPaymentRelations })
      return hydrated ? mapJobPayment(hydrated) : null
    })
  }

  async setAdminCommissionRestriction(input: { actorUserId: string; userId: string; restricted: boolean; reason: string; requestId: string }): Promise<{ restricted: boolean; reason: string | null } | null> {
    return this.client.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({ where: { id: input.userId }, select: { id: true, status: true, roleAssignments: { select: { role: true } } } })
      if (!user || user.status !== "ACTIVE" || !user.roleAssignments.some((role) => role.role === "CONSUMER")) return null
      const active = await transaction.accountRestriction.findFirst({ where: { userId: input.userId, type: "COMMISSION", releasedAt: null } })
      if (input.restricted) {
        const overdue = await transaction.jobPayment.count({ where: { customerId: input.userId, status: "PAID", platformFeeStatus: { in: ["DUE", "NEEDS_CORRECTION"] }, platformFeeDueAt: { lte: new Date() } } })
        if (overdue === 0) throw new Error("This hirer has no overdue commissions to restrict.")
        if (!active) await transaction.accountRestriction.create({ data: { userId: input.userId, type: "COMMISSION", reason: input.reason.trim(), actorUserId: input.actorUserId } })
        await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: "admin.commission.restriction_placed", targetType: "user", targetId: input.userId, metadata: { reason: input.reason.trim() }, requestId: input.requestId } })
        await transaction.marketplaceNotification.create({ data: { userId: input.userId, type: "commission_restriction", title: "New hiring temporarily restricted", body: "New job postings and hiring are paused while overdue OddJobs commissions are outstanding. Existing jobs, payments, and Support remain available.", dedupeKey: `commission-restrict-${randomUUID()}` } })
        return { restricted: true, reason: input.reason.trim() }
      }
      if (active) {
        await transaction.accountRestriction.update({ where: { id: active.id }, data: { releasedAt: new Date(), releasedByUserId: input.actorUserId, releaseReason: input.reason.trim() } })
        await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: "admin.commission.restriction_released", targetType: "user", targetId: input.userId, metadata: { reason: input.reason.trim() }, requestId: input.requestId } })
        await transaction.marketplaceNotification.create({ data: { userId: input.userId, type: "account_restriction_released", title: "Hiring access restored", body: "An admin has restored your access to post and hire for new jobs.", dedupeKey: `commission-release-${active.id}` } })
      }
      return { restricted: false, reason: null }
    })
  }

  async setAdminProviderPayoutHold(input: { actorUserId: string; providerId: string; held: boolean; reason: string; requestId: string }): Promise<boolean> {
    return this.client.$transaction(async (transaction) => {
      const provider = await transaction.providerProfile.findFirst({ where: { OR: [{ id: input.providerId }, { userId: input.providerId }] }, select: { id: true, userId: true } })
      if (!provider) return false
      await transaction.providerProfile.update({ where: { id: provider.id }, data: input.held ? { payoutHoldAt: new Date(), payoutHoldReason: input.reason.trim(), payoutHoldByUserId: input.actorUserId } : { payoutHoldAt: null, payoutHoldReason: null, payoutHoldByUserId: null } })
      await transaction.adminAuditEvent.create({ data: { actorUserId: input.actorUserId, action: input.held ? "admin.provider.payout_hold" : "admin.provider.payout_hold_removed", targetType: "provider", targetId: provider.userId, metadata: { reason: input.held ? input.reason.trim() : "" }, requestId: input.requestId } })
      return true
    })
  }

  async close(): Promise<void> {
    await this.client.$disconnect()
  }
}
