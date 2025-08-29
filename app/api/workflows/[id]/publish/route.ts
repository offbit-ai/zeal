import { NextRequest, NextResponse } from 'next/server'
import { createSuccessResponse, withErrorHandling, extractUserId } from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { WorkflowDatabase } from '@/services/workflowDatabase'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'

// POST /api/workflows/[id]/publish - Publish workflow
export const POST = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {

      if (!context || !context.params || !context.params.id) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
      }

      const { id } = context.params
      const userId = req.auth?.subject?.id || extractUserId(req)
      const { versionId } = await req.json() // Optionally specify which version to publish

      // Get workflow to verify ownership and tenant access
      const workflow = await WorkflowDatabase.getWorkflow(id)

      if (!workflow) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
      }

      // Check tenant access
      if (!validateTenantAccess(workflow, req as NextRequest)) {
        return createTenantViolationError()
      }

      // Check ownership for legacy workflows without tenantId
      if (!(workflow as any).tenantId && workflow.userId !== userId) {
        throw new ApiError('FORBIDDEN', 'Not authorized to publish this workflow', 403)
      }

      // Determine which version to publish
      let targetVersionId = versionId
      if (!targetVersionId) {
        // Get latest version if no specific version specified
        const { versions } = await WorkflowDatabase.getWorkflowVersions(id, { limit: 1 })
        if (versions.length === 0) {
          throw new ApiError('NO_VERSIONS', 'Workflow has no versions to publish', 400)
        }
        targetVersionId = versions[0].id
      }

      // Get the version to publish
      const versionToPublish = await WorkflowDatabase.getWorkflowVersion(targetVersionId)

      if (!versionToPublish) {
        throw new ApiError('VERSION_NOT_FOUND', 'Specified version not found', 404)
      }

      if (versionToPublish.workflowId !== id) {
        throw new ApiError('VERSION_MISMATCH', 'Version does not belong to this workflow', 400)
      }

      // Validate workflow can be published
      if (!versionToPublish.graphs || versionToPublish.graphs.length === 0) {
        throw new ApiError('EMPTY_WORKFLOW', 'Cannot publish empty workflow', 400)
      }

      // Check for required environment variables
      const requiredEnvVars = new Set<string>()
      versionToPublish.graphs.forEach(graph => {
        if (graph.nodes) {
          graph.nodes.forEach((node: any) => {
            if (node.requiredEnvVars) {
              node.requiredEnvVars.forEach((varName: string) => requiredEnvVars.add(varName))
            }
          })
        }
      })

      // In real implementation, validate that all required env vars are configured
      if (requiredEnvVars.size > 0) {
        // Validate env vars exist for this tenant
      }

      // Publish the version
      const publishedVersion = await WorkflowDatabase.publishWorkflowVersion(
        id,
        targetVersionId,
        userId
      )

      // Get updated workflow
      const updatedWorkflow = await WorkflowDatabase.getWorkflow(id)

      if (!updatedWorkflow) {
        throw new ApiError('PUBLISH_FAILED', 'Failed to retrieve published workflow')
      }

      // Transform to API response format
      const response = {
        id: updatedWorkflow.id,
        name: updatedWorkflow.name,
        description: updatedWorkflow.description || '',
        graphs: publishedVersion.graphs,
        triggerConfig: publishedVersion.triggerConfig,
        metadata: {
          ...publishedVersion.metadata,
        },
        status: 'published',
        version: publishedVersion.version,
        createdAt: updatedWorkflow.createdAt,
        updatedAt: updatedWorkflow.updatedAt,
        publishedAt: publishedVersion.publishedAt,
        createdBy: updatedWorkflow.userId,
        lastModifiedBy: publishedVersion.userId,
      }

      // In real implementation, this would trigger deployment to execution engine
      return NextResponse.json(createSuccessResponse(response))
    }
  ),
  {
    resource: 'workflow',
    action: 'update'
  }
)

// DELETE /api/workflows/[id]/publish - Unpublish workflow
export const DELETE = withAuth(
  withErrorHandling(
    async (req: AuthenticatedRequest, context?: { params: { id: string } }) => {

      if (!context || !context.params || !context.params.id) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow ID is required', 400)
      }

      const { id } = context.params
      const userId = req.auth?.subject?.id || extractUserId(req)

      // Get workflow to verify ownership and current status
      const workflow = await WorkflowDatabase.getWorkflow(id)

      if (!workflow) {
        throw new ApiError('WORKFLOW_NOT_FOUND', 'Workflow not found', 404)
      }

      // Check tenant access
      if (!validateTenantAccess(workflow, req as NextRequest)) {
        return createTenantViolationError()
      }

      // Check ownership for legacy workflows without tenantId
      if (!(workflow as any).tenantId && workflow.userId !== userId) {
        throw new ApiError('FORBIDDEN', 'Not authorized to unpublish this workflow', 403)
      }

      if (!workflow.publishedVersionId) {
        throw new ApiError('WORKFLOW_NOT_PUBLISHED', 'Workflow is not published', 409)
      }

      // Get current published version
      const publishedVersion = await WorkflowDatabase.getWorkflowVersion(workflow.publishedVersionId)

      if (!publishedVersion) {
        throw new ApiError('PUBLISHED_VERSION_NOT_FOUND', 'Published version not found', 500)
      }

      // Unpublish using the database service
      await WorkflowDatabase.unpublishWorkflow(id)

      // Get latest version for response
      const { versions } = await WorkflowDatabase.getWorkflowVersions(id, { limit: 1 })
      const latestVersion = versions[0]

      // Get updated workflow
      const updatedWorkflow = await WorkflowDatabase.getWorkflow(id)

      if (!updatedWorkflow || !latestVersion) {
        throw new ApiError('UNPUBLISH_FAILED', 'Failed to retrieve unpublished workflow')
      }

      // Transform to API response format
      const response = {
        id: updatedWorkflow.id,
        name: updatedWorkflow.name,
        description: updatedWorkflow.description || '',
        graphs: latestVersion.graphs,
        triggerConfig: latestVersion.triggerConfig,
        metadata: {
          ...latestVersion.metadata,
        },
        status: 'draft',
        version: latestVersion.version,
        createdAt: updatedWorkflow.createdAt,
        updatedAt: updatedWorkflow.updatedAt,
        createdBy: updatedWorkflow.userId,
        lastModifiedBy: latestVersion.userId,
      }

      // In real implementation, this would remove from execution engine
      return NextResponse.json(createSuccessResponse(response))
    }
  ),
  {
    resource: 'workflow', 
    action: 'update'
  }
)