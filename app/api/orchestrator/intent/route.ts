import { NextRequest, NextResponse } from 'next/server'
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'

// Server-side intent extraction using OpenRouter
export const POST = withAuth(async (request: AuthenticatedRequest, context?: { params: any }) => {
  try {
    const { query } = await request.json()
    
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }
    
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ 
        error: 'OpenRouter API key not configured' 
      }, { status: 500 })
    }
    
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.7-sonnet'
    
    // Extract intent using LLM
    const prompt = `Extract the workflow intent from this request:
"${query}"

Return a JSON object with - ONLY JSON, NO MARKDOWN, NO EXPLANATIONS, NO ADDITIONAL TEXT:
- action: main action the user wants to perform
- services: array of service names mentioned (e.g., ["slack", "github"])
- capabilities: array of required capabilities (e.g., ["send", "receive", "transform"])
- dataFlow: array describing the flow (e.g., ["receive_github_pr", "transform_data", "send_slack_message"])

Be specific about services - if user says "Slack", include "slack" in services.
If they mention GitHub, include "github". Do not generalize.`
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/offbit-ai/zeal',
        'X-Title': 'Zeal Orchestrator',
      },
      body: JSON.stringify({
        model,
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert at analyzing workflow requirements and extracting intents. Always respond with valid JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })
    
    if (!response.ok) {
      const error = await response.text()
      console.error('OpenRouter API error:', error)
      return NextResponse.json({ 
        error: 'Failed to extract intent' 
      }, { status: 500 })
    }
    
    const data = await response.json()
    const intentJson = data.choices[0].message.content
    
    try {
      const intent = JSON.parse(intentJson)
      return NextResponse.json({ intent })
    } catch (parseError) {
      console.error('Failed to parse intent JSON:', intentJson)
      // Return a basic intent as fallback
      return NextResponse.json({ 
        intent: {
          action: 'workflow',
          services: [],
          capabilities: [],
          dataFlow: []
        }
      })
    }
  } catch (error) {
    console.error('Intent extraction error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}, {
  resource: 'workflow',
  action: 'create'
})