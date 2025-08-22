/**
 * AI-Powered Property Mapper for Orchestrator Agent
 * Uses LLM to intelligently extract and map properties from natural language
 */

const PROPERTY_EXTRACTION_PROMPT = `You are analyzing a user's request to extract configuration properties for a workflow node.

Node Type: {{nodeType}}
User Request: "{{description}}"
Full Context: "{{fullContext}}"

Available Properties for this node:
{{availableProperties}}

Your task:
1. Extract relevant property values from the user's request
2. Map natural language descriptions to appropriate property values
3. Infer reasonable defaults based on context
4. Consider the workflow's overall purpose
5. BE INTELLIGENT: Understand the user's actual needs, not just literal words
6. BE PROACTIVE: Configure ALL relevant properties to make the node actually useful
7. UNDERSTAND CONTEXT: 
   - Weather data → Use weather API URL (e.g., https://api.openweathermap.org/data/2.5/weather)
   - Stock data → Use stock API URL
   - Database operations → Configure connection strings
   - API requests → Set appropriate methods, headers, and authentication
8. CONSIDER USE CASES:
   - If it's an interval trigger for weather data, 5-10 minutes is reasonable
   - For stock data during market hours, 1-2 minutes might be needed
   - For daily reports, consider business hours
   - Match the configuration to the practical use case
9. FOR SELECT FIELDS:
   - ALWAYS use one of the exact option values provided
   - Use contextual understanding to map user intent to the correct option
   - Examples:
     * "send data" or "submit form" → method: "POST"
     * "fetch data" or "retrieve information" → method: "GET"
     * "update record" → method: "PUT" or "PATCH"
     * "remove item" → method: "DELETE"
   - If not specified, infer from context:
     * URLs ending in specific resources usually need GET
     * Actions that create or send data need POST
     * Actions that modify existing data need PUT/PATCH

Examples of intelligent property extraction:
- "fetch weather data" → url: "https://api.openweathermap.org/data/2.5/weather?q=London&appid=\${OPENWEATHER_API_KEY}", method: "GET"
- "submit user registration" → method: "POST", headers: {"Content-Type": "application/json"}
- "update user profile" → method: "PUT"
- "query users" → operationType: "query"
- "modify user data" → operationType: "mutation"

IMPORTANT: For properties with options, you MUST select from the provided options exactly as they appear.

Return ONLY a JSON object with the extracted properties. Be comprehensive and intelligent in your configuration.`

