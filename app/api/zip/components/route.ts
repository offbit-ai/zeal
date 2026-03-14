/**
 * POST /api/zip/components — Upload a Web Component bundle
 *
 * Accepts a JS bundle (multipart or raw body) and stores it on disk.
 * Returns a bundleId that can be referenced in template.display.bundleId.
 * The bundle is served same-origin at /api/zip/components/[namespace]/[bundleId].
 */

import { NextRequest, NextResponse } from 'next/server'
import { withZIPAuthorization, getAuthenticatedUserId } from '@/lib/auth/zip-middleware'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import crypto from 'crypto'

const BUNDLE_DIR = join(process.cwd(), '.zeal', 'component-bundles')
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
    const sizeBytes = new TextEncoder().encode(source).length
    if (sizeBytes > MAX_BUNDLE_SIZE) {
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

    // Generate content-addressable bundleId
    const hash = crypto.createHash('sha256').update(source).digest('hex').slice(0, 16)
    const bundleId = `${hash}.js`

    // Ensure directory exists
    const nsDir = join(BUNDLE_DIR, namespace)
    if (!existsSync(nsDir)) {
      await mkdir(nsDir, { recursive: true })
    }

    // Write bundle to disk
    const bundlePath = join(nsDir, bundleId)
    await writeFile(bundlePath, source, 'utf-8')

    return NextResponse.json({
      bundleId,
      namespace,
      url: `/api/zip/components/${namespace}/${bundleId}`,
      size: sizeBytes,
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
