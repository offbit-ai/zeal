import { NextRequest, NextResponse } from 'next/server'
import {
  createSuccessResponse,
  withErrorHandling,
  extractUserId,
  validateEnvVarKey,
} from '@/lib/api-utils'
import { ApiError, EnvVarUpdateRequest, EnvVarResponse } from '@/types/api'
import { invalidateCache } from '@/lib/api-cache'
import { EnvVarDatabase } from '@/services/envVarDatabase'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'

// GET /api/env-vars/[id] - Get specific environment variable
export const GET = withAuth(async (request: AuthenticatedRequest, context?: { params: { id: string } }) => {
  if (!context || !context.params) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }
  
  const { id } = context.params
  const envVar = await EnvVarDatabase.getById(id)

  if (!envVar) {
    return NextResponse.json({ error: 'Environment variable not found' }, { status: 404 })
  }

  // Validate tenant access for environment variables
  if ((envVar as any).tenantId && !validateTenantAccess(envVar as any, request as NextRequest)) {
    return createTenantViolationError()
  }

  return NextResponse.json(createSuccessResponse(envVar))
}, {
  resource: 'workflow',
  action: 'read'
})

// PUT /api/env-vars/[id] - Update environment variable
export const PUT = withAuth(async (request: AuthenticatedRequest, context?: { params: { id: string } }) => {
  if (!context || !context.params) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }
  
  const { id } = context.params
  const body: EnvVarUpdateRequest = await request.json()

  // Check if env var exists
  const existingEnvVar = await EnvVarDatabase.getById(id)

  if (!existingEnvVar) {
    return NextResponse.json({ error: 'Environment variable not found' }, { status: 404 })
  }

  // Validate tenant access for environment variable updates
  if ((existingEnvVar as any).tenantId && !validateTenantAccess(existingEnvVar as any, request as NextRequest)) {
    return createTenantViolationError()
  }

  // Update the environment variable
  const updatedEnvVar = await EnvVarDatabase.update(id, body)

  if (!updatedEnvVar) {
    return NextResponse.json({ error: 'Failed to update environment variable' }, { status: 500 })
  }

  // Invalidate cache for env vars
  invalidateCache('/api/env-vars')

  return NextResponse.json(createSuccessResponse(updatedEnvVar))
}, {
  resource: 'workflow',
  action: 'update'
})

// DELETE /api/env-vars/[id] - Delete environment variable
export const DELETE = withAuth(async (request: AuthenticatedRequest, context?: { params: { id: string } }) => {
  if (!context || !context.params) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
  }
  
  const { id } = context.params

  // Check if env var exists
  const existingEnvVar = await EnvVarDatabase.getById(id)

  if (!existingEnvVar) {
    return NextResponse.json({ error: 'Environment variable not found' }, { status: 404 })
  }

  // Validate tenant access for environment variable deletion
  if ((existingEnvVar as any).tenantId && !validateTenantAccess(existingEnvVar as any, request as NextRequest)) {
    return createTenantViolationError()
  }

  // Remove the environment variable
  const deleted = await EnvVarDatabase.delete(id)

  if (!deleted) {
    return NextResponse.json({ error: 'Failed to delete environment variable' }, { status: 500 })
  }

  // Invalidate cache for env vars
  invalidateCache('/api/env-vars')

  return NextResponse.json(createSuccessResponse({ deleted: true }), { status: 200 })
}, {
  resource: 'workflow',
  action: 'delete'
})
