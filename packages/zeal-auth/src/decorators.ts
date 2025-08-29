/**
 * TypeScript decorators for authorization
 */

import 'reflect-metadata';
import { ZealAuth } from './index';
import { Resource } from './types';

// Metadata keys
const REQUIRE_AUTH_KEY = Symbol('require-auth');
const REQUIRE_ROLE_KEY = Symbol('require-role');
const REQUIRE_PERMISSION_KEY = Symbol('require-permission');
const AUTHORIZE_RESOURCE_KEY = Symbol('authorize-resource');

/**
 * Class decorator to apply authorization to all methods
 */
export function Authorized(auth: ZealAuth) {
  return function (target: any) {
    const prototype = target.prototype;
    const propertyNames = Object.getOwnPropertyNames(prototype);
    
    for (const propertyName of propertyNames) {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
      
      if (descriptor && typeof descriptor.value === 'function' && propertyName !== 'constructor') {
        const originalMethod = descriptor.value;
        
        descriptor.value = async function (...args: any[]) {
          // Get auth context from first argument (typically request)
          const req = args[0];
          if (!req?.auth?.subject) {
            throw new Error('Authentication required');
          }
          
          return originalMethod.apply(this, args);
        };
        
        Object.defineProperty(prototype, propertyName, descriptor);
      }
    }
    
    return target;
  };
}

/**
 * Method decorator to require authentication
 */
export function RequireAuth(auth: ZealAuth) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    Reflect.defineMetadata(REQUIRE_AUTH_KEY, true, target, propertyKey);
    
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const req = args[0];
      
      if (!req?.auth?.subject) {
        const token = extractToken(req);
        if (!token) {
          throw new Error('No authentication token provided');
        }
        
        // Validate token
        const subject = await auth.contextBuilder.extractSubject(token);
        req.auth = { subject };
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Method decorator to require specific roles
 */
export function RequireRole(...roles: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    Reflect.defineMetadata(REQUIRE_ROLE_KEY, roles, target, propertyKey);
    
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const req = args[0];
      
      if (!req?.auth?.subject) {
        throw new Error('Authentication required');
      }
      
      const hasRole = roles.some(role => 
        req.auth.subject.roles?.includes(role)
      );
      
      if (!hasRole) {
        throw new Error(`One of the following roles is required: ${roles.join(', ')}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Method decorator to require specific permissions
 */
export function RequirePermission(...permissions: string[]) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    Reflect.defineMetadata(REQUIRE_PERMISSION_KEY, permissions, target, propertyKey);
    
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const req = args[0];
      
      if (!req?.auth?.subject) {
        throw new Error('Authentication required');
      }
      
      const hasPermission = permissions.some(permission => 
        req.auth.subject.permissions?.includes(permission)
      );
      
      if (!hasPermission) {
        throw new Error(`One of the following permissions is required: ${permissions.join(', ')}`);
      }
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Method decorator for resource-based authorization
 */
export function AuthorizeResource(
  auth: ZealAuth,
  resourceType: string,
  action?: string
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    Reflect.defineMetadata(
      AUTHORIZE_RESOURCE_KEY,
      { resourceType, action },
      target,
      propertyKey
    );
    
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const req = args[0];
      
      if (!req?.auth?.subject) {
        throw new Error('Authentication required');
      }
      
      // Get resource ID from request
      const resourceId = req.params?.id || req.body?.id || args[1];
      
      const resource: Resource = {
        type: resourceType as any,
        id: resourceId,
        attributes: {
          method: req.method,
          path: req.path
        }
      };
      
      // Determine action from method name or parameter
      const finalAction = action || inferAction(propertyKey);
      
      const result = await auth.authorize(
        req.auth.subject,
        resource,
        finalAction
      );
      
      if (!result.allowed) {
        throw new Error(result.reason || 'Access denied');
      }
      
      // Attach authorization result
      req.auth.resourceAuth = result;
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Parameter decorator to inject auth subject
 */
export function AuthSubject(
  target: any,
  propertyKey: string | symbol,
  parameterIndex: number
) {
  const existingParams = Reflect.getOwnMetadata('auth-subjects', target, propertyKey) || [];
  existingParams.push(parameterIndex);
  Reflect.defineMetadata('auth-subjects', existingParams, target, propertyKey);
}

/**
 * Parameter decorator to inject auth constraints
 */
export function AuthConstraints(
  target: any,
  propertyKey: string | symbol,
  parameterIndex: number
) {
  const existingParams = Reflect.getOwnMetadata('auth-constraints', target, propertyKey) || [];
  existingParams.push(parameterIndex);
  Reflect.defineMetadata('auth-constraints', existingParams, target, propertyKey);
}

/**
 * Method decorator to apply constraints to response
 */
export function ApplyConstraints(auth: ZealAuth) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const req = args[0];
      const result = await originalMethod.apply(this, args);
      
      // Apply constraints if present
      if (req?.auth?.constraints) {
        return auth.applyConstraints(result, req.auth.constraints);
      }
      
      return result;
    };
    
    return descriptor;
  };
}

/**
 * Class decorator for controller-level authorization
 */
export function Controller(basePath: string, auth?: ZealAuth) {
  return function (target: any) {
    Reflect.defineMetadata('controller-path', basePath, target);
    
    if (auth) {
      Reflect.defineMetadata('controller-auth', auth, target);
    }
    
    return target;
  };
}

/**
 * Method decorator for route-level authorization
 */
export function Route(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options?: {
    requireAuth?: boolean;
    roles?: string[];
    permissions?: string[];
    resource?: string;
    action?: string;
  }
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    Reflect.defineMetadata('route-method', method, target, propertyKey);
    Reflect.defineMetadata('route-path', path, target, propertyKey);
    
    if (options) {
      Reflect.defineMetadata('route-options', options, target, propertyKey);
    }
    
    return descriptor;
  };
}

/**
 * Helper to extract token from request
 */
function extractToken(req: any): string | null {
  const authHeader = req.headers?.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  if (req.headers?.['x-api-key']) {
    return req.headers['x-api-key'];
  }
  
  if (req.query?.token) {
    return req.query.token;
  }
  
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  
  return null;
}

/**
 * Infer action from method name
 */
function inferAction(methodName: string): string {
  const patterns = [
    { pattern: /^(get|find|list|read|fetch)/, action: 'read' },
    { pattern: /^(create|add|insert|post)/, action: 'create' },
    { pattern: /^(update|edit|modify|patch|put)/, action: 'update' },
    { pattern: /^(delete|remove|destroy)/, action: 'delete' },
    { pattern: /^(execute|run|trigger)/, action: 'execute' },
    { pattern: /^(share|grant)/, action: 'share' }
  ];
  
  for (const { pattern, action } of patterns) {
    if (pattern.test(methodName.toLowerCase())) {
      return action;
    }
  }
  
  return 'unknown';
}

/**
 * Create a custom decorator factory
 */
export function createAuthDecorator(
  auth: ZealAuth,
  validator: (req: any, metadata: any) => Promise<boolean>
) {
  return function (metadata?: any) {
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      
      descriptor.value = async function (...args: any[]) {
        const req = args[0];
        
        const isValid = await validator(req, metadata);
        if (!isValid) {
          throw new Error('Authorization failed');
        }
        
        return originalMethod.apply(this, args);
      };
      
      return descriptor;
    };
  };
}

