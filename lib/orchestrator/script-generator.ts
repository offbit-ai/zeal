/**
 * AI-Powered Script Generator for Orchestrator Agent
 * Generates JavaScript/Python code using LLM based on user requirements
 */

export interface ScriptGenerationRequest {
  language: 'javascript' | 'python' | 'sql'
  description: string
  inputSchema?: Record<string, any>
  outputSchema?: Record<string, any>
  examples?: Array<{
    input: any
    output: any
  }>
  context?: {
    previousNodes?: Array<{ type: string; outputSchema?: any }>
    nextNodes?: Array<{ type: string; inputSchema?: any }>
    workflowPurpose?: string
  }
}

export interface GeneratedScript {
  code: string
  language: string
  description: string
  inputVariables: string[]
  outputVariables: string[]
}

const SCRIPT_GENERATION_PROMPT = `You are an expert programmer tasked with generating a script for a workflow node.

CONTEXT:
- Language: {{language}}
- Purpose: {{description}}
- Input Schema: {{inputSchema}}
- Output Schema: {{outputSchema}}
- Workflow Context: {{workflowContext}}

INTELLIGENT CODE GENERATION:
1. Understand the context and generate appropriate code
2. If the workflow context suggests recurring needs, mention it in comments
3. Focus on the core functionality but make it practical and useful
4. Consider error handling and edge cases that would occur in real usage

REQUIREMENTS:
1. Generate clean, efficient, well-commented code
2. Handle errors gracefully
3. Validate inputs when appropriate
4. Return data in the expected output format
5. Use descriptive variable names
6. Include helpful comments explaining the logic

{{examples}}

For JavaScript:
- MUST define: function process(inputs, context)
- Access input data via the 'inputs' object where each key is a port name
  Example: inputs.data (for port named "data") or inputs['data-in'] (for port "data-in")
  If port has data property: inputs.packet.data (where "packet" is the input port name)
- Send outputs using: context.send_output("outputPortName", data)
  Example: context.send_output("result-out", processedData)
- MUST return a result object (e.g., { success: true, message: "Processed" })
- Can use modern ES6+ features
- Available: console.log, JSON, Math, Date, Array methods, async/await
- Error handling: Use try/catch blocks, send errors to error port if available

For Python:
- NO function definition - code runs directly in the global scope
- MUST get inputs first: inputs = Context.get_inputs()
- Access port data via: inputs.get("portName")
  Example: data = inputs.get("data-in") or inputs.get("packet").data
- MUST set return value: __return_value = your_result
- Can import standard libraries at the top: import json, import pandas as pd, etc.
- Available: All Python standard library, numpy, pandas, requests
- Error handling: Use try/except blocks, set __return_value with error info

Generate ONLY the code, no explanation before or after.`

const VARIABLE_EXTRACTION_PROMPT = `Given this code, extract the input and output variable names.

Code:
{{code}}

Return a JSON object with:
{
  "inputVariables": ["list", "of", "input", "vars"],
  "outputVariables": ["list", "of", "output", "vars"]
}
Respond with JSON format ONLY - NO MARKDOWN, NO EXPLANATIONS, NO ADDITIONAL TEXT`

export class ScriptGenerator {
  private openRouterApiKey: string
  private model: string

  constructor() {
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY || ''
    this.model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet'
  }

  /**
   * Generate script using AI based on description and context
   */
  async generateScript(request: ScriptGenerationRequest): Promise<GeneratedScript> {
    const { language, description, inputSchema, outputSchema, examples, context } = request

    try {
      // Build the prompt
      const prompt = this.buildGenerationPrompt(request)

      // Generate code using LLM
      const code = await this.callLLM(prompt)

      // Extract variables from generated code
      const variables = await this.extractVariables(code, language)

      return {
        code: this.formatCode(code, language),
        language,
        description: this.enhanceDescription(description),
        inputVariables: variables.inputVariables,
        outputVariables: variables.outputVariables,
      }
    } catch (error) {
      console.error('Script generation failed:', error)
      // Fallback to a basic template
      return this.generateFallbackScript(request)
    }
  }

