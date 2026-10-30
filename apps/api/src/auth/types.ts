export type AuthenticatedPrincipal = {
  id: string
  email: string | null
  phone: string | null
  displayName: string | null
}

export type UserProfile = {
  id: string
  displayName: string
  status: string
  roles: string[]
}

export interface AccessTokenVerifier {
  verify(accessToken: string): Promise<AuthenticatedPrincipal | null>
}

export interface UserProfileStore {
  bootstrapProfile(principal: AuthenticatedPrincipal): Promise<UserProfile>
  getProfile(userId: string): Promise<UserProfile | null>
}