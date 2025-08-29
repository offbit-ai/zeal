# Zeal Authorization Framework

A comprehensive, decoupled authorization framework for the Zeal platform that supports multi-tenancy, ABAC (Attribute-Based Access Control), and policy-driven permissions.

## Features

- **Decoupled Architecture**: Works with any external identity provider without coupling
- **Policy-Driven**: Define authorization rules through configuration, not code
- **Multi-Tenant Support**: Built-in tenant isolation and cross-tenant access control
- **ABAC & RBAC**: Supports both attribute and role-based access control
- **Hierarchical Permissions**: Organization → Team → User permission inheritance
- **Resource-Level Security**: Fine-grained control over resources and actions
- **Field-Level Security**: Control which fields users can read/write
- **Caching**: Built-in caching layer for performance
- **Audit Trail**: Comprehensive audit logging of all authorization decisions
- **Framework Agnostic**: Works with Express, Fastify, Koa, Next.js, and more

## Installation

```bash
npm install @zeal/auth
```

## Quick Start

### 1. Configure the Authorization Framework

```typescript
import { ZealAuth } from '@zeal/auth';

const auth = new ZealAuth({
  providers: [{
    id: 'primary',
    type: 'jwt',
    issuer: 'https://auth.example.com',
    jwksUri: 'https://auth.example.com/.well-known/jwks.json'
  }],
  
  claimMappings: {
    subject: {
      id: 'sub',
      type: 'type'
    },
    tenant: 'tenant_id',
    organization: 'org_id',
    roles: 'roles',
    teams: 'teams'
  },
  
  hierarchy: {
    enabled: true,
    providers: [{
      type: 'api',
      config: {
        endpoint: 'https://api.example.com/hierarchy'
      }
    }]
  },
  
  policies: {
    sources: [{
      type: 'file',
      location: './auth-policies.yaml'
    }],
    evaluationStrategy: 'priority',
    defaultEffect: 'deny'
  },
  
  cache: {
    enabled: true,
    ttl: 300
  },
  
  audit: {
    enabled: true,
    providers: [{
      type: 'file',
      path: './audit.log'
    }]
  }
});
```

### 2. Use with Express

```typescript
import express from 'express';
import { createExpressMiddleware } from '@zeal/auth';

const app = express();

// Apply to all routes
app.use(createExpressMiddleware(auth));

// Or use specific middleware
app.get('/workflows', 
  auth.middleware(),
  async (req, res) => {
    // Access auth context
    const { subject, constraints } = req.auth;
    
    // Apply constraints to query
    const workflows = await getWorkflows(subject.tenantId);
    const filtered = auth.applyConstraints(workflows, constraints);
    
    res.json(filtered);
  }
);
```

### 3. Define Policies

Create `auth-policies.yaml`:

```yaml
policies:
  - id: tenant-isolation
    name: Tenant Isolation
    priority: 100
    effect: deny
    conditions:
      - type: all
        rules:
          - attribute: resource.tenantId
            operator: notEquals
            value: "{{subject.tenantId}}"
            
  - id: admin-full-access
    name: Admin Full Access
    priority: 90
    effect: allow
    conditions:
      - type: any
        rules:
          - attribute: subject.roles
            operator: contains
            value: admin
            
  - id: workflow-owner-access
    name: Workflow Owner Access
    priority: 80
    effect: allow
    conditions:
      - type: all
        rules:
          - attribute: resource.type
            operator: equals
            value: workflow
          - attribute: resource.ownerId
            operator: equals
            value: "{{subject.id}}"
```

## Advanced Usage

### Custom Claim Mapping

```typescript
const auth = new ZealAuth({
  claimMappings: {
    subject: {
      id: ['sub', 'user_id', 'email'],
      type: 'user_type'
    },
    tenant: ['tenant', 'company_id'],
    organization: 'organization.id',
    teams: 'user.teams[*].id',
    custom: {
      department: 'user.department',
      clearanceLevel: 'security.clearance'
    }
  }
});
```

### TypeScript Decorators

