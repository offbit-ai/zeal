#!/bin/bash

# Zeal AWS EKS Deployment Script
# Production deployment on Amazon Web Services

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLUSTER_NAME="${CLUSTER_NAME:-zeal-production}"
AWS_REGION="${AWS_REGION:-us-east-1}"
DOMAIN="${DOMAIN:-zeal.example.com}"
ENVIRONMENT="${ENVIRONMENT:-production}"
NODE_COUNT="${NODE_COUNT:-3}"
NODE_TYPE="${NODE_TYPE:-t3.xlarge}"
RDS_INSTANCE_TYPE="${RDS_INSTANCE_TYPE:-db.r5.large}"
ELASTICACHE_NODE_TYPE="${ELASTICACHE_NODE_TYPE:-cache.r6g.large}"
ENABLE_MONITORING="${ENABLE_MONITORING:-true}"
ENABLE_BACKUPS="${ENABLE_BACKUPS:-true}"
ENABLE_AUTH="${ENABLE_AUTH:-true}"
AUTH_MODE="${AUTH_MODE:-production}"

# Auth Configuration
AUTH_JWT_ISSUER="${AUTH_JWT_ISSUER:-}"
AUTH_JWT_AUDIENCE="${AUTH_JWT_AUDIENCE:-}"
AUTH_JWT_JWKS_URI="${AUTH_JWT_JWKS_URI:-}"

# Secret key for HMAC token signing (required for SDK token generation)
# Generate a secure random key if not set
if [ -z "$ZEAL_SECRET_KEY" ]; then
    ZEAL_SECRET_KEY=$(openssl rand -base64 32 2>/dev/null || echo "aws-secret-key-change-in-production")
fi
ZEAL_SECRET_KEY="${ZEAL_SECRET_KEY}"

# TimescaleDB Retention Policies
TIMESCALE_RETENTION_FLOW_TRACES="${TIMESCALE_RETENTION_FLOW_TRACES:-30 days}"
TIMESCALE_RETENTION_TRACE_EVENTS="${TIMESCALE_RETENTION_TRACE_EVENTS:-7 days}"
TIMESCALE_RETENTION_SESSIONS="${TIMESCALE_RETENTION_SESSIONS:-90 days}"

# AI Integration Configuration
ENABLE_AI_INTEGRATIONS="${ENABLE_AI_INTEGRATIONS:-false}"
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-}"
OPENROUTER_MODEL="${OPENROUTER_MODEL:-anthropic/claude-3-haiku-20240307}"
AI_SERVICE_COUNT="${AI_SERVICE_COUNT:-2}"
AI_SERVICE_CPU="${AI_SERVICE_CPU:-512}"
AI_SERVICE_MEMORY="${AI_SERVICE_MEMORY:-1024}"

# Function to print colored output
log() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log $BLUE "🔍 Checking prerequisites..."
    
    # Check for AWS CLI
    if ! command -v aws &> /dev/null; then
        log $RED "❌ AWS CLI not found. Please install AWS CLI."
        exit 1
    fi
    
    # Check for eksctl
    if ! command -v eksctl &> /dev/null; then
        log $YELLOW "⚠️  eksctl not found. Installing eksctl..."
        curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_$(uname -s)_amd64.tar.gz" | tar xz -C /tmp
        sudo mv /tmp/eksctl /usr/local/bin
    fi
    
    # Check for kubectl
    if ! command -v kubectl &> /dev/null; then
        log $YELLOW "⚠️  kubectl not found. Installing kubectl..."
        curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
        sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl
    fi
    
    # Check for helm
    if ! command -v helm &> /dev/null; then
        log $YELLOW "⚠️  Helm not found. Installing Helm..."
        curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
    fi
    
    # Check for terraform
    if ! command -v terraform &> /dev/null; then
        log $YELLOW "⚠️  Terraform not found. Installing Terraform..."
        wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
        sudo apt update && sudo apt install terraform
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log $RED "❌ AWS credentials not configured. Please run 'aws configure'."
        exit 1
    fi
    
    log $GREEN "✅ All prerequisites met"
}

