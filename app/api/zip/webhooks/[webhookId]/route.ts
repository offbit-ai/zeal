import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getZipWebhookOperations } from '@/lib/database-zip-operations'

// Schema for webhook update
const updateWebhookSchema = z.object({
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  headers: z.record(z.string()).optional(),
  isActive: z.boolean().optional(),
})

// PATCH /api/zip/webhooks/[webhookId] - Update webhook
export async function PATCH(
  request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const { webhookId } = params
    const body = await request.json()
    
    // Validate request
    const validation = updateWebhookSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request format',
          details: validation.error.errors,
        }
      }, { status: 400 })
    }
    
    const webhookOps = await getZipWebhookOperations()
    
    // Update webhook configuration
    await webhookOps.updateWebhookConfiguration(webhookId, {
      ...validation.data,
      updatedAt: new Date().toISOString(),
    })
    
    return NextResponse.json({
      success: true,
      webhookId,
      message: 'Webhook updated successfully',
    })
  } catch (error) {
    console.error('Error updating webhook:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update webhook',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}

// DELETE /api/zip/webhooks/[webhookId] - Delete webhook
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const { webhookId } = params
    const webhookOps = await getZipWebhookOperations()
    
    // Delete webhook configuration
    await webhookOps.deleteWebhookConfiguration(webhookId)
    
    return NextResponse.json({
      success: true,
      message: `Webhook ${webhookId} deleted successfully`,
    })
  } catch (error) {
    console.error('Error deleting webhook:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to delete webhook',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}

// POST /api/zip/webhooks/[webhookId]/test - Test webhook
export async function POST(
  _request: NextRequest,
  { params }: { params: { webhookId: string } }
) {
  try {
    const { webhookId } = params
    const webhookOps = await getZipWebhookOperations()
    
    // Get webhook configuration
    const webhook = await webhookOps.getWebhookConfiguration(webhookId)
    
    if (!webhook) {
      return NextResponse.json({
        error: {
          code: 'RESOURCE_NOT_FOUND',
          message: `Webhook ${webhookId} not found`,
        }
      }, { status: 404 })
    }
    
    // Send test event to webhook
    const testEvent = {
      id: `test-${Date.now()}`,
      type: 'webhook.test',
      webhookId,
      timestamp: Date.now(),
      data: {
        message: 'This is a test event from Zeal ZIP',
      },
    }
    
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Zeal-Event': 'webhook.test',
          'X-Zeal-Webhook-Id': webhookId,
          ...(webhook.headers || {}),
        },
        body: JSON.stringify(testEvent),
      })
      
      return NextResponse.json({
        success: response.ok,
        statusCode: response.status,
        message: response.ok ? 'Test event sent successfully' : 'Test event failed',
      })
    } catch (fetchError) {
      return NextResponse.json({
        success: false,
        error: fetchError instanceof Error ? fetchError.message : 'Failed to send test event',
      })
    }
  } catch (error) {
    console.error('Error testing webhook:', error)
    return NextResponse.json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to test webhook',
        traceId: `trace_${Date.now()}`,
      }
    }, { status: 500 })
  }
}