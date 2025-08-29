import { NextRequest, NextResponse } from 'next/server'
import { uploadFile, generateFileKey } from '@/lib/s3-client'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'
import { addTenantContext } from '@/lib/auth/tenant-utils'

export const runtime = 'nodejs'
export const maxDuration = 60 // 60 seconds timeout for large files

// File size limits by type
const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  audio: 50 * 1024 * 1024, // 50MB
  video: 200 * 1024 * 1024, // 200MB
  default: 10 * 1024 * 1024, // 10MB
}

// Allowed MIME types by category
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
  video: ['video/mp4', 'video/webm', 'video/ogg'],
}

function getFileCategory(contentType: string): string {
  for (const [category, types] of Object.entries(ALLOWED_TYPES)) {
    if (types.includes(contentType)) {
      return category
    }
  }
  return 'default'
}

export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const workflowId = formData.get('workflowId') as string
    const graphId = formData.get('graphId') as string
    const nodeId = formData.get('nodeId') as string

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate required IDs for namespacing
    if (!workflowId || !graphId || !nodeId) {
      return NextResponse.json({ error: 'Missing workflowId, graphId, or nodeId' }, { status: 400 })
    }

    // Validate file type
    const category = getFileCategory(file.type)
    if (category === 'default') {
      return NextResponse.json({ error: 'File type not allowed' }, { status: 400 })
    }

    // Validate file size
    const sizeLimit = FILE_SIZE_LIMITS[category as keyof typeof FILE_SIZE_LIMITS]
    if (file.size > sizeLimit) {
      return NextResponse.json(
        { error: `File size exceeds ${sizeLimit / 1024 / 1024}MB limit` },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate namespaced key: workflowId/graphId/nodeId/filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const sanitizedName = file.name
      .split('.')[0]
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50) // Limit filename length
    const key = `${workflowId}/${graphId}/${nodeId}/${timestamp}-${sanitizedName}.${extension}`

    // Add tenant context to metadata
    const metadata = addTenantContext({
      originalName: file.name,
      uploadedAt: new Date().toISOString(),
      workflowId,
      graphId,
      nodeId,
    }, request as NextRequest)

    // Upload to S3/MinIO
    const url = await uploadFile(buffer, key, file.type, metadata)

    return NextResponse.json({
      url,
      key,
      size: file.size,
      type: file.type,
      name: file.name,
      category,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}, {
  resource: 'upload',
  action: 'create'
})
