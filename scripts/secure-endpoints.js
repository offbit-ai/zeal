#!/usr/bin/env node

/**
 * Script to automatically secure unprotected API endpoints
 * Applies established auth patterns based on endpoint type
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Endpoint categorization and auth patterns
const AUTH_PATTERNS = {
  // ZIP protocol endpoints
  zip: {
    middleware: 'withZIPAuthorization',
    import: "import { withZIPAuthorization } from '@/lib/auth/zip-middleware'",
    wrapperTemplate: (resourceType, action) => `, {\n  resourceType: '${resourceType}',\n  action: '${action}'\n})`
  },
  
  // Regular API endpoints  
  api: {
    middleware: 'withAuth',
    import: "import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware'",
    tenantImport: "import { validateTenantAccess, createTenantViolationError } from '@/lib/auth/tenant-utils'",
    wrapperTemplate: (resource, action) => `, {\n  resource: '${resource}',\n  action: '${action}'\n})`
  }
};

// Endpoint classification rules
const ENDPOINT_RULES = [
  // ZIP endpoints
  { pattern: /^app\/api\/zip\//, type: 'zip', resource: 'workflow', action: 'read' },
  { pattern: /\/templates\//, type: 'zip', resource: 'template', action: 'read' },
  { pattern: /\/orchestrator\//, type: 'zip', resource: 'node', action: 'read' },
  { pattern: /\/executions\//, type: 'zip', resource: 'execution', action: 'read' },
  { pattern: /\/traces\//, type: 'zip', resource: 'execution', action: 'read' },
  
  // Regular API endpoints
  { pattern: /\/templates\//, type: 'api', resource: 'template', action: 'read' },
  { pattern: /\/orchestrator\//, type: 'api', resource: 'node', action: 'read' },
  { pattern: /\/env-vars\//, type: 'api', resource: 'workflow', action: 'read' },
  { pattern: /\/flow-traces\//, type: 'api', resource: 'execution', action: 'read' },
  { pattern: /\/upload\//, type: 'api', resource: 'workflow', action: 'create' },
  { pattern: /\/cache\//, type: 'api', resource: 'workflow', action: 'read' }
];

// Files to skip (health checks, debug, etc.)
const SKIP_PATTERNS = [
  /\/health\/route\.ts$/,
  /\/debug\/.*route\.ts$/,
  /\/test\/.*route\.ts$/
];

function findUnprotectedEndpoints() {
  console.log('🔍 Finding unprotected endpoints...');
  
  try {
    const output = execSync(
      `find app/api -name "route.ts" -exec grep -L "withAuth\\|withZIPAuthorization" {} \\;`,
      { encoding: 'utf-8' }
    );
    
    return output.trim().split('\n').filter(file => {
      return file && !SKIP_PATTERNS.some(pattern => pattern.test(file));
    });
  } catch (error) {
    console.error('Error finding endpoints:', error.message);
    return [];
  }
}

function classifyEndpoint(filePath) {
  for (const rule of ENDPOINT_RULES) {
    if (rule.pattern.test(filePath)) {
      return {
        type: rule.type,
        resource: rule.resource,
        action: rule.action
      };
    }
  }
  
  // Default classification
  return {
    type: filePath.includes('/zip/') ? 'zip' : 'api',
    resource: 'workflow',
    action: 'read'
  };
}

function analyzeRouteFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const methods = [];
  
  // Find HTTP method exports
  const methodMatches = content.match(/export\s+(async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)/g);
  if (methodMatches) {
    methodMatches.forEach(match => {
      const method = match.match(/(GET|POST|PUT|PATCH|DELETE)/)[1];
      methods.push({
        method,
        action: {
          'GET': 'read',
          'POST': 'create', 
          'PUT': 'update',
          'PATCH': 'update',
          'DELETE': 'delete'
        }[method]
      });
    });
  }
  
  return methods.length > 0 ? methods : [{ method: 'GET', action: 'read' }];
}

function secureEndpoint(filePath) {
  const classification = classifyEndpoint(filePath);
  const pattern = AUTH_PATTERNS[classification.type];
  const methods = analyzeRouteFile(filePath);
  
  console.log(`🔒 Securing ${filePath} (${classification.type})`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Add imports if not present
  if (!content.includes(pattern.middleware)) {
    const importRegex = /import[^;]+from[^;]+;/;
    const lastImport = content.match(importRegex);
    if (lastImport) {
      const insertPos = lastImport.index + lastImport[0].length;
      content = content.slice(0, insertPos) + '\n' + pattern.import + 
                (pattern.tenantImport ? '\n' + pattern.tenantImport : '') +
                content.slice(insertPos);
      modified = true;
    }
  }
  
  // Secure each HTTP method
  methods.forEach(({ method, action }) => {
    const exportRegex = new RegExp(`export\\s+(async\\s+function|const)\\s+${method}\\s*[\\(=]`, 'g');
    const match = exportRegex.exec(content);
    
    if (match && !content.includes(`${method} = ${pattern.middleware}`)) {
      if (classification.type === 'zip') {
        // ZIP pattern
        content = content.replace(
          new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\([^)]+\\)\\s*\\{`),
          `export const ${method} = ${pattern.middleware}(async (request: NextRequest, context?: { params: any }) => {`
        );
      } else {
        // Regular API pattern  
        content = content.replace(
          new RegExp(`export\\s+async\\s+function\\s+${method}\\s*\\([^)]+\\)\\s*\\{`),
          `export const ${method} = ${pattern.middleware}(async (request: AuthenticatedRequest, context?: { params: any }) => {`
        );
        
        // Add parameter validation and tenant check
        const tryMatch = content.match(/{\s*try\s*{/);
        if (tryMatch) {
          const insertPos = tryMatch.index + tryMatch[0].length;
          const validation = `
    if (!context || !context.params) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 })
    }
    
    // Add tenant access validation for resources that support it
    // if ((resource as any).tenantId && !validateTenantAccess(resource as any, request as NextRequest)) {
    //   return createTenantViolationError()
    // }`;
          
          content = content.slice(0, insertPos) + validation + content.slice(insertPos);
        }
      }
      
      // Add wrapper closing
      const lastBraceMatch = content.lastIndexOf('}\n');
      if (lastBraceMatch !== -1) {
        const wrapper = pattern.wrapperTemplate(classification.resource, action);
        content = content.slice(0, lastBraceMatch) + '}' + wrapper + content.slice(lastBraceMatch + 1);
      }
      
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Secured ${filePath}`);
    return true;
  } else {
    console.log(`⚠️  Skipped ${filePath} (already secured or no changes needed)`);
    return false;
  }
}

function main() {
  console.log('🚀 Starting endpoint security automation...\n');
  
  const unprotectedEndpoints = findUnprotectedEndpoints();
  
  if (unprotectedEndpoints.length === 0) {
    console.log('🎉 No unprotected endpoints found!');
    return;
  }
  
  console.log(`Found ${unprotectedEndpoints.length} unprotected endpoints:\n`);
  unprotectedEndpoints.forEach((endpoint, i) => {
    console.log(`${i + 1}. ${endpoint}`);
  });
  
  console.log('\n📝 Processing endpoints...\n');
  
  let securedCount = 0;
  const errors = [];
  
  unprotectedEndpoints.forEach(endpoint => {
    try {
      if (secureEndpoint(endpoint)) {
        securedCount++;
      }
    } catch (error) {
      errors.push({ endpoint, error: error.message });
      console.error(`❌ Error securing ${endpoint}:`, error.message);
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Successfully secured: ${securedCount} endpoints`);
  console.log(`⚠️  Skipped: ${unprotectedEndpoints.length - securedCount - errors.length} endpoints`);
  console.log(`❌ Errors: ${errors.length} endpoints`);
  
  if (errors.length > 0) {
    console.log('\n🔴 Errors encountered:');
    errors.forEach(({ endpoint, error }) => {
      console.log(`  - ${endpoint}: ${error}`);
    });
  }
  
  console.log('\n🏁 Endpoint security automation completed!');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { secureEndpoint, findUnprotectedEndpoints };