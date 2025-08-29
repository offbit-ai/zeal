/**
 * Advanced ZealAuth Usage Examples
 * Direct use of the ZealAuth authorization engine for complex scenarios
 */

import { getAuth, requireAuth } from '@/lib/auth';
import { Resource, Subject, Policy, AuthorizationContext } from '@offbit-ai/zeal-auth';
import { NextRequest, NextResponse } from 'next/server';

// ========================================
// 1. BATCH AUTHORIZATION CHECKS
// ========================================

export async function checkMultipleResources(token: string) {
  const auth = requireAuth();
  
  // Extract subject from token
  const subject = await auth.contextBuilder.extractSubject(token);
  
  // Define resources to check
  const resources: Resource[] = [
    { type: 'workflow', id: 'wf-123', attributes: { owner: 'user-456' } },
    { type: 'workflow', id: 'wf-789', attributes: { owner: subject.id } },
    { type: 'node_template', id: 'nt-premium', attributes: { tier: 'premium' } },
    { type: 'orchestrator', id: 'orch-1', attributes: { type: 'ai-agent' } }
  ];
  
  // Batch authorize all resources
  const results = await Promise.all(
    resources.map(resource => 
      auth.authorize(subject, resource, 'read')
    )
  );
  
  // Return accessible resources
  return resources.filter((_, index) => results[index].allowed);
}

// ========================================
// 2. DYNAMIC POLICY EVALUATION
// ========================================

export async function evaluateCustomPolicy(
  token: string,
  customPolicy: Policy
) {
  const auth = requireAuth();
  
  // Add temporary policy for this request
  auth.policyEngine.addPolicy(customPolicy);
  
  try {
    // Evaluate with the custom policy
    const result = await auth.authorize(
      token,
      { type: 'workflow', id: 'temp' },
      'execute'
    );
    
    return {
      allowed: result.allowed,
      matchedPolicy: result.matchedPolicies?.[0],
      reason: result.reason
    };
  } finally {
    // Remove the temporary policy
    auth.policyEngine.removePolicy(customPolicy.id);
  }
}

// ========================================
// 3. HIERARCHICAL PERMISSION RESOLUTION
// ========================================

export async function resolveHierarchicalPermissions(
  token: string,
  organizationId: string
) {
  const auth = requireAuth();
  const subject = await auth.contextBuilder.extractSubject(token);
  
  // Get user's position in hierarchy
  const hierarchy = await auth.hierarchyProvider?.getHierarchy(
    subject.id,
    organizationId
  );
  
  if (!hierarchy) {
    return { permissions: [], inheritedFrom: [] };
  }
  
  // Resolve permissions through hierarchy
  const permissions = new Set<string>();
  const inheritedFrom: string[] = [];
  
  // Start from user's direct permissions
  if (subject.permissions) {
    subject.permissions.forEach(p => permissions.add(p));
  }
  
  // Add team permissions
  for (const team of hierarchy.teams || []) {
    const teamPermissions = await auth.hierarchyProvider?.getTeamPermissions(team.id);
    teamPermissions?.forEach(p => {
      permissions.add(p);
      inheritedFrom.push(`team:${team.name}`);
    });
  }
  
  // Add role permissions
  for (const role of subject.roles || []) {
    const rolePermissions = await auth.policyEngine.getRolePermissions(role);
    rolePermissions?.forEach(p => {
      permissions.add(p);
      inheritedFrom.push(`role:${role}`);
    });
  }
  
  return {
    permissions: Array.from(permissions),
    inheritedFrom: [...new Set(inheritedFrom)]
  };
}

// ========================================
// 4. CONTEXT-AWARE AUTHORIZATION
// ========================================

