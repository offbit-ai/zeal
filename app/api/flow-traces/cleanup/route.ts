import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'

// DELETE /api/flow-traces/cleanup - Delete old trace sessions
export const DELETE = withErrorHandling(async (req: NextRequest) => {
  const userId = extractUserId(req)
  const { searchParams } = new URL(req.url)
  
  // Get days to keep from query params, default to 30
  const daysToKeep = parseInt(searchParams.get('daysToKeep') || '30', 10)
  
  if (isNaN(daysToKeep) || daysToKeep < 1) {
    throw new ApiError('VALIDATION_ERROR', 'daysToKeep must be a positive number', 400)
  }
  
  // Calculate the date threshold
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
  
  const deletedCount = await FlowTraceDatabase.deleteOldSessions(cutoffDate)
  
  return NextResponse.json(createSuccessResponse({
    deleted: deletedCount,
    message: `Deleted ${deletedCount} trace sessions older than ${daysToKeep} days`
  }))
})