# Function to create VPC with Terraform
create_infrastructure() {
    log $BLUE "🏗️ Creating AWS infrastructure with Terraform..."
    
    cd "$SCRIPT_DIR/terraform"
    
    # Initialize Terraform
    terraform init
    
    # Plan deployment
    terraform plan \
        -var="cluster_name=$CLUSTER_NAME" \
        -var="enable_ai_integrations=$ENABLE_AI_INTEGRATIONS" \
        -var="openrouter_api_key=$OPENROUTER_API_KEY" \
        -var="openrouter_model=$OPENROUTER_MODEL" \
        -var="ai_service_count=$AI_SERVICE_COUNT" \
        -var="ai_service_cpu=$AI_SERVICE_CPU" \
        -var="ai_service_memory=$AI_SERVICE_MEMORY" \
        -var="aws_region=$AWS_REGION" \
        -var="domain=$DOMAIN" \
        -var="environment=$ENVIRONMENT" \
        -out=tfplan
    
    # Apply infrastructure
    terraform apply tfplan
    
    # Export outputs
    export VPC_ID=$(terraform output -raw vpc_id)
    export SUBNET_IDS=$(terraform output -json private_subnet_ids)
    export RDS_ENDPOINT=$(terraform output -raw rds_endpoint)
    export ELASTICACHE_ENDPOINT=$(terraform output -raw elasticache_endpoint)
    export S3_BUCKET=$(terraform output -raw s3_bucket)
    export ECR_REPOSITORY=$(terraform output -raw ecr_repository)
    
    cd "$SCRIPT_DIR"
    log $GREEN "✅ Infrastructure created"
}

# Function to create EKS cluster
create_eks_cluster() {
    log $BLUE "🎯 Creating EKS cluster..."
    
    cat > "$SCRIPT_DIR/cluster-config.yaml" <<EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: $CLUSTER_NAME
  region: $AWS_REGION
  version: "1.28"

vpc:
  id: "$VPC_ID"
  subnets:
    private:
$(echo "$SUBNET_IDS" | jq -r '.[] | "      - " + .')

nodeGroups:
  - name: zeal-workers
    instanceType: $NODE_TYPE
    desiredCapacity: $NODE_COUNT
    minSize: 2
    maxSize: 10
    privateNetworking: true
    volumeSize: 100
    volumeType: gp3
    volumeIOPS: 3000
    volumeThroughput: 125
    amiFamily: AmazonLinux2
    iam:
      withAddonPolicies:
        imageBuilder: true
        autoScaler: true
        ebs: true
        efs: true
        cloudWatch: true
        albIngress: true
    labels:
      nodegroup-type: workers
    tags:
      Environment: $ENVIRONMENT
      Team: platform

addons:
  - name: vpc-cni
    version: latest
  - name: kube-proxy
    version: latest
  - name: aws-ebs-csi-driver
    version: latest
  - name: coredns
    version: latest

iam:
  withOIDC: true
  serviceAccounts:
    - metadata:
        name: zeal-sa
        namespace: zeal-production
      attachPolicyARNs:
        - "arn:aws:iam::aws:policy/AmazonS3FullAccess"
        - "arn:aws:iam::aws:policy/SecretsManagerReadWrite"
        - "arn:aws:iam::aws:policy/AmazonRDSDataFullAccess"

cloudWatch:
  clusterLogging:
    enableTypes: ["*"]
EOF
    
    # Create EKS cluster
    eksctl create cluster -f "$SCRIPT_DIR/cluster-config.yaml"
    
    # Update kubeconfig
    aws eks update-kubeconfig --name $CLUSTER_NAME --region $AWS_REGION
    
    log $GREEN "✅ EKS cluster created"
}

# Function to install AWS Load Balancer Controller
install_aws_lb_controller() {
    log $BLUE "🔄 Installing AWS Load Balancer Controller..."
    
    # Create IAM policy
    curl -o iam_policy.json https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.6.0/docs/install/iam_policy.json
    
    aws iam create-policy \
        --policy-name AWSLoadBalancerControllerIAMPolicy \
        --policy-document file://iam_policy.json || true
    
    # Create service account
    eksctl create iamserviceaccount \
        --cluster=$CLUSTER_NAME \
        --namespace=kube-system \
        --name=aws-load-balancer-controller \
        --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
        --override-existing-serviceaccounts \
        --approve
    
    # Install controller
    helm repo add eks https://aws.github.io/eks-charts
    helm repo update
    
    helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
        -n kube-system \
        --set clusterName=$CLUSTER_NAME \
        --set serviceAccount.create=false \
        --set serviceAccount.name=aws-load-balancer-controller
    
    log $GREEN "✅ AWS Load Balancer Controller installed"
}

