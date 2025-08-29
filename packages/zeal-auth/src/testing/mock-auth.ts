/**
 * Testing utilities for Zeal Authorization
 */

import { 
  ZealAuth,
  Subject,
  Resource,
  AuthorizationResult,
  Policy,
  AuthConfig,
  ExternalClaims
} from '../index';

/**
 * Mock authorization configuration
 */
export interface MockAuthConfig {
  defaultSubject?: Partial<Subject>;
  defaultResult?: Partial<AuthorizationResult>;
  policies?: Policy[];
  allowAll?: boolean;
  denyAll?: boolean;
  tenantId?: string;
  mockClaims?: ExternalClaims;
}

/**
 * Create a mock ZealAuth instance for testing
 */
export function createMockAuth(config: MockAuthConfig = {}): MockZealAuth {
  return new MockZealAuth(config);
}

/**
 * Mock ZealAuth implementation
 */
export class MockZealAuth extends ZealAuth {
  private mockConfig: MockAuthConfig;
  private authorizationCalls: Array<{
    subject: Subject;
    resource: Resource;
    action: string;
    result: AuthorizationResult;
  }> = [];
  
  constructor(config: MockAuthConfig) {
    // Create minimal valid config for parent class
    const authConfig: AuthConfig = {
      providers: [],
      claimMappings: {
        subject: { id: 'sub' }
      },
      hierarchy: { enabled: false, providers: [] },
      policies: {
        sources: [],
        evaluationStrategy: 'first-match',
        defaultEffect: config.denyAll ? 'deny' : 'allow'
      }
    };
    
    super(authConfig);
    this.mockConfig = config;
  }
  
  /**
   * Mock authorize method
   */
  async authorize(
    tokenOrClaims: string | ExternalClaims | Subject,
    resource: Resource | string,
    action: string
  ): Promise<AuthorizationResult> {
    // Extract subject
    let subject: Subject;
    if (typeof tokenOrClaims === 'object' && 'id' in tokenOrClaims) {
      subject = tokenOrClaims as Subject;
    } else {
      subject = this.createMockSubject();
    }
    
    // Normalize resource
    const normalizedResource = typeof resource === 'string' 
      ? { type: resource as any } 
      : resource;
    
    // Determine result
    let result: AuthorizationResult;
    
    if (this.mockConfig.allowAll) {
      result = {
        allowed: true,
        reason: 'Mock: Allow all'
      };
    } else if (this.mockConfig.denyAll) {
      result = {
        allowed: false,
        reason: 'Mock: Deny all'
      };
    } else if (this.mockConfig.defaultResult) {
      result = {
        allowed: true,
        ...this.mockConfig.defaultResult
      };
    } else {
      // Default behavior - check some basic rules
      result = this.evaluateMockPolicies(subject, normalizedResource, action);
    }
    
    // Record the call
    this.authorizationCalls.push({
      subject,
      resource: normalizedResource,
      action,
      result
    });
    
    return result;
  }
  
