import { useState, useEffect, useCallback } from 'react'
import { useNodeRepositoryStore } from '@/store/nodeRepositoryStore'
import { NodeRepositoryItem } from './useNodeRepository'
import { NodeTemplate } from '@/data/nodeTemplates'
// Simple debounce function to avoid lodash dependency
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

// Convert API template response to NodeRepositoryItem format
function convertToNodeRepositoryItem(template: any): NodeRepositoryItem {
  // Map the API response to the expected format
  const nodeTemplate: NodeTemplate = {
    id: template.id,
    type: template.id, // Use id as type
    category: template.category,
    subcategory: template.subcategory,
    title: template.title,
    subtitle: template.subtitle || '',
    description: template.description,
    icon: template.icon || 'box',
    variant: template.variant,
    tags: template.tags || [],
    shape: template.shape || 'rectangle',
    isActive: template.isActive !== false,
    properties: template.properties || {},
    ports: template.ports || [],
    requiredEnvVars: template.requiredEnvVars || [],
    propertyRules: template.propertyRules,
    version: template.version || '1.0.0',
  }

  return {
    id: template.id,
    title: template.title,
    subtitle: template.subtitle || '',
    description: template.description,
    icon: template.icon || 'box',
    variant: template.variant,
    category: template.category,
    subcategory: template.subcategory,
    tags: template.tags || [],
    template: nodeTemplate,
    isInstalled: template.isActive !== false,
  }
}

export function useTemplateSearch() {
  const {
    nodeTemplates,
    searchResults,
    autocompleteResults,
    isLoading,
    isSearching,
    error,
    fetchNodeTemplates,
    searchTemplates,
    fetchAutocomplete,
    clearSearchResults,
  } = useNodeRepositoryStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Load all templates on mount by doing an empty search
  useEffect(() => {
    // Do an initial search with no query to get all templates
    searchTemplates('', { limit: 200 })
    setIsInitialLoad(false)
  }, [])

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce((query: string, category?: string, subcategory?: string) => {
      // Always search when we have a query OR category/subcategory filters
      if (query.trim() || category || subcategory) {
        searchTemplates(query, { category, subcategory, limit: 100 })
      } else {
        // Only clear if no query AND no filters
        clearSearchResults()
      }
    }, 100), // Reduced debounce for faster category switching
    []
  )

  // Debounced autocomplete function
  const debouncedAutocomplete = useCallback(
    debounce((query: string) => {
      fetchAutocomplete(query)
    }, 150),
    []
  )

  // Handle search query change
  useEffect(() => {
    debouncedSearch(searchQuery, selectedCategory || undefined, selectedSubcategory || undefined)
    debouncedAutocomplete(searchQuery)
  }, [searchQuery, selectedCategory, selectedSubcategory])

  // Get filtered results
  const getFilteredResults = (): NodeRepositoryItem[] => {
    // Always use search results from API
    const results = searchResults

    // Convert to NodeRepositoryItem format
    return results.map(convertToNodeRepositoryItem)
  }

  return {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSubcategory,
    setSelectedSubcategory,
    filteredResults: getFilteredResults(),
    autocompleteResults,
    isLoading: isLoading || isSearching,
    error,
    clearSearch: () => {
      setSearchQuery('')
      clearSearchResults()
    },
  }
}
