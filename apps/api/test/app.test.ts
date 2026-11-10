import assert from "node:assert/strict"

import test from "node:test"

import { buildApp } from "../src/app.js"

import { ModerationEnforcementError } from "../src/auth/types.js"

import type {
  AccessTokenVerifier,
  AdminAuditEvent,
  AdminAdCampaign,
  AdminCategory,
  AdminModerationReport,
  AdminModerationStatus,
  AdminOverview,
  AdminMonitoringSnapshot,
  AdminPage,
  AdminStore,
  AdminUserSummary,
  AdminVerificationStatus,
  AdminVerificationSummary,
  AuthenticatedPrincipal,
  UserProfile,
  UserProfileStore,
} from "../src/auth/types.js"

import { loadConfig } from "../src/config.js"

import type { ReadinessDatabase } from "../src/database.js"

const config = loadConfig({ NODE_ENV: "test" })

function createDatabase(check: () => Promise<void>): ReadinessDatabase {
  return { check, close: async () => {} }
}

const principal: AuthenticatedPrincipal = {
  id: "4231bc49-18f4-4d3e-80f7-287991c7a212",

  email: "customer@example.com",

  phone: null,

  displayName: "Customer",
}

const profile: UserProfile = {
  id: principal.id,

  displayName: "Customer",

  status: "active",

  roles: ["consumer"],
}

const adminPrincipal: AuthenticatedPrincipal = {
  id: "744ed5c7-46b4-40e5-a1e5-f7a1b364c701",

  email: "admin@example.com",

  phone: null,

  displayName: "Admin",
}

const adminProfile: UserProfile = {
  id: adminPrincipal.id,

  displayName: "Admin",

  status: "active",

  roles: ["admin"],
}

const authVerifier: AccessTokenVerifier = {
  verify: async (token) =>
    token === "valid-token"
      ? principal
      : token === "admin-token"
        ? adminPrincipal
        : null,
}

const profileStore: UserProfileStore = {
  bootstrapProfile: async (authenticatedPrincipal) => {
    assert.equal(authenticatedPrincipal.id, principal.id)

    return profile
  },

  getProfile: async (userId) =>
    userId === principal.id
      ? profile
      : userId === adminPrincipal.id
        ? adminProfile
        : null,

  recordPolicyConsents: async (userId, termsVersion, privacyVersion) => {
    assert.equal(userId, principal.id)

    assert.equal(termsVersion, "2026-11-05-v1")

    assert.equal(privacyVersion, "2026-11-05-v1")
  },

  submitProviderApplication: async (userId, application) => {
    assert.equal(userId, principal.id)

    return { ...application, status: "in_review" }
  },
}

const adminUsers: AdminUserSummary[] = [
  {
    id: principal.id,

    displayName: profile.displayName,

    status: profile.status,

    roles: profile.roles,

    createdAt: "2026-11-09T12:00:00.000Z",
  },
]

const adminEvents: AdminAuditEvent[] = []

const adminVerifications: AdminVerificationSummary[] = [
  {
    id: "fac849cb-1267-46b9-9d8b-97761612af1c",

    userId: principal.id,

    displayName: "Customer",

    publicName: "Customer Repairs",

    region: "Nairobi",

    status: "in_review",

    submittedAt: "2026-11-09T12:00:00.000Z",
  },
]

const adminOverview: AdminOverview = {
  totalUsers: 12,

  activeProviders: 4,

  pendingVerifications: 2,

  openJobs: 7,

  completedJobs: 3,

  disputedJobs: 1,
}

const moderationReports: AdminModerationReport[] = [
  {
    id: "20000000-0000-4000-8000-000000000001",

    reporterUserId: principal.id,

    subjectType: "account",

    subjectId: adminPrincipal.id,

    reason: "harassment",

    details: "Reported for testing the moderation workflow.",

    status: "open",

    createdAt: "2026-11-09T12:00:00.000Z",

    updatedAt: "2026-11-09T12:00:00.000Z",
  },
]