# Function to setup External DNS
setup_external_dns() {
    log $BLUE "🌐 Setting up External DNS..."
    
    # Create IAM policy for Route53
    cat > "$SCRIPT_DIR/external-dns-policy.json" <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "route53:ChangeResourceRecordSets"
      ],
      "Resource": [
        "arn:aws:route53:::hostedzone/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "route53:ListHostedZones",
        "route53:ListResourceRecordSets"
      ],
      "Resource": [
        "*"
      ]
    }
  ]
}
EOF
    
    aws iam create-policy \
        --policy-name ExternalDNSPolicy \
        --policy-document file://"$SCRIPT_DIR/external-dns-policy.json" || true
    
    # Create service account
    eksctl create iamserviceaccount \
        --cluster=$CLUSTER_NAME \
        --namespace=kube-system \
        --name=external-dns \
        --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/ExternalDNSPolicy \
        --override-existing-serviceaccounts \
        --approve
    
    # Deploy External DNS
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: external-dns
  namespace: kube-system
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: external-dns
rules:
- apiGroups: [""]
  resources: ["services","endpoints","pods"]
  verbs: ["get","watch","list"]
- apiGroups: ["extensions","networking.k8s.io"]
  resources: ["ingresses"]
  verbs: ["get","watch","list"]
- apiGroups: [""]
  resources: ["nodes"]
  verbs: ["list","watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: external-dns-viewer
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: external-dns
subjects:
- kind: ServiceAccount
  name: external-dns
  namespace: kube-system
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: external-dns
  namespace: kube-system
spec:
  strategy:
    type: Recreate
  selector:
    matchLabels:
      app: external-dns
  template:
    metadata:
      labels:
        app: external-dns
    spec:
      serviceAccountName: external-dns
      containers:
      - name: external-dns
        image: registry.k8s.io/external-dns/external-dns:v0.13.5
        args:
        - --source=service
        - --source=ingress
        - --domain-filter=$DOMAIN
        - --provider=aws
        - --aws-zone-type=public
        - --registry=txt
        - --txt-owner-id=$CLUSTER_NAME
        env:
        - name: AWS_DEFAULT_REGION
          value: $AWS_REGION
EOF
    
    log $GREEN "✅ External DNS configured"
}

# Function to install cert-manager
install_cert_manager() {
    log $BLUE "🔒 Installing cert-manager..."
    
    # Install cert-manager
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
    
    # Wait for cert-manager to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
    
    # Create ClusterIssuer for Let's Encrypt
    cat <<EOF | kubectl apply -f -
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@$DOMAIN
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: alb
EOF
    
    log $GREEN "✅ cert-manager installed"
}

# Function to create namespace and secrets
setup_namespace() {
    log $BLUE "📦 Setting up namespace and secrets..."
    
    # Create namespace
    kubectl create namespace zeal-production --dry-run=client -o yaml | kubectl apply -f -
    
    # Generate secrets
    DB_PASSWORD=$(aws secretsmanager get-secret-value --secret-id zeal/db/password --query SecretString --output text 2>/dev/null || openssl rand -base64 32)
    REDIS_AUTH=$(aws secretsmanager get-secret-value --secret-id zeal/redis/auth --query SecretString --output text 2>/dev/null || openssl rand -base64 32)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    # Store in AWS Secrets Manager
    aws secretsmanager create-secret --name zeal/db/password --secret-string "$DB_PASSWORD" || \
        aws secretsmanager update-secret --secret-id zeal/db/password --secret-string "$DB_PASSWORD"
    
    aws secretsmanager create-secret --name zeal/redis/auth --secret-string "$REDIS_AUTH" || \
        aws secretsmanager update-secret --secret-id zeal/redis/auth --secret-string "$REDIS_AUTH"
    
    # Create Kubernetes secret
    kubectl create secret generic zeal-secrets \
        --from-literal=database-password="$DB_PASSWORD" \
        --from-literal=redis-password="$REDIS_AUTH" \
        --from-literal=nextauth-secret="$NEXTAUTH_SECRET" \
        --namespace=zeal-production \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log $GREEN "✅ Namespace and secrets configured"
}

