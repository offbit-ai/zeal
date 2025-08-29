#!/bin/bash

# Zeal GCP GKE Deployment Script
# Production deployment on Google Cloud Platform

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
PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project)}"
CLUSTER_NAME="${CLUSTER_NAME:-zeal-gke}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
DOMAIN="${DOMAIN:-zeal.example.com}"
ENVIRONMENT="${ENVIRONMENT:-production}"
NODE_COUNT="${NODE_COUNT:-3}"
NODE_MACHINE_TYPE="${NODE_MACHINE_TYPE:-n2-standard-4}"
DB_TIER="${DB_TIER:-db-n1-standard-4}"
REDIS_TIER="${REDIS_TIER:-STANDARD_HA}"
REDIS_SIZE="${REDIS_SIZE:-5}"
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
    ZEAL_SECRET_KEY=$(openssl rand -base64 32 2>/dev/null || echo "gcp-secret-key-change-in-production")
fi
ZEAL_SECRET_KEY="${ZEAL_SECRET_KEY}"

# TimescaleDB Retention Policies
TIMESCALE_RETENTION_FLOW_TRACES="${TIMESCALE_RETENTION_FLOW_TRACES:-30 days}"
TIMESCALE_RETENTION_TRACE_EVENTS="${TIMESCALE_RETENTION_TRACE_EVENTS:-7 days}"
TIMESCALE_RETENTION_SESSIONS="${TIMESCALE_RETENTION_SESSIONS:-90 days}"

# Function to print colored output
log() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log $BLUE "🔍 Checking prerequisites..."
    
    # Check for gcloud CLI
    if ! command -v gcloud &> /dev/null; then
        log $RED "❌ gcloud CLI not found. Please install Google Cloud SDK."
        log $YELLOW "Visit: https://cloud.google.com/sdk/docs/install"
        exit 1
    fi
    
    # Check for kubectl
    if ! command -v kubectl &> /dev/null; then
        log $YELLOW "⚠️  kubectl not found. Installing kubectl..."
        gcloud components install kubectl
    fi
    
    # Check for helm
    if ! command -v helm &> /dev/null; then
        log $YELLOW "⚠️  Helm not found. Installing Helm..."
        curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
    fi
    
    # Check for terraform
    if ! command -v terraform &> /dev/null; then
        log $YELLOW "⚠️  Terraform not found. Please install Terraform."
        exit 1
    fi
    
    # Check gcloud auth
    if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
        log $YELLOW "⚠️  Not logged into GCP. Please login..."
        gcloud auth login
    fi
    
    # Set project
    if [ -z "$PROJECT_ID" ]; then
        log $RED "❌ No GCP project set. Please set PROJECT_ID environment variable."
        exit 1
    fi
    
    gcloud config set project $PROJECT_ID
    log $GREEN "✅ Using project: $PROJECT_ID"
    
    # Enable required APIs
    log $BLUE "🔧 Enabling required GCP APIs..."
    gcloud services enable \
        compute.googleapis.com \
        container.googleapis.com \
        sqladmin.googleapis.com \
        redis.googleapis.com \
        storage.googleapis.com \
        secretmanager.googleapis.com \
        cloudkms.googleapis.com \
        monitoring.googleapis.com \
        logging.googleapis.com \
        artifactregistry.googleapis.com \
        certificatemanager.googleapis.com
    
    log $GREEN "✅ All prerequisites met"
}

