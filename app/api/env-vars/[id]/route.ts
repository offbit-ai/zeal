import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  validateEnvVarKey,
  mockDelay
} from '@/lib/api-utils'
import { ApiError, EnvVarUpdateRequest, EnvVarResponse } from '@/types/api'

// Import the mock store (in real app, this would be a database)
// Note: In a real application, you'd import this from a shared data layer
let envVarsStore: EnvVarResponse[] = []

// GET /api/env-vars/[id] - Get specific environment variable
export const GET = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await mockDelay(50)
  
  const userId = extractUserId(req)
  const { id } = params
  
  const envVar = envVarsStore.find(v => v.id === id && v.createdBy === userId)
  
  if (!envVar) {
    throw new ApiError('ENV_VAR_NOT_FOUND', 'Environment variable not found', 404)
  }
  
  // Return full value only if user owns it (in real app, check permissions)
  const response = {
    ...envVar,
    value: envVar.isSecret ? '***' : envVar.value
  }
  
  return NextResponse.json(createSuccessResponse(response))
})

// PUT /api/env-vars/[id] - Update environment variable
export const PUT = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await mockDelay(100)
  
  const userId = extractUserId(req)
  const { id } = params
  const body: EnvVarUpdateRequest = await req.json()
  
  const envVarIndex = envVarsStore.findIndex(v => v.id === id && v.createdBy === userId)
  
  if (envVarIndex === -1) {
    throw new ApiError('ENV_VAR_NOT_FOUND', 'Environment variable not found', 404)
  }
  
  const existingEnvVar = envVarsStore[envVarIndex]
  
  // Update the environment variable
  const updatedEnvVar: EnvVarResponse = {
    ...existingEnvVar,
    value: body.value !== undefined ? body.value : existingEnvVar.value,
    isSecret: body.isSecret !== undefined ? body.isSecret : existingEnvVar.isSecret,
    description: body.description !== undefined ? body.description : existingEnvVar.description,
    updatedAt: new Date().toISOString()
  }
  
  envVarsStore[envVarIndex] = updatedEnvVar
  
  // Return sanitized response
  const response = {
    ...updatedEnvVar,
    value: updatedEnvVar.isSecret ? '***' : updatedEnvVar.value
  }
  
  return NextResponse.json(createSuccessResponse(response))
})

// DELETE /api/env-vars/[id] - Delete environment variable
export const DELETE = withErrorHandling(async (req: NextRequest, { params }: { params: { id: string } }) => {
  await mockDelay(75)
  
  const userId = extractUserId(req)
  const { id } = params
  
  const envVarIndex = envVarsStore.findIndex(v => v.id === id && v.createdBy === userId)
  
  if (envVarIndex === -1) {
    throw new ApiError('ENV_VAR_NOT_FOUND', 'Environment variable not found', 404)
  }
  
  // Remove the environment variable
  envVarsStore.splice(envVarIndex, 1)
  
  return NextResponse.json(createSuccessResponse({ deleted: true }), { status: 200 })
})