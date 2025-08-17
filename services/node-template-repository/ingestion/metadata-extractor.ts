/**
 * Metadata extraction for node templates
 * Analyzes templates to extract capabilities, use cases, and relationships
 */

import { NodeTemplate, Port } from '../core/models'

export interface TemplateMetadata {
  capabilities: string[]
  inputTypes: string[]
  outputTypes: string[]
  useCases: string[]
  keywords: string[]
  complexity: 'simple' | 'intermediate' | 'advanced'
}

export class MetadataExtractor {
  async extractMetadata(template: NodeTemplate): Promise<TemplateMetadata> {
    return {
      capabilities: this.extractCapabilities(template),
      inputTypes: this.extractInputTypes(template),
      outputTypes: this.extractOutputTypes(template),
      useCases: this.generateUseCases(template),
      keywords: this.extractKeywords(template),
      complexity: this.calculateComplexity(template),
    }
  }

  private extractCapabilities(template: NodeTemplate): string[] {
    const capabilities = new Set<string>()

    // From template category
    const categoryCapabilities = this.getCategoryCapabilities(template.category)
    categoryCapabilities.forEach(c => capabilities.add(c))

    // From template type/title
    const typeCapabilities = this.extractFromTitle(template.title)
    typeCapabilities.forEach(c => capabilities.add(c))

    // From properties - comprehensive extraction
    if (template.properties) {
      Object.entries(template.properties).forEach(([key, prop]) => {
        // Add property existence as capability
        capabilities.add(`has-property-${key.toLowerCase().replace(/[\s_]/g, '-')}`)

        // Type-based capabilities
        capabilities.add(`property-type-${prop.type}`)

        // Required properties are important capabilities
        if (prop.required) {
          capabilities.add(`requires-${key.toLowerCase().replace(/[\s_]/g, '-')}`)
        }

        // Extract from property labels and descriptions
        if (prop.label) {
          const labelCaps = this.extractCapabilitiesFromText(prop.label)
          labelCaps.forEach(c => capabilities.add(c))
        }

        if (prop.description) {
          const descCaps = this.extractCapabilitiesFromText(prop.description)
          descCaps.forEach(c => capabilities.add(c))
        }

        // Specific property patterns
        if (prop.type === 'select' && prop.options) {
          prop.options.forEach((option: any) => {
            const optValue = typeof option === 'string' ? option : option.value || option.label
            if (optValue) {
              capabilities.add(`${key}-option-${optValue}`.toLowerCase().replace(/[\s_]/g, '-'))
            }
          })
        }

        if (prop.type === 'code-editor') {
          capabilities.add('code-execution')
          if (prop.language) {
            capabilities.add(`language-${prop.language}`)
          }
        }

        if (prop.type === 'file') {
          capabilities.add('file-handling')
          capabilities.add('file-upload')
        }

        if (prop.type === 'dataOperations') {
          capabilities.add('data-transformation')
          capabilities.add('data-mapping')
        }

        if (prop.type === 'rules') {
          capabilities.add('rule-based-logic')
          capabilities.add('conditional-processing')
        }

        // Common property key patterns
        const keyLower = key.toLowerCase()
        if (keyLower.includes('api')) capabilities.add('api-integration')
        if (keyLower.includes('url')) capabilities.add('web-access')
        if (keyLower.includes('endpoint')) capabilities.add('endpoint-configuration')
        if (keyLower.includes('auth')) capabilities.add('authentication')
        if (keyLower.includes('key')) capabilities.add('api-key-required')
        if (keyLower.includes('model')) capabilities.add('ai-powered')
        if (keyLower.includes('prompt')) capabilities.add('prompt-based')
        if (keyLower.includes('query')) capabilities.add('query-support')
        if (keyLower.includes('filter')) capabilities.add('data-filtering')
        if (keyLower.includes('transform')) capabilities.add('data-transformation')
      })
    }

    // From environment variables
    if (template.requiredEnvVars && template.requiredEnvVars.length > 0) {
      capabilities.add('environment-dependent')
      template.requiredEnvVars.forEach(envVar => {
        capabilities.add(`env-${envVar.toLowerCase().replace(/_/g, '-')}`)
      })
    }

    // From ports
    template.ports.forEach(port => {
      if (port.type === 'input') {
        capabilities.add(`accepts-${this.normalizePortName(port.label)}`)
      } else {
        capabilities.add(`produces-${this.normalizePortName(port.label)}`)
      }
    })

    // Category-specific capabilities
    capabilities.add(`category-${template.category}`)
    if (template.subcategory) {
      capabilities.add(`subcategory-${template.subcategory}`)
    }

    return Array.from(capabilities)
  }

