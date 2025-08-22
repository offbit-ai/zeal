# Orchestrator Agent LLM Call Optimization Plan

## Current Performance Issues
- Average 1.5s per LLM request
- Multiple sequential LLM calls create 5-10 second delays
- Typical workflow creation: 7-10 LLM calls = 10-15 seconds total

## Optimization Strategy

### 1. Merge Intent + Planning + Property Extraction (Saves 2 LLM calls)

**Current Flow:**
```
1. extractIntent() -> LLM Call #1
2. planWorkflow() -> LLM Call #2  
3. extractPropertyValues() -> LLM Call #3
```

**Optimized Flow:**
```
1. combinedAnalysis() -> Single LLM Call
   - Extracts intent
   - Plans workflow structure
   - Extracts mentioned property values
   - Returns comprehensive JSON
```

**Implementation:**
```typescript
// In extractIntent() method, expand the prompt to include planning
const COMBINED_PROMPT = `
Analyze request and provide:
1. Intent (what user wants)
2. Workflow plan (nodes, connections, groups)
3. Property values mentioned
4. Confidence score

Return as single JSON response.
`
```

### 2. Batch Node Selection with GraphRAG (Saves N-1 calls for N nodes)

**Current Flow:**
```
For each node:
  - searchForNode() -> LLM Call
  - fallbackSearch() -> Possible LLM Call
  - validateSelection() -> LLM Call
```

**Optimized Flow:**
```
1. Use GraphRAG for all nodes first (no LLM)
2. Batch validate all selections -> Single LLM Call only if needed
```

**Implementation:**
```typescript
// Add method for batch node selection
private async batchSelectNodes(nodeRequirements: any[]) {
  // Try GraphRAG first for all nodes
  const selections = await Promise.all(
    nodeRequirements.map(req => this.graphRAG.search(req.query))
  )
  
  // Only use LLM if some nodes not found
  const notFound = selections.filter(s => !s.found)
  if (notFound.length > 0) {
    // Single LLM call for all missing nodes
    return this.suggestAlternatives(notFound)
  }
}
```

### 3. Skip Unnecessary Validation Calls

**Current Issues:**
- `validateWorkflowCompleteness()` - Often redundant
- `reviewAndRefineConnections()` - Can be merged with planning
- Individual connection validation - Unnecessary if plan is good

**Optimization:**
- Trust the initial combined analysis
- Only validate if confidence < 0.7
- Merge validation into error recovery only

### 4. Eliminate Property Question Generation

**Current Flow:**
```
For each property:
  - canInferFromContext() -> LLM Call
  - generateQuestionForProperty() -> LLM Call
```

**Optimized Flow:**
```
- Include in combined analysis which properties need user input
- Generate all questions in one batch if needed
- Use template-based questions for common properties
```

### 5. Smart Summary Generation

**Current:** LLM call for summary
**Optimized:** Template-based summary, only use LLM for complex workflows

## Expected Performance Improvements

### Before Optimization:
```
Typical workflow creation:
1. Extract intent: 1.5s
2. Plan workflow: 1.5s  
3. Select 3 nodes: 4.5s (1.5s each)
4. Extract properties: 1.5s
5. Validate workflow: 1.5s
6. Generate summary: 1.5s
Total: ~12 seconds
```

### After Optimization:
```
Optimized workflow creation:
1. Combined analysis: 1.5s
2. GraphRAG node selection: 0.2s (no LLM)
3. Batch operations: 0.5s
4. Template summary: 0.1s
Total: ~2.3 seconds (5x faster!)
```

## Implementation Priority

1. **High Priority (Quick Wins):**
   - Merge intent + planning + property extraction
   - Use GraphRAG for node selection
   - Remove redundant validations

2. **Medium Priority:**
   - Batch property questions
   - Template-based summaries
   - Cache common patterns

3. **Low Priority:**
   - Streaming optimizations
   - Parallel processing where possible

## Code Changes Required

### 1. Modify `extractIntent()` in agent.ts:
```typescript
private async extractIntent(
  content: string,
  chatHistory?: ChatMessage[]
): Promise<WorkflowIntent & { plan?: WorkflowPlan, extractedValues?: any }> {
  // Combine multiple prompts into one
  const combinedPrompt = this.buildCombinedPrompt(content, chatHistory)
  const response = await this.callLLM([{ role: 'user', content: combinedPrompt }])
  
  const result = JSON.parse(this.cleanJsonResponse(response))
  return {
    ...result.intent,
    plan: result.workflow,
    extractedValues: result.extractedValues
  }
}
```

### 2. Modify `createNewWorkflowStream()`:
```typescript
private async *createNewWorkflowStream(
  content: string,
  chatHistory?: ChatMessage[]
): AsyncGenerator<StreamingAgentResponse> {
  // Single analysis call
  const analysis = await this.extractIntent(content, chatHistory)
  
  // Skip planWorkflow - already in analysis
  // Skip extractPropertyValues - already in analysis
  
  // Create workflow
  const workflowId = await this.createWorkflow(analysis)
  
  // Batch add nodes using GraphRAG
  const nodes = await this.batchAddNodes(analysis.plan.nodes, workflowId)
  
  // Add connections without validation
  await this.batchAddConnections(analysis.plan.connections, nodes, workflowId)
  
  // Quick summary without LLM
  yield {
    type: 'complete',
    content: this.generateTemplateSummary(analysis),
    workflowId
  }
}
```

### 3. Add GraphRAG-first node selection:
```typescript
private async selectNodeTemplate(query: string): Promise<string | null> {
  // Try GraphRAG first
  if (this.graphRAG) {
    const results = await this.graphRAG.search(query, { maxResults: 1 })
    if (results.length > 0 && results[0].score > 0.7) {
      return results[0].metadata.id
    }
  }
  
  // Fallback to MCP search (no LLM)
  const searchResult = await this.mcpClient.searchTemplates(query)
  return searchResult.templates?.[0]?.id || null
}
```

## Testing Strategy

1. Measure time for each LLM call
2. Compare total workflow creation time
3. Ensure quality doesn't degrade
4. A/B test with users

## Rollback Plan

Keep existing methods, add optimized versions with feature flag:
```typescript
if (process.env.USE_OPTIMIZED_AGENT === 'true') {
  return this.createNewWorkflowOptimized(content)
} else {
  return this.createNewWorkflowStream(content)
}
```