#!/usr/bin/env node

/**
 * Quick script to fix the most common patterns that broke from automation
 */

const fs = require('fs');

const commonFixes = [
  // Fix broken auth wrapper endings
  {
    pattern: /(\s+}),\s*{\s*resource(?:Type)?:\s*'[^']+',\s*action:\s*'[^']+'\s*}\)\s*\n\s*([a-zA-Z])/g,
    replacement: '$1\n\n  $2'
  },
  
  // Fix broken function endings with extra closing parentheses
  {
    pattern: /(\s+}),\s*{\s*resource(?:Type)?:\s*'[^']+',\s*action:\s*'[^']+'\s*}\)\s*\n\s*\)/g,
    replacement: '$1'
  },
  
  // Fix broken object literals
  {
    pattern: /(\s+[^,]+,\s*\n\s*}),\s*{\s*resource(?:Type)?:\s*'[^']+',\s*action:\s*'[^']+'\s*}\)\s*\n\s*(return\s)/g,
    replacement: '$1\n\n  $2'
  }
];

const problematicFiles = [
  'app/api/graphrag/initialize/route.ts',
  'app/api/orchestrator/llm/route.ts', 
  'app/api/orchestrator/nodes/list/route.ts',
  'app/api/orchestrator/crdt-updates/route.ts',
  'app/api/orchestrator/test-llm/route.ts',
  'app/api/templates/[id]/route.ts'
];

function quickFix(filePath) {
  console.log(`🔧 Quick fixing ${filePath}...`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return false;
  }
  
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  for (const fix of commonFixes) {
    if (fix.pattern.test(content)) {
      content = content.replace(fix.pattern, fix.replacement);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Applied quick fixes to ${filePath}`);
    return true;
  } else {
    console.log(`⚠️  No quick fixes needed for ${filePath}`);
    return false;
  }
}

function main() {
  console.log('🚀 Running quick auth fixes...\n');
  
  let fixedCount = 0;
  
  problematicFiles.forEach(file => {
    try {
      if (quickFix(file)) {
        fixedCount++;
      }
    } catch (error) {
      console.error(`❌ Error fixing ${file}:`, error.message);
    }
  });
  
  console.log(`\n📊 Quick fixed ${fixedCount} files`);
  console.log('🏁 Quick fixes completed!');
}

if (require.main === module) {
  main();
}

module.exports = { quickFix };