  /**
   * Mock token validation
   */
  async validateToken(token: string): Promise<ExternalClaims> {
    if (this.mockConfig.mockClaims) {
      return this.mockConfig.mockClaims;
    }
    
    return {
      sub: 'mock-user-id',
      iss: 'mock-issuer',
      aud: 'mock-audience',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000)
    };
  }
  
  /**
   * Mock effective permissions
   */
  async getEffectivePermissions(
    subject: Subject,
    resource?: Resource
  ): Promise<string[]> {
    const permissions: string[] = [];
    
    // Add role-based permissions
    if (subject.roles?.includes('admin')) {
      permissions.push('*');
    } else if (subject.roles?.includes('manager')) {
      permissions.push('workflows.*', 'nodes.read', 'executions.*');
    } else if (subject.roles?.includes('user')) {
      permissions.push('workflows.read', 'workflows.create', 'nodes.read');
    }
    
    // Add subject's direct permissions
    if (subject.permissions) {
      permissions.push(...subject.permissions);
    }
    
    return [...new Set(permissions)];
  }
  
  /**
   * Get authorization call history
   */
  getAuthorizationCalls() {
    return [...this.authorizationCalls];
  }
  
  /**
   * Clear call history
   */
  clearHistory() {
    this.authorizationCalls = [];
  }
  
  /**
   * Check if a specific authorization was called
   */
  wasAuthorized(
    resourceType: string,
    action: string,
    subjectId?: string
  ): boolean {
    return this.authorizationCalls.some(call => 
      call.resource.type === resourceType &&
      call.action === action &&
      (!subjectId || call.subject.id === subjectId)
    );
  }
  
  /**
   * Get calls for a specific resource
   */
  getCallsForResource(resourceType: string, resourceId?: string) {
    return this.authorizationCalls.filter(call =>
      call.resource.type === resourceType &&
      (!resourceId || call.resource.id === resourceId)
    );
  }
  
  /**
   * Set mock behavior
   */
  setMockBehavior(config: Partial<MockAuthConfig>) {
    Object.assign(this.mockConfig, config);
  }
  
  /**
   * Create mock subject
   */
  private createMockSubject(): Subject {
    return {
      id: 'mock-user',
      type: 'user',
      tenantId: this.mockConfig.tenantId || 'mock-tenant',
      ...this.mockConfig.defaultSubject
    };
  }
  
  /**
   * Evaluate mock policies
   */
  private evaluateMockPolicies(
    subject: Subject,
    resource: Resource,
    action: string
  ): AuthorizationResult {
    // Check tenant isolation
    if (resource.tenantId && resource.tenantId !== subject.tenantId) {
      return {
        allowed: false,
        reason: 'Tenant isolation violation'
      };
    }
    
    // Check ownership
    if (resource.ownerId && resource.ownerId === subject.id) {
      return {
        allowed: true,
        reason: 'Resource owner'
      };
    }
    
    // Check admin role
    if (subject.roles?.includes('admin')) {
      return {
        allowed: true,
        reason: 'Admin role'
      };
    }
    
    // Check specific permissions
    const requiredPermission = `${resource.type}.${action}`;
    const permissions = subject.permissions || [];
    
    if (permissions.includes(requiredPermission) || permissions.includes('*')) {
      return {
        allowed: true,
        reason: `Has permission: ${requiredPermission}`
      };
    }
    
    // Default deny
    return {
      allowed: false,
      reason: 'No matching policy'
    };
  }
}

/**
 * Create mock request context for testing
 */
export function createMockRequest(overrides: any = {}) {
  return {
    method: 'GET',
    path: '/api/workflows',
    headers: {
      authorization: 'Bearer mock-token',
      'content-type': 'application/json',
      ...overrides.headers
    },
    query: overrides.query || {},
    body: overrides.body || {},
    auth: {
      subject: {
        id: 'test-user',
        type: 'user' as const,
        tenantId: 'test-tenant',
        roles: ['user'],
        ...overrides.auth?.subject
      }
    },
    ...overrides
  };
}

/**
 * Create mock response for testing
 */
export function createMockResponse() {
  const headers: Record<string, string> = {};
  let statusCode = 200;
  let body: any = null;
  
  return {
    headers,
    statusCode,
    body,
    
    status(code: number) {
      statusCode = code;
      return this;
    },
    
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    
    json(data: any) {
      headers['content-type'] = 'application/json';
      body = data;
      return this;
    },
    
    send(data: any) {
      body = data;
      return this;
    },
    
    getStatus() {
      return statusCode;
    },
    
    getHeaders() {
      return { ...headers };
    },
    
    getBody() {
      return body;
    }
  };
}

/**
 * Test helper for authorization scenarios
 */
export class AuthTestHelper {
  private auth: MockZealAuth;
  
  constructor(auth: MockZealAuth) {
    this.auth = auth;
  }
  
  /**
   * Test tenant isolation
   */
  async testTenantIsolation(
    subject: Subject,
    resource: Resource
  ): Promise<boolean> {
    const result = await this.auth.authorize(subject, resource, 'read');
    
    if (resource.tenantId && resource.tenantId !== subject.tenantId) {
      return !result.allowed && result.reason?.includes('tenant');
    }
    
    return true;
  }
  