export async function authorizeWithContext(
  req: NextRequest,
  resource: Resource,
  action: string
) {
  const auth = requireAuth();
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || '';
  
  // Build rich context for authorization
  const context: AuthorizationContext = {
    request: {
      ip: req.headers.get('x-forwarded-for') || 
          req.headers.get('x-real-ip') || 
          'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      method: req.method,
      path: req.nextUrl.pathname,
      referer: req.headers.get('referer')
    },
    environment: {
      type: process.env.NODE_ENV,
      region: process.env.REGION || 'us-east-1',
      deployment: process.env.DEPLOYMENT_TYPE || 'standard'
    },
    temporal: {
      timestamp: new Date(),
      dayOfWeek: new Date().getDay(),
      hour: new Date().getHours(),
      isBusinessHours: isBusinessHours()
    },
    attributes: {
      // Custom attributes from request
      apiVersion: req.headers.get('api-version') || 'v1',
      clientId: req.headers.get('x-client-id'),
      sessionId: req.headers.get('x-session-id')
    }
  };
  
  // Perform context-aware authorization
  const result = await auth.authorize(token, resource, action, context);
  
  // Apply context-based constraints
  if (result.allowed && result.constraints?.temporal) {
    const constraints = result.constraints.temporal;
    
    if (constraints.businessHoursOnly && !isBusinessHours()) {
      return {
        ...result,
        allowed: false,
        reason: 'Access restricted to business hours'
      };
    }
    
    if (constraints.maxDuration) {
      // Set session expiry
      result.obligations = result.obligations || [];
      result.obligations.push({
        type: 'session-limit',
        duration: constraints.maxDuration
      });
    }
  }
  
  return result;
}

// ========================================
// 5. POLICY SIMULATION AND TESTING
// ========================================

export async function simulatePolicyChange(
  token: string,
  newPolicy: Policy,
  testScenarios: Array<{ resource: Resource; action: string }>
) {
  const auth = requireAuth();
  const subject = await auth.contextBuilder.extractSubject(token);
  
  // Get current results
  const currentResults = await Promise.all(
    testScenarios.map(scenario =>
      auth.authorize(subject, scenario.resource, scenario.action)
    )
  );
  
  // Apply new policy temporarily
  auth.policyEngine.addPolicy(newPolicy);
  
  try {
    // Get results with new policy
    const newResults = await Promise.all(
      testScenarios.map(scenario =>
        auth.authorize(subject, scenario.resource, scenario.action)
      )
    );
    
    // Compare results
    const changes = testScenarios.map((scenario, index) => ({
      scenario,
      before: currentResults[index].allowed,
      after: newResults[index].allowed,
      changed: currentResults[index].allowed !== newResults[index].allowed,
      impact: newResults[index].allowed ? 'GRANTED' : 'DENIED'
    }));
    
    return {
      policy: newPolicy,
      impacts: changes.filter(c => c.changed),
      summary: {
        total: testScenarios.length,
        changed: changes.filter(c => c.changed).length,
        newGrants: changes.filter(c => c.changed && c.after).length,
        newDenies: changes.filter(c => c.changed && !c.after).length
      }
    };
  } finally {
    auth.policyEngine.removePolicy(newPolicy.id);
  }
}

// ========================================
// 6. QUOTA AND RATE LIMITING
// ========================================

export async function checkQuotaAndAuthorize(
  token: string,
  resource: Resource,
  action: string
) {
  const auth = requireAuth();
  const subject = await auth.contextBuilder.extractSubject(token);
  
  // Check base authorization first
  const authResult = await auth.authorize(subject, resource, action);
  
  if (!authResult.allowed) {
    return authResult;
  }
  
  // Check quotas using the cache provider
  const quotaKey = `quota:${subject.id}:${resource.type}`;
  const currentUsage = await auth.cache?.get(quotaKey) || 0;
  const quota = subject[`${resource.type}Quota`] || 10;
  
  if (currentUsage >= quota) {
    return {
      ...authResult,
      allowed: false,
      reason: `Quota exceeded: ${currentUsage}/${quota}`,
      constraints: {
        quota: {
          limit: quota,
          used: currentUsage,
          remaining: 0
        }
      }
    };
  }
  
  // Increment usage
  await auth.cache?.set(quotaKey, currentUsage + 1, 3600); // 1 hour TTL
  
  return {
    ...authResult,
    constraints: {
      ...authResult.constraints,
      quota: {
        limit: quota,
        used: currentUsage + 1,
        remaining: quota - currentUsage - 1
      }
    }
  };
}

