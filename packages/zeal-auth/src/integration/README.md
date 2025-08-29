# Zeal Authorization Integration Points

## Overview
This document outlines how the authorization framework integrates with various Zeal components.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Request                        │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  API Gateway Layer                        │
│  - Extract JWT/Token                                      │
│  - Rate Limiting                                          │
│  - Request Logging                                        │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│              Authorization Middleware                     │
│  - Token Validation                                       │
│  - Claims Extraction                                      │
│  - Context Building                                       │
│  - Policy Evaluation                                      │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  Service Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Workflow   │  │     Node     │  │  Execution   │  │
│  │   Service    │  │   Service    │  │   Service    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│                  Data Access Layer                        │
│  - Automatic Tenant Filtering                             │
│  - Row-Level Security                                     │
│  - Field-Level Masking                                    │
└───────────────────────────────────────────────────────────┘
```

## Integration Points

### 1. API Gateway Integration

**Location**: `/app/api/middleware/auth.ts`

```typescript
import { ZealAuth } from '@zeal/auth';

export const authMiddleware = async (req, res, next) => {
  const auth = req.app.locals.auth as ZealAuth;
  
  // Extract token
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  // Build resource context from request
  const resource = buildResourceFromRequest(req);
  const action = mapHttpMethodToAction(req.method);
  
  // Authorize
  const result = await auth.authorize(token, resource, action);
  
  if (!result.allowed) {
    return res.status(403).json({ 
      error: 'Access denied',
      reason: result.reason 
    });
  }
  
  // Attach auth context for downstream use
  req.authContext = {
    subject: result.subject,
    constraints: result.constraints,
    obligations: result.obligations
  };
  
  next();
};
```

### 2. Workflow Service Integration

**Location**: `/app/api/workflow/service.ts`

```typescript
class WorkflowService {
  async createWorkflow(data: CreateWorkflowDto, authContext: AuthContext) {
    // Check if user can create workflows
    const canCreate = await this.auth.authorize(
      authContext.subject,
      { type: 'workflow', ...data },
      'create'
    );
    
    if (!canCreate.allowed) {
      throw new ForbiddenError(canCreate.reason);
    }
    
    // Apply constraints (e.g., forced tenant assignment)
    const workflow = {
      ...data,
      tenantId: authContext.subject.tenantId,
      organizationId: authContext.subject.organizationId,
      ownerId: authContext.subject.id,
      visibility: canCreate.constraints?.defaultVisibility || 'private'
    };
    
    return this.repository.create(workflow);
  }
  
  async listWorkflows(authContext: AuthContext) {
    // Get base query
    let query = this.repository.createQuery();
    
    // Apply authorization filters
    const listAuth = await this.auth.authorize(
      authContext.subject,
      { type: 'workflow' },
      'list'
    );
    
    if (listAuth.constraints?.filters) {
      query = this.applyFilters(query, listAuth.constraints.filters);
    }
    
    // Automatic tenant isolation
    if (authContext.subject.tenantId) {
      query.where('tenantId', authContext.subject.tenantId);
    }
    
    // Apply field-level restrictions
    if (listAuth.constraints?.fields) {
      query.select(listAuth.constraints.fields);
    }
    
    return query.execute();
  }
}
```

### 3. Node Service Integration

**Location**: `/app/api/node/service.ts`

```typescript
class NodeService {
  async validateNodeUsage(
    nodeType: string, 
    nodeConfig: any, 
    authContext: AuthContext
  ) {
    // Check node permissions
    const nodeAuth = await this.auth.authorizeNode(
      authContext.subject,
      nodeType,
      nodeConfig
    );
    
    if (!nodeAuth.allowed) {
      throw new ForbiddenError(
        `Cannot use node type '${nodeType}': ${nodeAuth.reason}`
      );
    }
    
    // Apply node restrictions
    if (nodeAuth.restrictions) {
      this.validateRestrictions(nodeConfig, nodeAuth.restrictions);
    }
    
    return true;
  }
  
