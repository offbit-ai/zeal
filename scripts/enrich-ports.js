#!/usr/bin/env node

/**
 * Script to enrich node template ports with semantic descriptions
 * and fix port naming inconsistencies
 */

const fs = require('fs').promises
const path = require('path')

// Port descriptions mapping by common port IDs
const portDescriptions = {
  // Database connection ports
  'pool-id': {
    input: 'MongoDB connection pool identifier for database operations',
    output: 'MongoDB connection pool identifier that can be used by collection operation nodes'
  },
  'pool-out': {
    output: 'Database connection pool identifier for downstream operations'
  },
  'pool-in': {
    input: 'Database connection pool identifier from upstream connection node'
  },
  
  // Data flow ports
  'data-in': {
    input: 'Input data to be processed, transformed, or stored'
  },
  'data-out': {
    output: 'Processed or retrieved data from the operation'
  },
  'data': {
    input: 'Input data for processing',
    output: 'Output data after processing'
  },
  
  // Query and filter ports
  'query-in': {
    input: 'Query parameters, filters, or search criteria'
  },
  'filter-in': {
    input: 'Filter conditions to apply to the data or operation'
  },
  'filters': {
    input: 'Filter criteria for data selection or processing'
  },
  
  // Result ports
  'result-out': {
    output: 'Operation result including success/failure status and data'
  },
  'results-out': {
    output: 'Collection of results from the operation'
  },
  'output': {
    output: 'General output data from the node operation'
  },
  'success': {
    output: 'Success output containing processed data when operation succeeds'
  },
  'error': {
    output: 'Error output containing error details when operation fails'
  },
  
  // Status and metrics
  'status-out': {
    output: 'Operation status information including success/failure and metadata'
  },
  'metrics-out': {
    output: 'Performance metrics and statistics about the operation'
  },
  'count-out': {
    output: 'Count of processed or retrieved items'
  },
  
  // Document/record ports
  'docs-out': {
    output: 'Retrieved documents from database query'
  },
  'records-out': {
    output: 'Retrieved records from the data source'
  },
  'document': {
    input: 'Input document for processing',
    output: 'Processed or retrieved document'
  },
  
  // API specific
  'params-in': {
    input: 'API parameters including headers, query params, and request configuration'
  },
  'response': {
    output: 'API response including status code, headers, and body'
  },
  'rate-out': {
    output: 'API rate limit information including remaining requests and reset time'
  },
  
  // Trigger ports
  'trigger': {
    input: 'Trigger signal to initiate the operation',
    output: 'Trigger signal for downstream nodes'
  },
  'trigger-out': {
    output: 'Trigger signal to activate connected nodes'
  },
  
  // Control flow
  'true': {
    output: 'Output path when condition evaluates to true'
  },
  'false': {
    output: 'Output path when condition evaluates to false'
  },
  'condition': {
    input: 'Condition or expression to evaluate'
  },
  
  // Message/communication
  'message': {
    input: 'Message content to process or send',
    output: 'Processed or received message'
  },
  'message-in': {
    input: 'Incoming message to process'
  },
  'message-out': {
    output: 'Outgoing message after processing'
  },
  
  // Authentication
  'auth-in': {
    input: 'Authentication credentials or tokens'
  },
  'token-out': {
    output: 'Generated authentication token'
  },
  
  // Streaming
  'stream-in': {
    input: 'Input stream of data'
  },
  'stream-out': {
    output: 'Output stream of processed data'
  },
  
  // File operations
  'file-in': {
    input: 'File path or file content for processing'
  },
  'file-out': {
    output: 'Processed file content or file path'
  },
  
  // Configuration
  'config-in': {
    input: 'Configuration parameters for the operation'
  },
  'options-in': {
    input: 'Operation options and settings'
  },
  
  // Aggregation
  'aggregate-in': {
    input: 'Data to be aggregated'
  },
  'aggregate-out': {
    output: 'Aggregated results'
  },
  
  // Default descriptions for common patterns
  'input': {
    input: 'General input data for the node operation'
  },
  'output': {
    output: 'General output data from the node operation'
  },
  'in': {
    input: 'Input data'
  },
  'out': {
    output: 'Output data'
  }
}

