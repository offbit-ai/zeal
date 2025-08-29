/**
 * Zeal Authorization Configuration
 * Integrates with external identity providers for token validation and claim mapping
 */

import { AuthConfig } from '@offbit-ai/zeal-auth';

/**
 * Check if authorization is enabled
 */
export const isAuthEnabled = (): boolean => {
  return process.env.ZEAL_AUTH_ENABLED === 'true';
};

/**
 * Get the authorization mode
 * - 'disabled': No auth checks
 * - 'development': Mock auth for development
 * - 'production': Full auth with external identity provider
 */
export const getAuthMode = (): 'disabled' | 'development' | 'production' => {
  if (!isAuthEnabled()) return 'disabled';
  return (process.env.ZEAL_AUTH_MODE as any) || 'development';
};

/**
 * Build auth configuration from environment variables
 */
export const getAuthConfig = (): AuthConfig | null => {
  if (!isAuthEnabled()) return null;

  const mode = getAuthMode();

  // Development mode - use mock configuration
  if (mode === 'development') {
    return {
      providers: [{
        id: 'development',
        type: 'jwt',
        issuer: 'https://dev.zeal.local',
        publicKey: process.env.ZEAL_AUTH_DEV_PUBLIC_KEY || generateDevKey()
      }],
      
      claimMappings: {
        subject: {
          id: ['sub', 'user_id', 'email'],
          type: 'type'
        },
        tenant: process.env.ZEAL_AUTH_TENANT_CLAIM || 'tenant_id',
        organization: process.env.ZEAL_AUTH_ORG_CLAIM || 'org_id',
        teams: process.env.ZEAL_AUTH_TEAMS_CLAIM || 'teams',
        groups: process.env.ZEAL_AUTH_GROUPS_CLAIM || 'groups',
        roles: process.env.ZEAL_AUTH_ROLES_CLAIM || 'roles'
      },
      
      hierarchy: {
        enabled: false,
        providers: []
      },
      
      policies: {
        sources: [{
          type: 'file',
          location: process.env.ZEAL_AUTH_POLICIES_PATH || './auth-policies.yaml'
        }],
        evaluationStrategy: 'priority',
        defaultEffect: 'allow' // Allow by default in dev mode
      },
      
      cache: {
        enabled: false
      },
      
      audit: {
        enabled: process.env.ZEAL_AUTH_AUDIT_ENABLED === 'true',
        providers: [{
          type: 'file',
          path: './logs/auth-audit.log'
        }]
      }
    };
  }

  // Production mode - integrate with external identity provider
  return {
    providers: buildIdentityProviders(),
    claimMappings: buildClaimMappings(),
    hierarchy: buildHierarchyConfig(),
    policies: buildPolicyConfig(),
    cache: buildCacheConfig(),
    audit: buildAuditConfig()
  };
};

/**
 * Build identity provider configuration
 * Supports any JWT-based identity provider
 */
