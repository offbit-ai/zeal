/**
 * Audit logger for authorization decisions
 */

import { 
  AuthorizationContext,
  AuthorizationResult,
  AuditConfig,
  Subject,
  Resource
} from './types';
import * as fs from 'fs';
import * as path from 'path';

interface AuditEntry {
  id: string;
  type?: string;
  timestamp: Date;
  subject: Subject;
  resource: Resource;
  action: string;
  result: AuthorizationResult;
  duration?: number;
  fromCache?: boolean;
  environment?: Record<string, any>;
  metadata?: Record<string, any>;
}

interface AuditProvider {
  log(entry: AuditEntry): Promise<void>;
  query(criteria: any): Promise<AuditEntry[]>;
  close(): void;
}

export class AuditLogger {
  private config: AuditConfig;
  private providers: AuditProvider[] = [];
  private buffer: AuditEntry[] = [];
  private flushInterval?: NodeJS.Timeout;

  constructor(config: AuditConfig) {
    this.config = config;
    
    // Initialize providers
    this.initializeProviders();
    
    // Setup buffering if configured
    if (config.buffer?.enabled) {
      this.flushInterval = setInterval(
        () => this.flush(),
        (config.buffer.flushInterval || 10) * 1000
      );
    }
  }

  /**
   * Log an authorization decision
   */
  async log(entry: Omit<AuditEntry, 'id'> & {level: string}): Promise<void> {
    if (!this.config.enabled) return;
    
    const auditEntry: AuditEntry = {
      ...entry,
      id: this.generateId(),
      timestamp: entry.timestamp || new Date()
    };
    
    // Filter sensitive data if configured
    if (this.config.sanitize) {
      this.sanitizeEntry(auditEntry);
    }
    
    // Apply sampling if configured
    if (this.config.sampling && !this.shouldSample()) {
      return;
    }
    
    // Buffer or log immediately
    if (this.config.buffer?.enabled) {
      this.buffer.push(auditEntry);
      
      if (this.buffer.length >= (this.config.buffer.maxSize || 100)) {
        await this.flush();
      }
    } else {
      await this.writeEntry(auditEntry);
    }
  }

  /**
   * Query audit logs
   */
  async query(criteria: {
    subjectId?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    startTime?: Date;
    endTime?: Date;
    result?: 'allowed' | 'denied';
    limit?: number;
  }): Promise<AuditEntry[]> {
    const results: AuditEntry[] = [];
    
    for (const provider of this.providers) {
      if (provider.query) {
        const entries = await provider.query(criteria);
        results.push(...entries);
      }
    }
    
    // Sort by timestamp (newest first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Apply limit
    if (criteria.limit) {
      return results.slice(0, criteria.limit);
    }
    
    return results;
  }

  /**
   * Generate audit report
   */
  async generateReport(
    startTime: Date,
    endTime: Date,
    groupBy?: 'subject' | 'resource' | 'action'
  ): Promise<any> {
    const entries = await this.query({ startTime, endTime });
    
    const report = {
      period: {
        start: startTime,
        end: endTime
      },
      totalRequests: entries.length,
      allowed: entries.filter(e => e.result.allowed).length,
      denied: entries.filter(e => !e.result.allowed).length,
      avgDuration: this.calculateAvgDuration(entries),
      cacheHitRate: this.calculateCacheHitRate(entries),
      topDeniedReasons: this.getTopDeniedReasons(entries),
      breakdown: {} as any
    };
    
    if (groupBy) {
      report.breakdown = this.groupEntries(entries, groupBy);
    }
    
    return report;
  }

  /**
   * Write entry to providers
   */
  private async writeEntry(entry: AuditEntry): Promise<void> {
    const promises = this.providers.map(provider => 
      provider.log(entry).catch(error => {
        console.error('Audit provider error:', error);
      })
    );
    
    await Promise.all(promises);
  }

  /**
   * Flush buffered entries
   */
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const entries = [...this.buffer];
    this.buffer = [];
    
