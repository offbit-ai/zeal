import { NodeMetadata } from './workflow'

export interface NodeCategory {
  id: string
  name: string
  description: string
  icon: any
  subcategories: Array<{
    id: string
    name: string
    description: string
  }>
}

export interface NodeRepositoryItem {
  id: string
  name: string
  description: string
  category: string
  subcategory?: string
  keywords: string[]
  tags: string[]
  metadata: NodeMetadata
  isBuiltIn: boolean
  isInstalled: boolean
  version: string
  author: string
  documentation: string
}