// ========================================
// 7. DELEGATION AND IMPERSONATION
// ========================================

export async function authorizeWithDelegation(
  actingUserToken: string,
  targetUserId: string,
  resource: Resource,
  action: string
) {
  const auth = requireAuth();
  
  // Extract acting user
  const actingUser = await auth.contextBuilder.extractSubject(actingUserToken);
  
  // Check if acting user can delegate
  const canDelegate = await auth.authorize(
    actingUser,
    { 
      type: 'delegation',
      id: targetUserId,
      attributes: { targetUser: targetUserId }
    },
    'perform'
  );
  
  if (!canDelegate.allowed) {
    return {
      allowed: false,
      reason: 'Not authorized to act on behalf of target user',
      subject: actingUser
    };
  }
  
  // Get target user's subject
  const targetSubject: Subject = {
    id: targetUserId,
    type: 'user',
    // Inherit some properties from acting user
    tenantId: actingUser.tenantId,
    organizationId: actingUser.organizationId,
    // Mark as delegated
    delegatedBy: actingUser.id,
    isDelegated: true
  };
  
  // Perform authorization as target user
  const result = await auth.authorize(targetSubject, resource, action);
  
  // Add audit obligation for delegation
  if (result.allowed) {
    result.obligations = result.obligations || [];
    result.obligations.push({
      type: 'audit',
      level: 'critical',
      metadata: {
        delegation: true,
        actingUser: actingUser.id,
        targetUser: targetUserId,
        resource: resource.type,
        action
      }
    });
  }
  
  return result;
}

// ========================================
// 8. CONDITIONAL ACCESS POLICIES
// ========================================

export async function evaluateConditionalAccess(
  token: string,
  resource: Resource,
  action: string
) {
  const auth = requireAuth();
  const subject = await auth.contextBuilder.extractSubject(token);
  
  // Define conditional access rules
  const conditions = [
    {
      name: 'mfa-for-sensitive',
      check: async () => {
        if (resource.attributes?.sensitive) {
          return subject.mfaVerified === true;
        }
        return true;
      },
      failureReason: 'MFA required for sensitive resources'
    },
    {
      name: 'location-restriction',
      check: async () => {
        if (resource.attributes?.geoRestricted) {
          const allowedCountries = resource.attributes.allowedCountries || [];
          return allowedCountries.includes(subject.location?.country);
        }
        return true;
      },
      failureReason: 'Access not allowed from your location'
    },
    {
      name: 'device-trust',
      check: async () => {
        if (action === 'delete' || action === 'admin') {
          return subject.deviceTrusted === true;
        }
        return true;
      },
      failureReason: 'Trusted device required for this action'
    }
  ];
  
  // Evaluate all conditions
  for (const condition of conditions) {
    const passed = await condition.check();
    if (!passed) {
      return {
        allowed: false,
        reason: condition.failureReason,
        subject,
        matchedPolicies: [],
        failedCondition: condition.name
      };
    }
  }
  
  // If all conditions pass, perform regular authorization
  return auth.authorize(subject, resource, action);
}

// ========================================
// 9. AUDIT AND COMPLIANCE
// ========================================

