/**
 * Builds authorization context from various inputs
 */

import { 
  AuthorizationContext, 
  Subject,
  Resource,
  ExternalClaims,
  Environment,
  RequestContext
} from './types';
import { ClaimMapper } from './claim-mapper';
import { HierarchyResolver } from './hierarchy-resolver';

export class ContextBuilder {
  constructor(
    private claimMapper: ClaimMapper,
    private hierarchyResolver: HierarchyResolver
  ) {}

  /**
   * Build complete authorization context
   */
  async build(
    tokenOrClaims: string | ExternalClaims | Subject,
    resource: Resource | string,
    action: string,
    request?: RequestContext
  ): Promise<AuthorizationContext> {
    // Extract subject
    const subject = await this.extractSubject(tokenOrClaims);
    
    // Normalize resource
    const normalizedResource = this.normalizeResource(resource);
    
    // Build environment context
    const environment = this.buildEnvironment(request);
    
    // Resolve hierarchy
    if (this.hierarchyResolver) {
      subject.hierarchy = await this.hierarchyResolver.resolve(subject);
      
      // Get effective permissions from hierarchy
      const hierarchyPermissions = await this.hierarchyResolver.getEffectivePermissions(subject);
      if (hierarchyPermissions.length > 0) {
        subject.permissions = [
          ...(subject.permissions || []),
          ...hierarchyPermissions
        ];
      }
    }
    
    return {
      subject,
      resource: normalizedResource,
      action,
      environment,
      request
    };
  }

  /**
   * Extract subject from various input types
   */
  async extractSubject(
    tokenOrClaims: string | ExternalClaims | Subject
  ): Promise<Subject> {
    // If already a Subject, return it
    if (this.isSubject(tokenOrClaims)) {
      return tokenOrClaims as Subject;
    }
    
    // Extract claims if token
    const claims = await this.claimMapper.extractClaims(
      tokenOrClaims as string | ExternalClaims
    );
    
    // Map to subject
    return this.claimMapper.mapToSubject(claims);
  }

  /**
   * Check if input is already a Subject
   */
  private isSubject(input: any): boolean {
    return input && 
           typeof input === 'object' && 
           'id' in input && 
           'type' in input;
  }

  /**
   * Normalize resource from various formats
   */
  private normalizeResource(resource: Resource | string): Resource {
    if (typeof resource === 'string') {
      // Parse resource string format: "type:id" or just "type"
      const parts = resource.split(':');
      return {
        type: parts[0] as any,
        id: parts[1]
      };
    }
    
    return resource;
  }

  /**
   * Build environment context
   */
  private buildEnvironment(request?: RequestContext): Environment {
    const env: Environment = {
      timestamp: new Date(),
      ipAddress: request?.ipAddress
    };
    
    // Add user agent if available
    if (request?.headers?.['user-agent']) {
      env.userAgent = request.headers['user-agent'];
    }
    
    // Add geolocation if available
    if (request?.headers?.['x-forwarded-for']) {
      env.ipAddress = request.headers['x-forwarded-for'].split(',')[0].trim();
    }
    
    // Add device info if available
    if (request?.headers?.['x-device-id']) {
      env.deviceId = request.headers['x-device-id'];
    }
    
    return env;
  }

  /**
   * Build context from HTTP request
   */
  async buildFromRequest(req: any): Promise<AuthorizationContext> {
    // Extract token from request
    const token = this.extractTokenFromRequest(req);
    if (!token) {
      throw new Error('No authentication token found');
    }
    
    // Build resource from request path
    const resource = this.buildResourceFromRequest(req);
    
    // Map HTTP method to action
    const action = this.mapHttpMethodToAction(req.method);
    
    // Build request context
    const request: RequestContext = {
      method: req.method,
      path: req.path || req.url,
      headers: req.headers,
      query: req.query,
      body: req.body,
      ipAddress: this.getClientIp(req)
    };
    
    return this.build(token, resource, action, request);
  }

  /**
   * Extract token from HTTP request
   */
  private extractTokenFromRequest(req: any): string | null {
    // Check Authorization header
    const authHeader = req.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    // Check custom headers
    if (req.headers?.['x-api-key']) {
      return req.headers['x-api-key'];
    }
    
    if (req.headers?.['x-auth-token']) {
      return req.headers['x-auth-token'];
    }
    
    // Check query parameters
    if (req.query?.token) {
      return req.query.token;
    }
    
    if (req.query?.apiKey) {
      return req.query.apiKey;
    }
    
    // Check cookies
    if (req.cookies?.token) {
      return req.cookies.token;
    }
    
    if (req.cookies?.sessionId) {
      return req.cookies.sessionId;
    }
    
    return null;
  }

