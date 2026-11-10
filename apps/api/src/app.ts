import cors from "@fastify/cors"

import helmet from "@fastify/helmet"

import rateLimit from "@fastify/rate-limit"

import swagger from "@fastify/swagger"

import swaggerUi from "@fastify/swagger-ui"

import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify"

import { randomUUID } from "node:crypto"

import { getHeapStatistics } from "node:v8"

import { ModerationEnforcementError } from "./auth/types.js"

import type {
  AccessTokenVerifier,
  AdminModerationDecision,
  AdminModerationReport,
  AdminModerationStatus,
  AdminStore,
  AdminOverview,
  AdminPage,
  AdminVerificationSummary,
  AdminVerificationStatus,
  AuthenticatedPrincipal,
  ProviderApplicationInput,
  UserProfileStore,
} from "./auth/types.js"

import type { AppConfig } from "./config.js"

import type { ReadinessDatabase } from "./database.js"

type BuildAppOptions = {
  config: AppConfig

  database: ReadinessDatabase | null

  authVerifier?: AccessTokenVerifier | null

  profileStore?: UserProfileStore | null

  adminStore?: AdminStore | null

  logger?: boolean
}

type PolicyConsentInput = {
  termsVersion: string

  privacyVersion: string
}

declare module "fastify" {
  interface FastifyRequest {
    authPrincipal: AuthenticatedPrincipal | null
  }
}

const healthSchema = {
  type: "object",

  required: ["status"],

  properties: {
    status: { type: "string", enum: ["ok", "ready", "not_ready"] },

    checks: {
      type: "object",

      properties: { database: { type: "string", enum: ["ok", "unavailable"] } },
    },
  },
} as const

const policyVersions = {
  terms: "2026-11-05-v1",

  privacy: "2026-11-05-v1",
} as const

