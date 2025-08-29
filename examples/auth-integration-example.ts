/**
 * Zeal Auth Integration Examples
 * This file demonstrates how to use the authorization framework in your API routes
 */

// ========================================
// 1. BASIC PROTECTED API ROUTE
// ========================================

// app/api/workflows/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/middleware';
import { createSuccessResponse } from '@/lib/api-utils';

// Simple protected endpoint - just checks if user is authenticated
export const GET = withAuth(
  async (req) => {
    // req.auth is available here with user context
    const userId = req.auth?.subject.id;
    
    // Your business logic here
    const workflows = await getWorkflowsForUser(userId);
    
    return NextResponse.json(createSuccessResponse(workflows));
  }
);

// ========================================
// 2. RESOURCE-BASED AUTHORIZATION
// ========================================

// app/api/workflows/[id]/route.ts
import { withAuth } from '@/lib/auth/middleware';

export const PUT = withAuth(
  async (req) => {
    const workflowId = req.url.split('/').pop();
    const workflow = await getWorkflow(workflowId);
    
    // The auth middleware already checked if user can update this workflow
    // based on the policies defined in auth-policies.yaml
    
    const body = await req.json();
    const updated = await updateWorkflow(workflowId, body);
    
    return NextResponse.json(createSuccessResponse(updated));
  },
  {
    // Specify the resource type and action
    resource: (req) => ({
      type: 'workflow',
      id: req.url.split('/').pop(),
      attributes: {} // Will be populated from database
    }),
    action: 'update'
  }
);

// ========================================
// 3. ROLE-BASED ACCESS CONTROL
// ========================================

// app/api/admin/users/route.ts
import { withAuth, requireRole } from '@/lib/auth/middleware';
import { composeMiddleware } from '@/lib/auth/middleware';

// Admin-only endpoint using role middleware
export const GET = withAuth(
  composeMiddleware(
    requireRole('admin', 'super_admin'),
    async (req) => {
      const users = await getAllUsers();
      return NextResponse.json(createSuccessResponse(users));
    }
  )
);

// ========================================
// 4. PERMISSION-BASED ACCESS
// ========================================

// app/api/node-templates/premium/route.ts
import { withAuth, requirePermission } from '@/lib/auth/middleware';

export const POST = withAuth(
  composeMiddleware(
    requirePermission('node_template.premium.create'),
    async (req) => {
      const template = await req.json();
      const created = await createPremiumTemplate(template);
      return NextResponse.json(createSuccessResponse(created));
    }
  )
);

// ========================================
// 5. MULTI-TENANT DATA ISOLATION
// ========================================

// app/api/organizations/workflows/route.ts
import { withAuth, withTenantIsolation } from '@/lib/auth/middleware';

export const GET = withAuth(
  async (req) => {
    // Get all workflows for the tenant
    const allWorkflows = await getWorkflows();
    
    // Apply tenant isolation - filters out workflows from other tenants
    const tenantWorkflows = withTenantIsolation(allWorkflows, req);
    
    return NextResponse.json(createSuccessResponse(tenantWorkflows));
  }
);

// ========================================
// 6. FIELD-LEVEL ACCESS CONTROL
// ========================================

// app/api/workflows/[id]/details/route.ts
import { applyFieldConstraints } from '@/lib/auth/middleware';

export const GET = withAuth(
  async (req) => {
    const workflowId = req.url.split('/')[4];
    const workflow = await getWorkflow(workflowId);
    
    // Apply field constraints based on auth result
    // Removes sensitive fields if user doesn't have permission
    const filtered = applyFieldConstraints(
      workflow,
      req.auth?.result.constraints
    );
    
    return NextResponse.json(createSuccessResponse(filtered));
  },
  {
    resource: (req) => ({
      type: 'workflow',
      id: req.url.split('/')[4]
    }),
    action: 'read'
  }
);

// ========================================
// 7. CUSTOM AUTHORIZATION LOGIC
// ========================================

// app/api/workflows/[id]/execute/route.ts
export const POST = withAuth(
  async (req) => {
    const workflowId = req.url.split('/')[4];
    const workflow = await getWorkflow(workflowId);
    
    // Custom authorization check using claims
    const hasExecutionQuota = (req.auth?.subject.executionQuota || 0) > 0;
    if (!hasExecutionQuota) {
      throw new ApiError('QUOTA_EXCEEDED', 'Execution quota exceeded', 403);
    }
    
    // Check KYC level for production workflows
    if (workflow.environment === 'production') {
      const kycLevel = req.auth?.subject.kycLevel;
      if (kycLevel !== 'verified') {
        throw new ApiError(
          'KYC_REQUIRED',
          'KYC verification required for production workflows',
          403
        );
      }
    }
    
    const result = await executeWorkflow(workflowId);
    return NextResponse.json(createSuccessResponse(result));
  },
  {
    resource: 'workflow',
    action: 'execute'
  }
);

// ========================================
// 8. PUBLIC ENDPOINTS (NO AUTH)
// ========================================

// app/api/public/templates/route.ts
export const GET = withAuth(
  async (req) => {
    // This endpoint is public but we still wrap it with withAuth
    // to get user context if available
    const templates = await getPublicTemplates();
    
    // Enhance response if user is authenticated
    if (req.auth?.subject) {
      templates.forEach(t => {
        t.canEdit = t.owner === req.auth.subject.id;
      });
    }
    
    return NextResponse.json(createSuccessResponse(templates));
  },
  {
    skipAuth: true // Skip auth requirement but still extract token if present
  }
);

// ========================================
// 9. SERVICE ACCOUNT / API KEY
// ========================================

