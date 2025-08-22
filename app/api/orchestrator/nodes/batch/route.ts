import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { ServerCRDTOperations } from '../../../../../lib/crdt/server-operations'

const BatchAddNodesSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  graphId: z.string().default('main'),
  nodes: z.array(z.object({
    metadata: z.object({
      templateId: z.string().optional(),
      type: z.string(),
      title: z.string(),
      subtitle: z.string().optional(),
      description: z.string().optional(),
      icon: z.string().optional(),
      variant: z.string().optional(),
      shape: z.string().optional(),
      size: z.enum(['small', 'medium', 'large']).optional(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      inputs: z.array(z.any()).optional(),
      outputs: z.array(z.any()).optional(),
      properties: z.record(z.any()).optional(),
      requiredEnvVars: z.array(z.string()).optional(),
      propertyRules: z
        .object({
          triggers: z.array(z.string()),
          rules: z.array(
            z.object({
              when: z.string(),
              updates: z.record(z.any()),
            })
          ),
        })
        .optional(),
      propertyValues: z.record(z.any()).optional(),
      tags: z.array(z.string()).optional(),
      version: z.string().optional(),
    }),
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
  })),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    console.log('[API] Batch add nodes request received, node count:', body.nodes?.length)
    
    // Validate input with Zod
    const validationResult = BatchAddNodesSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors.map(e => ({
            path: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      )
    }
    
    const params = validationResult.data

    console.log(`[API] Batch adding ${params.nodes.length} nodes to workflow ${params.workflowId}`)
    console.log(`[API] Node titles:`, params.nodes.map(n => n.metadata.title))

    // Use batch operation to add all nodes at once
    const createdNodes = await ServerCRDTOperations.addNodesBatch(
      params.workflowId,
      params.graphId,
      params.nodes
    )

    console.log(`[API] Successfully created ${createdNodes.length} nodes in batch`)

    return NextResponse.json({
      success: true,
      data: {
        nodes: createdNodes,
        message: `Successfully added ${createdNodes.length} nodes`,
      }
    })
  } catch (error) {
    console.error('Error batch adding nodes:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to batch add nodes',
      },
      { status: 500 }
    )
  }
}