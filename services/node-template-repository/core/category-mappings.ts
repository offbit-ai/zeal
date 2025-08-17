/**
 * Category mappings to preserve existing UI data
 * Maps internal category names to display information
 */

export interface CategoryMapping {
  name: string
  displayName: string
  description: string
  icon: string
  subcategories: {
    name: string
    displayName: string
    description: string
  }[]
}

export const categoryMappings: CategoryMapping[] = [
  {
    name: 'data-sources',
    displayName: 'Data Sources',
    description: 'Connect to databases, APIs, and external data sources',
    icon: 'database',
    subcategories: [
      {
        name: 'databases',
        displayName: 'Databases',
        description: 'SQL and NoSQL database connectors',
      },
      {
        name: 'apis',
        displayName: 'APIs',
        description: 'REST, GraphQL, and other API connectors',
      },
      {
        name: 'files',
        displayName: 'Files',
        description: 'File system and cloud storage',
      },
      {
        name: 'streams',
        displayName: 'Streams',
        description: 'Real-time data streams and events',
      },
    ],
  },
  {
    name: 'ai-models',
    displayName: 'AI & Models',
    description: 'Language models, AI services, and machine learning tools',
    icon: 'brain',
    subcategories: [
      {
        name: 'llm',
        displayName: 'Language Models',
        description: 'GPT, Claude, Gemini, and other LLMs',
      },
      {
        name: 'agents',
        displayName: 'AI Agents',
        description: 'Autonomous AI agents and assistants',
      },
      {
        name: 'agent-tools',
        displayName: 'Agent Tools',
        description: 'Tools and functions for AI agents',
      },
      {
        name: 'vision',
        displayName: 'Computer Vision',
        description: 'Image and video analysis models',
      },
      {
        name: 'audio',
        displayName: 'Audio Processing',
        description: 'Speech-to-text, text-to-speech, audio analysis',
      },
      {
        name: 'specialized',
        displayName: 'Specialized AI',
        description: 'Domain-specific AI models and tools',
      },
    ],
  },
  {
    name: 'logic-control',
    displayName: 'Logic & Control',
    description: 'Control flow, conditions, loops, and decision making',
    icon: 'git-branch',
    subcategories: [
      {
        name: 'conditions',
        displayName: 'Conditions',
        description: 'If/else, switch, and conditional logic',
      },
      {
        name: 'loops',
        displayName: 'Loops',
        description: 'For each, while, and iteration controls',
      },
      {
        name: 'timing',
        displayName: 'Timing',
        description: 'Delays, schedules, and time-based controls',
      },
      {
        name: 'error-handling',
        displayName: 'Error Handling',
        description: 'Try/catch, error recovery, and validation',
      },
    ],
  },
  {
    name: 'data-processing',
    displayName: 'Data Processing',
    description: 'Transform, filter, aggregate, and manipulate data',
    icon: 'shuffle',
    subcategories: [
      {
        name: 'transformers',
        displayName: 'Transformers',
        description: 'Data mapping and transformation',
      },
      {
        name: 'filters',
        displayName: 'Filters',
        description: 'Data filtering and selection',
      },
      {
        name: 'aggregators',
        displayName: 'Aggregators',
        description: 'Data grouping and aggregation',
      },
      {
        name: 'validators',
        displayName: 'Validators',
        description: 'Data validation and cleaning',
      },
    ],
  },
  {
    name: 'communication',
    displayName: 'Communication',
    description: 'Send messages, emails, notifications, and interact with users',
    icon: 'message-square',
    subcategories: [
      {
        name: 'messaging',
        displayName: 'Messaging',
        description: 'Chat platforms and instant messaging',
      },
      {
        name: 'email',
        displayName: 'Email',
        description: 'Email sending and receiving',
      },
      {
        name: 'notifications',
        displayName: 'Notifications',
        description: 'Push notifications and alerts',
      },
      {
        name: 'voice',
        displayName: 'Voice & SMS',
        description: 'Voice calls and SMS messaging',
      },
    ],
  },
  {
    name: 'scripting',
    displayName: 'Scripting',
    description: 'Execute scripts and code in various programming languages',
    icon: 'code',
    subcategories: [
      {
        name: 'javascript',
        displayName: 'JavaScript',
        description: 'Sandboxed JavaScript execution with imports access',
      },
      {
        name: 'python',
        displayName: 'Python',
        description: 'Sandboxed Python execution with pip package support',
      },
      {
        name: 'sql',
        displayName: 'SQL',
        description: 'SQL query execution and database operations',
      },
      {
        name: 'nushell',
        displayName: 'Nushell',
        description: 'Modern shell scripting with structured data',
      },
    ],
  },
  {
    name: 'tools-utilities',
    displayName: 'Tools & Utilities',
    description: 'HTTP clients, calculators, and utility functions',
    icon: 'settings',
    subcategories: [
      {
        name: 'http',
        displayName: 'HTTP Tools',
        description: 'REST clients and web requests',
      },
      {
        name: 'math',
        displayName: 'Mathematics',
        description: 'Calculations and mathematical operations',
      },
      {
        name: 'text',
        displayName: 'Text Processing',
        description: 'String manipulation and text utilities',
      },
      {
        name: 'utilities',
        displayName: 'General Utils',
        description: 'Miscellaneous utility functions',
      },
    ],
  },
  {
    name: 'storage-memory',
    displayName: 'Storage & Memory',
    description: 'Store variables, manage sessions, and handle temporary data',
    icon: 'hard-drive',
    subcategories: [
      {
        name: 'variables',
        displayName: 'Variables',
        description: 'Variable storage and retrieval',
      },
      {
        name: 'sessions',
        displayName: 'Sessions',
        description: 'Session and state management',
      },
      {
        name: 'cache',
        displayName: 'Caching',
        description: 'Temporary data storage and caching',
      },
    ],
  },
  {
    name: 'graph-io',
    displayName: 'Graph I/O',
    description: 'Input and output nodes for data flow between graphs and subgraphs',
    icon: 'arrow-right-left',
    subcategories: [],
  },
  {
    name: 'media',
    displayName: 'Media',
    description: 'Image, audio, and video input/display nodes with streaming support',
    icon: 'image',
    subcategories: [
      {
        name: 'images',
        displayName: 'Images',
        description: 'Image upload, display, and GIF animations',
      },
      {
        name: 'audio',
        displayName: 'Audio',
        description: 'Audio upload and playback controls',
      },
      {
        name: 'video',
        displayName: 'Video',
        description: 'Video upload, streaming, and embed support',
      },
    ],
  },
  {
    name: 'inputs',
    displayName: 'Inputs',
    description: 'User input controls for text, numbers, and interactive elements',
    icon: 'text-cursor-input',
    subcategories: [
      {
        name: 'text',
        displayName: 'Text',
        description: 'Text input fields with validation and formatting',
      },
      {
        name: 'numeric',
        displayName: 'Numeric',
        description: 'Number inputs, sliders, and range controls',
      },
    ],
  },
  // Map user-inputs to inputs for consistency
  {
    name: 'user-inputs',
    displayName: 'Inputs',
    description: 'User input controls for text, numbers, and interactive elements',
    icon: 'text-cursor-input',
    subcategories: [
      {
        name: 'text',
        displayName: 'Text',
        description: 'Text input fields with validation and formatting',
      },
      {
        name: 'numeric',
        displayName: 'Numeric',
        description: 'Number inputs, sliders, and range controls',
      },
    ],
  },
]

