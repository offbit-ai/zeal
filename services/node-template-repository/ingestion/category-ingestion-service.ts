/**
 * Category ingestion service
 * Imports predefined categories into the database
 */

import { CategoryOperations, NodeCategory, NodeSubcategory } from '../core/category-operations'

export interface CategoryDefinition {
  name: string
  displayName: string
  description: string
  icon: string
  subcategories: {
    name: string
    displayName: string
    description: string
    nodeCount?: number
  }[]
  totalNodes?: number
  isActive?: boolean
}

// Default categories to ingest (from the backup file)
export const defaultCategories: CategoryDefinition[] = [
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
]

export class CategoryIngestionService {
  constructor(private categoryOps: CategoryOperations) {}

  /**
   * Ingest all default categories
   */
  async ingestDefaultCategories(): Promise<{
    total: number
    succeeded: number
    failed: number
    errors: Array<{ category: string; error: string }>
  }> {
    const result = {
      total: defaultCategories.length,
      succeeded: 0,
      failed: 0,
      errors: [] as Array<{ category: string; error: string }>,
    }

    for (let i = 0; i < defaultCategories.length; i++) {
      const categoryDef = defaultCategories[i]
      try {
        await this.ingestCategory(categoryDef, i)
        result.succeeded++
      } catch (error) {
        result.failed++
        result.errors.push({
          category: categoryDef.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        console.error(`Failed to ingest category ${categoryDef.name}:`, error)
      }
    }

    return result
  }

  /**
   * Ingest a single category with its subcategories
   */
  private async ingestCategory(categoryDef: CategoryDefinition, sortOrder: number): Promise<void> {
    // Check if category already exists
    const existing = await this.categoryOps.getCategoryByName(categoryDef.name)

    let category: NodeCategory

    if (existing) {
      // Update existing category
      category = await this.categoryOps.updateCategory(existing.id!, {
        displayName: categoryDef.displayName,
        description: categoryDef.description,
        icon: categoryDef.icon,
        isActive: categoryDef.isActive !== false,
        sortOrder,
        updatedBy: 'system',
      })
    } else {
      // Create new category
      category = await this.categoryOps.createCategory({
        name: categoryDef.name,
        displayName: categoryDef.displayName,
        description: categoryDef.description,
        icon: categoryDef.icon,
        isActive: categoryDef.isActive !== false,
        sortOrder,
        createdBy: 'system',
        updatedBy: 'system',
      })
    }

    // Ingest subcategories
    if (category.id && categoryDef.subcategories.length > 0) {
      for (let j = 0; j < categoryDef.subcategories.length; j++) {
        const subcatDef = categoryDef.subcategories[j]

        try {
          // Check if subcategory exists (would need to add this method)
          // For now, we'll just create them
          await this.categoryOps.createSubcategory(category.id, {
            name: subcatDef.name,
            displayName: subcatDef.displayName,
            description: subcatDef.description,
            sortOrder: j,
          })
        } catch (error) {
          // If it's a unique constraint error, we can ignore it
          if (error instanceof Error && error.message.includes('duplicate')) {
            console.log(`Subcategory ${subcatDef.name} already exists, skipping`)
          } else {
            throw error
          }
        }
      }
    }
  }

  /**
   * Check if categories need to be ingested
   */
  async needsIngestion(): Promise<boolean> {
    const categories = await this.categoryOps.listCategories()
    return categories.length === 0
  }
}
