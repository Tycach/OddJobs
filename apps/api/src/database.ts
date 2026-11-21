import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient, type Prisma } from "./generated/prisma/client.ts"

import {
  MarketplaceConflictError,
  ModerationEnforcementError,
} from "./auth/types.js"

import type {
  AuthenticatedPrincipal,
  AdminAuditEvent,
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
  AdminPage,
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
  SubmitMarketplaceQuoteInput,
  UserProfile,
  UserProfileStore,
} from "./auth/types.js"

export interface ReadinessDatabase {
  check(): Promise<void>

  close(): Promise<void>
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

export class PrismaDatabase
  implements ReadinessDatabase, UserProfileStore, AdminStore, MarketplaceStore
{
  readonly client: PrismaClient
  private avatarPathColumnAvailable: Promise<boolean> | null = null

  constructor(connectionString: string) {
    const adapter = new PrismaPg({
      connectionString,

      max: 10,

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
    id: string; providerId: string; claimedByCustomerId: string | null; title: string; description: string; media: Prisma.JsonValue;
    category: string; locationLabel: string; budgetMinor: bigint | null; currency: string; status: string;
    claimExpiresAt: Date | null; createdAt: Date; updatedAt: Date;
    provider: { displayName: string }; claimedByCustomer?: { displayName: string } | null;
    activity?: { action: string; requestId: string; createdAt: Date; actor: { displayName: string } | null }[];
  }): ServiceListing {
    return {
      id: listing.id, providerId: listing.providerId, providerName: listing.provider.displayName,
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

  async listAdminServiceListingMessages(limit: number, offset: number): Promise<AdminPage<AdminServiceListingMessage>> {
    const [messages, total] = await this.client.$transaction([
      this.client.serviceListingMessage.findMany({ include: { sender: { select: { displayName: true } }, listing: { include: { provider: { select: { displayName: true } }, claimedByCustomer: { select: { displayName: true } } } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: offset, take: limit }),
      this.client.serviceListingMessage.count(),
    ])
    return {
      items: messages.map((message) => ({ ...this.mapServiceListingMessage(message), listingTitle: message.listing.title, providerName: message.listing.provider.displayName, customerName: message.listing.claimedByCustomer?.displayName ?? "Customer" })),
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
    const where = search
      ? {
          OR: [
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

    return {
      items: users.map((user) => ({
        id: user.id,

        displayName: user.displayName,

        status: user.status.toLowerCase(),

        roles: user.roleAssignments.map((assignment) =>
          assignment.role.toLowerCase(),
        ),

        createdAt: user.createdAt.toISOString(),
      })),

      total,

      limit,

      offset,
    }
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
  ): Promise<AdminPage<AdminModerationReport>> {
    const where =
      status === "all" ? {} : { status: moderationStatusToDatabase[status] }

    const [reports, total] = await this.client.$transaction([
      this.client.moderationReport.findMany({
        where,

        orderBy: [{ createdAt: "desc" }, { id: "asc" }],

        skip: offset,

        take: limit,
      }),

      this.client.moderationReport.count({ where }),
    ])

    return {
      items: reports.map((report) => this.mapModerationReport(report)),

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
    return this.client.serviceCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true, active: true, sortOrder: true },
    })
  }

  async saveAdminCategory(input: {
    actorUserId: string
    category: { name: string; slug: string; active: boolean; sortOrder: number }
    requestId: string
  }): Promise<AdminCategory> {
    return this.client.$transaction(async (transaction) => {
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
      return category
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
    }))
  }

  async createAdCampaign(input: {
    advertiserId: string
    advertiserName: string
    title: string
    description: string
    placement: string
    destinationUrl: string | null
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
      }
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
        take: 1000,
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

    openReports: number
  }> {
    const [pendingVerifications, openReports] = await this.client.$transaction([
      this.client.providerProfile.count({
        where: { verificationStatus: "IN_REVIEW" },
      }),

      this.client.moderationReport.count({
        where: { status: { in: ["OPEN", "REVIEWING"] } },
      }),
    ])

    return { pendingVerifications, openReports }
  }

  private mapModerationReport(
    report: Awaited<ReturnType<PrismaClient["moderationReport"]["findUniqueOrThrow"]>>,
  ): AdminModerationReport {
    return {
      id: report.id,

      reporterUserId: report.reporterUserId,

      subjectType: report.subjectType,

      subjectId: report.subjectId,

      reason: report.reason,

      details: report.details,

      status: report.status.toLowerCase(),

      createdAt: report.createdAt.toISOString(),

      updatedAt: report.updatedAt.toISOString(),
    }
  }

  async listAdminAuditEvents(
    limit: number,

    offset: number,
  ): Promise<AdminPage<AdminAuditEvent>> {
    const [events, total] = await this.client.$transaction([
      this.client.adminAuditEvent.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],

        skip: offset,

        take: limit,
      }),

      this.client.adminAuditEvent.count(),
    ])

    return {
      items: events.map((event) => ({
        id: event.id,

        actorUserId: event.actorUserId,

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

      ...(profile.verificationDocumentType ?? application.documentType ? { documentType: (profile.verificationDocumentType ?? application.documentType) as "national_id" | "passport" } : {}),

      ...(profile.verificationDocumentPath ?? application.documentPath ? { documentPath: profile.verificationDocumentPath ?? application.documentPath! } : {}),

      ...(profile.skillsEvidence ?? application.skillsEvidence ? { skillsEvidence: profile.skillsEvidence ?? application.skillsEvidence! } : {}),

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
      completionNote: string | null
      revisionNote: string | null
      media: Prisma.JsonValue
      createdAt: Date
      updatedAt: Date
      _count: { quotes: number }
    },
  ): MarketplaceJob {
    const budgetMinor =
      job.budgetMinor === null ? null : Number(job.budgetMinor)
    if (budgetMinor !== null && !Number.isSafeInteger(budgetMinor)) {
      throw new Error("Stored job budget exceeds the supported currency range.")
    }

    return {
      id: job.id,
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
      locationLatitude: job.locationLatitude,
      locationLongitude: job.locationLongitude,
      completionNote: job.completionNote,
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

  async getProvider(providerId: string, requesterUserId?: string): Promise<MarketplaceProvider | null> {
    const avatarColumnAvailable = await this.hasAvatarPathColumn()
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
        ],
      },
      select: { id: true, userId: true, publicName: true, bio: true, region: true },
    })
    const account = provider && avatarColumnAvailable ? await this.client.user.findUnique({ where: { id: provider.userId }, select: { avatarPath: true } }) : null
    return provider
      ? {
          id: provider.id,
          userId: provider.userId,
          publicName: provider.publicName,
          bio: provider.bio ?? "",
          region: provider.region ?? "",
          avatarPath: account?.avatarPath ?? null,
        }
      : null
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

    const jobs = await this.client.job.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
      include: { _count: { select: { quotes: true } } },
    })

    return jobs.map((job) => this.mapMarketplaceJob(job))
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

    return job ? this.mapMarketplaceJob(job) : null
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
        job: { select: { title: true, category: true, locationLabel: true, status: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      distinct: ["jobId", "providerId"],
    })
    return quotes.map((quote) => ({
      ...this.mapMarketplaceQuote(quote),
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
      ((input.locationLatitude ?? null) === null) !== ((input.locationLongitude ?? null) === null)
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
          select: { id: true },
        })
        if (existingQuote) {
          throw new MarketplaceConflictError(
            "You have already submitted a quote for this job.",
          )
        }

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
        const quote = await transaction.quote.create({
          data: {
            jobId,
            providerId: userId,
            revision: (latestQuote._max.revision ?? 0) + 1,
            amountMinor: BigInt(input.amountMinor),
            currency: "KES",
            message: input.message,
            availability: input.availability,
          },
          include: { provider: { select: { displayName: true } } },
        })
        await transaction.marketplaceActivityEvent.create({
          data: {
            actorUserId: userId,
            actorRole: "provider",
            action: "quote.submitted",
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
          title: "A worker submitted a proposal",
          body: `${quote.provider.displayName} submitted a proposal for your job.`,
          payload: { amountMinor: input.amountMinor },
        })

        return this.mapMarketplaceQuote(quote)
      })
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
        select: { providerId: true },
      })
      if (!acceptedQuote) {
        throw new MarketplaceConflictError(
          "The accepted quote could not be found. Refresh the job and try again.",
        )
      }
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
    details?: { note: string },
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
            ? { completionNote: details?.note.trim() || null, revisionNote: null }
            : transition === "request_revision"
              ? { revisionNote: details?.note.trim() || null }
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
    return updatedJob ? this.mapMarketplaceJob(updatedJob) : null
  }

  async close(): Promise<void> {
    await this.client.$disconnect()
  }
}
