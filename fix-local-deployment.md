# Local Deployment Fixes Documentation

## Database Column Mapping Fixes

### Problem
The application was experiencing 500 errors on API calls because:
1. Database schema uses snake_case column names (e.g., `created_at`, `user_id`)
2. Application code was using camelCase names (e.g., `createdAt`, `userId`)
3. PostgREST was returning errors like "Could not find the 'createdAt' column"

### Solution Applied

#### 1. Created Column Mapping Module
File: `lib/database/column-mapping.ts`
- Maps between camelCase (application) and snake_case (database)
- Provides helper functions for workflows and workflow versions

#### 2. Updated Supabase Operations
File: `lib/database/supabase-operations.ts`
- Applied column mapping consistently throughout all operations
- Fixed field names in queries (e.g., `user_id` instead of `userId`)
- Used mapping functions for all insert/update/select operations

### Key Changes:
```typescript
// Before
query = query.eq('userId', params.userId)
query = query.order('updatedAt', { ascending: false })

// After  
query = query.eq('user_id', params.userId)
query = query.order('updated_at', { ascending: false })
```

## JWT Token Updates

### New JWT Tokens Generated
- **JWT Secret**: `your-super-secret-jwt-token-with-at-least-32-characters-long`
- **Anon Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjIwNjk3OTA1OTgsImlhdCI6MTc1NDQzMDU5OH0.L6odhxPbMcLeEqiFXIIZbC0cNGQjcc8n9vnZNXLSiRo`
- **Service Role Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA2OTc5MDU5OCwiaWF0IjoxNzU0NDMwNTk4fQ.Zpmigdx8mkloUQhtD-ZtwKWp9LmmbgSbHXU45KSqOHA`

### Files Updated with New Tokens:
1. `k8s/supabase-minimal.yaml` - Supabase ConfigMap
2. `scripts/minikube-quick-setup.sh` - Default environment variables
3. K8s secrets (via kubectl)

## Supabase-Compliant Database Schema

### Created New Schema
File: `supabase-init.sql`
- Uses snake_case naming convention
- Includes proper indexes and constraints
- Has Row Level Security (RLS) policies
- Creates required database roles

### Key Tables:
- `workflows` - Main workflow records
- `workflow_versions` - Version history
- `workflow_executions` - Execution logs
- `workflow_snapshots` - Autosave snapshots
- `env_vars` - Environment variables
- `flow_trace_sessions` - Flow tracing
- `flow_traces` - Individual trace records

## Deployment Steps

### To Apply These Fixes:

1. **Rebuild Docker Image** (if code changes not yet in image):
   ```bash
   docker build -t localhost:5001/zeal-nextjs:latest -f Dockerfile .
   docker push localhost:5001/zeal-nextjs:latest
   ```

2. **Update Deployment**:
   ```bash
   kubectl rollout restart deployment/nextjs-deployment -n zeal
   ```

3. **Verify PostgREST Schema Cache**:
   ```bash
   kubectl rollout restart deployment/supabase-rest -n zeal
   ```

### Verification:
Test the API endpoints:
```bash
# Create workflow
curl -X POST http://zeal.local:8080/api/workflows \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>" \
  -d '{"name": "Test", "graphs": [{"id": "main", "nodes": [], "connections": []}]}'

# Get workflow
curl http://zeal.local:8080/api/workflows/<workflow-id> \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```

## Important Notes

1. The fixes are reflected in:
   - Source code (column mappings)
   - Deployment scripts (JWT tokens)
   - Database schema (snake_case)

2. When deploying to production:
   - Generate new secure JWT tokens
   - Update all references to these tokens
   - Ensure database migrations are applied

3. The column mapping ensures compatibility between:
   - Application code (camelCase)
   - Database schema (snake_case)
   - API responses (camelCase)