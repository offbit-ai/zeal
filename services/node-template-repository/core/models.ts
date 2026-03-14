/**
 * Core data models for Node Template Repository
 */

export enum TemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

export enum NodeShape {
  RECTANGLE = 'rectangle',
  ROUNDED = 'rounded',
  CIRCLE = 'circle',
  DIAMOND = 'diamond',
  HEXAGON = 'hexagon',
}

export interface TemplateSource {
  type: 'file' | 'api' | 'script' | 'manual' | 'generated' | 'zip'
  location?: string
  schema?: any
  generatorVersion?: string
}

export interface Port {
  id: string
  label: string
  type: 'input' | 'output'
  position?: 'left' | 'right' | 'top' | 'bottom'
  description?: string
  schema?: any
  required?: boolean
  multiple?: boolean
}

export interface PropertyDefinition {
  type: string
  label: string
  defaultValue?: any
  description?: string
  required?: boolean
  options?: any[]
  validation?: any
  visibleWhen?: string
  format?: string
  placeholder?: string
  min?: number
  max?: number
  readOnly?: boolean
  multiple?: boolean
  language?: string // For code-editor type
}

export interface PropertyRule {
  when: string
  updates: {
    title?: string
    subtitle?: string
    icon?: string
    variant?: string
    description?: string
    ports?: Port[]
  }
}

export interface PropertyRules {
  triggers: string[]
  rules: PropertyRule[]
}

export interface NodeTemplate {
  // Identity
  id: string
  version: string
  status: TemplateStatus
  type: string
  // Metadata
  title: string
  subtitle?: string
  description: string
  category: string
  subcategory?: string
  tags: string[]

  // Visual
  icon: string
  variant?: string
  shape: NodeShape
  size: 'small' | 'medium' | 'large'

  // Structure
  ports: Port[]
  properties: Record<string, PropertyDefinition>
  propertyRules?: PropertyRules

  // Custom display component (Web Component for external plugins)
  display?: DisplayComponent

  // Requirements
  requiredEnvVars?: string[]
  dependencies?: string[]

  // Source
  source: TemplateSource

  // Metadata
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  isActive: boolean
  tenantId?: string // For multi-tenant setups
}

/**
 * Display component specification for custom node rendering.
 * External templates registered via ZIP can ship a Web Component bundle
 * that renders inside the node body.
 */
export interface DisplayComponent {
  /** Custom element tag name (e.g. 'zeal-chart-node'). Must contain a hyphen per spec. */
  element: string
  /** Reference to an uploaded bundle served by Zeal (populated after upload). */
  bundleId?: string
  /** Inline JS source for small components (alternative to bundleId). */
  source?: string
  /** Use Shadow DOM for style isolation. Default: true */
  shadow?: boolean
  /** Property names forwarded to the Web Component as JS properties. */
  observedProps?: string[]
  /** Custom width override for the node when this display is active. */
  width?: string
}

export interface TemplateEmbeddings {
  title: Float32Array
  description: Float32Array
  combined: Float32Array
  capabilities: Float32Array
  useCase: Float32Array
}

export interface TemplateRepository {
  id: string
  templateId: string
  templateData: NodeTemplate

  // Embeddings
  embeddings: TemplateEmbeddings

  // Extracted metadata
  capabilities: string[]
  inputTypes: string[]
  outputTypes: string[]
  useCases: string[]

  // Relationships
  relationships: {
    commonlyUsedWith: string[]
    alternatives: string[]
    upgrades: string[]
    requiredTemplates: string[]
  }

  // Statistics
  stats: {
    usageCount: number
    averageRating: number
    lastUsed?: Date
    errorRate: number
    averageExecutionTime?: number
  }

  // Search optimization
  searchText: string
  searchVector: Float32Array
  keywords: string[]

  // Versioning
  versions: TemplateVersion[]
  latestVersion: string

  // Audit
  createdAt: Date
  updatedAt: Date
  indexedAt: Date
  lastValidated?: Date
}

export interface TemplateVersion {
  id: string
  templateId: string
  version: string
  changes: VersionChange[]
  releaseNotes?: string
  breaking: boolean
  deprecated: boolean
  createdAt: Date
  createdBy: string
}

export interface VersionChange {
  type: 'added' | 'modified' | 'removed' | 'deprecated'
  field: string
  description: string
  breaking: boolean
}

export interface DynamicTemplate {
  id: string
  name: string
  sourceType: 'api' | 'script' | 'database' | 'graphql'

  // API-based templates
  apiDefinition?: {
    openApiSpec?: string
    endpoint: string
    method: string
    authentication?: any
    headers?: Record<string, string>
    requestSchema?: any
    responseSchema?: any
  }

  // Script-based templates
  scriptDefinition?: {
    language: 'javascript' | 'python' | 'sql'
    code: string
    runtime?: string
    dependencies?: string[]
  }

  // Generation config
  generationRules: {
    portMapping: any[]
    propertyMapping: any[]
    errorHandling: any
  }

  // Generated template
  generatedTemplate?: NodeTemplate
  generatedAt?: Date
  validationStatus?: 'pending' | 'valid' | 'invalid'
}

// Search related types
export interface SearchQuery {
  query: string
  category?: string
  subcategory?: string
  tags?: string[]
  capabilities?: string[]
  limit?: number
  offset?: number
  includeDeprecated?: boolean
}

export interface SearchResult {
  template: NodeTemplate
  score: number
  highlights: {
    title?: string
    description?: string
    capabilities?: string[]
  }
  relatedTemplates?: string[]
}

// Ingestion types
export interface IngestionResult {
  processed: number
  succeeded: number
  failed: number
  skipped: number
  errors: Array<{
    file: string
    error: string
  }>
}

export interface TemplateFile {
  path: string
  category: string
  lastModified: Date
}
