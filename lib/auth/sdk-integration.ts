/**
 * Zeal SDK Authorization Integration
 * Unified authorization for both SDK (ZIP) endpoints and regular APIs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuth, extractToken } from './index';
import { Resource, ResourceType as ZealResourceType, AuthorizationResult, Subject } from '@offbit-ai/zeal-auth';
import { ApiError } from '@/types/api';
import { createErrorResponse } from '@/lib/api-utils';

// ========================================
// SDK TOKEN CONTEXT
// ========================================

/**
 * SDK Authorization Context
 * Passed from SDK to ZIP endpoints
 */
export interface SDKAuthContext {
  // Token from the client application
  token: string;
  
  // SDK client information
  sdkVersion: string;
  sdkClientId: string;
  
  // Application context
  applicationId?: string;
  applicationName?: string;
  
  // Session information
  sessionId: string;
  deviceId?: string;
  
  // Additional claims collected by SDK
  customClaims?: Record<string, any>;
}

/**
 * ZIP Request with Auth
 * Enhanced ZIP request that includes authorization
 */
export interface ZIPRequestWithAuth {
  // Standard ZIP fields
  id: string;
  method: string;
  params?: any;
  
  // Authorization context from SDK
  auth: SDKAuthContext;
  
  // Resource context for authorization
  resource?: {
    type: ZealResourceType;
    id?: string;
    attributes?: Record<string, any>;
  };
  
  // Action being performed
  action?: string;
}

// ========================================
// SDK AUTHORIZATION MIDDLEWARE
// ========================================

/**
 * Authorize SDK requests through ZIP endpoints
 */
export async function authorizeSDKRequest(
  zipRequest: ZIPRequestWithAuth,
  endpoint: string
): Promise<AuthorizationResult> {
  const auth = getAuth();
  
  if (!auth) {
    // Auth disabled, allow all
    return {
      allowed: true,
      subject: { id: 'anonymous', type: 'user' } as Subject,
      matchedPolicies: [],
      metadata: {timestamp: new Date()}
    };
  }
  
  // Extract subject from SDK token
  const subject = await auth.contextBuilder.extractSubject(zipRequest.auth.token);
  
  // Enhance subject with SDK context
  const enhancedSubject: Subject = {
    ...subject,
    // Add SDK-specific attributes
    sdkVersion: zipRequest.auth.sdkVersion,
    sdkClientId: zipRequest.auth.sdkClientId,
    applicationId: zipRequest.auth.applicationId,
    sessionId: zipRequest.auth.sessionId,
    deviceId: zipRequest.auth.deviceId,
    // Merge custom claims
    ...zipRequest.auth.customClaims
  };
  
  // Determine resource from ZIP method and endpoint
  const resource = zipRequest.resource || buildResourceFromZIPMethod(
    zipRequest.method,
    endpoint,
    zipRequest.params
  );
  
  // Determine action from ZIP method
  const action = zipRequest.action || mapZIPMethodToAction(zipRequest.method);
  
  // Build audit metadata
  const auditMetadata = {
    protocol: 'zip',
    endpoint,
    method: zipRequest.method,
    sdkVersion: zipRequest.auth.sdkVersion,
    applicationId: zipRequest.auth.applicationId,
    timestamp: new Date()
  };
  
  // Perform authorization
  const result = await auth.authorize(enhancedSubject, resource, action);
  
  // Log SDK access for audit
  if (auth.audit && result.allowed) {
    await auth.audit.log({
      type: 'SDK_ACCESS',
      level: 'info',
      subject: enhancedSubject,
      resource,
      action,
      metadata: auditMetadata,
      timestamp: new Date(),
      result
    });
  }
  
  return result;
}

// ========================================
// ZIP ENDPOINT PROTECTION
// ========================================

/**
 * Middleware for ZIP endpoints
 */
