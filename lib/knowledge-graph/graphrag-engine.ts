import Graph from 'graphology'
import { dijkstra, bidirectional } from 'graphology-shortest-path'
import { connectedComponents } from 'graphology-components'
import { bfsFromNode } from 'graphology-traversal'
import { 
  GraphNode, 
  GraphQuery, 
  RelevanceScore, 
  TemplateNode, 
  ServiceNode, 
  CapabilityNode 
} from './types'

export interface GraphRAGIntent {
  action: string
  services: string[]
  capabilities: string[]
  dataFlow: string[]
}

export class GraphRAGEngine {
  private graphSnapshot: any = null
  private snapshotLoaded: Promise<void>
  
  constructor(
    private graph: Graph,
    private llm: any,
    private embeddings: any
  ) {
    // Only load snapshot if graph is empty
    if (this.graph.order === 0) {
      this.snapshotLoaded = this.loadGraphSnapshot()
    } else {
      // Graph already has data, build snapshot from it
      this.snapshotLoaded = this.buildSnapshotFromGraph()
      console.log('📊 Using pre-loaded graph with', this.graph.order, 'nodes')
    }
  }
  
  private async buildSnapshotFromGraph(): Promise<void> {
    // Build a snapshot-like structure from the loaded graph
    const nodes: any[] = []
    const edges: any[] = []
    
    this.graph.forEachNode((nodeId, attributes) => {
      nodes.push({
        id: nodeId,
        attributes
      })
    })
    
    this.graph.forEachEdge((edge, attributes, source, target) => {
      edges.push({
        source,
        target,
        attributes
      })
    })
    
    this.graphSnapshot = {
      nodes,
      edges,
      metadata: {
        createdAt: new Date().toISOString(),
        templateCount: nodes.filter(n => n.attributes?.type === 'template').length,
        version: '1.0.0'
      }
    }
    
    console.log('📊 Built snapshot from graph:', this.graphSnapshot.metadata)
  }
  
  private async loadGraphSnapshot() {
    try {
      // Load the graphrag-snapshot for enriched analysis
      const fs = require('fs').promises
      const path = require('path')
      const snapshotPath = path.join(process.cwd(), 'data', 'graphrag-snapshot.json')
      const snapshotData = await fs.readFile(snapshotPath, 'utf8')
      this.graphSnapshot = JSON.parse(snapshotData)
      console.log('📊 Loaded GraphRAG snapshot with', this.graphSnapshot.nodes.length, 'nodes and', this.graphSnapshot.edges.length, 'edges')
    } catch (error) {
      console.warn('⚠️ Could not load graphrag-snapshot.json:', error)
      // Try alternative path for browser environment
      try {
        const response = await fetch('/graphrag-snapshot.json')
        if (response.ok) {
          this.graphSnapshot = await response.json()
          console.log('📊 Loaded GraphRAG snapshot from fetch with', this.graphSnapshot.nodes.length, 'nodes')
        }
      } catch (fetchError) {
        console.warn('⚠️ Could not load graphrag-snapshot.json via fetch:', fetchError)
      }
    }
  }

  async extractIntent(userRequest: string): Promise<GraphRAGIntent> {
    const prompt = `Analyze this user request and extract the workflow intent:
"${userRequest}"

Example: "Write a SQL script to select all users from the user table in my postgresql database and put them in an excel sheet"

Should extract:
- services: ["postgresql", "excel"]  
- capabilities: ["database_connection", "sql_execution", "data_export", "file_writing"]
- dataFlow: ["connect_database", "execute_sql", "fetch_results", "export_to_excel"]

Now analyze the actual request and return a JSON object with:
- action: the main goal (default: "workflow")
- services: array of specific services/tools mentioned (be liberal - if they say "SQL" include the database type if mentioned)
- capabilities: array of capabilities needed (think about ALL steps needed)
- dataFlow: array describing the sequence of operations

Return ONLY the JSON object, no explanation.`

    console.log('Intent extraction for request:', userRequest)
    const response = await this.llm.invoke(prompt)
    try {
      // Handle both string and object responses
      const content = typeof response === 'string' ? response : response.content
      console.log('Intent extraction response:', content)
      const parsed = JSON.parse(content)
      
      // Ensure we have valid intent structure
      return {
        action: parsed.action || 'workflow',
        services: Array.isArray(parsed.services) ? parsed.services : [],
        capabilities: Array.isArray(parsed.capabilities) ? parsed.capabilities : [],
        dataFlow: Array.isArray(parsed.dataFlow) ? parsed.dataFlow : []
      }
    } catch (error) {
      console.error('Failed to parse intent:', error)
      // Fallback to basic extraction
      return this.basicIntentExtraction(userRequest)
    }
  }