# Function to deploy Zeal application
# Function to deploy auth system
deploy_auth() {
    if [ "$ENABLE_AUTH" = "true" ]; then
        log $BLUE "🔐 Deploying authorization system..."
        
        # Run auth deployment script
        bash "$SCRIPT_DIR/../auth/deploy-auth.sh" aws
        
        log $GREEN "✅ Authorization system deployed"
    fi
}

deploy_zeal() {
    log $BLUE "🚀 Deploying Zeal application..."
    
    # Create ConfigMap
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: zeal-config
  namespace: zeal-production
data:
  DATABASE_URL: "postgresql://zeal_user:${DB_PASSWORD}@${RDS_ENDPOINT}/zeal_db?schema=public"
  TIMESCALE_HOST: "${TIMESCALE_ENDPOINT%%:*}"
  TIMESCALE_PORT: "5432"
  TIMESCALE_DATABASE: "zeal_traces"
  TIMESCALE_USER: "zeal_user"
  TIMESCALE_RETENTION_FLOW_TRACES: "$TIMESCALE_RETENTION_FLOW_TRACES"
  TIMESCALE_RETENTION_TRACE_EVENTS: "$TIMESCALE_RETENTION_TRACE_EVENTS"
  TIMESCALE_RETENTION_SESSIONS: "$TIMESCALE_RETENTION_SESSIONS"
  REDIS_URL: "redis://:${REDIS_AUTH}@${ELASTICACHE_ENDPOINT}:6379"
  NEXT_PUBLIC_API_URL: "https://$DOMAIN"
  NEXT_PUBLIC_BASE_URL: "https://$DOMAIN"
  NEXTAUTH_URL: "https://$DOMAIN"
  AWS_S3_BUCKET: "$S3_BUCKET"
  AWS_REGION: "$AWS_REGION"
  NEXT_PUBLIC_CRDT_SERVER_URL: "wss://$DOMAIN/ws"
EOF
    
    # Deploy application
    cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zeal
  namespace: zeal-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: zeal
  template:
    metadata:
      labels:
        app: zeal
    spec:
      serviceAccountName: zeal-sa
      containers:
      - name: zeal
        image: ${ECR_REPOSITORY}:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: zeal-config
        - secretRef:
            name: zeal-secrets
        - configMapRef:
            name: zeal-auth-config
            optional: true
        - secretRef:
            name: zeal-auth-secret
            optional: true
        volumeMounts:
        - name: auth-policies
          mountPath: /config
          readOnly: true
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
      volumes:
      - name: auth-policies
        configMap:
          name: auth-policies
          optional: true
---
apiVersion: v1
kind: Service
metadata:
  name: zeal
  namespace: zeal-production
spec:
  selector:
    app: zeal
  ports:
  - port: 3000
    targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: zeal-ingress
  namespace: zeal-production
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: ${ACM_CERTIFICATE_ARN}
    alb.ingress.kubernetes.io/listen-ports: '[{"HTTP": 80}, {"HTTPS": 443}]'
    alb.ingress.kubernetes.io/ssl-redirect: '443'
    external-dns.alpha.kubernetes.io/hostname: $DOMAIN
spec:
  rules:
  - host: $DOMAIN
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: zeal
            port:
              number: 3000
EOF
    
    log $GREEN "✅ Zeal application deployed"
}