function buildIdentityProviders() {
  const providers: any[] = [];

  // Primary JWT provider configuration
  if (process.env.AUTH_JWT_ENABLED !== 'false') {
    providers.push({
      id: 'primary',
      type: 'jwt',
      
      // Standard JWT configuration
      issuer: process.env.AUTH_JWT_ISSUER,
      audience: process.env.AUTH_JWT_AUDIENCE || process.env.ZEAL_API_URL,
      
      // Token validation via JWKS endpoint or public key
      jwksUri: process.env.AUTH_JWT_JWKS_URI,
      publicKey: process.env.AUTH_JWT_PUBLIC_KEY,
      
      // Validation options
      algorithms: (process.env.AUTH_JWT_ALGORITHMS || 'RS256').split(','),
      clockTolerance: parseInt(process.env.AUTH_JWT_CLOCK_TOLERANCE || '5'),
      
      // Optional settings
      validateCustomClaims: process.env.AUTH_VALIDATE_CUSTOM_CLAIMS === 'true',
      requiredClaims: process.env.AUTH_REQUIRED_CLAIMS?.split(',')
    });
  }

  // Secondary providers (for migration or multi-provider scenarios)
  if (process.env.AUTH_SECONDARY_JWT_ENABLED === 'true') {
    providers.push({
      id: 'secondary',
      type: 'jwt',
      issuer: process.env.AUTH_SECONDARY_JWT_ISSUER,
      audience: process.env.AUTH_SECONDARY_JWT_AUDIENCE,
      jwksUri: process.env.AUTH_SECONDARY_JWT_JWKS_URI,
      publicKey: process.env.AUTH_SECONDARY_JWT_PUBLIC_KEY
    });
  }

  // API key validation for service accounts
  if (process.env.AUTH_API_KEY_ENABLED === 'true') {
    providers.push({
      id: 'api-key',
      type: 'api-key',
      validationEndpoint: process.env.AUTH_API_KEY_VALIDATION_ENDPOINT,
      headerName: process.env.AUTH_API_KEY_HEADER || 'X-API-Key',
      
      // Optional: validate API keys locally
      localValidation: process.env.AUTH_API_KEY_LOCAL === 'true',
      keyPrefix: process.env.AUTH_API_KEY_PREFIX
    });
  }

  // Custom token validation endpoint (for proprietary systems)
  if (process.env.AUTH_CUSTOM_VALIDATION_ENDPOINT) {
    providers.push({
      id: 'custom',
      type: 'custom',
      validationEndpoint: process.env.AUTH_CUSTOM_VALIDATION_ENDPOINT,
      method: process.env.AUTH_CUSTOM_VALIDATION_METHOD || 'POST',
      headers: process.env.AUTH_CUSTOM_VALIDATION_HEADERS ? 
        JSON.parse(process.env.AUTH_CUSTOM_VALIDATION_HEADERS) : {}
    });
  }

  return providers;
}

/**
 * Build claim mappings from JWT tokens
 * Maps external identity provider claims to Zeal's authorization model
 */
function buildClaimMappings() {
  return {
    // Subject identification
    subject: {
      id: (process.env.AUTH_CLAIM_SUBJECT_ID || 'sub,user_id,userId').split(','),
      type: process.env.AUTH_CLAIM_SUBJECT_TYPE || 'type',
      email: process.env.AUTH_CLAIM_EMAIL || 'email',
      name: process.env.AUTH_CLAIM_NAME || 'name'
    },
    
    // Multi-tenancy claims
    tenant: process.env.AUTH_CLAIM_TENANT || 'tenant_id',
    organization: process.env.AUTH_CLAIM_ORGANIZATION || 'org_id',
    
    // Authorization claims
    roles: process.env.AUTH_CLAIM_ROLES || 'roles',
    permissions: process.env.AUTH_CLAIM_PERMISSIONS || 'permissions',
    scopes: process.env.AUTH_CLAIM_SCOPES || 'scope',
    
    // Group/team membership
    teams: process.env.AUTH_CLAIM_TEAMS || 'teams',
    groups: process.env.AUTH_CLAIM_GROUPS || 'groups',
    
    // Additional context claims
    sessionId: process.env.AUTH_CLAIM_SESSION_ID || 'sid',
    clientId: process.env.AUTH_CLAIM_CLIENT_ID || 'client_id',
    
    // Feature-specific claims (optional)
    features: {
      // Workflow-specific claims
      workflowAccess: process.env.AUTH_CLAIM_WORKFLOW_ACCESS,
      workflowQuota: process.env.AUTH_CLAIM_WORKFLOW_QUOTA,
      
      // Node template claims
      nodeTemplateAccess: process.env.AUTH_CLAIM_NODE_TEMPLATE_ACCESS,
      allowedNodeTypes: process.env.AUTH_CLAIM_ALLOWED_NODE_TYPES,
      
      // AI/Agent claims
      agentId: process.env.AUTH_CLAIM_AGENT_ID,
      agentPermissions: process.env.AUTH_CLAIM_AGENT_PERMISSIONS,
      
      // Compliance/KYC claims
      complianceLevel: process.env.AUTH_CLAIM_COMPLIANCE_LEVEL,
      verificationStatus: process.env.AUTH_CLAIM_VERIFICATION_STATUS
    },
    
    // Custom claim mappings
    custom: parseCustomClaimMappings()
  };
}