const adminCategories: AdminCategory[] = []
const adminCampaigns: AdminAdCampaign[] = []
const adminMonitoringHistory: AdminMonitoringSnapshot[] = []
const suspendedUserIds = new Set<string>()
let adminSettings = {
  marketplaceCommissionPercent: 10,
  newProviderApplicationsEnabled: true,
  adsEnabled: true,
}

const adminStore: AdminStore = {
  getAdminOverview: async () => adminOverview,

  listAdminUsers: async (
    limit,
    offset,
  ): Promise<AdminPage<AdminUserSummary>> => ({
    items: adminUsers.slice(offset, offset + limit),

    total: adminUsers.length,

    limit,

    offset,
  }),

  listAdminVerifications: async (
    status: AdminVerificationStatus,

    limit,

    offset,
  ): Promise<AdminPage<AdminVerificationSummary>> => {
    const records =
      status === "all"
        ? adminVerifications
        : adminVerifications.filter((item) => item.status === status)

    return {
      items: records.slice(offset, offset + limit),

      total: records.length,

      limit,

      offset,
    }
  },

  decideAdminVerification: async (
    input,
  ): Promise<AdminVerificationSummary | null> => {
    const { profileId, decision } = input

    const item = adminVerifications.find(
      (verification) => verification.id === profileId,
    )

    if (!item || item.status !== "in_review") return null

    item.status = decision

    adminEvents.unshift({
      actorUserId: input.actorUserId,

      action: `admin.verification.${decision}`,

      targetType: "provider_profile",

      targetId: profileId,

      metadata: { reason: input.reason },

      requestId: input.requestId,

      id: `audit-${adminEvents.length + 1}`,

      createdAt: "2026-11-09T12:00:00.000Z",
    })

    return item
  },

  createModerationReport: async (input): Promise<AdminModerationReport> => {
    const report: AdminModerationReport = {
      ...input,

      id: `20000000-0000-4000-8000-${String(moderationReports.length + 1).padStart(12, "0")}`,

      status: "open",

      createdAt: "2026-11-09T12:00:00.000Z",

      updatedAt: "2026-11-09T12:00:00.000Z",
    }

    moderationReports.unshift(report)

    return report
  },

  listAdminModerationReports: async (
    status: AdminModerationStatus,

    limit,

    offset,
  ): Promise<AdminPage<AdminModerationReport>> => {
    const reports =
      status === "all"
        ? moderationReports
        : moderationReports.filter((item) => item.status === status)

    return {
      items: reports.slice(offset, offset + limit),

      total: reports.length,

      limit,

      offset,
    }
  },

  decideAdminModerationReport: async (
    input,
  ): Promise<AdminModerationReport | null> => {
    const report = moderationReports.find((item) => item.id === input.reportId)

    if (!report || !["open", "reviewing"].includes(report.status)) return null

    if (input.enforcement === "suspend_account") {
      if (report.subjectType !== "account") {
        throw new ModerationEnforcementError(
          "Account suspension requires an account report.",
        )
      }
      if (report.subjectId !== principal.id || !input.reason) {
        throw new ModerationEnforcementError(
          "The reported account cannot be suspended.",
        )
      }
      suspendedUserIds.add(report.subjectId)
    }

    report.status = input.decision

    adminEvents.unshift({
      actorUserId: input.actorUserId,

      action: `admin.moderation.${input.decision}`,

      targetType: "moderation_report",

      targetId: input.reportId,

      metadata: { reason: input.reason },

      requestId: input.requestId,

      id: `audit-${adminEvents.length + 1}`,

      createdAt: "2026-11-09T12:00:00.000Z",
    })

    return report
  },

  reinstateAdminSuspendedUser: async (input) =>
    suspendedUserIds.delete(input.userId),

  listAdminCategories: async () => adminCategories,

  saveAdminCategory: async (input) => {
    const category = adminCategories.find((item) => item.slug === input.category.slug)
    if (category) {
      Object.assign(category, input.category)
      return category
    }
    const created = {
      id: `30000000-0000-4000-8000-${String(adminCategories.length + 1).padStart(12, "0")}`,
      ...input.category,
    }
    adminCategories.push(created)
    return created
  },

  getAdminSettings: async () => adminSettings,

  saveAdminSettings: async (input) => {
    adminSettings = input.settings
    return adminSettings
  },

  listAdminAdCampaigns: async (status) =>
    status === "all" ? adminCampaigns : adminCampaigns.filter((item) => item.status === status),

  createAdCampaign: async (input) => {
    const created: AdminAdCampaign = {
      id: `40000000-0000-4000-8000-${String(adminCampaigns.length + 1).padStart(12, "0")}`,
      ...input,
      status: "pending",
      decisionReason: null,
      createdAt: "2026-11-09T12:00:00.000Z",
    }
    adminCampaigns.unshift(created)
    return created
  },

  decideAdminAdCampaign: async (input) => {
    const campaign = adminCampaigns.find((item) => item.id === input.campaignId)
    if (!campaign || campaign.status !== "pending") return null
    campaign.status = input.decision
    campaign.decisionReason = input.reason
    return campaign
  },

  recordAdminMonitoringSnapshot: async (input) => {
    adminMonitoringHistory.unshift({
      checkedAt: "2026-11-09T12:00:00.000Z",
      uptimeSeconds: 100,
      ...input,
    })
  },

  listAdminMonitoringHistory: async (limit) =>
    adminMonitoringHistory.slice(0, limit),

  getAdminMonitoringSnapshot: async () => ({
    pendingVerifications: 2,

    openReports: moderationReports.filter((report) =>
      ["open", "reviewing"].includes(report.status),
    ).length,
  }),

  listAdminAuditEvents: async (
    limit,

    offset,
  ): Promise<AdminPage<AdminAuditEvent>> => ({
    items: adminEvents.slice(offset, offset + limit),

    total: adminEvents.length,

    limit,

    offset,
  }),

  recordAdminAuditEvent: async (event) => {
    adminEvents.unshift({
      ...event,

      id: `audit-${adminEvents.length + 1}`,

      createdAt: "2026-11-09T12:00:00.000Z",
    })
  },
}

