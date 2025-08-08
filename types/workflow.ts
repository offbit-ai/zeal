// Note: Icons are now handled as strings through the Icon Library

export type NodeShape = 'rectangle' | 'circle' | 'diamond'

export type NodeVariant =
  | 'black'
  | 'gray-700'
  | 'gray-600'
  | 'gray-800'
  | 'gray-900'
  | 'blue-600'
  | 'green-600'
  | 'orange-600'
  | 'orange-700'
  | 'yellow-600'
  | 'purple-600'

// Special type for subgraph nodes
export interface SubgraphNodeMetadata extends NodeMetadata {
  type: 'subgraph'
  graphId: string // ID of the graph this node references
  graphNamespace: string // Namespace of the referenced graph
  graphName: string // Display name of the referenced graph
  workflowId?: string // ID of the workflow containing the graph
  workflowName?: string // Name of the workflow (for dynamic updates)
}

export interface Port {
  id: string
  label: string
  type: 'input' | 'output'
  position: 'top' | 'right' | 'bottom' | 'left'
}

export type PropertyType =
  | 'text'
  | 'number'
  | 'select'
  | 'boolean'
  | 'textarea'
  | 'rules'
  | 'dataOperations'
  | 'code-editor'
  | 'file'

export type RuleOperator =
  | 'is'
  | 'is_not'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'greater_equal'
  | 'less_equal'
  | 'between'
  | 'empty'
  | 'not_empty'

export type RuleConnector = 'AND' | 'OR'

export interface Rule {
  id: string
  field: string
  operator: RuleOperator
  value: any
  valueType?: 'string' | 'number' | 'date' | 'boolean'
}

export interface RuleGroup {
  id: string
  connector: RuleConnector
  rules: Rule[]
}

export interface RuleSet {
  id: string
  type: 'IF' | 'OR'
  groups: RuleGroup[]
  actions?: {
    setProperty?: { key: string; value: any }[]
    setOutput?: { port: string; value: any }[]
  }
}

export type DataOperationType =
  | 'map'
  | 'filter'
  | 'sort'
  | 'transform'
  | 'group'
  | 'aggregate'
  | 'merge'
  | 'split'

export type SortDirection = 'asc' | 'desc'

export type AggregateFunction = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'first' | 'last'

export interface DataOperation {
  id: string
  type: DataOperationType
  enabled: boolean
  // Map operation
  mapping?: {
    sourceField: string
    targetField: string
    transform?: string // JS expression or function
  }[]
  // Filter operation
  filterExpression?: string
  // Sort operation
  sortField?: string
  sortDirection?: SortDirection
  // Transform operation
  transformExpression?: string
  // Group operation
  groupByField?: string
  // Aggregate operation
  aggregateField?: string
  aggregateFunction?: AggregateFunction
  // General settings
  description?: string
}

export interface DataOperationSet {
  id: string
  name: string
  operations: DataOperation[]
}

export type PropertyDefinition = {
  id: string
  label: string
  type: PropertyType
  defaultValue?: any
  options?: string[] // For select type
  placeholder?: string
  required?: boolean
  description?: string
  // For rules type
  availableFields?: string[] // Fields that can be used in rules/data operations
  availableOperators?: RuleOperator[] // Operators available for this rule set
  // For code-editor type
  language?: 'javascript' | 'python' | 'sql' | 'json' | 'yaml' | 'shell' | 'graphql' // Programming language for syntax highlighting
  lineNumbers?: boolean // Show line numbers in code editor
  wordWrap?: boolean // Enable word wrap in code editor
  height?: number // Height of the code editor in pixels
  minimap?: boolean // Show minimap in code editor
} & { [key: string]: any } // Allow additional properties for flexibility}

export interface NodeMetadata {
  id: string
  templateId?: string // Reference to the node template schema
  type: string
  title: string
  subtitle?: string
  icon: string
  variant: NodeVariant
  shape: NodeShape
  size?: 'small' | 'medium' | 'large'
  ports?: Port[]
  properties: Record<string, PropertyDefinition>
  propertyValues?: Record<string, any>
  requiredEnvVars?: string[]
  propertyRules?: {
    triggers: string[]
    rules: Array<{
      when: string
      updates: Record<string, any>
    }>
  }
  [key: string]: any // Allow additional metadata fields
}

export interface WorkflowNodeData {
  metadata: NodeMetadata
  position: {
    x: number
    y: number
  }
}

export type ConnectionState = 'pending' | 'warning' | 'error' | 'success' | 'running'

export interface Connection {
  id: string
  source: {
    nodeId: string
    portId: string
  }
  target: {
    nodeId: string
    portId: string
  }
  metadata?: Record<string, any>
  state?: ConnectionState
}

export interface NodeGroup {
  id: string
  title: string
  description: string
  nodeIds: string[]
  position: { x: number; y: number }
  size: { width: number; height: number }
  color?: string
  isCollapsed?: boolean
  createdAt: string
  updatedAt: string
}