  private basicIntentExtraction(userRequest: string): GraphRAGIntent {
    // No hardcoding - just return a minimal intent that forces full LLM analysis
    return {
      action: 'workflow',
      services: [],
      capabilities: [],
      dataFlow: []
    }
  }

  async findRelevantNodes(
    userRequest: string, 
    intent: GraphRAGIntent
  ): Promise<RelevanceScore[]> {
    console.log('🔍 Finding relevant nodes for intent:', intent)
    
    // Wait for snapshot to load
    await this.snapshotLoaded
    
    // Use snapshot data if available for richer context
    let nodeData: Array<{
      id: string,
      template: any,
      connections: Array<{to: string, type: string}>,
      capabilities: string[],
      services: string[],
      properties?: any,
      rules?: any
    }> = []
    
    if (this.graphSnapshot) {
      console.log('📊 Using GraphRAG snapshot for enhanced analysis')
      // Extract rich data from snapshot
      nodeData = this.graphSnapshot.nodes
        .filter((node: any) => node.attributes?.type === 'template')
        .map((node: any) => {
          const data = node.attributes.data
          const connections = this.graphSnapshot.edges
            .filter((edge: any) => edge.source === node.id && edge.attributes.type === 'CAN_CONNECT_TO')
            .map((edge: any) => ({ to: edge.target, type: edge.attributes.type }))
          
          const services = this.graphSnapshot.edges
            .filter((edge: any) => 
              edge.source === node.id && 
              edge.attributes.type === 'INTEGRATES_WITH' && 
              edge.target.startsWith('service:')
            )
            .map((edge: any) => edge.target.replace('service:', ''))
          
          return {
            id: node.id,
            template: data,
            connections,
            capabilities: data.capabilities || [],
            services,
            properties: data.properties || {},
            rules: data.propertyRules || {}
          }
        })
    } else {
      // Fallback to graph traversal
      console.log('📊 Using graph traversal (no snapshot available)')
      this.graph.forEachNode((nodeId, attributes) => {
        const node = attributes as GraphNode
        if (node.type === 'template') {
          const templateNode = node as TemplateNode
          const connections: Array<{to: string, type: string}> = []
          
          // Get outgoing connections
          this.graph.forEachOutEdge(nodeId, (edge, attrs, source, target) => {
            connections.push({
              to: target,
              type: attrs.type
            })
          })
          
          // Extract services this node integrates with
          const services: string[] = []
          this.graph.forEachOutEdge(nodeId, (edge, attrs, source, target) => {
            if (attrs.type === 'INTEGRATES_WITH' && target.startsWith('service:')) {
              services.push(target.replace('service:', ''))
            }
          })
          
          nodeData.push({
            id: nodeId,
            template: templateNode.data,
            connections,
            capabilities: templateNode.data.capabilities || [],
            services,
            properties: (templateNode.data as any).properties || {},
            rules: (templateNode.data as any).propertyRules || {}
          })
        }
      })
    }
    
    // Check if we have nodes to analyze
    if (nodeData.length === 0) {
      console.log('⚠️ No nodes available in knowledge graph')
      console.log('GraphSnapshot status:', this.graphSnapshot ? 'loaded' : 'not loaded')
      console.log('Graph node count:', this.graph.order)
      
      // Try to force load if not loaded
      if (!this.graphSnapshot && this.graph.order === 0) {
        console.log('⚠️ Both graphSnapshot and graph are empty. This usually means the knowledge graph is not initialized.')
        // Return empty array but log detailed information
        return []
      }
      return []
    }
    
    console.log(`📊 Found ${nodeData.length} nodes in knowledge graph`)
    
    // OPTIMIZATION: Pre-filter nodes to reduce token usage using semantic similarity
    const preFilteredNodes = await this.preFilterRelevantNodes(nodeData, userRequest, intent)
    console.log(`🔍 Pre-filtered to ${preFilteredNodes.length} potentially relevant nodes (saved ${nodeData.length - preFilteredNodes.length} nodes from prompt)`)
    
    if (preFilteredNodes.length === 0) {
      console.warn('⚠️ No nodes passed pre-filtering, falling back to top 20 nodes')
      // Fallback to first 20 nodes if pre-filtering is too aggressive
      preFilteredNodes.push(...nodeData.slice(0, 20))
    }
    
    // Use LLM with reduced context
    const prompt = `Analyze this workflow request and select the most relevant nodes from the knowledge graph.

USER REQUEST: "${userRequest}"

EXTRACTED INTENT:
${JSON.stringify(intent, null, 2)}

RELEVANT CANDIDATE NODES:
${preFilteredNodes.map((node, i) => {
  let nodeInfo = `${i + 1}. ${node.template.title} (${node.id})
   Description: ${node.template.description}
   Category: ${node.template.category}
   Capabilities: ${node.capabilities.join(', ') || 'none'}
   Services: ${node.services.join(', ') || 'none'}
   Tags: ${(node.template.tags || []).join(', ')}
   Inputs: ${JSON.stringify(node.template.inputs || {})}
   Outputs: ${JSON.stringify(node.template.outputs || {})}
   Can connect to: ${node.connections.filter((c: any) => c.type === 'CAN_CONNECT_TO').map((c: any) => c.to).join(', ') || 'none'}`
  
  // Add properties and rules if available (from snapshot)
  if (node.properties && Object.keys(node.properties).length > 0) {
    nodeInfo += `\n   Properties: ${JSON.stringify(node.properties)}`
  }
  if (node.rules && Object.keys(node.rules).length > 0) {
    nodeInfo += `\n   Rules: ${JSON.stringify(node.rules)}`
  }
  
  return nodeInfo
}).join('\n\n')}

ANALYSIS REQUIREMENTS:
1. Select ALL RELEVANT nodes that could be useful for this workflow
2. When a service is mentioned (e.g., "MongoDB"), include ALL variants:
   - Connection nodes (MongoDB connection pool)
   - Operation nodes (MongoDB insert, find, update, delete)
   - Helper nodes (MongoDB aggregation, MongoDB watch)
3. Include ALL nodes that match the search terms, not just one per category
4. Consider the complete data flow from source to destination
5. Include intermediate processing nodes (filters, transformers, parsers)
6. Match exact services when specified (GitHub means GitHub, not generic API)
7. USE TAGS to find relevant nodes - if user mentions "filter", look for ALL filter-related nodes
8. Consider nodes that can perform multiple operations via properties

IMPORTANT SELECTION RULES:
- If "MongoDB" is mentioned → Select ALL MongoDB nodes (connection, insert, find, update, delete, etc.)
- If "PostgreSQL" is mentioned → Select ALL PostgreSQL nodes (pool, query, insert, update, etc.)
- If "HTTP" or "API" is mentioned → Select ALL relevant HTTP/API nodes
- If "transform" is mentioned → Select ALL transformation nodes
- Don't limit to just one node per type - include variations

For example, if the request mentions "MongoDB":
- Include: MongoDB Connection, MongoDB Insert, MongoDB Find, MongoDB Update, MongoDB Delete, MongoDB Aggregate
- Don't just pick one MongoDB node - include ALL MongoDB-related templates

IMPORTANT: Return MORE nodes rather than fewer. The workflow builder will select what's needed.

Return a JSON array of ALL relevant nodes with detailed reasoning:
[{
  "nodeId": "node_id",
  "score": 1-100,
  "reasons": ["specific reason 1", "specific reason 2"],
  "role": "source|processor|sink",
  "sequence": 1 // suggested position in workflow
}]`

    try {
      console.log('📤 Calling LLM with prompt for node selection...')
      const response = await this.llm.invoke(prompt)
      console.log('📥 LLM response type:', typeof response)
      console.log('📥 LLM response:', response)
      const content = typeof response === 'string' ? response : response.content
      console.log('Raw LLM response (first 500 chars):', content?.substring(0, 500))
      
      // Check if response is empty or undefined
      if (!content || content.trim() === '') {
        console.error('❌ LLM returned empty response')
        return []
      }
      
      const cleaned = this.cleanJsonResponse(content)
      console.log('Cleaned response:', cleaned)
      
      // Check if cleaned response is valid JSON
      if (!cleaned || cleaned === '[]' || cleaned === '{}') {
        console.warn('⚠️ LLM returned empty JSON array/object')
        return []
      }
      
      let selectedNodes
      try {
        selectedNodes = JSON.parse(cleaned)
      } catch (parseError) {
        console.error('❌ Failed to parse JSON:', parseError)
        console.error('Attempted to parse:', cleaned)
        
        // Try to extract array manually as a fallback
        const arrayMatch = cleaned.match(/\[[\s\S]*\]/)
        if (arrayMatch) {
          try {
            selectedNodes = JSON.parse(arrayMatch[0])
            console.log('✅ Successfully extracted array from malformed response')
          } catch (e) {
            console.error('❌ Could not extract valid array from response')
            return []
          }
        } else {
          return []
        }
      }
      
      console.log('Parsed nodes:', JSON.stringify(selectedNodes, null, 2))
      
      // Ensure we have an array
      const nodeArray = Array.isArray(selectedNodes) ? selectedNodes : []
      
      if (nodeArray.length === 0) {
        console.warn('⚠️ LLM returned empty node array')
        return []
      }
      
      // Convert to RelevanceScore format
      const relevantNodes: RelevanceScore[] = nodeArray.map((node: any) => ({
        nodeId: node.nodeId || node.id, // Support both nodeId and id
        score: node.score || 50,
        reasons: node.reasons || [],
        connections: [],
        metadata: {
          role: node.role,
          sequence: node.sequence
        }
      }))
      
      // Filter out any nodes without valid IDs
      const validNodes = relevantNodes.filter(node => node.nodeId && node.nodeId !== '')
      
      if (validNodes.length === 0) {
        console.error('❌ No valid node IDs found in LLM response')
        return []
      }
      
      // Sort by sequence then score
      validNodes.sort((a, b) => {
        const seqA = a.metadata?.sequence || 999
        const seqB = b.metadata?.sequence || 999
        if (seqA !== seqB) return seqA - seqB
        return b.score - a.score
      })
      
      console.log(`✅ LLM selected ${validNodes.length} nodes from ${preFilteredNodes.length} pre-filtered candidates (original: ${nodeData.length})`)
      return validNodes
      
    } catch (error) {
      console.error('LLM node selection failed:', error)
      console.error('Error details:', error instanceof Error ? error.message : error)
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
      
      // Return empty array - let the workflow review mechanism handle it
      return []
    }
  }