test("liveness reports the process is running and returns a request ID", async () => {
  const app = await buildApp({ config, database: null })

  const response = await app.inject({ method: "GET", url: "/health/live" })

  assert.equal(response.statusCode, 200)

  assert.deepEqual(response.json(), { status: "ok" })

  assert.match(response.headers["x-request-id"] as string, /^[0-9a-f-]{36}$/)

  await app.close()
})

test("a valid request ID is preserved", async () => {
  const app = await buildApp({ config, database: null })

  const response = await app.inject({
    method: "GET",

    url: "/health/live",

    headers: { "x-request-id": "health-check_01" },
  })

  assert.equal(response.headers["x-request-id"], "health-check_01")

  await app.close()
})

test("security headers are applied to API responses", async () => {
  const app = await buildApp({ config, database: null })

  const response = await app.inject({ method: "GET", url: "/health/live" })

  assert.equal(response.headers["x-content-type-options"], "nosniff")

  assert.equal(response.headers["x-frame-options"], "SAMEORIGIN")

  await app.close()
})

test("CORS allows only the configured web origin", async () => {
  const app = await buildApp({ config, database: null })

  const allowed = await app.inject({
    method: "GET",

    url: "/health/live",

    headers: { origin: config.webOrigin },
  })

  const rejected = await app.inject({
    method: "GET",

    url: "/health/live",

    headers: { origin: "https://attacker.invalid" },
  })

  assert.equal(allowed.headers["access-control-allow-origin"], config.webOrigin)

  assert.equal(rejected.headers["access-control-allow-origin"], undefined)

  await app.close()
})

