/**
 * Cache layer for authorization decisions
 */

import { 
  AuthorizationContext, 
  AuthorizationResult,
  CacheConfig,
  CacheProvider
} from './types';
import * as crypto from 'crypto';

interface CacheEntry {
  result: AuthorizationResult;
  timestamp: number;
  ttl: number;
}

export class AuthCache {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private provider?: CacheProvider;
  private config: CacheConfig;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: CacheConfig) {
    this.config = config;
    
    if (config.provider) {
      this.initializeProvider(config.provider);
    }
    
    // Start cleanup interval for memory cache
    if (config.cleanupInterval) {
      this.cleanupInterval = setInterval(
        () => this.cleanup(),
        config.cleanupInterval * 1000
      );
    }
  }

  /**
   * Get cached authorization result
   */
  async get(context: AuthorizationContext): Promise<AuthorizationResult | null> {
    const key = this.generateKey(context);
    
    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && this.isValid(memoryEntry)) {
      return memoryEntry.result;
    }
    
    // Try external provider if configured
    if (this.provider) {
      try {
        const cached = await this.provider.get(key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          if (this.isValid(entry)) {
            // Update memory cache
            this.memoryCache.set(key, entry);
            return entry.result;
          }
        }
      } catch (error) {
        console.error('Cache provider error:', error);
      }
    }
    
    return null;
  }

  /**
   * Set authorization result in cache
   */
  async set(
    context: AuthorizationContext,
    result: AuthorizationResult,
    ttl?: number
  ): Promise<void> {
    const key = this.generateKey(context);
    const effectiveTTL = ttl || this.config.ttl || 300; // Default 5 minutes
    
    const entry: CacheEntry = {
      result,
      timestamp: Date.now(),
      ttl: effectiveTTL
    };
    
    // Store in memory cache
    this.memoryCache.set(key, entry);
    
    // Store in external provider if configured
    if (this.provider) {
      try {
        await this.provider.set(
          key,
          JSON.stringify(entry),
          effectiveTTL
        );
      } catch (error) {
        console.error('Cache provider error:', error);
      }
    }
  }

  /**
   * Invalidate cache entries
   */
  async invalidate(pattern?: string): Promise<void> {
    if (pattern) {
      // Invalidate matching patterns
      const regex = new RegExp(pattern);
      
      // Clear from memory cache
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
        }
      }
      
      // Clear from provider
      if (this.provider?.invalidate) {
        await this.provider.invalidate(pattern);
      }
    } else {
      // Clear all
      this.memoryCache.clear();
      
      if (this.provider?.clear) {
        await this.provider.clear();
      }
    }
  }

  /**
   * Generate cache key from context
   */
  private generateKey(context: AuthorizationContext): string {
    const components = [
      context.subject.id,
      context.subject.tenantId || '',
      context.resource.type,
      context.resource.id || '',
      context.action,
      JSON.stringify(context.resource.attributes || {}),
      JSON.stringify(context.environment || {})
    ];
    
    const data = components.join('|');
    
    if (this.config.keyHashAlgorithm) {
      return crypto
        .createHash(this.config.keyHashAlgorithm)
        .update(data)
        .digest('hex');
    }
    
    return data;
  }

  /**
   * Check if cache entry is still valid
   */
  private isValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const age = (now - entry.timestamp) / 1000; // Age in seconds
    return age < entry.ttl;
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isValid(entry)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Initialize cache provider
   */
  private initializeProvider(providerConfig: any): void {
    switch (providerConfig.type) {
      case 'redis':
        this.provider = new RedisProvider(providerConfig);
        break;
      case 'memcached':
        this.provider = new MemcachedProvider(providerConfig);
        break;
      case 'dynamodb':
        this.provider = new DynamoDBProvider(providerConfig);
        break;
      default:
        console.warn(`Unknown cache provider: ${providerConfig.type}`);
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): Record<string, any> {
    return {
      memoryEntries: this.memoryCache.size,
      provider: this.provider ? this.config.provider?.type : 'none',
      ttl: this.config.ttl,
      keyHashAlgorithm: this.config.keyHashAlgorithm || 'none'
    };
  }

  /**
   * Warm up cache with common patterns
   */
  async warmup(patterns: AuthorizationContext[]): Promise<void> {
    console.log(`Warming up cache with ${patterns.length} patterns`);
    
    // This would typically pre-evaluate common authorization patterns
    // and cache the results for faster access
    for (const pattern of patterns) {
      // In a real implementation, this would call the policy engine
      // For now, we'll just mark it as warmed up
      const key = this.generateKey(pattern);
      console.log(`Warmed up pattern: ${key}`);
    }
  }

  /**
   * Destroy cache and cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    this.memoryCache.clear();
    
    if (this.provider?.destroy) {
      this.provider.destroy();
    }
  }
}

/**
 * Redis cache provider
 */
class RedisProvider implements CacheProvider {
  private client: any;
  
  constructor(config: any) {
    // In real implementation, would use redis or ioredis
    console.log('Redis provider initialized with config:', config);
  }
  
  async get(key: string): Promise<string | null> {
    // return this.client.get(key);
    return null;
  }
  
  async set(key: string, value: string, ttl: number): Promise<void> {
    // await this.client.setex(key, ttl, value);
  }
  
  async invalidate(pattern: string): Promise<void> {
    // const keys = await this.client.keys(pattern);
    // if (keys.length > 0) {
    //   await this.client.del(...keys);
    // }
  }
  
  async clear(): Promise<void> {
    // await this.client.flushdb();
  }
  
  destroy(): void {
    // this.client.quit();
  }
}

/**
 * Memcached cache provider
 */
class MemcachedProvider implements CacheProvider {
  private client: any;
  
  constructor(config: any) {
    console.log('Memcached provider initialized with config:', config);
  }
  
  async get(key: string): Promise<string | null> {
    return null;
  }
  
  async set(key: string, value: string, ttl: number): Promise<void> {
    // Implementation
  }
  
  async invalidate(pattern: string): Promise<void> {
    // Implementation
  }
  
  async clear(): Promise<void> {
    // Implementation
  }
  
  destroy(): void {
    // Implementation
  }
}

/**
 * DynamoDB cache provider
 */
class DynamoDBProvider implements CacheProvider {
  private client: any;
  private tableName: string;
  
  constructor(config: any) {
    this.tableName = config.tableName || 'zeal-auth-cache';
    console.log('DynamoDB provider initialized with table:', this.tableName);
  }
  
  async get(key: string): Promise<string | null> {
    return null;
  }
  
  async set(key: string, value: string, ttl: number): Promise<void> {
    // Implementation would use AWS SDK
  }
  
  async invalidate(pattern: string): Promise<void> {
    // Implementation
  }
  
  async clear(): Promise<void> {
    // Implementation
  }
  
  destroy(): void {
    // Implementation
  }
}

/**
 * Cache key builder for complex scenarios
 */
export class CacheKeyBuilder {
  private components: string[] = [];
  
  addSubject(subject: any): this {
    this.components.push(`subject:${subject.id}`);
    if (subject.tenantId) {
      this.components.push(`tenant:${subject.tenantId}`);
    }
    return this;
  }
  
  addResource(resource: any): this {
    this.components.push(`resource:${resource.type}`);
    if (resource.id) {
      this.components.push(`id:${resource.id}`);
    }
    return this;
  }
  
  addAction(action: string): this {
    this.components.push(`action:${action}`);
    return this;
  }
  
  addCustom(key: string, value: any): this {
    this.components.push(`${key}:${value}`);
    return this;
  }
  
  build(hash: boolean = false): string {
    const key = this.components.join('|');
    
    if (hash) {
      return crypto
        .createHash('sha256')
        .update(key)
        .digest('hex');
    }
    
    return key;
  }
}