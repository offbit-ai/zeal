import { NodeTemplate } from './types'

/**
 * Scripting Node Templates
 */
export const scriptingTemplates: NodeTemplate[] = [
  {
    id: 'tpl_javascript_script',
    type: 'script',
    title: 'JavaScript Script',
    subtitle: 'Sandboxed JavaScript Runtime',
    category: 'scripting',
    subcategory: 'javascript',
    description: 'Execute sandboxed JavaScript code (no external packages)',
    icon: 'javascript',
    variant: 'gray-900',
    shape: 'rectangle',
    size: 'large',
    ports: [
      {
        id: 'data-in',
        label: 'Data',
        type: 'input',
        position: 'left',
      },
      {
        id: 'metadata-in',
        label: 'Metadata',
        type: 'input',
        position: 'top',
      },
      {
        id: 'result-out',
        label: 'Result',
        type: 'output',
        position: 'right',
      },
      {
        id: 'error-out',
        label: 'Error',
        type: 'output',
        position: 'bottom',
      },
    ],
    properties: {
      script: {
        type: 'code-editor',
        language: 'javascript',
        required: true,
        lineNumbers: true,
        wordWrap: true,
        placeholder:
          '// Access input data via imports and metadata\n// Example:\n// const data = imports.data || [];\n// const processed = data.map(item => ({\n//   ...item,\n//   processed: true,\n//   timestamp: Date.now()\n// }));\n// return { processed };',
      },
      timeout: {
        type: 'number',
        defaultValue: 10000,
        min: 100,
        max: 60000,
      },
      memoryLimit: {
        type: 'number',
        defaultValue: 128,
        description: 'Memory limit in MB',
      },
    },
    tags: ['script', 'javascript', 'sandboxed', 'processing'],
    version: '1.0.0',
    isActive: true,
  },
  {
    id: 'tpl_nushell_script',
    type: 'script',
    title: 'NuShell Script',
    subtitle: 'Structured Shell Scripting',
    category: 'scripting',
    subcategory: 'nushell',
    description: 'Execute NuShell scripts for structured data processing',
    icon: 'nushell',
    variant: 'green-600',
    shape: 'rectangle',
    size: 'large',
    ports: [
      {
        id: 'data-in',
        label: 'Data',
        type: 'input',
        position: 'left',
      },
      {
        id: 'args-in',
        label: 'Args',
        type: 'input',
        position: 'top',
      },
      {
        id: 'result-out',
        label: 'Result',
        type: 'output',
        position: 'right',
      },
      {
        id: 'error-out',
        label: 'Error',
        type: 'output',
        position: 'bottom',
      },
    ],
    properties: {
      script: {
        type: 'code-editor',
        language: 'shell',
        required: true,
        lineNumbers: true,
        wordWrap: true,
        placeholder:
          '# NuShell script for structured data processing\n# Example:\n# $data | where status == "active" | select name email | to json',
      },
      timeout: {
        type: 'number',
        defaultValue: 15000,
        min: 1000,
        max: 120000,
      },
      workingDirectory: {
        type: 'text',
        placeholder: '/tmp/workspace',
      },
    },
    tags: ['script', 'nushell', 'shell', 'structured'],
    version: '1.0.0',
    isActive: true,
  },
  {
    id: 'tpl_python_script',
    type: 'script',
    title: 'Python Script',
    subtitle: 'Execute Python with pip packages',
    category: 'scripting',
    subcategory: 'python',
    description: 'Execute sandboxed Python scripts with pip package support',
    icon: 'python',
    variant: 'orange-700',
    shape: 'rectangle',
    size: 'large',
    ports: [
      {
        id: 'data-in',
        label: 'Data',
        type: 'input',
        position: 'left',
      },
      {
        id: 'config-in',
        label: 'Config',
        type: 'input',
        position: 'top',
      },
      {
        id: 'result-out',
        label: 'Result',
        type: 'output',
        position: 'right',
      },
      {
        id: 'error-out',
        label: 'Error',
        type: 'output',
        position: 'bottom',
      },
    ],
    properties: {
      script: {
        type: 'code-editor',
        language: 'python',
        required: true,
        lineNumbers: true,
        wordWrap: true,
        placeholder:
          '# Access input data via imports and metadata\n# Example:\n# import pandas as pd\n# data = imports.get("data", [])\n# df = pd.DataFrame(data)\n# result = df.describe().to_dict()\n# return {"processed": result}',
      },
      packages: {
        type: 'textarea',
        placeholder: 'pandas\nnumpy\nrequests',
        description: 'Pip packages to install (one per line)',
      },
      timeout: {
        type: 'number',
        defaultValue: 30000,
        min: 1000,
        max: 300000,
      },
      memoryLimit: {
        type: 'number',
        defaultValue: 512,
        description: 'Memory limit in MB',
      },
    },
    tags: ['script', 'python', 'sandboxed', 'pip', 'processing'],
    version: '1.1.0',
    isActive: true,
  },
  {
    id: 'tpl_sql_script',
    type: 'script',
    title: 'SQL Script',
    subtitle: 'Execute SQL queries',
    category: 'scripting',
    subcategory: 'sql',
    description: 'Execute SQL queries using database connection pool',
    icon: 'database',
    variant: 'gray-700',
    shape: 'rectangle',
    size: 'large',
    ports: [
      {
        id: 'pool-in',
        label: 'Pool ID',
        type: 'input',
        position: 'left',
      },
      {
        id: 'params-in',
        label: 'Parameters',
        type: 'input',
        position: 'top',
      },
      {
        id: 'result-out',
        label: 'Result',
        type: 'output',
        position: 'right',
      },
      {
        id: 'error-out',
        label: 'Error',
        type: 'output',
        position: 'bottom',
      },
    ],
    properties: {
      query: {
        type: 'code-editor',
        language: 'sql',
        required: true,
        lineNumbers: true,
        wordWrap: true,
        placeholder:
          '-- SQL query with parameters\n-- Use $1, $2, etc. for PostgreSQL parameters\n-- Use ? for MySQL parameters\nSELECT * FROM users WHERE status = $1 AND created_at > $2;',
      },
      queryType: {
        type: 'select',
        options: ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRANSACTION'],
        defaultValue: 'SELECT',
      },
      timeout: {
        type: 'number',
        defaultValue: 30000,
        min: 1000,
        max: 300000,
      },
      maxRows: {
        type: 'number',
        defaultValue: 1000,
        description: 'Maximum rows to return',
      },
    },
    tags: ['script', 'sql', 'database', 'query'],
    version: '1.0.0',
    isActive: true,
    propertyRules: {
      triggers: ['queryType'],
      rules: [
        {
          when: "$.queryType == 'SELECT'",
          updates: {
            title: 'SQL Select',
            subtitle: 'Query Data',
            description: 'Retrieve data from database tables',
          },
        },
        {
          when: "$.queryType == 'INSERT'",
          updates: {
            title: 'SQL Insert',
            subtitle: 'Add Records',
            description: 'Insert new records into database',
          },
        },
        {
          when: "$.queryType == 'UPDATE'",
          updates: {
            title: 'SQL Update',
            subtitle: 'Modify Records',
            description: 'Update existing records in database',
          },
        },
        {
          when: "$.queryType == 'DELETE'",
          updates: {
            title: 'SQL Delete',
            subtitle: 'Remove Records',
            description: 'Delete records from database',
          },
        },
        {
          when: "$.queryType == 'TRANSACTION'",
          updates: {
            title: 'SQL Transaction',
            subtitle: 'Atomic Operations',
            description: 'Execute multiple SQL operations atomically',
          },
        },
      ],
    },
  },
]
