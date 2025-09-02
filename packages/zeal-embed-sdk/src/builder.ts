/**
 * Fluent builder for embed configuration
 */

import { EmbedConfig, EmbedPermissions, EmbedRateLimits } from './types'

export class EmbedConfigBuilder {
  private config: Partial<EmbedConfig> = {
    display: {},
    events: {},
  }

  constructor(container: HTMLElement | string) {
    this.config.container = container
  }

  /**
   * Set the base URL of the Zeal instance
   */
  withBaseUrl(url: string): this {
    this.config.baseUrl = url
    return this
  }

  /**
   * Set the workflow ID to embed
   */
  withWorkflow(workflowId: string): this {
    this.config.workflowId = workflowId
    return this
  }

  /**
   * Set the auth token for SDK operations
   * If not provided, will attempt to read from sessionStorage
   */
  withAuthToken(token: string): this {
    this.config.authToken = token
    return this
  }

  /**
   * Set the dimensions of the embed
   */
  withDimensions(width: string, height: string): this {
    this.config.width = width
    this.config.height = height
    return this
  }

  /**
   * Set the height of the embed
   */
  withHeight(height: string): this {
    this.config.height = height
    return this
  }

  /**
   * Set the width of the embed
   */
  withWidth(width: string): this {
    this.config.width = width
    return this
  }

  /**
   * Enable or disable the minimap
   */
  withMinimap(enabled: boolean = true): this {
    this.config.display!.minimap = enabled
    return this
  }

  /**
   * Enable or disable zoom controls
   */
  withZoomControls(enabled: boolean = true): this {
    this.config.display!.zoomControls = enabled
    return this
  }

  /**
   * Enable or disable subgraph tabs
   */
  withSubgraphTabs(enabled: boolean = true): this {
    this.config.display!.subgraphTabs = enabled
    return this
  }

  /**
   * Enable or disable node creation
   */
  withNodeCreation(enabled: boolean = true): this {
    this.config.display!.nodeCreation = enabled
    return this
  }

  /**
   * Set the theme
   */
  withTheme(theme: 'light' | 'dark' | 'auto'): this {
    this.config.display!.theme = theme
    return this
  }

  /**
   * Set display options
   */
  withDisplay(options: EmbedConfig['display']): this {
    this.config.display = { ...this.config.display, ...options }
    return this
  }

  /**
   * Set permissions
   */
  withPermissions(permissions: Partial<EmbedPermissions>): this {
    this.config.permissions = {
      canAddNodes: true,
      canEditNodes: true,
      canDeleteNodes: true,
      canAddGroups: true,
      canEditGroups: true,
      canDeleteGroups: true,
      canExecute: true,
      canViewWorkflow: true,
      canExportData: true,
      ...permissions,
    }
    return this
  }

  /**
   * Set read-only mode
   */
  asReadOnly(): this {
    this.config.readonly = true
    this.config.permissions = {
      canAddNodes: false,
      canEditNodes: false,
      canDeleteNodes: false,
      canAddGroups: false,
      canEditGroups: false,
      canDeleteGroups: false,
      canExecute: false,
      canViewWorkflow: true,
      canExportData: false,
    }
    return this
  }

  /**
   * Set view-only mode (can view but not execute)
   */
  asViewOnly(): this {
    this.config.readonly = true
    this.config.permissions = {
      canAddNodes: false,
      canEditNodes: false,
      canDeleteNodes: false,
      canAddGroups: false,
      canEditGroups: false,
      canDeleteGroups: false,
      canExecute: false,
      canViewWorkflow: true,
      canExportData: true,
    }
    return this
  }

  /**
   * Add node libraries
   */
  withNodeLibraries(...libraries: string[]): this {
    this.config.nodeLibraries = libraries
    return this
  }

  /**
   * Hide elements by CSS selector
   */
  hideElements(...selectors: string[]): this {
    this.config.hideElements = selectors
    return this
  }

  /**
   * Set allowed origins for CORS
   */
  withAllowedOrigins(...origins: string[]): this {
    this.config.allowedOrigins = origins
    return this
  }

  /**
   * Set rate limits
   */
  withRateLimits(limits: Partial<EmbedRateLimits>): this {
    this.config.rateLimits = {
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      executionsPerHour: 100,
      executionsPerDay: 1000,
      ...limits,
    }
    return this
  }

  /**
   * Add event handler
   */
  onReady(handler: () => void): this {
    this.config.events!.onReady = handler
    return this
  }

  /**
   * Add error handler
   */
  onError(handler: (error: Error) => void): this {
    this.config.events!.onError = handler
    return this
  }

  /**
   * Add node added handler
   */
  onNodeAdded(handler: (node: any) => void): this {
    this.config.events!.onNodeAdded = handler
    return this
  }

  /**
   * Add node updated handler
   */
  onNodeUpdated(handler: (node: any) => void): this {
    this.config.events!.onNodeUpdated = handler
    return this
  }

  /**
   * Add node deleted handler
   */
  onNodeDeleted(handler: (nodeId: string) => void): this {
    this.config.events!.onNodeDeleted = handler
    return this
  }

  /**
   * Add connection created handler
   */
  onConnectionCreated(handler: (connection: any) => void): this {
    this.config.events!.onConnectionCreated = handler
    return this
  }

  /**
   * Add connection deleted handler
   */
  onConnectionDeleted(handler: (connectionId: string) => void): this {
    this.config.events!.onConnectionDeleted = handler
    return this
  }

  /**
   * Add workflow saved handler
   */
  onWorkflowSaved(handler: (workflow: any) => void): this {
    this.config.events!.onWorkflowSaved = handler
    return this
  }

  /**
   * Add execution started handler
   */
  onExecutionStarted(handler: (sessionId: string) => void): this {
    this.config.events!.onExecutionStarted = handler
    return this
  }

  /**
   * Add execution completed handler
   */
  onExecutionCompleted(handler: (result: any) => void): this {
    this.config.events!.onExecutionCompleted = handler
    return this
  }

  /**
   * Add execution failed handler
   */
  onExecutionFailed(handler: (error: any) => void): this {
    this.config.events!.onExecutionFailed = handler
    return this
  }

  /**
   * Build the configuration
   */
  build(): EmbedConfig {
    if (!this.config.container) {
      throw new Error('Container is required')
    }

    return this.config as EmbedConfig
  }
}