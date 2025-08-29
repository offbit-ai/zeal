/**
 * Zeal Authorization Framework
 * Main entry point and core authorization class
 */

import { 
  AuthConfig, 
  AuthorizationContext, 
  AuthorizationResult,
  Subject,
  Resource,
  ResourceType,
  ExternalClaims,
  PolicyConstraints
} from './types';
import { PolicyEngine } from './policy-engine';
import { ClaimMapper } from './claim-mapper';
import { HierarchyResolver } from './hierarchy-resolver';
import { AuthCache } from './cache';
import { AuditLogger } from './audit';
import { ContextBuilder } from './context-builder';

export * from './types';
export * from './middleware';
export * from './decorators';
export * from './providers/postgres';
export * from './providers/redis';
export * from './graphql/directive';
export * from './websocket';
export * from './testing/mock-auth';

export class ZealAuth {
  private policyEngine: PolicyEngine;
  private claimMapper: ClaimMapper;
  private hierarchyResolver: HierarchyResolver;
  public contextBuilder: ContextBuilder;
  private cache?: AuthCache;
  public audit?: AuditLogger;
  
  constructor(config: AuthConfig) {
    this.claimMapper = new ClaimMapper(config.claimMappings);
    this.hierarchyResolver = new HierarchyResolver(config.hierarchy);
    this.policyEngine = new PolicyEngine(config.policies);
    this.contextBuilder = new ContextBuilder(
      this.claimMapper,
      this.hierarchyResolver
    );
    
    if (config.cache?.enabled) {
      this.cache = new AuthCache(config.cache);
    }
    
    if (config.audit?.enabled) {
      this.audit = new AuditLogger(config.audit);
    }
  }
  
  /**
   * Main authorization method
   */
  async authorize(
    tokenOrClaims: string | ExternalClaims | Subject,
    resource: Resource | string,
    action: string
  ): Promise<AuthorizationResult> {
    const startTime = Date.now();
    
    try {
      // Build authorization context
      const context = await this.contextBuilder.build(
        tokenOrClaims,
        resource,
        action
      );
      
      // Check cache
      if (this.cache) {
        const cached = await this.cache.get(context);
        if (cached) {
          this.logAuthDecision(context, cached, startTime, true);
          return cached;
        }
      }
      
      // Evaluate policies
      const result = await this.policyEngine.evaluate(context);
      
      // Cache result
      if (this.cache && result.ttl) {
        await this.cache.set(context, result, result.ttl);
      }
      
      // Audit log
      this.logAuthDecision(context, result, startTime, false);
      
      return result;
    } catch (error) {
      const errorResult: AuthorizationResult = {
        allowed: false,
        reason: `Authorization error: ${error.message}`
      };
      
      this.logAuthDecision(
        { subject: { id: 'unknown', type: 'user' }, resource, action } as any,
        errorResult,
        startTime,
        false
      );
      
      throw error;
    }
  }
  
  /**
   * Authorize node usage in workflows
   */
  async authorizeNode(
    subject: Subject,
    nodeType: string,
    nodeConfig?: any
  ): Promise<AuthorizationResult> {
    const resource: Resource = {
      type: 'node',
      attributes: {
        nodeType,
        config: nodeConfig
      }
    };
    
    return this.authorize(subject, resource, 'use');
  }
  
  /**
   * Check if a workflow can be shared
   */
  async authorizeSharing(
    subject: Subject,
    workflow: Resource,
    targetPrincipal: string,
    targetPrincipalType: 'user' | 'team' | 'organization'
  ): Promise<AuthorizationResult> {
    const resource: Resource = {
      ...workflow,
      attributes: {
        ...workflow.attributes,
        targetPrincipal,
        targetPrincipalType
      }
    };
    
    return this.authorize(subject, resource, 'share');
  }
  
  /**
   * Build authorization context for a request
   */
  async buildContext(
    tokenOrClaims: string | ExternalClaims,
    resource?: Resource,
    action?: string
  ): Promise<AuthorizationContext> {
    return this.contextBuilder.build(
      tokenOrClaims,
      resource || { type: 'unknown' as ResourceType },
      action || 'unknown'
    );
  }
  
  /**
   * Validate and extract claims from a token
   */
  async validateToken(token: string): Promise<ExternalClaims> {
    return this.claimMapper.extractClaims(token);
  }
  
