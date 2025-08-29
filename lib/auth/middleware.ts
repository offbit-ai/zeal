/**
 * Authorization middleware for Next.js API routes
 */

import { NextRequest, NextResponse } from 'next/server';
import { ApiError } from '@/types/api';
import { createErrorResponse } from '@/lib/api-utils';
import { getAuth, extractToken, shouldBypassAuth } from './index';
import { Resource, AuthorizationResult } from '@offbit-ai/zeal-auth';

/**
 * Auth context that gets attached to the request
 */
export interface AuthContext {
  subject: any;
  token: string;
  result: AuthorizationResult;
  constraints?: any;
  obligations?: any;
  matchedPolicies?: any[];
  effectivePermissions?: string[];
}

/**
 * Extended NextRequest with auth context
 */
export interface AuthenticatedRequest extends NextRequest {
  auth?: AuthContext;
}

/**
 * Middleware to check authorization for API routes
 */
export function withAuth(
  handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>,
  options?: {
    resource?: string | ((req: NextRequest) => Resource);
    action?: string | ((req: NextRequest) => string);
    skipAuth?: boolean;
  }
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    // Check if auth should be bypassed
    if (options?.skipAuth || shouldBypassAuth(req.nextUrl.pathname)) {
      return handler(req as AuthenticatedRequest, context);
    }

    const auth = getAuth();
    
    // If auth is disabled, just call the handler
    if (!auth) {
      return handler(req as AuthenticatedRequest, context);
    }

    // Extract token
    const token = extractToken(req);
    if (!token) {
      const error = new ApiError('AUTH_REQUIRED', 'Authentication required', 401);
      return NextResponse.json(createErrorResponse(error), { status: 401 });
    }

    try {
      // Build resource from request or options
      const resource = typeof options?.resource === 'function'
        ? options.resource(req)
        : buildResourceFromRequest(req, options?.resource);

      // Determine action from method or options
      const action = typeof options?.action === 'function'
        ? options.action(req)
        : options?.action || mapMethodToAction(req.method);

      // Load resource attributes from database if needed
      if (resource.id && !resource.attributes?.owner) {
        const resourceData = await loadResourceAttributes(resource);
        resource.attributes = { ...resource.attributes, ...resourceData };
      }

      // Build authorization context with request metadata
      const context = {
        request: {
          method: req.method,
          path: req.nextUrl.pathname,
          ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
          userAgent: req.headers.get('user-agent')
        },
        environment: process.env.NODE_ENV,
        timestamp: new Date()
      };

      // Use ZealAuth to perform full policy-based authorization
      const result = await auth.authorize(token, resource, action);

      if (!result.allowed) {
        // Log denied access for audit
        if (auth.audit) {
          await auth.audit.log({
            type: 'AUTHORIZATION_DENIED',
            level: 'warn',
            subject: result.subject || { id: 'unknown', type: 'user' },
            resource,
            action,
            result,
            timestamp: new Date(),
            metadata: {
              matchedPolicies: result.matchedPolicies
            }
          });
        }

        const error = new ApiError(
          'FORBIDDEN',
          result.reason || 'Access denied',
          403,
          {
            resource: resource.type,
            action,
            deniedBy: result.matchedPolicies?.[0] || 'unknown'
          }
        );
        return NextResponse.json(createErrorResponse(error), { status: 403 });
      }

      // Extract full subject context
      const subject = result.subject;

      // Attach complete auth context to request
      const authenticatedReq = req as AuthenticatedRequest;
      authenticatedReq.auth = {
        subject,
        token,
        result,
        constraints: result.constraints,
        obligations: result.obligations,
        // Add matched policies for debugging
        matchedPolicies: result.matchedPolicies
      };

      // Call the handler with authenticated request
      const response = await handler(authenticatedReq, context);

      // Apply any obligations (e.g., audit logging)
      if (result.obligations) {
        await applyObligations(result.obligations, authenticatedReq, response);
      }

      return response;
    } catch (error: any) {
      console.error('Authorization error:', error);
      const apiError = new ApiError(
        'AUTH_ERROR',
        'Authorization failed',
        500,
        error.message
      );
      return NextResponse.json(createErrorResponse(apiError), { status: 500 });
    }
  };
}

/**
 * Middleware to require specific roles
 */
export function requireRole(...roles: string[]) {
  return async (req: AuthenticatedRequest): Promise<NextResponse | null> => {
    if (!req.auth?.subject) {
      const error = new ApiError('AUTH_REQUIRED', 'Authentication required', 401);
      return NextResponse.json(createErrorResponse(error), { status: 401 });
    }

    const userRoles = req.auth.subject.roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      const error = new ApiError(
        'FORBIDDEN',
        'Insufficient permissions',
        403,
        { requiredRoles: roles }
      );
      return NextResponse.json(createErrorResponse(error), { status: 403 });
    }

    return null; // Continue to next middleware/handler
  };
}

/**
 * Middleware to require specific permissions
 */
export function requirePermission(...permissions: string[]) {
  return async (req: AuthenticatedRequest): Promise<NextResponse | null> => {
    const auth = getAuth();
    if (!auth || !req.auth?.subject) {
      const error = new ApiError('AUTH_REQUIRED', 'Authentication required', 401);
      return NextResponse.json(createErrorResponse(error), { status: 401 });
    }

    // Use the policy engine to check permissions
    const permissionChecks = await Promise.all(
      permissions.map(permission => 
        auth.authorize(
          req.auth?.subject || { id: 'unknown', type: 'user' },
          { type: 'workflow', id: permission },
          'use'
        )
      )
    );
    
    const hasPermission = permissionChecks.some(result => result.allowed);

    if (!hasPermission) {
      const error = new ApiError(
        'FORBIDDEN',
        'Insufficient permissions',
        403,
        { requiredPermissions: permissions }
      );
      return NextResponse.json(createErrorResponse(error), { status: 403 });
    }

    return null; // Continue to next middleware/handler
  };
}

