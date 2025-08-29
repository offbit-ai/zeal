/**
 * Redis cache provider for Zeal Authorization
 */

import { CacheProvider } from '../types';

export interface RedisConfig {
  url?: string;
  host?: string;
  port?: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
  ttl?: number;
  enableCluster?: boolean;
  clusterNodes?: Array<{ host: string; port: number }>;
}

/**
 * Redis cache provider implementation
 */
export class RedisCacheProvider implements CacheProvider {
  private client: any;
  private config: RedisConfig;
  private keyPrefix: string;
  private isConnected: boolean = false;
  
  constructor(config: RedisConfig) {
    this.config = config;
    this.keyPrefix = config.keyPrefix || 'zeal:auth:';
  }
  
  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      // Dynamic import to avoid dependency if not used
      const redis = await import('ioredis');
      
      if (this.config.enableCluster && this.config.clusterNodes) {
        // Create cluster client
        this.client = new redis.Cluster(this.config.clusterNodes, {
          redisOptions: {
            password: this.config.password,
            db: this.config.db
          }
        });
      } else if (this.config.url) {
        // Create client from URL
        this.client = new redis.default(this.config.url);
      } else {
        // Create client from config
        this.client = new redis.default({
          host: this.config.host || 'localhost',
          port: this.config.port || 6379,
          password: this.config.password,
          db: this.config.db || 0,
          retryStrategy: (times: number) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          }
        });
      }
      
      // Set up event handlers
      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('Redis cache connected');
      });
      
      this.client.on('error', (err: Error) => {
        console.error('Redis cache error:', err);
        this.isConnected = false;
      });
      
      this.client.on('close', () => {
        this.isConnected = false;
        console.log('Redis cache disconnected');
      });
      
      // Wait for connection
      await this.client.ping();
      this.isConnected = true;
      
    } catch (error) {
      console.error('Failed to connect to Redis:', error);
      throw error;
    }
  }
  
  /**
   * Get value from cache
   */
  async get(key: string): Promise<string | null> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache get');
      return null;
    }
    
    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.client.get(fullKey);
      
      if (value) {
        // Update TTL on access (sliding expiration)
        if (this.config.ttl) {
          await this.client.expire(fullKey, this.config.ttl);
        }
      }
      
      return value;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }
  
  /**
   * Set value in cache
   */
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache set');
      return;
    }
    
    try {
      const fullKey = this.keyPrefix + key;
      const expiry = ttl || this.config.ttl || 300; // Default 5 minutes
      
      // Set with expiration
      await this.client.setex(fullKey, expiry, value);
      
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
  
  /**
   * Delete keys matching pattern
   */
  async invalidate(pattern: string): Promise<void> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache invalidation');
      return;
    }
    
    try {
      const fullPattern = this.keyPrefix + pattern;
      
      // Use SCAN to find keys matching pattern
      const stream = this.client.scanStream({
        match: fullPattern,
        count: 100
      });
      
      const pipeline = this.client.pipeline();
      
      stream.on('data', (keys: string[]) => {
        if (keys.length) {
          keys.forEach(key => {
            pipeline.del(key);
          });
        }
      });
      
      stream.on('end', async () => {
        await pipeline.exec();
      });
      
    } catch (error) {
      console.error('Redis invalidate error:', error);
    }
  }
  
  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache clear');
      return;
    }
    
    try {
      // Clear all keys with our prefix
      await this.invalidate('*');
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }
  
  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }
    
    try {
      const fullKey = this.keyPrefix + key;
      const exists = await this.client.exists(fullKey);
      return exists === 1;
    } catch (error) {
      console.error('Redis exists error:', error);
      return false;
    }
  }
  
  /**
   * Get remaining TTL for a key
   */
  async ttl(key: string): Promise<number> {
    if (!this.isConnected) {
      return -1;
    }
    
    try {
      const fullKey = this.keyPrefix + key;
      return await this.client.ttl(fullKey);
    } catch (error) {
      console.error('Redis ttl error:', error);
      return -1;
    }
  }
  
  /**
   * Set multiple values at once
   */
  async mset(entries: Array<{ key: string; value: string; ttl?: number }>): Promise<void> {
    if (!this.isConnected) {
      console.warn('Redis not connected, skipping cache mset');
      return;
    }
    
    try {
      const pipeline = this.client.pipeline();
      
      for (const entry of entries) {
        const fullKey = this.keyPrefix + entry.key;
        const expiry = entry.ttl || this.config.ttl || 300;
        pipeline.setex(fullKey, expiry, entry.value);
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error('Redis mset error:', error);
    }
  }
  
  /**
   * Get multiple values at once
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.isConnected) {
      console.warn('Redis not connected, returning nulls');
      return keys.map(() => null);
    }
    
    try {
      const fullKeys = keys.map(key => this.keyPrefix + key);
      const values = await this.client.mget(...fullKeys);
      return values;
    } catch (error) {
      console.error('Redis mget error:', error);
      return keys.map(() => null);
    }
  }
  
  /**
   * Increment a counter
   */
  async incr(key: string, amount: number = 1): Promise<number> {
    if (!this.isConnected) {
      return 0;
    }
    
    try {
      const fullKey = this.keyPrefix + key;
      if (amount === 1) {
        return await this.client.incr(fullKey);
      } else {
        return await this.client.incrby(fullKey, amount);
      }
    } catch (error) {
      console.error('Redis incr error:', error);
      return 0;
    }
  }
  
  /**
   * Set value only if it doesn't exist
   */
  async setnx(key: string, value: string, ttl?: number): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }
    
    try {
      const fullKey = this.keyPrefix + key;
      const expiry = ttl || this.config.ttl || 300;
      
      // Use SET with NX and EX options
      const result = await this.client.set(fullKey, value, 'EX', expiry, 'NX');
      return result === 'OK';
    } catch (error) {
      console.error('Redis setnx error:', error);
      return false;
    }
  }
  
  /**
   * Get cache statistics
   */
  async getStats(): Promise<any> {
    if (!this.isConnected) {
      return { connected: false };
    }
    
    try {
      const info = await this.client.info('stats');
      const dbSize = await this.client.dbsize();
      
      return {
        connected: true,
        dbSize,
        info
      };
    } catch (error) {
      console.error('Redis stats error:', error);
      return { connected: false, error: error.message };
    }
  }
  
  /**
   * Destroy connection
   */
  destroy(): void {
    if (this.client) {
      this.client.disconnect();
      this.isConnected = false;
    }
  }
}