  async preventDuplicates(selectedNodes: RelevanceScore[]): Promise<RelevanceScore[]> {
    if (selectedNodes.length <= 1) return selectedNodes
    
    // Use LLM to identify duplicates
    const nodeDescriptions = selectedNodes.map(node => {
      const templateNode = this.graph.getNodeAttributes(node.nodeId) as TemplateNode
      return {
        id: node.nodeId,
        title: templateNode?.data?.title || node.nodeId,
        description: templateNode?.data?.description || '',
        score: node.score,
        reasons: node.reasons
      }
    })
    
    const prompt = `Review these selected nodes and identify any duplicates or redundant nodes.

Selected Nodes:
${nodeDescriptions.map((n, i) => {
  const templateNode = this.graph.getNodeAttributes(n.id) as TemplateNode
  const nodeType = (templateNode?.data as any)?.type || 'unknown'
  const category = templateNode?.data?.category || 'unknown'
  return `${i + 1}. ${n.title} (${n.id}) - Score: ${n.score}
   Type: ${nodeType} / Category: ${category}
   Description: ${n.description}
   Selected because: ${n.reasons.join(', ')}`
}).join('\n\n')}

Identify nodes that:
- Serve the exact same purpose
- Are alternatives where only one is needed
- Would create redundancy in the workflow

IMPORTANT EXCEPTIONS - NEVER mark these as duplicates:
- Branching/conditional nodes (if/else, switch, router) - multiple instances needed for different conditions
- Math operation nodes (add, subtract, multiply, compare) - each performs a specific calculation
- Logic nodes (AND, OR, NOT) - each handles different logic branches
- Aggregation nodes (merge, join, combine) - each handles different data streams
- Filter/transform nodes - each may have different criteria
- Script nodes (JavaScript, Python, SQL) - each has unique logic

These nodes are contextual and multiple instances are often required in workflows.

Return a JSON array of node IDs to keep (removing only true duplicates):
["node_id_1", "node_id_2", ...]

Keep the highest scoring nodes when removing duplicates.`

    try {
      const response = await this.llm.invoke(prompt)
      const content = typeof response === 'string' ? response : response.content
      const cleaned = this.cleanJsonResponse(content)
      const keepNodeIds = JSON.parse(cleaned)
      
      // Filter to only keep the specified nodes
      const uniqueNodes = selectedNodes.filter(node => 
        keepNodeIds.includes(node.nodeId)
      )
      
      console.log(`✅ Kept ${uniqueNodes.length} unique nodes out of ${selectedNodes.length}`)
      return uniqueNodes
      
    } catch (error) {
      console.error('Failed to prevent duplicates via LLM:', error)
      // Return all nodes if LLM fails
      return selectedNodes
    }
  }



