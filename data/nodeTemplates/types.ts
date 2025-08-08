/**
 * Node Template Type Definitions
 */

import { NodeShape, NodeVariant } from '@/types/workflow'

export interface Port {
  id: string
  label: string
  type: 'input' | 'output'
  position: 'top' | 'right' | 'bottom' | 'left'
  description?: string
}

export interface PropertyDefinition {
  type:
    | 'text'
    | 'number'
    | 'select'
    | 'boolean'
    | 'textarea'
    | 'code-editor'
    | 'rules'
    | 'dataOperations'
    | 'file'
  label?: string
  required?: boolean
  placeholder?: any
  defaultValue?: any
  options?: string[]
  min?: number
  max?: number
  step?: number
  description?: string
  language?: string
  height?: number
  lineNumbers?: boolean
  wordWrap?: boolean
  minimap?: boolean
  availableFields?: string[]
  availableOperators?: string[]
  id?: string
  [key: string]: any
}

export interface PropertyRule {
  when: string
  updates: {
    title?: string
    subtitle?: string
    description?: string
    icon?: string
    variant?: string
    requiredEnvVars?: string[]
    properties?: Record<string, any>
  }
}

export interface PropertyRules {
  triggers: string[]
  rules: PropertyRule[]
}

export interface NodeTemplate {
  id: string
  type: string
  title: string
  subtitle: string
  category: string
  subcategory?: string
  description: string
  icon: string
  variant?: NodeVariant
  shape: NodeShape
  size?: 'small' | 'medium' | 'large'
  ports: Port[]
  properties: Record<string, PropertyDefinition>
  requiredEnvVars?: string[]
  tags: string[]
  version: string
  isActive: boolean
  propertyRules?: PropertyRules
}