/**
 * Redis-based distributed lock for authorization operations
 */
export class RedisLock {
  private client: any;
  private keyPrefix: string;
  
  constructor(client: any, keyPrefix: string = 'zeal:auth:lock:') {
    this.client = client;
    this.keyPrefix = keyPrefix;
  }
  
  /**
   * Acquire a lock
   */
  async acquire(
    resource: string,
    ttl: number = 5000,
    retries: number = 3,
    retryDelay: number = 100
  ): Promise<string | null> {
    const lockKey = this.keyPrefix + resource;
    const lockValue = `${Date.now()}_${Math.random()}`;
    
    for (let i = 0; i < retries; i++) {
      try {
        // Try to set lock with NX (only if not exists)
        const result = await this.client.set(
          lockKey,
          lockValue,
          'PX',
          ttl,
          'NX'
        );
        
        if (result === 'OK') {
          return lockValue;
        }
        
        // Wait before retry
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      } catch (error) {
        console.error('Failed to acquire lock:', error);
      }
    }
    
    return null;
  }
  
  /**
   * Release a lock
   */
  async release(resource: string, lockValue: string): Promise<boolean> {
    const lockKey = this.keyPrefix + resource;
    
    // Use Lua script to ensure atomic release
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    `;
    
    try {
      const result = await this.client.eval(script, 1, lockKey, lockValue);
      return result === 1;
    } catch (error) {
      console.error('Failed to release lock:', error);
      return false;
    }
  }
  
  /**
   * Extend lock TTL
   */
  async extend(resource: string, lockValue: string, ttl: number): Promise<boolean> {
    const lockKey = this.keyPrefix + resource;
    
    // Use Lua script to ensure atomic extension
    const script = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    
    try {
      const result = await this.client.eval(script, 1, lockKey, lockValue, ttl);
      return result === 1;
    } catch (error) {
      console.error('Failed to extend lock:', error);
      return false;
    }
  }
}

/**
 * Redis-based rate limiter for authorization
 */
export class RedisRateLimiter {
  private client: any;
  private keyPrefix: string;
  
  constructor(client: any, keyPrefix: string = 'zeal:auth:rate:') {
    this.client = client;
    this.keyPrefix = keyPrefix;
  }
  
  /**
   * Check if request is allowed under rate limit
   */
  async isAllowed(
    identifier: string,
    limit: number,
    window: number // in seconds
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const key = this.keyPrefix + identifier;
    const now = Date.now();
    const windowStart = now - (window * 1000);
    
    try {
      // Use sliding window with sorted sets
      const pipeline = this.client.pipeline();
      
      // Remove old entries
      pipeline.zremrangebyscore(key, '-inf', windowStart);
      
      // Add current request
      pipeline.zadd(key, now, `${now}_${Math.random()}`);
      
      // Count requests in window
      pipeline.zcard(key);
      
      // Set expiry
      pipeline.expire(key, window);
      
      const results = await pipeline.exec();
      const count = results[2][1];
      
      const allowed = count <= limit;
      const remaining = Math.max(0, limit - count);
      const resetAt = new Date(now + (window * 1000));
      
      if (!allowed) {
        // Remove the request we just added
        await this.client.zremrangebyscore(key, now, now);
      }
      
      return { allowed, remaining, resetAt };
    } catch (error) {
      console.error('Rate limiter error:', error);
      // Fail open - allow request if Redis fails
      return { 
        allowed: true, 
        remaining: limit, 
        resetAt: new Date(now + (window * 1000)) 
      };
    }
  }
  
  /**
   * Reset rate limit for an identifier
   */
  async reset(identifier: string): Promise<void> {
    const key = this.keyPrefix + identifier;
    await this.client.del(key);
  }
}