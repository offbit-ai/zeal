/**
 * Express/Fastify middleware for authorization
 */

import { ZealAuth } from './index';
import { Resource } from './types';

/**
 * Create Express middleware
 */
export function createExpressMiddleware(
  auth: ZealAuth,
  options?: {
    extractToken?: (req: any) => string | null;
    buildResource?: (req: any) => Resource;
    mapAction?: (method: string) => string;
    errorHandler?: (error: any, req: any, res: any) => void;
  }
) {
  return async (req: any, res: any, next: any) => {
    try {
      // Extract token
      const extractToken = options?.extractToken || defaultExtractToken;
      const token = extractToken(req);
      
      if (!token) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'No authentication token provided' 
        });
      }
      
      // Build resource
      const buildResource = options?.buildResource || defaultBuildResource;
      const resource = buildResource(req);
      
      // Map action
      const mapAction = options?.mapAction || defaultMapAction;
      const action = mapAction(req.method);
      
      // Authorize
      const result = await auth.authorize(token, resource, action);
      
      if (!result.allowed) {
        return res.status(403).json({
          error: 'Forbidden',
          message: result.reason || 'Access denied'
        });
      }
      
      // Attach auth context to request
      req.auth = {
        subject: await auth.contextBuilder.extractSubject(token),
        result,
        constraints: result.constraints,
        obligations: result.obligations
      };
      
      next();
    } catch (error: any) {
      if (options?.errorHandler) {
        options.errorHandler(error, req, res);
      } else {
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Authorization error occurred'
        });
      }
    }
  };
}

/**
 * Create Fastify plugin
 */
export function createFastifyPlugin(auth: ZealAuth) {
  return async function (fastify: any, opts: any) {
    fastify.decorateRequest('auth', null);
    
    fastify.addHook('preHandler', async (request: any, reply: any) => {
      try {
        const token = defaultExtractToken(request);
        
        if (!token) {
          reply.code(401).send({ 
            error: 'Unauthorized',
            message: 'No authentication token provided' 
          });
          return;
        }
        
        const resource = defaultBuildResource(request);
        const action = defaultMapAction(request.method);
        
        const result = await auth.authorize(token, resource, action);
        
        if (!result.allowed) {
          reply.code(403).send({
            error: 'Forbidden',
            message: result.reason || 'Access denied'
          });
          return;
        }
        
        request.auth = {
          subject: await auth.contextBuilder.extractSubject(token),
          result,
          constraints: result.constraints,
          obligations: result.obligations
        };
      } catch (error) {
        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Authorization error occurred'
        });
      }
    });
  };
}

/**
 * Create Koa middleware
 */
export function createKoaMiddleware(auth: ZealAuth) {
  return async (ctx: any, next: any) => {
    try {
      const token = defaultExtractToken(ctx.request);
      
      if (!token) {
        ctx.status = 401;
        ctx.body = { 
          error: 'Unauthorized',
          message: 'No authentication token provided' 
        };
        return;
      }
      
      const resource = defaultBuildResource(ctx.request);
      const action = defaultMapAction(ctx.method);
      
      const result = await auth.authorize(token, resource, action);
      
      if (!result.allowed) {
        ctx.status = 403;
        ctx.body = {
          error: 'Forbidden',
          message: result.reason || 'Access denied'
        };
        return;
      }
      
      ctx.auth = {
        subject: await auth.contextBuilder.extractSubject(token),
        result,
        constraints: result.constraints,
        obligations: result.obligations
      };
      
      await next();
    } catch (error) {
      ctx.status = 500;
      ctx.body = {
        error: 'Internal Server Error',
        message: 'Authorization error occurred'
      };
    }
  };
}

/**
 * Create Next.js API route middleware
 */
export function createNextApiMiddleware(auth: ZealAuth) {
  return (handler: any) => async (req: any, res: any) => {
    try {
      const token = defaultExtractToken(req);
      
      if (!token) {
        return res.status(401).json({ 
          error: 'Unauthorized',
          message: 'No authentication token provided' 
        });
      }
      
      const resource = defaultBuildResource(req);
      const action = defaultMapAction(req.method);
      
      const result = await auth.authorize(token, resource, action);
      
      if (!result.allowed) {
        return res.status(403).json({
          error: 'Forbidden',
          message: result.reason || 'Access denied'
        });
      }
      
      req.auth = {
        subject: await auth.contextBuilder.extractSubject(token),
        result,
        constraints: result.constraints,
        obligations: result.obligations
      };
      
      return handler(req, res);
    } catch (error) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Authorization error occurred'
      });
    }
  };
}

/**
 * Role-based middleware
 */
export function requireRole(auth: ZealAuth, ...roles: string[]) {
  return async (req: any, res: any, next: any) => {
    if (!req.auth?.subject) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
    }
    
    const hasRole = roles.some(role => 
      req.auth.subject.roles?.includes(role)
    );
    
    if (!hasRole) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `One of the following roles is required: ${roles.join(', ')}`
      });
    }
    
    next();
  };
}

/**
 * Permission-based middleware
 */
export function requirePermission(auth: ZealAuth, ...permissions: string[]) {
  return async (req: any, res: any, next: any) => {
    if (!req.auth?.subject) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
    }
    
    const effectivePermissions = await auth.getEffectivePermissions(
      req.auth.subject
    );
    
    const hasPermission = permissions.some(permission => 
      effectivePermissions.includes(permission)
    );
    
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: `One of the following permissions is required: ${permissions.join(', ')}`
      });
    }
    
    next();
  };
}

/**
 * Resource-specific middleware
 */
export function authorizeResource(
  auth: ZealAuth,
  resourceType: string,
  action: string
) {
  return async (req: any, res: any, next: any) => {
    if (!req.auth?.subject) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Authentication required' 
      });
    }
    
    // Get resource ID from params or body
    const resourceId = req.params?.id || req.body?.id;
    
    const resource: Resource = {
      type: resourceType as any,
      id: resourceId,
      attributes: {
        method: req.method,
        path: req.path
      }
    };
    
    const result = await auth.authorize(
      req.auth.subject,
      resource,
      action
    );
    
    if (!result.allowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: result.reason || 'Access denied'
      });
    }
    
    // Update auth context with specific authorization
    req.auth.resourceAuth = result;
    
    next();
  };
}

/**
 * Default token extractor
 */
function defaultExtractToken(req: any): string | null {
  // Check Authorization header
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Check custom headers
  if (req.headers?.['x-api-key']) {
    return req.headers['x-api-key'];
  }
  
  // Check query parameters
  if (req.query?.token) {
    return req.query.token;
  }
  
  // Check cookies
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  
  return null;
}

/**
 * Default resource builder
 */
function defaultBuildResource(req: any): Resource {
  const path = req.path || req.url || req.originalUrl || '';
  const pathParts = path.split('/').filter(Boolean);
  
  // Remove 'api' prefix if present
  if (pathParts[0] === 'api') {
    pathParts.shift();
  }
  
  const resourceType = pathParts[0] || 'unknown';
  const resourceId = pathParts[1];
  
  return {
    type: resourceType as any,
    id: resourceId,
    attributes: {
      path,
      method: req.method,
      query: req.query,
      headers: req.headers
    }
  };
}

/**
 * Default action mapper
 */
function defaultMapAction(method: string): string {
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