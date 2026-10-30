import { createClient } from "@supabase/supabase-js"
import type { AccessTokenVerifier, AuthenticatedPrincipal } from "./types.js"

export class SupabaseTokenVerifier implements AccessTokenVerifier {
  private readonly client

  constructor(url: string, apiKey: string) {
    this.client = createClient(url, apiKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    })
  }

  async verify(accessToken: string): Promise<AuthenticatedPrincipal | null> {
    const { data, error } = await this.client.auth.getUser(accessToken)
    if (error) {
      if (error.name === "AuthRetryableFetchError" || (error.status ?? 0) >= 500) {
        throw new Error("Supabase Auth is temporarily unavailable.")
      }
      return null
    }

    const user = data.user
    if (!user || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(user.id)) {
      return null
    }

    const displayName = user.user_metadata?.full_name
    return {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      displayName: typeof displayName === "string" ? displayName : null,
    }
  }
}