// Function to get description for a port
function getPortDescription(portId, portType, nodeContext = {}) {
  const portDesc = portDescriptions[portId]
  if (portDesc) {
    return portDesc[portType] || portDesc.input || portDesc.output
  }
  
  // Generate contextual description based on port ID and node context
  const cleanId = portId.replace(/-/g, ' ').replace(/_/g, ' ')
  if (portType === 'input') {
    return `Input ${cleanId} for ${nodeContext.title || 'node'} operation`
  } else {
    return `Output ${cleanId} from ${nodeContext.title || 'node'} operation`
  }
}

// Function to fix port naming inconsistencies
function fixPortId(portId, nodeContext = {}) {
  // Fix MongoDB pool port naming
  if (portId === 'pool-in' || portId === 'pool-out') {
    return 'pool-id'
  }
  return portId
}

// Process a single template file
async function processTemplateFile(filePath) {
  console.log(`Processing ${path.basename(filePath)}...`)
  
  try {
    const content = await fs.readFile(filePath, 'utf8')
    
    // Parse and update ports
    let updatedContent = content
    
    // Find all port definitions
    const portRegex = /ports:\s*\[([\s\S]*?)\]/g
    const portMatches = [...content.matchAll(portRegex)]
    
    for (const match of portMatches) {
      const portsSection = match[1]
      
      // Extract node context (title) if possible
      const nodeContext = {}
      const titleMatch = content.substring(0, match.index).match(/title:\s*['"]([^'"]+)['"]/g)
      if (titleMatch && titleMatch.length > 0) {
        const lastTitle = titleMatch[titleMatch.length - 1]
        nodeContext.title = lastTitle.match(/['"]([^'"]+)['"]/)[1]
      }
      
      // Process each port in the section
      const portDefRegex = /\{\s*id:\s*['"]([^'"]+)['"]\s*,\s*label:\s*['"]([^'"]+)['"]\s*,\s*type:\s*['"]([^'"]+)['"]\s*,\s*position:\s*['"]([^'"]+)['"]\s*,?\s*\}/g
      const updatedPorts = portsSection.replace(portDefRegex, (portMatch, id, label, type, position) => {
        const fixedId = fixPortId(id, nodeContext)
        const description = getPortDescription(fixedId, type, nodeContext)
        
        // Check if description already exists
        if (portMatch.includes('description:')) {
          return portMatch
        }
        
        // Build updated port definition
        return `{
        id: '${fixedId}',
        label: '${label}',
        type: '${type}',
        position: '${position}',
        description: '${description}',
      }`
      })
      
      updatedContent = updatedContent.replace(match[0], `ports: [${updatedPorts}]`)
    }
    
    // Write back the updated content
    await fs.writeFile(filePath, updatedContent, 'utf8')
    console.log(`✓ Updated ${path.basename(filePath)}`)
    
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error)
  }
}

// Main function
async function main() {
  const templatesDir = path.join(__dirname, '..', 'data', 'nodeTemplates')
  
  // Get all TypeScript files in the templates directory
  const files = await fs.readdir(templatesDir)
  const tsFiles = files.filter(f => f.endsWith('.ts') && f !== 'types.ts' && f !== 'index.ts')
  
  console.log(`Found ${tsFiles.length} template files to process`)
  
  // Process each file
  for (const file of tsFiles) {
    const filePath = path.join(templatesDir, file)
    await processTemplateFile(filePath)
  }
  
  console.log('\n✅ Port enrichment complete!')
  console.log('Note: Please review the changes and run TypeScript compilation to verify')
}

// Run the script
main().catch(console.error)