export async function buildApp({
  config,

  database,

  authVerifier = null,

  profileStore = null,

  adminStore = null,

  logger,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    ajv: { customOptions: { removeAdditional: false } },

    logger:
      logger === false || config.environment === "test"
        ? false
        : {
            level: config.logLevel,

            redact: {
              paths: [
                "req.headers.authorization",

                "req.headers.cookie",

                "req.headers.set-cookie",

                "req.headers.x-api-key",
              ],

              censor: "[REDACTED]",
            },
          },

    genReqId: (request) => {
      const requestedId = request.headers["x-request-id"]

      return typeof requestedId === "string" &&
        /^[A-Za-z0-9._-]{1,80}$/.test(requestedId)
        ? requestedId
        : randomUUID()
    },
  })

  app.decorateRequest("authPrincipal", null)

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id)
  })

  await app.register(helmet)

  await app.register(rateLimit, {
    max: 120,

    timeWindow: "1 minute",
  })

  await app.register(cors, {
    origin: (origin, callback) => {
      callback(null, origin === config.webOrigin ? origin : false)
    },

    methods: ["GET", "HEAD", "POST", "OPTIONS"],
  })

  await app.register(swagger, {
    openapi: {
      info: {
        title: "OddJobs API",

        description: "Versioned API foundation for the OddJobs marketplace.",

        version: "0.1.0",
      },

      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },

      tags: [
        { name: "health", description: "Service health and readiness" },

        { name: "identity", description: "Authenticated account profile" },

        { name: "admin", description: "Protected read-only administration" },
      ],
    },
  })

  await app.register(swaggerUi, { routePrefix: "/docs" })

  app.get(
    "/health/live",

    {
      schema: {
        tags: ["health"],

        summary: "Check whether the API process is running.",

        response: { 200: healthSchema },
      },
    },

    async () => ({ status: "ok" }),
  )

  const requireAuth = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!authVerifier) {
      return reply

        .code(503)

        .send({ error: "Authentication is not configured." })
    }

    const authorization = request.headers.authorization

    if (!authorization?.startsWith("Bearer ")) {
      return reply

        .code(401)

        .send({ error: "A valid bearer token is required." })
    }

    try {
      const principal = await authVerifier.verify(authorization.slice(7))

      if (!principal) {
        return reply

          .code(401)

          .send({ error: "The access token is invalid or expired." })
      }

      request.authPrincipal = principal
    } catch {
      return reply

        .code(503)

        .send({ error: "Authentication service is unavailable." })
    }
  }

  const profileResponseSchema = {
    type: "object",

    required: ["id", "displayName", "status", "roles"],

    properties: {
      id: { type: "string", format: "uuid" },

      displayName: { type: "string" },

      status: { type: "string" },

      roles: { type: "array", items: { type: "string" } },
    },
  } as const

  const requireAdmin = async (
    request: FastifyRequest,

    reply: FastifyReply,
  ) => {
    await requireAuth(request, reply)

    if (reply.sent) return

    if (!profileStore || !request.authPrincipal) {
      return reply

        .code(503)

        .send({ error: "Admin authorization is unavailable." })
    }

    const profile = await profileStore.getProfile(request.authPrincipal.id)

    if (
      !profile ||
      profile.status !== "active" ||
      !profile.roles.includes("admin")
    ) {
      return reply
        .code(403)
        .send({ error: "An active admin role is required." })
    }

    if (!adminStore) {
      return reply
        .code(503)
        .send({ error: "Admin data storage is unavailable." })
    }
  }

  const adminPageQuerySchema = {
    type: "object",

    additionalProperties: false,

    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },

      offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
    },
  } as const

  const adminVerificationQuerySchema = {
    type: "object",

    additionalProperties: false,

    properties: {
      status: {
        type: "string",

        enum: ["all", "not_started", "in_review", "verified", "rejected"],

        default: "in_review",
      },

      limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },

      offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
    },
  } as const

  const adminPageResponseSchema = (itemSchema: object) =>
    ({
      type: "object",

      required: ["items", "total", "limit", "offset"],

      properties: {
        items: { type: "array", items: itemSchema },

        total: { type: "integer" },

        limit: { type: "integer" },

        offset: { type: "integer" },
      },
    }) as const

  const adminUserResponseSchema = adminPageResponseSchema({
    type: "object",

    required: ["id", "displayName", "status", "roles", "createdAt"],

    properties: {
      id: { type: "string", format: "uuid" },

      displayName: { type: "string" },

      status: { type: "string" },

      roles: { type: "array", items: { type: "string" } },

      createdAt: { type: "string", format: "date-time" },
    },
  })

  const adminAuditResponseSchema = adminPageResponseSchema({
    type: "object",

    required: [
      "id",

      "actorUserId",

      "action",

      "targetType",

      "targetId",

      "metadata",

      "requestId",

      "createdAt",
    ],

    properties: {
      id: { type: "string", format: "uuid" },

      actorUserId: { type: "string", format: "uuid" },

      action: { type: "string" },

      targetType: { type: "string", nullable: true },

      targetId: { type: "string", nullable: true },

      metadata: {
        type: "object",

        additionalProperties: {
          anyOf: [
            { type: "string" },

            { type: "number" },

            { type: "boolean" },

            { type: "null" },
          ],
        },
      },

      requestId: { type: "string" },

      createdAt: { type: "string", format: "date-time" },
    },
  })

  const adminVerificationResponseSchema = adminPageResponseSchema({
    type: "object",

    required: [
      "id",

      "userId",

      "displayName",

      "publicName",

      "region",

      "status",

      "submittedAt",
    ],

    properties: {
      id: { type: "string", format: "uuid" },

      userId: { type: "string", format: "uuid" },

      displayName: { type: "string" },

      publicName: { type: "string" },

      region: { type: "string", nullable: true },

      status: { type: "string" },

      submittedAt: { type: "string", format: "date-time" },
    },
  })

  app.get(
    "/v1/admin/overview",

    {
      preHandler: requireAdmin,

      schema: {
        tags: ["admin"],

        summary: "Read live marketplace counts supported by current data.",

        security: [{ bearerAuth: [] }],

        response: {
          200: {
            type: "object",

            required: [
              "totalUsers",

              "activeProviders",

              "pendingVerifications",

              "openJobs",

              "completedJobs",

              "disputedJobs",
            ],

            properties: {
              totalUsers: { type: "integer" },

              activeProviders: { type: "integer" },

              pendingVerifications: { type: "integer" },

              openJobs: { type: "integer" },

              completedJobs: { type: "integer" },

              disputedJobs: { type: "integer" },
            },
          },

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (request, reply) => {
      if (!adminStore) {
        return reply
          .code(503)
          .send({ error: "Admin data storage is unavailable." })
      }

      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal!.id,

        action: "admin.overview.read",

        targetType: "marketplace_overview",

        targetId: null,

        metadata: {},

        requestId: request.id,
      })

      reply.header("Cache-Control", "no-store")

      const overview: AdminOverview = await adminStore.getAdminOverview()

      return overview
    },
  )

  app.get(
    "/v1/admin/verification",

    {
      preHandler: requireAdmin,

      schema: {
        tags: ["admin"],

        summary: "List provider profiles by verification status.",

        security: [{ bearerAuth: [] }],

        querystring: adminVerificationQuerySchema,

        response: {
          200: adminVerificationResponseSchema,

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (
      request: FastifyRequest<{
        Querystring: {
          status: AdminVerificationStatus

          limit: number

          offset: number
        }
      }>,

      reply,
    ) => {
      if (!adminStore || !request.authPrincipal) {
        return reply
          .code(503)
          .send({ error: "Admin data storage is unavailable." })
      }

      const { status, limit, offset } = request.query

      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,

        action: "admin.verification.read",

        targetType: "provider_verification",

        targetId: null,

        metadata: { status, limit, offset },

        requestId: request.id,
      })

      reply.header("Cache-Control", "no-store")

      const page: AdminPage<AdminVerificationSummary> =
        await adminStore.listAdminVerifications(status, limit, offset)

      return page
    },
  )

  app.post(
    "/v1/admin/verification/:profileId/decision",

    {
      preHandler: requireAdmin,

      schema: {
        tags: ["admin"],

        summary: "Record an audited verification decision.",

        security: [{ bearerAuth: [] }],

        params: {
          type: "object",

          required: ["profileId"],

          additionalProperties: false,

          properties: { profileId: { type: "string", format: "uuid" } },
        },

        body: {
          type: "object",

          required: ["decision"],

          additionalProperties: false,

          properties: {
            decision: { type: "string", enum: ["verified", "rejected"] },

            reason: { type: "string", maxLength: 1000 },
          },
        },

        response: {
          200: adminVerificationResponseSchema.properties.items.items,

          400: { type: "object", properties: { error: { type: "string" } } },

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          404: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (
      request: FastifyRequest<{
        Params: { profileId: string }

        Body: { decision: "verified" | "rejected"; reason?: string }
      }>,

      reply,
    ) => {
      if (!adminStore || !request.authPrincipal) {
        return reply
          .code(503)
          .send({ error: "Admin data storage is unavailable." })
      }

      const reason = request.body.reason?.trim() || null

      if (request.body.decision === "rejected" && !reason) {
        return reply
          .code(400)
          .send({ error: "A reason is required to reject verification." })
      }

      const result = await adminStore.decideAdminVerification({
        actorUserId: request.authPrincipal.id,

        profileId: request.params.profileId,

        decision: request.body.decision,

        reason,

        requestId: request.id,
      })

      if (!result) {
        return reply.code(404).send({
          error: "Verification record was not found or is no longer in review.",
        })
      }

      reply.header("Cache-Control", "no-store")

      return result
    },
  )

  app.post(
    "/v1/reports",

    {
      preHandler: requireAuth,

      schema: {
        tags: ["identity"],

        summary: "Submit a marketplace content or account report.",

        security: [{ bearerAuth: [] }],

        body: {
          type: "object",

          required: ["subjectType", "subjectId", "reason", "details"],

          additionalProperties: false,

          properties: {
            subjectType: {
              type: "string",

              enum: ["account", "job", "provider_profile", "message"],
            },

            subjectId: { type: "string", minLength: 1, maxLength: 160 },

            reason: {
              type: "string",

              enum: [
                "harassment",

                "fraud",

                "spam",

                "unsafe",

                "off_platform_payment",

                "other",
              ],
            },

            details: { type: "string", minLength: 10, maxLength: 2000 },
          },
        },

        response: {
          201: {
            type: "object",

            required: ["id", "status", "createdAt"],

            properties: {
              id: { type: "string", format: "uuid" },

              status: { type: "string" },

              createdAt: { type: "string", format: "date-time" },
            },
          },

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },

      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
    },

    async (
      request: FastifyRequest<{
        Body: {
          subjectType: string

          subjectId: string

          reason: string

          details: string
        }
      }>,

      reply,
    ) => {
      if (!profileStore || !request.authPrincipal || !adminStore) {
        return reply.code(503).send({ error: "Report storage is unavailable." })
      }

      const profile = await profileStore.getProfile(request.authPrincipal.id)

      if (!profile || profile.status !== "active") {
        return reply.code(403).send({
          error: "An active profile is required to report content.",
        })
      }

      const report = await adminStore.createModerationReport({
        reporterUserId: request.authPrincipal.id,

        subjectType: request.body.subjectType,

        subjectId: request.body.subjectId.trim(),

        reason: request.body.reason,

        details: request.body.details.trim(),
      })

      reply.header("Cache-Control", "no-store")

      return reply.code(201).send({
        id: report.id,

        status: report.status,

        createdAt: report.createdAt,
      })
    },
  )

  app.get(
    "/v1/admin/moderation",

    {
      preHandler: requireAdmin,

      schema: {
        tags: ["admin"],

        summary: "List moderation reports by workflow status.",

        security: [{ bearerAuth: [] }],

        querystring: {
          type: "object",

          additionalProperties: false,

          properties: {
            status: {
              type: "string",

              enum: ["all", "open", "reviewing", "resolved", "dismissed"],

              default: "open",
            },

            limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },

            offset: {
              type: "integer",
              minimum: 0,
              maximum: 100000,
              default: 0,
            },
          },
        },

        response: {
          200: adminPageResponseSchema({
            type: "object",

            required: [
              "id",

              "reporterUserId",

              "subjectType",

              "subjectId",

              "reason",

              "details",

              "status",

              "createdAt",

              "updatedAt",
            ],

            properties: {
              id: { type: "string", format: "uuid" },

              reporterUserId: { type: "string", format: "uuid" },

              subjectType: { type: "string" },

              subjectId: { type: "string" },

              reason: { type: "string" },

              details: { type: "string" },

              status: { type: "string" },

              createdAt: { type: "string", format: "date-time" },

              updatedAt: { type: "string", format: "date-time" },
            },
          }),

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (
      request: FastifyRequest<{
        Querystring: {
          status: AdminModerationStatus

          limit: number

          offset: number
        }
      }>,

      reply,
    ) => {
      if (!adminStore || !request.authPrincipal) {
        return reply
          .code(503)
          .send({ error: "Admin data storage is unavailable." })
      }

      const { status, limit, offset } = request.query

      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,

        action: "admin.moderation.read",

        targetType: "moderation_report",

        targetId: null,

        metadata: { status, limit, offset },

        requestId: request.id,
      })

      reply.header("Cache-Control", "no-store")

      return adminStore.listAdminModerationReports(status, limit, offset)
    },
  )

  app.post(
    "/v1/admin/moderation/:reportId/decision",

    {
      preHandler: requireAdmin,

      schema: {
        tags: ["admin"],

        summary: "Update moderation report workflow status.",

        security: [{ bearerAuth: [] }],

        params: {
          type: "object",

          required: ["reportId"],

          additionalProperties: false,

          properties: { reportId: { type: "string", format: "uuid" } },
        },

        body: {
          type: "object",

          required: ["decision"],

          additionalProperties: false,

          properties: {
            decision: {
              type: "string",

              enum: ["reviewing", "resolved", "dismissed"],
            },

            enforcement: {
              type: "string",

              enum: ["none", "suspend_account"],

              default: "none",
            },

            reason: { type: "string", maxLength: 1000 },
          },
        },

        response: {
          200: {
            type: "object",

            required: ["id", "status"],

            properties: {
              id: { type: "string", format: "uuid" },

              status: { type: "string" },
            },
          },

          400: { type: "object", properties: { error: { type: "string" } } },

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          404: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (
      request: FastifyRequest<{
        Params: { reportId: string }

        Body: {
          decision: AdminModerationDecision
          enforcement?: "none" | "suspend_account"
          reason?: string
        }
      }>,

      reply,
    ) => {
      if (!adminStore || !request.authPrincipal) {
        return reply
          .code(503)
          .send({ error: "Admin data storage is unavailable." })
      }

      const reason = request.body.reason?.trim() || null

      const enforcement = request.body.enforcement ?? "none"

      if (request.body.decision === "dismissed" && !reason) {
        return reply.code(400).send({
          error: "A reason is required to dismiss a report.",
        })
      }

      if (enforcement !== "none" && request.body.decision !== "resolved") {
        return reply.code(400).send({
          error: "Account enforcement can only accompany a resolved report.",
        })
      }

      if (enforcement !== "none" && !reason) {
        return reply.code(400).send({
          error: "A reason is required when applying account enforcement.",
        })
      }

      let report: AdminModerationReport | null
      try {
        report = await adminStore.decideAdminModerationReport({
          actorUserId: request.authPrincipal.id,
          reportId: request.params.reportId,
          decision: request.body.decision,
          enforcement,
          reason,
          requestId: request.id,
        })
      } catch (error) {
        if (error instanceof ModerationEnforcementError) {
          return reply.code(400).send({ error: error.message })
        }
        throw error
      }

      if (!report) {
        return reply.code(404).send({
          error: "Report was not found or is already closed.",
        })
      }

      reply.header("Cache-Control", "no-store")

      return { id: report.id, status: report.status }
    },
  )

  app.post(
    "/v1/admin/users/:userId/reinstate",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["userId"],
          additionalProperties: false,
          properties: { userId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const reinstated = await adminStore.reinstateAdminSuspendedUser({
        actorUserId: request.authPrincipal.id,
        userId: request.params.userId,
        requestId: request.id,
      })
      if (!reinstated) {
        return reply.code(404).send({
          error: "No active admin-issued suspension was found for this account.",
        })
      }
      reply.header("Cache-Control", "no-store")
      return { userId: request.params.userId, status: "active" }
    },
  )

  app.get(
    "/v1/admin/users",

    {
      preHandler: requireAdmin,

      schema: {
        tags: ["admin"],

        summary: "List users without exposing contact details.",

        security: [{ bearerAuth: [] }],

        querystring: adminPageQuerySchema,

        response: {
          200: adminUserResponseSchema,

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (
      request: FastifyRequest<{
        Querystring: { limit: number; offset: number }
      }>,

      reply,
    ) => {
      if (!adminStore || !request.authPrincipal) {
        return reply
          .code(503)
          .send({ error: "Admin data storage is unavailable." })
      }

      const { limit, offset } = request.query

      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,

        action: "admin.users.read",

        targetType: "user_directory",

        targetId: null,

        metadata: { limit, offset },

        requestId: request.id,
      })

      reply.header("Cache-Control", "no-store")

      return adminStore.listAdminUsers(limit, offset)
    },
  )

  app.get(
    "/v1/admin/audit",

    {
      preHandler: requireAdmin,

      schema: {
        tags: ["admin"],

        summary: "Read the persisted administrative audit trail.",

        security: [{ bearerAuth: [] }],

        querystring: adminPageQuerySchema,

        response: {
          200: adminAuditResponseSchema,

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (
      request: FastifyRequest<{
        Querystring: { limit: number; offset: number }
      }>,

      reply,
    ) => {
      if (!adminStore || !request.authPrincipal) {
        return reply
          .code(503)
          .send({ error: "Admin data storage is unavailable." })
      }

      const { limit, offset } = request.query

      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,

        action: "admin.audit.read",

        targetType: "admin_audit_event",

        targetId: null,

        metadata: { limit, offset },

        requestId: request.id,
      })

      reply.header("Cache-Control", "no-store")

      return adminStore.listAdminAuditEvents(limit, offset)
    },
  )

  app.post(
    "/v1/me/bootstrap",

    {
      preHandler: requireAuth,

      schema: {
        tags: ["identity"],

        summary: "Create the caller's OddJobs profile after Supabase sign-in.",

        security: [{ bearerAuth: [] }],

        response: {
          200: profileResponseSchema,

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (request, reply) => {
      if (!profileStore || !request.authPrincipal) {
        return reply

          .code(503)

          .send({ error: "Profile storage is unavailable." })
      }

      const profile = await profileStore.bootstrapProfile(request.authPrincipal)

      if (profile.status !== "active") {
        return reply.code(403).send({ error: "This account is not active." })
      }

      reply.header("Cache-Control", "no-store")

      return profile
    },
  )

  app.get(
    "/v1/me",

    {
      preHandler: requireAuth,

      schema: {
        tags: ["identity"],

        summary:
          "Read the authenticated caller's OddJobs profile and assigned roles.",

        security: [{ bearerAuth: [] }],

        response: {
          200: profileResponseSchema,

          401: { type: "object", properties: { error: { type: "string" } } },

          404: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (request, reply) => {
      if (!profileStore || !request.authPrincipal) {
        return reply

          .code(503)

          .send({ error: "Profile storage is unavailable." })
      }

      const profile = await profileStore.getProfile(request.authPrincipal.id)

      if (!profile) return reply.code(404).send({ error: "Profile not found." })

      reply.header("Cache-Control", "no-store")

      return profile
    },
  )

  app.post(
    "/v1/me/policy-consents",

    {
      preHandler: requireAuth,

      schema: {
        tags: ["identity"],

        summary:
          "Record the authenticated user's acceptance of current policies.",

        security: [{ bearerAuth: [] }],

        body: {
          type: "object",

          required: ["termsVersion", "privacyVersion"],

          additionalProperties: false,

          properties: {
            termsVersion: { type: "string", minLength: 1, maxLength: 40 },

            privacyVersion: { type: "string", minLength: 1, maxLength: 40 },
          },
        },

        response: {
          200: {
            type: "object",

            required: ["accepted"],

            properties: { accepted: { type: "boolean" } },
          },

          400: { type: "object", properties: { error: { type: "string" } } },

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (
      request: FastifyRequest<{
        Body: PolicyConsentInput
      }>,

      reply,
    ) => {
      if (!profileStore || !request.authPrincipal) {
        return reply

          .code(503)

          .send({ error: "Policy consent storage is unavailable." })
      }

      if (
        request.body.termsVersion !== policyVersions.terms ||
        request.body.privacyVersion !== policyVersions.privacy
      ) {
        return reply

          .code(400)

          .send({ error: "The accepted policy version is not current." })
      }

      const profile = await profileStore.getProfile(request.authPrincipal.id)

      if (!profile || profile.status !== "active") {
        return reply.code(403).send({ error: "An active profile is required." })
      }

      await profileStore.recordPolicyConsents(
        request.authPrincipal.id,

        request.body.termsVersion,

        request.body.privacyVersion,
      )

      reply.header("Cache-Control", "no-store")

      return { accepted: true }
    },
  )

  app.post(
    "/v1/provider-applications",

    {
      preHandler: requireAuth,

      schema: {
        tags: ["identity"],

        summary:
          "Submit a supplier application without granting provider access.",

        security: [{ bearerAuth: [] }],

        body: {
          type: "object",

          required: ["publicName", "bio", "region"],

          additionalProperties: false,

          properties: {
            publicName: {
              type: "string",

              minLength: 1,

              maxLength: 120,

              pattern: "\\S",
            },

            bio: {
              type: "string",

              minLength: 1,

              maxLength: 2000,

              pattern: "\\S",
            },

            region: {
              type: "string",

              minLength: 1,

              maxLength: 120,

              pattern: "\\S",
            },
          },
        },

        response: {
          201: {
            type: "object",

            required: ["publicName", "bio", "region", "status"],

            properties: {
              publicName: { type: "string" },

              bio: { type: "string" },

              region: { type: "string" },

              status: { type: "string" },
            },
          },

          400: { type: "object", properties: { error: { type: "string" } } },

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },

      config: {
        rateLimit: { max: 5, timeWindow: "1 hour" },
      },
    },

    async (
      request: FastifyRequest<{ Body: ProviderApplicationInput }>,

      reply,
    ) => {
      if (!profileStore || !adminStore || !request.authPrincipal) {
        return reply

          .code(503)

          .send({ error: "Provider application services are unavailable." })
      }

      const profile = await profileStore.bootstrapProfile(request.authPrincipal)

      if (profile.status !== "active") {
        return reply.code(403).send({ error: "This account is not active." })
      }

      const settings = await adminStore.getAdminSettings()
      if (!settings.newProviderApplicationsEnabled) {
        return reply.code(403).send({
          error: "New provider applications are currently paused.",
        })
      }

      const application = await profileStore.submitProviderApplication(
        request.authPrincipal.id,

        {
          publicName: request.body.publicName.trim(),

          bio: request.body.bio.trim(),

          region: request.body.region.trim(),
        },
      )

      reply.header("Cache-Control", "no-store")

      return reply.code(201).send(application)
    },
  )

  app.get(
    "/v1/admin/categories",
    { preHandler: requireAdmin },
    async (request, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const categories = await adminStore.listAdminCategories()
      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,
        action: "admin.categories.read",
        targetType: "service_category",
        targetId: null,
        metadata: { count: categories.length },
        requestId: request.id,
      })
      reply.header("Cache-Control", "no-store")
      return categories
    },
  )

  app.put(
    "/v1/admin/categories",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "slug", "active", "sortOrder"],
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 2, maxLength: 80 },
            slug: { type: "string", pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$", maxLength: 90 },
            active: { type: "boolean" },
            sortOrder: { type: "integer", minimum: 0, maximum: 10000 },
          },
        },
      },
    },
    async (request: FastifyRequest<{
      Body: { name: string; slug: string; active: boolean; sortOrder: number }
    }>, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const category = await adminStore.saveAdminCategory({
        actorUserId: request.authPrincipal.id,
        category: {
          ...request.body,
          name: request.body.name.trim(),
        },
        requestId: request.id,
      })
      reply.header("Cache-Control", "no-store")
      return category
    },
  )

  app.get(
    "/v1/admin/settings",
    { preHandler: requireAdmin },
    async (request, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const settings = await adminStore.getAdminSettings()
      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,
        action: "admin.system_settings.read",
        targetType: "admin_setting",
        targetId: "marketplace",
        metadata: {},
        requestId: request.id,
      })
      reply.header("Cache-Control", "no-store")
      return settings
    },
  )

  app.put(
    "/v1/admin/settings",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: [
            "marketplaceCommissionPercent",
            "newProviderApplicationsEnabled",
            "adsEnabled",
          ],
          additionalProperties: false,
          properties: {
            marketplaceCommissionPercent: { type: "number", minimum: 0, maximum: 30 },
            newProviderApplicationsEnabled: { type: "boolean" },
            adsEnabled: { type: "boolean" },
          },
        },
      },
    },
    async (request: FastifyRequest<{
      Body: {
        marketplaceCommissionPercent: number
        newProviderApplicationsEnabled: boolean
        adsEnabled: boolean
      }
    }>, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const settings = await adminStore.saveAdminSettings({
        actorUserId: request.authPrincipal.id,
        settings: request.body,
        requestId: request.id,
      })
      reply.header("Cache-Control", "no-store")
      return settings
    },
  )

  app.post(
    "/v1/ads",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
      schema: {
        body: {
          type: "object",
          required: ["title", "description", "placement"],
          additionalProperties: false,
          properties: {
            title: { type: "string", minLength: 3, maxLength: 120 },
            description: { type: "string", minLength: 3, maxLength: 500 },
            placement: { type: "string", enum: ["customer_landing", "customer_dashboard"] },
            destinationUrl: { type: "string", format: "uri", maxLength: 2048 },
          },
        },
      },
    },
    async (request: FastifyRequest<{
      Body: {
        title: string
        description: string
        placement: "customer_landing" | "customer_dashboard"
        destinationUrl?: string
      }
    }>, reply) => {
      if (!adminStore || !profileStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Ad submission is unavailable." })
      }
      const profile = await profileStore.getProfile(request.authPrincipal.id)
      if (!profile || profile.status !== "active") {
        return reply.code(403).send({ error: "An active account is required." })
      }
      const settings = await adminStore.getAdminSettings()
      if (!settings.adsEnabled) {
        return reply.code(403).send({ error: "Ad submissions are currently disabled." })
      }
      const destinationUrl = request.body.destinationUrl?.trim() || null
      if (destinationUrl && new URL(destinationUrl).protocol !== "https:") {
        return reply.code(400).send({ error: "Ad destination links must use HTTPS." })
      }
      const campaign = await adminStore.createAdCampaign({
        advertiserId: profile.id,
        advertiserName: profile.displayName,
        title: request.body.title.trim(),
        description: request.body.description.trim(),
        placement: request.body.placement,
        destinationUrl,
      })
      reply.header("Cache-Control", "no-store")
      return reply.code(201).send(campaign)
    },
  )

  app.get(
    "/v1/admin/ads",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", enum: ["all", "pending", "approved", "rejected"], default: "pending" },
          },
        },
      },
    },
    async (request: FastifyRequest<{
      Querystring: { status?: "all" | "pending" | "approved" | "rejected" }
    }>, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const status = request.query.status ?? "pending"
      const campaigns = await adminStore.listAdminAdCampaigns(status)
      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,
        action: "admin.ads.read",
        targetType: "ad_campaign",
        targetId: null,
        metadata: { status, count: campaigns.length },
        requestId: request.id,
      })
      reply.header("Cache-Control", "no-store")
      return campaigns
    },
  )

  app.post(
    "/v1/admin/ads/:campaignId/decision",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["campaignId"],
          additionalProperties: false,
          properties: { campaignId: { type: "string", format: "uuid" } },
        },
        body: {
          type: "object",
          required: ["decision"],
          additionalProperties: false,
          properties: {
            decision: { type: "string", enum: ["approved", "rejected"] },
            reason: { type: "string", maxLength: 1000 },
          },
        },
      },
    },
    async (request: FastifyRequest<{
      Params: { campaignId: string }
      Body: { decision: "approved" | "rejected"; reason?: string }
    }>, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const reason = request.body.reason?.trim() || null
      if (request.body.decision === "rejected" && !reason) {
        return reply.code(400).send({ error: "A reason is required to reject an ad." })
      }
      const campaign = await adminStore.decideAdminAdCampaign({
        actorUserId: request.authPrincipal.id,
        campaignId: request.params.campaignId,
        decision: request.body.decision,
        reason,
        requestId: request.id,
      })
      if (!campaign) return reply.code(404).send({ error: "Pending ad campaign was not found." })
      reply.header("Cache-Control", "no-store")
      return campaign
    },
  )

  app.get(
    "/v1/admin/monitoring/history",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: { limit?: number } }>, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const history = await adminStore.listAdminMonitoringHistory(request.query.limit ?? 50)
      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,
        action: "admin.monitoring_history.read",
        targetType: "service_health",
        targetId: null,
        metadata: { count: history.length },
        requestId: request.id,
      })
      reply.header("Cache-Control", "no-store")
      return history
    },
  )

  app.get(
    "/v1/admin/monitoring",

    {
      preHandler: requireAdmin,

      schema: {
        tags: ["admin"],

        summary: "Read database, process, and queue health signals.",

        security: [{ bearerAuth: [] }],

        response: {
          200: {
            type: "object",

            required: [
              "checkedAt",

              "uptimeSeconds",

              "heapUsedBytes",

              "heapLimitBytes",

              "database",

              "pendingVerifications",

              "openReports",

              "alerts",
            ],

            properties: {
              checkedAt: { type: "string", format: "date-time" },

              uptimeSeconds: { type: "integer" },

              heapUsedBytes: { type: "integer" },

              heapLimitBytes: { type: "integer" },

              database: { type: "string", enum: ["ok", "unavailable"] },

              pendingVerifications: { type: "integer" },

              openReports: { type: "integer" },

              alerts: {
                type: "array",

                items: {
                  type: "object",

                  required: ["severity", "code", "message"],

                  properties: {
                    severity: { type: "string", enum: ["critical", "warning"] },

                    code: { type: "string" },

                    message: { type: "string" },
                  },
                },
              },
            },
          },

          401: { type: "object", properties: { error: { type: "string" } } },

          403: { type: "object", properties: { error: { type: "string" } } },

          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },

    async (request, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply
          .code(503)
          .send({ error: "Admin data storage is unavailable." })
      }

      let databaseStatus: "ok" | "unavailable" = "ok"

      let pendingVerifications = 0

      let openReports = 0

      try {
        if (!database) throw new Error("Database is not configured.")

        await database.check()

        const snapshot = await adminStore.getAdminMonitoringSnapshot()

        pendingVerifications = snapshot.pendingVerifications

        openReports = snapshot.openReports
      } catch {
        databaseStatus = "unavailable"
      }

      const memory = process.memoryUsage()

      const heapLimitBytes = getHeapStatistics().heap_size_limit

      const alerts: {
        severity: "critical" | "warning"

        code: string

        message: string
      }[] = []

      if (databaseStatus !== "ok") {
        alerts.push({
          severity: "critical",

          code: "database_unavailable",

          message: "The API cannot reach the database.",
        })
      }

      if (pendingVerifications >= 20) {
        alerts.push({
          severity: "warning",

          code: "verification_backlog",

          message: `${pendingVerifications} provider verifications are waiting for review.`,
        })
      }

      if (openReports >= 20) {
        alerts.push({
          severity: "warning",

          code: "moderation_backlog",

          message: `${openReports} moderation reports are open or being reviewed.`,
        })
      }

      if (memory.heapUsed / heapLimitBytes >= 0.9) {
        alerts.push({
          severity: "warning",

          code: "memory_pressure",

          message: "API heap usage is above 90% of the current heap limit.",
        })
      }

      const result = {
        checkedAt: new Date().toISOString(),

        uptimeSeconds: Math.floor(process.uptime()),

        heapUsedBytes: memory.heapUsed,

        heapLimitBytes,

        database: databaseStatus,

        pendingVerifications,

        openReports,

        alerts,
      }

      if (databaseStatus === "ok") {
        await adminStore.recordAdminMonitoringSnapshot({
          database: databaseStatus,
          pendingVerifications,
          openReports,
          heapUsedBytes: memory.heapUsed,
          heapLimitBytes,
          alerts,
        })

        await adminStore.recordAdminAuditEvent({
          actorUserId: request.authPrincipal.id,

          action: "admin.monitoring.read",

          targetType: "service_health",

          targetId: null,

          metadata: {
            database: databaseStatus,

            pendingVerifications,

            openReports,
          },

          requestId: request.id,
        })
      }

      reply.header("Cache-Control", "no-store")

      return result
    },
  )

  app.get(
    "/health/ready",

    {
      schema: {
        tags: ["health"],

        summary: "Check whether the API can reach required dependencies.",

        response: { 200: healthSchema, 503: healthSchema },
      },
    },

    async (_request, reply) => {
      if (!database) {
        return reply.code(503).send({
          status: "not_ready",

          checks: { database: "unavailable" },
        })
      }

      try {
        await database.check()

        return { status: "ready", checks: { database: "ok" } }
      } catch {
        return reply.code(503).send({
          status: "not_ready",

          checks: { database: "unavailable" },
        })
      }
    },
  )

  app.addHook("onClose", async () => {
    await database?.close()
  })

  return app
}
