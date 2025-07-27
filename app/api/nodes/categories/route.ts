import { NextRequest, NextResponse } from 'next/server'
import { 
  createSuccessResponse, 
  withErrorHandling, 
  extractUserId,
  mockDelay
} from '@/lib/api-utils'
import { ApiError } from '@/types/api'
import { NodeRepositoryService } from '@/services/nodeRepositoryService'
import { apiCache, CACHE_TTL, invalidateCache } from '@/lib/api-cache'

interface NodeCategoryResponse {
  name: string
  displayName: string
  description: string
  icon: string
  subcategories: {
    name: string
    displayName: string
    description: string
    nodeCount: number
  }[]
  totalNodes: number
  isActive: boolean
}

// Backend mock data store (until we have a real database)
const categoriesStore: NodeCategoryResponse[] = [
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
        nodeCount: 5
      },
      {
        name: 'apis',
        displayName: 'APIs',
        description: 'REST, GraphQL, and other API connectors',
        nodeCount: 8
      },
      {
        name: 'files',
        displayName: 'Files',
        description: 'File system and cloud storage',
        nodeCount: 4
      },
      {
        name: 'streams',
        displayName: 'Streams',
        description: 'Real-time data streams and events',
        nodeCount: 2
      }
    ],
    totalNodes: 19,
    isActive: true
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
        nodeCount: 6
      },
      {
        name: 'agents',
        displayName: 'AI Agents',
        description: 'Autonomous AI agents and assistants',
        nodeCount: 8
      },
      {
        name: 'agent-tools',
        displayName: 'Agent Tools',
        description: 'Tools and functions for AI agents',
        nodeCount: 12
      },
      {
        name: 'vision',
        displayName: 'Computer Vision',
        description: 'Image and video analysis models',
        nodeCount: 4
      },
      {
        name: 'audio',
        displayName: 'Audio Processing',
        description: 'Speech-to-text, text-to-speech, audio analysis',
        nodeCount: 3
      },
      {
        name: 'specialized',
        displayName: 'Specialized AI',
        description: 'Domain-specific AI models and tools',
        nodeCount: 5
      }
    ],
    totalNodes: 38,
    isActive: true
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
        nodeCount: 4
      },
      {
        name: 'loops',
        displayName: 'Loops',
        description: 'For each, while, and iteration controls',
        nodeCount: 3
      },
      {
        name: 'timing',
        displayName: 'Timing',
        description: 'Delays, schedules, and time-based controls',
        nodeCount: 5
      },
      {
        name: 'error-handling',
        displayName: 'Error Handling',
        description: 'Try/catch, error recovery, and validation',
        nodeCount: 4
      }
    ],
    totalNodes: 16,
    isActive: true
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
        nodeCount: 8
      },
      {
        name: 'filters',
        displayName: 'Filters',
        description: 'Data filtering and selection',
        nodeCount: 6
      },
      {
        name: 'aggregators',
        displayName: 'Aggregators',
        description: 'Data grouping and aggregation',
        nodeCount: 5
      },
      {
        name: 'validators',
        displayName: 'Validators',
        description: 'Data validation and cleaning',
        nodeCount: 4
      }
    ],
    totalNodes: 23,
    isActive: true
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
        nodeCount: 8
      },
      {
        name: 'email',
        displayName: 'Email',
        description: 'Email sending and receiving',
        nodeCount: 5
      },
      {
        name: 'notifications',
        displayName: 'Notifications',
        description: 'Push notifications and alerts',
        nodeCount: 6
      },
      {
        name: 'voice',
        displayName: 'Voice & SMS',
        description: 'Voice calls and SMS messaging',
        nodeCount: 4
      }
    ],
    totalNodes: 23,
    isActive: true
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
        nodeCount: 1
      },
      {
        name: 'python',
        displayName: 'Python',
        description: 'Sandboxed Python execution with pip package support',
        nodeCount: 1
      },
      {
        name: 'sql',
        displayName: 'SQL',
        description: 'SQL query execution and database operations',
        nodeCount: 5
      },
      {
        name: 'nushell',
        displayName: 'Nushell',
        description: 'Modern shell scripting with structured data',
        nodeCount: 3
      }
    ],
    totalNodes: 12,
    isActive: true
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
        nodeCount: 6
      },
      {
        name: 'math',
        displayName: 'Mathematics',
        description: 'Calculations and mathematical operations',
        nodeCount: 8
      },
      {
        name: 'text',
        displayName: 'Text Processing',
        description: 'String manipulation and text utilities',
        nodeCount: 7
      },
      {
        name: 'utilities',
        displayName: 'General Utils',
        description: 'Miscellaneous utility functions',
        nodeCount: 5
      }
    ],
    totalNodes: 26,
    isActive: true
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
        nodeCount: 4
      },
      {
        name: 'sessions',
        displayName: 'Sessions',
        description: 'Session and state management',
        nodeCount: 3
      },
      {
        name: 'cache',
        displayName: 'Caching',
        description: 'Temporary data storage and caching',
        nodeCount: 5
      }
    ],
    totalNodes: 12,
    isActive: true
  }
]