// Helper function to get category info
export function getCategoryInfo(categoryName: string): CategoryMapping | undefined {
  return categoryMappings.find(cat => cat.name === categoryName)
}

// Helper function to get all categories with counts from templates
export function getCategoriesWithCounts(
  templates: Array<{ category: string; subcategory?: string }>
): Array<CategoryMapping & { totalNodes: number; isActive: boolean }> {
  const categoryStats = new Map<
    string,
    {
      total: number
      subcategories: Map<string, number>
    }
  >()

  // Count templates per category and subcategory
  templates.forEach(template => {
    const category = template.category
    const subcategory = template.subcategory

    if (!categoryStats.has(category)) {
      categoryStats.set(category, { total: 0, subcategories: new Map() })
    }

    const stats = categoryStats.get(category)!
    stats.total++

    if (subcategory) {
      stats.subcategories.set(subcategory, (stats.subcategories.get(subcategory) || 0) + 1)
    }
  })

  // Build result with counts
  return categoryMappings
    .map(category => {
      const stats = categoryStats.get(category.name) || { total: 0, subcategories: new Map() }

      return {
        ...category,
        totalNodes: stats.total,
        isActive: stats.total > 0,
        subcategories: category.subcategories.map(sub => ({
          ...sub,
          nodeCount: stats.subcategories.get(sub.name) || 0,
        })),
      }
    })
    .filter(cat => cat.totalNodes > 0) // Only return categories with nodes
}
