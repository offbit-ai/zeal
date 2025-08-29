import { NextRequest, NextResponse } from 'next/server'
import { EmbedApiKeyService } from '@/services/embedApiKeyService'
import { z } from 'zod'
import { getDatabaseOperations } from '@/lib/database'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError, addTenantContext, getAuthenticatedUserId } from '@/lib/auth/tenant-utils'

// Schema for creating API key
const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  permissions: z.object({
    canAddNodes: z.boolean(),
    canEditNodes: z.boolean(),
    canDeleteNodes: z.boolean(),
    canAddGroups: z.boolean(),
    canEditGroups: z.boolean(),
    canDeleteGroups: z.boolean(),
    canExecute: z.boolean(),
    canViewWorkflow: z.boolean(),
    canExportData: z.boolean(),
    allowedNodeTypes: z.array(z.string()).optional(),
    maxNodes: z.number().optional(),
    maxGroups: z.number().optional(),
  }),
  expiresAt: z.string().optional(),
  rateLimits: z
    .object({
      requestsPerMinute: z.number(),
      requestsPerHour: z.number(),
      requestsPerDay: z.number(),
      executionsPerHour: z.number(),
      executionsPerDay: z.number(),
    })
    .optional(),
})

// GET /api/workflows/[id]/embed/api-keys - List API keys
export const GET = withAuth(async (request: AuthenticatedRequest, context?: { params: { id: string } }) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Missing workflow ID' }, { status: 400 })
    }
    const { id: workflowId } = context.params
    const userId = getAuthenticatedUserId(request as NextRequest)

    // Verify user owns this workflow
    const db = await getDatabaseOperations()
    const workflow = await db.getWorkflow(workflowId)
    
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Check tenant access
    if ((workflow as any).tenantId && !validateTenantAccess(workflow as any, request as NextRequest)) {
      return createTenantViolationError()
    }

    const apiKeys = await EmbedApiKeyService.listApiKeys(workflowId)

    // Remove sensitive data (hashed keys)
    const sanitizedKeys = apiKeys.map(key => ({
      ...key,
      key: undefined, // Don't expose hashed keys
      keyPreview: `${key.id.substring(0, 8)}...`, // Show partial ID as preview
    }))

    return NextResponse.json({ apiKeys: sanitizedKeys })
  } catch (error) {
    console.error('Error listing API keys:', error)
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 })
  }
}, {
  resource: 'workflow',
  action: 'read'
})

// POST /api/workflows/[id]/embed/api-keys - Create new API key
export const POST = withAuth(async (request: AuthenticatedRequest, context?: { params: { id: string } }) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Missing workflow ID' }, { status: 400 })
    }
    const { id: workflowId } = context.params
    const userId = getAuthenticatedUserId(request as NextRequest)
    const body = await request.json()

    // Validate request
    const validation = createApiKeySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      )
    }

    // Check if workflow exists and user has access
    const db = await getDatabaseOperations()
    const workflow = await db.getWorkflow(workflowId)

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Check tenant access
    if ((workflow as any).tenantId && !validateTenantAccess(workflow as any, request as NextRequest)) {
      return createTenantViolationError()
    }

    // Create the API key with tenant context
    const apiKeyData = addTenantContext({
      workflowId,
      name: validation.data.name,
      permissions: validation.data.permissions,
      description: validation.data.description,
      expiresAt: validation.data.expiresAt,
      rateLimits: validation.data.rateLimits,
      createdBy: userId
    }, request as NextRequest)

    const { apiKey, plainKey } = await EmbedApiKeyService.createApiKey(
      workflowId,
      validation.data.name,
      validation.data.permissions,
      {
        description: validation.data.description,
        expiresAt: validation.data.expiresAt,
        rateLimits: validation.data.rateLimits,
      }
    )

    // Return the key info with the plain key (only shown once)
    return NextResponse.json({
      apiKey: {
        ...apiKey,
        key: undefined, // Don't include hashed key
      },
      plainKey, // This is the actual key to use
      message: 'Save this API key securely. It will not be shown again.',
    })
  } catch (error) {
    console.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 })
  }
}, {
  resource: 'workflow',
  action: 'update'
})

// DELETE /api/workflows/[id]/embed/api-keys/[keyId] - Revoke API key
export const DELETE = withAuth(async (request: AuthenticatedRequest, context?: { params: { id: string; keyId: string } }) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    const { id: workflowId, keyId } = context.params

    // Verify user owns this workflow
    const db = await getDatabaseOperations()
    const workflow = await db.getWorkflow(workflowId)
    
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Check tenant access
    if ((workflow as any).tenantId && !validateTenantAccess(workflow as any, request as NextRequest)) {
      return createTenantViolationError()
    }

    await EmbedApiKeyService.revokeApiKey(keyId)

    return NextResponse.json({ success: true, message: 'API key revoked' })
  } catch (error) {
    console.error('Error revoking API key:', error)
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 })
  }
}, {
  resource: 'workflow',
  action: 'update'
})