test("readiness fails closed when the database is not configured", async () => {
  const app = await buildApp({ config, database: null })

  const response = await app.inject({ method: "GET", url: "/health/ready" })

  assert.equal(response.statusCode, 503)

  assert.deepEqual(response.json(), {
    status: "not_ready",

    checks: { database: "unavailable" },
  })

  await app.close()
})

test("readiness reports a successful database probe", async () => {
  const database = createDatabase(async () => {})

  const app = await buildApp({ config, database })

  const response = await app.inject({ method: "GET", url: "/health/ready" })

  assert.equal(response.statusCode, 200)

  assert.deepEqual(response.json(), {
    status: "ready",

    checks: { database: "ok" },
  })

  await app.close()
})

test("readiness hides dependency error details", async () => {
  const database = createDatabase(async () => {
    throw new Error("sensitive connection detail")
  })

  const app = await buildApp({ config, database })

  const response = await app.inject({ method: "GET", url: "/health/ready" })

  assert.equal(response.statusCode, 503)

  assert.equal(response.body.includes("sensitive connection detail"), false)

  await app.close()
})

test("OpenAPI describes the health endpoints", async () => {
  const app = await buildApp({ config, database: null })

  await app.ready()

  const document = app.swagger()

  const paths = document.paths ?? {}

  assert.ok(paths["/health/live"])

  assert.ok(paths["/health/ready"])

  assert.ok(paths["/v1/me"])

  assert.ok(paths["/v1/me/bootstrap"])

  assert.ok(paths["/v1/me/policy-consents"])

  assert.ok(paths["/v1/provider-applications"])

  assert.ok(paths["/v1/admin/users"])

  assert.ok(paths["/v1/admin/audit"])

  assert.ok(paths["/v1/admin/overview"])

  assert.ok(paths["/v1/admin/verification"])

  assert.ok(paths["/v1/admin/verification/{profileId}/decision"])

  assert.ok(paths["/v1/reports"])

  assert.ok(paths["/v1/admin/moderation"])

  assert.ok(paths["/v1/admin/moderation/{reportId}/decision"])

  assert.ok(paths["/v1/admin/monitoring"])

  await app.close()
})

test("admin routes require an authenticated token", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({ method: "GET", url: "/v1/admin/users" })

  assert.equal(response.statusCode, 401)

  await app.close()
})

test("consumer profiles cannot access admin routes", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({
    method: "GET",

    url: "/v1/admin/users",

    headers: { authorization: "Bearer valid-token" },
  })

  assert.equal(response.statusCode, 403)

  await app.close()
})

test("admin user reads are paginated and written to the audit trail", async () => {
  adminEvents.length = 0

  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({
    method: "GET",

    url: "/v1/admin/users?limit=1&offset=0",

    headers: { authorization: "Bearer admin-token" },
  })

  assert.equal(response.statusCode, 200)

  assert.deepEqual(response.json(), {
    items: adminUsers,

    total: 1,

    limit: 1,

    offset: 0,
  })

  assert.equal(response.headers["cache-control"], "no-store")

  assert.equal(adminEvents.length, 1)

  const auditEvent = adminEvents[0]

  assert.ok(auditEvent)

  assert.equal(auditEvent.actorUserId, adminPrincipal.id)

  assert.equal(auditEvent.action, "admin.users.read")

  assert.equal(auditEvent.requestId, response.headers["x-request-id"])

  await app.close()
})

test("admin pages reject out-of-range pagination", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({
    method: "GET",

    url: "/v1/admin/audit?limit=101",

    headers: { authorization: "Bearer admin-token" },
  })

  assert.equal(response.statusCode, 400)

  await app.close()
})

test("admin overview returns live counts and records an audit event", async () => {
  adminEvents.length = 0

  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({
    method: "GET",

    url: "/v1/admin/overview",

    headers: { authorization: "Bearer admin-token" },
  })

  assert.equal(response.statusCode, 200)

  assert.deepEqual(response.json(), adminOverview)

  assert.equal(response.headers["cache-control"], "no-store")

  assert.equal(adminEvents[0]?.action, "admin.overview.read")

  await app.close()
})

