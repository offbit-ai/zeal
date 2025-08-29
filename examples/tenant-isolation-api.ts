/**
 * Example: Tenant Isolation at API Endpoints
 * This shows how tenant isolation is enforced across all API endpoints
 */

// ============================================
// 1. CREATE A WORKFLOW (with automatic tenant assignment)
// ============================================

// User from Tenant A creates a workflow
const createWorkflowTenantA = async () => {
  const response = await fetch('/api/workflows', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_TENANT_A>', // Token contains tenant_id: "tenant-a"
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Tenant A Workflow',
      description: 'This workflow belongs to Tenant A',
      graphs: [{
        id: 'main',
        name: 'Main Graph',
        isMain: true,
        nodes: [],
        connections: [],
        groups: []
      }]
    })
  })
  
  const result = await response.json()
  console.log('Created workflow:', {
    id: result.data.id,
    tenantId: result.data.tenantId, // Automatically set to "tenant-a"
    name: result.data.name
  })
  
  return result.data.id
}

// ============================================
// 2. LIST WORKFLOWS (automatically filtered by tenant)
// ============================================

// User from Tenant A only sees their workflows
const listWorkflowsTenantA = async () => {
  const response = await fetch('/api/workflows', {
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_TENANT_A>'
    }
  })
  
  const result = await response.json()
  console.log('Tenant A workflows:', result.data.length)
  // Only workflows with tenantId="tenant-a" or no tenantId (legacy) are returned
  
  result.data.forEach((workflow: any) => {
    console.log(`- ${workflow.name} (tenant: ${workflow.tenantId || 'legacy'})`)
  })
}

// User from Tenant B only sees their workflows
const listWorkflowsTenantB = async () => {
  const response = await fetch('/api/workflows', {
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_TENANT_B>' // Different tenant
    }
  })
  
  const result = await response.json()
  console.log('Tenant B workflows:', result.data.length)
  // Tenant A's workflows are NOT included
}

// ============================================
// 3. ACCESS SPECIFIC WORKFLOW (cross-tenant blocked)
// ============================================

const accessCrossTenantWorkflow = async (workflowId: string) => {
  // Tenant B tries to access Tenant A's workflow
  const response = await fetch(`/api/workflows/${workflowId}`, {
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_TENANT_B>'
    }
  })
  
  if (response.status === 403) {
    const error = await response.json()
    console.log('Access denied:', error.error)
    // {
    //   code: 'FORBIDDEN',
    //   message: 'Access denied by tenant isolation policy',
    //   reason: 'Resource belongs to different tenant'
    // }
  }
}

// ============================================
// 4. ENVIRONMENT VARIABLES (tenant-scoped)
// ============================================

const createEnvVarWithTenant = async () => {
  const response = await fetch('/api/env-vars', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_TENANT_A>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      key: 'API_KEY',
      value: 'secret-value',
      category: 'secrets'
    })
  })
  
  const result = await response.json()
  console.log('Created env var:', {
    key: result.data.key,
    tenantId: result.data.tenantId, // Automatically set to "tenant-a"
  })
}

// Each tenant has isolated environment variables
const listEnvVarsByTenant = async () => {
  // Tenant A sees only their env vars
  const responseA = await fetch('/api/env-vars', {
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_TENANT_A>'
    }
  })
  
  const tenantAVars = await responseA.json()
  console.log('Tenant A env vars:', tenantAVars.data.length)
  
  // Tenant B sees only their env vars
  const responseB = await fetch('/api/env-vars', {
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_TENANT_B>'
    }
  })
  
  const tenantBVars = await responseB.json()
  console.log('Tenant B env vars:', tenantBVars.data.length)
  
  // No overlap between tenants
}

// ============================================
// 5. ZIP PROTOCOL (SDK) WITH TENANT ISOLATION
// ============================================

const createWorkflowViaZIP = async () => {
  const response = await fetch('/api/zip/orchestrator/workflows', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_TENANT_A>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'ZIP Protocol Workflow',
      description: 'Created via ZIP SDK',
      metadata: {
        source: 'zip-sdk',
        version: '1.0.0'
      }
    })
  })
  
  const result = await response.json()
  console.log('ZIP workflow created:', {
    workflowId: result.workflowId,
    // Workflow is automatically assigned to tenant-a
  })
}

// ============================================
// 6. FALLBACK FOR LEGACY DATA (no tenant_id)
// ============================================

const handleLegacyResources = async () => {
  // Resources created before tenant isolation was added
  // have no tenantId field
  
  const response = await fetch('/api/workflows/legacy-workflow-id', {
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_ANY_TENANT>'
    }
  })
  
  if (response.ok) {
    const workflow = await response.json()
    
    if (!workflow.data.tenantId) {
      console.log('Legacy workflow - using ownership check')
      // Falls back to userId ownership check
      // Only the original creator can access it
    }
  }
}

// ============================================
// 7. SYSTEM ADMIN CROSS-TENANT ACCESS
// ============================================