# Function to setup monitoring
setup_monitoring() {
    if [ "$ENABLE_MONITORING" = "true" ]; then
        log $BLUE "📊 Setting up monitoring with CloudWatch..."
        
        # Install CloudWatch Container Insights
        ClusterName=$CLUSTER_NAME
        RegionName=$AWS_REGION
        FluentBitHttpPort='2020'
        FluentBitReadFromHead='Off'
        [[ ${FluentBitReadFromHead} = 'On' ]] && FluentBitReadFromTail='Off'|| FluentBitReadFromTail='On'
        [[ -z ${FluentBitHttpPort} ]] && FluentBitHttpServer='Off' || FluentBitHttpServer='On'
        
        curl https://raw.githubusercontent.com/aws-samples/amazon-cloudwatch-container-insights/latest/k8s-deployment-manifest-templates/deployment-mode/daemonset/container-insights-monitoring/quickstart/cwagent-fluent-bit-quickstart.yaml | \
            sed "s/{{cluster_name}}/${ClusterName}/;s/{{region_name}}/${RegionName}/;s/{{http_server_toggle}}/${FluentBitHttpServer}/;s/{{http_server_port}}/${FluentBitHttpPort}/;s/{{read_from_head}}/${FluentBitReadFromHead}/;s/{{read_from_tail}}/${FluentBitReadFromTail}/" | \
            kubectl apply -f -
        
        # Deploy Prometheus
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        helm install prometheus prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --create-namespace \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=gp3 \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi
        
        log $GREEN "✅ Monitoring configured"
    fi
}

# Function to setup backups
setup_backups() {
    if [ "$ENABLE_BACKUPS" = "true" ]; then
        log $BLUE "💾 Setting up AWS Backup..."
        
        # Create backup plan using AWS Backup
        aws backup create-backup-plan \
            --backup-plan "{
                \"BackupPlanName\": \"zeal-backup-plan\",
                \"Rules\": [{
                    \"RuleName\": \"DailyBackups\",
                    \"TargetBackupVaultName\": \"Default\",
                    \"ScheduleExpression\": \"cron(0 2 * * ? *)\",
                    \"StartWindowMinutes\": 60,
                    \"CompletionWindowMinutes\": 120,
                    \"Lifecycle\": {
                        \"DeleteAfterDays\": 30
                    }
                }]
            }"
        
        # Tag resources for backup
        aws rds add-tags-to-resource \
            --resource-name "arn:aws:rds:$AWS_REGION:$(aws sts get-caller-identity --query Account --output text):db:zeal-db" \
            --tags Key=Backup,Value=true
        
        log $GREEN "✅ Backup configured"
    fi
}

# Function to display connection information
display_info() {
    log $CYAN "
╔═══════════════════════════════════════════════════════════╗
║              Zeal AWS Deployment Complete                  ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  🌐 Application URL: https://$DOMAIN                      ║
║  🎯 EKS Cluster: $CLUSTER_NAME                           ║
║  🌍 Region: $AWS_REGION                                  ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                    AWS Resources                          ║
╠═══════════════════════════════════════════════════════════╣
║  RDS Endpoint: $RDS_ENDPOINT                             ║
║  ElastiCache: $ELASTICACHE_ENDPOINT                      ║
║  S3 Bucket: $S3_BUCKET                                   ║
║  ECR Repository: $ECR_REPOSITORY                         ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                    Useful Commands                        ║
╠═══════════════════════════════════════════════════════════╣
║  View pods:                                               ║
║    kubectl get pods -n zeal-production                    ║
║                                                           ║
║  View logs:                                               ║
║    kubectl logs -f deployment/zeal -n zeal-production     ║
║                                                           ║
║  Scale deployment:                                        ║
║    kubectl scale deployment/zeal --replicas=5             ║
║                                                           ║
║  Access EKS cluster:                                      ║
║    aws eks update-kubeconfig --name $CLUSTER_NAME         ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"
}

# Main deployment function
main() {
    log $MAGENTA "
╔═══════════════════════════════════════════════════════════╗
║              Zeal AWS EKS Deployment Script               ║
╚═══════════════════════════════════════════════════════════╝
"
    
    check_prerequisites
    create_infrastructure
    create_eks_cluster
    install_aws_lb_controller
    setup_external_dns
    install_cert_manager
    setup_namespace
    deploy_auth
    deploy_zeal
    setup_monitoring
    setup_backups
    display_info
    
    log $GREEN "✅ Deployment completed successfully!"
}

# Run main function
main "$@"