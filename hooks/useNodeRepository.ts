import { useMemo } from 'react'
import { allNodeTemplates, NodeTemplate } from '@/data/nodeTemplates'
// import { NodeRepositoryItem } from '@/types/nodeRepository'

export interface NodeRepositoryItem {
  id: string
  title: string
  subtitle: string
  description: string
  icon: string
  variant?: string
  category: string
  subcategory?: string
  tags: string[]
  template: NodeTemplate
  isInstalled: boolean
}

export function useNodeRepository() {
  const repository = useMemo<NodeRepositoryItem[]>(() => {
    return allNodeTemplates.map(template => ({
      id: template.id,
      title: template.title,
      subtitle: template.subtitle,
      description: template.description,
      icon: template.icon,
      variant: template.variant,
      category: template.category,
      subcategory: template.subcategory,
      tags: template.tags,
      template: template,
      isInstalled: template.isActive,
    }))
  }, [])

  return repository
}