// app/api/automation/trigger/route.ts
export const POST = withAuth(
  async (req) => {
    // Service accounts authenticated via API key
    const isServiceAccount = req.auth?.subject.type === 'service';
    
    if (!isServiceAccount) {
      throw new ApiError(
        'SERVICE_ACCOUNT_REQUIRED',
        'This endpoint requires service account authentication',
        403
      );
    }
    
    const trigger = await req.json();
    const result = await triggerAutomation(trigger);
    
    return NextResponse.json(createSuccessResponse(result));
  }
);

// ========================================
// 10. USING AUTH IN SERVER ACTIONS
// ========================================

// lib/auth/server-actions.ts
import { getAuth } from '@/lib/auth';

export async function checkAuthInServerAction(token: string) {
  const auth = getAuth();
  
  if (auth && token) {
    const result = await auth.authorize(token, 'dashboard', 'read');
    
    if (!result.allowed) {
      return { allowed: false, message: 'Access Denied' };
    }
    
    // Get user context
    const subject = await auth.contextBuilder.extractSubject(token);
    
    return {
      allowed: true,
      user: {
        name: subject.name || subject.email,
        organizationId: subject.organizationId,
        roles: subject.roles
      }
    };
  }
  
  return { allowed: false, message: 'Please login' };
}

// ========================================
// 11. INITIALIZATION IN APP
// ========================================

// app/api/route.ts or middleware.ts
import { initializeAuth } from '@/lib/auth';

// Initialize auth on server startup
if (process.env.NODE_ENV === 'production') {
  initializeAuth().catch(console.error);
}

// ========================================
// 12. ENVIRONMENT CONFIGURATION EXAMPLE
// ========================================

/*
.env.local:

# Enable authorization
ZEAL_AUTH_ENABLED=true
ZEAL_AUTH_MODE=production

# Your identity provider (e.g., IDX)
AUTH_JWT_ISSUER=https://idx.your-domain.com
AUTH_JWT_AUDIENCE=https://api.zeal.your-domain.com
AUTH_JWT_JWKS_URI=https://idx.your-domain.com/.well-known/jwks.json

# Claim mappings
AUTH_CLAIM_SUBJECT_ID=sub
AUTH_CLAIM_TENANT=tenant_id
AUTH_CLAIM_ORGANIZATION=org_id
AUTH_CLAIM_ROLES=roles
AUTH_CLAIM_PERMISSIONS=permissions

# Custom claims for Zeal features
AUTH_CLAIM_WORKFLOW_QUOTA=limits.workflows
AUTH_CLAIM_EXECUTION_QUOTA=limits.executions
AUTH_CLAIM_COMPLIANCE_LEVEL=kyc.level

# Policies
ZEAL_AUTH_POLICIES_PATH=./auth-policies.yaml
ZEAL_AUTH_DEFAULT_EFFECT=deny

# Cache
ZEAL_AUTH_CACHE_ENABLED=true
ZEAL_AUTH_CACHE_TTL=300
*/

// ========================================
// 13. TESTING AUTH LOCALLY
// ========================================

// For development/testing
import { createTestAuthContext } from '@/lib/auth';

export const GET = withAuth(
  async (req) => {
    // In development mode, req.auth will have mock data
    // configured in .env.local (ZEAL_DEV_* variables)
    
    console.log('Auth context:', req.auth);
    
    return NextResponse.json({
      authenticated: true,
      user: req.auth?.subject
    });
  }
);

// ========================================
// 14. HANDLING AUTH ERRORS
// ========================================

// app/api/protected/route.ts
import { withAuth } from '@/lib/auth/middleware';
import { ApiError } from '@/types/api';

export const POST = withAuth(
  async (req) => {
    try {
      // Your business logic
      const data = await req.json();
      const result = await processData(data);
      
      return NextResponse.json(createSuccessResponse(result));
    } catch (error) {
      // Auth errors are already handled by middleware
      // This is for business logic errors
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new ApiError(
        'PROCESSING_ERROR',
        'Failed to process request',
        500,
        error.message
      );
    }
  }
);

// ========================================
// 15. DYNAMIC RESOURCE AUTHORIZATION
// ========================================

// app/api/resources/[type]/[id]/route.ts
export const GET = withAuth(
  async (req) => {
    const parts = req.url.split('/');
    const resourceType = parts[parts.length - 2];
    const resourceId = parts[parts.length - 1];
    
    // Dynamic resource loading
    const resource = await loadResource(resourceType, resourceId);
    
    return NextResponse.json(createSuccessResponse(resource));
  },
  {
    // Dynamic resource configuration
    resource: (req) => {
      const parts = req.url.split('/');
      return {
        type: parts[parts.length - 2],
        id: parts[parts.length - 1]
      };
    },
    action: (req) => {
      // Map HTTP methods to actions
      const methodMap = {
        GET: 'read',
        POST: 'create',
        PUT: 'update',
        DELETE: 'delete'
      };
      return methodMap[req.method] || 'unknown';
    }
  }
);

// ========================================
// Helper functions (implement these based on your needs)
// ========================================

async function getWorkflowsForUser(userId: string) {
  // Implementation
  return [];
}

async function getWorkflow(id: string) {
  // Implementation
  return {};
}

async function updateWorkflow(id: string, data: any) {
  // Implementation
  return {};
}

async function getAllUsers() {
  // Implementation
  return [];
}

async function createPremiumTemplate(template: any) {
  // Implementation
  return {};
}

async function getWorkflows() {
  // Implementation
  return [];
}

async function executeWorkflow(id: string) {
  // Implementation
  return {};
}

async function getPublicTemplates() {
  // Implementation
  return [];
}

async function triggerAutomation(trigger: any) {
  // Implementation
  return {};
}

async function processData(data: any) {
  // Implementation
  return {};
}

async function loadResource(type: string, id: string) {
  // Implementation
  return {};
}