/**
 * GraphQL directive for authorization
 */

import { defaultFieldResolver, GraphQLFieldConfig } from 'graphql';
import { ZealAuth } from '../index';
import { Resource } from '../types';

/**
 * Create authorization directive transformer
 */
export function createAuthDirective(auth: ZealAuth) {
  return (fieldConfig: GraphQLFieldConfig<any, any>, directiveArgs: any) => {
    const { resolve = defaultFieldResolver } = fieldConfig;
    const { resource, action, scope } = directiveArgs;
    
    fieldConfig.resolve = async function (...args: any[]) {
      const [parent, fieldArgs, context, info] = args;
      
      // Check if user is authenticated
      if (!context.auth?.subject) {
        throw new Error('Authentication required');
      }
      
      // Build resource object
      const resourceObj = buildResource(resource, parent, fieldArgs, context);
      
      // Perform authorization
      const result = await auth.authorize(
        context.auth.subject,
        resourceObj,
        action || inferActionFromField(info.fieldName)
      );
      
      if (!result.allowed) {
        throw new ForbiddenError(result.reason || 'Access denied');
      }
      
      // Apply scope restrictions if specified
      if (scope) {
        applyScopeRestrictions(scope, context, fieldArgs);
      }
      
      // Store authorization result in context for downstream use
      context.authResult = result;
      
      // Call original resolver
      const resolverResult = await resolve.apply(this, args);
      
      // Apply constraints to result if any
      if (result.constraints) {
        return applyConstraints(resolverResult, result.constraints);
      }
      
      return resolverResult;
    };
    
    return fieldConfig;
  };
}

/**
 * Create role requirement directive
 */
export function createRequireRoleDirective() {
  return (fieldConfig: GraphQLFieldConfig<any, any>, directiveArgs: any) => {
    const { resolve = defaultFieldResolver } = fieldConfig;
    const { roles, requireAll } = directiveArgs;
    
    fieldConfig.resolve = async function (...args: any[]) {
      const [, , context] = args;
      
      if (!context.auth?.subject) {
        throw new Error('Authentication required');
      }
      
      const userRoles = context.auth.subject.roles || [];
      
      let hasRole: boolean;
      if (requireAll) {
        hasRole = roles.every((role: string) => userRoles.includes(role));
      } else {
        hasRole = roles.some((role: string) => userRoles.includes(role));
      }
      
      if (!hasRole) {
        throw new ForbiddenError(
          `Required role${requireAll ? 's' : ''}: ${roles.join(', ')}`
        );
      }
      
      return resolve.apply(this, args);
    };
    
    return fieldConfig;
  };
}

/**
 * Create permission requirement directive
 */
export function createRequirePermissionDirective(auth: ZealAuth) {
  return (fieldConfig: GraphQLFieldConfig<any, any>, directiveArgs: any) => {
    const { resolve = defaultFieldResolver } = fieldConfig;
    const { permissions, requireAll } = directiveArgs;
    
    fieldConfig.resolve = async function (...args: any[]) {
      const [, , context] = args;
      
      if (!context.auth?.subject) {
        throw new Error('Authentication required');
      }
      
      const effectivePermissions = await auth.getEffectivePermissions(
        context.auth.subject
      );
      
      let hasPermission: boolean;
      if (requireAll) {
        hasPermission = permissions.every((p: string) => effectivePermissions.includes(p));
      } else {
        hasPermission = permissions.some((p: string) => effectivePermissions.includes(p));
      }
      
      if (!hasPermission) {
        throw new ForbiddenError(
          `Required permission${requireAll ? 's' : ''}: ${permissions.join(', ')}`
        );
      }
      
      return resolve.apply(this, args);
    };
    
    return fieldConfig;
  };
}

/**
 * Create tenant scoped directive
 */