  /**
   * Get effective permissions for a subject
   */
  async getEffectivePermissions(
    subject: Subject,
    resource?: Resource
  ): Promise<string[]> {
    const permissions = new Set<string>();
    
    // Get permissions from hierarchy
    if (subject.hierarchy) {
      for (const level of subject.hierarchy) {
        if (level.permissions) {
          level.permissions.forEach(p => permissions.add(p));
        }
      }
    }
    
    // Get permissions from roles
    if (subject.roles) {
      const rolePermissions = await this.policyEngine.getRolePermissions(
        subject.roles
      );
      rolePermissions.forEach(p => permissions.add(p));
    }
    
    // Get resource-specific permissions
    if (resource?.sharedWith) {
      const shares = resource.sharedWith.filter(
        s => s.principalId === subject.id
      );
      shares.forEach(s => {
        s.permissions.forEach(p => permissions.add(p));
      });
    }
    
    return Array.from(permissions);
  }
  
  /**
   * Apply authorization constraints to data
   */
  applyConstraints<T>(
    data: T | T[],
    constraints?: PolicyConstraints
  ): T | T[] {
    if (!constraints) return data;
    
    const isArray = Array.isArray(data);
    const items = isArray ? data : [data];
    
    let filtered = items;
    
    // Apply filters
    if (constraints.filters) {
      filtered = filtered.filter(item => 
        this.matchesFilters(item, constraints.filters!)
      );
    }
    
    // Apply field restrictions
    if (constraints.fields) {
      filtered = filtered.map(item => 
        this.filterFields(item, constraints.fields!)
      );
    }
    
    // Apply max results
    if (constraints.maxResults && filtered.length > constraints.maxResults) {
      filtered = filtered.slice(0, constraints.maxResults);
    }
    
    return isArray ? filtered : filtered[0];
  }
  
  private matchesFilters(item: any, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      const itemValue = this.getNestedValue(item, key);
      
      if (Array.isArray(value)) {
        if (!value.includes(itemValue)) return false;
      } else if (itemValue !== value) {
        return false;
      }
    }
    return true;
  }
  
  private filterFields(item: any, allowedFields: string[]): any {
    const filtered: any = {};
    
    for (const field of allowedFields) {
      const value = this.getNestedValue(item, field);
      if (value !== undefined) {
        this.setNestedValue(filtered, field, value);
      }
    }
    
    return filtered;
  }
  
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, part) => current?.[part], obj);
  }
  
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    
    const target = parts.reduce((current, part) => {
      if (!current[part]) current[part] = {};
      return current[part];
    }, obj);
    
    target[last] = value;
  }
  
  private logAuthDecision(
    context: AuthorizationContext,
    result: AuthorizationResult,
    startTime: number,
    fromCache: boolean
  ): void {
    if (!this.audit) return;
    
    const duration = Date.now() - startTime;
    
    this.audit.log({
      timestamp: new Date(),
      subject: context.subject,
      resource: context.resource,
      action: typeof context.action === 'string' ? context.action : context.action.name,
      result,
      duration,
      fromCache,
      environment: context.environment,
      level: 'info'
    });
  }
  
  /**
   * Express/Fastify middleware
   */
  middleware() {
    return async (req: any, res: any, next: any) => {
      try {
        // Extract token
        const token = this.extractToken(req);
        if (!token) {
          return res.status(401).json({ error: 'No token provided' });
        }
        
        // Build resource from request
        const resource = this.buildResourceFromRequest(req);
        const action = this.mapHttpMethodToAction(req.method);
        
        // Authorize
        const result = await this.authorize(token, resource, action);
        
        if (!result.allowed) {
          return res.status(403).json({
            error: 'Access denied',
            reason: result.reason
          });
        }
        
        // Attach auth context
        req.authContext = {
          subject: await this.contextBuilder.extractSubject(token),
          constraints: result.constraints,
          obligations: result.obligations
        };
        
        next();
      } catch (error) {
        res.status(500).json({
          error: 'Authorization error',
          message: error.message
        });
      }
    };
  }
  
  private extractToken(req: any): string | null {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check custom header
    if (req.headers['x-api-key']) {
      return req.headers['x-api-key'];
    }
    
    // Check query parameter
    if (req.query.token) {
      return req.query.token;
    }
    
    // Check cookie
    if (req.cookies?.token) {
      return req.cookies.token;
    }
    
    return null;
  }
  
  private buildResourceFromRequest(req: any): Resource {
    const pathParts = req.path.split('/').filter(Boolean);
    
    // Derive resource type from path
    const resourceType = pathParts[0] || 'unknown';
    const resourceId = pathParts[1];
    
    return {
      type: resourceType as any,
      id: resourceId,
      attributes: {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body
      }
    };
  }
  
  private mapHttpMethodToAction(method: string): string {
    const mapping: Record<string, string> = {
      GET: 'read',
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete'
    };
    
    return mapping[method.toUpperCase()] || 'unknown';
  }
}