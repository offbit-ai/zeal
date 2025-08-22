# Orchestrator Agent Enhancement Plan

## Overview

This document outlines the plan to enhance the Zeal Orchestrator Agent with advanced capabilities for property modification, script generation, and adaptive node creation.

## Current State

The orchestrator agent can:

- Create workflows from natural language descriptions
- Search for and add node templates
- Create connections between nodes
- Organize nodes into groups

## Enhancement Goals

### 1. Context-Aware Property Modification

**Objective**: Enable the agent to intelligently set node properties based on user context and intent.

**Implementation Steps**:

1. **Enhanced Intent Analysis**
   - Extend the intent extraction prompt to identify property requirements
   - Parse user requests for specific configuration needs (e.g., "fetch data every 5 minutes", "use POST method", "add authentication header")
2. **Property Mapping System**
   - Create a knowledge base of common property patterns
   - Map natural language descriptions to property values
   - Example mappings:
     ```
     "every 5 minutes" → { interval: 300000 }
     "with authentication" → { headers: { Authorization: "Bearer ${token}" } }
     "filter by status active" → { filter: { status: "active" } }
     ```

3. **Contextual Property Inference**
   - Analyze workflow context to infer missing properties
   - Use node connections to determine data formats
   - Apply sensible defaults based on node type and usage

### 2. Script Generation for Scriptable Nodes

**Objective**: Generate custom JavaScript/Python code for script nodes based on user requirements.

**Implementation Steps**:

1. **Script Template Library**
   - Create templates for common scripting patterns:
     - Data transformation (map, filter, reduce)
     - API request handling
     - Data validation
     - Custom business logic
2. **Code Generation Pipeline**
   - Analyze user intent to determine script requirements
   - Generate syntactically correct code with proper error handling
   - Include helpful comments and documentation
3. **Script Validation**
   - Validate generated scripts for syntax errors
   - Check for common security issues
   - Ensure proper input/output handling

### 3. Custom Script Nodes for Missing Templates

**Objective**: Use JavaScript Function nodes to implement functionality when no suitable template exists.

**Implementation Steps**:

1. **Template Gap Detection**
   - Identify when user needs don't match existing templates
   - Analyze the required functionality
   - Determine if a script node can fulfill the need

2. **Custom Node Generation**
   - Generate appropriate script code for the functionality
   - Configure proper inputs and outputs
   - Add meaningful node metadata (title, description)

3. **Template Suggestion System**
   - Track commonly created custom nodes
   - Suggest creating permanent templates for frequent patterns
   - Learn from user modifications to improve generation

## Technical Architecture

### 1. Enhanced Prompts

Create specialized prompts for:

- Property extraction and mapping
- Script generation with examples
- Custom node creation patterns

### 2. Knowledge Base

Build a structured knowledge base containing:

- Common property patterns and their mappings
- Script templates and examples
- Node behavior patterns and best practices

### 3. LLM Integration Strategy

- Use structured output formats (JSON) for property generation
- Implement multi-step reasoning for complex scripts
- Add validation loops for generated code

### 4. Testing and Validation

- Create test cases for property mapping
- Validate generated scripts against common patterns
- Test custom nodes in various workflow contexts

## Implementation Phases

### Phase 1: Property Modification (Week 1-2)

- [ ] Extend intent extraction for properties
- [ ] Build property mapping database
- [ ] Implement contextual property setting
- [ ] Add property validation

### Phase 2: Script Generation (Week 3-4)

- [ ] Create script template library
- [ ] Implement code generation prompts
- [ ] Add script validation system
- [ ] Test with common use cases

### Phase 3: Custom Node Creation (Week 5-6)

- [ ] Implement template gap detection
- [ ] Build custom node generator
- [ ] Create learning system for patterns
- [ ] Integration testing

### Phase 4: Fine-tuning and Optimization (Week 7-8)

- [ ] Collect usage data and feedback
- [ ] Refine prompts based on performance
- [ ] Optimize generation speed
- [ ] Document best practices

## Example Use Cases

### 1. Data Processing Workflow

**User**: "Create a workflow that fetches user data from our API every hour, filters active users, and sends a summary email"

**Agent Actions**:

- Add HTTP Request node with:
  - URL from context or request
  - Method: GET
  - Schedule: { interval: 3600000 }
- Add JavaScript Function node with filtering script:
  ```javascript
  return input.users.filter(user => user.status === 'active')
  ```
- Add Email node with template configuration

### 2. Custom Integration

**User**: "I need to process webhook data from Stripe and update our database"

**Agent Actions**:

- Detect no specific Stripe template exists
- Create JavaScript Function node:

  ```javascript
  // Stripe Webhook Processor
  const { event_type, data } = input

  switch (event_type) {
    case 'payment_intent.succeeded':
      return {
        action: 'update_payment',
        customer_id: data.object.customer,
        amount: data.object.amount,
        status: 'completed',
      }
    // ... more cases
  }
  ```

- Connect to database update node

### 3. Data Transformation

**User**: "Transform the CSV data to match our schema and validate email addresses"

**Agent Actions**:

- Add JavaScript Function node with:

  ```javascript
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  return input.rows
    .map(row => ({
      id: row[0],
      name: row[1],
      email: emailRegex.test(row[2]) ? row[2] : null,
      created_at: new Date().toISOString(),
    }))
    .filter(item => item.email !== null)
  ```

## Success Metrics

- Reduction in manual property configuration by 80%
- Successful script generation rate > 90%
- User satisfaction with generated solutions
- Decrease in workflow creation time by 60%

## Future Enhancements

- Support for multiple programming languages
- Advanced debugging capabilities
- Learning from user corrections
- Integration with external code libraries
- Visual script builder integration