export class PropertyMapper {
  private openRouterApiKey: string
  private model: string

  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ''
    this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'
  }

  /**
   * Extract properties using AI from natural language description
   */
  async extractProperties(
    description: string,
    nodeType?: string,
    availableProperties?: Record<string, any>,
    fullContext?: string
  ): Promise<Record<string, any>> {
    try {
      const prompt = this.buildExtractionPrompt(
        description,
        nodeType,
        availableProperties,
        fullContext
      )

      const response = await this.callLLM(prompt)

      // Parse the JSON response
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim()
      const properties = JSON.parse(cleanResponse)

      // Validate and correct select field values
      return this.validateSelectOptions(properties, availableProperties)
    } catch (error) {
      console.error('Property extraction failed:', error)
      return {}
    }
  }

  /**
   * Extract properties for a specific node with context
   */
  async extractForNode(
    nodeType: string,
    description: string,
    context?: {
      previousNodes?: Array<{ type: string; properties: any }>
      workflowIntent?: string
      nodeSchema?: any
    }
  ): Promise<Record<string, any>> {
    // Get the full context for better extraction
    const fullContext = this.buildFullContext(context)

    // Extract available properties from node schema if provided
    const availableProperties = context?.nodeSchema?.properties || {}

    return this.extractProperties(description, nodeType, availableProperties, fullContext)
  }

  /**
   * Build the extraction prompt
   */
  private buildExtractionPrompt(
    description: string,
    nodeType?: string,
    availableProperties?: Record<string, any>,
    fullContext?: string
  ): string {
    let prompt = PROPERTY_EXTRACTION_PROMPT.replace('{{nodeType}}', nodeType || 'generic')
      .replace('{{description}}', description)
      .replace('{{fullContext}}', fullContext || description)

    // Add available properties information
    let propsInfo = ''
    if (availableProperties && Object.keys(availableProperties).length > 0) {
      propsInfo = Object.entries(availableProperties)
        .map(([key, schema]) => {
          let info = `- ${key}:`
          if (schema.type) info += ` (${schema.type})`
          if (schema.label) info += ` ${schema.label}`
          if (schema.description) info += ` - ${schema.description}`
          if (schema.options) {
            info += ` Options: ${JSON.stringify(schema.options)}`
            // Add hints for common options
            if (key === 'method' && schema.options.includes('POST')) {
              info += ' (Use POST for sending data, GET for fetching)'
            }
            if (key === 'provider' && schema.options.includes('sendgrid')) {
              info += ' (Choose based on mentioned service: sendgrid, mailgun, ses, smtp)'
            }
          }
          if (schema.defaultValue !== undefined)
            info += ` Default: ${JSON.stringify(schema.defaultValue)}`
          return info
        })
        .join('\n')
    } else {
      propsInfo =
        'No specific property schema available. Infer appropriate properties based on node type and context.'
    }

    prompt = prompt.replace('{{availableProperties}}', propsInfo)

    return prompt
  }

  /**
   * Build full context from available information
   */
  private buildFullContext(context?: any): string {
    const parts: string[] = []

    if (context?.workflowIntent) {
      parts.push(`Workflow Purpose: ${context.workflowIntent}`)
    }

    if (context?.previousNodes?.length) {
      const prevNodes = context.previousNodes
        .map((n: any) => `${n.type} (${JSON.stringify(n.properties || {})})`)
        .join(', ')
      parts.push(`Previous Nodes: ${prevNodes}`)
    }

    return parts.join('\n')
  }

  /**
   * Call LLM for property extraction
   */
  private async callLLM(prompt: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        'X-Title': 'Zeal Property Mapper',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert at extracting configuration properties from natural language descriptions. Always return valid JSON. For select fields, you MUST use one of the exact option values provided - do not make up your own values.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent extraction
        max_tokens: 1000,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  /**
   * Validate and correct select field values to match available options
   */
  private validateSelectOptions(
    properties: Record<string, any>,
    availableProperties?: Record<string, any>
  ): Record<string, any> {
    if (!availableProperties) return properties

    const validated = { ...properties }

    for (const [key, value] of Object.entries(properties)) {
      const propSchema = availableProperties[key]
      if (propSchema?.type === 'select' && propSchema.options) {
        const options = propSchema.options as string[]

        // Check if the value matches any option exactly
        if (options.includes(value)) {
          continue
        }

        // Try case-insensitive match
        const lowerValue = String(value).toLowerCase()
        const matchedOption = options.find(opt => opt.toLowerCase() === lowerValue)

        if (matchedOption) {
          validated[key] = matchedOption
          console.log(
            `[PropertyMapper] Corrected '${key}' value from '${value}' to '${matchedOption}'`
          )
        } else {
          // Try intelligent mapping
          const mapped = this.mapToOption(value, options, key)
          if (mapped) {
            validated[key] = mapped
            console.log(`[PropertyMapper] Mapped '${key}' value from '${value}' to '${mapped}'`)
          } else {
            // Use default value if available
            if (propSchema.defaultValue !== undefined) {
              validated[key] = propSchema.defaultValue
              console.warn(
                `[PropertyMapper] No match for '${key}' value '${value}', using default: ${propSchema.defaultValue}`,
                `Available options: ${options.join(', ')}`
              )
            } else {
              // Use first option as fallback
              validated[key] = options[0]
              console.warn(
                `[PropertyMapper] No match for '${key}' value '${value}', using first option: ${options[0]}`,
                `Available options: ${options.join(', ')}`
              )
            }
          }
        }
      }
    }

    return validated
  }

  /**
   * Intelligently map values to correct option values using fuzzy matching
   */
  private mapToOption(value: any, options: string[], propertyKey: string): string | null {
    const valueStr = String(value).toLowerCase().trim()

    // First, try exact match (case-insensitive)
    for (const option of options) {
      if (option.toLowerCase() === valueStr) {
        return option
      }
    }

    // Remove common separators and try again
    const normalizedValue = valueStr.replace(/[-_\s]+/g, '')
    for (const option of options) {
      const normalizedOption = option.toLowerCase().replace(/[-_\s]+/g, '')
      if (normalizedOption === normalizedValue) {
        return option
      }
    }

    // Try substring matching - if the value is contained in an option or vice versa
    for (const option of options) {
      const optionLower = option.toLowerCase()
      if (optionLower.includes(valueStr) || valueStr.includes(optionLower)) {
        return option
      }
    }

    // Calculate similarity scores for fuzzy matching
    const scores = options.map(option => ({
      option,
      score: this.calculateSimilarity(valueStr, option.toLowerCase()),
    }))

    // Sort by score and take the best match if it's above threshold
    scores.sort((a, b) => b.score - a.score)
    if (scores[0] && scores[0].score > 0.6) {
      return scores[0].option
    }

    return null
  }

  /**
   * Calculate similarity between two strings using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1

    if (longer.length === 0) {
      return 1.0
    }

    const editDistance = this.levenshteinDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  /**
   * Enhance extracted properties with smart defaults
   */
  async enhanceWithDefaults(
    properties: Record<string, any>,
    nodeType: string,
    context?: any
  ): Promise<Record<string, any>> {
    const enhanced = { ...properties }

    // Let AI suggest additional properties based on context
    const enhancementPrompt = `Given these extracted properties for a ${nodeType} node:
${JSON.stringify(properties, null, 2)}

And this context:
${JSON.stringify(context, null, 2)}

Suggest any additional properties that would be helpful but weren't explicitly mentioned.
Consider common patterns and best practices.

Return ONLY a JSON object with additional properties to add. If none needed, return {}`

    try {
      const response = await this.callLLM(enhancementPrompt)
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim()
      const additions = JSON.parse(cleanResponse)

      // Merge additions
      Object.assign(enhanced, additions)
    } catch (error) {
      console.error('Property enhancement failed:', error)
    }

    return enhanced
  }
}

// Singleton instance
export const propertyMapper = new PropertyMapper()
