/**
 * POST /api/zip/components — Upload a Web Component bundle
 *
 * Stores the JS bundle in persistent cloud storage (S3/Azure/GCS/MinIO)
 * using a content-addressed key. Returns a bundleId that templates
 * reference in display.bundleId. The bundle is served same-origin
 * via GET /api/zip/components/[namespace]/[bundleId].
 */

import { NextRequest, NextResponse } from 'next/server'
import { withZIPAuthorization } from '@/lib/auth/zip-middleware'
import { uploadFile } from '@/lib/s3-client'
import crypto from 'crypto'

const MAX_BUNDLE_SIZE = 512 * 1024 // 512 KB

export const POST = withZIPAuthorization(async (request: NextRequest) => {
  try {
    const contentType = request.headers.get('content-type') || ''
    let namespace: string
    let source: string

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      namespace = formData.get('namespace') as string
      const file = formData.get('bundle') as File | null

      if (!namespace || !file) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Missing namespace or bundle file' } },
          { status: 400 }
        )
      }

      source = await file.text()
    } else {
      const body = await request.json()
      namespace = body.namespace
      source = body.source

      if (!namespace || !source) {
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Missing namespace or source' } },
          { status: 400 }
        )
      }
    }

    // Validate size
    const sourceBuffer = Buffer.from(source, 'utf-8')
    if (sourceBuffer.length > MAX_BUNDLE_SIZE) {
      return NextResponse.json(
        { error: { code: 'PAYLOAD_TOO_LARGE', message: `Bundle exceeds ${MAX_BUNDLE_SIZE / 1024}KB limit` } },
        { status: 413 }
      )
    }

    // Validate namespace format
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(namespace)) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid namespace format' } },
        { status: 400 }
      )
    }

    // Content-addressed bundleId
    const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16)
    const bundleId = `${hash}.js`

    // Storage key under a dedicated prefix
    const storageKey = `zip-components/${namespace}/${bundleId}`

    // Upload to persistent storage (file, key, contentType)
    await uploadFile(sourceBuffer, storageKey, 'application/javascript')

    return NextResponse.json({
      bundleId,
      namespace,
      url: `/api/zip/components/${namespace}/${bundleId}`,
      size: sourceBuffer.length,
    })
  } catch (error) {
    console.error('Error uploading component bundle:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to upload bundle' } },
      { status: 500 }
    )
  }
}, {
  resourceType: 'templates',
  action: 'create',
})
