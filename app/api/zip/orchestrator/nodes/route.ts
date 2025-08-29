import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '@/lib/crdt/server-operations'
import { AddNodeResponse } from '@/types/zip'
import { v4 as uuidv4 } from 'uuid'
import { withZIPAuthorization } from '@/lib/auth/zip-middleware'

const addNodeSchema = z.object({
  workflowId: z.string(),
  graphId: z.string().optional().default('main'),
  templateId: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  propertyValues: z.record(z.any()).optional(),
})

// POST /api/zip/orchestrator/nodes - Add node
export const POST = withZIPAuthorization(async (request: NextRequest) => {
  try {
    const body = await request.json()
    
    // Validate request
    const validation = addNodeSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { workflowId, graphId, templateId, position, propertyValues } = validation.data
    const nodeId = uuidv4()
    
    // Get template details
    const [namespace, ...templateParts] = templateId.split('/')
    const templateIdOnly = templateParts.join('/')
    
    // Fetch template metadata (if exists)
    // For now, we'll create a basic node structure
    const nodeData = {
      id: nodeId,
      type: templateId,
      metadata: {
        id: nodeId,
        templateId,
        type: templateIdOnly || templateId,
        title: templateIdOnly || templateId,
        subtitle: `${namespace} node`,
        description: `Node from ${namespace} namespace`,
        icon: 'box',
        variant: 'gray-700',
        shape: 'rectangle',
        size: 'medium',
        category: namespace,
        inputs: [],
        outputs: [],
        properties: {},
        propertyValues: propertyValues || {},
        tags: [`namespace:${namespace}`],
      },
      position,
    }
    
    // Use CRDT operations to add node
    await ServerCRDTOperations.addNode(workflowId, graphId || 'main', nodeData)
    
    const response: AddNodeResponse = {
      nodeId,
      node: {
        id: nodeId,
        type: templateId,
        position,
        metadata: nodeData.metadata,
      },
    }
    
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error adding node:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add node',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'node',
  action: 'create'
})