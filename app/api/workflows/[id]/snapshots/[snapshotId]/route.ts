import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'

// GET /api/workflows/[id]/snapshots/[snapshotId] - Get specific snapshot
export const GET = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string; snapshotId: string } }) => {
      if (!context || !context.params || !context.params.id || !context.params.snapshotId) {
        throw new ApiError('PARAMS_REQUIRED', 'Workflow ID and Snapshot ID are required', 400)
      }

      const { id: workflowId, snapshotId } = context.params
      const userId = req.auth?.subject?.id || extractUserId(req)

      // Verify workflow exists and check tenant access
      const workflow = await WorkflowDatabase.getWorkflow(workflowId)
      if (!workflow) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
      }

      // Check tenant access
      if ((workflow as any).tenantId && !validateTenantAccess(workflow as any, req as NextRequest)) {
        return createTenantViolationError()
      }

      // Get snapshot
      const snapshot = await WorkflowDatabase.getSnapshot(snapshotId)
      if (!snapshot) {
        throw new ApiError('SNAPSHOT_NOT_FOUND', 'Snapshot not found', 404)
      }

      return NextResponse.json(createSuccessResponse(snapshot))
    }
  ),
  {
    resource: 'workflow',
    action: 'read'
  }
)

// PUT /api/workflows/[id]/snapshots/[snapshotId] - Update snapshot
export const PUT = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string; snapshotId: string } }) => {
      if (!context || !context.params || !context.params.id || !context.params.snapshotId) {
        throw new ApiError('PARAMS_REQUIRED', 'Workflow ID and Snapshot ID are required', 400)
      }

      const { id: workflowId, snapshotId } = context.params
      const body = await req.json()

      // Verify workflow exists and check tenant access
      const workflow = await WorkflowDatabase.getWorkflow(workflowId)
      if (!workflow) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
      }

      // Check tenant access
      if ((workflow as any).tenantId && !validateTenantAccess(workflow as any, req as NextRequest)) {
        return createTenantViolationError()
      }

      // Validate graphs if provided
      if (body.graphs) {
        if (!Array.isArray(body.graphs) || body.graphs.length === 0) {
          throw new ApiError('INVALID_GRAPHS', 'At least one graph is required', 400)
        }
      }

      // Update snapshot
      const updatedSnapshot = await WorkflowDatabase.updateSnapshot(snapshotId, {
        name: body.name,
        description: body.description,
        graphs: body.graphs,
        triggerConfig: body.triggerConfig,
        metadata: body.metadata,
      })

      if (!updatedSnapshot) {
        throw new ApiError('SNAPSHOT_NOT_FOUND', 'Snapshot not found', 404)
      }

      return NextResponse.json(createSuccessResponse(updatedSnapshot))
    }
  ),
  {
    resource: 'workflow',
    action: 'update'
  }
)

// DELETE /api/workflows/[id]/snapshots/[snapshotId] - Delete snapshot
export const DELETE = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string; snapshotId: string } }) => {
      if (!context || !context.params || !context.params.id || !context.params.snapshotId) {
        throw new ApiError('PARAMS_REQUIRED', 'Workflow ID and Snapshot ID are required', 400)
      }

      const { id: workflowId, snapshotId } = context.params

      // Verify workflow exists and check tenant access
      const workflow = await WorkflowDatabase.getWorkflow(workflowId)
      if (!workflow) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
      }

      // Check tenant access
      if ((workflow as any).tenantId && !validateTenantAccess(workflow as any, req as NextRequest)) {
        return createTenantViolationError()
      }

      // Delete snapshot
      const deleted = await WorkflowDatabase.deleteSnapshot(snapshotId)

      if (!deleted) {
        throw new ApiError('SNAPSHOT_NOT_FOUND', 'Snapshot not found', 404)
      }

      return NextResponse.json(createSuccessResponse({ deleted: true }))
    }
  ),
  {
    resource: 'workflow',
    action: 'delete'
  }
)
