import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getZipWebhookOperations } from '@/lib/database-zip-operations'
import { v4 as uuidv4 } from 'uuid'
import { withZIPAuthorization } from '@/lib/auth/zip-middleware'

// Schema for webhook registration
const registerWebhookSchema = z.object({
  namespace: z.string(),
  url: z.string().url(),
  events: z.array(z.string()).optional(), // Specific events to subscribe to
  headers: z.record(z.string()).optional(), // Custom headers for webhook calls
  metadata: z.record(z.any()).optional(),
})

// POST /api/zip/webhooks - Register webhook
export const POST = withZIPAuthorization(async (request: NextRequest) => {
  try {
    const body = await request.json()
    
    // Validate request
    const validation = registerWebhookSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const { namespace, url, events, headers, metadata } = validation.data
    const webhookId = uuidv4()
    const webhookOps = await getZipWebhookOperations()
    
    // Store webhook configuration
    const savedWebhook = await webhookOps.saveWebhookConfiguration({
      id: webhookId,
      namespace,
      url,
      events: events || ['*'], // Subscribe to all events by default
      headers: headers || {},
      isActive: true,
      metadata: {
        ...metadata,
        registeredAt: new Date().toISOString(),
      },
    })
    
    return NextResponse.json({
      success: true,
      webhookId,
      namespace,
      url,
      events: events || ['*'],
      message: 'Webhook registered successfully',
    })
  } catch (error) {
    console.error('Error registering webhook:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register webhook',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'webhooks',
  action: 'create'
})

// GET /api/zip/webhooks - List webhooks
export const GET = withZIPAuthorization(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const namespace = searchParams.get('namespace')
    const webhookOps = await getZipWebhookOperations()
    
    // Get webhook configurations
    const webhooks = await webhookOps.listWebhookConfigurations({
      namespace: namespace || undefined,
    })
    
    return NextResponse.json({
      webhooks: webhooks.map((webhook: any) => ({
        id: webhook.id,
        namespace: webhook.namespace,
        url: webhook.url,
        events: webhook.events,
        isActive: webhook.metadata?.isActive ?? true,
        registeredAt: webhook.metadata?.registeredAt,
      })),
      count: webhooks.length,
    })
  } catch (error) {
    console.error('Error listing webhooks:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list webhooks',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}, {
  resourceType: 'webhooks',
  action: 'read'
})