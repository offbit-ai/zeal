#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
DEPLOYMENT_TYPE="${1:-k3s}"
AUTH_MODE="${AUTH_MODE:-production}"
NAMESPACE="${NAMESPACE:-zeal}"

echo -e "${BLUE}🔐 Deploying Zeal Authorization System${NC}"
echo -e "Deployment Type: ${GREEN}$DEPLOYMENT_TYPE${NC}"
echo -e "Namespace: ${GREEN}$NAMESPACE${NC}"
echo ""

# Function to create auth database schema
create_auth_schema() {
    echo -e "${BLUE}📦 Creating authorization database schema...${NC}"
    
    cat > /tmp/auth-schema.sql << 'EOSQL'
-- Create auth schema
CREATE SCHEMA IF NOT EXISTS zeal_auth;

-- Create policies table
CREATE TABLE IF NOT EXISTS zeal_auth.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    effect VARCHAR(20) NOT NULL CHECK (effect IN ('allow', 'deny', 'filter')),
    priority INTEGER DEFAULT 100,
    resources JSONB NOT NULL,
    actions TEXT[] NOT NULL,
    subjects JSONB,
    conditions JSONB,
    obligations JSONB,
    tenant_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, tenant_id)
);

-- Create hierarchy table for organizational structure
CREATE TABLE IF NOT EXISTS zeal_auth.hierarchy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    parent_id UUID REFERENCES zeal_auth.hierarchy(id),
    name VARCHAR(255) NOT NULL,
    attributes JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create audit log table (partitioned by month)
CREATE TABLE IF NOT EXISTS zeal_auth.audit_logs (
    id UUID DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR(100) NOT NULL,
    level VARCHAR(20),
    subject JSONB NOT NULL,
    resource JSONB,
    action VARCHAR(100),
    result VARCHAR(20),
    reason TEXT,
    metadata JSONB,
    tenant_id VARCHAR(255),
    PRIMARY KEY (timestamp, id)
) PARTITION BY RANGE (timestamp);

-- Create initial partition for current month
CREATE TABLE IF NOT EXISTS zeal_auth.audit_logs_default 
    PARTITION OF zeal_auth.audit_logs DEFAULT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_policies_tenant ON zeal_auth.policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_priority ON zeal_auth.policies(priority DESC);
