/**
 * Authentication utilities for ZIP SDK
 * Generates auth tokens with the required information for zeal-auth
 */

import * as crypto from 'crypto'

/**
 * Subject information required by zeal-auth
 */
export interface TokenSubject {
  id: string
  type?: 'user' | 'service' | 'api_key'
  tenantId?: string
  organizationId?: string
  teams?: string[]
  groups?: string[]
  roles?: string[]
  permissions?: string[]
  metadata?: Record<string, any>
}

/**
 * Token generation options
 */
export interface TokenOptions {
  expiresIn?: number // seconds
  issuer?: string
  audience?: string | string[]
  notBefore?: number // timestamp
  secretKey?: string // ZEAL_SECRET_KEY for signing
}

/**
 * Token payload structure expected by zeal-auth
 */
export interface TokenPayload {
  sub: string // Subject ID
  iss?: string // Issuer
  aud?: string | string[] // Audience
  exp?: number // Expiration timestamp
  iat?: number // Issued at timestamp
  nbf?: number // Not before timestamp
  type?: string // Subject type
  tenant_id?: string
  organization_id?: string
  teams?: string[]
  groups?: string[]
  roles?: string[]
  permissions?: string[]
  metadata?: Record<string, any>
  sdk_version?: string
  application_id?: string
  session_id?: string
}

/**
 * Signed token structure
 */
export interface SignedToken {
  payload: string // Base64 encoded payload
  signature: string // HMAC signature
}

/**
 * Generate a signed token for self-hosted Zeal integrators
 * Uses HMAC-SHA256 for signing with the provided secret key
 * 
 * @param subject - Subject information to include in the token
 * @param options - Token generation options (including secretKey)
 * @returns Signed token string in format: base64(payload).signature
 */
export function generateAuthToken(
  subject: TokenSubject,
  options: TokenOptions = {}
): string {
  // Get secret key from options or environment
  const secretKey = options.secretKey || process.env.ZEAL_SECRET_KEY
  if (!secretKey) {
    throw new Error('ZEAL_SECRET_KEY is required for token generation. Set it as an environment variable or pass it in options.')
  }

  const now = Math.floor(Date.now() / 1000)
  
  const payload: TokenPayload = {
    sub: subject.id,
    iat: now,
    type: subject.type,
    tenant_id: subject.tenantId,
    organization_id: subject.organizationId,
    teams: subject.teams,
    groups: subject.groups,
    roles: subject.roles,
    permissions: subject.permissions,
    metadata: subject.metadata,
    sdk_version: '1.0.0',
    application_id: 'zeal-js-sdk',
    session_id: crypto.randomBytes(16).toString('hex')
  }
  
  // Add optional claims
  if (options.expiresIn) {
    payload.exp = now + options.expiresIn
  }
  
  if (options.issuer) {
    payload.iss = options.issuer
  }
  
  if (options.audience) {
    payload.aud = options.audience
  }
  
  if (options.notBefore) {
    payload.nbf = options.notBefore
  }
  
  // Encode payload as base64
  const payloadString = JSON.stringify(payload)
  const encodedPayload = Buffer.from(payloadString).toString('base64url')
  
  // Create HMAC signature
  const hmac = crypto.createHmac('sha256', secretKey)
  hmac.update(encodedPayload)
  const signature = hmac.digest('base64url')
  
  // Return token in format: payload.signature
  return `${encodedPayload}.${signature}`
}

/**
 * Verify and parse a signed token
 * 
 * @param token - Signed token string (payload.signature)
 * @param secretKey - Secret key for verification (optional, uses env var if not provided)
 * @returns Parsed token payload
 * @throws Error if token is invalid or signature doesn't match
 */
export function verifyAndParseToken(token: string, secretKey?: string): TokenPayload {
  const key = secretKey || process.env.ZEAL_SECRET_KEY
  if (!key) {
    throw new Error('ZEAL_SECRET_KEY is required for token verification')
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new Error('Invalid token format')
  }

  const [encodedPayload, signature] = parts
  
  // Verify signature
  const hmac = crypto.createHmac('sha256', key)
  hmac.update(encodedPayload)
  const expectedSignature = hmac.digest('base64url')
  
  if (signature !== expectedSignature) {
    throw new Error('Invalid token signature')
  }
  
  // Decode and parse payload
  try {
    const decoded = Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    return JSON.parse(decoded)
  } catch (error) {
    throw new Error('Invalid token payload')
  }
}

/**
 * Parse a token without verification (USE WITH CAUTION)
 * Only use this for debugging or when you don't have the secret key
 * 
 * @param token - Signed token string
 * @returns Parsed token payload
 */
export function parseTokenUnsafe(token: string): TokenPayload {
  const parts = token.split('.')
  if (parts.length !== 2) {
    throw new Error('Invalid token format')
  }
  
  const [encodedPayload] = parts
  
  try {
    const decoded = Buffer.from(encodedPayload, 'base64url').toString('utf-8')
    return JSON.parse(decoded)
  } catch (error) {
    throw new Error('Invalid token payload')
  }
}

/**
 * Create a service account token
 * Convenience function for creating tokens for service-to-service auth
 * 
 * @param serviceId - Service identifier
 * @param tenantId - Tenant ID the service belongs to
 * @param permissions - Service permissions
 * @param options - Token options
 * @returns Signed token string
 */
export function createServiceToken(
  serviceId: string,
  tenantId: string,
  permissions: string[] = [],
  options: TokenOptions = {}
): string {
  return generateAuthToken(
    {
      id: serviceId,
      type: 'service',
      tenantId,
      permissions,
      metadata: {
        service: true,
        created_at: new Date().toISOString()
      }
    },
    options
  )
}

/**
 * Create a user token
 * Convenience function for creating user authentication tokens
 * 
 * @param userId - User identifier
 * @param tenantId - Tenant ID the user belongs to
 * @param roles - User roles
 * @param options - Token options
 * @returns Signed token string
 */
export function createUserToken(
  userId: string,
  tenantId: string,
  roles: string[] = [],
  options: TokenOptions = {}
): string {
  return generateAuthToken(
    {
      id: userId,
      type: 'user',
      tenantId,
      roles,
      metadata: {
        created_at: new Date().toISOString()
      }
    },
    options
  )
}

/**
 * Create an API key token
 * Convenience function for creating API key authentication tokens
 * 
 * @param apiKeyId - API key identifier
 * @param tenantId - Tenant ID the API key belongs to
 * @param permissions - API key permissions
 * @param options - Token options
 * @returns Signed token string
 */
export function createApiKeyToken(
  apiKeyId: string,
  tenantId: string,
  permissions: string[] = [],
  options: TokenOptions = {}
): string {
  return generateAuthToken(
    {
      id: apiKeyId,
      type: 'api_key',
      tenantId,
      permissions,
      metadata: {
        api_key: true,
        created_at: new Date().toISOString()
      }
    },
    options
  )
}

/**
 * Validate token expiration and signature
 * 
 * @param token - Token to validate
 * @param secretKey - Secret key for verification (optional, uses env var if not provided)
 * @returns True if token is valid and not expired, false otherwise
 */
export function isTokenValid(token: string, secretKey?: string): boolean {
  try {
    const payload = verifyAndParseToken(token, secretKey)
    const now = Math.floor(Date.now() / 1000)
    
    // Check expiration
    if (payload.exp && payload.exp < now) {
      return false
    }
    
    // Check not before
    if (payload.nbf && payload.nbf > now) {
      return false
    }
    
    return true
  } catch {
    return false
  }
}