# Function to create infrastructure with Terraform
create_infrastructure() {
    log $BLUE "🏗️ Creating GCP infrastructure with Terraform..."
    
    cd "$SCRIPT_DIR/terraform"
    
    # Initialize Terraform
    terraform init
    
    # Plan deployment
    terraform plan \
        -var="project_id=$PROJECT_ID" \
        -var="region=$REGION" \
        -var="zone=$ZONE" \
        -var="cluster_name=$CLUSTER_NAME" \
        -var="domain=$DOMAIN" \
        -var="environment=$ENVIRONMENT" \
        -out=tfplan
    
    # Apply infrastructure
    terraform apply tfplan
    
    # Export outputs
    export VPC_NAME=$(terraform output -raw vpc_name)
    export SUBNET_NAME=$(terraform output -raw subnet_name)
    export CLOUD_SQL_INSTANCE=$(terraform output -raw cloud_sql_instance)
    export REDIS_INSTANCE=$(terraform output -raw redis_instance)
    export GCS_BUCKET=$(terraform output -raw gcs_bucket)
    export ARTIFACT_REGISTRY=$(terraform output -raw artifact_registry)
    
    cd "$SCRIPT_DIR"
    log $GREEN "✅ Infrastructure created"
}

# Function to create GKE cluster
create_gke_cluster() {
    log $BLUE "🎯 Creating GKE cluster..."
    
    # Create GKE cluster with Autopilot for simplified management
    gcloud container clusters create $CLUSTER_NAME \
        --region $REGION \
        --enable-autopilot \
        --enable-private-nodes \
        --enable-private-endpoint \
        --master-ipv4-cidr 172.16.0.0/28 \
        --network $VPC_NAME \
        --subnetwork $SUBNET_NAME \
        --enable-ip-alias \
        --enable-autorepair \
        --enable-autoupgrade \
        --enable-stackdriver-kubernetes \
        --addons HorizontalPodAutoscaling,HttpLoadBalancing,GcePersistentDiskCsiDriver \
        --workload-pool=${PROJECT_ID}.svc.id.goog \
        --enable-shielded-nodes
    
    # For standard cluster (non-Autopilot), use this instead:
    # gcloud container clusters create $CLUSTER_NAME \
    #     --zone $ZONE \
    #     --num-nodes $NODE_COUNT \
    #     --machine-type $NODE_MACHINE_TYPE \
    #     --disk-size 100 \
    #     --disk-type pd-standard \
    #     --network $VPC_NAME \
    #     --subnetwork $SUBNET_NAME \
    #     --enable-ip-alias \
    #     --enable-autoscaling \
    #     --min-nodes 2 \
    #     --max-nodes 10 \
    #     --enable-autorepair \
    #     --enable-autoupgrade \
    #     --enable-stackdriver-kubernetes \
    #     --workload-pool=${PROJECT_ID}.svc.id.goog
    
    # Get credentials
    gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION
    
    log $GREEN "✅ GKE cluster created"
}

# Function to setup Workload Identity
setup_workload_identity() {
    log $BLUE "🔐 Setting up Workload Identity..."
    
    # Create service account
    gcloud iam service-accounts create zeal-gke-sa \
        --display-name="Zeal GKE Service Account"
    
    # Grant necessary permissions
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:zeal-gke-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/cloudsql.client"
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:zeal-gke-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/redis.editor"
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:zeal-gke-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/storage.objectAdmin"
    
    gcloud projects add-iam-policy-binding $PROJECT_ID \
        --member="serviceAccount:zeal-gke-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
        --role="roles/secretmanager.secretAccessor"
    
    # Allow Kubernetes service account to impersonate GCP service account
    gcloud iam service-accounts add-iam-policy-binding \
        zeal-gke-sa@${PROJECT_ID}.iam.gserviceaccount.com \
        --role roles/iam.workloadIdentityUser \
        --member "serviceAccount:${PROJECT_ID}.svc.id.goog[zeal-production/zeal-sa]"
    
    log $GREEN "✅ Workload Identity configured"
}

