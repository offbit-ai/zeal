import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // You can add additional health checks here
    // For example: database connectivity, Redis connectivity, etc.

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'zeal-app',
      version: process.env.npm_package_version || '1.0.0',
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
