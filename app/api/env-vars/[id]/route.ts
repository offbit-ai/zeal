import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  validateEnvVarKey,
  mockDelay
} from '@/lib/api-utils'
import { ApiError, EnvVarUpdateRequest, EnvVarResponse } from '@/types/api'
import { invalidateCache } from '@/lib/api-cache'
import { EnvVarDatabase } from '@/services/envVarDatabase'

// GET /api/env-vars/[id] - Get specific environment variable
export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const userId = extractUserId(req)
  const { id } = params
  
  const envVar = await EnvVarDatabase.getById(id)
  
  if (!envVar) {
    throw new ApiError('ENV_VAR_NOT_FOUND', 'Environment variable not found', 404)
  }
  
  return NextResponse.json(createSuccessResponse(envVar))
})

// PUT /api/env-vars/[id] - Update environment variable
export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const userId = extractUserId(req)
  const { id } = params
  const body: EnvVarUpdateRequest = await req.json()
  
  // Check if env var exists
  const existingEnvVar = await EnvVarDatabase.getById(id)
  
  if (!existingEnvVar) {
    throw new ApiError('ENV_VAR_NOT_FOUND', 'Environment variable not found', 404)
  }
  
  // Update the environment variable
  const updatedEnvVar = await EnvVarDatabase.update(id, body)
  
  if (!updatedEnvVar) {
    throw new ApiError('UPDATE_FAILED', 'Failed to update environment variable', 500)
  }
  
  // Invalidate cache for env vars
  invalidateCache('/api/env-vars')
  
  return NextResponse.json(createSuccessResponse(updatedEnvVar))
})

// DELETE /api/env-vars/[id] - Delete environment variable
export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  const userId = extractUserId(req)
  const { id } = params
  
  // Check if env var exists
  const existingEnvVar = await EnvVarDatabase.getById(id)
  
  if (!existingEnvVar) {
    throw new ApiError('ENV_VAR_NOT_FOUND', 'Environment variable not found', 404)
  }
  
  // Remove the environment variable
  const deleted = await EnvVarDatabase.delete(id)
  
  if (!deleted) {
    throw new ApiError('DELETE_FAILED', 'Failed to delete environment variable', 500)
  }
  
  // Invalidate cache for env vars
  invalidateCache('/api/env-vars')
  
  return NextResponse.json(createSuccessResponse({ deleted: true }), { status: 200 })
})