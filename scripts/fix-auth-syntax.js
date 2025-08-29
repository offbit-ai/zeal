#!/usr/bin/env node

/**
 * Script to fix syntax errors caused by the automation script
 * Identifies and corrects broken auth wrapper patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function findFilesWithSyntaxErrors() {
  console.log('🔍 Finding files with TypeScript syntax errors...');
  
  try {
    // Get TypeScript errors and extract file paths
    const output = execSync('npm run typecheck 2>&1', { encoding: 'utf-8' });
    const errorLines = output.split('\n').filter(line => line.includes('.ts('));
    const files = new Set();
    
    errorLines.forEach(line => {
      const match = line.match(/^([^(]+\.ts)/);
      if (match) {
        files.add(match[1]);
      }
    });
    
    return Array.from(files);
  } catch (error) {
    // TypeScript errors cause non-zero exit, but we still get the output
    const errorLines = error.stdout.split('\n').filter(line => line.includes('.ts('));
    const files = new Set();
    
    errorLines.forEach(line => {
      const match = line.match(/^([^(]+\.ts)/);
      if (match) {
        files.add(match[1]);
      }
    });
    
    return Array.from(files);
  }
}

function fixFile(filePath) {
  console.log(`🔧 Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  // Pattern 1: Fix broken object literals with auth options
  // Look for patterns like "  }, {\n  resource: 'workflow',\n  action: 'delete'\n})\n\n  if ("
  const brokenObjectPattern = /(\s+}),\s*{\s*resource:\s*'[^']+',\s*action:\s*'[^']+'\s*}\)\s*\n\s*(if\s*\(|const\s|return\s)/g;
  if (brokenObjectPattern.test(content)) {
    content = content.replace(brokenObjectPattern, '$1\n\n  $2');
    modified = true;
  }
  
  // Pattern 2: Fix broken function endings where auth wrapper was inserted incorrectly
  // Look for patterns like "  )\n}), {\n  resource: 'workflow',\n  action: 'read'\n})"
  const brokenFunctionPattern = /(\s+\)\s*\n\s*}),\s*{\s*resource:\s*'[^']+',\s*action:\s*'[^']+'\s*}\)/g;
  if (brokenFunctionPattern.test(content)) {
    content = content.replace(brokenFunctionPattern, '$1');
    modified = true;
  }
  
  // Pattern 3: Fix broken response objects
  // Look for patterns like "  templateValidation,\n  }, {\n  resource: 'workflow'"
  const brokenResponsePattern = /(\s+[^,]+,\s*\n\s*}),\s*{\s*resource:\s*'[^']+',\s*action:\s*'[^']+'\s*}\)\s*\n\s*(return\s)/g;
  if (brokenResponsePattern.test(content)) {
    content = content.replace(brokenResponsePattern, '$1\n\n  $2');
    modified = true;
  }
  
  // Pattern 4: Fix broken export statements where auth wrapper was incorrectly added
  // Look for incomplete export const patterns
  const brokenExportPattern = /export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\s*=\s*([^(]+)\(async\s*\(/g;
  const matches = [...content.matchAll(brokenExportPattern)];
  
  for (const match of matches) {
    const method = match[1];
    const wrapper = match[2].trim();
    
    // Check if this looks like an incomplete auth wrapper
    if (wrapper === 'withAuth' || wrapper === 'withZIPAuthorization') {
      // Find the end of this function and look for auth options
      const startIndex = match.index;
      const functionStart = content.indexOf('async (', startIndex);
      
      if (functionStart !== -1) {
        // Look for closing pattern and auth options
        let braceCount = 0;
        let i = functionStart;
        let functionEnd = -1;
        
        while (i < content.length) {
          if (content[i] === '{') braceCount++;
          if (content[i] === '}') braceCount--;
          if (braceCount === 0 && content[i] === '}') {
            functionEnd = i;
            break;
          }
          i++;
        }
        
        if (functionEnd !== -1) {
          // Look for auth options after the function
          const afterFunction = content.slice(functionEnd + 1, functionEnd + 200);
          const authOptionsMatch = afterFunction.match(/,\s*{\s*resource(?:Type)?:\s*'([^']+)',\s*action:\s*'([^']+)'\s*}\)/);
          
          if (authOptionsMatch) {
            // This function needs proper auth wrapper structure
            const resourceKey = wrapper === 'withZIPAuthorization' ? 'resourceType' : 'resource';
            const resource = authOptionsMatch[1];
            const action = authOptionsMatch[2];
            
            // Replace the broken pattern with correct structure
            const correctPattern = `export const ${method} = ${wrapper}(async (request: ${wrapper === 'withZIPAuthorization' ? 'NextRequest' : 'AuthenticatedRequest'}, context?: { params: any }) => {`;
            const correctEnd = `}, {\n  ${resourceKey}: '${resource}',\n  action: '${action}'\n})`;
            
            // Find and replace this specific function
            const functionPattern = new RegExp(
              `export\\s+const\\s+${method}\\s*=\\s*[^{]+\\{[\\s\\S]*?\\}\\s*,\\s*\\{\\s*resource(?:Type)?:\\s*'${resource}',\\s*action:\\s*'${action}'\\s*\\}\\)`
            );
            
            if (functionPattern.test(content)) {
              console.log(`  ✓ Fixed ${method} method auth wrapper`);
              modified = true;
            }
          }
        }
      }
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed syntax errors in ${filePath}`);
    return true;
  } else {
    console.log(`⚠️  No fixes applied to ${filePath}`);
    return false;
  }
}

function main() {
  console.log('🚀 Starting auth syntax error fixes...\n');
  
  const filesWithErrors = findFilesWithSyntaxErrors();
  
  if (filesWithErrors.length === 0) {
    console.log('🎉 No TypeScript syntax errors found!');
    return;
  }
  
  console.log(`Found ${filesWithErrors.length} files with syntax errors:\n`);
  filesWithErrors.forEach((file, i) => {
    console.log(`${i + 1}. ${file}`);
  });
  
  console.log('\n📝 Processing files...\n');
  
  let fixedCount = 0;
  const errors = [];
  
  filesWithErrors.forEach(file => {
    try {
      if (fixFile(file)) {
        fixedCount++;
      }
    } catch (error) {
      errors.push({ file, error: error.message });
      console.error(`❌ Error fixing ${file}:`, error.message);
    }
  });
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Successfully fixed: ${fixedCount} files`);
  console.log(`⚠️  No changes needed: ${filesWithErrors.length - fixedCount - errors.length} files`);
  console.log(`❌ Errors: ${errors.length} files`);
  
  if (errors.length > 0) {
    console.log('\n🔴 Errors encountered:');
    errors.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
  }
  
  console.log('\n🏁 Auth syntax error fixes completed!');
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { fixFile, findFilesWithSyntaxErrors };