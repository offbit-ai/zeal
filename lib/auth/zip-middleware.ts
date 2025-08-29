/**
 * ZIP Endpoint Authorization Middleware
 * Adds authorization to existing ZIP endpoints without modifying them
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, extractToken, shouldBypassAuth } from './index';
import { Resource, AuthorizationResult } from '@offbit-ai/zeal-auth';
import { ApiError } from '@/types/api';
import { createErrorResponse } from '@/lib/api-utils';

/**
 * ZIP endpoint auth wrapper
 * Wraps existing ZIP endpoints to add authorization
 */
export function withZIPAuthorization(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config?: {
    resourceType?: string;
    action?: string;
    extractResource?: (req: NextRequest) => Resource;
    skipAuth?: boolean;
  }
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    // Skip auth if disabled or public endpoint
    if (config?.skipAuth || shouldBypassAuth(request.nextUrl.pathname)) {
      return handler(request);
    }

    const auth = getAuth();
    if (!auth) {
      // Auth disabled globally
      return handler(request);
    }

    // Extract token from request
    const token = extractToken(request);
    
    // For ZIP endpoints, also check for SDK token in body
    let sdkToken: string | null = null;
    let sdkContext: any = null;
    
    try {
      const clonedReq = request.clone();
      const body = await clonedReq.json();
      
      // Check for SDK auth context in ZIP request
      if (body.auth?.token) {
        sdkToken = body.auth.token;
        sdkContext = body.auth;
      }
    } catch {
      // Not JSON or no body
    }
    
    const authToken = token || sdkToken;
    
    if (!authToken) {
      // Allow anonymous access for certain operations
      if (isAnonymousAllowed(request)) {
        return handler(request);
      }
      
      return NextResponse.json({
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentication required',
          traceId: `trace_${Date.now()}`
        }
      }, { status: 401 });
    }

    try {
      // Build resource from request
      const resource = config?.extractResource 
        ? config.extractResource(request)
        : buildZIPResource(request, config?.resourceType);
      
      // Determine action
      const action = config?.action || determineZIPAction(request);
      
      // Build context
      const context = {
        protocol: 'zip',
        endpoint: request.nextUrl.pathname,
        method: request.method,
        sdkVersion: sdkContext?.sdkVersion,
        applicationId: sdkContext?.applicationId,
        timestamp: new Date()
      };
      
      // Perform authorization
      const result = await auth.authorize(authToken, resource, action);
      
      if (!result.allowed) {
        // Log denied access
        if (auth.audit) {
          await auth.audit.log({
            type: 'ZIP_ACCESS_DENIED',
            level: 'warning',
            subject: result.subject || { id: 'unknown', type: 'user' },
            resource,
            action,
            result,
            timestamp: new Date(),
            metadata: context
          });
        }
        
        return NextResponse.json({
          error: {
            code: 'FORBIDDEN',
            message: result.reason || 'Access denied',
            traceId: `trace_${Date.now()}`,
            details: {
              resource: resource.type,
              action
            }
          }
        }, { status: 403 });
      }
      
      // Attach auth context to request for handler use
      (request as any).authContext = {
        subject: result.subject,
        token: authToken,
        result,
        sdkContext
      };
      
      // Apply any pre-handler obligations
      if (result.obligations) {
        for (const obligation of result.obligations) {
          // Custom handling for rate limiting (cast to any for extended properties)
          if ((obligation as any).type === 'rate-limit') {
            request.headers.set('X-RateLimit-Limit', (obligation as any).limit);
            request.headers.set('X-RateLimit-Remaining', (obligation as any).remaining);
          }
        }
      }
      
      // Call original handler
      const response = await handler(request);
      
      // Apply post-handler obligations
      if (result.obligations) {
        for (const obligation of result.obligations) {
          // Custom handling for audit obligations (cast to any for extended properties)
          if ((obligation as any).type === 'audit') {
            await auth.audit?.log({
              type: 'ZIP_ACCESS',
              level: (obligation as any).level || 'info',
              subject: result.subject || { id: 'unknown', type: 'user' },
              resource,
              action,
              result,
              timestamp: new Date(),
              metadata: {
                ...context,
                responseStatus: response.status
              }
            });
          }
        }
      }
      
      return response;
      
    } catch (error: any) {
      console.error('ZIP authorization error:', error);
      
      return NextResponse.json({
        error: {
          code: 'AUTH_ERROR',
          message: 'Authorization processing failed',
          traceId: `trace_${Date.now()}`
        }
      }, { status: 500 });
    }
  };
}

