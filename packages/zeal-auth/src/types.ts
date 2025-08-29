/**
 * Core types for Zeal Authorization Framework
 */

// ============= Identity & Claims =============

export interface Subject {
  id: string;
  type: 'user' | 'service' | 'api_key';
  tenantId?: string;
  organizationId?: string;
  teams?: string[];
  groups?: string[];
  roles?: string[];
  permissions?: string[];
  claims?: Record<string, any>;
  metadata?: Record<string, any>;
  hierarchy?: HierarchyPath[];
  sdkVersion?: string;
  sdkClientId?: string;
  applicationId?: string;
  sessionId?: string;
  externalClaims?: ExternalClaims;
  [key: string]: any;
}

export interface HierarchyPath {
  type: 'organization' | 'team' | 'group' | 'role';
  id: string;
  name: string;
  level: number;
  permissions?: string[];
}

export interface ExternalClaims {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nbf?: number;
  [key: string]: any;
}

// ============= Resources =============

export interface Resource {
  type: ResourceType;
  id?: string;
  ownerId?: string;
  ownerType?: 'user' | 'team' | 'organization';
  tenantId?: string;
  organizationId?: string;
  attributes?: Record<string, any>;
  tags?: string[];
  visibility?: 'private' | 'organization' | 'public';
  sharedWith?: SharedAccess[];
}

export type ResourceType = 
  | 'workflow'
  | 'node'
  | 'template'
  | 'execution'
  | 'tenant'
  | 'organization'
  | 'team'
  | 'api_key'
  | 'webhook'
  | 'integration'
  | 'unknown'
  | 'channel'
  | 'message'
  | 'websocket'
  | 'event';

export interface SharedAccess {
  principalId: string;
  principalType: 'user' | 'team' | 'organization';
  permissions: string[];
  expiresAt?: Date;
}

// ============= Actions =============

export interface Action {
  name: string;
  type: ActionType;
  context?: Record<string, any>;
}

export type ActionType = 
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'execute'
  | 'share'
  | 'publish'
  | 'approve'
  | 'export'
  | 'import';

// ============= Authorization Context =============

export interface AuthorizationContext {
  subject: Subject;
  resource: Resource;
  action: Action | string;
  environment?: Environment;
  request?: RequestContext;
}

export interface Environment {
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  apiVersion?: string;
  clientId?: string;
  deviceId?: string;
}

export interface RequestContext {
  method: string;
  path: string;
  headers?: Record<string, string>;
  query?: Record<string, any>;
  body?: Record<string, any>;
  ipAddress?: string;
}

// ============= Policies =============

export interface Policy {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  effect: 'allow' | 'deny';
  conditions: PolicyCondition[];
  constraints?: PolicyConstraints;
  metadata?: Record<string, any>;
}

export interface PolicyCondition {
  type: 'all' | 'any' | 'none';
  rules: PolicyRule[];
}

export interface PolicyRule {
  attribute: string;
  operator: PolicyOperator;
  value: any;
  caseSensitive?: boolean;
}

export type PolicyOperator = 
  | 'equals'
  | 'notEquals'
  | 'contains'
  | 'notContains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'greaterThan'
  | 'lessThan'
  | 'greaterThanOrEqual'
  | 'lessThanOrEqual'
  | 'matches' // regex
  | 'exists'
  | 'notExists';

export interface PolicyConstraints {
  fields?: string[]; // Allowed fields for read/update
  filters?: Record<string, any>; // Data filters to apply
  maxResults?: number;
  timeWindow?: {
    start?: Date;
    end?: Date;
  };
  rateLimit?: {
    requests: number;
    window: number; // seconds
  };
}

// ============= Authorization Results =============

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
  subject?: Subject;
  matchedPolicies?: string[];
  constraints?: PolicyConstraints;
  obligations?: Obligation[];
  metadata?: Record<string, any>;
  ttl?: number; // Cache TTL in seconds
}

export interface Obligation {
  type: 'log' | 'notify' | 'filter' | 'transform' | 'validate';
  action: string;
  params?: Record<string, any>;
}

// ============= Configuration =============

export interface AuthConfig {
  providers: IdentityProviderConfig[];
  claimMappings: ClaimMappingConfig;
  hierarchy: HierarchyConfig;
  policies: PolicyConfig;
  cache?: CacheConfig;
  audit?: AuditConfig;
}

export interface IdentityProviderConfig {
  id: string;
  type: 'jwt' | 'saml' | 'oauth2' | 'custom';
  issuer?: string;
  audience?: string;
  jwksUri?: string;
  publicKey?: string;
  claimMappings?: Record<string, string>;
}

export interface ClaimMappingConfig {
  subject: {
    id: string | string[];
    type?: string;
  };
  tenant?: string | string[];
  organization?: string | string[];
  teams?: string | string[];
  groups?: string | string[];
  roles?: string | string[];
  custom?: Record<string, string | string[]>;
}

export interface HierarchyConfig {
  enabled: boolean;
  providers: HierarchyProvider[];
  cache?: {
    ttl: number;
    maxSize: number;
  };
}

export interface HierarchyProvider {
  type: 'database' | 'api' | 'static';
  config: Record<string, any>;
}

export interface PolicyConfig {
  sources: PolicySource[];
  evaluationStrategy: 'first-match' | 'all-match' | 'priority';
  defaultEffect: 'allow' | 'deny';
}

export interface PolicySource {
  type: 'file' | 'database' | 'api';
  location: string;
  format?: 'json' | 'yaml';
  watch?: boolean;
  cache?: {
    ttl: number;
  };
}

export interface CacheConfig {
  enabled: boolean;
  provider?: {
    type: 'redis' | 'memcached' | 'dynamodb';
    [key: string]: any;
  };
  ttl?: number;
  maxSize?: number;
  cleanupInterval?: number;
  keyHashAlgorithm?: string;
  redis?: {
    url: string;
    keyPrefix?: string;
  };
}

export interface CacheProvider {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl: number): Promise<void>;
  invalidate?(pattern: string): Promise<void>;
  clear?(): Promise<void>;
  destroy?(): void;
}

export interface AuditConfig {
  enabled: boolean;
  level?: 'all' | 'denials' | 'changes';
  destinations?: AuditDestination[];
  providers?: AuditProviderConfig[];
  buffer?: {
    enabled: boolean;
    maxSize?: number;
    flushInterval?: number;
  };
  sanitize?: {
    fields?: string[];
  };
  sampling?: {
    rate?: number;
  };
}

export interface AuditProviderConfig {
  type: 'file' | 'database' | 'syslog' | 'elasticsearch';
  [key: string]: any;
}

export interface AuditDestination {
  type: 'console' | 'file' | 'database' | 'webhook';
  config: Record<string, any>;
}

// ============= Node Template Permissions =============

export interface NodePermission {
  nodeType: string;
  requiredPermissions?: string[];
  requiredRoles?: string[];
  requiredClaims?: Record<string, any>;
  allowedTenants?: string[];
  allowedOrganizations?: string[];
  restrictions?: NodeRestriction[];
}

export interface NodeRestriction {
  property: string;
  allowedValues?: any[];
  deniedValues?: any[];
  validator?: string; // Reference to validator function
}

// ============= Workflow Sharing =============

export interface WorkflowSharingPolicy {
  defaultVisibility: 'private' | 'organization' | 'public';
  allowedVisibilities: string[];
  sharePermissions: {
    roles: string[];
    minLevel?: number; // Hierarchy level
  };
  publicPermissions: {
    requiresApproval: boolean;
    approverRoles: string[];
  };
}