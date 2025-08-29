# Tenant Isolation in Zeal Authorization

## Overview

Tenant isolation in Zeal ensures that users from one tenant cannot access resources belonging to another tenant. This is critical for multi-tenant SaaS deployments where data security and privacy are paramount.

## How Tenant Isolation Works

### 1. Token-Based Tenant Identification

When a user authenticates, their JWT token must contain a `tenant_id` claim that identifies which tenant they belong to:

```json
{
  "sub": "user-123",
  "tenant_id": "tenant-abc",
  "org_id": "org-456",
  "roles": ["user"],
  "iat": 1234567890,
  "exp": 1234571490
}
```

### 2. Automatic Tenant Context Extraction

The authorization middleware automatically extracts the tenant ID from the JWT token:

```typescript
// In middleware.ts
const token = extractToken(req);
const subject = await auth.contextBuilder.extractSubject(token);
// subject.tenantId is now available for all authorization checks
```

### 3. Policy-Based Enforcement

Tenant isolation is enforced through a high-priority policy that runs before any other authorization check:

```yaml
- id: enforce-tenant-isolation
  description: "Enforce strict tenant isolation"
  priority: 9999  # Very high priority - runs first
  effect: deny
  resources:
    - type: "*"  # Applies to all resources
      conditions:
        - attribute: tenantId
          operator: exists  # If resource has a tenantId
        - attribute: tenantId
          operator: not_equals  # And it doesn't match user's tenantId
          value: "${subject.tenantId}"
  actions: ["*"]  # Block all actions
  subjects:
    conditions:
      - claim: tenantId
        operator: exists  # Only apply to users with a tenantId
```

This policy ensures that:
- If a resource has a `tenantId` attribute
- And the user has a `tenantId` in their token
- The user can only access the resource if the tenant IDs match

### 4. API-Level Implementation

#### REST API Endpoints

```typescript
// app/api/workflows/route.ts
export const GET = withAuth(
  async (req: AuthenticatedRequest) => {
    // User's tenant ID is automatically available
    const tenantId = req.auth?.subject?.tenantId;
    
    // Database queries automatically filtered by tenant
    const workflows = await WorkflowDatabase.listWorkflows({
      userId: req.auth?.subject?.id,
      tenantId: tenantId  // Only returns workflows for this tenant
    });
    
    // Additional filtering at application level
    const filtered = withTenantIsolation(workflows, req);
    
    return NextResponse.json(filtered);
  },
  { resource: 'workflow', action: 'read' }
);
```

#### ZIP Protocol Endpoints

```typescript
// app/api/zip/orchestrator/workflows/route.ts
export const POST = withZIPAuthorization(
  async (request: NextRequest) => {
    const userId = getAuthenticatedUserId(request);
    const tenantId = getTenantId(request);  // Extract from auth context
    
    // Create workflow with tenant association
    const workflow = await WorkflowDatabase.createWorkflow({
      ...data,
      userId,
      tenantId  // Automatically set from auth context
    });
    
    return NextResponse.json(workflow);
  },
  { resourceType: 'workflow', action: 'create' }
);
```

### 5. Database-Level Isolation

Resources in the database include a `tenant_id` column:

```sql
-- Workflows table
CREATE TABLE workflows (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  tenant_id VARCHAR(255),  -- Tenant association
  user_id VARCHAR(255),
  -- ... other columns
  INDEX idx_tenant (tenant_id)  -- Index for performance
);

-- Queries automatically filtered
SELECT * FROM workflows 
WHERE tenant_id = $1  -- From JWT token
AND user_id = $2;
```

### 6. Utility Functions for Tenant Isolation

#### Apply Tenant Filter

