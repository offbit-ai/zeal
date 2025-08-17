import { NextRequest, NextResponse } from 'next/server'
import { EmbedApiKeyService } from '@/services/embedApiKeyService'
import { z } from 'zod'
import { getDatabaseOperations } from '@/lib/database'

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
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: workflowId } = params

    // TODO: Add authentication to ensure user owns this workflow

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
}

// POST /api/workflows/[id]/embed/api-keys - Create new API key
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { id: workflowId } = params
    const body = await request.json()

    // Validate request
    const validation = createApiKeySchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.errors },
        { status: 400 }
      )
    }

    // TODO: Add authentication to ensure user owns this workflow

    // Check if workflow exists and allows embedding
    const db = await getDatabaseOperations()
    const workflow = await db.getWorkflow(workflowId)

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Create the API key
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
}

// DELETE /api/workflows/[id]/embed/api-keys/[keyId] - Revoke API key
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; keyId: string } }
) {
  try {
    const { id: workflowId, keyId } = params

    // TODO: Add authentication to ensure user owns this workflow

    await EmbedApiKeyService.revokeApiKey(keyId)

    return NextResponse.json({ success: true, message: 'API key revoked' })
  } catch (error) {
    console.error('Error revoking API key:', error)
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 })
  }
}