  /**
   * Build the generation prompt with all context
   */
  private buildGenerationPrompt(request: ScriptGenerationRequest): string {
    const { language, description, inputSchema, outputSchema, examples, context } = request

    let prompt = SCRIPT_GENERATION_PROMPT.replace('{{language}}', language)
      .replace('{{description}}', description)
      .replace('{{inputSchema}}', JSON.stringify(inputSchema || {}, null, 2))
      .replace('{{outputSchema}}', JSON.stringify(outputSchema || {}, null, 2))

    // Add workflow context
    let workflowContext = ''
    if (context?.workflowPurpose) {
      workflowContext += `Workflow Purpose: ${context.workflowPurpose}\n`
    }
    if (context?.previousNodes?.length) {
      workflowContext += `Previous Nodes: ${context.previousNodes.map(n => n.type).join(', ')}\n`
    }
    if (context?.nextNodes?.length) {
      workflowContext += `Next Nodes: ${context.nextNodes.map(n => n.type).join(', ')}\n`
    }
    prompt = prompt.replace('{{workflowContext}}', workflowContext || 'None provided')

    // Add examples if provided
    let examplesText = ''
    if (examples?.length) {
      examplesText = '\nEXAMPLES:\n'
      examples.forEach((ex, i) => {
        examplesText += `Example ${i + 1}:\n`
        examplesText += `Input: ${JSON.stringify(ex.input, null, 2)}\n`
        examplesText += `Expected Output: ${JSON.stringify(ex.output, null, 2)}\n\n`
      })
    }
    prompt = prompt.replace('{{examples}}', examplesText)

    return prompt
  }

