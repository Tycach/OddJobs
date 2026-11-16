import { PrismaPg } from "@prisma/adapter-pg"

import { PrismaClient } from "./generated/prisma/client.ts"

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
  AdminUserSummary,
  AdminVerificationStatus,
  ProviderApplication,
  ProviderApplicationInput,
  CreateMarketplaceJobInput,
  MarketplaceJob,
  MarketplaceQuote,
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

  constructor(connectionString: string) {
    const adapter = new PrismaPg({
      connectionString,

      max: 10,

      connectionTimeoutMillis: 3000,

      idleTimeoutMillis: 30000,
    })

    this.client = new PrismaClient({ adapter })
  }

  async check(): Promise<void> {
    await this.client.$queryRaw`SELECT 1`
  }

  async bootstrapProfile(
    principal: AuthenticatedPrincipal,
  ): Promise<UserProfile> {
    const displayName =
      principal.displayName?.trim() ||
      principal.phone ||
      principal.email?.split("@")[0] ||
      "OddJobs member"

    const user = await this.client.user.upsert({
      where: { id: principal.id },

      create: {
        id: principal.id,

        displayName: displayName.slice(0, 120),

        status: "ACTIVE",

        roleAssignments: { create: { role: "CONSUMER" } },
      },

      update: {},

      include: { roleAssignments: { select: { role: true } } },
    })

    return {
      id: user.id,

      displayName: user.displayName,

      status: user.status.toLowerCase(),

      roles: user.roleAssignments.map((assignment) =>
        assignment.role.toLowerCase(),
      ),
    }
  }

  async getProfile(userId: string): Promise<UserProfile | null> {
    const user = await this.client.user.findUnique({
      where: { id: userId },

      include: { roleAssignments: { select: { role: true } } },
    })

    if (!user) return null

    return {
      id: user.id,

      displayName: user.displayName,

      status: user.status.toLowerCase(),

      roles: user.roleAssignments.map((assignment) =>
        assignment.role.toLowerCase(),
      ),
    }
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

        status: profile.verificationStatus.toLowerCase(),

        submittedAt: profile.createdAt.toISOString(),
      })),

      total,

      limit,

      offset,
    }
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

          user: { select: { status: true } },
        },
      })

      if (
        !application ||
        application.verificationStatus !== "IN_REVIEW" ||
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
    const profile = await this.client.providerProfile.upsert({
      where: { userId },

      create: {
        userId,

        publicName: application.publicName,

        bio: application.bio,

        region: application.region,

        verificationStatus: "IN_REVIEW",
      },

      update: {},
    })

    return {
      publicName: profile.publicName,

      bio: profile.bio ?? "",

      region: profile.region ?? "",

      status: profile.verificationStatus.toLowerCase(),
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

  async listJobs(
    userId: string,
    role: "consumer" | "provider",
    view: "mine" | "feed",
  ): Promise<MarketplaceJob[]> {
    const where =
      role === "consumer"
        ? { customerId: userId }
        : view === "feed"
          ? { status: "OPEN" as const, customerId: { not: userId } }
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
    const where =
      role === "consumer"
        ? { id: jobId, customerId: userId }
        : {
            id: jobId,
            customerId: { not: userId },
            OR: [
              { status: "OPEN" as const },
              {
                quotes: {
                  some: {
                    providerId: userId,
                    status: "ACCEPTED" as const,
                  },
                },
              },
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
    const job = await this.client.job.findFirst({
      where:
        role === "consumer"
          ? { id: jobId, customerId: userId }
          : {
              id: jobId,
              customerId: { not: userId },
              OR: [
                { status: "OPEN" as const },
                { quotes: { some: { providerId: userId } } },
              ],
            },
      select: { id: true },
    })

    if (!job) return null

    const quotes = await this.client.quote.findMany({
      where: {
        jobId,
        ...(role === "provider" ? { providerId: userId } : {}),
      },
      include: { provider: { select: { displayName: true } } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    })

    return quotes.map((quote) => this.mapMarketplaceQuote(quote))
  }

  async createJob(
    userId: string,
    input: CreateMarketplaceJobInput,
    requestId: string,
  ): Promise<MarketplaceJob> {
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
            ? new Date(input.requestedFor)
            : null,
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
    try {
      return await this.client.$transaction(async (transaction) => {
        const openJobs = await transaction.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM public.jobs
          WHERE id = ${jobId}::uuid
            AND customer_id <> ${userId}::uuid
            AND status = 'OPEN'
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

        const quote = await transaction.quote.create({
          data: {
            jobId,
            providerId: userId,
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
        select: { id: true },
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
    transition: "start" | "submit_completion" | "confirm_completion" | "cancel",
    requestId: string,
  ): Promise<MarketplaceJob | null> {
    const providerTransitions = {
      start: { expected: "AWARDED", next: "IN_PROGRESS" },
      submit_completion: {
        expected: "IN_PROGRESS",
        next: "COMPLETION_PENDING",
      },
    } as const

    const providerTransition =
      transition === "start" || transition === "submit_completion"
        ? providerTransitions[transition]
        : null
    const where =
      transition === "confirm_completion"
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
      include: { _count: { select: { quotes: true } } },
    })
    if (!job) return null

    const expectedStatus =
      providerTransition?.expected ??
      (transition === "confirm_completion"
        ? "COMPLETION_PENDING"
        : "OPEN")
    const nextStatus =
      providerTransition?.next ??
      (transition === "confirm_completion" ? "COMPLETED" : "CANCELLED")

    const updatedJob = await this.client.$transaction(async (transaction) => {
      const update = await transaction.job.updateMany({
        where: { ...where, status: expectedStatus },
        data: { status: nextStatus },
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
          action: `job.${transition === "submit_completion" ? "completion_submitted" : transition === "confirm_completion" ? "completion_confirmed" : transition === "cancel" ? "withdrawn" : transition}`,
          jobId,
          metadata:
            transition === "cancel"
              ? { reason: "Poster withdrew this open job." }
              : { from: expectedStatus.toLowerCase(), to: nextStatus.toLowerCase() },
          requestId,
        },
      })

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