test("verification queue filters by status and records an audit event", async () => {
  adminEvents.length = 0

  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({
    method: "GET",

    url: "/v1/admin/verification?status=in_review&limit=10&offset=0",

    headers: { authorization: "Bearer admin-token" },
  })

  assert.equal(response.statusCode, 200)

  assert.deepEqual(response.json(), {
    items: adminVerifications,

    total: 1,

    limit: 10,

    offset: 0,
  })

  assert.equal(response.headers["cache-control"], "no-store")

  assert.equal(adminEvents[0]?.action, "admin.verification.read")

  await app.close()
})

test("verification queue rejects unknown statuses", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({
    method: "GET",

    url: "/v1/admin/verification?status=unknown",

    headers: { authorization: "Bearer admin-token" },
  })

  assert.equal(response.statusCode, 400)

  await app.close()
})

test("verification decisions require a rejection reason and are audited", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const missingReason = await app.inject({
    method: "POST",

    url: `/v1/admin/verification/${adminVerifications[0]?.id}/decision`,

    headers: { authorization: "Bearer admin-token" },

    payload: { decision: "rejected" },
  })

  assert.equal(missingReason.statusCode, 400)

  const response = await app.inject({
    method: "POST",

    url: `/v1/admin/verification/${adminVerifications[0]?.id}/decision`,

    headers: { authorization: "Bearer admin-token" },

    payload: { decision: "verified" },
  })

  assert.equal(response.statusCode, 200)

  assert.equal(response.json().status, "verified")

  assert.equal(adminEvents[0]?.action, "admin.verification.verified")

  await app.close()
})

test("users can submit rate-limited marketplace reports", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({
    method: "POST",

    url: "/v1/reports",

    headers: { authorization: "Bearer valid-token" },

    payload: {
      subjectType: "account",

      subjectId: adminPrincipal.id,

      reason: "harassment",

      details: "This account sent repeated abusive messages.",
    },
  })

  assert.equal(response.statusCode, 201)

  assert.equal(response.json().status, "open")

  assert.equal(response.headers["cache-control"], "no-store")

  await app.close()
})

test("moderation reports can be listed and dismissed with a reason", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const listResponse = await app.inject({
    method: "GET",

    url: "/v1/admin/moderation?status=open",

    headers: { authorization: "Bearer admin-token" },
  })

  assert.equal(listResponse.statusCode, 200)

  assert.equal(listResponse.json().total, moderationReports.length)

  const reportId = moderationReports[0]?.id

  assert.ok(reportId)

  const missingReason = await app.inject({
    method: "POST",

    url: `/v1/admin/moderation/${reportId}/decision`,

    headers: { authorization: "Bearer admin-token" },

    payload: { decision: "dismissed" },
  })

  assert.equal(missingReason.statusCode, 400)

  const decision = await app.inject({
    method: "POST",

    url: `/v1/admin/moderation/${reportId}/decision`,

    headers: { authorization: "Bearer admin-token" },

    payload: {
      decision: "dismissed",
      reason: "Evidence does not support the report.",
    },
  })

  assert.equal(decision.statusCode, 200)

  assert.equal(decision.json().status, "dismissed")

  assert.equal(adminEvents[0]?.action, "admin.moderation.dismissed")

  await app.close()
})

