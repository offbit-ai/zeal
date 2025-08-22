# GraphRAG LLM-Based Design

## Overview

The GraphRAG system has been redesigned to use LLM for intelligent extraction of services, capabilities, and relationships. This eliminates hardcoding and creates a more flexible, scalable system.

## Architecture

### 1. Build-Time Analysis

GraphRAG analysis happens at **build time**, not runtime:

```bash
# Development build (uses mock LLM)
npm run graphrag:build

# Production build with real LLM
OPENROUTER_API_KEY=your-key npm run graphrag:build:llm

# Force rebuild
npm run graphrag:build:force
```

### 2. Snapshot System

The LLM analysis creates a **snapshot** that is reused:

```
Build Time:
Templates → LLM Analysis → Knowledge Graph → Snapshot (JSON)

Runtime:
Snapshot → Load Graph → GraphRAG Engine → Node Selection
```

Benefits:
- No repeated LLM calls at runtime
- Consistent results across deployments
- Fast initialization (< 100ms)
- Version control for graph evolution

### 3. LLM Analysis Process

The `LLMGraphBuilder` performs intelligent analysis:

#### Service Extraction
```typescript
// LLM analyzes each template to identify services
"Analyze these templates and identify external services..."
→ Returns: ["slack", "github", "openai"]
```

#### Capability Extraction
```typescript
// LLM identifies what each node can do
"What capabilities does this template provide..."
→ Returns: ["send_message", "receive_webhook", "transform_data"]
```

#### Connection Analysis
```typescript
// LLM determines which nodes can connect
"Which of these templates can connect to each other..."
→ Returns: [{"from": "github_webhook", "to": "data_transformer", "confidence": 0.9}]
```

### 4. No Hardcoding

Instead of hardcoded patterns:
```typescript
// ❌ OLD: Hardcoded
if (text.includes('slack')) {
  services.push('slack')
}

// ✅ NEW: LLM decides
const analysis = await llm.invoke(
  `Identify services in: ${template.description}`
)
```

## Implementation Details

### LLMGraphBuilder

Located in `/lib/knowledge-graph/llm-graph-builder.ts`:

1. **Batch Analysis**: Processes templates in batches to avoid token limits
2. **Entity Extraction**: Uses LLM to extract unique services and capabilities
3. **Relationship Building**: LLM determines connections and alternatives
4. **Snapshot Saving**: Persists the graph for reuse

### Build Scripts

1. **Unified Build** (`/scripts/build-graphrag.js`):
   - Automatically uses OpenRouter LLM if `OPENROUTER_API_KEY` is set
   - Falls back to mock LLM if no API key (for development)
   - Production-ready by default

2. **Explicit Production Build** (`/scripts/build-graphrag-prod.js`):
   - Forces use of OpenRouter API
   - Requires `OPENROUTER_API_KEY`
   - Fails if API key is not provided

### Snapshot Format

```json
{
  "nodes": [
    {
      "id": "tpl_slack_webhook",
      "attributes": {
        "type": "template",
        "data": {
          "title": "Slack Webhook",
          "services": ["slack"],
          "capabilities": ["send_message"]
        }
      }
    }
  ],
  "edges": [
    {
      "source": "tpl_github_webhook",
      "target": "tpl_slack_webhook",
      "attributes": {
        "type": "CAN_CONNECT_TO",
        "data": { "confidence": 0.9 }
      }
    }
  ],
  "metadata": {
    "createdAt": "2024-01-01T00:00:00Z",
    "templateCount": 150,
    "version": "1.0.0"
  }
}
```

## Production Configuration

### Environment Variables

```bash
# Required for production
OPENROUTER_API_KEY=sk-or-v1-...      # OpenRouter API key
OPENROUTER_MODEL=anthropic/claude-3.7-sonnet  # Optional: LLM model

# Embedding service (production)
EMBEDDING_VENDOR=openai               # Use real embeddings
EMBEDDING_API_KEY=sk-proj-...        # OpenAI API key
EMBEDDING_MODEL=text-embedding-3-small

# Development fallbacks (automatic)
EMBEDDING_VENDOR=mock                 # When no API key
```

### Client-Side Integration

The ChatInterface now uses:
- **Real LLM**: OpenRouter API via fetch (no mock)
- **Real Embeddings**: EmbeddingService.fromEnvironment()
- **Production GraphRAG**: Loads pre-built snapshot

## Usage

### 1. Initial Setup

```bash
# Install dependencies
npm install

# Build GraphRAG snapshot (uses real LLM if OPENROUTER_API_KEY is set)
npm run graphrag:build

# Force LLM build (fails without API key)
OPENROUTER_API_KEY=sk-... npm run graphrag:build:llm
```

### 2. Development Workflow

```bash
# Start dev environment (includes GraphRAG build)
./start-dev.sh

# Force rebuild after template changes
./start-dev.sh --reingest
```

### 3. Production Deployment

```bash
# Build everything including GraphRAG
npm run build

# The snapshot is included in the build
# Client loads from /public/graphrag-snapshot.json
```

## LLM Prompts

### Service Extraction Prompt
```
Analyze these node templates and extract their services...
For each template, identify:
1. What external services it integrates with
2. What capabilities it provides
3. What type of data it accepts and outputs
```

### Connection Analysis Prompt
```
Analyze which of these node templates can connect...
Consider their inputs/outputs and data flow compatibility.
Return connections with confidence scores.
```

## Benefits

1. **No Hardcoding**: Services and capabilities are discovered, not predefined
2. **Scalability**: Works with thousands of templates
3. **Flexibility**: New services are automatically recognized
4. **Intelligence**: LLM understands context and relationships
5. **Performance**: Build-time analysis, runtime efficiency

## Future Enhancements

1. **Incremental Updates**: Only analyze new/changed templates
2. **Multi-LLM Support**: Use different models for different analyses
3. **Confidence Scoring**: Track LLM confidence in extractions
4. **Version Migration**: Upgrade snapshots between versions
5. **A/B Testing**: Compare different LLM analyses

## Troubleshooting

### GraphRAG Not Building

1. Check if templates are ingested:
   ```bash
   npm run templates:ingest
   ```

2. Try force rebuild:
   ```bash
   npm run graphrag:build:force
   ```

3. Check for LLM errors:
   ```bash
   OPENROUTER_API_KEY=... npm run graphrag:build:llm
   ```

### Snapshot Not Found

1. Ensure build completed:
   ```bash
   ls data/graphrag-snapshot.json
   ls public/graphrag-snapshot.json
   ```

2. Check build logs for errors

3. Try manual build:
   ```bash
   node scripts/build-graphrag.js
   ```

### Wrong Services Detected

1. Use production LLM build for better accuracy
2. Check template descriptions are clear
3. Review LLM analysis in snapshot file
4. Consider prompt engineering improvements

## Key Design Principles

1. **No Hardcoding**: All relationships discovered by LLM
2. **Production-Ready**: Real services used by default
3. **Build-Time Analysis**: One-time LLM cost, runtime efficiency
4. **Flexible Categories**: LLM determines which categories connect
5. **Real Integrations**: Uses existing OpenRouter and embedding services