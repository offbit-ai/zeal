import { NextRequest, NextResponse } from 'next/server'
import { getPresignedUploadUrl, getPublicUrl } from '@/lib/s3-client'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { generateWorkflowScopedKey } from '@/lib/storage/key-utils'

export const POST = withAuth(async (request: AuthenticatedRequest, context?: { params: any }) => {
  try {
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    
    // Add tenant access validation for resources that support it
    // if ((resource as any).tenantId && !validateTenantAccess(resource as any, request as NextRequest)) {
    //   return createTenantViolationError()
    // }
    const { fileName, fileType, fileSize, workflowId, graphId, nodeId } = await request.json()

    if (!fileName || !fileType) {
      return NextResponse.json({ error: 'fileName and fileType are required' }, { status: 400 })
    }

    // Validate required IDs for namespacing
    if (!workflowId || !graphId || !nodeId) {
      return NextResponse.json({ error: 'Missing workflowId, graphId, or nodeId' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      'video/mp4',
      'video/webm',
      'video/ogg',
    ]

    if (!allowedTypes.includes(fileType)) {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    // Generate namespaced key using shared utility
    const key = generateWorkflowScopedKey(workflowId, graphId, nodeId, fileName)

    // Generate presigned URL
    const presignedUrl = await getPresignedUploadUrl(key, fileType)

    // Generate public URL that will be accessible after upload
    // This now works with all storage providers (AWS S3, Azure, GCS, MinIO)
    const publicUrl = getPublicUrl(key)

    return NextResponse.json({
      presignedUrl,
      publicUrl,
      key,
    })
  } catch (error) {
    console.error('Presigned URL error:', error)
    return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
  }
}, {
  resource: 'workflow',
  action: 'create'
})