  /**
   * Call LLM to generate code
   */
  private async callLLM(prompt: string): Promise<string> {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
        'X-Title': 'Zeal Script Generator',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'system',
            content:
              'You are an expert programmer who generates clean, efficient code for workflow automation.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3, // Lower temperature for more consistent code
        max_tokens: 2000,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0].message.content
  }

  /**
   * Extract input/output variables from generated code
   */
  private async extractVariables(
    code: string,
    language: string
  ): Promise<{ inputVariables: string[]; outputVariables: string[] }> {
    try {
      const prompt = VARIABLE_EXTRACTION_PROMPT.replace('{{code}}', code)
      const response = await this.callLLM(prompt)

      // Try to parse JSON response
      const cleanResponse = response.replace(/```json\n?|\n?```/g, '').trim()
      return JSON.parse(cleanResponse)
    } catch (error) {
      // Fallback to simple extraction
      return this.extractVariablesSimple(code, language)
    }
  }

  /**
   * Simple variable extraction fallback
   */
  private extractVariablesSimple(
    code: string,
    language: string
  ): { inputVariables: string[]; outputVariables: string[] } {
    const inputVars: Set<string> = new Set()
    const outputVars: Set<string> = new Set()

    if (language === 'javascript') {
      // Look for inputs.xxx patterns
      const inputMatches = code.match(/inputs\.(\w+)/g) || []
      inputMatches.forEach(match => {
        const varName = match.split('.')[1]
        inputVars.add(varName)
      })

      // Look for context.send_output calls
      const outputMatches = code.match(/context\.send_output\s*\(\s*["'](\w+)["']/g) || []
      outputMatches.forEach(match => {
        const varName = match.match(/["'](\w+)["']/)?.[1]
        if (varName) outputVars.add(varName)
      })
    } else {
      // Python patterns - new format
      // Look for inputs.get("xxx") patterns
      const inputMatches = code.match(/inputs\.get\s*\(\s*["'](\w+)["']\)/g) || []
      inputMatches.forEach(match => {
        const varName = match.match(/["'](\w+)["']/)?.[1]
        if (varName) inputVars.add(varName)
      })

      // Look for __return_value assignment
      if (code.includes('__return_value')) {
        outputVars.add('__return_value')
      }
    }

    return {
      inputVariables: Array.from(inputVars),
      outputVariables: Array.from(outputVars),
    }
  }

  /**
   * Format generated code
   */
  private formatCode(code: string, language: string): string {
    // Remove any markdown code blocks if present
    code = code.replace(/```(?:javascript|js|python|py)?\n?/g, '').replace(/```$/g, '')

    // Trim whitespace
    code = code.trim()

    // Ensure proper indentation (basic)
    if (language === 'javascript') {
      // Basic JS formatting
      code = code.replace(/\s*{\s*/g, ' {\n  ')
      code = code.replace(/\s*}\s*/g, '\n}')
      code = code.replace(/;\s*/g, ';\n')
    }

    return code
  }

  /**
   * Enhance description for clarity
   */
  private enhanceDescription(description: string): string {
    // Capitalize first letter
    const enhanced = description.charAt(0).toUpperCase() + description.slice(1)

    // Add period if missing
    if (!enhanced.match(/[.!?]$/)) {
      return enhanced + '.'
    }

    return enhanced
  }

  /**
   * Generate fallback script when AI generation fails
   */
  private generateFallbackScript(request: ScriptGenerationRequest): GeneratedScript {
    const { language, description, inputSchema, outputSchema } = request

    let code: string
    if (language === 'javascript') {
      code = `// ${description}
// This is a fallback template - customize as needed

function process(inputs, context) {
  try {
    // TODO: Implement your logic here
    // Access input data from the input port (adjust port name as needed)
    const inputData = inputs.input || {};
    const data = inputData.data || inputData;
    
    // Send output to the next node
    context.send_output("output", {
      processed: true,
      data: data
    });
    
    // Return execution status
    return { success: true };
  } catch (error) {
    console.error('Processing error:', error);
    
    // Send error output
    context.send_output("error", {
      message: error.message
    });
    
    return { 
      success: false, 
      error: error.message 
    };
  }
}`
    } else {
      code = `# ${description}
# This is a fallback template - customize as needed

try:
    # Get inputs
    inputs = Context.get_inputs()
    
    # TODO: Implement your logic here
    # Access input data from the input port (adjust port name as needed)
    input_data = inputs.get("input")
    data = input_data.data if hasattr(input_data, 'data') else input_data
    
    # Process the data
    result = {
        'processed': True,
        'data': data
    }
    
    # Return the result
    __return_value = result
    
except Exception as e:
    print(f'Processing error: {e}')
    
    # Return error
    __return_value = {
        'success': False,
        'error': str(e)
    }`
    }

    return {
      code,
      language,
      description: `Fallback template: ${description}`,
      inputVariables: inputSchema ? Object.keys(inputSchema) : ['data'],
      outputVariables: outputSchema ? Object.keys(outputSchema) : ['processed', 'data', 'error'],
    }
  }

  /**
   * Generate script for custom functionality when no template exists
   */
  async generateCustomNodeScript(
    functionality: string,
    context?: {
      inputFromPrevious?: any
      outputToNext?: any
      workflowPurpose?: string
    }
  ): Promise<GeneratedScript> {
    // Analyze the functionality to determine best approach
    const analysis = await this.analyzeFunctionality(functionality)

    const request: ScriptGenerationRequest = {
      language: 'javascript', // Default to JS for web environment
      description: functionality,
      inputSchema: context?.inputFromPrevious || { data: 'any' },
      outputSchema: context?.outputToNext || { result: 'any' },
      context: {
        workflowPurpose: context?.workflowPurpose,
      },
    }

    // Add specific guidance based on analysis
    if (analysis.suggestedApproach) {
      request.description = `${functionality}\n\nSuggested approach: ${analysis.suggestedApproach}`
    }

    return this.generateScript(request)
  }

  /**
   * Analyze requested functionality to provide better code generation
   */
  private async analyzeFunctionality(
    functionality: string
  ): Promise<{ type: string; suggestedApproach?: string }> {
    const funcLower = functionality.toLowerCase()

    // Pattern matching for common operations
    if (funcLower.includes('api') || funcLower.includes('webhook') || funcLower.includes('http')) {
      return {
        type: 'api-integration',
        suggestedApproach: 'Parse API response, extract needed fields, handle errors',
      }
    }

    if (
      funcLower.includes('transform') ||
      funcLower.includes('convert') ||
      funcLower.includes('map')
    ) {
      return {
        type: 'data-transformation',
        suggestedApproach: 'Map input fields to output format, handle missing data',
      }
    }

    if (
      funcLower.includes('validate') ||
      funcLower.includes('check') ||
      funcLower.includes('verify')
    ) {
      return {
        type: 'validation',
        suggestedApproach: 'Check data constraints, return validation results with specific errors',
      }
    }

    if (
      funcLower.includes('filter') ||
      funcLower.includes('select') ||
      funcLower.includes('query')
    ) {
      return {
        type: 'filtering',
        suggestedApproach: 'Filter data based on conditions, return matching items',
      }
    }

    if (
      funcLower.includes('calculate') ||
      funcLower.includes('compute') ||
      funcLower.includes('aggregate')
    ) {
      return {
        type: 'calculation',
        suggestedApproach: 'Perform calculations on input data, return computed results',
      }
    }

    return { type: 'custom' }
  }
}

// Singleton instance
export const scriptGenerator = new ScriptGenerator()