  async getAvailableNodes(authContext: AuthContext) {
    const allNodes = await this.repository.getAllNodeTemplates();
    
    // Filter based on user permissions
    const availableNodes = [];
    for (const node of allNodes) {
      const canUse = await this.auth.authorizeNode(
        authContext.subject,
        node.type
      );
      
      if (canUse.allowed) {
        availableNodes.push({
          ...node,
          restrictions: canUse.restrictions
        });
      }
    }
    
    return availableNodes;
  }
}
```

### 4. Execution Service Integration

**Location**: `/app/api/execution/service.ts`

```typescript
class ExecutionService {
  async executeWorkflow(
    workflowId: string,
    input: any,
    authContext: AuthContext
  ) {
    const workflow = await this.workflowService.get(workflowId);
    
    // Check execution permission
    const canExecute = await this.auth.authorize(
      authContext.subject,
      { 
        type: 'workflow',
        id: workflowId,
        ...workflow 
      },
      'execute'
    );
    
    if (!canExecute.allowed) {
      throw new ForbiddenError(canExecute.reason);
    }
    
    // Validate all nodes in workflow
    for (const node of workflow.nodes) {
      await this.nodeService.validateNodeUsage(
        node.type,
        node.config,
        authContext
      );
    }
    
    // Apply execution constraints
    const executionConfig = {
      ...input,
      constraints: canExecute.constraints,
      metadata: {
        executedBy: authContext.subject.id,
        executedAt: new Date(),
        authContext: authContext
      }
    };
    
    // Execute with audit trail
    return this.engine.execute(workflow, executionConfig);
  }
}
```

### 5. WebSocket/Real-time Integration

**Location**: `/app/api/websocket/auth.ts`

```typescript
class WebSocketAuth {
  async handleConnection(socket: Socket) {
    const token = socket.handshake.auth.token;
    
    // Validate token
    const authResult = await this.auth.validateToken(token);
    if (!authResult.valid) {
      socket.disconnect();
      return;
    }
    
    // Subscribe to authorized channels only
    const channels = await this.getAuthorizedChannels(
      authResult.subject
    );
    
    channels.forEach(channel => {
      socket.join(channel);
    });
    
    // Filter outgoing messages
    socket.use(async (packet, next) => {
      const [event, data] = packet;
      
      // Check if user can receive this event
      const canReceive = await this.auth.authorize(
        authResult.subject,
        { type: 'event', name: event },
        'receive'
      );
      
      if (canReceive.allowed) {
        // Apply data filtering if needed
        if (canReceive.constraints?.filters) {
          packet[1] = this.applyFilters(data, canReceive.constraints.filters);
        }
        next();
      }
    });
  }
}
```

### 6. Database Integration

**Location**: `/packages/zeal-auth/src/integration/database.ts`

```typescript
export class AuthorizedRepository<T> {
  constructor(
    private repository: Repository<T>,
    private auth: ZealAuth
  ) {}
  
  async find(
    criteria: any,
    authContext: AuthContext
  ): Promise<T[]> {
    // Apply authorization filters
    const authResult = await this.auth.authorize(
      authContext.subject,
      { type: this.repository.entityType },
      'read'
    );
    
    if (!authResult.allowed) {
      return [];
    }
    
    // Merge auth constraints with query criteria
    const authorizedCriteria = {
      ...criteria,
      ...(authResult.constraints?.filters || {})
    };
    
    // Add tenant isolation
    if (authContext.subject.tenantId) {
      authorizedCriteria.tenantId = authContext.subject.tenantId;
    }
    
    // Execute query
    let results = await this.repository.find(authorizedCriteria);
    
    // Apply field-level filtering
    if (authResult.constraints?.fields) {
      results = this.filterFields(results, authResult.constraints.fields);
    }
    
    return results;
  }
  
