import { create } from 'zustand'
import { NodeTemplateResponse } from '@/types/api'

interface Category {
  name: string
  displayName: string
  description: string
  icon: string
  totalNodes: number
  isActive: boolean
  subcategories?: {
    name: string
    displayName: string
    description: string
    nodeCount: number
  }[]
}

interface NodeRepositoryStore {
  // State
  categories: Category[]
  nodeTemplates: NodeTemplateResponse[]
  searchResults: NodeTemplateResponse[]
  autocompleteResults: string[]
  isLoading: boolean
  isSearching: boolean
  error: string | null
  lastFetched: Date | null

  // Actions
  fetchCategories: () => Promise<void>
  fetchNodeTemplates: (options?: { category?: string; limit?: number }) => Promise<void>
  searchTemplates: (query: string, options?: { category?: string; subcategory?: string; tags?: string[]; limit?: number }) => Promise<void>
  fetchAutocomplete: (query: string) => Promise<void>
  fetchAll: () => Promise<void>
  getCategoryByName: (name: string) => Category | undefined
  getCategoryDisplayName: (name: string) => string
  getNodeTemplateById: (id: string) => NodeTemplateResponse | undefined
  getNodeTemplatesByCategory: (category: string) => NodeTemplateResponse[]
  setError: (error: string | null) => void
  clearCache: () => void
  clearSearchResults: () => void
}

export const useNodeRepositoryStore = create<NodeRepositoryStore>((set, get) => ({
  // Initial state
  categories: [],
  nodeTemplates: [],
  searchResults: [],
  autocompleteResults: [],
  isLoading: false,
  isSearching: false,
  error: null,
  lastFetched: null,

  // Fetch categories from API
  fetchCategories: async () => {
    const { lastFetched } = get()

    // Cache for 5 minutes
    if (lastFetched && Date.now() - lastFetched.getTime() < 5 * 60 * 1000) {
      return
    }

    set({ isLoading: true, error: null })

    try {
      const response = await fetch('/api/nodes/categories')
      if (!response.ok) {
        throw new Error('Failed to fetch categories')
      }

      const data = await response.json()
      set({
        categories: data.data || [],
        lastFetched: new Date(),
      })
    } catch (error) {
      console.error('[NodeRepository] Categories error:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch categories',
      })
    } finally {
      set({ isLoading: false })
    }
  },

  // Fetch node templates from API
  fetchNodeTemplates: async (options = {}) => {
    set({ isLoading: true, error: null })

    try {
      const params = new URLSearchParams()
      if (options.category) params.append('category', options.category)
      params.append('limit', String(options.limit || 500))

      const url = `/api/nodes?${params}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to fetch node templates')
      }

      const data = await response.json()
      set({
        nodeTemplates: data.data || [],
        lastFetched: new Date(),
      })
    } catch (error) {
      console.error('[NodeRepository] Templates error:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch node templates',
      })
    } finally {
      set({ isLoading: false })
    }
  },

  // Search templates
  searchTemplates: async (query: string, options = {}) => {
    set({ isSearching: true, error: null })

    try {
      const params = new URLSearchParams()
      params.append('q', query)
      if (options.category) params.append('category', options.category)
      if (options.subcategory) params.append('subcategory', options.subcategory)
      if (options.tags?.length) params.append('tags', options.tags.join(','))
      params.append('limit', String(options.limit || 50))

      const url = `/api/templates?${params}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error('Failed to search templates')
      }

      const data = await response.json()
      set({
        searchResults: data.data || [],
      })
    } catch (error) {
      console.error('[NodeRepository] Search error:', error)
      set({
        error: error instanceof Error ? error.message : 'Failed to search templates',
      })
    } finally {
      set({ isSearching: false })
    }
  },

  // Fetch autocomplete suggestions
  fetchAutocomplete: async (query: string) => {
    // Autocomplete is not available in /api/nodes endpoint
    // Just clear results for now
    set({ autocompleteResults: [] })
    return
  },

  // Fetch both categories and node templates
  fetchAll: async () => {
    const { fetchCategories, fetchNodeTemplates } = get()
    await Promise.all([fetchCategories(), fetchNodeTemplates()])
  },

  // Get category by name
  getCategoryByName: (name: string) => {
    const { categories } = get()
    return categories.find(cat => cat.name === name)
  },

  // Get category display name
  getCategoryDisplayName: (name: string) => {
    const category = get().getCategoryByName(name)
    return category?.displayName || name
  },

  // Get node template by ID
  getNodeTemplateById: (id: string) => {
    const { nodeTemplates } = get()
    return nodeTemplates.find(node => node.id === id)
  },

  // Get node templates by category
  getNodeTemplatesByCategory: (category: string) => {
    const { nodeTemplates } = get()
    return nodeTemplates.filter(node => node.category === category)
  },

  // Set error
  setError: (error: string | null) => set({ error }),

  // Clear cache
  clearCache: () =>
    set({
      categories: [],
      nodeTemplates: [],
      searchResults: [],
      autocompleteResults: [],
      lastFetched: null,
      error: null,
    }),

  // Clear search results
  clearSearchResults: () =>
    set({
      searchResults: [],
      autocompleteResults: [],
    }),
}))