test("moderation enforcement is limited to resolved account reports and can be reversed", async () => {
  const report = await adminStore.createModerationReport({
    reporterUserId: adminPrincipal.id,
    subjectType: "account",
    subjectId: principal.id,
    reason: "fraud",
    details: "Evidence supports an account review.",
  })
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
    adminStore,
  })
  const headers = { authorization: "Bearer admin-token" }

  const jobReport = await adminStore.createModerationReport({
    reporterUserId: adminPrincipal.id,
    subjectType: "job",
    subjectId: "job-reference",
    reason: "unsafe",
    details: "Reported job requires review.",
  })
  const nonAccountEnforcement = await app.inject({
    method: "POST",
    url: `/v1/admin/moderation/${jobReport.id}/decision`,
    headers,
    payload: {
      decision: "resolved",
      enforcement: "suspend_account",
      reason: "Not an account report.",
    },
  })
  assert.equal(nonAccountEnforcement.statusCode, 400)

  const invalidAction = await app.inject({
    method: "POST",
    url: `/v1/admin/moderation/${report.id}/decision`,
    headers,
    payload: {
      decision: "dismissed",
      enforcement: "suspend_account",
      reason: "Policy violation.",
    },
  })
  assert.equal(invalidAction.statusCode, 400)

  const resolved = await app.inject({
    method: "POST",
    url: `/v1/admin/moderation/${report.id}/decision`,
    headers,
    payload: {
      decision: "resolved",
      enforcement: "suspend_account",
      reason: "Confirmed account abuse.",
    },
  })
  assert.equal(resolved.statusCode, 200)
  assert.equal(suspendedUserIds.has(principal.id), true)

  const reinstated = await app.inject({
    method: "POST",
    url: `/v1/admin/users/${principal.id}/reinstate`,
    headers,
  })
  assert.equal(reinstated.statusCode, 200)
  assert.equal(suspendedUserIds.has(principal.id), false)
  await app.close()
})

test("admin category and system setting changes are persisted through protected APIs", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
    adminStore,
  })

  const headers = { authorization: "Bearer admin-token" }
  const category = await app.inject({
    method: "PUT",
    url: "/v1/admin/categories",
    headers,
    payload: {
      name: "Home cleaning",
      slug: "home-cleaning",
      active: true,
      sortOrder: 1,
    },
  })
  assert.equal(category.statusCode, 200)
  assert.equal(category.json().slug, "home-cleaning")

  const savedSettings = await app.inject({
    method: "PUT",
    url: "/v1/admin/settings",
    headers,
    payload: {
      marketplaceCommissionPercent: 12.5,
      newProviderApplicationsEnabled: false,
      adsEnabled: true,
    },
  })
  assert.equal(savedSettings.statusCode, 200)
  assert.equal(savedSettings.json().newProviderApplicationsEnabled, false)

  const resetSettings = await app.inject({
    method: "PUT",
    url: "/v1/admin/settings",
    headers,
    payload: {
      marketplaceCommissionPercent: 10,
      newProviderApplicationsEnabled: true,
      adsEnabled: true,
    },
  })
  assert.equal(resetSettings.statusCode, 200)
  await app.close()
})

test("advertiser submissions require active accounts and admin approval", async () => {
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
    adminStore,
  })
  const submitted = await app.inject({
    method: "POST",
    url: "/v1/ads",
    headers: { authorization: "Bearer valid-token" },
    payload: {
      title: "Cleaning essentials",
      description: "Locally sourced supplies",
      placement: "customer_landing",
      destinationUrl: "https://example.com/campaign",
    },
  })
  assert.equal(submitted.statusCode, 201)
  assert.equal(submitted.json().status, "pending")

  const campaignId = submitted.json().id
  const approved = await app.inject({
    method: "POST",
    url: `/v1/admin/ads/${campaignId}/decision`,
    headers: { authorization: "Bearer admin-token" },
    payload: { decision: "approved" },
  })
  assert.equal(approved.statusCode, 200)
  assert.equal(approved.json().status, "approved")

  const unsafeDestination = await app.inject({
    method: "POST",
    url: "/v1/ads",
    headers: { authorization: "Bearer valid-token" },
    payload: {
      title: "Unsafe link",
      description: "This link is not secure",
      placement: "customer_dashboard",
      destinationUrl: "http://example.com/",
    },
  })
  assert.equal(unsafeDestination.statusCode, 400)
  await app.close()
})

