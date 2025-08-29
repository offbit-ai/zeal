import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { FlowTraceDatabase } from '@/services/flowTraceDatabase'
import { CreateTraceSessionRequest, CreateTraceSessionResponse } from '@/types/zip'
import { v4 as uuidv4 } from 'uuid'
import { withZIPAuthorization } from '@/lib/auth/zip-middleware'

const createTraceSessionSchema = z.object({
  workflowId: z.string(),
  workflowVersionId: z.string().optional(),
  executionId: z.string(),
  metadata: z.object({
    trigger: z.string().optional(),
    environment: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
})

// POST /api/zip/traces/sessions - Create trace session
export const POST = withZIPAuthorization(async (request: NextRequest) => {
  try {
    const body = await request.json()
    
    // Validate request
    const validation = createTraceSessionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { workflowId, workflowVersionId, executionId, metadata } = validation.data
  
    
    // Create trace session using existing flow trace database
    const session = await FlowTraceDatabase.createSession({
      workflowId,
      workflowVersionId,
      workflowName: `Workflow ${workflowId}`, // Can be enhanced to fetch actual name
      userId: 'zip-integration',
      metadata: {
        ...metadata,
        executionId,
        workflowVersionId,
        isZipSession: true,
      },
    })
    
    const response: CreateTraceSessionResponse = {
      sessionId: session.id,
      startTime: new Date().toISOString(),
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error creating trace session:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to create trace session',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'trace-sessions',
  action: 'create'
})