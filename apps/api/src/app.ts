import cors from "@fastify/cors"

import helmet from "@fastify/helmet"

import rateLimit from "@fastify/rate-limit"

import { createClient } from "@supabase/supabase-js"

import swagger from "@fastify/swagger"

import swaggerUi from "@fastify/swagger-ui"

import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify"

import { randomUUID } from "node:crypto"

import { getHeapStatistics } from "node:v8"

import {
  MarketplaceConflictError,
  ModerationEnforcementError,
} from "./auth/types.js"

import type {
  AccessTokenVerifier,
  AdminModerationDecision,
  AdminModerationReport,
  AdminModerationStatus,
  AdminMarketplaceJobFilters,
  AdminStore,
  AdminOverview,
  AdminPage,
  AdminVerificationSummary,
  AdminVerificationStatus,
  AuthenticatedPrincipal,
  MarketplaceStore,
  MarketplaceProvider,
  ProviderApplicationInput,
  ProviderVerificationSummary,
  CustomerVerificationSummary,
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

  marketplaceStore?: MarketplaceStore | null

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

  privacy: "2026-11-19-v2",
} as const

export async function buildApp({
  config,

  database,

  authVerifier = null,

  profileStore = null,

  adminStore = null,

  marketplaceStore = null,

  logger,
}: BuildAppOptions): Promise<FastifyInstance> {
  const verificationStorage = config.supabaseUrl && config.supabaseSecretKey
    ? createClient(config.supabaseUrl, config.supabaseSecretKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null
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

    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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

        { name: "marketplace", description: "Persistent job and quote workflows" },

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

    required: ["id", "displayName", "status", "roles", "avatarPath"],

    properties: {
      id: { type: "string", format: "uuid" },

      displayName: { type: "string" },

      avatarPath: { type: "string", nullable: true },

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

  const requireMarketplaceRole = (
    ...allowedRoles: ("consumer" | "provider")[]
  ) => async (request: FastifyRequest, reply: FastifyReply) => {
    await requireAuth(request, reply)

    if (reply.sent) return

    if (!profileStore || !request.authPrincipal) {
        return reply
          .code(503)
          .send({ error: "Marketplace authorization is unavailable." })
    }

    let profile = await profileStore.getProfile(request.authPrincipal.id)
    if (
      allowedRoles.includes("provider") &&
      request.authPrincipal.accountIntent === "supplier" &&
      !profile?.roles.includes("provider")
    ) {
      await profileStore.bootstrapProfile(request.authPrincipal)
      profile = await profileStore.getProfile(request.authPrincipal.id)
    }
    if (
        !profile ||
        profile.status !== "active" ||
        !allowedRoles.some((role) => profile.roles.includes(role))
    ) {
        return reply
          .code(403)
          .send({ error: "An active consumer or provider role is required." })
    }
  }

  const requireJobPoster = requireMarketplaceRole("consumer")

  const marketplacePathParamsSchema = {
    type: "object",
    additionalProperties: false,
    required: ["jobId"],
    properties: {
        jobId: { type: "string", format: "uuid" },
        quoteId: { type: "string", format: "uuid" },
    },
  } as const

  const marketplaceErrorSchema = {
    type: "object",
    required: ["error"],
    properties: { error: { type: "string" } },
  } as const

  const marketplaceJobInputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["title", "description", "category", "locationLabel"],
    properties: {
        title: { type: "string", minLength: 1, maxLength: 160 },
        description: { type: "string", minLength: 1, maxLength: 5000 },
        category: { type: "string", minLength: 1, maxLength: 80 },
        locationLabel: { type: "string", minLength: 1, maxLength: 160 },
        budgetMinor: {
          anyOf: [
            { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
            { type: "null" },
          ],
        },
        requestedFor: {
          anyOf: [
            { type: "string", format: "date-time" },
            { type: "null" },
          ],
        },
        applicationDeadlineAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
        dueAt: { anyOf: [{ type: "string", format: "date-time" }, { type: "null" }] },
        locationMode: { type: "string", enum: ["onsite", "remote", "flexible"] },
        locationLatitude: { anyOf: [{ type: "number", minimum: -90, maximum: 90 }, { type: "null" }] },
        locationLongitude: { anyOf: [{ type: "number", minimum: -180, maximum: 180 }, { type: "null" }] },
        media: { type: "array", maxItems: 7, items: { type: "object", additionalProperties: false, required: ["path", "contentType", "size"], properties: { path: { type: "string", minLength: 1, maxLength: 256 }, contentType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"] }, size: { type: "integer", minimum: 1, maximum: 6291456 } } } },
    },
  } as const

  const marketplaceQuoteInputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["amountMinor", "message", "availability"],
    properties: {
        amountMinor: {
          type: "integer",
          minimum: 1,
          maximum: Number.MAX_SAFE_INTEGER,
        },
        message: { type: "string", minLength: 1, maxLength: 2000 },
        availability: { type: "string", minLength: 1, maxLength: 120 },
    },
  } as const

  const marketplaceCompletionInputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["note"],
    properties: { note: { type: "string", minLength: 10, maxLength: 5000 } },
  } as const

  const marketplaceRevisionInputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["note"],
    properties: { note: { type: "string", minLength: 10, maxLength: 2000 } },
  } as const

  const marketplaceJobsQuerySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        view: {
          type: "string",
          enum: ["consumer", "provider", "feed"],
          default: "consumer",
        },
    },
  } as const

  const marketplaceJobResponseSchema = {
    type: "object",
    required: [
      "id",
      "jobReference",
      "customerId",
      "title",
      "description",
      "category",
      "locationLabel",
      "budgetMinor",
      "currency",
      "status",
      "requestedFor",
      "createdAt",
      "updatedAt",
      "quoteCount",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      jobReference: { type: "string", pattern: "^OJ-[0-9]{10}$" },
      customerId: { type: "string", format: "uuid" },
      title: { type: "string" },
      description: { type: "string" },
      category: { type: "string" },
      locationLabel: { type: "string" },
      budgetMinor: {
        anyOf: [{ type: "integer" }, { type: "null" }],
      },
      currency: { type: "string" },
      status: {
        type: "string",
        enum: [
          "open",
          "awarded",
          "in_progress",
          "completion_pending",
          "revision_requested",
          "completed",
          "cancelled",
          "disputed",
          "expired",
        ],
      },
      requestedFor: { type: "string", format: "date-time", nullable: true },
      applicationDeadlineAt: { type: "string", format: "date-time", nullable: true },
      dueAt: { type: "string", format: "date-time", nullable: true },
      locationMode: { type: "string", enum: ["onsite", "remote", "flexible"] },
      locationLatitude: { type: "number", nullable: true },
      locationLongitude: { type: "number", nullable: true },
      completionNote: { type: "string", nullable: true },
      revisionNote: { type: "string", nullable: true },
      media: { type: "array", items: { type: "object", required: ["path", "contentType", "size"], properties: { path: { type: "string" }, contentType: { type: "string" }, size: { type: "integer" } } } },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
      quoteCount: { type: "integer" },
    },
  } as const

  const marketplaceQuoteResponseSchema = {
    type: "object",
    required: [
      "id",
      "jobId",
      "providerId",
      "providerName",
      "amountMinor",
      "currency",
      "message",
      "availability",
      "status",
      "createdAt",
      "updatedAt",
    ],
    properties: {
      id: { type: "string", format: "uuid" },
      jobId: { type: "string", format: "uuid" },
      providerId: { type: "string", format: "uuid" },
      providerName: { type: "string" },
      amountMinor: { type: "integer" },
      currency: { type: "string" },
      message: { type: "string" },
      availability: { type: "string" },
      status: {
        type: "string",
        enum: ["submitted", "accepted", "declined", "withdrawn", "expired"],
      },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  } as const

  const marketplaceRoleQuerySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      role: { type: "string", enum: ["consumer", "provider"], default: "consumer" },
    },
  } as const

  const quotePathParamsSchema = {
    type: "object",
    additionalProperties: false,
    required: ["jobId", "quoteId"],
    properties: {
      jobId: { type: "string", format: "uuid" },
      quoteId: { type: "string", format: "uuid" },
    },
  } as const

  const conversationPathParamsSchema = {
    type: "object",
    additionalProperties: false,
    required: ["conversationId"],
    properties: { conversationId: { type: "string", format: "uuid" } },
  } as const

  const conversationInputSchema = {
    type: "object",
    additionalProperties: false,
    properties: { providerId: { type: "string", format: "uuid" } },
  } as const

  const conversationMessageInputSchema = {
    type: "object",
    additionalProperties: false,
    required: ["body"],
    properties: { body: { type: "string", minLength: 1, maxLength: 5000 } },
  } as const

  const providerPathParamsSchema = {
    type: "object",
    additionalProperties: false,
    required: ["providerId"],
    properties: { providerId: { type: "string", format: "uuid" } },
  } as const

  const providerSearchQuerySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      search: { type: "string", maxLength: 120, default: "" },
      region: { type: "string", maxLength: 120, default: "" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
    },
  } as const

  const providerResponseSchema = {
    type: "object",
    required: ["id", "userId", "publicName", "bio", "region"],
    properties: {
      id: { type: "string", format: "uuid" },
      userId: { type: "string", format: "uuid" },
      publicName: { type: "string" },
      bio: { type: "string" },
      region: { type: "string" },
      avatarPath: { type: "string", nullable: true },
    },
  } as const

  const providerPageResponseSchema = {
    type: "object",
    required: ["items", "total", "limit", "offset"],
    properties: {
      items: { type: "array", items: providerResponseSchema },
      total: { type: "integer" },
      limit: { type: "integer" },
      offset: { type: "integer" },
    },
  } as const

  app.get(
    "/v1/providers",
    {
      preHandler: requireMarketplaceRole("consumer"),
      schema: {
        tags: ["marketplace"],
        summary: "Browse active, approved providers without exposing contact details.",
        security: [{ bearerAuth: [] }],
        querystring: providerSearchQuerySchema,
        response: {
          200: providerPageResponseSchema,
          401: marketplaceErrorSchema,
          403: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore?.listProviders) {
        return reply.code(503).send({ error: "Marketplace data storage is unavailable." })
      }
      const query = request.query as {
        search?: string
        region?: string
        limit?: number
        offset?: number
      }
      const page = await marketplaceStore.listProviders({
        search: query.search ?? "",
        region: query.region ?? "",
        limit: query.limit ?? 25,
        offset: query.offset ?? 0,
      })
      reply.header("Cache-Control", "no-store")
      return page
    },
  )

  app.get(
    "/v1/providers/:providerId",
    {
      preHandler: requireMarketplaceRole("consumer", "provider"),
      schema: {
        tags: ["marketplace"],
        summary: "Read an approved provider's public profile or your own profile.",
        security: [{ bearerAuth: [] }],
        params: providerPathParamsSchema,
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: { jobId: { type: "string", format: "uuid" } },
        },
        response: {
          200: providerResponseSchema,
          401: marketplaceErrorSchema,
          403: marketplaceErrorSchema,
          404: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore?.getProvider) {
        return reply.code(503).send({ error: "Marketplace data storage is unavailable." })
      }
      const { providerId } = request.params as { providerId: string }
      const { jobId } = request.query as { jobId?: string }
      const provider = await marketplaceStore.getProvider(providerId, request.authPrincipal?.id, jobId)
      if (!provider) return reply.code(404).send({ error: "Provider not found." })
      reply.header("Cache-Control", "no-store")
      return provider
    },
  )

  app.patch("/v1/me/provider-profile", {
    preHandler: requireMarketplaceRole("provider"),
    schema: {
      tags: ["marketplace"],
      summary: "Update the signed-in worker's public profile.",
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        additionalProperties: false,
        required: ["publicName", "bio", "region"],
        properties: {
          publicName: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" },
          bio: { type: "string", maxLength: 2000 },
          region: { type: "string", maxLength: 120 },
        },
      },
      response: { 200: providerResponseSchema, 403: marketplaceErrorSchema, 404: marketplaceErrorSchema, 503: marketplaceErrorSchema },
    },
  }, async (request, reply) => {
    if (!marketplaceStore?.updateProviderProfile || !request.authPrincipal) return reply.code(503).send({ error: "Worker profile updates are unavailable." })
    const input = request.body as import("./auth/types.js").UpdateMarketplaceProviderProfileInput
    const provider = await marketplaceStore.updateProviderProfile(request.authPrincipal.id, {
      publicName: input.publicName.trim(),
      bio: input.bio.trim(),
      region: input.region.trim(),
    })
    if (!provider) return reply.code(404).send({ error: "Your worker profile could not be found." })
    reply.header("Cache-Control", "no-store")
    return provider
  })

  app.get("/v1/providers/:providerId/reviews", {
    preHandler: requireMarketplaceRole("consumer", "provider"),
    schema: { params: providerPathParamsSchema },
  }, async (request, reply) => {
    if (!marketplaceStore?.listPublicProviderReviews) return reply.code(503).send({ error: "Provider reviews are unavailable." })
    const { providerId } = request.params as { providerId: string }
    reply.header("Cache-Control", "no-store")
    return marketplaceStore.listPublicProviderReviews(providerId)
  })

  app.get("/v1/me/saved-providers", {
    preHandler: requireMarketplaceRole("consumer"),
    schema: { tags: ["marketplace"], summary: "List the customer's saved approved providers.", security: [{ bearerAuth: [] }] },
  }, async (request, reply) => {
    if (!marketplaceStore?.listSavedProviders || !request.authPrincipal) return reply.code(503).send({ error: "Saved providers are unavailable." })
    reply.header("Cache-Control", "no-store")
    return marketplaceStore.listSavedProviders(request.authPrincipal.id)
  })

  app.post("/v1/me/saved-providers", {
    preHandler: requireMarketplaceRole("consumer"),
    schema: {
      tags: ["marketplace"], summary: "Save an approved provider to the customer's shortlist.", security: [{ bearerAuth: [] }],
      body: { type: "object", additionalProperties: false, required: ["providerId"], properties: { providerId: { type: "string", format: "uuid" } } },
    },
  }, async (request, reply) => {
    if (!marketplaceStore?.saveProvider || !request.authPrincipal) return reply.code(503).send({ error: "Saved providers are unavailable." })
    const { providerId } = request.body as { providerId: string }
    const saved = await marketplaceStore.saveProvider(request.authPrincipal.id, providerId)
    if (!saved) return reply.code(404).send({ error: "Approved provider not found." })
    return reply.code(201).send({ saved: true })
  })

  app.delete("/v1/me/saved-providers/:providerId", {
    preHandler: requireMarketplaceRole("consumer"),
    schema: { tags: ["marketplace"], summary: "Remove a provider from the customer's shortlist.", security: [{ bearerAuth: [] }], params: providerPathParamsSchema },
  }, async (request, reply) => {
    if (!marketplaceStore?.removeSavedProvider || !request.authPrincipal) return reply.code(503).send({ error: "Saved providers are unavailable." })
    const { providerId } = request.params as { providerId: string }
    await marketplaceStore.removeSavedProvider(request.authPrincipal.id, providerId)
    return { saved: false }
  })

  const notificationsQuerySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
    },
  } as const
  const notificationIdParamsSchema = {
    type: "object",
    additionalProperties: false,
    required: ["notificationId"],
    properties: { notificationId: { type: "string", format: "uuid" } },
  } as const
  const notificationResponseSchema = {
    type: "object",
    additionalProperties: false,
    required: ["id", "type", "title", "body", "jobId", "readAt", "createdAt"],
    properties: {
      id: { type: "string", format: "uuid" },
      type: { type: "string" },
      title: { type: "string" },
      body: { type: "string" },
      jobId: { type: "string", format: "uuid", nullable: true },
      readAt: { type: "string", format: "date-time", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  } as const
  app.get(
    "/v1/notifications",
    {
      preHandler: requireMarketplaceRole("consumer", "provider"),
      schema: {
        tags: ["marketplace"],
        summary: "List the caller's marketplace notifications.",
        security: [{ bearerAuth: [] }],
        querystring: notificationsQuerySchema,
        response: {
          200: { type: "object", additionalProperties: false, required: ["items", "total", "limit", "offset"], properties: { items: { type: "array", items: notificationResponseSchema }, total: { type: "integer" }, limit: { type: "integer" }, offset: { type: "integer" } } },
          401: marketplaceErrorSchema,
          403: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore?.listNotifications || !request.authPrincipal) {
        return reply.code(503).send({ error: "Marketplace notifications are unavailable." })
      }
      const query = request.query as { limit?: number; offset?: number }
      const page = await marketplaceStore.listNotifications(
        request.authPrincipal.id,
        query.limit ?? 25,
        query.offset ?? 0,
      )
      reply.header("Cache-Control", "no-store")
      return page
    },
  )
  app.post(
    "/v1/notifications/:notificationId/read",
    {
      preHandler: requireMarketplaceRole("consumer", "provider"),
      schema: {
        tags: ["marketplace"],
        summary: "Mark one of the caller's notifications as read.",
        security: [{ bearerAuth: [] }],
        params: notificationIdParamsSchema,
        response: {
          200: { type: "object", required: ["read"], properties: { read: { type: "boolean" } } },
          401: marketplaceErrorSchema,
          403: marketplaceErrorSchema,
          404: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore?.markNotificationRead || !request.authPrincipal) {
        return reply.code(503).send({ error: "Marketplace notifications are unavailable." })
      }
      const { notificationId } = request.params as { notificationId: string }
      const read = await marketplaceStore.markNotificationRead(request.authPrincipal.id, notificationId)
      if (!read) return reply.code(404).send({ error: "Notification not found." })
      reply.header("Cache-Control", "no-store")
      return { read: true }
    },
  )

  app.get("/v1/listings", { preHandler: requireMarketplaceRole("consumer", "provider"), schema: { querystring: { type: "object", additionalProperties: false, required: ["role", "view"], properties: { role: { type: "string", enum: ["consumer", "provider"] }, view: { type: "string", enum: ["feed", "mine"] } } } } }, async (request, reply) => {
    if (!marketplaceStore?.listServiceListings || !request.authPrincipal || !profileStore) return reply.code(503).send({ error: "Marketplace listings are unavailable." })
    const query = request.query as { role?: string; view?: string }
    if ((query.role !== "consumer" && query.role !== "provider") || !["feed", "mine"].includes(query.view ?? "")) return reply.code(400).send({ error: "Invalid listing view." })
    const profile = await profileStore.getProfile(request.authPrincipal.id)
    if (!profile?.roles.includes(query.role)) return reply.code(403).send({ error: `An active ${query.role} role is required.` })
    if (query.role === "provider" && query.view === "feed") return reply.code(403).send({ error: "Providers manage their listings; only customers can browse available work." })
    reply.header("Cache-Control", "no-store")
    return marketplaceStore.listServiceListings(request.authPrincipal.id, query.role, query.view as "feed" | "mine")
  })

  app.post("/v1/listings", { preHandler: requireMarketplaceRole("provider"), schema: { body: { type: "object", additionalProperties: false, required: ["title", "description", "category", "locationLabel", "budgetMinor"], properties: { title: { type: "string", minLength: 1, maxLength: 160 }, description: { type: "string", minLength: 1, maxLength: 5000 }, category: { type: "string", minLength: 1, maxLength: 80 }, locationLabel: { type: "string", minLength: 1, maxLength: 160 }, budgetMinor: { anyOf: [{ type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER }, { type: "null" }] }, media: { type: "array", maxItems: 7, items: { type: "object", additionalProperties: false, required: ["path", "contentType", "size"], properties: { path: { type: "string", minLength: 1, maxLength: 256 }, contentType: { type: "string", enum: ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm"] }, size: { type: "integer", minimum: 1, maximum: 6291456 } } } } } } } }, async (request, reply) => {
    if (!marketplaceStore?.createServiceListing || !request.authPrincipal) return reply.code(503).send({ error: "Marketplace listings are unavailable." })
    try {
      const input = request.body as { title: string; description: string; category: string; locationLabel: string; budgetMinor?: number | null; media?: { path: string; contentType: string; size: number }[] }
      const media = input.media ?? []
      const images = media.filter((item) => item.contentType.startsWith("image/"))
      const videos = media.filter((item) => item.contentType.startsWith("video/"))
      const paths = new Set<string>()
      const invalidMedia = media.length > 7 || images.length > 6 || videos.length > 1 ||
        images.length + videos.length !== media.length || media.some((item) => {
          const parts = item.path.split("/")
          const objectName = parts[1] ?? ""
          const validObjectName = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$/i.test(objectName)
          const validOwnerPath = parts.length === 2 && parts[0] === request.authPrincipal?.id && validObjectName
          const validImageSize = item.contentType.startsWith("image/") && item.size <= 6 * 1024 * 1024
          const validVideoSize = item.contentType.startsWith("video/") && item.size <= 6 * 1024 * 1024
          const duplicate = paths.has(item.path)
          paths.add(item.path)
          return !validOwnerPath || (!validImageSize && !validVideoSize) || duplicate
        })
      if (invalidMedia) return reply.code(400).send({ error: "Add up to six photos and one video, each 6 MB or smaller, uploaded to your account." })
      const listing = await marketplaceStore.createServiceListing(request.authPrincipal.id, { ...input, budgetMinor: input.budgetMinor ?? null }, request.id)
      reply.header("Cache-Control", "no-store")
      return reply.code(201).send(listing)
    } catch (error) {
      if (error instanceof MarketplaceConflictError) return reply.code(403).send({ error: error.message })
      throw error
    }
  })

  app.post("/v1/listings/:jobId/claim", { preHandler: requireMarketplaceRole("consumer"), schema: { params: marketplacePathParamsSchema } }, async (request, reply) => {
    return reply.code(410).send({ error: "Direct claims are closed. Post a job to receive provider proposals, then choose a provider after reviewing their bid and profile." })
  })

  for (const transition of ["start", "submit-completion", "confirm-completion", "cancel", "close"] as const) {
    const requiredRole = transition === "start" || transition === "submit-completion" || transition === "close" ? "provider" : "consumer"
    app.post(`/v1/listings/:jobId/${transition}`, { preHandler: requireMarketplaceRole(requiredRole), schema: { params: marketplacePathParamsSchema } }, async (request, reply) => {
      if (!marketplaceStore?.transitionServiceListing || !request.authPrincipal) return reply.code(503).send({ error: "Marketplace listing transitions are unavailable." })
      const action = transition === "submit-completion" ? "submit_completion" : transition === "confirm-completion" ? "confirm_completion" : transition
      try {
        const listing = await marketplaceStore.transitionServiceListing(request.authPrincipal.id, (request.params as { jobId: string }).jobId, action, request.id)
        if (!listing) return reply.code(404).send({ error: "Listing not found." })
        return listing
      } catch (error) {
        if (error instanceof MarketplaceConflictError) return reply.code(409).send({ error: error.message })
        throw error
      }
    })
  }

  app.get("/v1/listings/:jobId/messages", {
    preHandler: requireMarketplaceRole("consumer", "provider"),
    schema: {
      params: marketplacePathParamsSchema,
      querystring: { type: "object", additionalProperties: false, required: ["role"], properties: { role: { type: "string", enum: ["consumer", "provider"] } } },
    },
  }, async (request, reply) => {
    if (!marketplaceStore?.listServiceListingMessages || !request.authPrincipal || !profileStore) return reply.code(503).send({ error: "Job messages are unavailable." })
    const role = (request.query as { role: "consumer" | "provider" }).role
    const profile = await profileStore.getProfile(request.authPrincipal.id)
    if (!profile?.roles.includes(role)) return reply.code(403).send({ error: `An active ${role} role is required.` })
    const { jobId } = request.params as { jobId: string }
    const messages = await marketplaceStore.listServiceListingMessages(request.authPrincipal.id, role, jobId)
    if (!messages) return reply.code(404).send({ error: "This job conversation is not available to your account." })
    reply.header("Cache-Control", "no-store")
    return messages
  })

  app.post("/v1/listings/:jobId/messages", {
    preHandler: requireMarketplaceRole("consumer", "provider"),
    schema: {
      params: marketplacePathParamsSchema,
      querystring: { type: "object", additionalProperties: false, required: ["role"], properties: { role: { type: "string", enum: ["consumer", "provider"] } } },
      body: { type: "object", additionalProperties: false, required: ["body"], properties: { body: { type: "string", minLength: 1, maxLength: 5000 } } },
    },
    config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    if (!marketplaceStore?.createServiceListingMessage || !request.authPrincipal || !profileStore) return reply.code(503).send({ error: "Job messages are unavailable." })
    const role = (request.query as { role: "consumer" | "provider" }).role
    const profile = await profileStore.getProfile(request.authPrincipal.id)
    if (!profile?.roles.includes(role)) return reply.code(403).send({ error: `An active ${role} role is required.` })
    const { jobId } = request.params as { jobId: string }
    const { body } = request.body as { body: string }
    const message = await marketplaceStore.createServiceListingMessage(request.authPrincipal.id, role, jobId, body)
    if (!message) return reply.code(404).send({ error: "This job conversation is not available to your account." })
    reply.header("Cache-Control", "no-store")
    return reply.code(201).send(message)
  })

  app.get("/v1/admin/messages", {
    preHandler: requireAdmin,
    schema: { querystring: { type: "object", additionalProperties: false, properties: { limit: { type: "integer", minimum: 1, maximum: 100, default: 50 }, offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 }, search: { type: "string", maxLength: 80, default: "" } } } },
  }, async (request, reply) => {
    if (!adminStore?.listAdminServiceListingMessages || !request.authPrincipal) return reply.code(503).send({ error: "Admin message inbox is unavailable." })
    const { limit = 50, offset = 0, search = "" } = request.query as { limit?: number; offset?: number; search?: string }
    await adminStore.recordAdminAuditEvent({ actorUserId: request.authPrincipal.id, action: "admin.messages.read", targetType: "service_listing_message", targetId: null, metadata: { limit, offset, search }, requestId: request.id })
    reply.header("Cache-Control", "no-store")
    return adminStore.listAdminServiceListingMessages(limit, offset, search)
  })

  app.get("/v1/reviews", { preHandler: requireMarketplaceRole("consumer", "provider"), schema: { querystring: { type: "object", additionalProperties: false, required: ["role"], properties: { role: { type: "string", enum: ["consumer", "provider"] } } } } }, async (request, reply) => {
    if (!marketplaceStore?.listServiceListingReviews || !request.authPrincipal || !profileStore) return reply.code(503).send({ error: "Reviews are unavailable." })
    const role = (request.query as { role: "consumer" | "provider" }).role
    const profile = await profileStore.getProfile(request.authPrincipal.id)
    if (!profile?.roles.includes(role)) return reply.code(403).send({ error: `An active ${role} role is required.` })
    reply.header("Cache-Control", "no-store")
    return marketplaceStore.listServiceListingReviews(request.authPrincipal.id, role)
  })

  app.post("/v1/listings/:jobId/reviews", {
    preHandler: requireMarketplaceRole("consumer", "provider"),
    schema: {
      params: marketplacePathParamsSchema,
      body: {
        type: "object",
        additionalProperties: false,
        required: ["rating", "comment"],
        properties: {
          rating: { type: "integer", minimum: 1, maximum: 5 },
          comment: { type: "string", maxLength: 2000 },
        },
      },
    },
  }, async (request, reply) => {
    if (!marketplaceStore?.createServiceListingReview || !request.authPrincipal) return reply.code(503).send({ error: "Reviews are unavailable." })
    const { jobId } = request.params as { jobId: string }
    const { rating, comment } = request.body as { rating: number; comment: string }
    try {
      const review = await marketplaceStore.createServiceListingReview(request.authPrincipal.id, jobId, rating, comment, request.id)
      reply.header("Cache-Control", "no-store")
      return reply.code(201).send(review)
    } catch (error) {
      if (error instanceof MarketplaceConflictError) return reply.code(409).send({ error: error.message })
      throw error
    }
  })

  app.get(
    "/v1/me/quotes",
    {
      preHandler: requireMarketplaceRole("provider"),
      schema: {
        tags: ["marketplace"],
        summary: "List the provider's submitted job proposals.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["id", "jobId", "jobReference", "providerId", "providerName", "amountMinor", "currency", "message", "availability", "status", "createdAt", "updatedAt", "jobTitle", "jobCategory", "jobLocationLabel", "jobStatus"],
              properties: {
                id: { type: "string" }, jobId: { type: "string" }, providerId: { type: "string" }, providerName: { type: "string" },
                amountMinor: { type: "integer" }, currency: { type: "string" }, message: { type: "string" }, availability: { type: "string" },
                jobReference: { type: "string", pattern: "^OJ-[0-9]{10}$" }, status: { type: "string" }, createdAt: { type: "string" }, updatedAt: { type: "string" }, jobTitle: { type: "string" },
                jobCategory: { type: "string" }, jobLocationLabel: { type: "string" }, jobStatus: { type: "string" },
              },
            },
          },
          403: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore?.listProviderQuotes || !request.authPrincipal) {
        return reply.code(503).send({ error: "Provider proposal data is unavailable." })
      }
      reply.header("Cache-Control", "no-store")
      return marketplaceStore.listProviderQuotes(request.authPrincipal.id)
    },
  )

  app.get(
    "/v1/jobs",
    {
      preHandler: requireMarketplaceRole("consumer", "provider"),
      schema: {
        tags: ["marketplace"],
        summary: "List the caller's jobs or open provider opportunities.",
        security: [{ bearerAuth: [] }],
        querystring: marketplaceJobsQuerySchema,
        response: {
          200: { type: "array", items: marketplaceJobResponseSchema },
          403: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore || !request.authPrincipal || !profileStore) {
        return reply
          .code(503)
          .send({ error: "Marketplace data storage is unavailable." })
      }

      const { view } = request.query as {
        view: "consumer" | "provider" | "feed"
      }
      const role = view === "consumer" ? "consumer" : "provider"
      const profile = await profileStore.getProfile(request.authPrincipal.id)
      if (!profile?.roles.includes(role)) {
        return reply
          .code(403)
          .send({ error: `An active ${role} role is required.` })
      }

      reply.header("Cache-Control", "no-store")
      return marketplaceStore.listJobs(
        request.authPrincipal.id,
        role,
        view === "feed" ? "feed" : "mine",
      )
    },
  )

  app.post(
    "/v1/jobs",
    {
      preHandler: requireJobPoster,
      schema: {
        tags: ["marketplace"],
        summary: "Create a persistent customer job.",
        security: [{ bearerAuth: [] }],
        body: marketplaceJobInputSchema,
        response: {
          201: marketplaceJobResponseSchema,
          400: marketplaceErrorSchema,
          403: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore || !request.authPrincipal) return reply.code(503).send({ error: "Marketplace data storage is unavailable." })
      try {
        const input = request.body as import("./auth/types.js").CreateMarketplaceJobInput
        const media = input.media ?? []
        const paths = new Set<string>()
        const invalidMedia = media.length > 7 || media.filter((item) => item.contentType.startsWith("image/")).length > 6 || media.filter((item) => item.contentType.startsWith("video/")).length > 1 || media.some((item) => {
          const parts = item.path.split("/")
          const validOwnerPath = parts.length === 2 && parts[0] === request.authPrincipal?.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[a-z0-9]{1,10}$/i.test(parts[1] ?? "")
          const duplicate = paths.has(item.path)
          paths.add(item.path)
          return !validOwnerPath || duplicate || item.size > 6 * 1024 * 1024
        })
        if (invalidMedia) return reply.code(400).send({ error: "Attach up to six photos and one video, each no larger than 6 MB, uploaded to your account." })
        const job = await marketplaceStore.createJob(request.authPrincipal.id, input, request.id)
        reply.header("Cache-Control", "no-store")
        return reply.code(201).send(job)
      } catch (error) {
        if (error instanceof MarketplaceConflictError) return reply.code(400).send({ error: error.message })
        throw error
      }
    },
  )

  app.get(
    "/v1/jobs/:jobId",
    {
      preHandler: requireMarketplaceRole("consumer", "provider"),
      schema: {
        tags: ["marketplace"],
        summary: "Read a job visible to the selected workspace.",
        security: [{ bearerAuth: [] }],
        params: marketplacePathParamsSchema,
        querystring: marketplaceRoleQuerySchema,
        response: {
          200: marketplaceJobResponseSchema,
          403: marketplaceErrorSchema,
          404: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore || !request.authPrincipal || !profileStore) {
        return reply
          .code(503)
          .send({ error: "Marketplace data storage is unavailable." })
      }

      const { jobId } = request.params as { jobId: string }
      const { role } = request.query as { role: "consumer" | "provider" }
      const profile = await profileStore.getProfile(request.authPrincipal.id)
      if (!profile?.roles.includes(role)) {
        return reply
          .code(403)
          .send({ error: `An active ${role} role is required.` })
      }

      const job = await marketplaceStore.getJob(
        request.authPrincipal.id,
        role,
        jobId,
      )
      if (!job) return reply.code(404).send({ error: "Job not found." })
      reply.header("Cache-Control", "no-store")
      return job
    },
  )

  app.get(
    "/v1/jobs/:jobId/quotes",
    {
      preHandler: requireMarketplaceRole("consumer", "provider"),
      schema: {
        tags: ["marketplace"],
        summary: "List quotes visible to the selected workspace.",
        security: [{ bearerAuth: [] }],
        params: marketplacePathParamsSchema,
        querystring: marketplaceRoleQuerySchema,
        response: {
          200: { type: "array", items: marketplaceQuoteResponseSchema },
          403: marketplaceErrorSchema,
          404: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore || !request.authPrincipal || !profileStore) {
        return reply
          .code(503)
          .send({ error: "Marketplace data storage is unavailable." })
      }

      const { jobId } = request.params as { jobId: string }
      const { role } = request.query as { role: "consumer" | "provider" }
      const profile = await profileStore.getProfile(request.authPrincipal.id)
      if (!profile?.roles.includes(role)) {
        return reply
          .code(403)
          .send({ error: `An active ${role} role is required.` })
      }

      const quotes = await marketplaceStore.listQuotes(
        request.authPrincipal.id,
        role,
        jobId,
      )
      if (!quotes) return reply.code(404).send({ error: "Job not found." })
      reply.header("Cache-Control", "no-store")
      return quotes
    },
  )

  app.post(
    "/v1/jobs/:jobId/quotes",
    {
      preHandler: requireMarketplaceRole("provider"),
      schema: {
        tags: ["marketplace"],
        summary: "Submit a provider quote for an open job.",
        security: [{ bearerAuth: [] }],
        params: marketplacePathParamsSchema,
        body: marketplaceQuoteInputSchema,
        response: {
          201: marketplaceQuoteResponseSchema,
          404: marketplaceErrorSchema,
          409: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
          410: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore || !request.authPrincipal) return reply.code(503).send({ error: "Marketplace data storage is unavailable." })
      try {
        const { jobId } = request.params as { jobId: string }
        const quote = await marketplaceStore.submitQuote(request.authPrincipal.id, jobId, request.body as import("./auth/types.js").SubmitMarketplaceQuoteInput, request.id)
        if (!quote) return reply.code(404).send({ error: "Job not found or no longer accepting proposals." })
        reply.header("Cache-Control", "no-store")
        return reply.code(201).send(quote)
      } catch (error) {
        if (error instanceof MarketplaceConflictError) return reply.code(409).send({ error: error.message })
        throw error
      }
    },
  )

  app.get("/v1/job-conversations", {
    preHandler: requireMarketplaceRole("consumer", "provider"),
    schema: {
      tags: ["marketplace"],
      summary: "List job conversations for the selected workspace.",
      security: [{ bearerAuth: [] }],
      querystring: marketplaceRoleQuerySchema,
    },
  }, async (request, reply) => {
    if (!marketplaceStore?.listJobConversations || !request.authPrincipal || !profileStore) return reply.code(503).send({ error: "Job conversations are unavailable." })
    const { role } = request.query as { role: "consumer" | "provider" }
    const profile = await profileStore.getProfile(request.authPrincipal.id)
    if (!profile?.roles.includes(role)) return reply.code(403).send({ error: `An active ${role} role is required.` })
    reply.header("Cache-Control", "no-store")
    return marketplaceStore.listJobConversations(request.authPrincipal.id, role)
  })

  app.post("/v1/jobs/:jobId/conversations", {
    preHandler: requireMarketplaceRole("consumer", "provider"),
    schema: {
      tags: ["marketplace"],
      summary: "Open or create a private conversation for a job and worker.",
      security: [{ bearerAuth: [] }],
      params: marketplacePathParamsSchema,
      querystring: marketplaceRoleQuerySchema,
      body: conversationInputSchema,
    },
  }, async (request, reply) => {
    if (!marketplaceStore?.openJobConversation || !request.authPrincipal || !profileStore) return reply.code(503).send({ error: "Job conversations are unavailable." })
    const { role } = request.query as { role: "consumer" | "provider" }
    const profile = await profileStore.getProfile(request.authPrincipal.id)
    if (!profile?.roles.includes(role)) return reply.code(403).send({ error: `An active ${role} role is required.` })
    const { jobId } = request.params as { jobId: string }
    const { providerId } = request.body as { providerId?: string }
    const conversation = await marketplaceStore.openJobConversation(request.authPrincipal.id, role, jobId, providerId)
    if (!conversation) return reply.code(404).send({ error: "This job conversation is not available to your account." })
    reply.header("Cache-Control", "no-store")
    return reply.code(200).send(conversation)
  })

  app.get("/v1/job-conversations/:conversationId/messages", {
    preHandler: requireMarketplaceRole("consumer", "provider"),
    schema: {
      tags: ["marketplace"],
      summary: "Read and mark a job conversation's messages as read.",
      security: [{ bearerAuth: [] }],
      params: conversationPathParamsSchema,
    },
  }, async (request, reply) => {
    if (!marketplaceStore?.listJobConversationMessages || !request.authPrincipal) return reply.code(503).send({ error: "Job messages are unavailable." })
    const { conversationId } = request.params as { conversationId: string }
    const messages = await marketplaceStore.listJobConversationMessages(request.authPrincipal.id, conversationId)
    if (!messages) return reply.code(404).send({ error: "This job conversation is not available to your account." })
    reply.header("Cache-Control", "no-store")
    return messages
  })

  app.post("/v1/job-conversations/:conversationId/messages", {
    preHandler: requireMarketplaceRole("consumer", "provider"),
    schema: {
      tags: ["marketplace"],
      summary: "Send a message in a job conversation.",
      security: [{ bearerAuth: [] }],
      params: conversationPathParamsSchema,
      body: conversationMessageInputSchema,
    },
  }, async (request, reply) => {
    if (!marketplaceStore?.createJobConversationMessage || !request.authPrincipal) return reply.code(503).send({ error: "Job messages are unavailable." })
    const { conversationId } = request.params as { conversationId: string }
    const { body } = request.body as { body: string }
    const message = await marketplaceStore.createJobConversationMessage(request.authPrincipal.id, conversationId, body, request.id)
    if (!message) return reply.code(404).send({ error: "This job conversation is not available to your account." })
    reply.header("Cache-Control", "no-store")
    return reply.code(201).send(message)
  })

  app.post(
    "/v1/jobs/:jobId/quotes/:quoteId/accept",
    {
      preHandler: requireMarketplaceRole("consumer"),
      schema: {
        tags: ["marketplace"],
        summary: "Accept one quote and decline competing submitted quotes.",
        security: [{ bearerAuth: [] }],
        params: quotePathParamsSchema,
        response: {
          200: marketplaceJobResponseSchema,
          404: marketplaceErrorSchema,
          409: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!marketplaceStore || !request.authPrincipal) return reply.code(503).send({ error: "Marketplace data storage is unavailable." })
      try {
        const { jobId, quoteId } = request.params as { jobId: string; quoteId: string }
        const job = await marketplaceStore.acceptQuote(request.authPrincipal.id, jobId, quoteId, request.id)
        if (!job) return reply.code(404).send({ error: "Job or proposal not found." })
        reply.header("Cache-Control", "no-store")
        return job
      } catch (error) {
        if (error instanceof MarketplaceConflictError) return reply.code(409).send({ error: error.message })
        throw error
      }
    },
  )

  const addJobTransitionRoute = (
    path: string,
    role: "consumer" | "provider",
    transition: "start" | "submit_completion" | "confirm_completion" | "request_revision" | "cancel",
  ) => {
    app.post(
      path,
      {
        preHandler: requireMarketplaceRole(role),
        schema: {
          tags: ["marketplace"],
          summary: `Apply the ${transition.replaceAll("_", " ")} job transition.`,
          security: [{ bearerAuth: [] }],
          params: marketplacePathParamsSchema,
          ...(transition === "submit_completion" ? { body: marketplaceCompletionInputSchema } : transition === "request_revision" ? { body: marketplaceRevisionInputSchema } : {}),
          response: {
            200: marketplaceJobResponseSchema,
            404: marketplaceErrorSchema,
            409: marketplaceErrorSchema,
            503: marketplaceErrorSchema,
          },
        },
      },
      async (request, reply) => {
        if (!marketplaceStore || !request.authPrincipal) {
          return reply
            .code(503)
            .send({ error: "Marketplace data storage is unavailable." })
        }

        const { jobId } = request.params as { jobId: string }
        const details = transition === "submit_completion" || transition === "request_revision"
          ? request.body as { note: string }
          : undefined
        try {
          const job = await marketplaceStore.transitionJob(
            request.authPrincipal.id,
            jobId,
            transition,
            request.id,
            details,
          )
          if (!job) return reply.code(404).send({ error: "Job not found." })
          reply.header("Cache-Control", "no-store")
          return job
        } catch (error) {
          if (error instanceof MarketplaceConflictError) {
            return reply.code(409).send({ error: error.message })
          }
          throw error
        }
      },
    )
  }

  addJobTransitionRoute("/v1/jobs/:jobId/start", "provider", "start")
  addJobTransitionRoute(
    "/v1/jobs/:jobId/submit-completion",
    "provider",
    "submit_completion",
  )
  addJobTransitionRoute(
    "/v1/jobs/:jobId/confirm-completion",
    "consumer",
    "confirm_completion",
  )
  addJobTransitionRoute(
    "/v1/jobs/:jobId/request-revision",
    "consumer",
    "request_revision",
  )
  addJobTransitionRoute("/v1/jobs/:jobId/cancel", "consumer", "cancel")

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

      documentType: { type: "string", nullable: true },

      skillsEvidence: { type: "string", nullable: true },
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

  app.get(
    "/v1/admin/verification/:profileId/document",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Create a short-lived private link for an applicant's identity document.",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["profileId"],
          additionalProperties: false,
          properties: { profileId: { type: "string", format: "uuid" } },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { profileId: string } }>, reply) => {
      if (!adminStore || !request.authPrincipal || !verificationStorage) {
        return reply.code(503).send({ error: "Private verification document access is not configured." })
      }
      const path = await adminStore.getAdminVerificationDocument?.(request.params.profileId)
      if (!path) return reply.code(404).send({ error: "No identity document is attached to this application." })
      const { data, error } = await verificationStorage.storage
        .from("provider-verification")
        .createSignedUrl(path, 60)
      if (error || !data?.signedUrl) {
        request.log.error({ err: error, profileId: request.params.profileId }, "Unable to create identity document link")
        return reply.code(503).send({ error: "The identity document is temporarily unavailable." })
      }
      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,
        action: "admin.verification.document.read",
        targetType: "provider_profile",
        targetId: request.params.profileId,
        metadata: { expiresInSeconds: 60 },
        requestId: request.id,
      })
      reply.header("Cache-Control", "no-store")
      return { url: data.signedUrl, expiresInSeconds: 60 }
    },
  )

  app.get("/v1/admin/customer-verification", { preHandler: requireAdmin, schema: { querystring: adminVerificationQuerySchema } }, async (request, reply) => {
    if (!adminStore?.listAdminCustomerVerifications || !request.authPrincipal) return reply.code(503).send({ error: "Admin data storage is unavailable." })
    const { status = "in_review", limit = 25, offset = 0 } = request.query as { status?: AdminVerificationStatus; limit?: number; offset?: number }
    await adminStore.recordAdminAuditEvent({ actorUserId: request.authPrincipal.id, action: "admin.customer_verification.read", targetType: "customer_identity_verification", targetId: null, metadata: { status, limit, offset }, requestId: request.id })
    reply.header("Cache-Control", "no-store")
    return adminStore.listAdminCustomerVerifications(status, limit, offset)
  })

  app.get("/v1/admin/customer-verification/:verificationId/document", { preHandler: requireAdmin, schema: { params: { type: "object", additionalProperties: false, required: ["verificationId"], properties: { verificationId: { type: "string", format: "uuid" } } } } }, async (request, reply) => {
    if (!adminStore || !request.authPrincipal || !verificationStorage) return reply.code(503).send({ error: "Private customer documents are unavailable." })
    const { verificationId } = request.params as { verificationId: string }
    const path = await adminStore.getAdminCustomerVerificationDocument?.(verificationId)
    if (!path) return reply.code(404).send({ error: "No customer identity document was found." })
    const { data, error } = await verificationStorage.storage.from("customer-verification").createSignedUrl(path, 60)
    if (error || !data?.signedUrl) return reply.code(503).send({ error: "The customer identity document is temporarily unavailable." })
    await adminStore.recordAdminAuditEvent({ actorUserId: request.authPrincipal.id, action: "admin.customer_verification.document.read", targetType: "customer_identity_verification", targetId: verificationId, metadata: { expiresInSeconds: 60 }, requestId: request.id })
    reply.header("Cache-Control", "no-store")
    return { url: data.signedUrl, expiresInSeconds: 60 }
  })

  app.post("/v1/admin/customer-verification/:verificationId/decision", {
    preHandler: requireAdmin,
    schema: {
      params: { type: "object", additionalProperties: false, required: ["verificationId"], properties: { verificationId: { type: "string", format: "uuid" } } },
      body: { type: "object", additionalProperties: false, required: ["decision"], properties: { decision: { type: "string", enum: ["verified", "rejected"] }, reason: { type: "string", maxLength: 1000 } } },
    },
  }, async (request, reply) => {
    if (!adminStore?.decideAdminCustomerVerification || !request.authPrincipal) return reply.code(503).send({ error: "Admin data storage is unavailable." })
    const { verificationId } = request.params as { verificationId: string }
    const { decision, reason: rawReason } = request.body as { decision: "verified" | "rejected"; reason?: string }
    const reason = rawReason?.trim() || null
    if (decision === "rejected" && !reason) return reply.code(400).send({ error: "A reason is required to reject identity verification." })
    const result = await adminStore.decideAdminCustomerVerification({ actorUserId: request.authPrincipal.id, verificationId, decision, reason, requestId: request.id })
    if (!result) return reply.code(404).send({ error: "Customer verification was not found or is no longer in review." })
    await adminStore.recordAdminAuditEvent({ actorUserId: request.authPrincipal.id, action: `admin.customer_verification.${decision}`, targetType: "customer_identity_verification", targetId: verificationId, metadata: { reason }, requestId: request.id })
    reply.header("Cache-Control", "no-store")
    return result
  })

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

      let report: AdminModerationReport
      try {
        report = await adminStore.createModerationReport({
          reporterUserId: request.authPrincipal.id,

          subjectType: request.body.subjectType,

          subjectId: request.body.subjectId.trim(),

          reason: request.body.reason,

          details: request.body.details.trim(),
        })
      } catch (error) {
        if (error instanceof MarketplaceConflictError) return reply.code(404).send({ error: error.message })
        throw error
      }

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
            search: { type: "string", maxLength: 80, default: "" },
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

              "jobReference",

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

              jobReference: { type: "string", nullable: true },

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
          search: string
        }
      }>,

      reply,
    ) => {
      if (!adminStore || !request.authPrincipal) {
        return reply
          .code(503)
          .send({ error: "Admin data storage is unavailable." })
      }

      const { status, limit, offset, search } = request.query

      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,

        action: "admin.moderation.read",

        targetType: "moderation_report",

        targetId: null,

        metadata: { status, limit, offset, search },

        requestId: request.id,
      })

      reply.header("Cache-Control", "no-store")

      return adminStore.listAdminModerationReports(status, limit, offset, search)
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

  app.get(
    "/v1/admin/marketplace/activity",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Read the paginated customer and provider marketplace activity timeline.",
        security: [{ bearerAuth: [] }],
        querystring: adminPageQuerySchema,
        response: {
          200: {
            type: "object",
            required: ["items", "total", "limit", "offset"],
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  required: [
                    "id",
                    "actorUserId",
                    "actorDisplayName",
                    "actorRole",
                    "action",
                    "jobId",
                    "quoteId",
                    "metadata",
                    "requestId",
                    "createdAt",
                  ],
                  properties: {
                    id: { type: "string", format: "uuid" },
                    actorUserId: { type: "string", format: "uuid" },
                    actorDisplayName: { type: "string" },
                    actorRole: { type: "string", enum: ["consumer", "provider", "admin"] },
                    action: { type: "string" },
                    jobId: { type: "string", format: "uuid" },
                    quoteId: { type: "string", format: "uuid", nullable: true },
                    metadata: { type: "object", additionalProperties: true },
                    requestId: { type: "string" },
                    createdAt: { type: "string", format: "date-time" },
                  },
                },
              },
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
            },
          },
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
        action: "admin.marketplace_activity.read",
        targetType: "marketplace_activity_event",
        targetId: null,
        metadata: { limit, offset },
        requestId: request.id,
      })
      reply.header("Cache-Control", "no-store")
      return adminStore.listAdminMarketplaceActivity(limit, offset)
    },
  )

  const adminMarketplaceJobQuerySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      status: {
        type: "string",
        enum: ["all", "open", "awarded", "in_progress", "completion_pending", "revision_requested", "completed", "cancelled", "disputed", "expired"],
        default: "all",
      },
      search: { type: "string", maxLength: 160, default: "" },
      from: { type: "string", format: "date-time" },
      to: { type: "string", format: "date-time" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 25 },
      offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 },
    },
  } as const

  const adminMarketplaceJobParamsSchema = {
    type: "object",
    additionalProperties: false,
    required: ["jobId"],
    properties: { jobId: { type: "string", format: "uuid" } },
  } as const

  app.get("/v1/admin/listings", { preHandler: requireAdmin, schema: { querystring: { type: "object", additionalProperties: false, properties: { search: { type: "string", maxLength: 120 }, limit: { type: "integer", minimum: 1, maximum: 100, default: 25 }, offset: { type: "integer", minimum: 0, maximum: 100000, default: 0 } } } } }, async (request, reply) => {
    if (!marketplaceStore?.listAdminServiceListings) return reply.code(503).send({ error: "Admin listing data is unavailable." })
    const query = request.query as { search?: string; limit?: number; offset?: number }
    const search = query.search?.trim() ?? ""
    const limit = query.limit ?? 25
    const offset = query.offset ?? 0
    reply.header("Cache-Control", "no-store")
    const page = await marketplaceStore.listAdminServiceListings(search, limit, offset)
    if (request.authPrincipal && adminStore) await adminStore.recordAdminAuditEvent({ actorUserId: request.authPrincipal.id, action: "service_listings.viewed", targetType: "service_listing", targetId: null, metadata: { search, offset, count: page.items.length }, requestId: request.id })
    return page
  })

  app.post("/v1/admin/listings/:listingId/release", { preHandler: requireAdmin, schema: {
    params: { type: "object", additionalProperties: false, required: ["listingId"], properties: { listingId: { type: "string", format: "uuid" } } },
    body: { type: "object", additionalProperties: false, required: ["reason"], properties: { reason: { type: "string", minLength: 10, maxLength: 1000 } } },
  } }, async (request, reply) => {
    if (!marketplaceStore?.releaseAdminServiceListing || !request.authPrincipal) return reply.code(503).send({ error: "Admin listing operations are unavailable." })
    const { listingId } = request.params as { listingId: string }
    const reason = (request.body as { reason: string }).reason.trim()
    if (reason.length < 10) return reply.code(400).send({ error: "Provide a reason with at least 10 characters." })
    try {
      const listing = await marketplaceStore.releaseAdminServiceListing(request.authPrincipal.id, listingId, reason.trim(), request.id)
      if (!listing) return reply.code(404).send({ error: "Listing not found." })
      reply.header("Cache-Control", "no-store")
      return listing
    } catch (error) {
      if (error instanceof MarketplaceConflictError) return reply.code(409).send({ error: error.message })
      throw error
    }
  })

  app.get(
    "/v1/admin/marketplace/jobs",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Search marketplace jobs and their quotes for operations review.",
        security: [{ bearerAuth: [] }],
        querystring: adminMarketplaceJobQuerySchema,
        response: {
          200: {
            type: "object",
            required: ["items", "total", "limit", "offset"],
            properties: {
              items: { type: "array", items: { type: "object", additionalProperties: true } },
              total: { type: "integer" },
              limit: { type: "integer" },
              offset: { type: "integer" },
            },
          },
          400: marketplaceErrorSchema,
          401: marketplaceErrorSchema,
          403: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!adminStore || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const query = request.query as {
        status?: AdminMarketplaceJobFilters["status"]
        search?: string
        from?: string
        to?: string
        limit?: number
        offset?: number
      }
      if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
        return reply.code(400).send({ error: "The start date must be before the end date." })
      }
      const filters: AdminMarketplaceJobFilters = {
        status: query.status ?? "all",
        search: query.search ?? "",
        from: query.from ?? null,
        to: query.to ?? null,
      }
      const limit = query.limit ?? 25
      const offset = query.offset ?? 0
      if (!adminStore.listAdminMarketplaceJobs) {
        return reply.code(503).send({ error: "Admin marketplace operations are unavailable." })
      }
      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,
        action: "admin.marketplace_jobs.read",
        targetType: "marketplace_jobs",
        targetId: null,
        metadata: { ...filters, limit, offset },
        requestId: request.id,
      })
      const page = await adminStore.listAdminMarketplaceJobs({ filters, limit, offset })
      reply.header("Cache-Control", "no-store")
      return page
    },
  )

  app.get(
    "/v1/admin/marketplace/jobs/:jobId",
    {
      preHandler: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Read an operations case with parties, quotes, and its audited timeline.",
        security: [{ bearerAuth: [] }],
        params: adminMarketplaceJobParamsSchema,
        response: {
          200: { type: "object", additionalProperties: true },
          401: marketplaceErrorSchema,
          403: marketplaceErrorSchema,
          404: marketplaceErrorSchema,
          503: marketplaceErrorSchema,
        },
      },
    },
    async (request, reply) => {
      if (!adminStore?.getAdminMarketplaceJob || !request.authPrincipal) {
        return reply.code(503).send({ error: "Admin data storage is unavailable." })
      }
      const { jobId } = request.params as { jobId: string }
      await adminStore.recordAdminAuditEvent({
        actorUserId: request.authPrincipal.id,
        action: "admin.marketplace_job.read",
        targetType: "job",
        targetId: jobId,
        metadata: {},
        requestId: request.id,
      })
      const job = await adminStore.getAdminMarketplaceJob(jobId)
      if (!job) return reply.code(404).send({ error: "Job not found." })
      reply.header("Cache-Control", "no-store")
      return job
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

  app.patch("/v1/me", { preHandler: requireAuth, schema: { body: { type: "object", additionalProperties: false, required: ["displayName"], properties: { displayName: { type: "string", minLength: 1, maxLength: 120, pattern: "\\S" }, avatarPath: { type: "string", minLength: 1, maxLength: 300, pattern: "^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+$" } } } } }, async (request, reply) => {
    if (!profileStore?.updateProfile || !request.authPrincipal) return reply.code(503).send({ error: "Profile updates are unavailable." })
    const { displayName: rawDisplayName, avatarPath } = request.body as { displayName: string; avatarPath?: string }
    const displayName = rawDisplayName.trim()
    if (!displayName) return reply.code(400).send({ error: "Enter a name for your account." })
    if (avatarPath && profileStore.canSaveProfileAvatar && !(await profileStore.canSaveProfileAvatar())) {
      return reply.code(503).send({ error: "Profile photo updates are unavailable until the account profile database migration is applied." })
    }
    const currentProfile = await profileStore.getProfile(request.authPrincipal.id)
    if (avatarPath) {
      if (!avatarPath.startsWith(`${request.authPrincipal.id}/`)) return reply.code(400).send({ error: "Upload a profile photo for your account." })
      if (!verificationStorage) return reply.code(503).send({ error: "Profile photo storage is unavailable." })
      const [ownerFolder, ...fileParts] = avatarPath.split("/")
      const fileName = fileParts.join("/")
      const { data: storedFiles, error: storageError } = await verificationStorage.storage.from("account-avatars").list(ownerFolder, { search: fileName, limit: 10 })
      if (storageError || !storedFiles?.some((file) => file.name === fileName)) return reply.code(400).send({ error: "The profile photo upload could not be verified." })
    }
    const profile = await profileStore.updateProfile(request.authPrincipal.id, displayName, avatarPath)
    if (!profile) return reply.code(404).send({ error: "Profile not found." })
    if (avatarPath && currentProfile?.avatarPath && currentProfile.avatarPath !== avatarPath && verificationStorage) {
      await verificationStorage.storage.from("account-avatars").remove([currentProfile.avatarPath])
    }
    reply.header("Cache-Control", "no-store")
    return profile
  })

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

  app.get(
    "/v1/provider-verification",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["identity"],
        summary: "Read the authenticated user's provider verification status.",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            required: ["status", "documentType"],
            properties: {
              status: { type: "string" },
              documentType: { type: "string", nullable: true },
            },
          },
          401: { type: "object", properties: { error: { type: "string" } } },
          503: { type: "object", properties: { error: { type: "string" } } },
        },
      },
    },
    async (request, reply) => {
      if (!profileStore?.getProviderVerification || !request.authPrincipal) {
        return reply.code(503).send({ error: "Provider verification services are unavailable." })
      }
      const verification: ProviderVerificationSummary | null =
        await profileStore.getProviderVerification(request.authPrincipal.id)
      reply.header("Cache-Control", "no-store")
      return verification ?? { status: "not_started", documentType: null }
    },
  )

  app.get("/v1/customer-verification", { preHandler: requireMarketplaceRole("consumer") }, async (request, reply) => {
    if (!profileStore?.getCustomerVerification || !request.authPrincipal) return reply.code(503).send({ error: "Customer identity services are unavailable." })
    const status: CustomerVerificationSummary | null = await profileStore.getCustomerVerification(request.authPrincipal.id)
    reply.header("Cache-Control", "no-store")
    return status ?? { status: "not_started", documentType: null, submittedAt: null, reviewReason: null }
  })

  app.post("/v1/customer-verification", {
    preHandler: requireMarketplaceRole("consumer"),
    schema: { body: {
      type: "object",
      additionalProperties: false,
      required: ["documentType", "documentPath", "identityDisclosureAccepted"],
      properties: {
        documentType: { type: "string", enum: ["national_id", "passport"] },
        documentPath: { type: "string", minLength: 1, maxLength: 300, pattern: "^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+$" },
        identityDisclosureAccepted: { type: "boolean" },
      },
    } },
    config: { rateLimit: { max: 5, timeWindow: "1 hour" } },
  }, async (request, reply) => {
    if (!profileStore?.submitCustomerVerification || !request.authPrincipal) return reply.code(503).send({ error: "Customer identity services are unavailable." })
    const body = request.body as { documentType: "national_id" | "passport"; documentPath: string; identityDisclosureAccepted: boolean }
    if (!body.documentPath.startsWith(`${request.authPrincipal.id}/`)) return reply.code(400).send({ error: "Upload your own identity document before submitting." })
    if (body.identityDisclosureAccepted !== true) return reply.code(400).send({ error: "Confirm the identity-document disclosure before submitting." })
    if (!verificationStorage) return reply.code(503).send({ error: "Private identity document services are not configured." })
    const [ownerFolder, ...fileParts] = body.documentPath.split("/")
    const fileName = fileParts.join("/")
    const { data: storedFiles, error: storageError } = await verificationStorage.storage.from("customer-verification").list(ownerFolder, { search: fileName, limit: 10 })
    if (storageError || !storedFiles?.some((file) => file.name === fileName)) return reply.code(400).send({ error: "The uploaded identity document could not be verified. Upload it again." })
    try {
      const result = await profileStore.submitCustomerVerification(request.authPrincipal.id, body.documentType, body.documentPath)
      await adminStore?.recordAdminAuditEvent({ actorUserId: request.authPrincipal.id, action: "customer.identity_verification.submitted", targetType: "customer_identity_verification", targetId: request.authPrincipal.id, metadata: { documentType: body.documentType }, requestId: request.id })
      reply.header("Cache-Control", "no-store")
      return reply.code(201).send(result)
    } catch (error) {
      if (error instanceof MarketplaceConflictError) return reply.code(409).send({ error: error.message })
      throw error
    }
  })

  app.post(
    "/v1/provider-applications",

    {
      preHandler: requireAuth,

      schema: {
        tags: ["identity"],

        summary:
          "Submit identity documents for administrator review of provider verification.",

        security: [{ bearerAuth: [] }],

        body: {
          type: "object",

          required: ["publicName", "bio", "region", "documentType", "documentPath", "identityDisclosureAccepted"],

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

            documentType: { type: "string", enum: ["national_id", "passport"] },

            documentPath: {
              type: "string",
              minLength: 1,
              maxLength: 300,
              pattern: "^[0-9a-fA-F-]{36}/[A-Za-z0-9._-]+$",
            },

            skillsEvidence: { type: "string", maxLength: 2000 },

            identityDisclosureAccepted: { type: "boolean" },
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

              documentType: { type: "string", nullable: true },

              skillsEvidence: { type: "string", nullable: true },

              documentPath: { type: "string", nullable: true },
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

      if (request.body.documentPath && !request.body.documentPath.startsWith(`${request.authPrincipal.id}/`)) {
        return reply.code(400).send({ error: "Upload your own identity document before submitting." })
      }
      if (request.body.documentPath && request.body.identityDisclosureAccepted !== true) {
        return reply.code(400).send({ error: "Confirm the identity-document disclosure before submitting." })
      }
      if (request.body.documentPath) {
        if (!verificationStorage) {
          return reply.code(503).send({ error: "Private identity document services are not configured." })
        }
        const [ownerFolder, ...fileParts] = request.body.documentPath.split("/")
        const fileName = fileParts.join("/")
        const { data: storedFiles, error: storageError } = await verificationStorage.storage
          .from("provider-verification")
          .list(ownerFolder, { search: fileName, limit: 10 })
        if (storageError || !storedFiles?.some((file) => file.name === fileName)) {
          return reply.code(400).send({ error: "The uploaded identity document could not be verified. Upload it again." })
        }
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

          ...(request.body.documentType ? { documentType: request.body.documentType } : {}),

          ...(request.body.documentPath ? { documentPath: request.body.documentPath } : {}),

          ...(request.body.skillsEvidence ? { skillsEvidence: request.body.skillsEvidence.trim() } : {}),
        },
      )

      if (request.body.documentPath) {
        await adminStore.recordAdminAuditEvent({
          actorUserId: request.authPrincipal.id,
          action: "provider.verification.submitted",
          targetType: "provider_profile",
          targetId: request.authPrincipal.id,
          metadata: {
            documentType: request.body.documentType ?? "unknown",
            identityDisclosureAccepted: request.body.identityDisclosureAccepted === true,
            privacyPolicyVersion: policyVersions.privacy,
          },
          requestId: request.id,
        })
      }

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
