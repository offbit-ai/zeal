/**
 * Node Template Type Definitions
 */

export interface Port {
  id: string
  label: string
  type: 'input' | 'output'
  position: 'top' | 'right' | 'bottom' | 'left'
}

export interface PropertyDefinition {
  type: 'text' | 'number' | 'select' | 'boolean' | 'textarea' | 'code-editor' | 'rules' | 'dataOperations'
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
  [key:string]: any
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
  variant?: string
  shape?: 'rectangle' | 'circle' | 'diamond' | 'hexagon' | 'octagon' | 'cylinder'
  size?: 'small' | 'medium' | 'large'
  ports: Port[]
  properties: Record<string, PropertyDefinition>
  requiredEnvVars?: string[]
  tags: string[]
  version: string
  isActive: boolean
  propertyRules?: PropertyRules
}
