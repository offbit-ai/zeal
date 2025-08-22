# GraphRAG Secure Backend Implementation

## Overview

All API keys and LLM calls have been moved to the backend to ensure security. The frontend no longer has access to any API keys.

## Architecture

### Backend API Endpoints

1. **`/api/graphrag/initialize`**
   - GET: Check if GraphRAG snapshot exists
   - POST: Initialize GraphRAG on server (not used in production)

2. **`/api/orchestrator/intent`**
   - POST: Extract workflow intent from user query
   - Uses OpenRouter API on server-side
   - Returns structured intent JSON

3. **`/api/orchestrator/llm`**
   - POST: General-purpose LLM endpoint
   - Handles all LLM calls from OrchestratorAgent
   - Server-side OpenRouter integration

### Security Model

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Browser   │────▶│  Next.js    │────▶│  OpenRouter  │
│   (No Keys) │     │   Backend   │     │     API      │
└─────────────┘     └─────────────┘     └──────────────┘
                           │
                           ├── OPENROUTER_API_KEY
                           ├── EMBEDDING_API_KEY
                           └── Other secrets
```

## Implementation Details

### 1. Frontend Changes

**ChatInterface.tsx:**
```typescript
// Backend LLM wrapper - no API keys exposed
const backendLLM = {
  invoke: async (prompt: string) => {
    if (prompt.includes('Extract the workflow intent')) {
      // Use dedicated intent endpoint
      const response = await fetch('/api/orchestrator/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      })
      return JSON.stringify(data.intent)
    }
    return '{}'
  }
}
```

### 2. OrchestratorAgent Changes

**Conditional API calls:**
```typescript
private async callLLM(messages: Array<{ role: string; content: string }>): Promise<string> {
  if (typeof window !== 'undefined') {
    // Client-side: use backend API
    const response = await fetch('/api/orchestrator/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    })
  } else {
    // Server-side: direct OpenRouter call
    // Only on server where API key is available
  }
}
```

### 3. Environment Variables

**Server-side only (in .env.local):**
```bash
# Backend API keys - NEVER prefix with NEXT_PUBLIC_
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=anthropic/claude-3.7-sonnet
EMBEDDING_VENDOR=openai
EMBEDDING_API_KEY=sk-proj-...
```

**Client-side safe:**
```bash
# These are safe to expose
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_CRDT_SERVER_URL=ws://localhost:8080
```

## GraphRAG Flow

### Build Time
1. `npm run graphrag:build` runs on server
2. Uses `OPENROUTER_API_KEY` from environment
3. Creates snapshot at `/data/graphrag-snapshot.json`
4. Copies to `/public/graphrag-snapshot.json` for client

### Runtime
1. Client loads GraphRAG snapshot (no LLM needed)
2. Intent extraction calls `/api/orchestrator/intent`
3. Other LLM needs call `/api/orchestrator/llm`
4. All API keys stay on server

## Security Benefits

1. **No API Key Exposure**: Keys never reach the browser
2. **Rate Limiting**: Can implement server-side rate limits
3. **Access Control**: Can add authentication to API routes
4. **Audit Trail**: Server can log all LLM usage
5. **Key Rotation**: Can update keys without client changes

## Production Deployment

### Vercel/Next.js Deployment

1. Set environment variables in Vercel dashboard:
   ```
   OPENROUTER_API_KEY=sk-or-v1-...
   EMBEDDING_API_KEY=sk-proj-...
   DATABASE_URL=postgresql://...
   ```

2. Build process automatically:
   - Ingests templates
   - Builds GraphRAG with LLM
   - Creates optimized production build

3. Runtime:
   - API routes handle all LLM calls
   - No keys in browser JavaScript

### Docker Deployment

```dockerfile
# Set build args for GraphRAG generation
ARG OPENROUTER_API_KEY
ENV OPENROUTER_API_KEY=$OPENROUTER_API_KEY

# Build includes GraphRAG
RUN npm run build

# Runtime doesn't expose keys
ENV OPENROUTER_API_KEY=""
```

## Testing

### Verify Security

1. Check browser DevTools Network tab:
   - No requests to openrouter.ai directly
   - All LLM calls go through /api/orchestrator/*

2. Check browser Sources:
   - Search for "sk-" - should find nothing
   - No API keys in JavaScript bundles

3. Test API endpoints:
   ```bash
   # Should work
   curl -X POST http://localhost:3000/api/orchestrator/intent \
     -H "Content-Type: application/json" \
     -d '{"query": "Create Slack notification workflow"}'
   ```

## Monitoring

Add logging to track API usage:

```typescript
// In API routes
console.log({
  endpoint: '/api/orchestrator/llm',
  timestamp: new Date().toISOString(),
  userAgent: request.headers.get('user-agent'),
  // Don't log sensitive data
})
```

## Future Enhancements

1. **Authentication**: Add user auth to API routes
2. **Rate Limiting**: Implement per-user rate limits
3. **Caching**: Cache common LLM responses
4. **Webhooks**: Real-time updates via webhooks
5. **Analytics**: Track usage patterns