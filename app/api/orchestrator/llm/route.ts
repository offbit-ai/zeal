import { withAuth } from '@/lib/auth/middleware'
import { NextRequest, NextResponse } from 'next/server'

// General-purpose LLM endpoint for orchestrator agent
export const POST = withAuth(async (request: NextRequest, context?: { params: any }) => {
  try {
    const { messages } = await request.json()

    console.log('[LLM API] Received request with', messages?.length, 'messages')

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({
        error: 'Messages array is required'
      }, { status: 400 })
    }

    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.error('[LLM API] OpenRouter API key not configured')
      return NextResponse.json({
        error: 'OpenRouter API key not configured'
      }, { status: 500 })
    }

    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.7-sonnet'

    console.log('[LLM API] Using model:', model)
    console.log('[LLM API] API key exists:', !!apiKey)

    // Log the request size
    const requestBody = JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    })
    console.log('[LLM API] Request body size:', requestBody.length, 'bytes')

    const startTime = Date.now()

    // Add timeout for large requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/offbit-ai/zeal',
          'X-Title': 'Zeal Orchestrator',
        },
        body: requestBody,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const responseTime = Date.now() - startTime
      console.log('[LLM API] Response received in', responseTime, 'ms')

      if (!response.ok) {
        const error = await response.text()
        console.error('[LLM API] ❌ OpenRouter API error:', response.status, error)

        // Parse error for better logging
        try {
          const errorData = JSON.parse(error)
          if (errorData.error?.message) {
            console.error('[LLM API] Error message:', errorData.error.message)
          }
          if (errorData.error?.code) {
            console.error('[LLM API] Error code:', errorData.error.code)
          }
        } catch (e) {
          // Not JSON, just log as is
        }

        return NextResponse.json({
          error: 'LLM request failed',
          status: response.status,
          details: error
        }, { status: 500 })
      }

      const data = await response.json()

      // Check if response has the expected structure
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        console.error('[LLM API] ❌ Unexpected response structure:', JSON.stringify(data))
        return NextResponse.json({
          error: 'Invalid LLM response structure',
          details: data
        }, { status: 500 })
      }

      const content = data.choices[0].message.content
      console.log('[LLM API] ✅ Returning response, content length:', content?.length)

      // Log if content is suspiciously short (like just "[]")
      if (content && content.length < 10) {
        console.warn('[LLM API] ⚠️ Response is very short:', content)
      }

      return NextResponse.json({
        content
      })
    } catch (abortError: any) {
      clearTimeout(timeoutId)

      if (abortError.name === 'AbortError') {
        console.error('[LLM API] ❌ Request timed out after 30 seconds')
        return NextResponse.json({
          error: 'LLM request timed out',
          details: 'The request took too long to complete. The prompt might be too large.'
        }, { status: 504 })
      }

      throw abortError // Re-throw if not a timeout error
    }
  } catch (error) {
    console.error('[LLM API] General error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}, {
  resource: 'node',
  action: 'create'
})