# Function to install NGINX Ingress Controller
install_nginx_ingress() {
    log $BLUE "🔄 Installing NGINX Ingress Controller..."
    
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    helm install nginx-ingress ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.service.type=LoadBalancer \
        --set controller.service.annotations."cloud\.google\.com/load-balancer-type"="External"
    
    # Wait for external IP
    log $YELLOW "⏳ Waiting for External IP..."
    EXTERNAL_IP=""
    while [ -z $EXTERNAL_IP ]; do
        EXTERNAL_IP=$(kubectl get svc nginx-ingress-ingress-nginx-controller \
            -n ingress-nginx \
            -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
        [ -z "$EXTERNAL_IP" ] && sleep 10
    done
    
    log $GREEN "✅ Ingress Controller installed with IP: $EXTERNAL_IP"
    export INGRESS_IP=$EXTERNAL_IP
}

# Function to setup cert-manager with Google-managed certificates
setup_cert_manager() {
    log $BLUE "🔒 Setting up certificate management..."
    
    # Option 1: Use Google-managed certificates (simpler)
    cat <<EOF | kubectl apply -f -
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: zeal-certificate
  namespace: zeal-production
spec:
  domains:
    - $DOMAIN
EOF
    
    # Option 2: Use cert-manager with Let's Encrypt
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
    
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
    
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
          class: nginx
EOF
    
    log $GREEN "✅ Certificate management configured"
}

# Function to create Cloud SQL PostgreSQL
create_cloud_sql() {
    log $BLUE "🐘 Creating Cloud SQL PostgreSQL..."
    
    # Generate password
    DB_PASSWORD=$(openssl rand -base64 32)
    
    # Store in Secret Manager
    echo -n "$DB_PASSWORD" | gcloud secrets create postgres-password --data-file=-
    
    # Create Cloud SQL instance
    gcloud sql instances create ${CLUSTER_NAME}-postgres \
        --database-version=POSTGRES_15 \
        --tier=$DB_TIER \
        --region=$REGION \
        --network=$VPC_NAME \
        --no-assign-ip \
        --availability-type=REGIONAL \
        --backup-start-time=03:00 \
        --enable-point-in-time-recovery \
        --maintenance-window-day=SUN \
        --maintenance-window-hour=4 \
        --maintenance-release-channel=production \
        --insights-config-enabled \
        --insights-config-query-insights-enabled \
        --insights-config-record-application-tags
    
    # Create database
    gcloud sql databases create zeal_db \
        --instance=${CLUSTER_NAME}-postgres
    
    # Create user
    gcloud sql users create zeal_user \
        --instance=${CLUSTER_NAME}-postgres \
        --password=$DB_PASSWORD
    
    # Create TimescaleDB instance
    gcloud sql instances create ${CLUSTER_NAME}-timescale \
        --database-version=POSTGRES_15 \
        --tier=$DB_TIER \
        --region=$REGION \
        --network=$VPC_NAME \
        --no-assign-ip \
        --availability-type=ZONAL \
        --backup-start-time=03:00 \
        --database-flags=shared_preload_libraries=timescaledb
    
    gcloud sql databases create zeal_traces \
        --instance=${CLUSTER_NAME}-timescale
    
    gcloud sql users create zeal_user \
        --instance=${CLUSTER_NAME}-timescale \
        --password=$DB_PASSWORD
    
    log $GREEN "✅ Cloud SQL instances created"
}

# Function to create Memorystore Redis
create_redis() {
    log $BLUE "🔴 Creating Memorystore Redis..."
    
    # Generate auth string
    REDIS_AUTH=$(openssl rand -base64 32)
    
    # Store in Secret Manager
    echo -n "$REDIS_AUTH" | gcloud secrets create redis-auth --data-file=-
    
    # Create Redis instance
    gcloud redis instances create ${CLUSTER_NAME}-redis \
        --size=$REDIS_SIZE \
        --region=$REGION \
        --zone=$ZONE \
        --network=$VPC_NAME \
        --tier=$REDIS_TIER \
        --redis-version=redis_7_0 \
        --auth-enabled \
        --auth-string=$REDIS_AUTH \
        --enable-auth \
        --persistence-mode=rdb \
        --persistence-rdb-snapshot-period=1h
    
    # Get Redis host
    REDIS_HOST=$(gcloud redis instances describe ${CLUSTER_NAME}-redis \
        --region=$REGION \
        --format="value(host)")
    
    log $GREEN "✅ Memorystore Redis created"
}

# Function to create Cloud Storage bucket
create_storage() {
    log $BLUE "📦 Creating Cloud Storage..."
    
    # Create bucket
    gsutil mb -p $PROJECT_ID \
        -c STANDARD \
        -l $REGION \
        -b on \
        gs://${PROJECT_ID}-zeal-storage/
    
    # Enable versioning
    gsutil versioning set on gs://${PROJECT_ID}-zeal-storage/
    
    # Set lifecycle rules for old versions
    cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "age": 365,
          "isLive": false
        }
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "NEARLINE"},
        "condition": {
          "age": 30,
          "isLive": true
        }
      }
    ]
  }
}
EOF
    
    gsutil lifecycle set lifecycle.json gs://${PROJECT_ID}-zeal-storage/
    
    log $GREEN "✅ Cloud Storage bucket created"
}