  async save(
    entity: T,
    authContext: AuthContext
  ): Promise<T> {
    // Check write permission
    const authResult = await this.auth.authorize(
      authContext.subject,
      { 
        type: this.repository.entityType,
        ...entity 
      },
      entity.id ? 'update' : 'create'
    );
    
    if (!authResult.allowed) {
      throw new ForbiddenError(authResult.reason);
    }
    
    // Apply mandatory fields
    const authorizedEntity = {
      ...entity,
      tenantId: authContext.subject.tenantId,
      lastModifiedBy: authContext.subject.id,
      lastModifiedAt: new Date()
    };
    
    return this.repository.save(authorizedEntity);
  }
}
```

### 7. GraphQL Integration

**Location**: `/app/api/graphql/directives.ts`

```typescript
import { SchemaDirectiveVisitor } from '@graphql-tools/utils';

export class AuthDirective extends SchemaDirectiveVisitor {
  visitFieldDefinition(field: any) {
    const { resolve = defaultFieldResolver } = field;
    const { resource, action } = this.args;
    
    field.resolve = async function (...args: any[]) {
      const [, , context] = args;
      
      // Get auth context from GraphQL context
      const authContext = context.auth;
      if (!authContext) {
        throw new Error('Not authenticated');
      }
      
      // Authorize based on directive arguments
      const authResult = await context.authService.authorize(
        authContext.subject,
        { type: resource },
        action
      );
      
      if (!authResult.allowed) {
        throw new ForbiddenError(authResult.reason);
      }
      
      // Call original resolver with auth context
      context.authResult = authResult;
      return resolve.apply(this, args);
    };
  }
}

// Usage in schema
const typeDefs = `
  type Query {
    workflows: [Workflow!]! @auth(resource: "workflow", action: "list")
    workflow(id: ID!): Workflow @auth(resource: "workflow", action: "read")
  }
  
  type Mutation {
    createWorkflow(input: CreateWorkflowInput!): Workflow! 
      @auth(resource: "workflow", action: "create")
    
    executeWorkflow(id: ID!, input: JSON): ExecutionResult!
      @auth(resource: "workflow", action: "execute")
  }
`;
```

### 8. CLI Integration

**Location**: `/packages/zeal-cli/src/auth.ts`

```typescript
export class CLIAuth {
  async authenticate(): Promise<AuthContext> {
    // Try multiple auth methods
    let token = process.env.ZEAL_API_TOKEN;
    
    if (!token) {
      // Try to read from config file
      token = await this.readTokenFromConfig();
    }
    
    if (!token) {
      // Interactive login
      token = await this.interactiveLogin();
    }
    
    // Validate and extract claims
    const claims = await this.validateToken(token);
    
    return {
      subject: this.buildSubject(claims),
      token
    };
  }
  
  async executeWithAuth<T>(
    fn: (auth: AuthContext) => Promise<T>
  ): Promise<T> {
    const auth = await this.authenticate();
    
    try {
      return await fn(auth);
    } catch (error) {
      if (error.code === 'FORBIDDEN') {
        console.error('Access denied:', error.message);
        console.error('Required permissions:', error.requiredPermissions);
        process.exit(1);
      }
      throw error;
    }
  }
}
```

## Testing Integration

```typescript
// Integration test example
describe('Authorization Integration', () => {
  it('should enforce tenant isolation', async () => {
    const tenant1User = createAuthContext({ tenantId: 'tenant1' });
    const tenant2User = createAuthContext({ tenantId: 'tenant2' });
    
    // Create workflow as tenant1
    const workflow = await workflowService.create(
      { name: 'Test' },
      tenant1User
    );
    
    // Try to access as tenant2 - should fail
    await expect(
      workflowService.get(workflow.id, tenant2User)
    ).rejects.toThrow(ForbiddenError);
  });
  
  it('should restrict node usage based on roles', async () => {
    const regularUser = createAuthContext({ roles: ['user'] });
    const adminUser = createAuthContext({ roles: ['admin'] });
    
    // Regular user cannot use system_command node
    await expect(
      nodeService.validateNodeUsage('system_command', {}, regularUser)
    ).rejects.toThrow(ForbiddenError);
    
    // Admin can use it
    await expect(
      nodeService.validateNodeUsage('system_command', {}, adminUser)
    ).resolves.toBe(true);
  });
});
```