    for (const entry of entries) {
      await this.writeEntry(entry);
    }
  }

  /**
   * Initialize audit providers
   */
  private initializeProviders(): void {
    for (const providerConfig of this.config.providers || []) {
      switch (providerConfig.type) {
        case 'file':
          this.providers.push(new FileAuditProvider(providerConfig));
          break;
        case 'database':
          this.providers.push(new DatabaseAuditProvider(providerConfig));
          break;
        case 'syslog':
          this.providers.push(new SyslogAuditProvider(providerConfig));
          break;
        case 'elasticsearch':
          this.providers.push(new ElasticsearchAuditProvider(providerConfig));
          break;
        default:
          console.warn(`Unknown audit provider: ${providerConfig.type}`);
      }
    }
  }

  /**
   * Sanitize sensitive data from entry
   */
  private sanitizeEntry(entry: AuditEntry): void {
    // Remove sensitive fields
    const sensitiveFields = this.config.sanitize?.fields || [
      'password',
      'secret',
      'token',
      'apiKey'
    ];
    
    const sanitize = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const sanitized = Array.isArray(obj) ? [...obj] : { ...obj };
      
      for (const key in sanitized) {
        if (sensitiveFields.some(field => 
          key.toLowerCase().includes(field.toLowerCase())
        )) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof sanitized[key] === 'object') {
          sanitized[key] = sanitize(sanitized[key]);
        }
      }
      
      return sanitized;
    };
    
    if (entry.resource.attributes) {
      entry.resource.attributes = sanitize(entry.resource.attributes);
    }
    
    if (entry.environment) {
      entry.environment = sanitize(entry.environment);
    }
  }

  /**
   * Determine if entry should be sampled
   */
  private shouldSample(): boolean {
    const rate = this.config.sampling?.rate || 1.0;
    return Math.random() < rate;
  }

  /**
   * Generate unique ID for audit entry
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate average duration
   */
  private calculateAvgDuration(entries: AuditEntry[]): number {
    const withDuration = entries.filter(e => e.duration);
    if (withDuration.length === 0) return 0;
    
    const total = withDuration.reduce((sum, e) => sum + (e.duration || 0), 0);
    return total / withDuration.length;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(entries: AuditEntry[]): number {
    if (entries.length === 0) return 0;
    
    const cacheHits = entries.filter(e => e.fromCache).length;
    return (cacheHits / entries.length) * 100;
  }

  /**
   * Get top denied reasons
   */
  private getTopDeniedReasons(entries: AuditEntry[]): Array<{
    reason: string;
    count: number;
  }> {
    const denied = entries.filter(e => !e.result.allowed);
    const reasons = new Map<string, number>();
    
    for (const entry of denied) {
      const reason = entry.result.reason || 'Unknown';
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }
    
    return Array.from(reasons.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  /**
   * Group entries by field
   */
  private groupEntries(
    entries: AuditEntry[],
    groupBy: string
  ): Record<string, any> {
    const groups = new Map<string, AuditEntry[]>();
    
    for (const entry of entries) {
      let key: string;
      
      switch (groupBy) {
        case 'subject':
          key = entry.subject.id;
          break;
        case 'resource':
          key = `${entry.resource.type}:${entry.resource.id || 'all'}`;
          break;
        case 'action':
          key = entry.action;
          break;
        default:
          key = 'unknown';
      }
      
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(entry);
    }
    
    const result: Record<string, any> = {};
    
    for (const [key, groupEntries] of groups) {
      result[key] = {
        total: groupEntries.length,
        allowed: groupEntries.filter(e => e.result.allowed).length,
        denied: groupEntries.filter(e => !e.result.allowed).length,
        avgDuration: this.calculateAvgDuration(groupEntries)
      };
    }
    
    return result;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush remaining entries
    this.flush().catch(console.error);
    
    // Close providers
    for (const provider of this.providers) {
      if (provider.close) {
        provider.close();
      }
    }
  }
}

/**
 * File-based audit provider
 */
class FileAuditProvider implements AuditProvider {
  private logPath: string;
  private stream?: fs.WriteStream;
  
  constructor(config: any) {
    this.logPath = config.path || './audit.log';
    
    // Ensure directory exists
    const dir = path.dirname(this.logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Create write stream
    this.stream = fs.createWriteStream(this.logPath, {
      flags: 'a',
      encoding: 'utf8'
    });
  }
  
  async log(entry: AuditEntry): Promise<void> {
    const line = JSON.stringify(entry) + '\n';
    
    return new Promise((resolve, reject) => {
      this.stream!.write(line, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  
  async query(criteria: any): Promise<AuditEntry[]> {
    // Simple file-based query (not efficient for large files)
    const content = fs.readFileSync(this.logPath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    
    const entries: AuditEntry[] = lines
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    
    // Apply filters
    return entries.filter(entry => {
      if (criteria.subjectId && entry.subject.id !== criteria.subjectId) {
        return false;
      }
      if (criteria.resourceType && entry.resource.type !== criteria.resourceType) {
        return false;
      }
      if (criteria.action && entry.action !== criteria.action) {
        return false;
      }
      if (criteria.startTime && new Date(entry.timestamp) < criteria.startTime) {
        return false;
      }
      if (criteria.endTime && new Date(entry.timestamp) > criteria.endTime) {
        return false;
      }
      return true;
    });
  }
  
  close(): void {
    if (this.stream) {
      this.stream.end();
    }
  }
}

/**
 * Database audit provider
 */
class DatabaseAuditProvider implements AuditProvider {
  constructor(config: any) {
    console.log('Database audit provider initialized:', config);
  }
  
  async log(entry: AuditEntry): Promise<void> {
    // Implementation would use Prisma/TypeORM
  }
  
  async query(criteria: any): Promise<AuditEntry[]> {
    return [];
  }
  
  close(): void {
    // Close database connection
  }
}

/**
 * Syslog audit provider
 */
class SyslogAuditProvider implements AuditProvider {
  constructor(config: any) {
    console.log('Syslog audit provider initialized:', config);
  }
  
  async log(entry: AuditEntry): Promise<void> {
    // Implementation would use syslog protocol
  }
  
  async query(criteria: any): Promise<AuditEntry[]> {
    // Syslog typically doesn't support queries
    return [];
  }
  
  close(): void {
    // Close syslog connection
  }
}

/**
 * Elasticsearch audit provider
 */
class ElasticsearchAuditProvider implements AuditProvider {
  private indexName: string;
  
  constructor(config: any) {
    this.indexName = config.index || 'zeal-audit';
    console.log('Elasticsearch audit provider initialized:', config);
  }
  
  async log(entry: AuditEntry): Promise<void> {
    // Implementation would use @elastic/elasticsearch
  }
  
  async query(criteria: any): Promise<AuditEntry[]> {
    // Implementation would query Elasticsearch
    return [];
  }
  
  close(): void {
    // Close Elasticsearch client
  }
}