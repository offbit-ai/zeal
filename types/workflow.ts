import { LucideIcon } from 'lucide-react'

export type NodeShape = 'rectangle' | 'circle' | 'diamond'

export type NodeVariant = 'black' | 'gray-700' | 'gray-600' | 'gray-800' | 'gray-900' | 'blue-600'

export interface Port {
  id: string
  label: string
  type: 'input' | 'output'
  position: 'top' | 'right' | 'bottom' | 'left'
}

export type PropertyType = 'text' | 'number' | 'select' | 'boolean' | 'textarea' | 'rules' | 'dataOperations'

export type RuleOperator = 'is' | 'is_not' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal' | 'between' | 'empty' | 'not_empty'

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

export type DataOperationType = 'map' | 'filter' | 'sort' | 'transform' | 'group' | 'aggregate' | 'merge' | 'split'

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

export interface PropertyDefinition {
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
}

export interface NodeMetadata {
  id: string
  type: string
  title: string
  subtitle?: string
  icon: LucideIcon
  variant: NodeVariant
  shape: NodeShape
  size?: 'small' | 'medium' | 'large'
  ports?: Port[]
  properties?: PropertyDefinition[]
  propertyValues?: Record<string, any>
}

export interface WorkflowNodeData {
  metadata: NodeMetadata
  position: {
    x: number
    y: number
  }
}

export type ConnectionState = 'pending' | 'warning' | 'error' | 'success'

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
  state?: ConnectionState
}