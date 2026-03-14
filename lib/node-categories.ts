/**
 * Canonical node template categories and subcategories.
 *
 * External runtimes registering templates via ZIP should use these values
 * so their nodes appear in the correct section of the node palette.
 * Custom categories are allowed but won't have a dedicated palette section
 * until an admin configures one.
 */

export interface CategoryDefinition {
  id: string
  label: string
  description: string
  icon: string
  subcategories: SubcategoryDefinition[]
}

export interface SubcategoryDefinition {
  id: string
  label: string
  description: string
}

export const NODE_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'ai-models',
    label: 'AI Models',
    description: 'Language models, agents, and AI processing nodes',
    icon: 'brain',
    subcategories: [
      { id: 'llm', label: 'Language Models', description: 'Text generation and analysis models' },
      { id: 'agents', label: 'Agents', description: 'Autonomous AI agents with tool access' },
      { id: 'agent-tools', label: 'Agent Tools', description: 'Tools available to AI agents' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    description: 'Email, messaging, and notification nodes',
    icon: 'mail',
    subcategories: [
      { id: 'email', label: 'Email', description: 'Send and receive emails' },
      { id: 'messaging', label: 'Messaging', description: 'Chat and messaging platforms' },
      { id: 'voice', label: 'Voice', description: 'Voice and telephony services' },
    ],
  },
  {
    id: 'data-processing',
    label: 'Data Processing',
    description: 'Transform, aggregate, and process data',
    icon: 'shuffle',
    subcategories: [
      { id: 'aggregators', label: 'Aggregators', description: 'Combine and aggregate data' },
      { id: 'transformers', label: 'Transformers', description: 'Transform and reshape data' },
    ],
  },
  {
    id: 'data-sources',
    label: 'Data Sources',
    description: 'Databases, APIs, and file system connections',
    icon: 'database',
    subcategories: [
      { id: 'apis', label: 'APIs', description: 'REST, GraphQL, and other API integrations' },
      { id: 'databases', label: 'Databases', description: 'SQL and NoSQL database connections' },
      { id: 'files', label: 'Files', description: 'File storage and retrieval' },
    ],
  },
  {
    id: 'graph-io',
    label: 'Graph I/O',
    description: 'Subgraph inputs, outputs, and proxy nodes',
    icon: 'git-branch',
    subcategories: [],
  },
  {
    id: 'inputs',
    label: 'User Inputs',
    description: 'Interactive input controls for workflows',
    icon: 'text-cursor-input',
    subcategories: [
      { id: 'text', label: 'Text', description: 'Text and string input controls' },
      { id: 'numeric', label: 'Numeric', description: 'Number and range input controls' },
    ],
  },
  {
    id: 'logic-control',
    label: 'Logic & Control',
    description: 'Conditionals, loops, and flow control',
    icon: 'git-merge',
    subcategories: [
      { id: 'conditions', label: 'Conditions', description: 'If/else and switch logic' },
      { id: 'loops', label: 'Loops', description: 'Iteration and looping constructs' },
    ],
  },
  {
    id: 'media',
    label: 'Media',
    description: 'Image, audio, and video processing and display',
    icon: 'image',
    subcategories: [
      { id: 'images', label: 'Images', description: 'Image input and processing' },
      { id: 'audio', label: 'Audio', description: 'Audio input and processing' },
      { id: 'video', label: 'Video', description: 'Video input and processing' },
      { id: 'display', label: 'Display', description: 'Live stream display nodes' },
    ],
  },
  {
    id: 'scripting',
    label: 'Scripting',
    description: 'Code execution in various languages',
    icon: 'code',
    subcategories: [
      { id: 'javascript', label: 'JavaScript', description: 'JavaScript/Node.js execution' },
      { id: 'python', label: 'Python', description: 'Python script execution' },
      { id: 'sql', label: 'SQL', description: 'SQL query execution' },
      { id: 'nushell', label: 'NuShell', description: 'NuShell script execution' },
    ],
  },
  {
    id: 'storage-memory',
    label: 'Storage & Memory',
    description: 'Caching, state management, and queues',
    icon: 'hard-drive',
    subcategories: [
      { id: 'cache', label: 'Cache', description: 'In-memory and distributed caching' },
      { id: 'sessions', label: 'Sessions', description: 'Session state and queues' },
      { id: 'variables', label: 'Variables', description: 'Workflow variables and state' },
    ],
  },
  {
    id: 'tools-utilities',
    label: 'Tools & Utilities',
    description: 'HTTP clients, math, text processing, and general utilities',
    icon: 'wrench',
    subcategories: [
      { id: 'http', label: 'HTTP', description: 'HTTP requests and server nodes' },
      { id: 'math', label: 'Math', description: 'Mathematical operations' },
      { id: 'text', label: 'Text', description: 'Text manipulation and formatting' },
      { id: 'utilities', label: 'Utilities', description: 'Date/time, encoding, and general tools' },
      { id: 'triggers', label: 'Triggers', description: 'Webhooks, cron, and event triggers' },
    ],
  },
]

/** Flat set of valid category IDs for quick validation. */
export const VALID_CATEGORIES = new Set(NODE_CATEGORIES.map(c => c.id))

/** Flat set of valid subcategory IDs (across all categories). */
export const VALID_SUBCATEGORIES = new Set(
  NODE_CATEGORIES.flatMap(c => c.subcategories.map(s => s.id))
)

/** Look up a category by ID. */
export function getCategory(id: string): CategoryDefinition | undefined {
  return NODE_CATEGORIES.find(c => c.id === id)
}