export function createTenantScopedDirective() {
  return (fieldConfig: GraphQLFieldConfig<any, any>) => {
    const { resolve = defaultFieldResolver } = fieldConfig;
    
    fieldConfig.resolve = async function (...args: any[]) {
      const [parent, fieldArgs, context] = args;
      
      if (!context.auth?.subject?.tenantId) {
        throw new Error('Tenant context required');
      }
      
      // Add tenant filter to arguments
      const scopedArgs = {
        ...fieldArgs,
        where: {
          ...fieldArgs?.where,
          tenantId: context.auth.subject.tenantId
        }
      };
      
      // Update args
      args[1] = scopedArgs;
      
      const result = await resolve.apply(this, args);
      
      // Filter results by tenant
      if (Array.isArray(result)) {
        return result.filter((item: any) => 
          item.tenantId === context.auth.subject.tenantId
        );
      } else if (result && result.tenantId !== context.auth.subject.tenantId) {
        return null;
      }
      
      return result;
    };
    
    return fieldConfig;
  };
}

/**
 * Create secure field directive
 */
export function createSecureFieldDirective(auth: ZealAuth) {
  return (fieldConfig: GraphQLFieldConfig<any, any>, directiveArgs: any) => {
    const { resolve = defaultFieldResolver } = fieldConfig;
    const { minRole, minPermission, redact, mask } = directiveArgs;
    
    fieldConfig.resolve = async function (...args: any[]) {
      const [, , context] = args;
      
      if (!context.auth?.subject) {
        return redact ? '[REDACTED]' : null;
      }
      
      // Check role requirement
      if (minRole) {
        const roleHierarchy = ['viewer', 'user', 'manager', 'admin', 'superadmin'];
        const userRole = context.auth.subject.roles?.[0] || 'viewer';
        const userRoleIndex = roleHierarchy.indexOf(userRole);
        const requiredRoleIndex = roleHierarchy.indexOf(minRole);
        
        if (userRoleIndex < requiredRoleIndex) {
          return redact ? '[REDACTED]' : null;
        }
      }
      
      // Check permission requirement
      if (minPermission) {
        const permissions = await auth.getEffectivePermissions(
          context.auth.subject
        );
        
        if (!permissions.includes(minPermission)) {
          return redact ? '[REDACTED]' : null;
        }
      }
      
      const value = await resolve.apply(this, args);
      
      // Apply masking if configured
      if (mask && typeof value === 'string') {
        return maskValue(value, mask);
      }
      
      return value;
    };
    
    return fieldConfig;
  };
}

/**
 * Create rate limit directive
 */
export function createRateLimitDirective(rateLimiter: any) {
  return (fieldConfig: GraphQLFieldConfig<any, any>, directiveArgs: any) => {
    const { resolve = defaultFieldResolver } = fieldConfig;
    const { limit, window, keyBy } = directiveArgs;
    
    fieldConfig.resolve = async function (...args: any[]) {
      const [, fieldArgs, context] = args;
      
      // Determine rate limit key
      const key = getRateLimitKey(keyBy, context, fieldArgs);
      
      // Check rate limit
      const { allowed, remaining, resetAt } = await rateLimiter.isAllowed(
        key,
        limit,
        window
      );
      
      // Add rate limit info to response headers
      if (context.res) {
        context.res.setHeader('X-RateLimit-Limit', limit);
        context.res.setHeader('X-RateLimit-Remaining', remaining);
        context.res.setHeader('X-RateLimit-Reset', resetAt.toISOString());
      }
      
      if (!allowed) {
        throw new Error('Rate limit exceeded');
      }
      
      return resolve.apply(this, args);
    };
    
    return fieldConfig;
  };
}

// Helper functions

function buildResource(
  resourceType: string,
  parent: any,
  args: any,
  context: any
): Resource {
  const resource: Resource = {
    type: resourceType as any
  };
  
  // Try to get ID from various sources
  if (args?.id) {
    resource.id = args.id;
  } else if (parent?.id && resourceType !== 'Query' && resourceType !== 'Mutation') {
    resource.id = parent.id;
  }
  
  // Add parent context
  if (parent) {
    resource.attributes = {
      parentType: parent.__typename,
      parentId: parent.id
    };
  }
  
  // Add tenant context
  if (context.auth?.subject?.tenantId) {
    resource.tenantId = context.auth.subject.tenantId;
  }
  
  return resource;
}

