/**
 * LLM Service for state machine
 * Uses the existing orchestrator LLM API endpoint
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMCallOptions {
  messages: LLMMessage[]
  temperature?: number
  max_tokens?: number
  model?: string
}

export interface LLMResponse {
  content: string
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * LLM Service implementation using existing orchestrator API
 */
export class LLMService {
  /**
   * Make an LLM call via the orchestrator API endpoint
   */
  async call(options: LLMCallOptions): Promise<LLMResponse> {
    try {
      const response = await fetch('/api/orchestrator/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: options.messages,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
          model: options.model
        })
      })
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`API error: ${response.status} - ${error}`)
      }
      
      const data = await response.json()
      return {
        content: data.content || data.choices?.[0]?.message?.content || '',
        usage: data.usage
      }
    } catch (error) {
      console.error('[LLMService] Error calling API:', error)
      throw error
    }
  }
}

/**
 * Singleton instance
 */
let instance: LLMService | null = null

export function getLLMService(): LLMService {
  if (!instance) {
    instance = new LLMService()
  }
  return instance
}