/**
 * Policy Engine for evaluating authorization policies
 */

import {
  Policy,
  PolicyCondition,
  PolicyRule,
  PolicyOperator,
  AuthorizationContext,
  AuthorizationResult,
  PolicyConfig,
  PolicySource,
  PolicyConstraints
} from './types';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

export class PolicyEngine {
  private policies: Map<string, Policy> = new Map();
  private rolePermissions: Map<string, string[]> = new Map();
  private evaluationStrategy: 'first-match' | 'all-match' | 'priority';
  private defaultEffect: 'allow' | 'deny';

  constructor(config: PolicyConfig) {
    this.evaluationStrategy = config.evaluationStrategy || 'priority';
    this.defaultEffect = config.defaultEffect || 'deny';
    this.loadPolicies(config.sources);
  }

  /**
   * Load policies from configured sources
   */
  async loadPolicies(sources: PolicySource[]): Promise<void> {
    for (const source of sources) {
      switch (source.type) {
        case 'file':
          await this.loadFromFile(source.location, source.format);
          break;
        case 'database':
          await this.loadFromDatabase(source.location);
          break;
        case 'api':
          await this.loadFromAPI(source.location);
          break;
      }
    }
  }

  /**
   * Evaluate policies against context
   */
  async evaluate(context: AuthorizationContext): Promise<AuthorizationResult> {
    const matchedPolicies: string[] = [];
    let finalResult: AuthorizationResult = {
      allowed: this.defaultEffect === 'allow',
      reason: 'No matching policies found'
    };

    // Get sorted policies based on strategy
    const sortedPolicies = this.getSortedPolicies();

    for (const policy of sortedPolicies) {
      if (!policy.enabled) continue;

      const matches = await this.evaluatePolicy(policy, context);
      
      if (matches) {
        matchedPolicies.push(policy.id);

        const result: AuthorizationResult = {
          allowed: policy.effect === 'allow',
          reason: `Matched policy: ${policy.name}`,
          matchedPolicies: [policy.id],
          constraints: policy.constraints,
          ttl: this.calculateTTL(policy)
        };

        // Handle different evaluation strategies
        switch (this.evaluationStrategy) {
          case 'first-match':
            return result;
          
          case 'all-match':
            if (policy.effect === 'deny') {
              return result; // Deny takes precedence
            }
            finalResult = this.mergeResults(finalResult, result);
            break;
          
          case 'priority':
            // In priority mode, first match wins
            return result;
        }
      }
    }

    if (matchedPolicies.length > 0) {
      finalResult.matchedPolicies = matchedPolicies;
    }

    return finalResult;
  }

