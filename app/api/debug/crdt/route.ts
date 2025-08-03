import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // This endpoint is for debugging CRDT sync status
  // In a real implementation, this would connect to your CRDT backend
  
  return NextResponse.json({
    status: 'debug',
    message: 'CRDT debug endpoint',
    timestamp: new Date().toISOString(),
    info: 'Open the app in two browser windows with the same workflow ID to test sync'
  })
}