# Node Template Repository Service - Technical Specification

**Version:** 1.0.0  
**Date:** 2024  
**Status:** Draft

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Data Models](#3-data-models)
4. [Template Ingestion System](#4-template-ingestion-system)
5. [Dynamic Template Generation](#5-dynamic-template-generation)
6. [Semantic Search Engine](#6-semantic-search-engine)
7. [API Specifications](#7-api-specifications)
8. [Model Context Protocol (MCP) Server](#8-model-context-protocol-mcp-server)
9. [User Interface Components](#9-user-interface-components)
10. [Integration Points](#10-integration-points)
11. [Security & Access Control](#11-security--access-control)
12. [Performance Requirements](#12-performance-requirements)
13. [Deployment & Operations](#13-deployment--operations)
14. [Testing Strategy](#14-testing-strategy)
15. [Migration Plan](#15-migration-plan)

---

## 1. Executive Summary

### 1.1 Purpose

The Node Template Repository Service provides a centralized, intelligent system for managing, discovering, and composing workflow node templates in the Zeal platform. It combines semantic search capabilities with AI accessibility through the Model Context Protocol.

### 1.2 Goals

- Enable natural language discovery of node templates
- Support dynamic template generation from APIs and scripts
- Provide AI agents with structured access to template knowledge
- Facilitate automatic workflow composition
- Maintain backward compatibility with existing file-based templates

### 1.3 Non-Goals

- Managing node instances (only templates)
- Workflow execution
- Real-time collaboration features
- User authentication (delegates to main Zeal system)

### 1.4 Success Criteria

- **Search Accuracy**: >90% relevance for top-3 results
- **Response Time**: <200ms for semantic search
- **Template Coverage**: 100% of existing templates indexed
- **AI Success Rate**: >80% successful workflow compositions
- **Availability**: 99.9% uptime

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  Template Browser │ Template Creator │ Search UI │ Admin Panel  │
└────────────┬──────────────┬────────────────┬──────────┬────────┘
             │              │                │          │
┌────────────▼──────────────▼────────────────▼──────────▼────────┐
│                      API Gateway (Next.js)                       │
├──────────────────────────────────────────────────────────────────┤
│  REST API │ GraphQL │ WebSocket │ MCP Server │ Admin API        │
└────────────┬──────────────┬────────────────┬──────────┬────────┘
             │              │                │          │
┌────────────▼──────────────▼────────────────▼──────────▼────────┐
│                     Service Layer                                │
├──────────────────────────────────────────────────────────────────┤
│ Template    │ Search      │ Composition │ Compatibility │       │
│ Manager     │ Service     │ Service     │ Analyzer     │       │
├─────────────┼─────────────┼─────────────┼──────────────┤       │
│ Ingestion   │ Embedding   │ Template    │ Validation   │       │
│ Service     │ Generator   │ Generator   │ Service      │       │
└─────────────┴─────────────┴─────────────┴──────────────┘       │
                            │                                      │
┌───────────────────────────▼──────────────────────────────────────┐
│                        Data Layer                                │
├──────────────────────────────────────────────────────────────────┤
│         PostgreSQL         │        Redis         │   S3/MinIO   │
│  ┌────────────────────┐   │   ┌──────────────┐  │  ┌─────────┐ │
│  │ Templates          │   │   │ Cache        │  │  │ Assets  │ │
│  │ Metadata           │   │   │ Sessions     │  │  │ Icons   │ │
│  │ Relationships      │   │   │ Rate Limits  │  │  │ Docs    │ │
│  │ Analytics          │   │   └──────────────┘  │  └─────────┘ │
│  └────────────────────┘   │                     │              │
│  ┌────────────────────┐   │                     │              │
│  │ pgvector           │   │                     │              │
│  │ - Embeddings       │   │                     │              │
│  │ - Vector Indexes   │   │                     │              │
│  └────────────────────┘   │                     │              │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Descriptions

#### 2.2.1 Frontend Layer

- **Template Browser**: Search and browse interface
- **Template Creator**: Visual template creation tool
- **Search UI**: Advanced search with filters
- **Admin Panel**: Template management and analytics

#### 2.2.2 API Layer

- **REST API**: Standard CRUD operations
- **GraphQL**: Flexible queries for complex data
- **WebSocket**: Real-time updates
- **MCP Server**: AI agent interface
- **Admin API**: Management operations

#### 2.2.3 Service Layer

- **Template Manager**: CRUD operations, versioning
- **Search Service**: Semantic and keyword search
- **Composition Service**: Workflow generation
- **Compatibility Analyzer**: Template relationship analysis
- **Ingestion Service**: File-based template import
- **Embedding Generator**: Vector generation for semantic search
- **Template Generator**: Dynamic template creation
- **Validation Service**: Template validation and testing

#### 2.2.4 Data Layer

- **PostgreSQL + pgvector**: Primary database with vector search
- **Redis**: Caching and session management
- **S3/MinIO**: Asset storage

---

## 3. Data Models

### 3.1 Core Entities

#### 3.1.1 NodeTemplate

```typescript
interface NodeTemplate {
  // Identity
  id: string // e.g., "tpl_langchain_agent"
  version: string // Semantic version "1.0.0"
  status: TemplateStatus // draft | active | deprecated

  // Metadata
  title: string
  subtitle: string
  description: string
  category: string
  subcategory?: string
  tags: string[]

  // Visual
  icon: string
  variant?: string // Color variant
  shape: NodeShape
  size: 'small' | 'medium' | 'large'

  // Structure
  ports: Port[]
  properties: Record<string, PropertyDefinition>
  propertyRules?: PropertyRules

  // Requirements
  requiredEnvVars?: string[]
  dependencies?: string[] // Other template IDs

  // Source
  source: TemplateSource

  // Metadata
  createdAt: Date
  updatedAt: Date
  createdBy: string
  updatedBy: string
  isActive: boolean
}

enum TemplateStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
  ARCHIVED = 'archived',
}

interface TemplateSource {
  type: 'file' | 'api' | 'script' | 'manual' | 'generated'
  location?: string // File path or API endpoint
  schema?: any // Original schema if from API
  generatorVersion?: string
}
```

#### 3.1.2 TemplateRepository

```typescript
interface TemplateRepository {
  templateId: string
  templateData: NodeTemplate

  // Embeddings
  embeddings: {
    title: Float32Array // 1536 dimensions
    description: Float32Array
    combined: Float32Array
    capabilities: Float32Array
    useCase: Float32Array
  }

  // Extracted metadata
  capabilities: string[]
  inputTypes: DataType[]
  outputTypes: DataType[]
  useCases: string[]

  // Relationships
  relationships: {
    commonlyUsedWith: string[]
    alternatives: string[]
    upgrades: string[] // Newer versions or alternatives
    requiredTemplates: string[] // Must be used with
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
  searchText: string // Full-text search field
  searchVector: Float32Array // Combined search vector
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
```

#### 3.1.3 TemplateVersion

```typescript
interface TemplateVersion {
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

interface VersionChange {
  type: 'added' | 'modified' | 'removed' | 'deprecated'
  field: string
  description: string
  breaking: boolean
}
```

#### 3.1.4 DynamicTemplate

```typescript
interface DynamicTemplate {
  id: string
  name: string
  sourceType: 'api' | 'script' | 'database' | 'graphql'

  // API-based templates
  apiDefinition?: {
    openApiSpec?: string // OpenAPI/Swagger spec
    endpoint: string
    method: string
    authentication?: AuthConfig
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
    portMapping: PortMappingRule[]
    propertyMapping: PropertyMappingRule[]
    errorHandling: ErrorHandlingConfig
  }

  // Generated template
  generatedTemplate?: NodeTemplate
  generatedAt?: Date
  validationStatus?: ValidationStatus
}
```

### 3.2 Database Schema

#### 3.2.1 PostgreSQL Tables

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Main template storage
CREATE TABLE node_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT UNIQUE NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  template_data JSONB NOT NULL,
  source_type TEXT NOT NULL,
  source_location TEXT,

  -- Denormalized fields for queries
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  tags TEXT[],

  -- Metadata
  created_by TEXT NOT NULL,
  updated_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Indexes
  UNIQUE(template_id, version)
);

-- Template repository with embeddings
CREATE TABLE template_repository (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT UNIQUE NOT NULL REFERENCES node_templates(template_id),

  -- Embeddings (using pgvector)
  title_embedding vector(1536),
  description_embedding vector(1536),
  combined_embedding vector(1536),
  capability_embedding vector(1536),
  use_case_embedding vector(1536),

  -- Extracted metadata
  capabilities TEXT[],
  input_types JSONB,
  output_types JSONB,
  use_cases TEXT[],

  -- Relationships
  commonly_used_with TEXT[],
  alternatives TEXT[],
  required_templates TEXT[],

  -- Statistics
  usage_count INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2),
  last_used TIMESTAMPTZ,
  error_rate DECIMAL(5,4) DEFAULT 0,

  -- Search optimization
  search_text TSVECTOR,
  keywords TEXT[],

  -- Timestamps
  indexed_at TIMESTAMPTZ DEFAULT NOW(),
  last_validated TIMESTAMPTZ,

  -- Foreign key
  FOREIGN KEY (template_id) REFERENCES node_templates(template_id) ON DELETE CASCADE
);

-- Template versions
CREATE TABLE template_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  version TEXT NOT NULL,
  changes JSONB,
  release_notes TEXT,
  is_breaking BOOLEAN DEFAULT FALSE,
  is_deprecated BOOLEAN DEFAULT FALSE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (template_id) REFERENCES node_templates(template_id) ON DELETE CASCADE,
  UNIQUE(template_id, version)
);

-- Dynamic templates
CREATE TABLE dynamic_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_config JSONB NOT NULL,
  generation_rules JSONB NOT NULL,
  generated_template_id TEXT,
  generated_at TIMESTAMPTZ,
  validation_status TEXT,
  validation_errors JSONB,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (generated_template_id) REFERENCES node_templates(template_id)
);

-- Template relationships
CREATE TABLE template_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_template_id TEXT NOT NULL,
  target_template_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL, -- 'compatible', 'alternative', 'upgrade', 'requires'
  confidence DECIMAL(3,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (source_template_id) REFERENCES node_templates(template_id),
  FOREIGN KEY (target_template_id) REFERENCES node_templates(template_id),
  UNIQUE(source_template_id, target_template_id, relationship_type)
);

-- Template usage analytics
CREATE TABLE template_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id TEXT NOT NULL,
  workflow_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL, -- 'search', 'view', 'add', 'execute'
  success BOOLEAN,
  error_message TEXT,
  execution_time_ms INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  FOREIGN KEY (template_id) REFERENCES node_templates(template_id)
);

-- Indexes for performance
CREATE INDEX idx_templates_category ON node_templates(category);
CREATE INDEX idx_templates_tags ON node_templates USING GIN(tags);
CREATE INDEX idx_templates_status ON node_templates(status);
CREATE INDEX idx_templates_created_at ON node_templates(created_at DESC);

-- Vector indexes for similarity search
CREATE INDEX idx_title_embedding ON template_repository
  USING ivfflat (title_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_combined_embedding ON template_repository
  USING ivfflat (combined_embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX idx_capability_embedding ON template_repository
  USING ivfflat (capability_embedding vector_cosine_ops)
  WITH (lists = 100);

-- Full-text search index
CREATE INDEX idx_search_text ON template_repository USING GIN(search_text);

-- Analytics indexes
CREATE INDEX idx_usage_template_id ON template_usage(template_id);
CREATE INDEX idx_usage_created_at ON template_usage(created_at DESC);
CREATE INDEX idx_usage_action ON template_usage(action);
```

---

## 4. Template Ingestion System

### 4.1 File-Based Template Ingestion

#### 4.1.1 Ingestion Pipeline

```typescript
interface IngestionPipeline {
  // Scan for template files
  scanTemplateFiles(): Promise<TemplateFile[]>

  // Parse and validate templates
  parseTemplate(file: TemplateFile): Promise<NodeTemplate>

  // Generate embeddings
  generateEmbeddings(template: NodeTemplate): Promise<Embeddings>

  // Store in repository
  storeTemplate(template: NodeTemplate, embeddings: Embeddings): Promise<void>

  // Update relationships
  updateRelationships(template: NodeTemplate): Promise<void>
}
```

#### 4.1.2 File Scanner Configuration

```typescript
interface IngestionConfig {
  // Source directories
  sourcePaths: string[]

  // File patterns
  includePatterns: string[] // e.g., "*.ts", "*.json"
  excludePatterns: string[] // e.g., "*.test.ts"

  // Processing options
  watchMode: boolean // Watch for file changes
  batchSize: number // Templates per batch
  parallelism: number // Concurrent processing

  // Validation
  validateSchema: boolean
  validateReferences: boolean
  strictMode: boolean

  // Scheduling
  schedule?: string // Cron expression
  onStartup: boolean
}
```

#### 4.1.3 Implementation

```typescript
export class FileIngestionService {
  private config: IngestionConfig
  private watcher?: FSWatcher

  async ingestTemplates(): Promise<IngestionResult> {
    const result: IngestionResult = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    }

    // Scan template files
    const files = await this.scanTemplateFiles()

    // Process in batches
    for (const batch of chunk(files, this.config.batchSize)) {
      await Promise.all(
        batch.map(async file => {
          try {
            // Parse template
            const template = await this.parseTemplateFile(file)

            // Validate
            await this.validateTemplate(template)

            // Check if already exists
            const existing = await this.findExistingTemplate(template.id)

            if (existing && !this.hasChanges(existing, template)) {
              result.skipped++
              return
            }

            // Generate embeddings
            const embeddings = await this.embeddingService.generate(template)

            // Extract metadata
            const metadata = await this.extractMetadata(template)

            // Store or update
            await this.repository.upsert({
              template,
              embeddings,
              metadata,
              source: {
                type: 'file',
                location: file.path,
              },
            })

            result.succeeded++
          } catch (error) {
            result.failed++
            result.errors.push({
              file: file.path,
              error: error.message,
            })
          }
        })
      )
    }

    // Update relationships
    await this.updateAllRelationships()

    return result
  }

  async watchTemplateFiles(): Promise<void> {
    this.watcher = chokidar.watch(this.config.sourcePaths, {
      ignored: this.config.excludePatterns,
      persistent: true,
    })

    this.watcher
      .on('add', path => this.handleFileAdded(path))
      .on('change', path => this.handleFileChanged(path))
      .on('unlink', path => this.handleFileRemoved(path))
  }
}
```

### 4.2 Metadata Extraction

```typescript
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

    // From template type
    const typeCapabilities = this.getTypeCapabilities(template.type)
    typeCapabilities.forEach(c => capabilities.add(c))

    // From properties
    if (template.properties.operation) {
      const ops = template.properties.operation.options || []
      ops.forEach(op => capabilities.add(`can-${op.toLowerCase()}`))
    }

    // From ports
    template.ports.forEach(port => {
      if (port.type === 'input') {
        capabilities.add(`accepts-${this.normalizePortName(port.label)}`)
      } else {
        capabilities.add(`produces-${this.normalizePortName(port.label)}`)
      }
    })

    // From category
    capabilities.add(`category-${template.category}`)

    return Array.from(capabilities)
  }

  private generateUseCases(template: NodeTemplate): string[] {
    const useCases = []

    // Generate from template purpose
    if (template.category === 'data-sources') {
      useCases.push('data-ingestion', 'data-retrieval', 'data-connection')
    }

    if (template.type.includes('ai')) {
      useCases.push('ai-processing', 'intelligent-automation')
    }

    // Generate from description
    const descriptionUseCases = this.extractUseCasesFromText(template.description)
    useCases.push(...descriptionUseCases)

    return useCases
  }
}
```

---

## 5. Dynamic Template Generation

### 5.1 API Schema-Based Generation

#### 5.1.1 REST API Template Generation with Property Rules

```typescript
export class OpenAPITemplateGenerator {
  async generateFromSpec(spec: OpenAPISpec): Promise<NodeTemplate[]> {
    const templates: NodeTemplate[] = []

    // Group operations by path to create unified templates
    const pathGroups = this.groupOperationsByPath(spec.paths)

    for (const [path, operations] of pathGroups.entries()) {
      const template = await this.generateUnifiedRESTTemplate(path, operations, spec)
      templates.push(template)
    }

    return templates
  }

  private async generateUnifiedRESTTemplate(
    path: string,
    operations: Map<string, Operation>,
    spec: OpenAPISpec
  ): Promise<NodeTemplate> {
    const availableMethods = Array.from(operations.keys())
    const defaultMethod = this.selectDefaultMethod(availableMethods)
    const defaultOperation = operations.get(defaultMethod)!

    // Generate template ID based on path
    const templateId = this.generateTemplateId(path)

    return {
      id: templateId,
      type: 'rest-api',
      title: this.generateTitleFromPath(path),
      subtitle: `REST API ${path}`,
      description: this.generateDescription(operations),
      category: 'data-sources',
      subcategory: 'rest-api',
      icon: 'globe',
      variant: 'blue-600',
      shape: 'rectangle',
      size: 'medium',

      // Default ports based on the default method
      ports: this.generateDefaultPorts(path, defaultMethod, defaultOperation),

      properties: {
        // Endpoint configuration
        baseUrl: {
          type: 'text',
          label: 'Base URL',
          defaultValue: spec.servers[0]?.url || '',
          required: true,
          description: 'API base URL',
        },
        path: {
          type: 'text',
          label: 'Path',
          defaultValue: path,
          readOnly: true,
          description: 'API endpoint path',
        },

        // Method selection - this drives the property rules
        method: {
          type: 'select',
          label: 'HTTP Method',
          options: availableMethods.map(m => m.toUpperCase()),
          defaultValue: defaultMethod.toUpperCase(),
          description: 'HTTP method to use',
        },

        // Headers configuration (not a port)
        headers: {
          type: 'dataOperations',
          label: 'Request Headers',
          description: 'Custom HTTP headers',
          availableFields: [
            'Content-Type',
            'Accept',
            'User-Agent',
            'Cache-Control',
            'X-Request-ID',
          ],
        },

        // Authentication configuration (not a port)
        ...this.generateAuthProperties(spec.security),

        // Request configuration
        timeout: {
          type: 'number',
          label: 'Timeout (ms)',
          defaultValue: 30000,
          min: 1000,
          max: 300000,
        },
        retryAttempts: {
          type: 'number',
          label: 'Retry Attempts',
          defaultValue: 3,
          min: 0,
          max: 10,
        },
        retryDelay: {
          type: 'number',
          label: 'Retry Delay (ms)',
          defaultValue: 1000,
          min: 100,
          max: 30000,
        },

        // Response handling
        validateStatus: {
          type: 'boolean',
          label: 'Validate Status Code',
          defaultValue: true,
          description: 'Throw error for non-2xx status codes',
        },
        parseResponse: {
          type: 'select',
          label: 'Response Parsing',
          options: ['json', 'text', 'blob', 'stream', 'auto'],
          defaultValue: 'auto',
        },
      },

      // Property rules to update ports based on selected method
      propertyRules: this.generatePropertyRules(path, operations),

      requiredEnvVars: this.extractRequiredEnvVars(spec),
      tags: this.generateTags(operations, spec),
      version: '1.0.0',
      isActive: true,

      source: {
        type: 'api',
        location: spec.info.title,
        schema: {
          path,
          operations: Object.fromEntries(operations),
          spec: spec,
        },
      },
    }
  }

  private generatePropertyRules(path: string, operations: Map<string, Operation>): PropertyRules {
    const rules: PropertyRule[] = []

    // Generate rules for each available method
    for (const [method, operation] of operations.entries()) {
      const methodUpper = method.toUpperCase()

      rules.push({
        when: `$.method == '${methodUpper}'`,
        updates: {
          title: this.generateMethodTitle(path, method, operation),
          subtitle: `${methodUpper} ${path}`,
          icon: this.getMethodIcon(method),
          variant: this.getMethodVariant(method),
          description: operation.description || `${methodUpper} request to ${path}`,

          // Dynamic port updates based on method
          ports: this.generatePortsForMethod(path, method, operation),
        },
      })
    }

    return {
      triggers: ['method'],
      rules,
    }
  }

  private generatePortsForMethod(path: string, method: string, operation: Operation): Port[] {
    const ports: Port[] = []
    const requestSchema = this.extractRequestSchema(operation)
    const responseSchema = this.extractResponseSchema(operation)

    // Path parameters (always present if path has params)
    if (requestSchema.pathParams?.length > 0) {
      ports.push({
        id: 'path-params',
        label: 'Path Parameters',
        type: 'input',
        position: 'left',
        description: `Path parameters: ${requestSchema.pathParams.map(p => p.name).join(', ')}`,
        schema: {
          type: 'object',
          properties: this.convertParamsToSchema(requestSchema.pathParams),
          required: requestSchema.pathParams.filter(p => p.required).map(p => p.name),
        },
      })
    }

    // Method-specific input ports
    switch (method.toLowerCase()) {
      case 'get':
      case 'delete':
        // Query parameters for GET and DELETE
        if (requestSchema.queryParams?.length > 0) {
          ports.push({
            id: 'query-params',
            label: 'Query Parameters',
            type: 'input',
            position: 'left',
            description: 'Query string parameters',
            schema: {
              type: 'object',
              properties: this.convertParamsToSchema(requestSchema.queryParams),
              required: requestSchema.queryParams.filter(p => p.required).map(p => p.name),
            },
          })
        }
        break

      case 'post':
      case 'put':
        // Request body for POST and PUT
        if (requestSchema.body) {
          ports.push({
            id: 'request-body',
            label: 'Request Body',
            type: 'input',
            position: 'left',
            description: 'Request body payload',
            schema: requestSchema.body.schema,
          })
        }
        break

      case 'patch':
        // Patch document for PATCH
        ports.push({
          id: 'patch-body',
          label: 'Patch Document',
          type: 'input',
          position: 'left',
          description: 'JSON Patch or partial update',
          schema: {
            oneOf: [
              {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['op', 'path'],
                  properties: {
                    op: {
                      type: 'string',
                      enum: ['add', 'remove', 'replace', 'move', 'copy', 'test'],
                    },
                    path: { type: 'string' },
                    from: { type: 'string' },
                    value: {},
                  },
                },
              },
              requestSchema.body?.schema || { type: 'object', additionalProperties: true },
            ],
          },
        })
        break
    }

    // Output ports (common for all methods but may vary in schema)
    // Success response
    const successResponse = this.getSuccessResponse(operation)
    if (successResponse?.schema) {
      ports.push({
        id: 'response-data',
        label: 'Response Data',
        type: 'output',
        position: 'right',
        description: successResponse.description,
        schema: successResponse.schema,
      })
    }

    // Status code
    ports.push({
      id: 'status-code',
      label: 'Status Code',
      type: 'output',
      position: 'bottom',
      description: 'HTTP status code',
      schema: { type: 'integer', minimum: 100, maximum: 599 },
    })

    // Error output
    ports.push({
      id: 'error',
      label: 'Error',
      type: 'output',
      position: 'bottom',
      description: 'Error response',
      schema: this.getErrorSchema(operation),
    })

    // Response metadata
    ports.push({
      id: 'metadata',
      label: 'Metadata',
      type: 'output',
      position: 'bottom',
      description: 'Response metadata',
      schema: {
        type: 'object',
        properties: {
          headers: { type: 'object' },
          duration: { type: 'number' },
          cached: { type: 'boolean' },
          retries: { type: 'integer' },
        },
      },
    })

    return ports
  }

  private generateAuthProperties(security?: SecurityScheme[]): Record<string, PropertyDefinition> {
    const authProps: Record<string, PropertyDefinition> = {
      authType: {
        type: 'select',
        label: 'Authentication Type',
        options: ['none', 'bearer', 'api-key', 'basic', 'oauth2'],
        defaultValue: 'none',
        description: 'Authentication method',
      },
    }

    // Bearer token auth
    authProps.bearerToken = {
      type: 'text',
      label: 'Bearer Token',
      format: 'password',
      placeholder: 'Enter bearer token or use ${ENV_VAR}',
      visibleWhen: "authType === 'bearer'",
      description: 'Bearer token for authorization',
    }

    // API key auth
    authProps.apiKey = {
      type: 'text',
      label: 'API Key',
      format: 'password',
      placeholder: 'Enter API key or use ${ENV_VAR}',
      visibleWhen: "authType === 'api-key'",
      description: 'API key for authentication',
    }

    authProps.apiKeyLocation = {
      type: 'select',
      label: 'API Key Location',
      options: ['header', 'query', 'cookie'],
      defaultValue: 'header',
      visibleWhen: "authType === 'api-key'",
    }

    authProps.apiKeyName = {
      type: 'text',
      label: 'API Key Name',
      defaultValue: 'X-API-Key',
      visibleWhen: "authType === 'api-key'",
      description: 'Name of the API key parameter',
    }

    // Basic auth
    authProps.basicUsername = {
      type: 'text',
      label: 'Username',
      visibleWhen: "authType === 'basic'",
    }

    authProps.basicPassword = {
      type: 'text',
      label: 'Password',
      format: 'password',
      visibleWhen: "authType === 'basic'",
    }

    // OAuth2
    authProps.oauth2Flow = {
      type: 'select',
      label: 'OAuth2 Flow',
      options: ['clientCredentials', 'authorizationCode', 'implicit', 'password'],
      defaultValue: 'clientCredentials',
      visibleWhen: "authType === 'oauth2'",
    }

    authProps.oauth2ClientId = {
      type: 'text',
      label: 'Client ID',
      visibleWhen: "authType === 'oauth2'",
    }

    authProps.oauth2ClientSecret = {
      type: 'text',
      label: 'Client Secret',
      format: 'password',
      visibleWhen: "authType === 'oauth2'",
    }

    authProps.oauth2TokenUrl = {
      type: 'text',
      label: 'Token URL',
      visibleWhen: "authType === 'oauth2'",
    }

    return authProps
  }

  private getMethodIcon(method: string): string {
    const icons = {
      get: 'download',
      post: 'upload',
      put: 'edit',
      patch: 'edit-2',
      delete: 'trash-2',
    }
    return icons[method.toLowerCase()] || 'globe'
  }

  private getMethodVariant(method: string): string {
    const variants = {
      get: 'blue-600',
      post: 'green-600',
      put: 'orange-600',
      patch: 'yellow-600',
      delete: 'red-600',
    }
    return variants[method.toLowerCase()] || 'gray-600'
  }

  private extractRequestSchema(operation: Operation): RequestSchema {
    const schema: RequestSchema = {
      pathParams: [],
      queryParams: [],
      headers: [],
      body: null,
    }

    // Extract parameters
    if (operation.parameters) {
      operation.parameters.forEach(param => {
        const paramData = {
          name: param.name,
          required: param.required || false,
          schema: param.schema,
          description: param.description,
        }

        switch (param.in) {
          case 'path':
            schema.pathParams.push(paramData)
            break
          case 'query':
            schema.queryParams.push(paramData)
            break
          case 'header':
            schema.headers.push(paramData)
            break
        }
      })
    }

    // Extract request body
    if (operation.requestBody) {
      const content = operation.requestBody.content
      if (content?.['application/json']) {
        schema.body = {
          required: operation.requestBody.required || false,
          schema: content['application/json'].schema,
          description: operation.requestBody.description,
        }
      }
    }

    return schema
  }

  private extractResponseSchema(operation: Operation): ResponseSchema {
    const schema: ResponseSchema = {
      success: {},
      error: {},
    }

    Object.entries(operation.responses).forEach(([statusCode, response]) => {
      const responseData = {
        statusCode,
        description: response.description,
        schema: response.content?.['application/json']?.schema,
        headers: response.headers,
      }

      if (statusCode.startsWith('2')) {
        schema.success[statusCode] = responseData
      } else if (statusCode.startsWith('4') || statusCode.startsWith('5')) {
        schema.error[statusCode] = responseData
      }
    })

    return schema
  }

  private getMethodIcon(method: string): string {
    const icons = {
      get: 'download',
      post: 'upload',
      put: 'edit',
      patch: 'edit-2',
      delete: 'trash-2',
    }
    return icons[method.toLowerCase()] || 'globe'
  }

  private getMethodVariant(method: string): string {
    const variants = {
      get: 'blue-600',
      post: 'green-600',
      put: 'orange-600',
      patch: 'yellow-600',
      delete: 'red-600',
    }
    return variants[method.toLowerCase()] || 'gray-600'
  }

  private getTemplateSize(
    requestSchema: RequestSchema,
    responseSchema: ResponseSchema
  ): 'small' | 'medium' | 'large' {
    const inputCount =
      requestSchema.pathParams.length +
      requestSchema.queryParams.length +
      requestSchema.headers.length +
      (requestSchema.body ? 1 : 0)

    const outputCount =
      Object.keys(responseSchema.success).length + Object.keys(responseSchema.error).length

    if (inputCount + outputCount > 6) return 'large'
    if (inputCount + outputCount > 3) return 'medium'
    return 'small'
  }
}
```

#### 5.1.2 REST Template Examples

```typescript
// Example: GET /users/{userId}
const getUserTemplate: NodeTemplate = {
  id: 'tpl_api_get_user',
  type: 'rest-api',
  title: 'Get User',
  subtitle: 'GET /users/{userId}',
  icon: 'download',
  variant: 'blue-600',

  ports: [
    // Input: Path parameter
    {
      id: 'path-params',
      label: 'Path Parameters',
      type: 'input',
      position: 'left',
      schema: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
    },
    // Input: Query parameters
    {
      id: 'query-params',
      label: 'Query Parameters',
      type: 'input',
      position: 'left',
      schema: {
        type: 'object',
        properties: {
          include: { type: 'array', items: { type: 'string' } },
          fields: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    // Output: User data
    {
      id: 'response-data',
      label: 'User Data',
      type: 'output',
      position: 'right',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    // Output: Status code
    {
      id: 'status-code',
      label: 'Status Code',
      type: 'output',
      position: 'bottom',
    },
  ],
}

// Example: POST /users
const createUserTemplate: NodeTemplate = {
  id: 'tpl_api_create_user',
  type: 'rest-api',
  title: 'Create User',
  subtitle: 'POST /users',
  icon: 'upload',
  variant: 'green-600',

  ports: [
    // Input: Request body
    {
      id: 'request-body',
      label: 'User Data',
      type: 'input',
      position: 'left',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          role: { type: 'string', enum: ['user', 'admin'] },
        },
        required: ['name', 'email', 'password'],
      },
    },
    // Output: Created user
    {
      id: 'response-data',
      label: 'Created User',
      type: 'output',
      position: 'right',
      schema: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          role: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
    },
    // Output: Location header
    {
      id: 'response-headers',
      label: 'Response Headers',
      type: 'output',
      position: 'right',
      schema: {
        type: 'object',
        properties: {
          Location: { type: 'string', description: 'URL of created resource' },
        },
      },
    },
    // Output: Status code
    {
      id: 'status-code',
      label: 'Status Code',
      type: 'output',
      position: 'bottom',
    },
  ],
}

// Example: PUT /users/{userId}
const updateUserTemplate: NodeTemplate = {
  id: 'tpl_api_update_user',
  type: 'rest-api',
  title: 'Update User',
  subtitle: 'PUT /users/{userId}',
  icon: 'edit',
  variant: 'orange-600',

  ports: [
    // Input: Path parameter
    {
      id: 'path-params',
      label: 'Path Parameters',
      type: 'input',
      position: 'left',
      schema: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
    },
    // Input: Complete user object for replacement
    {
      id: 'request-body',
      label: 'User Data',
      type: 'input',
      position: 'left',
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string', format: 'email' },
          role: { type: 'string' },
        },
        required: ['name', 'email', 'role'],
      },
    },
    // Output: Updated user
    {
      id: 'response-data',
      label: 'Updated User',
      type: 'output',
      position: 'right',
    },
    // Output: Status code
    {
      id: 'status-code',
      label: 'Status Code',
      type: 'output',
      position: 'bottom',
    },
  ],
}

// Example: PATCH /users/{userId}
const patchUserTemplate: NodeTemplate = {
  id: 'tpl_api_patch_user',
  type: 'rest-api',
  title: 'Patch User',
  subtitle: 'PATCH /users/{userId}',
  icon: 'edit-2',
  variant: 'yellow-600',

  ports: [
    // Input: Path parameter
    {
      id: 'path-params',
      label: 'Path Parameters',
      type: 'input',
      position: 'left',
      schema: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
    },
    // Input: Partial update (JSON Patch or partial object)
    {
      id: 'request-body',
      label: 'Patch Data',
      type: 'input',
      position: 'left',
      schema: {
        oneOf: [
          {
            // JSON Patch format
            type: 'array',
            items: {
              type: 'object',
              properties: {
                op: { type: 'string', enum: ['add', 'remove', 'replace'] },
                path: { type: 'string' },
                value: {},
              },
            },
          },
          {
            // Partial object
            type: 'object',
            properties: {
              name: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
            },
          },
        ],
      },
    },
    // Output: Patched user
    {
      id: 'response-data',
      label: 'Patched User',
      type: 'output',
      position: 'right',
    },
    // Output: Status code
    {
      id: 'status-code',
      label: 'Status Code',
      type: 'output',
      position: 'bottom',
    },
  ],
}

// Example: DELETE /users/{userId}
const deleteUserTemplate: NodeTemplate = {
  id: 'tpl_api_delete_user',
  type: 'rest-api',
  title: 'Delete User',
  subtitle: 'DELETE /users/{userId}',
  icon: 'trash-2',
  variant: 'red-600',

  ports: [
    // Input: Path parameter
    {
      id: 'path-params',
      label: 'Path Parameters',
      type: 'input',
      position: 'left',
      schema: {
        type: 'object',
        properties: {
          userId: { type: 'string', format: 'uuid' },
        },
        required: ['userId'],
      },
    },
    // Input: Query parameters (e.g., soft delete options)
    {
      id: 'query-params',
      label: 'Query Parameters',
      type: 'input',
      position: 'left',
      schema: {
        type: 'object',
        properties: {
          soft: { type: 'boolean', description: 'Soft delete instead of hard delete' },
          cascade: { type: 'boolean', description: 'Delete related records' },
        },
      },
    },
    // Output: Status code (204 No Content is common)
    {
      id: 'status-code',
      label: 'Status Code',
      type: 'output',
      position: 'bottom',
    },
    // Output: Deletion confirmation (some APIs return the deleted object)
    {
      id: 'response-data',
      label: 'Deletion Result',
      type: 'output',
      position: 'right',
      schema: {
        type: 'object',
        properties: {
          deleted: { type: 'boolean' },
          deletedAt: { type: 'string', format: 'date-time' },
          deletedCount: { type: 'integer' },
        },
      },
    },
  ],
}
```

#### 5.1.3 Complex API Schema Handling

```typescript
export class AdvancedAPITemplateGenerator {
  // Handle complex nested request/response schemas
  private generatePortsForComplexSchema(
    schema: any,
    portType: 'input' | 'output',
    baseId: string
  ): Port[] {
    const ports: Port[] = []

    // For complex objects with many properties, consider splitting into multiple ports
    if (schema.type === 'object' && schema.properties) {
      const propertyCount = Object.keys(schema.properties).length

      if (propertyCount > 5) {
        // Group related properties into separate ports
        const groups = this.groupSchemaProperties(schema.properties)

        groups.forEach((group, index) => {
          ports.push({
            id: `${baseId}-${group.name}`,
            label: group.label,
            type: portType,
            position: portType === 'input' ? 'left' : 'right',
            description: group.description,
            schema: {
              type: 'object',
              properties: group.properties,
              required: group.required,
            },
          })
        })
      } else {
        // Single port for simple objects
        ports.push({
          id: baseId,
          label: this.labelFromId(baseId),
          type: portType,
          position: portType === 'input' ? 'left' : 'right',
          schema: schema,
        })
      }
    } else if (schema.type === 'array') {
      // Array handling with item schema
      ports.push({
        id: baseId,
        label: this.labelFromId(baseId),
        type: portType,
        position: portType === 'input' ? 'left' : 'right',
        schema: schema,
        metadata: {
          isArray: true,
          itemSchema: schema.items,
        },
      })
    }

    return ports
  }

  // Example: File upload endpoint
  private generateFileUploadTemplate(path: string, operation: Operation): NodeTemplate {
    return {
      id: 'tpl_api_file_upload',
      type: 'rest-api',
      title: 'Upload File',
      subtitle: `POST ${path}`,
      icon: 'upload-cloud',
      variant: 'green-600',

      ports: [
        // File input
        {
          id: 'file',
          label: 'File',
          type: 'input',
          position: 'left',
          schema: {
            type: 'string',
            format: 'binary',
            contentMediaType: 'multipart/form-data',
          },
        },
        // Metadata input
        {
          id: 'metadata',
          label: 'File Metadata',
          type: 'input',
          position: 'left',
          schema: {
            type: 'object',
            properties: {
              filename: { type: 'string' },
              contentType: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
          },
        },
        // Upload result
        {
          id: 'response-data',
          label: 'Upload Result',
          type: 'output',
          position: 'right',
          schema: {
            type: 'object',
            properties: {
              fileId: { type: 'string' },
              url: { type: 'string', format: 'uri' },
              size: { type: 'integer' },
              checksum: { type: 'string' },
            },
          },
        },
        // Progress output (for streaming)
        {
          id: 'progress',
          label: 'Upload Progress',
          type: 'output',
          position: 'bottom',
          schema: {
            type: 'object',
            properties: {
              bytesUploaded: { type: 'integer' },
              totalBytes: { type: 'integer' },
              percentage: { type: 'number' },
            },
          },
        },
      ],

      properties: {
        endpoint: { type: 'text', defaultValue: path },
        method: { type: 'text', defaultValue: 'POST' },
        maxFileSize: {
          type: 'number',
          label: 'Max File Size (MB)',
          defaultValue: 10,
          min: 1,
          max: 100,
        },
        allowedTypes: {
          type: 'select',
          label: 'Allowed File Types',
          multiple: true,
          options: ['image/*', 'application/pdf', 'text/*', 'video/*'],
          defaultValue: ['image/*'],
        },
      },
    }
  }

  // Example: Paginated list endpoint
  private generatePaginatedListTemplate(path: string, operation: Operation): NodeTemplate {
    return {
      id: 'tpl_api_paginated_list',
      type: 'rest-api',
      title: 'List with Pagination',
      subtitle: `GET ${path}`,
      icon: 'list',
      variant: 'blue-600',

      ports: [
        // Pagination parameters
        {
          id: 'pagination',
          label: 'Pagination',
          type: 'input',
          position: 'left',
          schema: {
            type: 'object',
            properties: {
              page: { type: 'integer', minimum: 1, default: 1 },
              limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
              sort: { type: 'string', enum: ['asc', 'desc'] },
              sortBy: { type: 'string' },
            },
          },
        },
        // Filter parameters
        {
          id: 'filters',
          label: 'Filters',
          type: 'input',
          position: 'left',
          schema: {
            type: 'object',
            additionalProperties: true,
          },
        },
        // List data output
        {
          id: 'items',
          label: 'Items',
          type: 'output',
          position: 'right',
          schema: {
            type: 'array',
            items:
              operation.responses['200']?.content?.['application/json']?.schema?.properties?.items,
          },
        },
        // Pagination metadata output
        {
          id: 'pagination-meta',
          label: 'Pagination Info',
          type: 'output',
          position: 'bottom',
          schema: {
            type: 'object',
            properties: {
              totalItems: { type: 'integer' },
              totalPages: { type: 'integer' },
              currentPage: { type: 'integer' },
              hasNext: { type: 'boolean' },
              hasPrevious: { type: 'boolean' },
            },
          },
        },
      ],
    }
  }

  // Handle different authentication types
  private generateAuthenticatedTemplate(
    template: NodeTemplate,
    security: SecurityRequirement[]
  ): NodeTemplate {
    const authPorts: Port[] = []
    const authProperties: Record<string, PropertyDefinition> = {}

    security.forEach(secReq => {
      const securityScheme = Object.keys(secReq)[0]

      switch (securityScheme) {
        case 'bearerAuth':
          authPorts.push({
            id: 'auth-token',
            label: 'Bearer Token',
            type: 'input',
            position: 'top',
            schema: { type: 'string', format: 'password' },
          })
          authProperties.authType = {
            type: 'text',
            defaultValue: 'bearer',
            readOnly: true,
          }
          break

        case 'apiKey':
          authPorts.push({
            id: 'api-key',
            label: 'API Key',
            type: 'input',
            position: 'top',
            schema: { type: 'string', format: 'password' },
          })
          authProperties.apiKeyLocation = {
            type: 'select',
            options: ['header', 'query', 'cookie'],
            defaultValue: 'header',
          }
          break

        case 'oauth2':
          authPorts.push({
            id: 'oauth-token',
            label: 'OAuth Token',
            type: 'input',
            position: 'top',
            schema: {
              type: 'object',
              properties: {
                access_token: { type: 'string' },
                refresh_token: { type: 'string' },
                expires_in: { type: 'integer' },
              },
            },
          })
          authProperties.oauthFlow = {
            type: 'select',
            options: ['implicit', 'authorizationCode', 'clientCredentials'],
            defaultValue: 'authorizationCode',
          }
          break
      }
    })

    return {
      ...template,
      ports: [...authPorts, ...template.ports],
      properties: { ...template.properties, ...authProperties },
    }
  }

  // Handle webhooks differently from regular REST endpoints
  private generateWebhookTemplate(path: string, operation: Operation): NodeTemplate {
    return {
      id: 'tpl_webhook_receiver',
      type: 'webhook',
      title: 'Webhook Receiver',
      subtitle: `Webhook ${path}`,
      icon: 'bell',
      variant: 'purple-600',
      shape: 'diamond', // Different shape for webhooks

      ports: [
        // No input ports for webhooks - they receive data

        // Webhook payload output
        {
          id: 'payload',
          label: 'Webhook Payload',
          type: 'output',
          position: 'right',
          schema: operation.requestBody?.content?.['application/json']?.schema,
        },
        // Webhook headers output
        {
          id: 'headers',
          label: 'Webhook Headers',
          type: 'output',
          position: 'right',
          schema: {
            type: 'object',
            additionalProperties: { type: 'string' },
          },
        },
        // Verification output
        {
          id: 'verified',
          label: 'Signature Verified',
          type: 'output',
          position: 'bottom',
          schema: { type: 'boolean' },
        },
      ],

      properties: {
        webhookUrl: {
          type: 'text',
          label: 'Webhook URL',
          readOnly: true,
          defaultValue: `${process.env.WEBHOOK_BASE_URL}${path}`,
        },
        verificationMethod: {
          type: 'select',
          label: 'Verification Method',
          options: ['hmac-sha256', 'hmac-sha1', 'signature-header', 'none'],
          defaultValue: 'hmac-sha256',
        },
        secret: {
          type: 'text',
          label: 'Webhook Secret',
          format: 'password',
          required: true,
        },
      },
    }
  }
}
```

#### 5.1.4 Port Schema Mapping & Validation

```typescript
export class PortSchemaMapper {
  // Map OpenAPI types to workflow port data types
  private mapOpenAPIToPortType(openAPISchema: any): PortDataType {
    const typeMapping: Record<string, PortDataType> = {
      string: 'text',
      number: 'number',
      integer: 'number',
      boolean: 'boolean',
      array: 'array',
      object: 'object',
      null: 'null',
    }

    // Handle special formats
    if (openAPISchema.type === 'string') {
      switch (openAPISchema.format) {
        case 'binary':
          return 'file'
        case 'byte':
          return 'base64'
        case 'date':
        case 'date-time':
          return 'datetime'
        case 'email':
          return 'email'
        case 'uri':
        case 'url':
          return 'url'
        case 'uuid':
          return 'uuid'
        case 'json':
          return 'json'
        default:
          return 'text'
      }
    }

    return typeMapping[openAPISchema.type] || 'any'
  }

  // Validate port compatibility between templates
  validatePortConnection(sourcePort: Port, targetPort: Port): PortConnectionValidation {
    const validation: PortConnectionValidation = {
      compatible: false,
      issues: [],
      warnings: [],
      transformation: null,
    }

    // Check basic compatibility
    if (sourcePort.type !== 'output' || targetPort.type !== 'input') {
      validation.issues.push('Invalid port direction connection')
      return validation
    }

    // Check schema compatibility
    const sourceSchema = sourcePort.schema
    const targetSchema = targetPort.schema

    if (!sourceSchema || !targetSchema) {
      validation.compatible = true
      validation.warnings.push('No schema validation available')
      return validation
    }

    // Type compatibility check
    const compatibility = this.checkTypeCompatibility(sourceSchema, targetSchema)

    if (compatibility.exact) {
      validation.compatible = true
    } else if (compatibility.convertible) {
      validation.compatible = true
      validation.transformation = compatibility.transformation
      validation.warnings.push(`Type conversion needed: ${compatibility.transformation}`)
    } else {
      validation.issues.push(`Incompatible types: ${sourceSchema.type} → ${targetSchema.type}`)
    }

    // Check required fields
    if (targetSchema.required && sourceSchema.properties) {
      const missingRequired = targetSchema.required.filter(field => !sourceSchema.properties[field])

      if (missingRequired.length > 0) {
        validation.issues.push(`Missing required fields: ${missingRequired.join(', ')}`)
        validation.compatible = false
      }
    }

    return validation
  }

  // Generate runtime validation code for ports
  generatePortValidator(port: Port): string {
    if (!port.schema) return 'return true;'

    const schema = port.schema
    let validationCode = ''

    // Type validation
    validationCode += `
      if (typeof value !== '${schema.type}') {
        throw new Error('Expected ${schema.type}, got ' + typeof value);
      }
    `

    // String validations
    if (schema.type === 'string') {
      if (schema.minLength) {
        validationCode += `
          if (value.length < ${schema.minLength}) {
            throw new Error('String must be at least ${schema.minLength} characters');
          }
        `
      }
      if (schema.maxLength) {
        validationCode += `
          if (value.length > ${schema.maxLength}) {
            throw new Error('String must be at most ${schema.maxLength} characters');
          }
        `
      }
      if (schema.pattern) {
        validationCode += `
          if (!/${schema.pattern}/.test(value)) {
            throw new Error('String does not match required pattern');
          }
        `
      }
    }

    // Number validations
    if (schema.type === 'number' || schema.type === 'integer') {
      if (schema.minimum !== undefined) {
        validationCode += `
          if (value < ${schema.minimum}) {
            throw new Error('Value must be >= ${schema.minimum}');
          }
        `
      }
      if (schema.maximum !== undefined) {
        validationCode += `
          if (value > ${schema.maximum}) {
            throw new Error('Value must be <= ${schema.maximum}');
          }
        `
      }
    }

    // Array validations
    if (schema.type === 'array') {
      if (schema.minItems) {
        validationCode += `
          if (value.length < ${schema.minItems}) {
            throw new Error('Array must have at least ${schema.minItems} items');
          }
        `
      }
      if (schema.maxItems) {
        validationCode += `
          if (value.length > ${schema.maxItems}) {
            throw new Error('Array must have at most ${schema.maxItems} items');
          }
        `
      }
    }

    return `
      function validatePort_${port.id}(value) {
        ${validationCode}
        return true;
      }
    `
  }
}

// Example of how different HTTP methods generate different port configurations
export class RESTVerbPortGenerator {
  generatePortsByVerb(method: string, path: string, operation: Operation): PortConfiguration {
    const config: PortConfiguration = {
      inputs: [],
      outputs: [],
      metadata: {
        method,
        path,
        operationId: operation.operationId,
      },
    }

    switch (method.toLowerCase()) {
      case 'get':
        // GET: Query params and path params as inputs, response as output
        config.inputs = [
          ...this.extractPathParams(path, operation),
          ...this.extractQueryParams(operation),
        ]
        config.outputs = [
          this.extractResponseData(operation, '200'),
          this.createStatusCodePort(),
          this.createMetadataPort(),
        ]
        break

      case 'post':
        // POST: Body and path params as inputs, created resource as output
        config.inputs = [
          ...this.extractPathParams(path, operation),
          this.extractRequestBody(operation),
        ]
        config.outputs = [
          this.extractResponseData(operation, '201'),
          this.createLocationHeaderPort(),
          this.createStatusCodePort(),
        ]
        break

      case 'put':
        // PUT: Complete replacement - body and path params as inputs
        config.inputs = [
          ...this.extractPathParams(path, operation),
          this.extractRequestBody(operation),
        ]
        config.outputs = [this.extractResponseData(operation, '200'), this.createStatusCodePort()]
        break

      case 'patch':
        // PATCH: Partial update - patch document as input
        config.inputs = [
          ...this.extractPathParams(path, operation),
          this.extractPatchBody(operation),
        ]
        config.outputs = [this.extractResponseData(operation, '200'), this.createStatusCodePort()]
        break

      case 'delete':
        // DELETE: Minimal - usually just path params as input
        config.inputs = [
          ...this.extractPathParams(path, operation),
          ...this.extractQueryParams(operation), // Sometimes has query params
        ]
        config.outputs = [this.createStatusCodePort(), this.createDeletionConfirmationPort()]
        break
    }

    // Add error output for all methods
    config.outputs.push(this.createErrorPort(operation))

    return config
  }

  private extractPatchBody(operation: Operation): Port {
    const requestBody = operation.requestBody

    return {
      id: 'patch-body',
      label: 'Patch Document',
      type: 'input',
      position: 'left',
      schema: {
        oneOf: [
          {
            // JSON Patch format (RFC 6902)
            type: 'array',
            items: {
              type: 'object',
              required: ['op', 'path'],
              properties: {
                op: {
                  type: 'string',
                  enum: ['add', 'remove', 'replace', 'move', 'copy', 'test'],
                },
                path: { type: 'string' },
                from: { type: 'string' },
                value: {},
              },
            },
          },
          {
            // JSON Merge Patch format (RFC 7396)
            type: 'object',
            additionalProperties: true,
          },
        ],
      },
    }
  }

  private createDeletionConfirmationPort(): Port {
    return {
      id: 'deletion-result',
      label: 'Deletion Result',
      type: 'output',
      position: 'right',
      schema: {
        type: 'object',
        properties: {
          deleted: { type: 'boolean' },
          deletedCount: { type: 'integer' },
          message: { type: 'string' },
        },
      },
    }
  }

  private createLocationHeaderPort(): Port {
    return {
      id: 'location',
      label: 'Resource Location',
      type: 'output',
      position: 'right',
      schema: {
        type: 'string',
        format: 'uri',
        description: 'Location of the created resource',
      },
    }
  }
}
```

#### 5.1.5 GraphQL Schema Import

```typescript
export class GraphQLTemplateGenerator {
  async generateFromSchema(schema: GraphQLSchema): Promise<NodeTemplate[]> {
    const templates: NodeTemplate[] = []

    // Generate templates for queries
    const queryType = schema.getQueryType()
    if (queryType) {
      const queryTemplates = this.generateFromType(queryType, 'query')
      templates.push(...queryTemplates)
    }

    // Generate templates for mutations
    const mutationType = schema.getMutationType()
    if (mutationType) {
      const mutationTemplates = this.generateFromType(mutationType, 'mutation')
      templates.push(...mutationTemplates)
    }

    // Generate templates for subscriptions
    const subscriptionType = schema.getSubscriptionType()
    if (subscriptionType) {
      const subTemplates = this.generateFromType(subscriptionType, 'subscription')
      templates.push(...subTemplates)
    }

    return templates
  }
}
```

### 5.2 Script-Based Template Generation

```typescript
export class ScriptTemplateGenerator {
  async generateFromScript(
    script: string,
    language: 'javascript' | 'python' | 'sql',
    metadata: ScriptMetadata
  ): Promise<NodeTemplate> {
    // Parse script to extract inputs/outputs
    const analysis = await this.analyzeScript(script, language)

    return {
      id: `tpl_script_${metadata.name}`,
      type: 'script',
      title: metadata.title || this.generateTitle(metadata.name),
      subtitle: `${language} Script`,
      description: metadata.description || analysis.description,
      category: 'scripting',
      subcategory: language,
      icon: this.getLanguageIcon(language),
      variant: this.getLanguageVariant(language),
      shape: 'rectangle',
      size: 'large',

      ports: [
        ...analysis.inputs.map(input => ({
          id: `input-${input.name}`,
          label: input.label || input.name,
          type: 'input' as const,
          position: 'left' as const,
        })),
        ...analysis.outputs.map(output => ({
          id: `output-${output.name}`,
          label: output.label || output.name,
          type: 'output' as const,
          position: 'right' as const,
        })),
      ],

      properties: {
        script: {
          type: 'code-editor',
          language,
          defaultValue: script,
          readOnly: metadata.readOnly || false,
        },
        ...this.generateScriptProperties(analysis, metadata),
      },

      requiredEnvVars: analysis.envVars,
      tags: ['script', language, ...metadata.tags],
      version: '1.0.0',
      isActive: true,

      source: {
        type: 'script',
        location: metadata.sourcePath,
      },
    }
  }

  private async analyzeScript(script: string, language: string): Promise<ScriptAnalysis> {
    // Use AST parsing or regex patterns to extract:
    // - Function parameters (inputs)
    // - Return values (outputs)
    // - Environment variable usage
    // - External dependencies

    const analyzer = this.getAnalyzer(language)
    return analyzer.analyze(script)
  }
}
```

### 5.3 Database Schema Import

```typescript
export class DatabaseTemplateGenerator {
  async generateFromSchema(
    connectionString: string,
    options: DBImportOptions
  ): Promise<NodeTemplate[]> {
    const templates: NodeTemplate[] = []

    // Connect to database
    const schema = await this.introspectDatabase(connectionString)

    // Generate CRUD templates for each table
    for (const table of schema.tables) {
      if (
        options.includeTables?.includes(table.name) ||
        !options.excludeTables?.includes(table.name)
      ) {
        // SELECT template
        templates.push(this.generateSelectTemplate(table))

        // INSERT template
        templates.push(this.generateInsertTemplate(table))

        // UPDATE template
        templates.push(this.generateUpdateTemplate(table))

        // DELETE template
        templates.push(this.generateDeleteTemplate(table))

        // Custom query template
        if (options.includeCustomQuery) {
          templates.push(this.generateCustomQueryTemplate(table))
        }
      }
    }

    // Generate stored procedure templates
    if (options.includeStoredProcedures) {
      for (const proc of schema.procedures) {
        templates.push(this.generateProcedureTemplate(proc))
      }
    }

    return templates
  }
}
```

---

## 6. Semantic Search Engine

### 6.1 Embedding Generation

```typescript
export class EmbeddingService {
  private openai: OpenAI
  private cache: EmbeddingCache

  async generateEmbeddings(template: NodeTemplate): Promise<TemplateEmbeddings> {
    // Check cache first
    const cached = await this.cache.get(template.id, template.version)
    if (cached) return cached

    // Generate different aspects for embedding
    const texts = {
      title: `${template.title} ${template.subtitle}`,
      description: template.description,
      capabilities: this.generateCapabilityText(template),
      useCase: this.generateUseCaseText(template),
      combined: this.generateCombinedText(template),
    }

    // Batch embedding generation
    const embeddings = await this.batchEmbed(texts)

    // Cache results
    await this.cache.set(template.id, template.version, embeddings)

    return embeddings
  }

  private generateCapabilityText(template: NodeTemplate): string {
    const parts = [
      `Category: ${template.category}`,
      template.subcategory ? `Subcategory: ${template.subcategory}` : '',
      `Type: ${template.type}`,
      `Tags: ${template.tags.join(', ')}`,

      // Port capabilities
      ...template.ports.map(
        port => `${port.type === 'input' ? 'Accepts' : 'Produces'} ${port.label}`
      ),

      // Property capabilities
      ...this.extractPropertyCapabilities(template.properties),
    ]

    return parts.filter(Boolean).join('. ')
  }

  private async batchEmbed(texts: Record<string, string>): Promise<TemplateEmbeddings> {
    const textArray = Object.values(texts)

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: textArray,
      dimensions: 1536,
    })

    const embeddings: TemplateEmbeddings = {}
    Object.keys(texts).forEach((key, index) => {
      embeddings[key] = response.data[index].embedding
    })

    return embeddings
  }
}
```

### 6.2 Search Implementation

```typescript
export class SemanticSearchService {
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embeddingService.embed(query)

    // Build hybrid search query
    const sql = this.buildHybridSearchQuery(options)

    // Execute search
    const results = await this.db.query(sql, [
      queryEmbedding,
      options.threshold || 0.5,
      options.category,
      options.limit || 20,
      query, // For keyword search
    ])

    // Post-process and rank results
    const ranked = this.rankResults(results.rows, query, options)

    // Enhance with explanations
    return this.enhanceResults(ranked, query)
  }

  private buildHybridSearchQuery(options: SearchOptions): string {
    return `
      WITH semantic_search AS (
        SELECT 
          tr.template_id,
          nt.template_data,
          1 - (tr.combined_embedding <=> $1::vector) AS semantic_score,
          1 - (tr.capability_embedding <=> $1::vector) AS capability_score
        FROM template_repository tr
        JOIN node_templates nt ON tr.template_id = nt.template_id
        WHERE 
          nt.status = 'active'
          AND (1 - (tr.combined_embedding <=> $1::vector)) > $2
          ${options.category ? 'AND nt.category = $3' : ''}
          ${options.tags?.length ? 'AND nt.tags && $4' : ''}
      ),
      keyword_search AS (
        SELECT 
          tr.template_id,
          nt.template_data,
          ts_rank(tr.search_text, plainto_tsquery('english', $5)) AS keyword_score
        FROM template_repository tr
        JOIN node_templates nt ON tr.template_id = nt.template_id
        WHERE 
          nt.status = 'active'
          AND tr.search_text @@ plainto_tsquery('english', $5)
      ),
      combined AS (
        SELECT 
          COALESCE(s.template_id, k.template_id) AS template_id,
          COALESCE(s.template_data, k.template_data) AS template_data,
          COALESCE(s.semantic_score, 0) * 0.4 +
          COALESCE(s.capability_score, 0) * 0.3 +
          COALESCE(k.keyword_score, 0) * 0.3 AS combined_score,
          s.semantic_score,
          s.capability_score,
          k.keyword_score
        FROM semantic_search s
        FULL OUTER JOIN keyword_search k ON s.template_id = k.template_id
      )
      SELECT 
        c.*,
        tr.capabilities,
        tr.usage_count,
        tr.average_rating
      FROM combined c
      JOIN template_repository tr ON c.template_id = tr.template_id
      ORDER BY 
        c.combined_score DESC,
        tr.usage_count DESC
      LIMIT $6
    `
  }

  private rankResults(results: any[], query: string, options: SearchOptions): SearchResult[] {
    return results
      .map(row => {
        // Calculate final score with multiple factors
        const score = this.calculateFinalScore({
          semanticScore: row.semantic_score,
          capabilityScore: row.capability_score,
          keywordScore: row.keyword_score,
          usageCount: row.usage_count,
          rating: row.average_rating,
          recency: this.calculateRecency(row.template_data.updatedAt),
          categoryMatch: options.category === row.template_data.category,
        })

        return {
          template: row.template_data,
          score,
          scores: {
            semantic: row.semantic_score,
            capability: row.capability_score,
            keyword: row.keyword_score,
            combined: score,
          },
          capabilities: row.capabilities,
        }
      })
      .sort((a, b) => b.score - a.score)
  }
}
```

### 6.3 Query Understanding

```typescript
export class QueryUnderstandingService {
  async analyzeQuery(query: string): Promise<QueryAnalysis> {
    // Use NLP to extract intent and entities
    const analysis = await this.nlpService.analyze(query)

    return {
      intent: this.classifyIntent(analysis),
      entities: this.extractEntities(analysis),
      categories: this.inferCategories(analysis),
      capabilities: this.inferCapabilities(analysis),
      dataFlow: this.inferDataFlow(analysis),
    }
  }

  private classifyIntent(analysis: NLPAnalysis): QueryIntent {
    // Classify what the user is trying to do
    const intents = [
      { pattern: /convert|transform|change/i, intent: 'transform' },
      { pattern: /fetch|get|retrieve|load/i, intent: 'retrieve' },
      { pattern: /send|post|save|store/i, intent: 'store' },
      { pattern: /analyze|process|calculate/i, intent: 'process' },
      { pattern: /connect|integrate/i, intent: 'integrate' },
    ]

    for (const { pattern, intent } of intents) {
      if (pattern.test(analysis.text)) {
        return intent as QueryIntent
      }
    }

    return 'general'
  }
}
```

---

## 7. API Specifications

### 7.1 REST API

#### 7.1.1 Template Endpoints

```yaml
openapi: 3.0.0
info:
  title: Node Template Repository API
  version: 1.0.0

paths:
  /api/templates:
    get:
      summary: List all templates
      parameters:
        - name: category
          in: query
          schema:
            type: string
        - name: tags
          in: query
          schema:
            type: array
            items:
              type: string
        - name: status
          in: query
          schema:
            type: string
            enum: [draft, active, deprecated]
        - name: page
          in: query
          schema:
            type: integer
        - name: limit
          in: query
          schema:
            type: integer
      responses:
        200:
          description: List of templates
          content:
            application/json:
              schema:
                type: object
                properties:
                  templates:
                    type: array
                    items:
                      $ref: '#/components/schemas/NodeTemplate'
                  pagination:
                    $ref: '#/components/schemas/Pagination'

    post:
      summary: Create new template
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NodeTemplate'
      responses:
        201:
          description: Template created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NodeTemplate'

  /api/templates/{templateId}:
    get:
      summary: Get template by ID
      parameters:
        - name: templateId
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Template details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NodeTemplate'

    put:
      summary: Update template
      parameters:
        - name: templateId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/NodeTemplate'
      responses:
        200:
          description: Template updated

    delete:
      summary: Delete template
      parameters:
        - name: templateId
          in: path
          required: true
          schema:
            type: string
      responses:
        204:
          description: Template deleted

  /api/templates/search:
    post:
      summary: Search templates semantically
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                query:
                  type: string
                options:
                  $ref: '#/components/schemas/SearchOptions'
      responses:
        200:
          description: Search results
          content:
            application/json:
              schema:
                type: object
                properties:
                  results:
                    type: array
                    items:
                      $ref: '#/components/schemas/SearchResult'

  /api/templates/{templateId}/compatible:
    get:
      summary: Find compatible templates
      parameters:
        - name: templateId
          in: path
          required: true
          schema:
            type: string
        - name: direction
          in: query
          schema:
            type: string
            enum: [upstream, downstream]
      responses:
        200:
          description: Compatible templates
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/CompatibilityResult'

  /api/templates/generate:
    post:
      summary: Generate template from source
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/APIGenerationRequest'
                - $ref: '#/components/schemas/ScriptGenerationRequest'
      responses:
        201:
          description: Template generated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NodeTemplate'

  /api/templates/compose:
    post:
      summary: Compose workflow from requirements
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                requirements:
                  type: string
                constraints:
                  type: object
      responses:
        200:
          description: Workflow composition
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WorkflowComposition'
```

### 7.2 GraphQL API

```graphql
type Query {
  # Template queries
  template(id: ID!): NodeTemplate
  templates(filter: TemplateFilter, pagination: PaginationInput): TemplateConnection!

  # Search queries
  searchTemplates(query: String!, options: SearchOptions): [SearchResult!]!

  # Compatibility queries
  findCompatibleTemplates(
    templateId: ID!
    direction: CompatibilityDirection!
  ): [CompatibilityResult!]!

  # Analytics queries
  templateAnalytics(templateId: ID!, timeRange: TimeRange): TemplateAnalytics!
}

type Mutation {
  # Template mutations
  createTemplate(input: CreateTemplateInput!): NodeTemplate!
  updateTemplate(id: ID!, input: UpdateTemplateInput!): NodeTemplate!
  deleteTemplate(id: ID!): Boolean!

  # Generation mutations
  generateTemplateFromAPI(input: APIGenerationInput!): NodeTemplate!
  generateTemplateFromScript(input: ScriptGenerationInput!): NodeTemplate!

  # Composition mutations
  composeWorkflow(input: CompositionInput!): WorkflowComposition!
}

type Subscription {
  # Real-time updates
  templateCreated: NodeTemplate!
  templateUpdated(id: ID!): NodeTemplate!
  templateDeleted(id: ID!): ID!
}

type NodeTemplate {
  id: ID!
  templateId: String!
  version: String!
  status: TemplateStatus!
  title: String!
  subtitle: String!
  description: String!
  category: String!
  subcategory: String
  tags: [String!]!
  icon: String!
  variant: String
  shape: NodeShape!
  size: NodeSize!
  ports: [Port!]!
  properties: JSON!
  propertyRules: PropertyRules
  requiredEnvVars: [String!]
  source: TemplateSource!
  createdAt: DateTime!
  updatedAt: DateTime!
  createdBy: String!

  # Relationships
  compatibleTemplates(direction: CompatibilityDirection!): [NodeTemplate!]!
  alternatives: [NodeTemplate!]!
  versions: [TemplateVersion!]!

  # Analytics
  usageCount: Int!
  averageRating: Float
  lastUsed: DateTime
}
```

---

## 8. Model Context Protocol (MCP) Server

### 8.1 MCP Server Implementation

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

export class TemplateRepositoryMCPServer {
  private server: Server
  private searchService: SemanticSearchService
  private compositionService: WorkflowCompositionService

  constructor() {
    this.server = new Server(
      {
        name: 'zeal-template-repository',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    )

    this.setupHandlers()
  }

  private setupHandlers() {
    // Resources
    this.server.setRequestHandler('resources/list', this.listResources.bind(this))
    this.server.setRequestHandler('resources/read', this.readResource.bind(this))

    // Tools
    this.server.setRequestHandler('tools/list', this.listTools.bind(this))
    this.server.setRequestHandler('tools/call', this.callTool.bind(this))
  }

  private async listResources() {
    return {
      resources: [
        {
          uri: 'templates://catalog',
          name: 'Template Catalog',
          description: 'Complete catalog of all node templates',
          mimeType: 'application/json',
        },
        {
          uri: 'templates://categories',
          name: 'Template Categories',
          description: 'Hierarchical category structure',
          mimeType: 'application/json',
        },
        {
          uri: 'templates://capabilities',
          name: 'Template Capabilities',
          description: 'Capability matrix of all templates',
          mimeType: 'application/json',
        },
      ],
    }
  }

  private async listTools() {
    return {
      tools: [
        {
          name: 'search_templates',
          description: 'Search for node templates using natural language',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Natural language search query',
              },
              filters: {
                type: 'object',
                properties: {
                  category: { type: 'string' },
                  tags: { type: 'array', items: { type: 'string' } },
                  status: { type: 'string' },
                },
              },
              limit: {
                type: 'number',
                default: 10,
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'find_compatible_templates',
          description: 'Find templates that can connect to a given template',
          inputSchema: {
            type: 'object',
            properties: {
              templateId: { type: 'string' },
              direction: {
                type: 'string',
                enum: ['upstream', 'downstream'],
              },
              limit: { type: 'number', default: 10 },
            },
            required: ['templateId', 'direction'],
          },
        },
        {
          name: 'compose_workflow',
          description: 'Generate a workflow from natural language requirements',
          inputSchema: {
            type: 'object',
            properties: {
              requirements: {
                type: 'string',
                description: 'Natural language workflow requirements',
              },
              constraints: {
                type: 'object',
                properties: {
                  mustInclude: { type: 'array', items: { type: 'string' } },
                  mustAvoid: { type: 'array', items: { type: 'string' } },
                  maxNodes: { type: 'number' },
                },
              },
            },
            required: ['requirements'],
          },
        },
        {
          name: 'explain_template',
          description: 'Get detailed explanation of a template capabilities',
          inputSchema: {
            type: 'object',
            properties: {
              templateId: { type: 'string' },
              aspect: {
                type: 'string',
                enum: ['general', 'inputs', 'outputs', 'configuration', 'usage'],
              },
            },
            required: ['templateId'],
          },
        },
      ],
    }
  }

  private async callTool(request: any) {
    const { name, arguments: args } = request.params

    switch (name) {
      case 'search_templates':
        return this.searchTemplates(args)

      case 'find_compatible_templates':
        return this.findCompatibleTemplates(args)

      case 'compose_workflow':
        return this.composeWorkflow(args)

      case 'explain_template':
        return this.explainTemplate(args)

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }
}
```

### 8.2 MCP Client Configuration

```json
{
  "mcpServers": {
    "zeal-templates": {
      "command": "node",
      "args": ["./mcp-server/index.js"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}",
        "OPENAI_API_KEY": "${OPENAI_API_KEY}"
      }
    }
  }
}
```

---

## 9. User Interface Components

### 9.1 Template Browser

```typescript
interface TemplateBrowserProps {
  onTemplateSelect: (template: NodeTemplate) => void;
  filters?: TemplateFilters;
}

export function TemplateBrowser({
  onTemplateSelect,
  filters
}: TemplateBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Semantic search with debounce
  const handleSearch = useDebounce(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const results = await searchTemplates(query, {
      category: selectedCategory,
      ...filters
    });

    setSearchResults(results);
  }, 300);

  return (
    <div className="template-browser">
      {/* Search bar with AI assistance */}
      <SearchBar
        value={searchQuery}
        onChange={(value) => {
          setSearchQuery(value);
          handleSearch(value);
        }}
        placeholder="Search templates naturally (e.g., 'send email when form submitted')"
        showAIAssist
      />

      {/* Category filter */}
      <CategoryFilter
        selected={selectedCategory}
        onChange={setSelectedCategory}
        categories={getCategories()}
      />

      {/* View mode toggle */}
      <ViewModeToggle
        mode={viewMode}
        onChange={setViewMode}
      />

      {/* Results */}
      {viewMode === 'grid' ? (
        <TemplateGrid
          results={searchResults}
          onSelect={onTemplateSelect}
        />
      ) : (
        <TemplateList
          results={searchResults}
          onSelect={onTemplateSelect}
        />
      )}

      {/* AI Suggestions */}
      {searchQuery && (
        <AISuggestions
          query={searchQuery}
          onSuggestionSelect={onTemplateSelect}
        />
      )}
    </div>
  );
}
```

### 9.2 Template Creator

```typescript
export function TemplateCreator() {
  const [sourceType, setSourceType] = useState<'manual' | 'api' | 'script'>('manual');
  const [template, setTemplate] = useState<Partial<NodeTemplate>>({});

  return (
    <div className="template-creator">
      {/* Source type selector */}
      <SourceTypeSelector
        value={sourceType}
        onChange={setSourceType}
      />

      {/* Different creation modes */}
      {sourceType === 'manual' && (
        <ManualTemplateEditor
          template={template}
          onChange={setTemplate}
        />
      )}

      {sourceType === 'api' && (
        <APIImporter
          onImport={(templates) => {
            // Handle imported templates
          }}
        />
      )}

      {sourceType === 'script' && (
        <ScriptAnalyzer
          onAnalyze={(template) => {
            setTemplate(template);
          }}
        />
      )}

      {/* Preview */}
      <TemplatePreview template={template} />

      {/* Actions */}
      <div className="actions">
        <Button onClick={validateTemplate}>Validate</Button>
        <Button onClick={testTemplate}>Test</Button>
        <Button onClick={saveTemplate} variant="primary">Save</Button>
      </div>
    </div>
  );
}
```

### 9.3 Workflow Composer

```typescript
export function WorkflowComposer() {
  const [requirements, setRequirements] = useState('');
  const [composition, setComposition] = useState<WorkflowComposition>();
  const [loading, setLoading] = useState(false);

  const handleCompose = async () => {
    setLoading(true);
    try {
      const result = await composeWorkflow(requirements);
      setComposition(result);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workflow-composer">
      {/* Requirements input */}
      <RequirementsEditor
        value={requirements}
        onChange={setRequirements}
        placeholder="Describe your workflow requirements..."
        examples={[
          "Fetch data from API, transform it, and save to database",
          "Monitor Twitter mentions and send Slack notifications",
          "Process uploaded CSV files and generate reports"
        ]}
      />

      {/* Compose button */}
      <Button
        onClick={handleCompose}
        loading={loading}
        disabled={!requirements}
      >
        Generate Workflow
      </Button>

      {/* Composition result */}
      {composition && (
        <>
          <CompositionPreview
            composition={composition}
            onEdit={(updated) => setComposition(updated)}
          />

          <ConfidenceIndicator
            confidence={composition.confidence}
            issues={composition.missingCapabilities}
          />

          <div className="actions">
            <Button onClick={exportComposition}>Export</Button>
            <Button onClick={createWorkflow} variant="primary">
              Create Workflow
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
```

---

## 10. Integration Points

### 10.1 Workflow Editor Integration

```typescript
// Integration with existing workflow editor
export class TemplateRepositoryIntegration {
  // Add template to canvas
  async addTemplateToCanvas(
    templateId: string,
    position: { x: number; y: number }
  ): Promise<WorkflowNode> {
    // Fetch template
    const template = await this.repository.getTemplate(templateId)

    // Convert template to node instance
    const node = this.createNodeFromTemplate(template, position)

    // Add to workflow
    this.workflowStore.addNode(node)

    // Track usage
    await this.analytics.trackTemplateUsage(templateId, 'add')

    return node
  }

  // Suggest next nodes
  async suggestNextNodes(currentNodeId: string): Promise<TemplateSuggestion[]> {
    const currentNode = this.workflowStore.getNode(currentNodeId)
    const template = await this.repository.getTemplateForNode(currentNode)

    // Find compatible downstream templates
    const compatible = await this.repository.findCompatibleTemplates(template.id, 'downstream')

    // Rank by relevance and usage
    return this.rankSuggestions(compatible, currentNode)
  }
}
```

### 10.2 CRDT Synchronization

```typescript
// Sync template usage across collaborative sessions
export class TemplateUsageSync {
  private ydoc: Y.Doc
  private templatesMap: Y.Map<TemplateUsageData>

  trackTemplateUsage(templateId: string, nodeId: string) {
    this.templatesMap.set(nodeId, {
      templateId,
      addedAt: Date.now(),
      addedBy: this.userId,
    })
  }

  getTemplateUsageStats(): TemplateUsageStats {
    const usage = new Map<string, number>()

    this.templatesMap.forEach(data => {
      const count = usage.get(data.templateId) || 0
      usage.set(data.templateId, count + 1)
    })

    return { usage, total: this.templatesMap.size }
  }
}
```

---

## 11. Security & Access Control

### 11.1 Template Permissions

```typescript
interface TemplatePermissions {
  // Role-based permissions
  roles: {
    admin: ['create', 'read', 'update', 'delete', 'publish']
    developer: ['create', 'read', 'update']
    user: ['read']
  }

  // Template-specific permissions
  templatePermissions: {
    public: boolean
    sharedWith: string[] // User IDs
    teams: string[] // Team IDs
  }

  // Category-based restrictions
  categoryRestrictions: {
    restricted: string[] // Restricted categories
    requiresApproval: string[]
  }
}
```

### 11.2 API Security

```typescript
// Middleware for API protection
export const templateSecurityMiddleware = {
  // Rate limiting
  rateLimit: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests',
  }),

  // Authentication
  authenticate: async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1]
    if (!token) return res.status(401).json({ error: 'Unauthorized' })

    try {
      const user = await verifyToken(token)
      req.user = user
      next()
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' })
    }
  },

  // Authorization
  authorize: (requiredRole: string) => {
    return (req, res, next) => {
      if (!hasRole(req.user, requiredRole)) {
        return res.status(403).json({ error: 'Forbidden' })
      }
      next()
    }
  },
}
```

---

## 12. Performance Requirements

### 12.1 Response Time Targets

| Operation            | Target | Maximum |
| -------------------- | ------ | ------- |
| Semantic Search      | 200ms  | 500ms   |
| Template Fetch       | 50ms   | 100ms   |
| Template Creation    | 500ms  | 1000ms  |
| Embedding Generation | 300ms  | 600ms   |
| Workflow Composition | 2s     | 5s      |

### 12.2 Scalability Requirements

- Support 10,000+ templates
- Handle 1000+ concurrent searches
- Process 100+ template creations per minute
- Store 1M+ usage analytics records

### 12.3 Optimization Strategies

```typescript
// Caching strategy
export class TemplateCacheStrategy {
  // Multi-layer caching
  layers = {
    memory: new LRUCache({ max: 100, ttl: 60000 }), // 1 minute
    redis: new RedisCache({ ttl: 3600 }), // 1 hour
    cdn: new CDNCache({ ttl: 86400 }), // 1 day
  }

  // Cache warming
  async warmCache() {
    const popular = await this.getPopularTemplates()
    for (const template of popular) {
      await this.preloadTemplate(template)
    }
  }

  // Invalidation
  async invalidate(templateId: string) {
    await Promise.all([
      this.layers.memory.delete(templateId),
      this.layers.redis.delete(templateId),
      this.layers.cdn.purge(templateId),
    ])
  }
}
```

---

## 13. Deployment & Operations

### 13.1 Deployment Architecture

```yaml
# docker-compose.yml
version: '3.8'

services:
  template-api:
    build: ./services/template-api
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
    ports:
      - '3001:3001'
    depends_on:
      - postgres
      - redis

  mcp-server:
    build: ./services/mcp-server
    environment:
      - DATABASE_URL=${DATABASE_URL}
    ports:
      - '3002:3002'

  ingestion-worker:
    build: ./services/ingestion-worker
    environment:
      - DATABASE_URL=${DATABASE_URL}
    volumes:
      - ./data/nodeTemplates:/templates

  postgres:
    image: pgvector/pgvector:pg15
    environment:
      - POSTGRES_DB=templates
      - POSTGRES_USER=zeal
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### 13.2 Monitoring & Observability

```typescript
// Metrics collection
export const metrics = {
  // Search metrics
  searchLatency: new Histogram({
    name: 'template_search_latency',
    help: 'Search operation latency',
    buckets: [0.1, 0.2, 0.5, 1, 2, 5],
  }),

  searchResults: new Counter({
    name: 'template_search_results_total',
    help: 'Total search results returned',
    labelNames: ['category', 'has_results'],
  }),

  // Template metrics
  templateCreations: new Counter({
    name: 'template_creations_total',
    help: 'Total templates created',
    labelNames: ['source_type'],
  }),

  // Error metrics
  errors: new Counter({
    name: 'template_errors_total',
    help: 'Total errors',
    labelNames: ['operation', 'error_type'],
  }),
}
```

### 13.3 Backup & Recovery

```bash
#!/bin/bash
# Backup script

# Backup database with embeddings
pg_dump $DATABASE_URL \
  --table=node_templates \
  --table=template_repository \
  --table=template_versions \
  > backup_$(date +%Y%m%d).sql

# Backup template files
tar -czf templates_$(date +%Y%m%d).tar.gz /data/nodeTemplates

# Upload to S3
aws s3 cp backup_$(date +%Y%m%d).sql s3://backups/
aws s3 cp templates_$(date +%Y%m%d).tar.gz s3://backups/
```

---

## 14. Testing Strategy

### 14.1 Test Coverage Requirements

- Unit Tests: 80% coverage
- Integration Tests: Key workflows
- E2E Tests: Critical user paths
- Performance Tests: Load testing
- Security Tests: Penetration testing

### 14.2 Test Implementation

```typescript
// Example test suite
describe('TemplateRepository', () => {
  describe('Semantic Search', () => {
    it('should find relevant templates', async () => {
      const results = await searchTemplates('send email notification')

      expect(results).toHaveLength(greaterThan(0))
      expect(results[0].template.category).toBe('communication')
      expect(results[0].score).toBeGreaterThan(0.7)
    })

    it('should handle complex queries', async () => {
      const results = await searchTemplates(
        'fetch data from API, transform it, and save to database'
      )

      expect(results).toContainTemplateTypes(['api-request', 'data-transformer', 'database-write'])
    })
  })

  describe('Template Generation', () => {
    it('should generate from OpenAPI spec', async () => {
      const spec = loadOpenAPISpec('test.yaml')
      const templates = await generateFromOpenAPI(spec)

      expect(templates).toHaveLength(5)
      templates.forEach(template => {
        expect(template).toMatchTemplateSchema()
      })
    })
  })
})
```

---

## 15. Migration Plan

### 15.1 Phase 1: Foundation (Weeks 1-2)

- Set up PostgreSQL with pgvector
- Create database schema
- Implement basic CRUD API
- Set up development environment

### 15.2 Phase 2: Ingestion (Weeks 3-4)

- Build file ingestion pipeline
- Index existing templates
- Generate embeddings
- Validate data integrity

### 15.3 Phase 3: Search (Weeks 5-6)

- Implement semantic search
- Build search UI
- Optimize query performance
- Add caching layer

### 15.4 Phase 4: Generation (Weeks 7-8)

- API schema import
- Script analysis
- Dynamic template creation
- Template validation

### 15.5 Phase 5: MCP Integration (Weeks 9-10)

- Build MCP server
- Implement tools
- Test with AI agents
- Documentation

### 15.6 Phase 6: UI & Polish (Weeks 11-12)

- Complete UI components
- Integration testing
- Performance optimization
- Deployment preparation

### 15.7 Rollout Strategy

1. Beta testing with select users
2. Gradual rollout (10% → 50% → 100%)
3. Monitor metrics and feedback
4. Iterate based on usage data

---

## Appendices

### A. Glossary

- **Template**: Blueprint for creating workflow nodes
- **Embedding**: Vector representation for semantic search
- **MCP**: Model Context Protocol for AI integration
- **Composition**: Automatic workflow generation

### B. References

- [pgvector Documentation](https://github.com/pgvector/pgvector)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)

### C. Configuration Examples

- Environment variables template
- Docker deployment configuration
- Kubernetes manifests
- CI/CD pipeline configuration