  /**
   * Evaluate a single policy
   */
  private async evaluatePolicy(
    policy: Policy,
    context: AuthorizationContext
  ): Promise<boolean> {
    for (const condition of policy.conditions) {
      if (await this.evaluateCondition(condition, context)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Evaluate a policy condition
   */
  private async evaluateCondition(
    condition: PolicyCondition,
    context: AuthorizationContext
  ): Promise<boolean> {
    const results = await Promise.all(
      condition.rules.map(rule => this.evaluateRule(rule, context))
    );

    switch (condition.type) {
      case 'all':
        return results.every(r => r);
      case 'any':
        return results.some(r => r);
      case 'none':
        return !results.some(r => r);
      default:
        return false;
    }
  }

  /**
   * Evaluate a single rule
   */
  private async evaluateRule(
    rule: PolicyRule,
    context: AuthorizationContext
  ): Promise<boolean> {
    const actualValue = this.extractValue(rule.attribute, context);
    const expectedValue = this.interpolateValue(rule.value, context);

    return this.compareValues(
      actualValue,
      expectedValue,
      rule.operator,
      rule.caseSensitive
    );
  }

  /**
   * Extract value from context using path notation
   */
  private extractValue(path: string, context: AuthorizationContext): any {
    const parts = path.split('.');
    let current: any = context;

    for (const part of parts) {
      // Handle array notation like "hierarchy[?type=='team']"
      if (part.includes('[')) {
        const [arrayPath, filter] = part.split('[');
        current = current?.[arrayPath];
        
        if (Array.isArray(current) && filter) {
          // Simple filter implementation
          const filterExpr = filter.replace(']', '');
          if (filterExpr.startsWith('?')) {
            current = this.filterArray(current, filterExpr.substring(1));
          }
        }
      } else {
        current = current?.[part];
      }
      
      if (current === undefined) break;
    }

    return current;
  }

  /**
   * Filter array based on expression
   */
  private filterArray(arr: any[], expr: string): any[] {
    // Simple implementation - can be enhanced
    const [field, op, value] = expr.split(/([=!<>]+)/);
    
    return arr.filter(item => {
      const itemValue = item[field.trim()];
      const compareValue = value.replace(/['"]/g, '').trim();
      
      switch (op) {
        case '==':
          return itemValue === compareValue;
        case '!=':
          return itemValue !== compareValue;
        default:
          return false;
      }
    });
  }

  /**
   * Interpolate values with context variables
   */
  private interpolateValue(value: any, context: AuthorizationContext): any {
    if (typeof value !== 'string') return value;
    
    // Replace {{variable}} with actual values
    return value.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const extracted = this.extractValue(path.trim(), context);
      return extracted !== undefined ? extracted : match;
    });
  }

  /**
   * Compare values based on operator
   */
  private compareValues(
    actual: any,
    expected: any,
    operator: PolicyOperator,
    caseSensitive: boolean = true
  ): boolean {
    // Normalize strings if case-insensitive
    if (!caseSensitive && typeof actual === 'string' && typeof expected === 'string') {
      actual = actual.toLowerCase();
      expected = expected.toLowerCase();
    }

    switch (operator) {
      case 'equals':
        return actual === expected;
      
      case 'notEquals':
        return actual !== expected;
      
      case 'contains':
        if (Array.isArray(actual)) {
          return actual.includes(expected);
        }
        if (typeof actual === 'string' && typeof expected === 'string') {
          return actual.includes(expected);
        }
        return false;
      
      case 'notContains':
        if (Array.isArray(actual)) {
          return !actual.includes(expected);
        }
        if (typeof actual === 'string' && typeof expected === 'string') {
          return !actual.includes(expected);
        }
        return true;
      
      case 'startsWith':
        return typeof actual === 'string' && 
               typeof expected === 'string' && 
               actual.startsWith(expected);
      
      case 'endsWith':
        return typeof actual === 'string' && 
               typeof expected === 'string' && 
               actual.endsWith(expected);
      
      case 'in':
        return Array.isArray(expected) && expected.includes(actual);
      
      case 'notIn':
        return Array.isArray(expected) && !expected.includes(actual);
      
      case 'greaterThan':
        return actual > expected;
      
      case 'lessThan':
        return actual < expected;
      
      case 'greaterThanOrEqual':
        return actual >= expected;
      
      case 'lessThanOrEqual':
        return actual <= expected;
      
      case 'matches':
        if (typeof actual === 'string' && typeof expected === 'string') {
          const regex = new RegExp(expected, caseSensitive ? '' : 'i');
          return regex.test(actual);
        }
        return false;
      
      case 'exists':
        return actual !== undefined && actual !== null;
      
      case 'notExists':
        return actual === undefined || actual === null;
      
      default:
        return false;
    }
  }

  /**
   * Get sorted policies based on strategy
   */
  private getSortedPolicies(): Policy[] {
    const policies = Array.from(this.policies.values());
    
    if (this.evaluationStrategy === 'priority') {
      return policies.sort((a, b) => b.priority - a.priority);
    }
    
    return policies;
  }

  /**
   * Merge multiple authorization results
   */
  private mergeResults(
    result1: AuthorizationResult,
    result2: AuthorizationResult
  ): AuthorizationResult {
    return {
      allowed: result1.allowed && result2.allowed,
      reason: result2.reason || result1.reason,
      matchedPolicies: [
        ...(result1.matchedPolicies || []),
        ...(result2.matchedPolicies || [])
      ],
      constraints: this.mergeConstraints(result1.constraints, result2.constraints),
      ttl: Math.min(result1.ttl || Infinity, result2.ttl || Infinity)
    };
  }

  /**
   * Merge policy constraints
   */
  private mergeConstraints(
    c1?: PolicyConstraints,
    c2?: PolicyConstraints
  ): PolicyConstraints | undefined {
    if (!c1) return c2;
    if (!c2) return c1;

    return {
      fields: this.intersectArrays(c1.fields, c2.fields),
      filters: { ...c1.filters, ...c2.filters },
      maxResults: Math.min(c1.maxResults || Infinity, c2.maxResults || Infinity),
      timeWindow: this.mergeTimeWindows(c1.timeWindow, c2.timeWindow),
      rateLimit: this.mergeRateLimits(c1.rateLimit, c2.rateLimit)
    };
  }

  /**
   * Helper to intersect arrays
   */
  private intersectArrays<T>(a1?: T[], a2?: T[]): T[] | undefined {
    if (!a1) return a2;
    if (!a2) return a1;
    return a1.filter(x => a2.includes(x));
  }

  /**
   * Merge time windows
   */
  private mergeTimeWindows(t1?: any, t2?: any): any {
    if (!t1) return t2;
    if (!t2) return t1;
    
    return {
      start: new Date(Math.max(
        t1.start?.getTime() || 0,
        t2.start?.getTime() || 0
      )),
      end: new Date(Math.min(
        t1.end?.getTime() || Infinity,
        t2.end?.getTime() || Infinity
      ))
    };
  }

  /**
   * Merge rate limits
   */
  private mergeRateLimits(r1?: any, r2?: any): any {
    if (!r1) return r2;
    if (!r2) return r1;
    
    return {
      requests: Math.min(r1.requests, r2.requests),
      window: Math.max(r1.window, r2.window)
    };
  }

  /**
   * Calculate TTL for policy result
   */
  private calculateTTL(policy: Policy): number {
    // Default TTL based on effect
    if (policy.effect === 'allow') {
      return 600; // 10 minutes for allows
    } else {
      return 60; // 1 minute for denials
    }
  }

  /**
   * Load policies from file
   */
  private async loadFromFile(location: string, format?: 'json' | 'yaml'): Promise<void> {
    const content = fs.readFileSync(location, 'utf-8');
    
    let data: any;
    if (format === 'yaml' || location.endsWith('.yaml') || location.endsWith('.yml')) {
      data = yaml.load(content);
    } else {
      data = JSON.parse(content);
    }

    if (data.policies) {
      for (const policy of data.policies) {
        this.policies.set(policy.id, policy);
      }
    }
  }

  /**
   * Load policies from database
   */
  private async loadFromDatabase(connectionString: string): Promise<void> {
    // Implementation would depend on database choice
    console.log('Loading policies from database:', connectionString);
    // This would typically use Prisma or TypeORM
  }

  /**
   * Load policies from API
   */
  private async loadFromAPI(endpoint: string): Promise<void> {
    const response = await fetch(endpoint);
    const data = await response.json();
    
    if (data && typeof data === 'object' && 'policies' in data) {
      const policiesData = data as { policies: Policy[] };
      for (const policy of policiesData.policies) {
        this.policies.set(policy.id, policy);
      }
    }
  }

  /**
   * Get permissions for roles
   */
  async getRolePermissions(roles: string[]): Promise<string[]> {
    const permissions = new Set<string>();
    
    for (const role of roles) {
      const rolePerms = this.rolePermissions.get(role) || [];
      rolePerms.forEach(p => permissions.add(p));
    }
    
    return Array.from(permissions);
  }

  /**
   * Add or update a policy
   */
  addPolicy(policy: Policy): void {
    this.policies.set(policy.id, policy);
  }

  /**
   * Remove a policy
   */
  removePolicy(policyId: string): void {
    this.policies.delete(policyId);
  }

  /**
   * Get all policies
   */
  getAllPolicies(): Policy[] {
    return Array.from(this.policies.values());
  }
}