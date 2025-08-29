import { NextRequest, NextResponse } from 'next/server'
import { initializeGraphRAGForOrchestrator } from '@/lib/orchestrator/initialize-graphrag'
import { EmbeddingService } from '@/services/node-template-repository/search/embedding-service'

// Server-side LLM wrapper using OpenRouter
const createServerLLM = () => {
  const apiKey = process.env.OPENROUTER_API_KEY || ''
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.7-sonnet'
  
  if (!apiKey) {
    console.warn('OPENROUTER_API_KEY not set, GraphRAG will use limited functionality')
  }
  
  return {
    invoke: async (prompt: string) => {
      if (!apiKey) {
        throw new Error('OpenRouter API key not configured on server')
      }
      
      try {
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
                content: 'You are an expert at analyzing workflow requirements and extracting intents. Always respond with valid JSON when requested.' 
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 2000,
          }),
        })
        
        if (!response.ok) {
          const error = await response.text()
          throw new Error(`OpenRouter API error: ${response.status} - ${error}`)
        }
        
        const data = await response.json()
        return data.choices[0].message.content
      } catch (error) {
        console.error('LLM invocation failed:', error)
        throw error
      }
    }
  }
}

export const GET = async (request: NextRequest) => {
  try {
    // Check if GraphRAG snapshot exists
    const fs = require('fs').promises
    const path = require('path')
    const snapshotPath = path.join(process.cwd(), 'data', 'graphrag-snapshot.json')
    
    try {
      await fs.access(snapshotPath)
      // Snapshot exists, no need to initialize
      return NextResponse.json({ 
        initialized: true, 
        message: 'GraphRAG snapshot exists' 
      })
    } catch {
      // Snapshot doesn't exist
      return NextResponse.json({ 
        initialized: false, 
        message: 'GraphRAG snapshot not found. Run npm run graphrag:build' 
      }, { status: 404 })
    }
  } catch (error) {
    console.error('Error checking GraphRAG status:', error)
    return NextResponse.json({ 
      error: 'Failed to check GraphRAG status' 
    }, { status: 500 })
  }
}

export const POST = async (request: NextRequest) => {
  try {
    // This endpoint is for runtime GraphRAG operations that need LLM
    // The actual initialization happens at build time
    
    // Create server-side LLM and embedding service
    const llm = createServerLLM()
    const embeddingService = EmbeddingService.fromEnvironment()
    
    // Initialize GraphRAG on server
    const graphRAG = await initializeGraphRAGForOrchestrator(llm, embeddingService)
    
    // Return success status
    return NextResponse.json({ 
      success: true,
      message: 'GraphRAG initialized on server',
      hasLLM: !!process.env.OPENROUTER_API_KEY,
      embeddingVendor: process.env.EMBEDDING_VENDOR || 'mock'
    })
  } catch (error) {
    console.error('Failed to initialize GraphRAG:', error)
    return NextResponse.json({ 
      error: 'Failed to initialize GraphRAG',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
