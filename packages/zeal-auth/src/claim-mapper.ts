/**
 * Maps external claims to Zeal's authorization model
 */

import { 
  ExternalClaims, 
  Subject, 
  ClaimMappingConfig,
  IdentityProviderConfig 
} from './types';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

export class ClaimMapper {
  private mappingConfig: ClaimMappingConfig;
  private providers: Map<string, IdentityProviderConfig> = new Map();
  private jwksClients: Map<string, any> = new Map();

  constructor(config: ClaimMappingConfig, providers?: IdentityProviderConfig[]) {
    this.mappingConfig = config;
    
    if (providers) {
      for (const provider of providers) {
        this.providers.set(provider.id, provider);
        
        if (provider.jwksUri) {
          this.jwksClients.set(provider.id, jwksClient.default({
            jwksUri: provider.jwksUri,
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 600000 // 10 minutes
          }));
        }
      }
    }
  }

  /**
   * Extract claims from a token or raw claims object
   */
  async extractClaims(tokenOrClaims: string | ExternalClaims): Promise<ExternalClaims> {
    if (typeof tokenOrClaims === 'string') {
      return this.decodeToken(tokenOrClaims);
    }
    return tokenOrClaims;
  }

  /**
   * Map external claims to Zeal subject
   */
  async mapToSubject(claims: ExternalClaims): Promise<Subject> {
    const subject: Subject = {
      id: this.extractValue(claims, this.mappingConfig.subject.id) || 'unknown',
      type: this.extractValue(claims, this.mappingConfig.subject.type) || 'user',
      claims: { ...claims }
    };

    // Map tenant
    if (this.mappingConfig.tenant) {
      subject.tenantId = this.extractValue(claims, this.mappingConfig.tenant);
    }

    // Map organization
    if (this.mappingConfig.organization) {
      subject.organizationId = this.extractValue(claims, this.mappingConfig.organization);
    }

    // Map teams
    if (this.mappingConfig.teams) {
      const teams = this.extractValue(claims, this.mappingConfig.teams);
      subject.teams = this.normalizeToArray(teams);
    }

    // Map groups
    if (this.mappingConfig.groups) {
      const groups = this.extractValue(claims, this.mappingConfig.groups);
      subject.groups = this.normalizeToArray(groups);
    }

    // Map roles
    if (this.mappingConfig.roles) {
      const roles = this.extractValue(claims, this.mappingConfig.roles);
      subject.roles = this.normalizeToArray(roles);
    }

    // Map custom claims
    if (this.mappingConfig.custom) {
      subject.metadata = {};
      for (const [key, path] of Object.entries(this.mappingConfig.custom)) {
        const value = this.extractValue(claims, path);
        if (value !== undefined) {
          subject.metadata[key] = value;
        }
      }
    }

    return subject;
  }

