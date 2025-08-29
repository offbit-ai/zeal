import { NextRequest, NextResponse } from 'next/server'
import {
  createSuccessResponse,
  withErrorHandling,
  extractUserId,
  validateRequired,
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError, addTenantContext } from '@/lib/auth/tenant-utils'

// GET /api/workflows/[id]/snapshots - Get workflow snapshots
export const GET = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {
      if (!context || !context.params || !context.params.id) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
      }

      const { id: workflowId } = context.params
      const userId = req.auth?.subject?.id || extractUserId(req)

      // Verify workflow ownership and tenant access
      const workflow = await WorkflowDatabase.getWorkflow(workflowId)
      if (!workflow) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
      }

      // Check tenant access
      if (!validateTenantAccess(workflow, req as NextRequest)) {
        return createTenantViolationError()
      }

      // Check ownership for legacy workflows without tenantId
      if (!(workflow as any).tenantId && workflow.userId !== userId) {
        throw new ApiError('FORBIDDEN', 'Not authorized to access this workflow', 403)
      }

      // Get snapshots
      const snapshots = await WorkflowDatabase.getWorkflowSnapshots(workflowId)

      return NextResponse.json(createSuccessResponse(snapshots))
    }
  ),
  {
    resource: 'workflow',
    action: 'read'
  }
)

// POST /api/workflows/[id]/snapshots - Create workflow snapshot
export const POST = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {
      if (!context || !context.params || !context.params.id) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
      }

      const { id: workflowId } = context.params
      const userId = req.auth?.subject?.id || extractUserId(req)
      const body = await req.json()

      // Verify workflow ownership and tenant access
      const workflow = await WorkflowDatabase.getWorkflow(workflowId)
      if (!workflow) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
      }

      // Check tenant access
      if (!validateTenantAccess(workflow, req as NextRequest)) {
        return createTenantViolationError()
      }

      // Check ownership for legacy workflows without tenantId
      if (!(workflow as any).tenantId && workflow.userId !== userId) {
        throw new ApiError('FORBIDDEN', 'Not authorized to update this workflow', 403)
      }

      // Validate required fields
      validateRequired(body, ['name', 'graphs'])

      // Validate graphs structure
      if (!Array.isArray(body.graphs) || body.graphs.length === 0) {
        throw new ApiError('INVALID_GRAPHS', 'At least one graph is required', 400)
      }

      // Add tenant context to snapshot data
      const snapshotData = addTenantContext({
        id: workflowId,
        name: body.name,
        description: body.description,
        graphs: body.graphs,
        triggerConfig: body.triggerConfig,
        metadata: body.metadata,
        activeGraphId: body.activeGraphId || 'main',
        isDraft: body.isDraft !== false,
        isPublished: body.isPublished || false,
        saveCount: body.saveCount || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
      }, req as NextRequest)

      // Create snapshot
      const snapshotId = await WorkflowDatabase.createSnapshot(snapshotData)

      const snapshot = await WorkflowDatabase.getSnapshot(snapshotId)

      return NextResponse.json(createSuccessResponse(snapshot), { status: 201 })
    }
  ),
  {
    resource: 'workflow',
    action: 'create'
  }
)
