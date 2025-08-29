/**
 * Resolves organizational hierarchy and group memberships
 */

import { 
  Subject, 
  HierarchyPath, 
  HierarchyConfig, 
  HierarchyProvider 
} from './types';

interface HierarchyNode {
  id: string;
  type: 'organization' | 'team' | 'group' | 'role';
  name: string;
  parentId?: string;
  permissions?: string[];
  metadata?: Record<string, any>;
}

export class HierarchyResolver {
  private config: HierarchyConfig;
  private cache: Map<string, HierarchyPath[]> = new Map();
  private hierarchyData: Map<string, HierarchyNode> = new Map();
  private lastRefresh: number = 0;
  private refreshInterval: number = 300000; // 5 minutes

  constructor(config: HierarchyConfig) {
    this.config = config;
    
    if (config.cache) {
      this.refreshInterval = (config.cache.ttl || 300) * 1000;
    }
    
    // Initialize providers
    this.initializeProviders();
  }

  /**
   * Resolve hierarchy for a subject
   */
  async resolve(subject: Subject): Promise<HierarchyPath[]> {
    if (!this.config.enabled) {
      return [];
    }

    // Check cache
    const cacheKey = this.getCacheKey(subject);
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid()) {
      return cached;
    }

    // Refresh data if needed
    await this.refreshDataIfNeeded();

    // Build hierarchy paths
    const paths: HierarchyPath[] = [];

    // Add organization hierarchy
    if (subject.organizationId) {
      const orgPath = await this.buildPath(subject.organizationId, 'organization');
      paths.push(...orgPath);
    }

    // Add team hierarchies
    if (subject.teams) {
      for (const teamId of subject.teams) {
        const teamPath = await this.buildPath(teamId, 'team');
        paths.push(...teamPath);
      }
    }

    // Add group hierarchies
    if (subject.groups) {
      for (const groupId of subject.groups) {
        const groupPath = await this.buildPath(groupId, 'group');
        paths.push(...groupPath);
      }
    }

    // Add role hierarchies
    if (subject.roles) {
      for (const roleId of subject.roles) {
        const rolePath = await this.buildPath(roleId, 'role');
        paths.push(...rolePath);
      }
    }

    // Sort by level (highest first)
    paths.sort((a, b) => b.level - a.level);

    // Cache the result
    this.cache.set(cacheKey, paths);