  /**
   * Test role-based access
   */
  async testRoleAccess(
    role: string,
    resource: Resource,
    action: string,
    shouldAllow: boolean
  ): Promise<boolean> {
    const subject: Subject = {
      id: 'test-user',
      type: 'user',
      roles: [role]
    };
    
    const result = await this.auth.authorize(subject, resource, action);
    return result.allowed === shouldAllow;
  }
  
  /**
   * Test permission-based access
   */
  async testPermissionAccess(
    permissions: string[],
    resource: Resource,
    action: string,
    shouldAllow: boolean
  ): Promise<boolean> {
    const subject: Subject = {
      id: 'test-user',
      type: 'user',
      permissions
    };
    
    const result = await this.auth.authorize(subject, resource, action);
    return result.allowed === shouldAllow;
  }
  
  /**
   * Test ownership-based access
   */
  async testOwnershipAccess(
    userId: string,
    resource: Resource,
    action: string
  ): Promise<boolean> {
    const subject: Subject = {
      id: userId,
      type: 'user'
    };
    
    const result = await this.auth.authorize(subject, resource, action);
    
    if (resource.ownerId === userId) {
      return result.allowed;
    }
    
    return true;
  }
  
  /**
   * Generate test cases for a resource
   */
  generateTestCases(resourceType: string): Array<{
    name: string;
    subject: Partial<Subject>;
    resource: Partial<Resource>;
    action: string;
    shouldAllow: boolean;
  }> {
    return [
      {
        name: 'Admin should have full access',
        subject: { roles: ['admin'] },
        resource: { type: resourceType as any },
        action: 'delete',
        shouldAllow: true
      },
      {
        name: 'User should read own resource',
        subject: { id: 'user-1', roles: ['user'] },
        resource: { type: resourceType as any, ownerId: 'user-1' },
        action: 'read',
        shouldAllow: true
      },
      {
        name: 'User should not read others resource',
        subject: { id: 'user-1', roles: ['user'] },
        resource: { type: resourceType as any, ownerId: 'user-2' },
        action: 'read',
        shouldAllow: false
      },
      {
        name: 'Tenant isolation should be enforced',
        subject: { tenantId: 'tenant-1' },
        resource: { type: resourceType as any, tenantId: 'tenant-2' },
        action: 'read',
        shouldAllow: false
      },
      {
        name: 'Same tenant access should be allowed',
        subject: { tenantId: 'tenant-1', roles: ['user'] },
        resource: { type: resourceType as any, tenantId: 'tenant-1' },
        action: 'read',
        shouldAllow: true
      }
    ];
  }
}

/**
 * Jest matchers for authorization
 */
export const authMatchers = {
  toBeAllowed(received: AuthorizationResult) {
    const pass = received.allowed === true;
    
    return {
      pass,
      message: () => pass
        ? `Expected authorization to be denied, but it was allowed`
        : `Expected authorization to be allowed, but it was denied: ${received.reason}`
    };
  },
  
  toBeDenied(received: AuthorizationResult) {
    const pass = received.allowed === false;
    
    return {
      pass,
      message: () => pass
        ? `Expected authorization to be allowed, but it was denied: ${received.reason}`
        : `Expected authorization to be denied, but it was allowed`
    };
  },
  
  toBeDeniedWithReason(received: AuthorizationResult, reason: string) {
    const pass = received.allowed === false && 
                 received.reason?.toLowerCase().includes(reason.toLowerCase());
    
    return {
      pass,
      message: () => pass
        ? `Expected authorization to not be denied with reason containing "${reason}"`
        : `Expected authorization to be denied with reason containing "${reason}", but got: ${received.reason}`
    };
  }
};

// Type augmentation for Jest
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeAllowed(): R;
      toBeDenied(): R;
      toBeDeniedWithReason(reason: string): R;
    }
  }
}