```typescript
import { RequireAuth, RequireRole, AuthorizeResource } from '@zeal/auth';

class WorkflowController {
  @RequireAuth(auth)
  @RequireRole('admin', 'manager')
  async createWorkflow(req: Request) {
    // Only admins and managers can access
  }
  
  @AuthorizeResource(auth, 'workflow', 'read')
  async getWorkflow(req: Request) {
    // Automatically checks workflow read permission
  }
}
```

### Programmatic Authorization

```typescript
// Simple authorization
const result = await auth.authorize(
  token,
  { type: 'workflow', id: '123' },
  'read'
);

if (!result.allowed) {
  throw new Error(result.reason);
}

// Node authorization
const nodeAuth = await auth.authorizeNode(
  subject,
  'system_command',
  { command: 'rm -rf' }
);

// Sharing authorization
const shareAuth = await auth.authorizeSharing(
  subject,
  workflow,
  'team-123',
  'team'
);
```

### Field-Level Security

```typescript
const result = await auth.authorize(token, resource, 'read');

if (result.constraints?.fields) {
  // Only return allowed fields
  const filtered = result.constraints.fields.reduce((obj, field) => {
    obj[field] = resource[field];
    return obj;
  }, {});
}
```

### Audit Queries

```typescript
// Query audit logs
const logs = await auth.audit.query({
  subjectId: 'user-123',
  resourceType: 'workflow',
  startTime: new Date('2024-01-01'),
  result: 'denied',
  limit: 100
});

// Generate reports
const report = await auth.audit.generateReport(
  new Date('2024-01-01'),
  new Date('2024-01-31'),
  'subject'
);
```

## Integration Examples

### GraphQL

```typescript
import { AuthDirective } from '@zeal/auth/graphql';

const typeDefs = `
  type Query {
    workflows: [Workflow!]! @auth(resource: "workflow", action: "list")
    workflow(id: ID!): Workflow @auth(resource: "workflow", action: "read")
  }
`;

const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
  schemaDirectives: {
    auth: AuthDirective
  }
});
```

### WebSocket

```typescript
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  
  const result = await auth.authorize(
    token,
    { type: 'websocket' },
    'connect'
  );
  
  if (!result.allowed) {
    return next(new Error('Unauthorized'));
  }
  
  socket.data.auth = result;
  next();
});
```

### Database Integration

```typescript
import { AuthorizedRepository } from '@zeal/auth/database';

const workflowRepo = new AuthorizedRepository(
  prisma.workflow,
  auth
);

// Automatically applies tenant isolation and constraints
const workflows = await workflowRepo.find(
  { status: 'active' },
  authContext
);
```

## Node Permissions

Control which nodes users can use in workflows:

```yaml
nodePermissions:
  - nodeType: system_command
    requiredRoles: [admin]
    restrictions:
      - property: command
        deniedValues: [rm, del, format]
        
  - nodeType: http_request
    requiredPermissions: [external_api.access]
    restrictions:
      - property: url
        validator: isInternalUrl
        
  - nodeType: database_query
    requiredRoles: [developer, admin]
    allowedTenants: [premium, enterprise]
```

## Performance Considerations

### Caching

```typescript
const auth = new ZealAuth({
  cache: {
    enabled: true,
    provider: {
      type: 'redis',
      url: 'redis://localhost:6379'
    },
    ttl: 300,
    keyHashAlgorithm: 'sha256'
  }
});
```

### Hierarchy Resolution

```typescript
// Pre-load hierarchy for better performance
await auth.hierarchyResolver.warmup([
  { organizationId: 'org-1' },
  { teamId: 'team-1' }
]);
```

## Testing

```typescript
import { createMockAuth } from '@zeal/auth/testing';

describe('WorkflowService', () => {
  const auth = createMockAuth({
    defaultSubject: {
      id: 'test-user',
      tenantId: 'test-tenant',
      roles: ['user']
    }
  });
  
  it('should enforce tenant isolation', async () => {
    const result = await auth.authorize(
      { tenantId: 'other-tenant' },
      { type: 'workflow', tenantId: 'test-tenant' },
      'read'
    );
    
    expect(result.allowed).toBe(false);
  });
});
```

## License

Apache License 2.0