export function withZIPAuth(
  handler: (req: NextRequest, zipRequest: ZIPRequestWithAuth) => Promise<NextResponse>,
  options?: {
    requireSDK?: boolean;
    minSDKVersion?: string;
    allowedApplications?: string[];
  }
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Parse ZIP request
      const body = await req.json();
      const zipRequest = body as ZIPRequestWithAuth;
      
      // Validate SDK requirements
      if (options?.requireSDK && !zipRequest.auth?.sdkVersion) {
        throw new ApiError('SDK_REQUIRED', 'This endpoint requires SDK authentication', 400);
      }
      
      if (options?.minSDKVersion && zipRequest.auth?.sdkVersion) {
        if (!isVersionSufficient(zipRequest.auth.sdkVersion, options.minSDKVersion)) {
          throw new ApiError(
            'SDK_VERSION_INSUFFICIENT',
            `SDK version ${options.minSDKVersion} or higher required`,
            400
          );
        }
      }
      
      if (options?.allowedApplications && zipRequest.auth?.applicationId) {
        if (!options.allowedApplications.includes(zipRequest.auth.applicationId)) {
          throw new ApiError(
            'APPLICATION_NOT_ALLOWED',
            'Application not authorized for this endpoint',
            403
          );
        }
      }
      
      // Perform authorization
      const endpoint = req.nextUrl.pathname;
      const authResult = await authorizeSDKRequest(zipRequest, endpoint);
      
      if (!authResult.allowed) {
        return NextResponse.json({
          id: zipRequest.id,
          error: {
            code: 'AUTHORIZATION_FAILED',
            message: authResult.reason || 'Access denied',
            data: {
              resource: zipRequest.resource?.type,
              action: zipRequest.action
            }
          }
        }, { status: 403 });
      }
      
      // Attach auth result to request for handler use
      (req as any).authResult = authResult;
      (req as any).zipRequest = zipRequest;
      
      // Call handler with authorized request
      return await handler(req, zipRequest);
      
    } catch (error) {
      if (error instanceof ApiError) {
        return NextResponse.json(createErrorResponse(error), { status: error.statusCode });
      }
      
      return NextResponse.json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Authorization processing failed'
        }
      }, { status: 500 });
    }
  };
}

// ========================================
// UNIFIED API PROTECTION
// ========================================

/**
 * Unified authorization for both REST and ZIP endpoints
 */
export function withUnifiedAuth(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options?: {
    resource?: string | ((req: NextRequest) => Resource);
    action?: string;
    protocol?: 'rest' | 'zip' | 'auto';
  }
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const protocol = options?.protocol || detectProtocol(req);
    
    if (protocol === 'zip') {
      // Handle as ZIP request
      return withZIPAuth(async (req, zipRequest) => {
        (req as any).auth = {
          subject: (req as any).authResult.subject,
          token: zipRequest.auth.token,
          result: (req as any).authResult
        };
        return handler(req);
      })(req);
    } else {
      // Handle as REST request
      const { withAuth } = await import('./middleware');
      return withAuth(handler, {
        resource: options?.resource,
        action: options?.action
      })(req);
    }
  };
}

// ========================================
// SDK CLIENT AUTHORIZATION
// ========================================

/**
 * SDK client authorization for direct use in SDK
 */
export class SDKAuthClient {
  private token: string;
  private sdkVersion: string;
  private applicationId?: string;
  private sessionId: string;
  
  constructor(config: {
    token: string;
    sdkVersion: string;
    applicationId?: string;
    sessionId?: string;
  }) {
    this.token = config.token;
    this.sdkVersion = config.sdkVersion;
    this.applicationId = config.applicationId;
    this.sessionId = config.sessionId || this.generateSessionId();
  }
  
  /**
   * Create auth context for ZIP requests
   */
  createAuthContext(customClaims?: Record<string, any>): SDKAuthContext {
    return {
      token: this.token,
      sdkVersion: this.sdkVersion,
      sdkClientId: this.getClientId(),
      applicationId: this.applicationId,
      sessionId: this.sessionId,
      deviceId: this.getDeviceId(),
      customClaims
    };
  }
  
