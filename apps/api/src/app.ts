import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import swagger from "@fastify/swagger"
import swaggerUi from "@fastify/swagger-ui"
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify"
import { randomUUID } from "node:crypto"
import type { AccessTokenVerifier, AuthenticatedPrincipal, UserProfileStore } from "./auth/types.js"
import type { AppConfig } from "./config.js"
import type { ReadinessDatabase } from "./database.js"

type BuildAppOptions = {
  config: AppConfig
  database: ReadinessDatabase | null
  authVerifier?: AccessTokenVerifier | null
  profileStore?: UserProfileStore | null
  logger?: boolean
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

export async function buildApp({
  config,
  database,
  authVerifier = null,
  profileStore = null,
  logger,
}: BuildAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
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
      return typeof requestedId === "string" && /^[A-Za-z0-9._-]{1,80}$/.test(requestedId)
        ? requestedId
        : randomUUID()
    },
  })
  app.decorateRequest("authPrincipal", null)

  app.addHook("onRequest", async (request, reply) => {
    reply.header("x-request-id", request.id)
  })

  await app.register(helmet)
  await app.register(cors, {
    origin: config.webOrigin,
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
      return reply.code(503).send({ error: "Authentication is not configured." })
    }
    const authorization = request.headers.authorization
    if (!authorization?.startsWith("Bearer ")) {
      return reply.code(401).send({ error: "A valid bearer token is required." })
    }

    try {
      const principal = await authVerifier.verify(authorization.slice(7))
      if (!principal) {
        return reply.code(401).send({ error: "The access token is invalid or expired." })
      }
      request.authPrincipal = principal
    } catch {
      return reply.code(503).send({ error: "Authentication service is unavailable." })
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
        return reply.code(503).send({ error: "Profile storage is unavailable." })
      }
      const profile = await profileStore.bootstrapProfile(request.authPrincipal)
      if (profile.status !== "active") {
        return reply.code(403).send({ error: "This account is not active." })
      }
      return profile
    },
  )

  app.get(
    "/v1/me",
    {
      preHandler: requireAuth,
      schema: {
        tags: ["identity"],
        summary: "Read the authenticated caller's OddJobs profile and assigned roles.",
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
        return reply.code(503).send({ error: "Profile storage is unavailable." })
      }
      const profile = await profileStore.getProfile(request.authPrincipal.id)
      if (!profile) return reply.code(404).send({ error: "Profile not found." })
      return profile
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