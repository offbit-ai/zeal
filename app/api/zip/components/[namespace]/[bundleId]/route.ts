/**
 * GET /api/zip/components/[namespace]/[bundleId] — Serve a Web Component bundle
 *
 * Fetches the bundle from persistent cloud storage and returns it with
 * proper Content-Type and cache headers. Same-origin serving eliminates
 * all CORS/CSP issues for dynamic imports.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPresignedDownloadUrl } from '@/lib/s3-client'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ namespace: string; bundleId: string }> }
) {
  const { namespace, bundleId } = await params

  // Validate path components to prevent traversal
  if (
    !/^[a-z0-9][a-z0-9_-]*$/i.test(namespace) ||
    !/^[a-f0-9]+\.js$/i.test(bundleId)
  ) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Invalid bundle path' } },
      { status: 404 }
    )
  }

  const storageKey = `zip-components/${namespace}/${bundleId}`

  try {
    // Get a presigned download URL and proxy the content
    const downloadUrl = await getPresignedDownloadUrl(storageKey, 60)
    const upstream = await fetch(downloadUrl)

    if (!upstream.ok) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Bundle not found' } },
        { status: 404 }
      )
    }

    const body = await upstream.arrayBuffer()

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error serving component bundle:', error)
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Bundle not found' } },
      { status: 404 }
    )
  }
}
