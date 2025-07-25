import { create } from 'zustand'
import { NodeMetadata } from '@/types/workflow'
import { 
  Database, Code, Bot, GitBranch, Shuffle, Cloud, Zap, 
  Mail, MessageSquare, Phone, FileText, Calculator, 
  Clock, Shield, Eye, Settings, Globe, Server, 
  Cpu, HardDrive, Network, Key, Lock, AlertTriangle,
  Image, Mic, Camera, Video, Music, FileImage,
  BarChart, TrendingUp, PieChart, Activity,
  Download, Upload, RefreshCw, Search, Filter,
  Webhook, Timer, PlayCircle, PauseCircle, StopCircle,
  User, Users, UserCheck, UserPlus,
  Package, Layers, Box, Archive, Brain, Wrench, Terminal
} from 'lucide-react'

export interface NodeRepositoryItem {
  id: string // Template ID (e.g., 'postgresql-connector')
  name: string
  description: string
  category: string
  subcategory?: string
  keywords: string[]
  tags: string[]
  metadata: NodeMetadata // Template metadata - instances get unique IDs when added to canvas
  isBuiltIn: boolean
  isInstalled: boolean
  version?: string
  author?: string
  documentation?: string
}

export interface NodeCategory {
  id: string
  name: string
  description: string
  icon: any
  subcategories?: NodeSubcategory[]
}

export interface NodeSubcategory {
  id: string
  name: string
  description: string
}

interface NodeRepositoryState {
  nodes: NodeRepositoryItem[]
  categories: NodeCategory[]
  searchQuery: string
  selectedCategory: string | null
  selectedSubcategory: string | null
  filteredNodes: NodeRepositoryItem[]
}

interface NodeRepositoryActions {
  // Search and filtering
  setSearchQuery: (query: string) => void
  setSelectedCategory: (categoryId: string | null) => void
  setSelectedSubcategory: (subcategoryId: string | null) => void
  searchNodes: () => void
  
  // Node management
  addNode: (node: NodeRepositoryItem) => void
  removeNode: (nodeId: string) => void
  updateNode: (nodeId: string, updates: Partial<NodeRepositoryItem>) => void
  installNode: (nodeId: string) => void
  uninstallNode: (nodeId: string) => void
  
  // Repository management
  refreshRepository: () => void
  importNodes: (nodes: NodeRepositoryItem[]) => void
  exportNodes: () => NodeRepositoryItem[]
}

type NodeRepositoryStore = NodeRepositoryState & NodeRepositoryActions