  /**
   * Extract value from claims using path or array of paths
   */
  private extractValue(claims: any, pathOrPaths: string | string[]): any {
    const paths = Array.isArray(pathOrPaths) ? pathOrPaths : [pathOrPaths];

    for (const path of paths) {
      const value = this.getNestedValue(claims, path);
      if (value !== undefined && value !== null) {
        return value;
      }
    }

    return undefined;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!path) return undefined;
    
    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      // Handle array index notation like "roles[0]"
      const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayPath, index] = arrayMatch;
        current = current[arrayPath];
        if (Array.isArray(current)) {
          current = current[parseInt(index, 10)];
        } else {
          return undefined;
        }
      } else {
        current = current[part];
      }
    }

    return current;
  }

  /**
   * Normalize value to array
   */
  private normalizeToArray(value: any): string[] {
    if (value === undefined || value === null) {
      return [];
    }
    if (Array.isArray(value)) {
      return value.filter(v => typeof v === 'string');
    }
    if (typeof value === 'string') {
      // Check if it's a comma-separated string
      if (value.includes(',')) {
        return value.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [value];
    }
    return [];
  }

  /**
   * Decode and validate JWT token
   */
  private async decodeToken(token: string): Promise<ExternalClaims> {
    // First, decode without verification to get the header
    const decoded = jwt.decode(token, { complete: true }) as any;
    
    if (!decoded) {
      throw new Error('Invalid token format');
    }

    const { header, payload } = decoded;
    
    // Find matching provider based on issuer
    const provider = this.findProvider(payload.iss);
    
    if (!provider) {
      // No provider configured, return unverified claims
      console.warn('No provider configured for issuer:', payload.iss);
      return payload;
    }

    // Verify token based on provider configuration
    if (provider.publicKey) {
      // Use public key verification
      try {
        const verified = jwt.verify(token, provider.publicKey, {
          issuer: provider.issuer,
          audience: provider.audience
        }) as any;
        return verified;
      } catch (error: any) {
        throw new Error(`Token verification failed: ${error.message}`);
      }
    } else if (provider.jwksUri) {
      // Use JWKS verification
      const client = this.jwksClients.get(provider.id);
      if (!client) {
        throw new Error('JWKS client not configured for provider');
      }

      return new Promise((resolve, reject) => {
        client.getSigningKey(header.kid, (err: any, key: any) => {
          if (err) {
            reject(new Error(`Failed to get signing key: ${err.message}`));
            return;
          }

          const signingKey = key.getPublicKey();
          
          try {
            const verified = jwt.verify(token, signingKey, {
              issuer: provider.issuer,
              audience: provider.audience
            }) as any;
            resolve(verified);
          } catch (error: any) {
            reject(new Error(`Token verification failed: ${error.message}`));
          }
        });
      });
    } else {
      // No verification configured, return claims
      console.warn('No verification method configured for provider:', provider.id);
      return payload;
    }
  }

  /**
   * Find provider configuration by issuer
   */
  private findProvider(issuer?: string): IdentityProviderConfig | undefined {
    if (!issuer) return undefined;
    
    for (const provider of this.providers.values()) {
      if (provider.issuer === issuer) {
        return provider;
      }
    }
    
    return undefined;
  }

  /**
   * Validate claims against expected schema
   */
  validateClaims(claims: ExternalClaims): boolean {
    // Check for required fields based on configuration
    const subjectId = this.extractValue(claims, this.mappingConfig.subject.id);
    if (!subjectId) {
      console.error('Subject ID not found in claims');
      return false;
    }

    // Check token expiration if present
    if (claims.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp < now) {
        console.error('Token has expired');
        return false;
      }
    }

    // Check not before if present
    if (claims.nbf) {
      const now = Math.floor(Date.now() / 1000);
      if (claims.nbf > now) {
        console.error('Token not yet valid');
        return false;
      }
    }

    return true;
  }

  /**
   * Transform claims based on provider-specific mappings
   */
  transformClaims(claims: ExternalClaims, providerId?: string): ExternalClaims {
    if (!providerId) return claims;
    
    const provider = this.providers.get(providerId);
    if (!provider?.claimMappings) return claims;

    const transformed: any = { ...claims };

    for (const [target, source] of Object.entries(provider.claimMappings)) {
      const value = this.getNestedValue(claims, source);
      if (value !== undefined) {
        this.setNestedValue(transformed, target, value);
      }
    }

    return transformed;
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    
    let current = obj;
    for (const part of parts) {
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    current[last] = value;
  }

  /**
   * Merge multiple claim sources
   */
  mergeClaims(...claimSources: ExternalClaims[]): ExternalClaims {
    const merged: ExternalClaims = {};
    
    for (const claims of claimSources) {
      Object.assign(merged, claims);
    }
    
    return merged;
  }

  /**
   * Add custom claim mapping
   */
  addCustomMapping(key: string, path: string): void {
    if (!this.mappingConfig.custom) {
      this.mappingConfig.custom = {};
    }
    this.mappingConfig.custom[key] = path;
  }

  /**
   * Get current mapping configuration
   */
  getMappingConfig(): ClaimMappingConfig {
    return { ...this.mappingConfig };
  }
}