import { NextRequest, NextResponse } from 'next/server'
import { getDatabaseOperations } from '@/lib/database'
import { z } from 'zod'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'

// GET /api/embed/[id] - Get workflow data for embedding
export const GET = withAuth(async (request: AuthenticatedRequest, context?: { params: { id: string } }) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Missing route parameters' }, { status: 400 })
    }
    const { params } = context
    const { id } = params

    // Check for API key in Authorization header
    const authHeader = request.headers.get('authorization')
    const apiKey = authHeader?.replace('Bearer ', '')

    let permissions = null
    if (apiKey) {
      // Validate API key
      const { EmbedApiKeyService } = await import('@/services/embedApiKeyService')
      const validKey = await EmbedApiKeyService.validateApiKey(apiKey, id)

      if (!validKey) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
      }

      // Check rate limits
      const withinLimits = await EmbedApiKeyService.checkRateLimits(validKey.id)
      if (!withinLimits) {
        return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
      }

      permissions = validKey.permissions
    }

    const db = await getDatabaseOperations()
    const workflow = await db.getWorkflow(id)

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    // Check tenant access
    if (!validateTenantAccess(workflow, request as NextRequest)) {
      return createTenantViolationError()
    }

    // Check if workflow allows embedding
    if (!workflow.settings?.allowEmbed) {
      return NextResponse.json({ error: 'Workflow embedding not allowed' }, { status: 403 })
    }

    // If workflow requires API key but none provided
    if (workflow.settings?.requireApiKey && !apiKey) {
      return NextResponse.json({ error: 'API key required for this workflow' }, { status: 401 })
    }

    // Use permissions from API key if available, otherwise use default embed permissions
    const effectivePermissions = permissions ||
      workflow.settings?.embedPermissions || {
        canAddNodes: true,
        canAddGroups: true,
        canEditNodes: false,
        canDeleteNodes: false,
        canEditConnections: false,
        canViewWorkflow: true,
        canExecute: false,
        canExportData: false,
      }

    // Return sanitized workflow data (remove sensitive information)
    const embedData = {
      id: workflow.id,
      name: workflow.name,
      graphs: workflow.graphs.map((graph: any) => ({
        id: graph.id,
        name: graph.name,
        nodes: graph.nodes,
        connections: graph.connections,
        groups: graph.groups,
      })),
      settings: {
        allowEmbed: true,
        embedPermissions: effectivePermissions,
      },
    }

    return NextResponse.json(embedData)
  } catch (error) {
    console.error('Error fetching embed workflow:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}, {
  resource: 'workflow',
  action: 'read'
})