// Categories definition
const categories: NodeCategory[] = [
  {
    id: 'data-sources',
    name: 'Data Sources',
    description: 'Connect to databases, APIs, and external data sources',
    icon: Database,
    subcategories: [
      { id: 'databases', name: 'Databases', description: 'SQL and NoSQL database connectors' },
      { id: 'apis', name: 'APIs', description: 'REST, GraphQL, and other API connectors' },
      { id: 'files', name: 'Files', description: 'File system and cloud storage' },
      { id: 'streams', name: 'Streams', description: 'Real-time data streams and events' }
    ]
  },
  {
    id: 'ai-models',
    name: 'AI & Models',
    description: 'Language models, AI services, and machine learning tools',
    icon: Bot,
    subcategories: [
      { id: 'llm', name: 'Language Models', description: 'GPT, Claude, Gemini, and other LLMs' },
      { id: 'agents', name: 'AI Agents', description: 'Autonomous AI agents and assistants' },
      { id: 'agent-tools', name: 'Agent Tools', description: 'Tools and functions for AI agents' },
      { id: 'vision', name: 'Computer Vision', description: 'Image and video analysis models' },
      { id: 'audio', name: 'Audio Processing', description: 'Speech-to-text, text-to-speech, audio analysis' },
      { id: 'specialized', name: 'Specialized AI', description: 'Domain-specific AI models and tools' }
    ]
  },
  {
    id: 'logic-control',
    name: 'Logic & Control',
    description: 'Control flow, conditions, loops, and decision making',
    icon: GitBranch,
    subcategories: [
      { id: 'conditions', name: 'Conditions', description: 'If/else, switch, and conditional logic' },
      { id: 'loops', name: 'Loops', description: 'For each, while, and iteration controls' },
      { id: 'timing', name: 'Timing', description: 'Delays, schedules, and time-based controls' },
      { id: 'error-handling', name: 'Error Handling', description: 'Try/catch, error recovery, and validation' }
    ]
  },
  {
    id: 'data-processing',
    name: 'Data Processing',
    description: 'Transform, filter, aggregate, and manipulate data',
    icon: Shuffle,
    subcategories: [
      { id: 'transformers', name: 'Transformers', description: 'Data mapping and transformation' },
      { id: 'filters', name: 'Filters', description: 'Data filtering and selection' },
      { id: 'aggregators', name: 'Aggregators', description: 'Data grouping and aggregation' },
      { id: 'validators', name: 'Validators', description: 'Data validation and cleaning' }
    ]
  },
  {
    id: 'communication',
    name: 'Communication',
    description: 'Send messages, emails, notifications, and interact with users',
    icon: MessageSquare,
    subcategories: [
      { id: 'messaging', name: 'Messaging', description: 'Chat platforms and instant messaging' },
      { id: 'email', name: 'Email', description: 'Email sending and receiving' },
      { id: 'notifications', name: 'Notifications', description: 'Push notifications and alerts' },
      { id: 'voice', name: 'Voice & SMS', description: 'Voice calls and SMS messaging' }
    ]
  },
  {
    id: 'scripting',
    name: 'Scripting',
    description: 'Execute scripts and code in various programming languages',
    icon: Code,
    subcategories: [
      { id: 'javascript', name: 'JavaScript', description: 'Node.js and browser JavaScript execution' },
      { id: 'python', name: 'Python', description: 'Python script execution and libraries' },
      { id: 'sql', name: 'SQL', description: 'SQL query execution and database operations' },
      { id: 'nushell', name: 'Nushell', description: 'Modern shell scripting with structured data' }
    ]
  },
  {
    id: 'tools-utilities',
    name: 'Tools & Utilities',
    description: 'HTTP clients, calculators, and utility functions',
    icon: Settings,
    subcategories: [
      { id: 'http', name: 'HTTP Tools', description: 'REST clients and web requests' },
      { id: 'math', name: 'Mathematics', description: 'Calculations and mathematical operations' },
      { id: 'text', name: 'Text Processing', description: 'String manipulation and text utilities' },
      { id: 'utilities', name: 'General Utils', description: 'Miscellaneous utility functions' }
    ]
  },
  {
    id: 'storage-memory',
    name: 'Storage & Memory',
    description: 'Store variables, manage sessions, and handle temporary data',
    icon: HardDrive,
    subcategories: [
      { id: 'variables', name: 'Variables', description: 'Variable storage and retrieval' },
      { id: 'sessions', name: 'Sessions', description: 'Session and state management' },
      { id: 'cache', name: 'Caching', description: 'Temporary data storage and caching' },
      { id: 'files', name: 'File Storage', description: 'File upload, download, and management' }
    ]
  },
  {
    id: 'integration',
    name: 'Integration',
    description: 'Webhooks, automation, triggers, and third-party integrations',
    icon: Zap,
    subcategories: [
      { id: 'webhooks', name: 'Webhooks', description: 'Webhook handlers and triggers' },
      { id: 'automation', name: 'Automation', description: 'Workflow automation and scheduling' },
      { id: 'triggers', name: 'Triggers', description: 'Event triggers and listeners' },
      { id: 'connectors', name: 'Connectors', description: 'Third-party service integrations' }
    ]
  },
  {
    id: 'security',
    name: 'Security',
    description: 'Authentication, authorization, encryption, and security tools',
    icon: Shield,
    subcategories: [
      { id: 'auth', name: 'Authentication', description: 'OAuth, JWT, and login systems' },
      { id: 'encryption', name: 'Encryption', description: 'Data encryption and decryption' },
      { id: 'access', name: 'Access Control', description: 'Permissions and access management' },
      { id: 'security', name: 'Security Tools', description: 'Security scanning and validation' }
    ]
  },
  {
    id: 'monitoring',
    name: 'Monitoring',
    description: 'Logging, debugging, analytics, and performance monitoring',
    icon: Activity,
    subcategories: [
      { id: 'logging', name: 'Logging', description: 'Log collection and management' },
      { id: 'debugging', name: 'Debugging', description: 'Debug outputs and inspection tools' },
      { id: 'analytics', name: 'Analytics', description: 'Data analytics and insights' },
      { id: 'performance', name: 'Performance', description: 'Performance monitoring and optimization' }
    ]
  }
]