test("system settings pause provider applications and ad submissions", async () => {
  const previousSettings = adminSettings
  adminSettings = {
    marketplaceCommissionPercent: 10,
    newProviderApplicationsEnabled: false,
    adsEnabled: false,
  }
  const app = await buildApp({
    config,
    database: null,
    authVerifier,
    profileStore,
    adminStore,
  })

  const providerApplication = await app.inject({
    method: "POST",
    url: "/v1/provider-applications",
    headers: { authorization: "Bearer valid-token" },
    payload: {
      publicName: "Provider account",
      bio: "Provides repair services",
      region: "Nairobi",
    },
  })
  assert.equal(providerApplication.statusCode, 403)

  const adSubmission = await app.inject({
    method: "POST",
    url: "/v1/ads",
    headers: { authorization: "Bearer valid-token" },
    payload: {
      title: "Cleaning essentials",
      description: "Locally sourced supplies",
      placement: "customer_landing",
    },
  })
  assert.equal(adSubmission.statusCode, 403)

  adminSettings = previousSettings
  await app.close()
})

test("admin monitoring returns health signals and alerts for unavailable database", async () => {
  const app = await buildApp({
    config,

    database: createDatabase(async () => {
      throw new Error("database down")
    }),

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({
    method: "GET",

    url: "/v1/admin/monitoring",

    headers: { authorization: "Bearer admin-token" },
  })

  assert.equal(response.statusCode, 200)

  assert.equal(response.json().database, "unavailable")

  assert.equal(response.json().alerts[0].code, "database_unavailable")

  await app.close()
})

test("healthy monitoring checks are retained in admin history", async () => {
  const app = await buildApp({
    config,
    database: createDatabase(async () => {}),
    authVerifier,
    profileStore,
    adminStore,
  })
  const headers = { authorization: "Bearer admin-token" }
  const snapshot = await app.inject({
    method: "GET",
    url: "/v1/admin/monitoring",
    headers,
  })
  assert.equal(snapshot.statusCode, 200)
  assert.equal(adminMonitoringHistory.length > 0, true)

  const history = await app.inject({
    method: "GET",
    url: "/v1/admin/monitoring/history?limit=10",
    headers,
  })
  assert.equal(history.statusCode, 200)
  assert.ok(history.json().length > 0)
  await app.close()
})

test("protected profile routes require a bearer token", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({ method: "GET", url: "/v1/me" })

  assert.equal(response.statusCode, 401)

  await app.close()
})

test("invalid Supabase bearer tokens are rejected", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({
    method: "GET",

    url: "/v1/me",

    headers: { authorization: "Bearer invalid-token" },
  })

  assert.equal(response.statusCode, 401)

  await app.close()
})

test("profile bootstrap uses the verified identity and server-assigned role", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({
    method: "POST",

    url: "/v1/me/bootstrap",

    headers: { authorization: "Bearer valid-token" },

    payload: { id: "00000000-0000-4000-8000-000000000001", role: "admin" },
  })

  assert.equal(response.statusCode, 200)

  assert.deepEqual(response.json(), profile)

  assert.equal(response.headers["cache-control"], "no-store")

  await app.close()
})

test("profile reads are scoped to the verified user ID", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({
    method: "GET",

    url: "/v1/me",

    headers: { authorization: "Bearer valid-token" },
  })

  assert.equal(response.statusCode, 200)

  assert.deepEqual(response.json(), profile)

  assert.equal(response.headers["cache-control"], "no-store")

  await app.close()
})

test("policy consent records the current versions for the verified active user", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({
    method: "POST",

    url: "/v1/me/policy-consents",

    headers: { authorization: "Bearer valid-token" },

    payload: {
      termsVersion: "2026-11-05-v1",

      privacyVersion: "2026-11-05-v1",
    },
  })

  assert.equal(response.statusCode, 200)

  assert.deepEqual(response.json(), { accepted: true })

  assert.equal(response.headers["cache-control"], "no-store")

  await app.close()
})