function inferActionFromField(fieldName: string): string {
  // Queries
  if (fieldName.startsWith('get') || fieldName.startsWith('list') || fieldName.startsWith('find')) {
    return 'read';
  }
  
  // Mutations
  if (fieldName.startsWith('create') || fieldName.startsWith('add')) {
    return 'create';
  }
  if (fieldName.startsWith('update') || fieldName.startsWith('edit')) {
    return 'update';
  }
  if (fieldName.startsWith('delete') || fieldName.startsWith('remove')) {
    return 'delete';
  }
  if (fieldName.startsWith('execute') || fieldName.startsWith('run')) {
    return 'execute';
  }
  
  // Default
  return 'read';
}

function applyScopeRestrictions(scope: string, context: any, args: any): void {
  switch (scope) {
    case 'owned':
      args.where = {
        ...args.where,
        ownerId: context.auth.subject.id
      };
      break;
    
    case 'organization':
      args.where = {
        ...args.where,
        organizationId: context.auth.subject.organizationId
      };
      break;
    
    case 'team':
      args.where = {
        ...args.where,
        teamId: { in: context.auth.subject.teams || [] }
      };
      break;
  }
}

function applyConstraints(data: any, constraints: any): any {
  if (!constraints) return data;
  
  // Apply field restrictions
  if (constraints.fields && typeof data === 'object') {
    const filtered: any = {};
    for (const field of constraints.fields) {
      if (field in data) {
        filtered[field] = data[field];
      }
    }
    return filtered;
  }
  
  // Apply filters to arrays
  if (constraints.filters && Array.isArray(data)) {
    return data.filter((item: any) => {
      for (const [key, value] of Object.entries(constraints.filters)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  }
  
  // Apply max results
  if (constraints.maxResults && Array.isArray(data)) {
    return data.slice(0, constraints.maxResults);
  }
  
  return data;
}

function maskValue(value: string, maskType: string): string {
  switch (maskType) {
    case 'email':
      const [localPart, domain] = value.split('@');
      if (!domain) return '***';
      return `${localPart.substring(0, 2)}***@${domain}`;
    
    case 'phone':
      return value.replace(/\d(?=\d{4})/g, '*');
    
    case 'partial':
      const visibleLength = Math.min(4, Math.floor(value.length / 3));
      return value.substring(0, visibleLength) + '*'.repeat(value.length - visibleLength);
    
    default:
      return '*'.repeat(value.length);
  }
}

function getRateLimitKey(keyBy: string, context: any, args: any): string {
  switch (keyBy) {
    case 'ip':
      return context.ip || context.req?.ip || 'unknown';
    
    case 'user':
      return context.auth?.subject?.id || 'anonymous';
    
    case 'tenant':
      return context.auth?.subject?.tenantId || 'public';
    
    default:
      return `${context.auth?.subject?.id || 'anonymous'}_${context.ip || 'unknown'}`;
  }
}

class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Create GraphQL schema directives
 */
export function createAuthDirectives(auth: ZealAuth, rateLimiter?: any) {
  return {
    auth: createAuthDirective(auth),
    requireRole: createRequireRoleDirective(),
    requirePermission: createRequirePermissionDirective(auth),
    tenantScoped: createTenantScopedDirective(),
    secure: createSecureFieldDirective(auth),
    rateLimit: rateLimiter ? createRateLimitDirective(rateLimiter) : undefined
  };
}

/**
 * GraphQL type definitions for directives
 */
export const directiveTypeDefs = `
  directive @auth(
    resource: String!
    action: String
    scope: String
    requireAll: Boolean = false
  ) on FIELD_DEFINITION | OBJECT
  
  directive @requireRole(
    roles: [String!]!
    requireAll: Boolean = false
  ) on FIELD_DEFINITION
  
  directive @requirePermission(
    permissions: [String!]!
    requireAll: Boolean = false
  ) on FIELD_DEFINITION
  
  directive @tenantScoped on FIELD_DEFINITION
  
  directive @secure(
    minRole: String
    minPermission: String
    redact: Boolean = false
    mask: String
  ) on FIELD_DEFINITION
  
  directive @rateLimit(
    limit: Int!
    window: Int!
    keyBy: String = "user"
  ) on FIELD_DEFINITION
`;