// GET /api/nodes/categories - List node categories
export const GET = withErrorHandling(async (req: NextRequest) => {
  // Generate cache key
  const cacheKey = apiCache.generateKey(req)
  
  // Check cache first
  const cachedResponse = apiCache.get(cacheKey)
  if (cachedResponse) {
    console.log(`Cache hit for categories: ${cacheKey}`)
    return NextResponse.json(cachedResponse)
  }
  
  await mockDelay(75)
  
  const { searchParams } = new URL(req.url)
  const _userId = extractUserId(req) // Prefix with _ to indicate intentionally unused
  
  const includeSubcategories = searchParams.get('include_subcategories') !== 'false'
  const includeInactive = searchParams.get('include_inactive') === 'true'
  
  // Filter categories from backend store
  let filteredCategories = categoriesStore.filter((category: NodeCategoryResponse) => 
    includeInactive || category.isActive
  )
  
  // Optionally exclude subcategories for simplified response
  if (!includeSubcategories) {
    filteredCategories = filteredCategories.map((category: NodeCategoryResponse) => ({
      ...category,
      subcategories: []
    }))
  }
  
  const response = createSuccessResponse(filteredCategories, {
    timestamp: new Date().toISOString(),
    requestId: `req_${Date.now()}`
  })
  
  // Cache the response
  apiCache.set(cacheKey, response, CACHE_TTL.CATEGORIES)
  
  return NextResponse.json(response)
})

// POST /api/nodes/categories - Create new category (admin only)
export const POST = withErrorHandling(async (req: NextRequest) => {
  await mockDelay(150)
  
  const userId = extractUserId(req)
  const body = await req.json()
  
  // In real implementation, check if user has admin permissions
  if (!userId.startsWith('admin_')) {
    throw new ApiError('FORBIDDEN', 'Only administrators can create categories', 403)
  }
  
  // Validate required fields
  if (!body.name || !body.displayName) {
    throw new ApiError('VALIDATION_ERROR', 'name and displayName are required', 400)
  }
  
  // Check for duplicate category name
  const existingCategory = categoriesStore.find(category => category.name === body.name)
  if (existingCategory) {
    throw new ApiError(
      'DUPLICATE_CATEGORY_NAME',
      `Category with name '${body.name}' already exists`,
      409
    )
  }
  
  // Create new category
  const newCategory: NodeCategoryResponse = {
    name: body.name,
    displayName: body.displayName,
    description: body.description || '',
    icon: body.icon || 'folder',
    subcategories: body.subcategories || [],
    totalNodes: 0,
    isActive: true
  }
  
  categoriesStore.push(newCategory)
  
  // Invalidate all categories cache since this affects all users
  invalidateCache('/api/nodes/categories')
  
  return NextResponse.json(createSuccessResponse(newCategory), { status: 201 })
})