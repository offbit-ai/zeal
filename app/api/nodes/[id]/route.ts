import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'
import { nodeTemplateService } from '@/services/nodeTemplateService'


// GET /api/nodes/[id] - Get specific node template
export const GET = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {

      if (!context || !context.params || !context.params.id) {
        throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node ID is required', 400)
      }

      const { id } = context.params

      const nodeTemplate = await nodeTemplateService.getTemplateById(id)

      if (!nodeTemplate) {
        throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node template not found', 404)
      }

      // Check tenant access - skip if template doesn't have tenant info yet
      if ((nodeTemplate as any).tenantId && !validateTenantAccess({ tenantId: (nodeTemplate as any).tenantId }, req as NextRequest)) {
        return createTenantViolationError()
      }

      return NextResponse.json(createSuccessResponse(nodeTemplate))
    }
  ),
  {
    resource: 'nodes',
    action: 'read'
  }
)

// PUT /api/nodes/[id] - Update node template (admin only)
export const PUT = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {

      if (!context || !context.params || !context.params.id) {
        throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node ID is required', 400)
      }

      const { id } = context.params
      const body = await req.json()

      // Authorization is handled by withAuth middleware based on policy

      const existingNode = await nodeTemplateService.getTemplateById(id)

      if (!existingNode) {
        throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node template not found', 404)
      }

      // Check tenant access
      if ((existingNode as any).tenantId && !validateTenantAccess({ tenantId: (existingNode as any).tenantId }, req as NextRequest)) {
        return createTenantViolationError()
      }

      // Check for duplicate type if type is being changed
      if (body.type && body.type !== existingNode.type) {
        const duplicateNode = await nodeTemplateService.getTemplateById(body.type)
        if (duplicateNode && duplicateNode.id !== id) {
          throw new ApiError(
            'DUPLICATE_NODE_TYPE',
            `Node template with type '${body.type}' already exists`,
            409
          )
        }
      }

      // Update node template
      const updatedNode = await nodeTemplateService.updateTemplate(id, {
        type: body.type,
        title: body.title,
        subtitle: body.subtitle,
        category: body.category,
        subcategory: body.subcategory,
        description: body.description,
        icon: body.icon,
        properties: body.properties,
        requiredEnvVars: body.requiredEnvVars,
        tags: body.tags,
        version: body.version,
        isActive: body.isActive,
      })

      return NextResponse.json(createSuccessResponse(updatedNode))
    }
  ),
  {
    resource: 'nodes',
    action: 'update'
  }
)

// DELETE /api/nodes/[id] - Deactivate node template (admin only)
export const DELETE = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {

      if (!context || !context.params || !context.params.id) {
        throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node ID is required', 400)
      }

      const { id } = context.params

      // Authorization is handled by withAuth middleware based on policy

      const existingNode = await nodeTemplateService.getTemplateById(id)

      if (!existingNode) {
        throw new ApiError('NODE_TEMPLATE_NOT_FOUND', 'Node template not found', 404)
      }

      // Check tenant access
      if ((existingNode as any).tenantId && !validateTenantAccess({ tenantId: (existingNode as any).tenantId }, req as NextRequest)) {
        return createTenantViolationError()
      }

      // Instead of actually deleting, mark as inactive (soft delete)
      await nodeTemplateService.updateTemplate(id, { isActive: false })

      return NextResponse.json(createSuccessResponse({ deactivated: true }))
    }
  ),
  {
    resource: 'nodes',
    action: 'delete'
  }
)
