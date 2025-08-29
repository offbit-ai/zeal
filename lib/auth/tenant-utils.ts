/**
 * Tenant isolation utility functions
 * Ensures consistent tenant filtering across all API endpoints
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Extract tenant ID from authenticated request
 */
export function getTenantId(request: NextRequest): string | undefined {
  const authContext = (request as any).authContext;
  return authContext?.subject?.tenantId;
}

/**
 * Extract organization ID from authenticated request
 */
export function getOrganizationId(request: NextRequest): string | undefined {
  const authContext = (request as any).authContext;
  return authContext?.subject?.organizationId;
}

/**
 * Extract authenticated user ID from request
 */
export function getAuthenticatedUserId(request: NextRequest): string {
  const authContext = (request as any).authContext;
  if (!authContext?.subject?.id) {
    // Fallback for non-auth mode
    const headers = request.headers;
    return headers.get('x-user-id') || 'anonymous';
  }
  return authContext.subject.id;
}

/**
 * Apply tenant filter to a single resource
 */
export function applyTenantFilter<T extends { tenantId?: string }>(
  resource: T | null,
  tenantId: string | undefined
): T | null {
  if (!resource) return null;
  if (!tenantId) return resource; // No tenant context, return as-is
  
  // Check if resource belongs to the tenant
  if (resource.tenantId && resource.tenantId !== tenantId) {
    return null; // Resource belongs to different tenant
  }
  
  return resource;
}

/**
 * Apply tenant filter to an array of resources
 */
export function applyTenantFilterToArray<T extends { tenantId?: string }>(
  resources: T[],
  tenantId: string | undefined
): T[] {
  if (!tenantId) return resources; // No tenant context, return all
  
  return resources.filter(resource => {
    // Include resources without tenantId (public/legacy)
    if (!resource.tenantId) return true;
    // Include resources matching tenant
    return resource.tenantId === tenantId;
  });
}

/**
 * Add tenant context to a new resource
 */
export function addTenantContext<T extends object>(
  resource: T,
  request: NextRequest
): T & { tenantId?: string; organizationId?: string } {
  const tenantId = getTenantId(request);
  const organizationId = getOrganizationId(request);
  
  return {
    ...resource,
    ...(tenantId && { tenantId }),
    ...(organizationId && { organizationId })
  };
}

/**
 * Build database query with tenant filter
 */
export interface TenantQuery {
  tenantId?: string;
  organizationId?: string;
  userId?: string;
}

export function buildTenantQuery(request: NextRequest): TenantQuery {
  const tenantId = getTenantId(request);
  const organizationId = getOrganizationId(request);
  const userId = getAuthenticatedUserId(request);
  
  return {
    ...(tenantId && { tenantId }),
    ...(organizationId && { organizationId }),
    userId
  };
}

/**
 * Validate tenant access for a resource
 */
export function validateTenantAccess<T extends { tenantId?: string }>(
  resource: T,
  request: NextRequest
): boolean {
  const tenantId = getTenantId(request);
  
  // No tenant context - allow access
  if (!tenantId) return true;
  
  // Resource has no tenant - allow access (public/legacy)
  if (!resource.tenantId) return true;
  
  // Check if tenant matches
  return resource.tenantId === tenantId;
}

/**
 * Create error response for tenant isolation violation
 */
export function createTenantViolationError() {
  return NextResponse.json(
    {
      error: {
        code: 'FORBIDDEN',
        message: 'Access denied by tenant isolation policy',
        reason: 'Resource belongs to different tenant'
      }
    },
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Check if user has cross-tenant access (system admin)
 */
export function hasCrossTenantAccess(request: NextRequest): boolean {
  const authContext = (request as any).authContext;
  const roles = authContext?.subject?.roles || [];
  
  // Check for system admin role
  return roles.includes('system_admin') || roles.includes('super_admin');
}

/**
 * Get effective tenant for query (considering cross-tenant access)
 */
export function getEffectiveTenant(
  request: NextRequest,
  requestedTenant?: string
): string | undefined {
  const userTenant = getTenantId(request);
  
  // If user has cross-tenant access and requested specific tenant
  if (hasCrossTenantAccess(request) && requestedTenant) {
    return requestedTenant;
  }
  
  // Otherwise use user's tenant
  return userTenant;
}