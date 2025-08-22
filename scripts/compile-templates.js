#!/usr/bin/env node

/**
 * Compile TypeScript templates to JSON for ingestion
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const templatesDir = path.join(__dirname, '../data/nodeTemplates')
const outputPath = path.join(__dirname, '../data/compiled-templates.json')

console.log('🔨 Compiling TypeScript templates...')

// Map of template files to their export names
const templateFiles = {
  'graphIO': 'graphIOTemplates',
  'dataProcessing': 'dataProcessingTemplates', 
  'aiModels': 'aiModelsTemplates',
  'communication': 'communicationTemplates',
  'dataSources': 'dataSourcesTemplates',
  'logicControl': 'logicControlTemplates',
  'scripting': 'scriptingTemplates',
  'serverNodes': 'serverNodeTemplates', // Note: not serverNodesTemplates
  'storageMemory': 'storageMemoryTemplates',
  'toolsUtilities': 'toolsUtilitiesTemplates',
  'userInputs': 'userInputsTemplates'
}

// Create a temporary TypeScript file that exports all templates
const compileScript = `
import { NodeTemplate } from './data/nodeTemplates/types'

${Object.entries(templateFiles).map(([file, exportName]) => {
  return `import { ${exportName} } from './data/nodeTemplates/${file}'`
}).join('\n')}

const allTemplates: NodeTemplate[] = [
${Object.values(templateFiles).map(exportName => {
  return `  ...${exportName}`
}).join(',\n')}
]

console.log(JSON.stringify(allTemplates, null, 2))
`

// Write the compile script
const compileScriptPath = path.join(__dirname, '../.tmp-compile-templates.ts')
fs.writeFileSync(compileScriptPath, compileScript)

try {
  // Execute with tsx and capture output
  const output = execSync(`npx tsx ${compileScriptPath}`, {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large output
  })
  
  // Write the output to file
  fs.writeFileSync(outputPath, output)
  
  // Parse to verify and count
  const templates = JSON.parse(output)
  console.log(`✅ Compiled ${templates.length} templates to ${outputPath}`)
  
} catch (error) {
  console.error('❌ Failed to compile templates:', error.message)
  process.exit(1)
} finally {
  // Clean up
  if (fs.existsSync(compileScriptPath)) {
    fs.unlinkSync(compileScriptPath)
  }
}