test("policy consent rejects stale document versions", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({
    method: "POST",

    url: "/v1/me/policy-consents",

    headers: { authorization: "Bearer valid-token" },

    payload: {
      termsVersion: "outdated",

      privacyVersion: "2026-11-05-v1",
    },
  })

  assert.equal(response.statusCode, 400)

  await app.close()
})

test("policy consent requires authentication", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({
    method: "POST",

    url: "/v1/me/policy-consents",

    payload: {
      termsVersion: "2026-11-05-v1",

      privacyVersion: "2026-11-05-v1",
    },
  })

  assert.equal(response.statusCode, 401)

  await app.close()
})

test("supplier applications require an authenticated active profile and do not assign provider roles", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const response = await app.inject({
    method: "POST",

    url: "/v1/provider-applications",

    headers: { authorization: "Bearer valid-token" },

    payload: {
      publicName: "  Customer Services  ",

      bio: "  Home repairs and maintenance.  ",

      region: "  Nairobi ",
    },
  })

  assert.equal(response.statusCode, 201)

  assert.deepEqual(response.json(), {
    publicName: "Customer Services",

    bio: "Home repairs and maintenance.",

    region: "Nairobi",

    status: "in_review",
  })

  assert.equal(response.headers["cache-control"], "no-store")

  assert.deepEqual(profile.roles, ["consumer"])

  await app.close()
})

test("supplier applications reject unauthenticated callers", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({
    method: "POST",

    url: "/v1/provider-applications",

    payload: {
      publicName: "Customer Services",

      bio: "Home repairs and maintenance.",

      region: "Nairobi",
    },
  })

  assert.equal(response.statusCode, 401)

  await app.close()
})

test("supplier applications reject unexpected fields", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({
    method: "POST",

    url: "/v1/provider-applications",

    headers: { authorization: "Bearer valid-token" },

    payload: {
      publicName: "Customer Services",

      bio: "",

      region: "Nairobi",

      role: "provider",
    },
  })

  assert.equal(response.statusCode, 400)

  await app.close()
})

test("supplier applications reject blank profile details", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,
  })

  const response = await app.inject({
    method: "POST",

    url: "/v1/provider-applications",

    headers: { authorization: "Bearer valid-token" },

    payload: { publicName: "  ", bio: "Repairs", region: "Nairobi" },
  })

  assert.equal(response.statusCode, 400)

  await app.close()
})

test("supplier applications are rate limited", async () => {
  const app = await buildApp({
    config,

    database: null,

    authVerifier,

    profileStore,

    adminStore,
  })

  const submit = () =>
    app.inject({
      method: "POST",

      url: "/v1/provider-applications",

      headers: { authorization: "Bearer valid-token" },

      payload: {
        publicName: "Customer Services",

        bio: "Home repairs and maintenance.",

        region: "Nairobi",
      },
    })

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await submit()

    assert.equal(response.statusCode, 201)
  }

  const limited = await submit()

  assert.equal(limited.statusCode, 429)

  assert.ok(limited.headers["retry-after"])

  await app.close()
})

test("production config requires a database URL", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production" }),

    /DATABASE_URL is required in production/,
  )
})

test("production config listens on all interfaces by default", () => {
  const configured = loadConfig({
    NODE_ENV: "production",

    DATABASE_URL: "postgresql://test:test@localhost:5432/test",

    SUPABASE_URL: "https://example.supabase.co",

    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  })

  assert.equal(configured.host, "0.0.0.0")

  assert.equal(loadConfig({ NODE_ENV: "development" }).host, "127.0.0.1")
})

test("Supabase Auth accepts a publishable key", () => {
  const configured = loadConfig({
    NODE_ENV: "development",

    SUPABASE_URL: "https://example.supabase.co",

    SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
  })

  assert.equal(configured.supabaseApiKey, "test-publishable-key")
})

test("Supabase Auth URL and a publishable/anon key must be configured together", () => {
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "development",

        SUPABASE_URL: "https://example.supabase.co",
      }),

    /SUPABASE_URL and a Supabase publishable\/anon key must be configured together/,
  )
})