```typescript
// lib/auth/middleware.ts
export function withTenantIsolation<T extends { tenantId?: string }>(
  data: T | T[],
  req: AuthenticatedRequest
): T | T[] {
  const tenantId = req.auth?.subject?.tenantId;
  
  if (!tenantId) return data;  // No tenant context
  
  if (Array.isArray(data)) {
    // Filter array of resources
    return data.filter(item => 
      !item.tenantId ||  // No tenant (public)
      item.tenantId === tenantId  // Matches user's tenant
    );
  }
  
  // Single resource check
  if (data?.tenantId && data.tenantId !== tenantId) {
    throw new Error('Tenant isolation violation');
  }
  
  return data;
}
```

#### Get Tenant Context

```typescript
// lib/auth/zip-middleware.ts
export function getTenantId(req: NextRequest): string | undefined {
  const authContext = (req as any).authContext;
  return authContext?.subject?.tenantId;
}

export function applyTenantFilter<T extends { tenantId?: string }>(
  data: T[],
  req: NextRequest
): T[] {
  const tenantId = getTenantId(req);
  if (!tenantId) return data;
  
  return data.filter(item => 
    !item.tenantId || item.tenantId === tenantId
  );
}
```

## API Usage Examples

### 1. Creating a Resource (Auto-assigns Tenant)

```bash
# Request with JWT token containing tenant_id claim
curl -X POST https://api.zeal.com/api/workflows \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Workflow",
    "description": "Test workflow"
  }'

# Response - workflow automatically assigned to user's tenant
{
  "id": "workflow-123",
  "name": "My Workflow",
  "tenantId": "tenant-abc",  # Automatically set from JWT
  "userId": "user-123"
}
```

### 2. Listing Resources (Auto-filtered by Tenant)

```bash
# Request - JWT token has tenant_id: "tenant-abc"
curl -X GET https://api.zeal.com/api/workflows \
  -H "Authorization: Bearer <JWT_TOKEN>"

# Response - only workflows from tenant-abc
{
  "data": [
    {
      "id": "workflow-1",
      "name": "Workflow A",
      "tenantId": "tenant-abc"  # ✓ Same tenant
    },
    {
      "id": "workflow-2", 
      "name": "Workflow B",
      "tenantId": "tenant-abc"  # ✓ Same tenant
    }
    # Workflows from tenant-xyz are NOT returned
  ]
}
```

### 3. Accessing Another Tenant's Resource (Blocked)

```bash
# User from tenant-abc tries to access tenant-xyz's workflow
curl -X GET https://api.zeal.com/api/workflows/workflow-from-xyz \
  -H "Authorization: Bearer <JWT_TOKEN_TENANT_ABC>"

# Response - 403 Forbidden
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Access denied by policy: enforce-tenant-isolation",
    "reason": "Resource belongs to different tenant"
  }
}
```

### 4. Cross-Tenant Access (System Admin Only)

System administrators can bypass tenant isolation:

```yaml
# Policy for system admins
- id: system-admin-full-access
  priority: 10000  # Higher than tenant isolation
  effect: allow
  resources:
    - type: "*"
  actions: ["*"]
  subjects:
    conditions:
      - claim: roles
        operator: contains
        value: "system_admin"
```

```bash
# System admin can access any tenant's resources
curl -X GET https://api.zeal.com/api/workflows?all_tenants=true \
  -H "Authorization: Bearer <SYSTEM_ADMIN_TOKEN>"
```

## Configuration

### Environment Variables

```bash
# Enable authorization with tenant isolation
ZEAL_AUTH_ENABLED=true
ZEAL_AUTH_MODE=production

# JWT configuration
AUTH_JWT_ISSUER=https://your-idp.com
AUTH_JWT_AUDIENCE=https://api.your-app.com
AUTH_JWT_JWKS_URI=https://your-idp.com/.well-known/jwks.json

# Claim mapping for tenant ID
AUTH_CLAIM_TENANT=tenant_id  # JWT claim containing tenant ID
```

### Identity Provider Setup

Your identity provider must include the tenant ID in the JWT token. Examples:

#### Auth0
```javascript
// Auth0 Rule
function addTenantClaim(user, context, callback) {
  const namespace = 'https://your-app.com/';
  context.accessToken[namespace + 'tenant_id'] = user.app_metadata.tenant_id;
  callback(null, user, context);
}
```

