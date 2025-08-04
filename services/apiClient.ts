import { ApiResponse, ApiError } from '@/types/api'

class ApiClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      // No authentication headers for now
    }
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const contentType = response.headers.get('content-type')
    const isJson = contentType?.includes('application/json')

    let data: ApiResponse<T>

    if (isJson) {
      data = await response.json()
    } else {
      // Handle non-JSON responses
      const text = await response.text()
      throw new Error(`Unexpected response format: ${text}`)
    }

    if (!response.ok) {
      const error = data.error || {
        code: 'UNKNOWN_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      }
      throw new ApiError(error.code, error.message, response.status, error.details)
    }

    if (!data.success) {
      const error = data.error || {
        code: 'API_ERROR',
        message: 'API request failed',
      }
      throw new ApiError(error.code, error.message, response.status, error.details)
    }

    return data.data as T
  }

  async get<T>(
    endpoint: string,
    params?: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`, window.location.origin)

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      })
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.defaultHeaders,
    })

    return this.handleResponse<T>(response)
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.defaultHeaders,
      body: data ? JSON.stringify(data) : undefined,
    })

    return this.handleResponse<T>(response)
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const body = data ? JSON.stringify(data) : undefined

    // Debug logging
    if (!body) {
      console.warn('[ApiClient] PUT request with no body to:', endpoint)
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'PUT',
      headers: this.defaultHeaders,
      body: body,
    })

    return this.handleResponse<T>(response)
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'DELETE',
      headers: this.defaultHeaders,
    })

    return this.handleResponse<T>(response)
  }

  // Helper method for paginated requests
  async getPaginated<T>(
    endpoint: string,
    params?: {
      page?: number
      limit?: number
      sortBy?: string
      sortOrder?: 'asc' | 'desc'
      [key: string]: any
    }
  ): Promise<{
    data: T[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }> {
    const response = await fetch(
      `${this.baseUrl}${endpoint}?${new URLSearchParams({
        page: String(params?.page || 1),
        limit: String(params?.limit || 20),
        sort_by: params?.sortBy || 'createdAt',
        sort_order: params?.sortOrder || 'desc',
        ...Object.fromEntries(
          Object.entries(params || {})
            .filter(
              ([key, value]) =>
                !['page', 'limit', 'sortBy', 'sortOrder'].includes(key) && value !== undefined
            )
            .map(([key, value]) => [key, String(value)])
        ),
      })}`,
      {
        method: 'GET',
        headers: this.defaultHeaders,
      }
    )

    // Handle paginated response differently since it needs the full response structure
    const data = await response.json()

    if (!response.ok) {
      const error = data.error || {
        code: 'UNKNOWN_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      }
      throw new ApiError(error.code, error.message, response.status, error.details)
    }

    if (!data.success) {
      const error = data.error || {
        code: 'API_ERROR',
        message: 'API request failed',
      }
      throw new ApiError(error.code, error.message, response.status, error.details)
    }

    return {
      data: data.data,
      pagination: data.meta.pagination,
    }
  }
}

// Export singleton instance
export const apiClient = new ApiClient()
export default apiClient