/**
 * Parse custom claim mappings from environment
 * Format: key1:claim.path1,key2:claim.path2
 * Example: department:user.dept,clearance:security.level
 */
function parseCustomClaimMappings(): Record<string, string> | undefined {
  const customClaims = process.env.AUTH_CUSTOM_CLAIM_MAPPINGS;
  if (!customClaims) return undefined;

  const mappings: Record<string, string> = {};
  
  customClaims.split(',').forEach(mapping => {
    const [key, path] = mapping.split(':');
    if (key && path) {
      mappings[key.trim()] = path.trim();
    }
  });

  return Object.keys(mappings).length > 0 ? mappings : undefined;
}

/**
 * Build hierarchy configuration
 */
function buildHierarchyConfig() {
  const enabled = process.env.ZEAL_AUTH_HIERARCHY_ENABLED === 'true';
  
  return {
    enabled,
    providers: enabled ? [{
      type: 'database' as const,
      config: {
        connectionString: process.env.ZEAL_AUTH_DB_URL || process.env.DATABASE_URL
      }
    }] : [],
    cache: enabled ? {
      ttl: parseInt(process.env.ZEAL_AUTH_HIERARCHY_CACHE_TTL || '300'),
      maxSize: parseInt(process.env.ZEAL_AUTH_HIERARCHY_CACHE_SIZE || '1000')
    } : undefined
  };
}

/**
 * Build policy configuration
 */
function buildPolicyConfig() {
  const sources: any[] = [];

  // File-based policies
  if (process.env.ZEAL_AUTH_POLICIES_PATH) {
    sources.push({
      type: 'file',
      location: process.env.ZEAL_AUTH_POLICIES_PATH,
      format: process.env.ZEAL_AUTH_POLICIES_FORMAT || 'yaml',
      watch: process.env.ZEAL_AUTH_POLICIES_WATCH === 'true'
    });
  }

  // Database policies
  if (process.env.ZEAL_AUTH_POLICIES_DB === 'true') {
    sources.push({
      type: 'database',
      location: process.env.ZEAL_AUTH_DB_URL || process.env.DATABASE_URL
    });
  }

  // API-based policies
  if (process.env.ZEAL_AUTH_POLICIES_API_URL) {
    sources.push({
      type: 'api',
      location: process.env.ZEAL_AUTH_POLICIES_API_URL,
      cache: {
        ttl: parseInt(process.env.ZEAL_AUTH_POLICIES_API_CACHE_TTL || '300')
      }
    });
  }

  return {
    sources,
    evaluationStrategy: (process.env.ZEAL_AUTH_POLICY_STRATEGY as any) || 'priority',
    defaultEffect: (process.env.ZEAL_AUTH_DEFAULT_EFFECT as any) || 'deny'
  };
}

/**
 * Build cache configuration
 */
function buildCacheConfig() {
  const enabled = process.env.ZEAL_AUTH_CACHE_ENABLED !== 'false';
  
  if (!enabled) {
    return { enabled: false };
  }

  const provider = process.env.ZEAL_AUTH_CACHE_PROVIDER || 'memory';
  
  if (provider === 'redis') {
    return {
      enabled: true,
      provider: {
        type: 'redis' as const,
        url: process.env.ZEAL_AUTH_REDIS_URL || process.env.REDIS_URL,
        keyPrefix: process.env.ZEAL_AUTH_REDIS_PREFIX || 'zeal:auth:',
        ttl: parseInt(process.env.ZEAL_AUTH_CACHE_TTL || '300')
      },
      ttl: parseInt(process.env.ZEAL_AUTH_CACHE_TTL || '300'),
      keyHashAlgorithm: process.env.ZEAL_AUTH_CACHE_HASH || 'sha256'
    };
  }

  return {
    enabled: true,
    ttl: parseInt(process.env.ZEAL_AUTH_CACHE_TTL || '300')
  };
}