#### AWS Cognito
```javascript
// Lambda trigger
exports.handler = async (event) => {
  event.response.claimsOverrideDetails = {
    claimsToAddOrOverride: {
      tenant_id: event.request.userAttributes['custom:tenant_id']
    }
  };
  return event;
};
```

#### Okta
```javascript
// Token inline hook
{
  "commands": [{
    "type": "com.okta.access.patch",
    "value": [{
      "op": "add",
      "path": "/claims/tenant_id",
      "value": user.profile.tenantId
    }]
  }]
}
```

## Multi-Tenancy Patterns

### 1. Shared Database, Row-Level Isolation (Default)
- All tenants share the same database
- Each row has a `tenant_id` column
- Queries filtered by tenant ID
- Most cost-effective for many small tenants

### 2. Schema-Per-Tenant (Advanced)
```typescript
// Can be configured with:
ZEAL_AUTH_SCHEMA_PER_TENANT=true
ZEAL_AUTH_SCHEMA_PREFIX=tenant_

// Creates schemas like: tenant_abc, tenant_xyz
```

### 3. Database-Per-Tenant (Enterprise)
```typescript
// Dynamic database connection based on tenant
const dbUrl = getDatabaseUrlForTenant(tenantId);
const db = new DatabaseConnection(dbUrl);
```

## Testing Tenant Isolation

### Development Mode

```bash
# Enable auth in development mode
ZEAL_AUTH_ENABLED=true
ZEAL_AUTH_MODE=development
ZEAL_DEV_TENANT_ID=test-tenant-1
ZEAL_DEV_USER_ID=test-user-1

# Test with different tenant
ZEAL_DEV_TENANT_ID=test-tenant-2
ZEAL_DEV_USER_ID=test-user-2
```

### Unit Tests

```typescript
describe('Tenant Isolation', () => {
  it('should filter resources by tenant', async () => {
    const req = mockRequest({
      auth: {
        subject: { tenantId: 'tenant-1' }
      }
    });
    
    const data = [
      { id: 1, tenantId: 'tenant-1' },  // Should be included
      { id: 2, tenantId: 'tenant-2' },  // Should be filtered
      { id: 3 }  // No tenant - should be included
    ];
    
    const filtered = withTenantIsolation(data, req);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].id).toBe(1);
    expect(filtered[1].id).toBe(3);
  });
});
```

## Troubleshooting

### Common Issues

1. **All requests return 403 Forbidden**
   - Check if JWT contains `tenant_id` claim
   - Verify claim mapping configuration
   - Check policy priority ordering

2. **Users see data from other tenants**
   - Ensure `ZEAL_AUTH_ENABLED=true`
   - Verify tenant isolation policy is active
   - Check database queries include tenant filter

3. **New resources missing tenant ID**
   - Ensure middleware extracts tenant from token
   - Set tenant ID when creating resources
   - Add database constraints to require tenant_id

### Debug Mode

```bash
# Enable auth debug logging
ZEAL_AUTH_DEBUG=true
ZEAL_AUTH_AUDIT_LEVEL=debug

# Logs will show:
# - Token claims including tenant_id
# - Policy evaluation for tenant isolation
# - Final authorization decision
```

## Security Best Practices

1. **Always validate tenant ID from token** - Never trust client-provided tenant IDs
2. **Use database constraints** - Add NOT NULL constraints on tenant_id columns
3. **Index tenant columns** - Ensure queries are performant with tenant filters
4. **Audit cross-tenant access** - Log when system admins access other tenants
5. **Test isolation regularly** - Include tenant isolation in your test suite
6. **Encrypt tenant IDs** - Consider encrypting tenant IDs in tokens
7. **Implement tenant deletion** - Ensure complete data removal for GDPR compliance

## See Also

- [Authorization Architecture](ZEAL_AUTH_ARCHITECTURE.md)
- [Policy Configuration](auth-policies.yaml)
- [API Documentation](docs/API.md)
- [Deployment Guide](deployments/README.md)