  private extractInputTypes(template: NodeTemplate): string[] {
    const types = new Set<string>()

    template.ports
      .filter(port => port.type === 'input')
      .forEach(port => {
        const type = this.extractPortType(port)
        if (type) types.add(type)
      })

    return Array.from(types)
  }

  private extractOutputTypes(template: NodeTemplate): string[] {
    const types = new Set<string>()

    template.ports
      .filter(port => port.type === 'output')
      .forEach(port => {
        const type = this.extractPortType(port)
        if (type) types.add(type)
      })

    return Array.from(types)
  }

  private extractPortType(port: Port): string {
    // From schema
    if (port.schema) {
      if (typeof port.schema === 'string') return port.schema
      if (port.schema.type) return port.schema.type
    }

    // From label patterns
    const label = port.label.toLowerCase()

    if (label.includes('text') || label.includes('string')) return 'text'
    if (label.includes('number') || label.includes('integer')) return 'number'
    if (label.includes('bool')) return 'boolean'
    if (label.includes('array') || label.includes('list')) return 'array'
    if (label.includes('object') || label.includes('json')) return 'object'
    if (label.includes('file')) return 'file'
    if (label.includes('image')) return 'image'
    if (label.includes('audio')) return 'audio'
    if (label.includes('video')) return 'video'
    if (label.includes('data')) return 'data'
    if (label.includes('message')) return 'message'
    if (label.includes('response')) return 'response'
    if (label.includes('result')) return 'result'
    if (label.includes('error')) return 'error'

    return 'any'
  }

  private generateUseCases(template: NodeTemplate): string[] {
    const useCases = new Set<string>()

    // Category-based use cases
    const categoryUseCases = this.getCategoryUseCases(template.category)
    categoryUseCases.forEach(uc => useCases.add(uc))

    // Title-based use cases
    const titleUseCases = this.extractUseCasesFromText(template.title)
    titleUseCases.forEach(uc => useCases.add(uc))

    // Description-based use cases
    if (template.description) {
      const descUseCases = this.extractUseCasesFromText(template.description)
      descUseCases.forEach(uc => useCases.add(uc))
    }

    // Template-specific patterns
    if (template.category === 'data-sources') {
      useCases.add('data-ingestion')
      useCases.add('data-retrieval')
      useCases.add('data-connection')
      useCases.add('external-integration')
    }

    if (template.category === 'ai-models') {
      useCases.add('ai-processing')
      useCases.add('intelligent-automation')
      useCases.add('natural-language')
      useCases.add('content-generation')
    }

    if (template.category === 'data-processing') {
      useCases.add('data-transformation')
      useCases.add('data-manipulation')
      useCases.add('data-analysis')
      useCases.add('etl-pipeline')
    }

    if (template.category === 'communication') {
      useCases.add('messaging')
      useCases.add('notifications')
      useCases.add('real-time-communication')
      useCases.add('api-integration')
    }

    return Array.from(useCases)
  }

  private extractKeywords(template: NodeTemplate): string[] {
    const keywords = new Set<string>()

    // From title
    const titleWords = template.title
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.isStopWord(word))
    titleWords.forEach(w => keywords.add(w))

