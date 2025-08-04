# Node Template Guide

This guide explains how to create and configure node templates for the Zeal workflow orchestrator, including metadata structure, property rules, and environment variable management.

## Table of Contents

1. [Node Template Structure](#node-template-structure)
2. [Metadata Fields](#metadata-fields)
3. [Property Definitions](#property-definitions)
4. [Property Rules System](#property-rules-system)
5. [Environment Variables](#environment-variables)
6. [Best Practices](#best-practices)
7. [Examples](#examples)

## Node Template Structure

Node templates are TypeScript objects that define reusable workflow components. They are organized by category in the `/data/nodeTemplates/` directory:

- `aiModels.ts` - AI and machine learning nodes
- `dataSources.ts` - Database and API connections
- `communication.ts` - Email, messaging, and notifications
- `toolsUtilities.ts` - General purpose tools
- `storageMemory.ts` - Caching and storage nodes
- `scripting.ts` - Code execution nodes
- `logicControl.ts` - Flow control and conditionals
- `dataProcessing.ts` - Data transformation nodes

### Basic Template Structure

```typescript
import { NodeTemplate } from './types'

export const exampleTemplate: NodeTemplate = {
  id: "tpl_example",
  type: "example-type",
  title: "Example Node",
  subtitle: "Node Description",
  category: "tools-utilities",
  subcategory: "general",
  description: "Detailed description of what this node does",
  icon: "box",
  variant: "blue-600",
  shape: "rectangle",
  size: "medium",
  ports: [...],
  properties: {...},
  requiredEnvVars: [...],
  tags: [...],
  version: "1.0.0",
  isActive: true,
  propertyRules: {...}
}
```

## Metadata Fields

### Required Fields

- **`id`** (string): Unique identifier for the template. Convention: `tpl_[name]`
- **`type`** (string): Node type category (e.g., "database", "api", "transformer")
- **`title`** (string): Display name of the node
- **`subtitle`** (string): Short description shown below the title
- **`category`** (string): Main category for organization
- **`description`** (string): Detailed explanation of the node's functionality
- **`icon`** (string): Icon name from the icon library
- **`ports`** (Port[]): Input and output connection points
- **`properties`** (Record<string, PropertyDefinition>): Configurable node properties
- **`tags`** (string[]): Searchable keywords
- **`version`** (string): Template version (semver format)
- **`isActive`** (boolean): Whether the template is available for use

### Optional Fields

- **`subcategory`** (string): Secondary categorization
- **`variant`** (string): Color variant (e.g., "blue-600", "green-500")
- **`shape`** (string): Node shape - "rectangle" | "circle" | "diamond" | "hexagon" | "octagon"
- **`size`** (string): Node size - "small" | "medium" | "large"
- **`requiredEnvVars`** (string[]): Required environment variables
- **`propertyRules`** (PropertyRules): Dynamic update rules

### Port Configuration

Ports define connection points for data flow:

```typescript
ports: [
  {
    id: 'input-1',
    label: 'Data In',
    type: 'input',
    position: 'left', // "top" | "right" | "bottom" | "left"
  },
  {
    id: 'output-1',
    label: 'Result',
    type: 'output',
    position: 'right',
  },
]
```

## Property Definitions

Properties define configurable parameters for each node:

### Property Types

1. **Text Input**

   ```typescript
   "apiKey": {
     type: "text",
     label: "API Key",
     required: true,
     placeholder: "Enter your API key",
     description: "Your service API key"
   }
   ```

2. **Number Input**

   ```typescript
   "timeout": {
     type: "number",
     label: "Timeout (ms)",
     defaultValue: 5000,
     min: 100,
     max: 30000,
     step: 100,
     description: "Request timeout in milliseconds"
   }
   ```

3. **Select Dropdown**

   ```typescript
   "method": {
     type: "select",
     label: "HTTP Method",
     options: ["GET", "POST", "PUT", "DELETE"],
     defaultValue: "GET",
     description: "HTTP request method"
   }
   ```

4. **Boolean Toggle**

   ```typescript
   "enableCache": {
     type: "boolean",
     label: "Enable Caching",
     defaultValue: true,
     description: "Cache responses for better performance"
   }
   ```

5. **Textarea**

   ```typescript
   "query": {
     type: "textarea",
     label: "SQL Query",
     placeholder: "SELECT * FROM users",
     rows: 5,
     description: "SQL query to execute"
   }
   ```

6. **Code Editor**

   ```typescript
   "script": {
     type: "code-editor",
     label: "Python Script",
     language: "python",
     height: 300,
     lineNumbers: true,
     minimap: false,
     placeholder: "# Write your Python code here"
   }
   ```

7. **Rules Editor**

   ```typescript
   "filterRules": {
     type: "rules",
     label: "Filter Rules",
     availableFields: ["status", "amount", "date"],
     availableOperators: ["is", "is_not", "greater_than", "less_than"],
     description: "Define filtering conditions"
   }
   ```

8. **Data Operations**
   ```typescript
   "transformations": {
     type: "dataOperations",
     label: "Data Transformations",
     availableFields: ["id", "name", "email", "created_at"],
     description: "Configure data transformation pipeline"
   }
   ```

## Property Rules System

Property rules enable dynamic node updates based on user selections. They are especially useful for multi-provider nodes or nodes with different operational modes.

### Basic Structure

```typescript
propertyRules: {
  triggers: ["provider", "operation"],  // Properties that trigger rule evaluation
  rules: [
    {
      when: "$.provider == 'openai'",  // JSON query condition
      updates: {                        // Updates to apply
        title: "OpenAI GPT",
        subtitle: "Language Model",
        icon: "openai",
        variant: "green-600",
        requiredEnvVars: ["OPENAI_API_KEY"]
      }
    }
  ]
}
```

### JSON Query Syntax

Property rules use a simple JSON query syntax for conditions:

- **Equality**: `$.property == 'value'`
- **Inequality**: `$.property != 'value'`
- **Greater than**: `$.property > 5`
- **Less than**: `$.property < 10`
- **Compound conditions**: `$.provider == 'openai' && $.model == 'gpt-4'`

### Updatable Fields

The following node metadata can be updated dynamically:

- `title` - Node display name
- `subtitle` - Node description
- `description` - Detailed description
- `icon` - Icon name
- `variant` - Color variant
- `requiredEnvVars` - Required environment variables

### Advanced Example: Multi-Provider AI Node

```typescript
propertyRules: {
  triggers: ["provider", "model"],
  rules: [
    // Provider-specific updates
    {
      when: "$.provider == 'openai'",
      updates: {
        icon: "openai",
        variant: "green-600",
        requiredEnvVars: ["OPENAI_API_KEY"]
      }
    },
    // Combined provider and model updates
    {
      when: "$.provider == 'openai' && $.model == 'gpt-4-turbo'",
      updates: {
        title: "GPT-4 Turbo",
        subtitle: "Latest OpenAI Model",
        description: "OpenAI's most advanced model with 128K context"
      }
    },
    // Operation-based updates
    {
      when: "$.operation == 'translate'",
      updates: {
        title: "Translator",
        subtitle: "Language Translation",
        icon: "globe"
      }
    }
  ]
}
```

## Environment Variables

### Static Environment Variables

Define required environment variables that are always needed:

```typescript
requiredEnvVars: ['DATABASE_URL', 'DATABASE_PASSWORD']
```

### Dynamic Environment Variables

Use property rules to change required variables based on user selections:

```typescript
propertyRules: {
  triggers: ["provider"],
  rules: [
    {
      when: "$.provider == 'aws'",
      updates: {
        requiredEnvVars: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION"]
      }
    },
    {
      when: "$.provider == 'azure'",
      updates: {
        requiredEnvVars: ["AZURE_STORAGE_ACCOUNT", "AZURE_STORAGE_KEY"]
      }
    }
  ]
}
```

### Environment Variable Validation

The system automatically:

1. Checks for missing environment variables when nodes are added
2. Displays warnings for missing variables
3. Allows users to configure variables through the settings panel
4. Re-validates after configuration changes

## Best Practices

### 1. Unique and Descriptive IDs

Use clear, prefixed IDs that describe the node's purpose:

- ✅ `tpl_openai_gpt`
- ✅ `tpl_postgres_query`
- ❌ `tpl_node1`
- ❌ `template_23`

### 2. Comprehensive Property Rules

For multi-mode nodes, cover all combinations:

```typescript
// Good: Handles all provider/model combinations
propertyRules: {
  triggers: ["provider", "model"],
  rules: [
    // Specific combinations
    { when: "$.provider == 'openai' && $.model == 'gpt-4'", updates: {...} },
    { when: "$.provider == 'openai' && $.model == 'gpt-3.5'", updates: {...} },
    // Fallback rules
    { when: "$.provider == 'openai'", updates: { icon: "openai" } }
  ]
}
```

### 3. User-Friendly Defaults

Always provide sensible defaults:

```typescript
properties: {
  timeout: {
    type: "number",
    defaultValue: 5000,  // Reasonable 5-second default
    min: 100,
    max: 30000
  },
  retries: {
    type: "number",
    defaultValue: 3,    // Retry failed requests 3 times
    min: 0,
    max: 10
  }
}
```

### 4. Clear Property Descriptions

Help users understand each property:

```typescript
properties: {
  batchSize: {
    type: "number",
    label: "Batch Size",
    defaultValue: 100,
    description: "Number of records to process at once. Larger batches are faster but use more memory.",
    min: 1,
    max: 1000
  }
}
```

### 5. Logical Port Positioning

Position ports intuitively:

- **Inputs**: Left and top
- **Outputs**: Right and bottom
- **Errors/Status**: Bottom
- **Configuration**: Top

### 6. Consistent Naming Conventions

- **IDs**: `snake_case` with prefixes (e.g., `tpl_node_name`, `port_in_data`)
- **Types**: `kebab-case` (e.g., `data-source`, `api-client`)
- **Properties**: `camelCase` (e.g., `maxRetries`, `enableCache`)

## Examples

### Example 1: Simple API Client

```typescript
export const apiClientTemplate: NodeTemplate = {
  id: 'tpl_api_client',
  type: 'api',
  title: 'API Client',
  subtitle: 'HTTP Request',
  category: 'tools-utilities',
  description: 'Make HTTP requests to any API endpoint',
  icon: 'globe',
  variant: 'blue-600',
  shape: 'rectangle',
  size: 'medium',
  ports: [
    { id: 'params_in', label: 'Parameters', type: 'input', position: 'left' },
    { id: 'headers_in', label: 'Headers', type: 'input', position: 'top' },
    { id: 'response_out', label: 'Response', type: 'output', position: 'right' },
    { id: 'error_out', label: 'Error', type: 'output', position: 'bottom' },
  ],
  properties: {
    url: {
      type: 'text',
      label: 'URL',
      required: true,
      placeholder: 'https://api.example.com/endpoint',
    },
    method: {
      type: 'select',
      label: 'Method',
      options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      defaultValue: 'GET',
    },
    timeout: {
      type: 'number',
      label: 'Timeout (ms)',
      defaultValue: 5000,
      min: 100,
      max: 30000,
    },
  },
  tags: ['api', 'http', 'request', 'rest'],
  version: '1.0.0',
  isActive: true,
}
```

### Example 2: Multi-Provider Database

```typescript
export const databaseTemplate: NodeTemplate = {
  id: 'tpl_database',
  type: 'database',
  title: 'Database',
  subtitle: 'Query Database',
  category: 'data-sources',
  subcategory: 'databases',
  description: 'Connect to various database providers',
  icon: 'database',
  variant: 'blue-700',
  shape: 'cylinder',
  size: 'medium',
  ports: [
    { id: 'query_in', label: 'Query', type: 'input', position: 'left' },
    { id: 'params_in', label: 'Parameters', type: 'input', position: 'top' },
    { id: 'results_out', label: 'Results', type: 'output', position: 'right' },
    { id: 'error_out', label: 'Error', type: 'output', position: 'bottom' },
  ],
  properties: {
    provider: {
      type: 'select',
      label: 'Database Type',
      options: ['postgresql', 'mysql', 'mongodb', 'redis'],
      defaultValue: 'postgresql',
    },
    connectionString: {
      type: 'text',
      label: 'Connection String',
      required: true,
      placeholder: 'postgres://user:pass@host:5432/db',
    },
    query: {
      type: 'textarea',
      label: 'Query',
      placeholder: 'SELECT * FROM users WHERE active = true',
    },
  },
  requiredEnvVars: ['DATABASE_URL'],
  tags: ['database', 'query', 'sql', 'nosql'],
  version: '1.0.0',
  isActive: true,
  propertyRules: {
    triggers: ['provider'],
    rules: [
      {
        when: "$.provider == 'postgresql'",
        updates: {
          title: 'PostgreSQL',
          subtitle: 'Relational Database',
          icon: 'postgresql',
          variant: 'blue-700',
          requiredEnvVars: ['POSTGRES_URL', 'POSTGRES_PASSWORD'],
        },
      },
      {
        when: "$.provider == 'mysql'",
        updates: {
          title: 'MySQL',
          subtitle: 'Relational Database',
          icon: 'mysql',
          variant: 'orange-600',
          requiredEnvVars: ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASSWORD'],
        },
      },
      {
        when: "$.provider == 'mongodb'",
        updates: {
          title: 'MongoDB',
          subtitle: 'Document Database',
          icon: 'mongodb',
          variant: 'green-600',
          requiredEnvVars: ['MONGODB_URI'],
        },
      },
      {
        when: "$.provider == 'redis'",
        updates: {
          title: 'Redis',
          subtitle: 'Key-Value Store',
          icon: 'redis',
          variant: 'red-600',
          requiredEnvVars: ['REDIS_URL'],
        },
      },
    ],
  },
}
```

### Example 3: AI Model with Complex Rules

```typescript
export const aiModelTemplate: NodeTemplate = {
  id: 'tpl_ai_assistant',
  type: 'ai-model',
  title: 'AI Assistant',
  subtitle: 'Language Model',
  category: 'ai-models',
  description: 'Multi-provider AI language model',
  icon: 'brain',
  variant: 'purple-600',
  shape: 'hexagon',
  size: 'large',
  ports: [
    { id: 'prompt_in', label: 'Prompt', type: 'input', position: 'left' },
    { id: 'context_in', label: 'Context', type: 'input', position: 'top' },
    { id: 'response_out', label: 'Response', type: 'output', position: 'right' },
    { id: 'usage_out', label: 'Usage', type: 'output', position: 'bottom' },
  ],
  properties: {
    provider: {
      type: 'select',
      label: 'AI Provider',
      options: ['openai', 'anthropic', 'google'],
      defaultValue: 'openai',
    },
    model: {
      type: 'select',
      label: 'Model',
      options: ['gpt-4', 'gpt-3.5', 'claude-3', 'gemini-pro'],
      defaultValue: 'gpt-4',
    },
    temperature: {
      type: 'number',
      label: 'Temperature',
      defaultValue: 0.7,
      min: 0,
      max: 1,
      step: 0.1,
      description: 'Controls randomness: 0 = focused, 1 = creative',
    },
    maxTokens: {
      type: 'number',
      label: 'Max Tokens',
      defaultValue: 1000,
      min: 1,
      max: 8000,
    },
  },
  requiredEnvVars: ['OPENAI_API_KEY'],
  tags: ['ai', 'llm', 'chatbot', 'assistant'],
  version: '2.0.0',
  isActive: true,
  propertyRules: {
    triggers: ['provider', 'model'],
    rules: [
      // Provider-based icon and env vars
      {
        when: "$.provider == 'openai'",
        updates: {
          icon: 'openai',
          variant: 'green-600',
          requiredEnvVars: ['OPENAI_API_KEY'],
        },
      },
      {
        when: "$.provider == 'anthropic'",
        updates: {
          icon: 'anthropic',
          variant: 'black',
          requiredEnvVars: ['ANTHROPIC_API_KEY'],
        },
      },
      // Combined provider + model rules
      {
        when: "$.provider == 'openai' && $.model == 'gpt-4'",
        updates: {
          title: 'GPT-4',
          subtitle: 'Advanced Reasoning',
          description: "OpenAI's most capable model",
        },
      },
      {
        when: "$.provider == 'anthropic' && $.model == 'claude-3'",
        updates: {
          title: 'Claude 3',
          subtitle: 'Constitutional AI',
          description: "Anthropic's helpful, harmless, and honest AI",
        },
      },
    ],
  },
}
```

## Conclusion

Node templates are the building blocks of Zeal workflows. By properly configuring metadata, property rules, and environment variables, you can create powerful, reusable components that adapt to user needs while maintaining security and usability.

For more examples, explore the existing templates in the `/data/nodeTemplates/` directory.