  /**
   * Authorize a resource action locally (for pre-flight checks)
   */
  async preAuthorize(
    resource: Resource,
    action: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // This would make a call to a special endpoint that just checks authorization
    // without performing the action
    const response = await fetch('/api/auth/preauthorize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        resource,
        action,
        sdkContext: this.createAuthContext()
      })
    });
    
    return response.json();
  }
  
  /**
   * Wrap ZIP request with authorization
   */
  wrapRequest(request: any): ZIPRequestWithAuth {
    return {
      ...request,
      auth: this.createAuthContext(),
      resource: this.extractResourceFromRequest(request),
      action: this.extractActionFromRequest(request)
    };
  }
  
  private generateSessionId(): string {
    return `sdk-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private getClientId(): string {
    // Generate consistent client ID for this SDK instance
    return `sdk-client-${this.sdkVersion}-${this.applicationId || 'default'}`;
  }
  
  private getDeviceId(): string {
    // In browser environment, could use fingerprinting
    // In Node.js, could use machine ID
    return 'device-placeholder';
  }
  
  private extractResourceFromRequest(request: any): Resource | undefined {
    // Extract resource information from ZIP request
    if (request.method?.startsWith('workflow.')) {
      return {
        type: 'workflow',
        id: request.params?.id,
        attributes: request.params?.attributes
      };
    }
    
    if (request.method?.startsWith('node.')) {
      return {
        type: 'template',
        id: request.params?.templateId
      };
    }
    
    return undefined;
  }
  
  private extractActionFromRequest(request: any): string | undefined {
    // Map ZIP method to action
    const methodParts = request.method?.split('.') || [];
    const action = methodParts[methodParts.length - 1];
    
    const actionMap: Record<string, string> = {
      'get': 'read',
      'list': 'read',
      'create': 'create',
      'update': 'update',
      'delete': 'delete',
      'execute': 'execute',
      'subscribe': 'read',
      'publish': 'write'
    };
    
    return actionMap[action] || action;
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Build resource from ZIP method
 */
function buildResourceFromZIPMethod(
  method: string,
  endpoint: string,
  params?: any
): Resource {
  // Parse method like "workflow.execute" or "node.create"
  const [resourceType, action] = method.split('.');
  
  const typeMap: Record<string, any> = {
    'workflow': 'workflow',
    'node': 'node_template',
    'orchestrator': 'orchestrator',
    'execution': 'execution',
    'template': 'node_template'
  };
  
  return {
    type: typeMap[resourceType] || 'unknown',
    id: params?.id || params?.resourceId,
    attributes: {
      endpoint,
      method,
      ...params?.attributes
    }
  };
}

/**
 * Map ZIP method to action
 */
function mapZIPMethodToAction(method: string): string {
  const action = method.split('.').pop() || 'unknown';
  
  const actionMap: Record<string, string> = {
    'get': 'read',
    'list': 'read',
    'create': 'create',
    'update': 'update',
    'delete': 'delete',
    'execute': 'execute',
    'run': 'execute',
    'subscribe': 'read',
    'unsubscribe': 'read',
    'publish': 'write'
  };
  
  return actionMap[action] || action;
}

/**
 * Detect protocol from request
 */
function detectProtocol(req: NextRequest): 'rest' | 'zip' {
  // Check content type
  const contentType = req.headers.get('content-type');
  if (contentType?.includes('application/x-zip')) {
    return 'zip';
  }
  
  // Check for ZIP structure in body
  try {
    const clonedReq = req.clone();
    const body = clonedReq.json();
    if (body && typeof body === 'object' && 'method' in body && 'id' in body) {
      return 'zip';
    }
  } catch {
    // Not JSON or not ZIP structure
  }
  
  return 'rest';
}

/**
 * Check if SDK version is sufficient
 */
function isVersionSufficient(version: string, minVersion: string): boolean {
  const versionParts = version.split('.').map(Number);
  const minParts = minVersion.split('.').map(Number);
  
  for (let i = 0; i < minParts.length; i++) {
    if (versionParts[i] === undefined) return false;
    if (versionParts[i] > minParts[i]) return true;
    if (versionParts[i] < minParts[i]) return false;
  }
  
  return true;
}