    // From description
    if (template.description) {
      const descWords = template.description
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isStopWord(word))
      descWords.slice(0, 10).forEach(w => keywords.add(w)) // Limit to first 10
    }

    // From tags
    template.tags.forEach(tag => keywords.add(tag.toLowerCase()))

    // From category
    keywords.add(template.category)
    if (template.subcategory) {
      keywords.add(template.subcategory)
    }

    // Technology-specific keywords
    if (template.title.toLowerCase().includes('openai')) {
      keywords.add('openai')
      keywords.add('gpt')
    }

    if (template.title.toLowerCase().includes('langchain')) {
      keywords.add('langchain')
      keywords.add('llm')
    }

    if (
      template.title.toLowerCase().includes('database') ||
      template.title.toLowerCase().includes('sql')
    ) {
      keywords.add('database')
      keywords.add('sql')
      keywords.add('query')
    }

    return Array.from(keywords)
  }

  private calculateComplexity(template: NodeTemplate): 'simple' | 'intermediate' | 'advanced' {
    let score = 0

    // Port count
    const portCount = template.ports.length
    if (portCount <= 2) score += 1
    else if (portCount <= 4) score += 2
    else score += 3

    // Property count
    const propCount = Object.keys(template.properties).length
    if (propCount <= 3) score += 1
    else if (propCount <= 6) score += 2
    else score += 3

    // Has property rules
    if (template.propertyRules) score += 2

    // Has dependencies
    if (template.dependencies && template.dependencies.length > 0) score += 1

    // Has required env vars
    if (template.requiredEnvVars && template.requiredEnvVars.length > 0) score += 1

    // Complex port schemas
    const hasComplexSchemas = template.ports.some(
      port =>
        port.schema &&
        typeof port.schema === 'object' &&
        (port.schema.type === 'object' || port.schema.type === 'array')
    )
    if (hasComplexSchemas) score += 2

    // Determine complexity
    if (score <= 4) return 'simple'
    if (score <= 8) return 'intermediate'
    return 'advanced'
  }

  private getCategoryCapabilities(category: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      'data-sources': ['data-access', 'data-fetch', 'external-api', 'data-import'],
      'ai-models': ['ai-processing', 'text-generation', 'analysis', 'prediction'],
      'data-processing': ['transform', 'filter', 'aggregate', 'manipulate'],
      communication: ['send-message', 'receive-message', 'webhook', 'notification'],
      'storage-memory': ['store-data', 'retrieve-data', 'cache', 'persist'],
      'logic-control': ['conditional', 'loop', 'branch', 'flow-control'],
      scripting: ['execute-code', 'custom-logic', 'automation'],
      'tools-utilities': ['utility', 'helper', 'conversion', 'formatting'],
      'user-inputs': ['user-interaction', 'form-input', 'user-data'],
      'graph-io': ['subgraph', 'graph-input', 'graph-output', 'composition'],
    }

    return capabilityMap[category] || []
  }

  private getCategoryUseCases(category: string): string[] {
    const useCaseMap: Record<string, string[]> = {
      'data-sources': ['data-ingestion', 'api-integration', 'data-fetching', 'external-systems'],
      'ai-models': ['content-generation', 'text-analysis', 'chatbots', 'automation'],
      'data-processing': ['etl', 'data-pipeline', 'data-cleaning', 'transformation'],
      communication: ['notifications', 'messaging', 'alerts', 'webhooks'],
      'storage-memory': ['data-persistence', 'caching', 'state-management', 'backup'],
      'logic-control': ['workflow-orchestration', 'conditional-logic', 'decision-making'],
      scripting: ['custom-automation', 'data-manipulation', 'integration'],
      'tools-utilities': ['data-conversion', 'formatting', 'validation', 'helpers'],
      'user-inputs': ['forms', 'user-interaction', 'data-collection', 'configuration'],
      'graph-io': ['modular-workflows', 'reusable-components', 'workflow-composition'],
    }

    return useCaseMap[category] || []
  }

  private extractCapabilitiesFromText(text: string): string[] {
    const capabilities = new Set<string>()
    const textLower = text.toLowerCase()

    // Common capability patterns
    const patterns = [
      { pattern: /supports?\s+(\w+)/gi, prefix: 'supports-' },
      { pattern: /handles?\s+(\w+)/gi, prefix: 'handles-' },
      { pattern: /processes?\s+(\w+)/gi, prefix: 'processes-' },
      { pattern: /generates?\s+(\w+)/gi, prefix: 'generates-' },
      { pattern: /creates?\s+(\w+)/gi, prefix: 'creates-' },
      { pattern: /transforms?\s+(\w+)/gi, prefix: 'transforms-' },
      { pattern: /converts?\s+(\w+)/gi, prefix: 'converts-' },
      { pattern: /accepts?\s+(\w+)/gi, prefix: 'accepts-' },
      { pattern: /returns?\s+(\w+)/gi, prefix: 'returns-' },
      { pattern: /uses?\s+(\w+)/gi, prefix: 'uses-' },
    ]

    patterns.forEach(({ pattern, prefix }) => {
      let match
      while ((match = pattern.exec(textLower)) !== null) {
        if (match[1] && !this.isStopWord(match[1])) {
          capabilities.add(`${prefix}${match[1]}`)
        }
      }
    })

    return Array.from(capabilities)
  }

  private extractFromTitle(title: string): string[] {
    const capabilities: string[] = []
    const lower = title.toLowerCase()

    // Common patterns
    if (lower.includes('generate')) capabilities.push('generation')
    if (lower.includes('analyze')) capabilities.push('analysis')
    if (lower.includes('process')) capabilities.push('processing')
    if (lower.includes('transform')) capabilities.push('transformation')
    if (lower.includes('filter')) capabilities.push('filtering')
    if (lower.includes('search')) capabilities.push('searching')
    if (lower.includes('extract')) capabilities.push('extraction')
    if (lower.includes('validate')) capabilities.push('validation')
    if (lower.includes('convert')) capabilities.push('conversion')
    if (lower.includes('send')) capabilities.push('sending')
    if (lower.includes('receive')) capabilities.push('receiving')
    if (lower.includes('store')) capabilities.push('storage')
    if (lower.includes('fetch')) capabilities.push('fetching')
    if (lower.includes('create')) capabilities.push('creation')
    if (lower.includes('update')) capabilities.push('updating')
    if (lower.includes('delete')) capabilities.push('deletion')

    return capabilities
  }

  private extractUseCasesFromText(text: string): string[] {
    const useCases: string[] = []
    const lower = text.toLowerCase()

    // Common use case patterns
    const patterns = [
      { pattern: /data\s+(processing|transformation|analysis)/g, useCase: 'data-processing' },
      { pattern: /api\s+(integration|connection|access)/g, useCase: 'api-integration' },
      { pattern: /real[\s-]?time/g, useCase: 'real-time-processing' },
      { pattern: /batch\s+processing/g, useCase: 'batch-processing' },
      { pattern: /machine\s+learning|ml\s+|ai\s+/g, useCase: 'machine-learning' },
      { pattern: /natural\s+language/g, useCase: 'nlp-processing' },
      { pattern: /image\s+(processing|analysis|generation)/g, useCase: 'image-processing' },
      { pattern: /workflow\s+automation/g, useCase: 'workflow-automation' },
      { pattern: /data\s+validation/g, useCase: 'data-validation' },
      { pattern: /error\s+handling/g, useCase: 'error-handling' },
      { pattern: /monitoring|logging/g, useCase: 'monitoring-logging' },
      { pattern: /notification|alert/g, useCase: 'notifications' },
    ]

    patterns.forEach(({ pattern, useCase }) => {
      if (pattern.test(lower)) {
        useCases.push(useCase)
      }
    })

    return useCases
  }

  private normalizePortName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'from',
      'as',
      'is',
      'was',
      'are',
      'were',
      'been',
      'be',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'this',
      'that',
      'these',
      'those',
      'it',
      'its',
      'not',
      'all',
      'some',
      'any',
      'no',
    ])

    return stopWords.has(word)
  }
}