# Function to create Artifact Registry
create_artifact_registry() {
    log $BLUE "🐳 Creating Artifact Registry..."
    
    gcloud artifacts repositories create zeal \
        --repository-format=docker \
        --location=$REGION \
        --description="Docker images for Zeal"
    
    # Configure Docker authentication
    gcloud auth configure-docker ${REGION}-docker.pkg.dev
    
    log $GREEN "✅ Artifact Registry created"
}

# Function to setup namespace and secrets
setup_namespace() {
    log $BLUE "📦 Setting up namespace and secrets..."
    
    # Create namespace
    kubectl create namespace zeal-production --dry-run=client -o yaml | kubectl apply -f -
    
    # Create Kubernetes service account
    kubectl create serviceaccount zeal-sa -n zeal-production --dry-run=client -o yaml | kubectl apply -f -
    
    # Annotate service account for Workload Identity
    kubectl annotate serviceaccount zeal-sa \
        -n zeal-production \
        iam.gke.io/gcp-service-account=zeal-gke-sa@${PROJECT_ID}.iam.gserviceaccount.com
    
    # Get secrets from Secret Manager
    DB_PASSWORD=$(gcloud secrets versions access latest --secret=postgres-password)
    REDIS_AUTH=$(gcloud secrets versions access latest --secret=redis-auth)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    # Create Kubernetes secret
    kubectl create secret generic zeal-secrets \
        --from-literal=database-password="$DB_PASSWORD" \
        --from-literal=redis-auth="$REDIS_AUTH" \
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
        
        # Set namespace for auth deployment
        export NAMESPACE="zeal-production"
        
        # Run auth deployment script
        bash "$SCRIPT_DIR/../auth/deploy-auth.sh" gcp
        
        log $GREEN "✅ Authorization system deployed"
    fi
}