/**
 * Build audit configuration
 */
function buildAuditConfig() {
  const enabled = process.env.ZEAL_AUTH_AUDIT_ENABLED === 'true';
  
  if (!enabled) {
    return { enabled: false };
  }

  const providers: any[] = [];

  // File audit
  if (process.env.ZEAL_AUTH_AUDIT_FILE === 'true') {
    providers.push({
      type: 'file',
      path: process.env.ZEAL_AUTH_AUDIT_FILE_PATH || './logs/auth-audit.log'
    });
  }

  // Database audit
  if (process.env.ZEAL_AUTH_AUDIT_DB === 'true') {
    providers.push({
      type: 'database',
      connectionString: process.env.ZEAL_AUTH_DB_URL || process.env.DATABASE_URL,
      table: process.env.ZEAL_AUTH_AUDIT_TABLE || 'audit_logs'
    });
  }

  // Syslog audit
  if (process.env.ZEAL_AUTH_AUDIT_SYSLOG === 'true') {
    providers.push({
      type: 'syslog',
      host: process.env.ZEAL_AUTH_SYSLOG_HOST || 'localhost',
      port: parseInt(process.env.ZEAL_AUTH_SYSLOG_PORT || '514'),
      facility: process.env.ZEAL_AUTH_SYSLOG_FACILITY || 'local0'
    });
  }

  return {
    enabled: true,
    level: (process.env.ZEAL_AUTH_AUDIT_LEVEL as any) || 'all',
    providers,
    buffer: {
      enabled: process.env.ZEAL_AUTH_AUDIT_BUFFER === 'true',
      maxSize: parseInt(process.env.ZEAL_AUTH_AUDIT_BUFFER_SIZE || '100'),
      flushInterval: parseInt(process.env.ZEAL_AUTH_AUDIT_BUFFER_FLUSH || '10')
    },
    sampling: {
      rate: parseFloat(process.env.ZEAL_AUTH_AUDIT_SAMPLE_RATE || '1.0')
    }
  };
}

/**
 * Generate a development key for testing
 */
function generateDevKey(): string {
  // This is a well-known development key - DO NOT USE IN PRODUCTION
  return `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu1SU1LfVLPHCozMxH2Mo
4lgOEePzNm0tRgeLezV6ffAt0gunVTLw7onLRnrq0/IzW7yWR7QkrmBL7jTKEn5u
+qKhbwKfBstIs+bMY2Zkp18gnTxKLxoS2tFczGkPLPgizskuemMghRniWaoLcyeh
kd3qqGElvW/VDL5AaWTg0nLVkjRo9z+40RQzuVaE8AkAFmxZzow3x+VJYKdjykkJ
0iT9wCS0DRTXu269V264Vf/3jvredZiKRkgwlL9xNAwxXFg0x/XFw005UWVRIkdg
cKWTjpBP2dPwVZ4WWC+9aGVd+Gyn1o0CLelf4rEjGoXbAAEgAqeGUxrcIlbjXfbc
mwIDAQAB
-----END PUBLIC KEY-----`;
}

/**
 * Get PostgreSQL connection configuration for auth
 */
export function getAuthDatabaseConfig() {
  return {
    useWorkflowDb: process.env.ZEAL_AUTH_USE_WORKFLOW_DB === 'true',
    connectionString: process.env.ZEAL_AUTH_DB_URL || process.env.DATABASE_URL,
    schema: {
      perTenant: process.env.ZEAL_AUTH_SCHEMA_PER_TENANT === 'true',
      baseName: process.env.ZEAL_AUTH_SCHEMA_NAME || 'zeal_auth'
    },
    enableRLS: process.env.ZEAL_AUTH_ENABLE_RLS === 'true'
  };
}