  /**
   * Build resource from request
   */
  private buildResourceFromRequest(req: any): Resource {
    const path = req.path || req.url || '';
    const pathParts = path.split('/').filter(Boolean);
    
    // Common REST patterns
    if (pathParts.length >= 2) {
      // /api/workflows/123 -> { type: 'workflow', id: '123' }
      if (pathParts[0] === 'api') {
        return {
          type: this.singularize(pathParts[1]) as any,
          id: pathParts[2],
          attributes: {
            path,
            method: req.method
          }
        };
      }
      
      // /workflows/123 -> { type: 'workflow', id: '123' }
      return {
        type: this.singularize(pathParts[0]) as any,
        id: pathParts[1],
        attributes: {
          path,
          method: req.method
        }
      };
    }
    
    // Single resource path
    if (pathParts.length === 1) {
      return {
        type: this.singularize(pathParts[0]) as any,
        attributes: {
          path,
          method: req.method
        }
      };
    }
    
    // Default
    return {
      type: 'unknown',
      attributes: {
        path,
        method: req.method
      }
    };
  }

  /**
   * Map HTTP method to action
   */
  private mapHttpMethodToAction(method: string): string {
    const mapping: Record<string, string> = {
      GET: 'read',
      HEAD: 'read',
      OPTIONS: 'read',
      POST: 'create',
      PUT: 'update',
      PATCH: 'update',
      DELETE: 'delete'
    };
    
    return mapping[method.toUpperCase()] || 'unknown';
  }

  /**
   * Get client IP from request
   */
  private getClientIp(req: any): string | undefined {
    // Check various headers
    const headers = [
      'x-real-ip',
      'x-forwarded-for',
      'x-client-ip',
      'x-cluster-client-ip',
      'cf-connecting-ip' // Cloudflare
    ];
    
    for (const header of headers) {
      if (req.headers?.[header]) {
        const ip = req.headers[header];
        // Handle comma-separated IPs
        return ip.split(',')[0].trim();
      }
    }
    
    // Fallback to request connection
    return req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.ip;
  }

  /**
   * Convert plural to singular (simple implementation)
   */
  private singularize(word: string): string {
    const rules = [
      { plural: /ies$/, singular: 'y' },
      { plural: /ves$/, singular: 'f' },
      { plural: /oes$/, singular: 'o' },
      { plural: /ses$/, singular: 's' },
      { plural: /xes$/, singular: 'x' },
      { plural: /zes$/, singular: 'z' },
      { plural: /ches$/, singular: 'ch' },
      { plural: /shes$/, singular: 'sh' },
      { plural: /s$/, singular: '' }
    ];
    
    for (const rule of rules) {
      if (rule.plural.test(word)) {
        return word.replace(rule.plural, rule.singular);
      }
    }
    
    return word;
  }

  /**
   * Build context for batch operations
   */
  async buildBatch(
    subject: Subject,
    operations: Array<{
      resource: Resource | string;
      action: string;
    }>
  ): Promise<AuthorizationContext[]> {
    const contexts: AuthorizationContext[] = [];
    
    for (const op of operations) {
      const context = await this.build(
        subject,
        op.resource,
        op.action
      );
      contexts.push(context);
    }
    
    return contexts;
  }

  /**
   * Enrich context with additional data
   */
  async enrich(
    context: AuthorizationContext,
    enrichments: {
      resolveHierarchy?: boolean;
      fetchResourceDetails?: boolean;
      addEnvironment?: boolean;
    }
  ): Promise<AuthorizationContext> {
    const enriched = { ...context };
    
    // Resolve hierarchy if requested
    if (enrichments.resolveHierarchy && !enriched.subject.hierarchy) {
      enriched.subject.hierarchy = await this.hierarchyResolver.resolve(
        enriched.subject
      );
    }
    
    // Fetch resource details if requested
    if (enrichments.fetchResourceDetails && enriched.resource.id) {
      // This would typically call a service to get full resource details
      console.log(`Fetching details for ${enriched.resource.type}:${enriched.resource.id}`);
    }
    
    // Add environment if not present
    if (enrichments.addEnvironment && !enriched.environment) {
      enriched.environment = this.buildEnvironment();
    }
    
    return enriched;
  }

  /**
   * Validate context
   */
  validateContext(context: AuthorizationContext): boolean {
    // Check required fields
    if (!context.subject?.id) {
      console.error('Context missing subject ID');
      return false;
    }
    
    if (!context.resource?.type) {
      console.error('Context missing resource type');
      return false;
    }
    
    if (!context.action) {
      console.error('Context missing action');
      return false;
    }
    
    return true;
  }
}