const systemAdminAccess = async () => {
  // System admins can access any tenant's resources
  const response = await fetch('/api/workflows?all_tenants=true', {
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_SYSTEM_ADMIN>', // Has "system_admin" role
    }
  })
  
  const result = await response.json()
  console.log('All workflows across all tenants:', result.data.length)
  
  // Group by tenant for reporting
  const byTenant = result.data.reduce((acc: any, workflow: any) => {
    const tenant = workflow.tenantId || 'no-tenant'
    acc[tenant] = (acc[tenant] || 0) + 1
    return acc
  }, {})
  
  console.log('Workflows by tenant:', byTenant)
}

// ============================================
// 8. MIGRATION HANDLING
// ============================================

const migrateToTenantIsolation = async () => {
  // When tenant isolation is first enabled,
  // existing resources don't have tenantId
  
  // Option 1: Assign default tenant to all existing resources
  // This happens in the migration script
  
  // Option 2: Gradually assign tenants as resources are accessed
  const response = await fetch('/api/workflows/existing-id', {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer <JWT_TOKEN_TENANT_A>',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // Update adds tenantId automatically
      graphs: []
    })
  })
  
  if (response.ok) {
    const updated = await response.json()
    console.log('Workflow migrated to tenant:', updated.data.tenantId)
  }
}

// ============================================
// 9. ERROR HANDLING
// ============================================

const handleTenantErrors = async () => {
  try {
    // Attempt to access another tenant's resource
    const response = await fetch('/api/workflows/other-tenant-workflow', {
      headers: {
        'Authorization': 'Bearer <JWT_TOKEN_TENANT_A>'
      }
    })
    
    if (!response.ok) {
      const error = await response.json()
      
      switch (error.error.code) {
        case 'FORBIDDEN':
          if (error.error.message.includes('tenant isolation')) {
            console.error('Cannot access resource from different tenant')
            // Show appropriate UI message
          }
          break
          
        case 'AUTH_REQUIRED':
          console.error('Authentication required')
          // Redirect to login
          break
          
        case 'WORKFLOW_NOT_FOUND':
          console.error('Workflow does not exist')
          // Could be wrong ID or tenant isolation
          break
      }
    }
  } catch (err) {
    console.error('Request failed:', err)
  }
}

// ============================================
// 10. TENANT CONTEXT IN JWT TOKEN
// ============================================

interface JWTPayload {
  sub: string           // User ID
  tenant_id: string     // Tenant ID (required for isolation)
  org_id?: string       // Organization ID (optional)
  roles: string[]       // User roles
  permissions?: string[] // Specific permissions
  iat: number          // Issued at
  exp: number          // Expiration
}

// Example JWT payload for Tenant A user
const tenantAToken: JWTPayload = {
  sub: "user-123",
  tenant_id: "tenant-a",    // This determines tenant isolation
  org_id: "org-456",
  roles: ["user", "developer"],
  iat: Date.now() / 1000,
  exp: (Date.now() / 1000) + 3600
}

// Example JWT payload for System Admin
const systemAdminToken: JWTPayload = {
  sub: "admin-001",
  tenant_id: "admin-tenant",
  roles: ["system_admin"],   // This role bypasses tenant isolation
  iat: Date.now() / 1000,
  exp: (Date.now() / 1000) + 3600
}

// ============================================
// USAGE EXAMPLE
// ============================================

async function demonstrateTenantIsolation() {
  console.log('=== Tenant Isolation Demo ===\n')
  
  // 1. Create resources for Tenant A
  console.log('1. Creating Tenant A workflow...')
  const workflowId = await createWorkflowTenantA()
  
  // 2. List shows only Tenant A's workflows
  console.log('\n2. Listing Tenant A workflows...')
  await listWorkflowsTenantA()
  
  // 3. Tenant B cannot see Tenant A's workflows
  console.log('\n3. Listing Tenant B workflows...')
  await listWorkflowsTenantB()
  
  // 4. Cross-tenant access is blocked
  console.log('\n4. Tenant B trying to access Tenant A workflow...')
  await accessCrossTenantWorkflow(workflowId)
  
  // 5. Environment variables are isolated
  console.log('\n5. Creating tenant-specific env vars...')
  await createEnvVarWithTenant()
  await listEnvVarsByTenant()
  
  // 6. ZIP protocol respects tenant isolation
  console.log('\n6. Creating workflow via ZIP SDK...')
  await createWorkflowViaZIP()
  
  // 7. Legacy resources fallback to ownership
  console.log('\n7. Accessing legacy resources...')
  await handleLegacyResources()
  
  // 8. System admin can see everything
  console.log('\n8. System admin cross-tenant access...')
  await systemAdminAccess()
  
  console.log('\n=== Demo Complete ===')
}

// Run the demo
// demonstrateTenantIsolation()

export {
  createWorkflowTenantA,
  listWorkflowsTenantA,
  listWorkflowsTenantB,
  accessCrossTenantWorkflow,
  createEnvVarWithTenant,
  listEnvVarsByTenant,
  createWorkflowViaZIP,
  handleLegacyResources,
  systemAdminAccess,
  migrateToTenantIsolation,
  handleTenantErrors,
  demonstrateTenantIsolation
}