deploy_zeal() {
    log $BLUE "🚀 Deploying Zeal application..."
    
    # Get Cloud SQL connection name
    CLOUD_SQL_CONNECTION=$(gcloud sql instances describe ${CLUSTER_NAME}-postgres --format="value(connectionName)")
    CLOUD_SQL_TIMESCALE=$(gcloud sql instances describe ${CLUSTER_NAME}-timescale --format="value(connectionName)")
    
    # Create ConfigMap
    cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: zeal-config
  namespace: zeal-production
data:
  DATABASE_URL: "postgresql://zeal_user:${DB_PASSWORD}@localhost:5432/zeal_db?host=/cloudsql/${CLOUD_SQL_CONNECTION}"
  TIMESCALE_URL: "postgresql://zeal_user:${DB_PASSWORD}@localhost:5433/zeal_traces?host=/cloudsql/${CLOUD_SQL_TIMESCALE}"
  REDIS_URL: "redis://:${REDIS_AUTH}@${REDIS_HOST}:6379"
  NEXT_PUBLIC_API_URL: "https://$DOMAIN"
  NEXT_PUBLIC_BASE_URL: "https://$DOMAIN"
  NEXTAUTH_URL: "https://$DOMAIN"
  GCS_BUCKET: "${PROJECT_ID}-zeal-storage"
  NEXT_PUBLIC_CRDT_SERVER_URL: "wss://$DOMAIN/ws"
EOF
    
    # Deploy application with Cloud SQL Proxy sidecar
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
        image: ${REGION}-docker.pkg.dev/${PROJECT_ID}/zeal/zeal:latest
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
      - name: cloud-sql-proxy
        image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.6
        args:
          - "--private-ip"
          - "--port=5432"
          - "${CLOUD_SQL_CONNECTION}"
          - "--port=5433"
          - "${CLOUD_SQL_TIMESCALE}"
        securityContext:
          runAsNonRoot: true
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
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
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
spec:
  tls:
  - hosts:
    - $DOMAIN
    secretName: zeal-tls
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
        log $BLUE "📊 Setting up Google Cloud Monitoring..."
        
        # Enable monitoring for GKE
        gcloud container clusters update $CLUSTER_NAME \
            --region $REGION \
            --enable-cloud-monitoring
        
        # Install Google Cloud Monitoring agent
        kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/prometheus-engine/main/manifests/setup.yaml
        kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/prometheus-engine/main/manifests/operator.yaml
        
        # Create monitoring configuration
        cat <<EOF | kubectl apply -f -
apiVersion: monitoring.coreos.com/v1
kind: PodMonitoring
metadata:
  name: zeal-monitoring
  namespace: zeal-production
spec:
  selector:
    matchLabels:
      app: zeal
  endpoints:
  - port: metrics
    interval: 30s
EOF
        
        log $GREEN "✅ Monitoring configured"
    fi
}

# Function to setup backups
setup_backups() {
    if [ "$ENABLE_BACKUPS" = "true" ]; then
        log $BLUE "💾 Setting up backups..."
        
        # Enable automated backups for Cloud SQL
        gcloud sql instances patch ${CLUSTER_NAME}-postgres \
            --backup-start-time=03:00 \
            --enable-point-in-time-recovery
        
        # Create backup schedule for GKE
        gcloud beta container backup-restore backup-plans create zeal-backup-plan \
            --project=$PROJECT_ID \
            --location=$REGION \
            --cluster=projects/${PROJECT_ID}/locations/${REGION}/clusters/${CLUSTER_NAME} \
            --all-namespaces \
            --include-volume-data \
            --cron-schedule="0 2 * * *" \
            --backup-retain-days=30
        
        log $GREEN "✅ Backup configured"
    fi
}

# Function to display connection information
display_info() {
    log $CYAN "
╔═══════════════════════════════════════════════════════════╗
║              Zeal GCP Deployment Complete                  ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  🌐 Application URL: https://$DOMAIN                      ║
║  🎯 GKE Cluster: $CLUSTER_NAME                           ║
║  🌍 Region: $REGION                                      ║
║  📦 Project: $PROJECT_ID                                 ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                    GCP Resources                          ║
╠═══════════════════════════════════════════════════════════╣
║  Cloud SQL: ${CLUSTER_NAME}-postgres                     ║
║  Memorystore: ${CLUSTER_NAME}-redis                      ║
║  Storage: gs://${PROJECT_ID}-zeal-storage                ║
║  Registry: ${REGION}-docker.pkg.dev/${PROJECT_ID}/zeal   ║
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
║  Access GKE cluster:                                      ║
║    gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"
}

# Main deployment function
main() {
    log $MAGENTA "
╔═══════════════════════════════════════════════════════════╗
║              Zeal GCP GKE Deployment Script               ║
╚═══════════════════════════════════════════════════════════╝
"
    
    check_prerequisites
    create_infrastructure
    create_gke_cluster
    setup_workload_identity
    install_nginx_ingress
    setup_cert_manager
    create_cloud_sql
    create_redis
    create_storage
    create_artifact_registry
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