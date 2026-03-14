/**
 * GET /api/zip/components/[namespace]/[bundleId] — Serve a Web Component bundle
 *
 * Returns the JS bundle with proper Content-Type and cache headers.
 * Same-origin serving eliminates all CORS/CSP issues.
 */

import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

const BUNDLE_DIR = join(process.cwd(), '.zeal', 'component-bundles')

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

  const bundlePath = join(BUNDLE_DIR, namespace, bundleId)

  if (!existsSync(bundlePath)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Bundle not found' } },
      { status: 404 }
    )
  }

  try {
    const source = await readFile(bundlePath, 'utf-8')

    return new NextResponse(source, {
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    console.error('Error serving component bundle:', error)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to serve bundle' } },
      { status: 500 }
    )
  }
}