/**
 * Apply tenant isolation to queries
 */
export function withTenantIsolation<T extends { tenantId?: string }>(
  data: T | T[],
  req: AuthenticatedRequest
): T | T[] {
  if (!req.auth?.subject?.tenantId) {
    return data;
  }

  const tenantId = req.auth.subject.tenantId;

  if (Array.isArray(data)) {
    return data.filter(item => !item.tenantId || item.tenantId === tenantId);
  }

  if (data && typeof data === 'object' && data.tenantId && data.tenantId !== tenantId) {
    throw new Error('Tenant isolation violation');
  }

  return data;
}

/**
 * Apply field-level constraints to response data
 */
export function applyFieldConstraints<T>(
  data: T,
  constraints?: any
): T {
  if (!constraints?.fields || !data || typeof data !== 'object') {
    return data;
  }

  const filtered: any = {};
  for (const field of constraints.fields) {
    if (field in (data as any)) {
      filtered[field] = (data as any)[field];
    }
  }

  return filtered as T;
}

/**
 * Build resource from request
 */
function buildResourceFromRequest(req: NextRequest, resourceType?: string): Resource {
  const pathname = req.nextUrl.pathname;
  const segments = pathname.split('/').filter(Boolean);
  
  // Remove 'api' prefix
  if (segments[0] === 'api') {
    segments.shift();
  }

  // Determine resource type and ID
  const type = resourceType || segments[0] || 'unknown';
  const id = segments[1];

  return {
    type: type as any,
    id,
    attributes: {
      method: req.method,
      path: pathname,
      query: Object.fromEntries(req.nextUrl.searchParams),
      // These will be populated by loadResourceAttributes
      owner: undefined,
      organizationId: undefined,
      tenantId: undefined,
      visibility: undefined,
      status: undefined
    }
  };
}

/**
 * Load resource attributes from database
 */
async function loadResourceAttributes(resource: Resource): Promise<any> {
  // This should be implemented to load actual resource data
  // For now, return empty attributes
  
  if (resource.type === 'workflow' && resource.id) {
    try {
      const { WorkflowDatabase } = await import('@/services/workflowDatabase');
      const workflow = await WorkflowDatabase.getWorkflow(resource.id);
      
      if (workflow) {
        return {
          owner: (workflow as any).userId || workflow.id,
          organizationId: (workflow as any).organizationId,
          tenantId: (workflow as any).tenantId,
          visibility: (workflow as any).visibility || 'private',
          status: (workflow as any).status || 'active',
          createdAt: (workflow as any).createdAt || new Date().toISOString(),
          critical: (workflow as any).metadata?.critical || false
        };
      }
    } catch (error) {
      console.error('Failed to load workflow attributes:', error);
    }
  }
  
  if (resource.type === 'template' && resource.id) {
    // Load node template attributes
    return {
      tier: 'basic',
      restricted: false,
      category: 'general'
    };
  }
  
  return {};
}

/**
 * Map HTTP method to action
 */
function mapMethodToAction(method: string): string {
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
 * Apply obligations from authorization result
 */
async function applyObligations(
  obligations: any[],
  req: AuthenticatedRequest,
  response: NextResponse
): Promise<void> {
  const auth = getAuth();
  
  for (const obligation of obligations) {
    switch (obligation.type) {
      case 'audit':
        // Use ZealAuth's audit logger
        if (auth?.audit) {
          await auth.audit.log({
            type: 'RESOURCE_ACCESS',
            level: obligation.level || 'info',
            subject: req.auth?.subject || { id: 'unknown', type: 'user' },
            resource: { type: 'workflow', id: req.nextUrl.pathname },
            action: req.method.toLowerCase(),
            result: { allowed: true } as AuthorizationResult,
            timestamp: new Date(),
            metadata: obligation.metadata
          });
        }
        break;

      case 'log':
        console.log(`[AUTH OBLIGATION] ${obligation.action}:`, {
          subject: req.auth?.subject.id,
          resource: req.nextUrl.pathname,
          method: req.method
        });
        break;

      case 'notify':
        // Use notification service if configured
        if (obligation.channel && obligation.template) {
          // await notificationService.send(obligation);
        }
        break;

      case 'rate-limit':
        // Apply rate limiting
        response.headers.set('X-RateLimit-Limit', obligation.limit);
        response.headers.set('X-RateLimit-Remaining', obligation.remaining);
        break;

      case 'header':
        // Add response header
        if (obligation.params?.name && obligation.params?.value) {
          response.headers.set(obligation.params.name, obligation.params.value);
        }
        break;

      case 'filter':
        // Field filtering is handled separately
        break;
    }
  }
}

/**
 * Create a middleware chain
 */
export function composeMiddleware(
  ...middlewares: Array<(req: AuthenticatedRequest) => Promise<NextResponse | null>>
) {
  return async (req: AuthenticatedRequest): Promise<NextResponse> => {
    for (const middleware of middlewares) {
      const response = await middleware(req);
      if (response) {
        return response; // Middleware returned a response, stop chain
      }
    }
    
    // All middlewares passed, but no handler
    const error = new ApiError('NOT_FOUND', 'No handler found', 404);
    return NextResponse.json(createErrorResponse(error), { status: 404 });
  };
}