export async function authorizeWithCompliance(
  token: string,
  resource: Resource,
  action: string
) {
  const auth = requireAuth();
  const result = await auth.authorize(token, resource, action);
  
  // Enhanced audit logging for compliance
  if (auth.audit) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      type: 'AUTHORIZATION_REQUEST',
      outcome: result.allowed ? 'GRANTED' : 'DENIED',
      subject: result.subject,
      resource: {
        type: resource.type,
        id: resource.id,
        attributes: resource.attributes
      },
      action,
      reason: result.reason,
      matchedPolicies: result.matchedPolicies?.map(p => p.id),
      metadata: {
        ip: result.context?.request?.ip,
        userAgent: result.context?.request?.userAgent,
        sessionId: result.subject?.sessionId
      },
      // Compliance-specific fields
      compliance: {
        dataClassification: resource.attributes?.dataClassification,
        regulatoryScope: resource.attributes?.regulatoryScope,
        retentionRequired: resource.attributes?.retentionRequired
      }
    };
    
    await auth.audit.log(auditEntry);
    
    // Send to compliance monitoring system if required
    if (resource.attributes?.complianceMonitoring) {
      // await complianceService.report(auditEntry);
    }
  }
  
  return result;
}

// ========================================
// Helper Functions
// ========================================

function isBusinessHours(): boolean {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  
  // Monday-Friday, 9 AM - 5 PM
  return day >= 1 && day <= 5 && hour >= 9 && hour < 17;
}

// ========================================
// 10. FULL EXAMPLE: Complex Authorization Flow
// ========================================

export async function complexAuthorizationFlow(req: NextRequest) {
  const auth = requireAuth();
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return NextResponse.json({ error: 'No token provided' }, { status: 401 });
  }
  
  try {
    // 1. Extract and validate subject
    const subject = await auth.contextBuilder.extractSubject(token);
    
    // 2. Build resource from request
    const resourceId = req.nextUrl.searchParams.get('id');
    const resource: Resource = {
      type: 'workflow',
      id: resourceId || undefined,
      attributes: {} // Will be loaded
    };
    
    // 3. Load resource attributes from database
    if (resourceId) {
      const { WorkflowDatabase } = await import('@/services/workflowDatabase');
      const workflow = await WorkflowDatabase.getWorkflow(resourceId);
      
      resource.attributes = {
        owner: workflow?.userId,
        organizationId: workflow?.organizationId,
        visibility: workflow?.visibility || 'private',
        sensitive: workflow?.metadata?.sensitive,
        dataClassification: workflow?.metadata?.dataClassification
      };
    }
    
    // 4. Build authorization context
    const context: AuthorizationContext = {
      request: {
        ip: req.headers.get('x-forwarded-for') || 'unknown',
        method: req.method,
        path: req.nextUrl.pathname
      },
      environment: process.env.NODE_ENV,
      timestamp: new Date()
    };
    
    // 5. Perform authorization with full policy evaluation
    const result = await auth.authorize(subject, resource, 'execute', context);
    
    // 6. Apply additional business rules
    if (result.allowed) {
      // Check execution quota
      const quotaKey = `exec_quota:${subject.id}:daily`;
      const todayUsage = await auth.cache?.get(quotaKey) || 0;
      const dailyLimit = subject.executionQuota || 100;
      
      if (todayUsage >= dailyLimit) {
        result.allowed = false;
        result.reason = 'Daily execution quota exceeded';
      } else {
        // Increment usage
        await auth.cache?.set(quotaKey, todayUsage + 1, 86400); // 24 hour TTL
      }
    }
    
    // 7. Apply obligations
    if (result.allowed && result.obligations) {
      for (const obligation of result.obligations) {
        if (obligation.type === 'audit') {
          await auth.audit?.log({
            type: 'WORKFLOW_EXECUTION',
            level: obligation.level || 'info',
            subject,
            resource,
            metadata: obligation.metadata
          });
        }
      }
    }
    
    // 8. Return response with auth metadata
    return NextResponse.json({
      allowed: result.allowed,
      reason: result.reason,
      quotaRemaining: dailyLimit - todayUsage - 1,
      policies: result.matchedPolicies?.map(p => p.id),
      constraints: result.constraints
    }, { 
      status: result.allowed ? 200 : 403 
    });
    
  } catch (error) {
    console.error('Authorization error:', error);
    return NextResponse.json(
      { error: 'Authorization failed' },
      { status: 500 }
    );
  }
}