/**
 * Build resource from ZIP endpoint path
 */
function buildZIPResource(req: NextRequest, resourceType?: string): Resource {
  const path = req.nextUrl.pathname;
  const segments = path.split('/').filter(Boolean);
  
  // Remove 'api' and 'zip' prefixes
  if (segments[0] === 'api') segments.shift();
  if (segments[0] === 'zip') segments.shift();
  
  // Map ZIP endpoints to resources
  const resourceMap: Record<string, string> = {
    'orchestrator': 'orchestrator',
    'workflows': 'workflow',
    'nodes': 'node_template',
    'templates': 'node_template',
    'executions': 'execution',
    'traces': 'trace',
    'websocket': 'websocket',
    'webhooks': 'webhook',
    'connections': 'connection',
    'groups': 'group'
  };
  
  const type = resourceType || resourceMap[segments[0]] || segments[0] || 'unknown';
  const id = segments.find(s => s.match(/^[a-f0-9-]+$/i)); // Find UUID-like segment
  
  return {
    type: type as any,
    id,
    attributes: {
      endpoint: path,
      method: req.method,
      query: Object.fromEntries(req.nextUrl.searchParams)
    }
  };
}

/**
 * Determine action from ZIP endpoint and method
 */
function determineZIPAction(req: NextRequest): string {
  const method = req.method;
  const path = req.nextUrl.pathname;
  
  // Special cases based on path
  if (path.includes('/execute') || path.includes('/replay')) return 'execute';
  if (path.includes('/register')) return 'register';
  if (path.includes('/complete')) return 'complete';
  if (path.includes('/state')) return method === 'GET' ? 'read' : 'update';
  
  // Standard REST mapping
  const actionMap: Record<string, string> = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  };
  
  return actionMap[method] || 'unknown';
}

/**
 * Check if anonymous access is allowed for this endpoint
 */
function isAnonymousAllowed(req: NextRequest): boolean {
  const path = req.nextUrl.pathname;
  
  // Health checks and similar endpoints
  if (path.includes('/health')) return true;
  
  // Template listing might be public
  if (path.endsWith('/templates') && req.method === 'GET') return true;
  
  return false;
}

/**
 * Extract user ID from auth context or use default
 */
export function getAuthenticatedUserId(req: NextRequest): string {
  const authContext = (req as any).authContext;
  if (authContext?.subject?.id) {
    return authContext.subject.id;
  }
  
  // Fallback to ZIP integration user for backwards compatibility
  return 'zip-integration';
}

/**
 * Get organization ID from auth context
 */
export function getOrganizationId(req: NextRequest): string | undefined {
  const authContext = (req as any).authContext;
  return authContext?.subject?.organizationId;
}

/**
 * Check if user has specific permission
 */
export function hasPermission(req: NextRequest, permission: string): boolean {
  const authContext = (req as any).authContext;
  const permissions = authContext?.result?.effectivePermissions || [];
  return permissions.includes(permission);
}

/**
 * Apply tenant isolation to data
 */
export function applyTenantFilter<T extends { tenantId?: string }>(
  data: T[],
  req: NextRequest
): T[] {
  const authContext = (req as any).authContext;
  const tenantId = authContext?.subject?.tenantId;
  
  if (!tenantId) return data;
  
  return data.filter(item => !item.tenantId || item.tenantId === tenantId);
}