// Sample node templates with comprehensive coverage
const sampleNodes: NodeRepositoryItem[] = [
  // Data Sources - Databases
  {
    id: 'postgresql-connector',
    name: 'PostgreSQL',
    description: 'Connect to PostgreSQL databases and execute queries',
    category: 'data-sources',
    subcategory: 'databases',
    keywords: ['postgresql', 'postgres', 'database', 'sql', 'query'],
    tags: ['database', 'sql', 'relational'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'postgresql-connector', // Template ID - instances get unique IDs when added to canvas
      type: 'database',
      title: 'PostgreSQL',
      subtitle: 'Database Connector',
      icon: Database,
      variant: 'black',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        { id: 'pg-out-data', label: 'Records', type: 'output', position: 'right' },
        { id: 'pg-out-count', label: 'Count', type: 'output', position: 'bottom' },
        { id: 'pg-out-error', label: 'Error', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'host', label: 'Host', type: 'text', required: true, defaultValue: 'localhost' },
        { id: 'port', label: 'Port', type: 'number', defaultValue: 5432 },
        { id: 'database', label: 'Database', type: 'text', required: true },
        { id: 'query', label: 'SQL Query', type: 'textarea', required: true, placeholder: 'SELECT * FROM users' }
      ],
      requiredEnvVars: ['DATABASE_URL', 'DB_USERNAME', 'DB_PASSWORD'],
      propertyValues: {
        host: 'localhost',
        port: 5432,
        database: '',
        query: ''
      }
    }
  },
  
  // AI Models - LLM
  {
    id: 'openai-gpt4',
    name: 'OpenAI GPT-4',
    description: 'OpenAI GPT-4 language model for text generation and analysis',
    category: 'ai-models',
    subcategory: 'llm',
    keywords: ['openai', 'gpt4', 'gpt', 'llm', 'ai', 'language model', 'chat'],
    tags: ['ai', 'llm', 'openai', 'text-generation'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'openai-gpt4',
      type: 'ai-model',
      title: 'GPT-4',
      subtitle: 'OpenAI Language Model',
      icon: Bot,
      variant: 'black',
      shape: 'circle',
      size: 'medium',
      ports: [
        { id: 'gpt4-in-prompt', label: 'Prompt', type: 'input', position: 'left' },
        { id: 'gpt4-in-context', label: 'Context', type: 'input', position: 'top' },
        { id: 'gpt4-out-response', label: 'Response', type: 'output', position: 'right' },
        { id: 'gpt4-out-tokens', label: 'Token Count', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'model', label: 'Model', type: 'select', options: ['gpt-4', 'gpt-4-turbo', 'gpt-4o'], defaultValue: 'gpt-4' },
        { id: 'maxTokens', label: 'Max Tokens', type: 'number', defaultValue: 2000 },
        { id: 'temperature', label: 'Temperature', type: 'number', defaultValue: 0.7 },
        { id: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are a helpful assistant...' }
      ],
      requiredEnvVars: ['OPENAI_API_KEY'],
      propertyValues: {
        model: 'gpt-4',
        maxTokens: 2000,
        temperature: 0.7,
        systemPrompt: ''
      }
    }
  },

  // Logic & Control - Conditions
  {
    id: 'if-condition',
    name: 'If Condition',
    description: 'Route data based on conditional logic with multiple outcomes',
    category: 'logic-control',
    subcategory: 'conditions',
    keywords: ['if', 'condition', 'conditional', 'logic', 'branch', 'decision'],
    tags: ['logic', 'conditional', 'branching'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'if-condition',
      type: 'condition',
      title: 'If Condition',
      subtitle: 'Conditional Logic',
      icon: GitBranch,
      variant: 'gray-700',
      shape: 'diamond',
      size: 'medium',
      ports: [
        { id: 'if-in-data', label: 'Input', type: 'input', position: 'top' },
        { id: 'if-out-true', label: 'True', type: 'output', position: 'right' },
        { id: 'if-out-false', label: 'False', type: 'output', position: 'bottom' }
      ],
      properties: [
        { 
          id: 'conditions', 
          label: 'Conditions', 
          type: 'rules',
          availableFields: ['value', 'length', 'type', 'status', 'count'],
          availableOperators: ['is', 'is_not', 'greater_than', 'less_than', 'contains', 'empty'],
          description: 'Define the conditions for the if statement'
        }
      ],
      propertyValues: {
        conditions: []
      }
    }
  },

  // Communication - Messaging
  {
    id: 'slack-message',
    name: 'Slack Message',
    description: 'Send messages to Slack channels or direct messages',
    category: 'communication',
    subcategory: 'messaging',
    keywords: ['slack', 'message', 'chat', 'notification', 'team', 'channel'],
    tags: ['communication', 'slack', 'messaging'],
    isBuiltIn: true,
    isInstalled: false,
    metadata: {
      id: 'slack-message',
      type: 'communication',
      title: 'Slack Message',
      subtitle: 'Send to Slack',
      icon: MessageSquare,
      variant: 'gray-600',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        { id: 'slack-in-message', label: 'Message', type: 'input', position: 'left' },
        { id: 'slack-in-data', label: 'Data', type: 'input', position: 'top' },
        { id: 'slack-out-success', label: 'Success', type: 'output', position: 'right' },
        { id: 'slack-out-error', label: 'Error', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'channel', label: 'Channel', type: 'text', placeholder: '#general' },
        { id: 'username', label: 'Bot Username', type: 'text', defaultValue: 'Workflow Bot' },
        { id: 'emoji', label: 'Emoji Icon', type: 'text', defaultValue: ':robot_face:' }
      ],
      requiredEnvVars: ['SLACK_WEBHOOK_URL', 'SLACK_BOT_TOKEN'],
      propertyValues: {
        channel: '',
        username: 'Workflow Bot',
        emoji: ':robot_face:'
      }
    }
  },

  // Data Processing - Transformers
  {
    id: 'json-transformer',
    name: 'JSON Transformer',
    description: 'Transform and manipulate JSON data with mapping and filtering',
    category: 'data-processing',
    subcategory: 'transformers',
    keywords: ['json', 'transform', 'map', 'data', 'convert', 'format'],
    tags: ['data-processing', 'json', 'transformation'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'json-transformer',
      type: 'transformer',
      title: 'JSON Transformer',
      subtitle: 'Data Transformation',
      icon: Shuffle,
      variant: 'gray-600',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        { id: 'json-in-data', label: 'Input Data', type: 'input', position: 'left' },
        { id: 'json-in-schema', label: 'Schema', type: 'input', position: 'top' },
        { id: 'json-out-transformed', label: 'Transformed', type: 'output', position: 'right' },
        { id: 'json-out-errors', label: 'Errors', type: 'output', position: 'bottom' }
      ],
      properties: [
        { 
          id: 'operations', 
          label: 'Data Operations', 
          type: 'dataOperations',
          availableFields: ['id', 'name', 'email', 'status', 'created_at', 'value'],
          description: 'Configure JSON transformation operations'
        }
      ],
      propertyValues: {
        operations: []
      }
    }
  },

  // Tools & Utilities - HTTP
  {
    id: 'http-request',
    name: 'HTTP Request',
    description: 'Make HTTP requests to APIs and web services',
    category: 'tools-utilities',
    subcategory: 'http',
    keywords: ['http', 'api', 'request', 'rest', 'get', 'post', 'web service'],
    tags: ['http', 'api', 'web'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'http-request',
      type: 'http',
      title: 'HTTP Request',
      subtitle: 'Web API Client',
      icon: Globe,
      variant: 'gray-700',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        { id: 'http-in-params', label: 'Parameters', type: 'input', position: 'left' },
        { id: 'http-in-body', label: 'Body', type: 'input', position: 'top' },
        { id: 'http-out-response', label: 'Response', type: 'output', position: 'right' },
        { id: 'http-out-error', label: 'Error', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/endpoint' },
        { id: 'method', label: 'Method', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], defaultValue: 'GET' },
        { id: 'headers', label: 'Headers', type: 'textarea', placeholder: 'Content-Type: application/json' },
        { id: 'timeout', label: 'Timeout (ms)', type: 'number', defaultValue: 5000 }
      ],
      propertyValues: {
        url: '',
        method: 'GET',
        headers: '',
        timeout: 5000
      }
    }
  },

  // AI Models - Agents
  {
    id: 'autonomous-agent',
    name: 'Autonomous Agent',
    description: 'AI agent that can reason, plan, and execute tasks autonomously',
    category: 'ai-models',
    subcategory: 'agents',
    keywords: ['agent', 'autonomous', 'ai', 'reasoning', 'planning', 'task execution'],
    tags: ['ai', 'agent', 'autonomous', 'reasoning'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'autonomous-agent',
      type: 'ai-agent',
      title: 'Autonomous Agent',
      subtitle: 'AI Task Executor',
      icon: Brain,
      variant: 'black',
      shape: 'circle',
      size: 'medium',
      ports: [
        { id: 'agent-in-task', label: 'Task', type: 'input', position: 'left' },
        { id: 'agent-in-context', label: 'Context', type: 'input', position: 'top' },
        { id: 'agent-out-result', label: 'Result', type: 'output', position: 'right' },
        { id: 'agent-out-actions', label: 'Actions Taken', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'agentType', label: 'Agent Type', type: 'select', options: ['task-executor', 'researcher', 'analyst', 'coordinator'], defaultValue: 'task-executor' },
        { id: 'systemPrompt', label: 'System Prompt', type: 'textarea', placeholder: 'You are an autonomous AI agent...' },
        { id: 'maxIterations', label: 'Max Iterations', type: 'number', defaultValue: 10 },
        { id: 'enableTools', label: 'Enable Tool Use', type: 'boolean', defaultValue: true }
      ],
      propertyValues: {
        agentType: 'task-executor',
        systemPrompt: '',
        maxIterations: 10,
        enableTools: true
      }
    }
  },

  // AI Models - Agent Tools
  {
    id: 'web-search-tool',
    name: 'Web Search Tool',
    description: 'Tool for AI agents to search the web and retrieve information',
    category: 'ai-models',
    subcategory: 'agent-tools',
    keywords: ['web', 'search', 'tool', 'agent', 'information', 'retrieval'],
    tags: ['tool', 'web-search', 'agent', 'information'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'web-search-tool',
      type: 'agent-tool',
      title: 'Web Search',
      subtitle: 'Agent Tool',
      icon: Wrench,
      variant: 'gray-600',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        { id: 'search-in-query', label: 'Query', type: 'input', position: 'left' },
        { id: 'search-out-results', label: 'Results', type: 'output', position: 'right' },
        { id: 'search-out-metadata', label: 'Metadata', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'searchEngine', label: 'Search Engine', type: 'select', options: ['google', 'bing', 'duckduckgo'], defaultValue: 'google' },
        { id: 'maxResults', label: 'Max Results', type: 'number', defaultValue: 10 },
        { id: 'safeSearch', label: 'Safe Search', type: 'boolean', defaultValue: true }
      ],
      requiredEnvVars: ['SEARCH_API_KEY'],
      propertyValues: {
        searchEngine: 'google',
        maxResults: 10,
        safeSearch: true
      }
    }
  },

  // Scripting - JavaScript
  {
    id: 'javascript-runner',
    name: 'JavaScript Runner',
    description: 'Execute JavaScript code with Node.js runtime and npm packages',
    category: 'scripting',
    subcategory: 'javascript',
    keywords: ['javascript', 'nodejs', 'npm', 'script', 'code', 'execution'],
    tags: ['scripting', 'javascript', 'nodejs', 'execution'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'javascript-runner',
      type: 'script-executor',
      title: 'JavaScript',
      subtitle: 'Node.js Runtime',
      icon: Terminal,
      variant: 'gray-700',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        { id: 'js-in-input', label: 'Input Data', type: 'input', position: 'left' },
        { id: 'js-in-packages', label: 'Packages', type: 'input', position: 'top' },
        { id: 'js-out-result', label: 'Result', type: 'output', position: 'right' },
        { id: 'js-out-console', label: 'Console Output', type: 'output', position: 'bottom' },
        { id: 'js-out-error', label: 'Errors', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'code', label: 'JavaScript Code', type: 'textarea', required: true, placeholder: '// Your JavaScript code here\nconsole.log("Hello World");' },
        { id: 'timeout', label: 'Timeout (ms)', type: 'number', defaultValue: 30000 },
        { id: 'allowNetwork', label: 'Allow Network Access', type: 'boolean', defaultValue: false },
        { id: 'npmPackages', label: 'NPM Packages', type: 'textarea', placeholder: 'lodash\nmoment\naxios' }
      ],
      propertyValues: {
        code: '',
        timeout: 30000,
        allowNetwork: false,
        npmPackages: ''
      }
    }
  },

  // Scripting - Python
  {
    id: 'python-runner',
    name: 'Python Runner',
    description: 'Execute Python scripts with pip packages and data science libraries',
    category: 'scripting',
    subcategory: 'python',
    keywords: ['python', 'pip', 'script', 'data science', 'pandas', 'numpy'],
    tags: ['scripting', 'python', 'data-science', 'execution'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'python-runner',
      type: 'script-executor',
      title: 'Python',
      subtitle: 'Python Runtime',
      icon: Terminal,
      variant: 'gray-700',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        { id: 'py-in-input', label: 'Input Data', type: 'input', position: 'left' },
        { id: 'py-in-packages', label: 'Packages', type: 'input', position: 'top' },
        { id: 'py-out-result', label: 'Result', type: 'output', position: 'right' },
        { id: 'py-out-plots', label: 'Plots/Charts', type: 'output', position: 'bottom' },
        { id: 'py-out-error', label: 'Errors', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'code', label: 'Python Code', type: 'textarea', required: true, placeholder: '# Your Python code here\nprint("Hello World")' },
        { id: 'timeout', label: 'Timeout (ms)', type: 'number', defaultValue: 60000 },
        { id: 'pythonVersion', label: 'Python Version', type: 'select', options: ['3.9', '3.10', '3.11', '3.12'], defaultValue: '3.11' },
        { id: 'pipPackages', label: 'Pip Packages', type: 'textarea', placeholder: 'pandas\nnumpy\nmatplotlib\nrequests' }
      ],
      propertyValues: {
        code: '',
        timeout: 60000,
        pythonVersion: '3.11',
        pipPackages: ''
      }
    }
  },

  // Scripting - SQL
  {
    id: 'sql-runner',
    name: 'SQL Runner',
    description: 'Execute SQL queries against various database engines',
    category: 'scripting',
    subcategory: 'sql',
    keywords: ['sql', 'query', 'database', 'select', 'insert', 'update', 'delete'],
    tags: ['scripting', 'sql', 'database', 'query'],
    isBuiltIn: true,
    isInstalled: true,
    metadata: {
      id: 'sql-runner',
      type: 'script-executor',
      title: 'SQL Runner',
      subtitle: 'SQL Query Executor',
      icon: Database,
      variant: 'gray-700',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        { id: 'sql-in-connection', label: 'Connection', type: 'input', position: 'left' },
        { id: 'sql-in-params', label: 'Parameters', type: 'input', position: 'top' },
        { id: 'sql-out-result', label: 'Query Result', type: 'output', position: 'right' },
        { id: 'sql-out-metadata', label: 'Metadata', type: 'output', position: 'bottom' },
        { id: 'sql-out-error', label: 'Errors', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'query', label: 'SQL Query', type: 'textarea', required: true, placeholder: 'SELECT * FROM users WHERE status = ?;' },
        { id: 'engine', label: 'SQL Engine', type: 'select', options: ['postgresql', 'mysql', 'sqlite', 'mssql', 'oracle'], defaultValue: 'postgresql' },
        { id: 'timeout', label: 'Query Timeout (ms)', type: 'number', defaultValue: 30000 },
        { id: 'maxRows', label: 'Max Rows', type: 'number', defaultValue: 1000 }
      ],
      propertyValues: {
        query: '',
        engine: 'postgresql',
        timeout: 30000,
        maxRows: 1000
      }
    }
  },

  // Scripting - Nushell
  {
    id: 'nushell-runner',
    name: 'Nushell Runner',
    description: 'Execute Nushell scripts with structured data processing capabilities',
    category: 'scripting',
    subcategory: 'nushell',
    keywords: ['nushell', 'nu', 'shell', 'structured data', 'pipeline', 'script'],
    tags: ['scripting', 'nushell', 'shell', 'data-processing'],
    isBuiltIn: true,
    isInstalled: false,
    metadata: {
      id: 'nushell-runner',
      type: 'script-executor',
      title: 'Nushell',
      subtitle: 'Modern Shell',
      icon: Terminal,
      variant: 'gray-700',
      shape: 'rectangle',
      size: 'medium',
      ports: [
        { id: 'nu-in-input', label: 'Input Data', type: 'input', position: 'left' },
        { id: 'nu-in-env', label: 'Environment', type: 'input', position: 'top' },
        { id: 'nu-out-result', label: 'Result', type: 'output', position: 'right' },
        { id: 'nu-out-stdout', label: 'Output', type: 'output', position: 'bottom' },
        { id: 'nu-out-error', label: 'Errors', type: 'output', position: 'bottom' }
      ],
      properties: [
        { id: 'script', label: 'Nushell Script', type: 'textarea', required: true, placeholder: '# Your Nushell script here\nls | where size > 1kb | sort-by modified' },
        { id: 'timeout', label: 'Timeout (ms)', type: 'number', defaultValue: 30000 },
        { id: 'workingDir', label: 'Working Directory', type: 'text', placeholder: '/tmp' },
        { id: 'enableWebRequests', label: 'Enable Web Requests', type: 'boolean', defaultValue: false }
      ],
      propertyValues: {
        script: '',
        timeout: 30000,
        workingDir: '',
        enableWebRequests: false
      }
    }
  }
]