CREATE INDEX IF NOT EXISTS idx_hierarchy_tenant ON zeal_auth.hierarchy(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_parent ON zeal_auth.hierarchy(parent_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_timestamp ON zeal_auth.audit_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type_timestamp ON zeal_auth.audit_logs(type, timestamp DESC);

-- Grant permissions
GRANT ALL ON SCHEMA zeal_auth TO zeal_user;
GRANT ALL ON ALL TABLES IN SCHEMA zeal_auth TO zeal_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA zeal_auth TO zeal_user;
EOSQL
    
    echo -e "${GREEN}✅ Auth schema SQL created${NC}"
}

# Function to create ConfigMap for auth policies
create_auth_configmap() {
    echo -e "${BLUE}📝 Creating auth policies ConfigMap...${NC}"
    
    cat > /tmp/auth-policies.yaml << 'EOF'
version: "1.0"
metadata:
  description: "Production authorization policies for Zeal"
  
policies:
  # Admin full access
  - id: admin-full-access
    description: "Administrators have full access"
    priority: 1000
    effect: allow
    resources:
      - type: "*"
    actions: ["*"]
    subjects:
      conditions:
        - claim: roles
          operator: contains
          value: "admin"
  
  # Workflow owner access
  - id: workflow-owner-access
    description: "Workflow owners have full access to their workflows"
    priority: 100
    effect: allow
    resources:
      - type: workflow
        conditions:
          - attribute: owner
            operator: equals
            value: "${subject.id}"
    actions: ["*"]
  
  # Organization read access
  - id: org-read-access
    description: "Organization members can read organization resources"
    priority: 90
    effect: allow
    resources:
      - type: workflow
        conditions:
          - attribute: organizationId
            operator: equals
            value: "${subject.organizationId}"
    actions: ["read", "execute"]
  
  # Tenant isolation
  - id: tenant-isolation
    description: "Enforce tenant isolation"
    priority: 10000
    effect: deny
    resources:
      - type: "*"
        conditions:
          - attribute: tenantId
            operator: exists
          - attribute: tenantId
            operator: not_equals
            value: "${subject.tenantId}"
    actions: ["*"]
    subjects:
      conditions:
        - claim: tenantId
          operator: exists
  
  # Default deny
  - id: default-deny
    description: "Deny by default"
    priority: 1
    effect: deny
    resources:
      - type: "*"
    actions: ["*"]
EOF
    
    kubectl create configmap auth-policies \
        --from-file=/tmp/auth-policies.yaml \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo -e "${GREEN}✅ Auth policies ConfigMap created${NC}"
}

# Function to create auth environment ConfigMap
create_auth_env_configmap() {
    echo -e "${BLUE}🔧 Creating auth environment ConfigMap...${NC}"
    
    cat > /tmp/auth-env.yaml << EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: zeal-auth-config
  namespace: $NAMESPACE
data:
  ZEAL_AUTH_ENABLED: "true"
  ZEAL_AUTH_MODE: "$AUTH_MODE"
  
  # Claim mappings
  AUTH_CLAIM_SUBJECT_ID: "sub"
  AUTH_CLAIM_TENANT: "tenant_id"
  AUTH_CLAIM_ORGANIZATION: "org_id"
  AUTH_CLAIM_ROLES: "roles"
  AUTH_CLAIM_PERMISSIONS: "permissions"
  
  # Policy configuration
  ZEAL_AUTH_POLICIES_PATH: "/config/auth-policies.yaml"
  ZEAL_AUTH_DEFAULT_EFFECT: "deny"
  
  # Cache configuration
  ZEAL_AUTH_CACHE_ENABLED: "true"
  ZEAL_AUTH_CACHE_TTL: "300"
  
  # Audit configuration
  ZEAL_AUTH_AUDIT_ENABLED: "true"
  ZEAL_AUTH_AUDIT_LEVEL: "info"
  
  # Database configuration
  ZEAL_AUTH_USE_WORKFLOW_DB: "true"
  ZEAL_AUTH_SCHEMA_NAME: "zeal_auth"
  ZEAL_AUTH_ENABLE_RLS: "false"
EOF
    
    kubectl apply -f /tmp/auth-env.yaml
    echo -e "${GREEN}✅ Auth environment ConfigMap created${NC}"
}

# Function to create auth Secret for sensitive data
create_auth_secret() {
    echo -e "${BLUE}🔒 Creating auth Secret...${NC}"
    
    # Check if we have JWT configuration
    if [ -z "$AUTH_JWT_ISSUER" ]; then
        echo -e "${YELLOW}⚠️  No JWT issuer configured. Using placeholder values.${NC}"
        echo -e "${YELLOW}   Please update the secret with your identity provider details.${NC}"
        AUTH_JWT_ISSUER="https://your-identity-provider.com"
        AUTH_JWT_AUDIENCE="https://api.your-app.com"
        AUTH_JWT_JWKS_URI="https://your-identity-provider.com/.well-known/jwks.json"
    fi
    
    kubectl create secret generic zeal-auth-secret \
        --from-literal=AUTH_JWT_ISSUER="$AUTH_JWT_ISSUER" \
        --from-literal=AUTH_JWT_AUDIENCE="$AUTH_JWT_AUDIENCE" \
        --from-literal=AUTH_JWT_JWKS_URI="$AUTH_JWT_JWKS_URI" \
        --namespace=$NAMESPACE \
        --dry-run=client -o yaml | kubectl apply -f -
    
    echo -e "${GREEN}✅ Auth Secret created${NC}"
}

# Function to patch deployments with auth configuration
patch_deployments() {
    echo -e "${BLUE}🔧 Patching deployments with auth configuration...${NC}"
    
    # Patch the main Zeal deployment
    cat > /tmp/deployment-patch.yaml << 'EOF'
spec:
  template:
    spec:
      containers:
      - name: zeal
        envFrom:
        - configMapRef:
            name: zeal-auth-config
        - secretRef:
            name: zeal-auth-secret
        volumeMounts:
        - name: auth-policies
          mountPath: /config
          readOnly: true
      volumes:
      - name: auth-policies
        configMap:
          name: auth-policies
EOF
    
    # Apply patch to main deployment
    kubectl patch deployment zeal \
        --namespace=$NAMESPACE \
        --patch-file=/tmp/deployment-patch.yaml \
        2>/dev/null || echo -e "${YELLOW}⚠️  Could not patch zeal deployment (may not exist yet)${NC}"
    
    echo -e "${GREEN}✅ Deployment patches applied${NC}"
}

# Function to create auth init job
create_auth_init_job() {
    echo -e "${BLUE}🚀 Creating auth initialization job...${NC}"
    
    cat > /tmp/auth-init-job.yaml << EOF
apiVersion: batch/v1
kind: Job
metadata:
  name: zeal-auth-init
  namespace: $NAMESPACE
spec:
  template:
    spec:
      restartPolicy: OnFailure
      containers:
      - name: auth-init
        image: postgres:15-alpine
        env:
        - name: PGHOST
          value: postgres-service
        - name: PGUSER
          value: zeal_user
        - name: PGPASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        - name: PGDATABASE
          value: zeal_db
        command:
        - sh
        - -c
        - |
          echo "Initializing auth database schema..."
          psql << 'EOSQL'
$(cat /tmp/auth-schema.sql)
EOSQL
          echo "Auth schema initialization complete"
EOF
    
    kubectl apply -f /tmp/auth-init-job.yaml
    echo -e "${GREEN}✅ Auth initialization job created${NC}"
}

# Function to update ingress for auth headers
update_ingress() {
    echo -e "${BLUE}🌐 Updating ingress for auth headers...${NC}"
    
    # Add annotations for auth headers
    kubectl annotate ingress zeal-ingress \
        --namespace=$NAMESPACE \
        --overwrite \
        nginx.ingress.kubernetes.io/configuration-snippet='
          proxy_set_header X-Original-URI $request_uri;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
        ' 2>/dev/null || echo -e "${YELLOW}⚠️  Could not update ingress (may not exist)${NC}"
    
    echo -e "${GREEN}✅ Ingress configuration updated${NC}"
}

# Main deployment function
deploy_auth() {
    echo -e "${BLUE}🚀 Starting auth deployment for $DEPLOYMENT_TYPE...${NC}"
    
    # Create namespace if it doesn't exist
    kubectl create namespace $NAMESPACE 2>/dev/null || true
    
    # Create auth database schema
    create_auth_schema
    
    # Create ConfigMaps and Secrets
    create_auth_configmap
    create_auth_env_configmap
    create_auth_secret
    
    # Initialize database
    create_auth_init_job
    
    # Patch deployments
    patch_deployments
    
    # Update ingress
    update_ingress
    
    echo ""
    echo -e "${GREEN}✅ Auth deployment complete!${NC}"
    echo ""
    echo -e "${BLUE}📋 Next steps:${NC}"
    echo -e "1. Update the auth secret with your identity provider details:"
    echo -e "   ${YELLOW}kubectl edit secret zeal-auth-secret -n $NAMESPACE${NC}"
    echo ""
    echo -e "2. Verify auth initialization:"
    echo -e "   ${YELLOW}kubectl logs -l job-name=zeal-auth-init -n $NAMESPACE${NC}"
    echo ""
    echo -e "3. Restart the Zeal deployment to pick up auth configuration:"
    echo -e "   ${YELLOW}kubectl rollout restart deployment/zeal -n $NAMESPACE${NC}"
    echo ""
    echo -e "4. Check auth status:"
    echo -e "   ${YELLOW}kubectl logs deployment/zeal -n $NAMESPACE | grep -i auth${NC}"
}

# Cloud-specific configurations
case $DEPLOYMENT_TYPE in
    aws)
        echo -e "${BLUE}☁️  Configuring for AWS...${NC}"
        # AWS-specific configurations
        export INGRESS_CLASS="alb"
        ;;
    azure)
        echo -e "${BLUE}☁️  Configuring for Azure...${NC}"
        # Azure-specific configurations
        export INGRESS_CLASS="azure/application-gateway"
        ;;
    gcp)
        echo -e "${BLUE}☁️  Configuring for GCP...${NC}"
        # GCP-specific configurations
        export INGRESS_CLASS="gce"
        ;;
    k3s)
        echo -e "${BLUE}🐮 Configuring for K3s...${NC}"
        # K3s-specific configurations
        export INGRESS_CLASS="traefik"
        ;;
    *)
        echo -e "${RED}❌ Unknown deployment type: $DEPLOYMENT_TYPE${NC}"
        echo -e "Usage: $0 [aws|azure|gcp|k3s]"
        exit 1
        ;;
esac

# Run deployment
deploy_auth

# Clean up temporary files
rm -f /tmp/auth-*.yaml /tmp/auth-*.sql