  async findOptimalConnections(nodes: RelevanceScore[]): Promise<Array<{
    from: string
    to: string
    confidence: number
  }>> {
    console.log(`🔗 Finding optimal connections for ${nodes.length} nodes`)
    
    if (nodes.length === 0) {
      console.log('⚠️ No nodes provided for connection generation')
      return []
    }
    
    // Prepare node information for LLM
    const nodeDescriptions = nodes.map(node => {
      // Try to get from snapshot first for richer data
      if (this.graphSnapshot) {
        const snapshotNode = this.graphSnapshot.nodes.find((n: any) => n.id === node.nodeId)
        if (snapshotNode?.attributes?.type === 'template') {
          const data = snapshotNode.attributes.data
          return {
            id: node.nodeId,
            title: data.title,
            description: data.description,
            capabilities: data.capabilities || [],
            inputs: data.inputs || {},
            outputs: data.outputs || {},
            properties: data.properties || {},
            reasons: node.reasons
          }
        }
      }
      
      // Fallback to graph data
      const templateNode = this.graph.getNodeAttributes(node.nodeId) as TemplateNode
      if (templateNode?.type === 'template') {
        const data = templateNode.data
        return {
          id: node.nodeId,
          title: data.title,
          description: data.description,
          capabilities: data.capabilities || [],
          inputs: Object.keys(data.inputs || {}),
          outputs: Object.keys(data.outputs || {}),
          reasons: node.reasons
        }
      }
      return null
    }).filter(Boolean)
    
    // Get all possible connections from the graph or snapshot
    const possibleConnections: Array<{from: string, to: string}> = []
    
    if (this.graphSnapshot) {
      // Use snapshot for more comprehensive connection data
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue
          
          const hasConnection = this.graphSnapshot.edges.some((edge: any) => 
            edge.source === nodes[i].nodeId && 
            edge.target === nodes[j].nodeId && 
            edge.attributes.type === 'CAN_CONNECT_TO'
          )
          
          if (hasConnection) {
            possibleConnections.push({
              from: nodes[i].nodeId,
              to: nodes[j].nodeId
            })
          }
        }
      }
    } else {
      // Fallback to graph traversal
      for (let i = 0; i < nodes.length; i++) {
        for (let j = 0; j < nodes.length; j++) {
          if (i === j) continue
          
          const edges = this.graph.directedEdges(nodes[i].nodeId, nodes[j].nodeId)
          for (const edge of edges) {
            const attrs = this.graph.getEdgeAttributes(edge)
            if (attrs.type === 'CAN_CONNECT_TO') {
              possibleConnections.push({
                from: nodes[i].nodeId,
                to: nodes[j].nodeId
              })
              break
            }
          }
        }
      }
    }
    
    // Use LLM to determine optimal connections based on logical data flow
    const prompt = `Given these workflow nodes, create ALL necessary connections to form a complete data flow.

Selected Nodes:
${nodeDescriptions.map((n, i) => n ? `${i + 1}. ${n.title} (${n.id})
   - Description: ${n.description}
   - Capabilities: ${n.capabilities.join(', ') || 'none'}
   - Input ports: ${typeof n.inputs === 'object' ? JSON.stringify(n.inputs) : n.inputs.join(', ') || 'none'}
   - Output ports: ${typeof n.outputs === 'object' ? JSON.stringify(n.outputs) : n.outputs.join(', ') || 'none'}
   - Selected because: ${n.reasons.join(', ')}` : '').filter(Boolean).join('\n\n')}

Known Compatible Connections (from knowledge graph):
${possibleConnections.length > 0 ? possibleConnections.map(c => `- ${c.from} → ${c.to}`).join('\n') : 'None found in graph'}

CRITICAL PORT CONNECTION RULES:
🔴 ONLY connect OUTPUT ports to INPUT ports (never output-to-output or input-to-input)
🔴 A workflow graph is DIRECTED: data flows from outputs to inputs
🔴 Check port types before connecting:
   - OUTPUT ports (data-out, success-out, error-out, trigger-out, result-out, etc.)
   - INPUT ports (data-in, trigger-in, config-in, params-in, etc.)
🔴 Common port patterns:
   - data-out → data-in (main data flow)
   - success-out → trigger-in (successful execution triggers next)
   - error-out → data-in (error handling flow)
   - trigger-out → trigger-in (event propagation)

IMPORTANT: Create a COMPLETE workflow by connecting ALL nodes logically:
1. Start with trigger nodes (Cron Trigger, Webhook, etc.) or data sources
2. Connect each step to the next logical step in the data flow
3. For "fetch API and save to database", the flow should be:
   - Trigger.trigger-out → HTTP Request.trigger-in (trigger starts the API call)
   - HTTP Request.data-out → JSON Parser.data-in (API response needs parsing)
   - JSON Parser.data-out → Data Transformer.data-in (transform data for database)
   - Data Transformer.data-out → Database Write.data-in (save to database)
4. Database connections: MongoDB.connection-out → Get Collection.connection-in
5. ERROR HANDLING PRIORITY:
   - ALWAYS connect error OUTPUT ports to error handling INPUT ports
   - Connect error-out ports directly to error handling nodes or logging nodes
   - Only use If Branch nodes when you need complex conditional logic beyond simple error/success
   - Example: HTTP Request.error-out → Error Logger.data-in
6. IGNORE the "Known Compatible Connections" if they're incomplete - create logical connections based on the workflow purpose

VALIDATE EVERY CONNECTION:
- Source must be an OUTPUT port (ends with -out, or is a known output)
- Target must be an INPUT port (ends with -in, or is a known input)
- If you're unsure about a port name, use generic ones: data-out → data-in

Example for API to Database workflow:
- tpl_cron_trigger.trigger-out → tpl_http_request.trigger-in (trigger starts the API call)
- tpl_http_request.data-out → tpl_json_parser.data-in (API response needs parsing)
- tpl_json_parser.data-out → tpl_data_transformer.data-in (transform data for database)
- tpl_data_transformer.data-out → tpl_mongo_get_collection.data-in (save to database)
- tpl_mongodb.connection-out → tpl_mongo_get_collection.connection-in (database connection)

Return a JSON array of ALL necessary connections.
IMPORTANT: Use the format "node_id.port_name" and VERIFY port direction:
[{
  "from": "node_id.output_port_name",
  "to": "node_id.input_port_name",
  "confidence": 0.9,
  "reason": "why this connection makes sense"
}]

Examples of CORRECT connections:
- "from": "tpl_http_request.data-out", "to": "tpl_json_parser.data-in"
- "from": "tpl_cron_trigger.trigger-out", "to": "tpl_http_request.trigger-in"
- "from": "tpl_error_handler.error-out", "to": "tpl_logger.data-in"

Examples of WRONG connections (DO NOT DO):
❌ "from": "tpl_http_request.data-in", "to": "tpl_json_parser.data-in" (input to input)
❌ "from": "tpl_http_request.data-out", "to": "tpl_json_parser.data-out" (output to output)

Create ALL connections needed for a complete workflow, respecting port directions.`

    try {
      console.log('📤 Calling LLM for connection generation...')
      const response = await this.llm.invoke(prompt)
      console.log('📥 LLM response type:', typeof response)
      const content = typeof response === 'string' ? response : response.content
      console.log('📥 Connection LLM response (first 500 chars):', content?.substring(0, 500))
      
      // Clean JSON response
      const cleaned = this.cleanJsonResponse(content)
      console.log('🔧 Cleaned connection response:', cleaned)
      const suggestedConnections = JSON.parse(cleaned)
      console.log(`📊 LLM suggested ${suggestedConnections.length} connections`)
      
      // Build connections - don't validate against graph since we want logical connections
      const connections: Array<{from: string, to: string, confidence: number}> = []
      
      for (const conn of suggestedConnections) {
        // Extract node IDs from port-included format (e.g., "tpl_cron_trigger.trigger-out" -> "tpl_cron_trigger")
        const extractNodeId = (nodeWithPort: string) => {
          // If it contains a dot, it's in the format "nodeId.portName"
          if (nodeWithPort && nodeWithPort.includes('.')) {
            return nodeWithPort.split('.')[0]
          }
          return nodeWithPort
        }
        
        const fromNodeId = extractNodeId(conn.from)
        const toNodeId = extractNodeId(conn.to)
        
        console.log(`🔍 Extracted connection: "${conn.from}" -> "${fromNodeId}", "${conn.to}" -> "${toNodeId}"`)
        
        // Check if both nodes exist in our selected nodes
        const fromNodeExists = nodes.some(n => n.nodeId === fromNodeId)
        const toNodeExists = nodes.some(n => n.nodeId === toNodeId)
        
        if (fromNodeExists && toNodeExists) {
          connections.push({
            from: fromNodeId,
            to: toNodeId,
            confidence: conn.confidence || 0.8
          })
          console.log(`✓ Connection: ${fromNodeId} → ${toNodeId} (${conn.reason || 'logical flow'})`)
        } else {
          console.warn(`⚠️ Skipping connection ${fromNodeId} → ${toNodeId}: One or both nodes not in selected set`)
          console.warn(`   From exists: ${fromNodeExists}, To exists: ${toNodeExists}`)
          console.warn(`   Available nodes: ${nodes.map(n => n.nodeId).join(', ')}`)
        }
      }
      
      console.log(`🔗 Returning ${connections.length} validated connections from GraphRAG`)
      return connections
    } catch (error) {
      console.error('Failed to get optimal connections from LLM:', error)
      
      // Fallback: Create basic sequential connections
      console.log('📊 Using fallback connection strategy')
      const fallbackConnections: Array<{from: string, to: string, confidence: number}> = []
      
      // Sort nodes by their metadata sequence if available
      const sortedNodes = [...nodes].sort((a, b) => {
        const seqA = a.metadata?.sequence || 999
        const seqB = b.metadata?.sequence || 999
        return seqA - seqB
      })
      
      // Create sequential connections based on logical flow
      for (let i = 0; i < sortedNodes.length - 1; i++) {
        const currentNode = sortedNodes[i]
        const nextNode = sortedNodes[i + 1]
        
        // Always create a sequential connection in fallback mode
        // The workflow review process will validate if these make sense
        fallbackConnections.push({
          from: currentNode.nodeId,
          to: nextNode.nodeId,
          confidence: 0.6
        })
        console.log(`✓ Fallback connection: ${currentNode.nodeId} → ${nextNode.nodeId}`)
      }
      
      return fallbackConnections.length > 0 ? fallbackConnections : []
    }
  }
  
  /**
   * Pre-filter nodes using semantic similarity search with embeddings
   * This dramatically reduces token usage by filtering out semantically irrelevant nodes
   */
  private async preFilterRelevantNodes(
    nodeData: Array<any>, 
    userRequest: string, 
    intent: GraphRAGIntent
  ): Promise<Array<any>> {
    const MAX_NODES = 50 // Maximum nodes to include in LLM prompt (increased for comprehensive results)
    const MIN_SIMILARITY = 0.25 // Minimum cosine similarity threshold (lowered for broader matches)
    
    try {
      // Try semantic similarity search first
      const semanticResults = await this.semanticPreFilter(nodeData, userRequest, intent, MAX_NODES, MIN_SIMILARITY)
      
      if (semanticResults.length > 0) {
        console.log(`🧠 Semantic search found ${semanticResults.length} relevant nodes`)
        return semanticResults
      } else {
        console.warn('⚠️ Semantic search found no results, falling back to keyword matching')
        return this.keywordPreFilter(nodeData, userRequest, intent, MAX_NODES)
      }
      
    } catch (error) {
      console.error('❌ Semantic search failed, falling back to keyword matching:', error)
      return this.keywordPreFilter(nodeData, userRequest, intent, MAX_NODES)
    }
  }

  private async semanticPreFilter(
    nodeData: Array<any>, 
    userRequest: string, 
    intent: GraphRAGIntent,
    maxNodes: number,
    minSimilarity: number
  ): Promise<Array<any>> {
    // Import embedding service dynamically to avoid circular dependencies
    const { EmbeddingService } = await import('../../services/node-template-repository/search/embedding-service')
    
    // Create embedding service (use environment config)
    const embeddingService = EmbeddingService.fromEnvironment()
    
    // Combine user request with intent for richer query context
    const enhancedQuery = [
      userRequest,
      ...(intent.services || []),
      ...(intent.capabilities || []),
      ...(intent.dataFlow || []).slice(0, 3) // Limit data flow to prevent too long queries
    ].filter(Boolean).join(' ')
    
    console.log(`🔍 Generating embedding for query: "${enhancedQuery.substring(0, 100)}..."`)
    
    // Generate query embedding
    const queryEmbedding = await embeddingService.generateQueryEmbedding(enhancedQuery)
    
    // Calculate similarities with each node
    const scoredNodes = nodeData.map(node => {
      let maxSimilarity = 0
      
      // Check if node has pre-computed embeddings in the snapshot
      const nodeEmbeddings = node.embeddings || node.template?.embeddings
      
      if (nodeEmbeddings) {
        // Use pre-computed embeddings (most efficient)
        const similarities = [
          nodeEmbeddings.combined,
          nodeEmbeddings.title,
          nodeEmbeddings.description,
          nodeEmbeddings.capabilities
        ].filter(Boolean).map((embedding: Float32Array) => 
          EmbeddingService.cosineSimilarity(queryEmbedding, embedding)
        )
        
        maxSimilarity = Math.max(...similarities)
      } else {
        // Fallback: generate embedding on-demand (slower but works)
        console.warn(`⚠️ No pre-computed embeddings for node ${node.id}, computing on-demand`)
        // For now, skip nodes without embeddings to avoid performance issues
        // In production, you'd want to pre-compute all embeddings
        maxSimilarity = 0
      }
      
      return { node, similarity: maxSimilarity }
    })
    
    // Filter and sort by semantic similarity
    const relevantNodes = scoredNodes
      .filter(item => item.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxNodes)
      .map(item => {
        console.log(`🎯 Selected: ${item.node.template.title} (similarity: ${item.similarity.toFixed(3)})`)
        return item.node
      })
    
    return relevantNodes
  }

  private keywordPreFilter(
    nodeData: Array<any>, 
    userRequest: string, 
    intent: GraphRAGIntent,
    maxNodes: number
  ): Array<any> {
    // Fallback keyword-based filtering (simplified version of previous implementation)
    const keywords = [
      ...userRequest.toLowerCase().split(/\s+/).filter(w => w.length > 2),
      ...(intent.services || []).map(s => s.toLowerCase()),
      ...(intent.capabilities || []).map(c => c.toLowerCase())
    ]
    
    console.log(`🔍 Fallback keyword filtering with:`, keywords.slice(0, 8))
    
    const scoredNodes = nodeData.map(node => {
      const template = node.template
      const nodeText = [
        template.title || '',
        template.description || '',
        template.category || '',
        ...(template.tags || [])
      ].join(' ').toLowerCase()
      
      let score = 0
      for (const keyword of keywords) {
        if (nodeText.includes(keyword)) {
          score += keyword.length
        }
      }
      
      return { node, score }
    })
    
    return scoredNodes
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxNodes)
      .map(item => item.node)
  }

  private cleanJsonResponse(response: string): string {
    let cleaned = response.trim()
    
    // Remove markdown code blocks
    if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '')
    }
    
    // Extract JSON array or object
    const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (jsonMatch) {
      cleaned = jsonMatch[1];
    }
    
    return cleaned.trim()
  }

  explainSelection(selectedNodes: RelevanceScore[]): string {
    const explanations: string[] = []
    
    for (const node of selectedNodes) {
      const templateNode = this.graph.getNodeAttributes(node.nodeId) as TemplateNode
      if (templateNode?.type === 'template') {
        explanations.push(
          `- ${templateNode.data.title}: ${node.reasons.join(', ')} (score: ${node.score})`
        )
      }
    }
    
    return explanations.join('\n')
  }
}