export const useNodeRepository = create<NodeRepositoryStore>((set, get) => ({
  // Initial state
  nodes: sampleNodes,
  categories,
  searchQuery: '',
  selectedCategory: null,
  selectedSubcategory: null,
  filteredNodes: sampleNodes,

  // Search and filtering
  setSearchQuery: (query: string) => {
    set({ searchQuery: query })
    get().searchNodes()
  },

  setSelectedCategory: (categoryId: string | null) => {
    set({ selectedCategory: categoryId, selectedSubcategory: null })
    get().searchNodes()
  },

  setSelectedSubcategory: (subcategoryId: string | null) => {
    set({ selectedSubcategory: subcategoryId })
    get().searchNodes()
  },

  searchNodes: () => {
    const { nodes, searchQuery, selectedCategory, selectedSubcategory } = get()
    
    let filtered = nodes

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter(node => node.category === selectedCategory)
    }

    // Filter by subcategory
    if (selectedSubcategory) {
      filtered = filtered.filter(node => node.subcategory === selectedSubcategory)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(node => 
        node.name.toLowerCase().includes(query) ||
        node.description.toLowerCase().includes(query) ||
        node.keywords.some(keyword => keyword.toLowerCase().includes(query)) ||
        node.tags.some(tag => tag.toLowerCase().includes(query))
      )
    }

    set({ filteredNodes: filtered })
  },

  // Node management
  addNode: (node: NodeRepositoryItem) => {
    set(state => ({
      nodes: [...state.nodes, node]
    }))
    get().searchNodes()
  },

  removeNode: (nodeId: string) => {
    set(state => ({
      nodes: state.nodes.filter(node => node.id !== nodeId)
    }))
    get().searchNodes()
  },

  updateNode: (nodeId: string, updates: Partial<NodeRepositoryItem>) => {
    set(state => ({
      nodes: state.nodes.map(node => 
        node.id === nodeId ? { ...node, ...updates } : node
      )
    }))
    get().searchNodes()
  },

  installNode: (nodeId: string) => {
    get().updateNode(nodeId, { isInstalled: true })
  },

  uninstallNode: (nodeId: string) => {
    get().updateNode(nodeId, { isInstalled: false })
  },

  // Repository management
  refreshRepository: () => {
    // In a real implementation, this would fetch from a remote repository
    get().searchNodes()
  },

  importNodes: (nodes: NodeRepositoryItem[]) => {
    set(state => ({
      nodes: [...state.nodes, ...nodes]
    }))
    get().searchNodes()
  },

  exportNodes: () => {
    return get().nodes
  }
}))