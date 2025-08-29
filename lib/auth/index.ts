/**
 * Zeal Authorization Instance
 * Singleton instance of the auth framework
 */

import { ZealAuth, createMockAuth, MockAuthConfig } from '@offbit-ai/zeal-auth';
import { getAuthConfig, isAuthEnabled, getAuthMode } from './config';

let authInstance: ZealAuth | null = null;
let mockAuthInstance: any = null;

/**
 * Initialize the authorization framework
 */
export async function initializeAuth(): Promise<void> {
  if (!isAuthEnabled()) {
    console.log('🔓 Authorization is disabled');
    return;
  }

  const mode = getAuthMode();
  console.log(`🔐 Initializing authorization in ${mode} mode...`);

  if (mode === 'development') {
    // Use mock auth for development
    const mockConfig: MockAuthConfig = {
      defaultSubject: {
        id: process.env.ZEAL_DEV_USER_ID || 'dev-user',
        type: 'user',
        tenantId: process.env.ZEAL_DEV_TENANT_ID || 'dev-tenant',
        organizationId: process.env.ZEAL_DEV_ORG_ID || 'dev-org',
        roles: (process.env.ZEAL_DEV_ROLES || 'user').split(','),
        permissions: process.env.ZEAL_DEV_PERMISSIONS?.split(',')
      },
      allowAll: process.env.ZEAL_DEV_ALLOW_ALL === 'true'
    };

    mockAuthInstance = createMockAuth(mockConfig);
    console.log('✅ Mock authorization initialized for development');
    return;
  }

  // Initialize real auth
  const config = getAuthConfig();
  if (!config) {
    throw new Error('Auth is enabled but configuration is missing');
  }

  try {
    authInstance = new ZealAuth(config);
    
    // Initialize database if using PostgreSQL
    if (config.policies.sources.some(s => s.type === 'database')) {
      const { PostgresAuthProvider } = await import('@offbit-ai/zeal-auth');
      const { getAuthDatabaseConfig } = await import('./config');
      
      const dbConfig = getAuthDatabaseConfig();
      const dbProvider = new PostgresAuthProvider(dbConfig);
      await dbProvider.initialize();
      
      console.log('✅ Database initialized for authorization');
    }
    
    console.log('✅ Authorization framework initialized');
  } catch (error) {
    console.error('❌ Failed to initialize authorization:', error);
    throw error;
  }
}

/**
 * Get the auth instance
 * Returns null if auth is disabled
 */
export function getAuth(): ZealAuth | null {
  if (!isAuthEnabled()) return null;
  
  const mode = getAuthMode();
  if (mode === 'development') {
    return mockAuthInstance;
  }
  
  if (!authInstance) {
    throw new Error('Auth is enabled but not initialized. Call initializeAuth() first.');
  }
  
  return authInstance;
}

/**
 * Get auth instance or throw if disabled
 */
export function requireAuth(): ZealAuth {
  const auth = getAuth();
  if (!auth) {
    throw new Error('Authorization is disabled');
  }
  return auth;
}

/**
 * Check if a request should bypass auth
 * Useful for public endpoints
 */
export function shouldBypassAuth(pathname: string): boolean {
  // Always bypass if auth is disabled
  if (!isAuthEnabled()) return true;

  // Public endpoints that don't require auth
  const publicPaths = [
    '/api/health',
    '/api/test',
    '/api/cache',
    '/api/debug/info'
  ];

  return publicPaths.some(path => pathname.startsWith(path));
}

/**
 * Extract token from request
 */
export function extractToken(req: Request | any): string | null {
  // Check Authorization header
  const authHeader = req.headers?.get?.('authorization') || req.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check X-API-Key header
  const apiKey = req.headers?.get?.('x-api-key') || req.headers?.['x-api-key'];
  if (apiKey) {
    return apiKey;
  }

  // Check cookie
  const cookies = req.cookies || parseCookies(req.headers?.get?.('cookie') || req.headers?.cookie);
  if (cookies?.token) {
    return cookies.token;
  }

  // In development mode, use a mock token if configured
  if (getAuthMode() === 'development' && process.env.ZEAL_DEV_TOKEN) {
    return process.env.ZEAL_DEV_TOKEN;
  }

  return null;
}

/**
 * Parse cookies from header
 */
function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieHeader) return cookies;
  
  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  
  return cookies;
}

/**
 * Create an auth context for testing
 */
export function createTestAuthContext(overrides?: any) {
  return {
    subject: {
      id: 'test-user',
      type: 'user' as const,
      tenantId: 'test-tenant',
      organizationId: 'test-org',
      roles: ['user'],
      ...overrides?.subject
    },
    constraints: overrides?.constraints,
    obligations: overrides?.obligations
  };
}

// Export types for convenience
export type { 
  ZealAuth,
  Subject,
  Resource,
  AuthorizationResult,
  AuthorizationContext,
  Policy,
  PolicyConstraints
} from '@offbit-ai/zeal-auth';