    return paths;
  }

  /**
   * Build hierarchy path from a node
   */
  private async buildPath(
    nodeId: string, 
    nodeType: string
  ): Promise<HierarchyPath[]> {
    const path: HierarchyPath[] = [];
    let currentId: string | undefined = nodeId;
    let level = 0;

    while (currentId) {
      const node = this.hierarchyData.get(currentId);
      
      if (!node) {
        // Try to fetch from provider
        const fetchedNode = await this.fetchNode(currentId, nodeType);
        if (fetchedNode) {
          this.hierarchyData.set(currentId, fetchedNode);
        } else {
          break;
        }
      }

      if (node) {
        path.push({
          type: node.type,
          id: node.id,
          name: node.name,
          level,
          permissions: node.permissions
        });

        currentId = node.parentId;
        level++;
      } else {
        break;
      }
    }

    return path.reverse(); // Return from root to leaf
  }

  /**
   * Get effective permissions from hierarchy
   */
  async getEffectivePermissions(subject: Subject): Promise<string[]> {
    const hierarchy = await this.resolve(subject);
    const permissions = new Set<string>();

    // Collect permissions from all levels
    for (const level of hierarchy) {
      if (level.permissions) {
        level.permissions.forEach(p => permissions.add(p));
      }
    }

    // Add role-based permissions
    if (subject.roles) {
      for (const role of subject.roles) {
        const roleNode = this.hierarchyData.get(role);
        if (roleNode?.permissions) {
          roleNode.permissions.forEach(p => permissions.add(p));
        }
      }
    }

    return Array.from(permissions);
  }

  /**
   * Check if subject belongs to a specific hierarchy
   */
  async belongsTo(
    subject: Subject, 
    hierarchyId: string, 
    hierarchyType?: string
  ): Promise<boolean> {
    const paths = await this.resolve(subject);
    
    return paths.some(path => {
      if (hierarchyType && path.type !== hierarchyType) {
        return false;
      }
      return path.id === hierarchyId;
    });
  }

  /**
   * Get all ancestors of a node
   */
  async getAncestors(nodeId: string): Promise<string[]> {
    const ancestors: string[] = [];
    let currentId: string | undefined = nodeId;

    while (currentId) {
      const node = this.hierarchyData.get(currentId);
      if (node?.parentId) {
        ancestors.push(node.parentId);
        currentId = node.parentId;
      } else {
        break;
      }
    }

    return ancestors;
  }

  /**
   * Get all descendants of a node
   */
  async getDescendants(nodeId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue = [nodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      for (const [id, node] of this.hierarchyData) {
        if (node.parentId === current) {
          descendants.push(id);
          queue.push(id);
        }
      }
    }

    return descendants;
  }

  /**
   * Initialize hierarchy providers
   */
  private async initializeProviders(): Promise<void> {
    if (!this.config.providers) return;

    for (const provider of this.config.providers) {
      await this.loadFromProvider(provider);
    }
  }

  /**
   * Load hierarchy data from a provider
   */
  private async loadFromProvider(provider: HierarchyProvider): Promise<void> {
    switch (provider.type) {
      case 'database':
        await this.loadFromDatabase(provider.config);
        break;
      case 'api':
        await this.loadFromAPI(provider.config);
        break;
      case 'static':
        this.loadFromStatic(provider.config);
        break;
    }
  }

  /**
   * Load hierarchy from database
   */
  private async loadFromDatabase(config: Record<string, any>): Promise<void> {
    // Implementation would depend on database choice
    // This is a placeholder implementation
    console.log('Loading hierarchy from database:', config.table);
    
    // Example: Load from a hypothetical database
    // const nodes = await db.query(`SELECT * FROM ${config.table}`);
    // for (const node of nodes) {
    //   this.hierarchyData.set(node.id, node);
    // }
  }

  /**
   * Load hierarchy from API
   */
  private async loadFromAPI(config: Record<string, any>): Promise<void> {
    try {
      const response = await fetch(config.endpoint, {
        headers: config.headers || {}
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      
      // Assume API returns array of nodes
      if (Array.isArray(data)) {
        for (const node of data) {
          this.hierarchyData.set(node.id, node);
        }
      } else if (typeof data === 'object' && data && 'nodes' in data) {
        const nodesData = data as { nodes: any[] };
        for (const node of nodesData.nodes) {
          this.hierarchyData.set(node.id, node);
        }
      }
      
      this.lastRefresh = Date.now();
    } catch (error: any) {
      console.error('Failed to load hierarchy from API:', error.message);
    }
  }

  /**
   * Load static hierarchy configuration
   */
  private loadFromStatic(config: Record<string, any>): void {
    if (config.nodes) {
      for (const node of config.nodes) {
        this.hierarchyData.set(node.id, node);
      }
    }
  }

  /**
   * Fetch a specific node from providers
   */
  private async fetchNode(
    nodeId: string, 
    nodeType: string
  ): Promise<HierarchyNode | null> {
    // Try each provider
    for (const provider of this.config.providers || []) {
      if (provider.type === 'api') {
        try {
          const response = await fetch(
            `${provider.config.endpoint}/${nodeType}/${nodeId}`,
            { headers: provider.config.headers || {} }
          );
          
          if (response.ok) {
            const data = await response.json();
            return data as HierarchyNode;
          }
        } catch (error) {
          console.error(`Failed to fetch node ${nodeId}:`, error);
        }
      }
    }
    
    return null;
  }

  /**
   * Refresh data if needed
   */
  private async refreshDataIfNeeded(): Promise<void> {
    const now = Date.now();
    
    if (now - this.lastRefresh > this.refreshInterval) {
      await this.initializeProviders();
      this.cache.clear();
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    const now = Date.now();
    return now - this.lastRefresh < this.refreshInterval;
  }

  /**
   * Generate cache key for a subject
   */
  private getCacheKey(subject: Subject): string {
    const parts = [
      subject.id,
      subject.organizationId || '',
      (subject.teams || []).join(','),
      (subject.groups || []).join(','),
      (subject.roles || []).join(',')
    ];
    
    return parts.join('|');
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.lastRefresh = 0;
  }

  /**
   * Add or update a hierarchy node
   */
  addNode(node: HierarchyNode): void {
    this.hierarchyData.set(node.id, node);
    this.cache.clear(); // Invalidate cache
  }

  /**
   * Remove a hierarchy node
   */
  removeNode(nodeId: string): void {
    this.hierarchyData.delete(nodeId);
    this.cache.clear(); // Invalidate cache
  }

  /**
   * Get hierarchy statistics
   */
  getStatistics(): Record<string, any> {
    const stats = {
      totalNodes: this.hierarchyData.size,
      cacheSize: this.cache.size,
      lastRefresh: new Date(this.lastRefresh),
      nodesByType: {} as Record<string, number>
    };

    for (const node of this.hierarchyData.values()) {
      stats.nodesByType[node.type] = (stats.nodesByType[node.type] || 0) + 1;
    }

    return stats;
  }
}