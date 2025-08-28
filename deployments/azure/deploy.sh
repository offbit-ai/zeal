#!/bin/bash

# Zeal Azure AKS Deployment Script
# Production deployment on Microsoft Azure

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
RESOURCE_GROUP="${RESOURCE_GROUP:-zeal-production-rg}"
CLUSTER_NAME="${CLUSTER_NAME:-zeal-aks}"
LOCATION="${LOCATION:-eastus}"
DOMAIN="${DOMAIN:-zeal.example.com}"
ENVIRONMENT="${ENVIRONMENT:-production}"
NODE_COUNT="${NODE_COUNT:-3}"
NODE_VM_SIZE="${NODE_VM_SIZE:-Standard_D4s_v3}"
POSTGRES_SKU="${POSTGRES_SKU:-GP_Gen5_4}"
REDIS_SKU="${REDIS_SKU:-Premium_P1}"
ENABLE_MONITORING="${ENABLE_MONITORING:-true}"
ENABLE_BACKUPS="${ENABLE_BACKUPS:-true}"

# Function to print colored output
log() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log $BLUE "🔍 Checking prerequisites..."
    
    # Check for Azure CLI
    if ! command -v az &> /dev/null; then
        log $RED "❌ Azure CLI not found. Please install Azure CLI."
        log $YELLOW "Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
        exit 1
    fi
    
    # Check for kubectl
    if ! command -v kubectl &> /dev/null; then
        log $YELLOW "⚠️  kubectl not found. Installing kubectl..."
        az aks install-cli
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
    
    # Check Azure login
    if ! az account show &> /dev/null; then
        log $YELLOW "⚠️  Not logged into Azure. Please login..."
        az login
    fi
    
    # Set subscription
    SUBSCRIPTION_ID=$(az account show --query id -o tsv)
    log $GREEN "✅ Using subscription: $SUBSCRIPTION_ID"
    
    log $GREEN "✅ All prerequisites met"
}

# Function to create resource group
create_resource_group() {
    log $BLUE "📦 Creating resource group..."
    
    az group create \
        --name $RESOURCE_GROUP \
        --location $LOCATION
    
    log $GREEN "✅ Resource group created"
}

# Function to create infrastructure with Terraform
create_infrastructure() {
    log $BLUE "🏗️ Creating Azure infrastructure with Terraform..."
    
    cd "$SCRIPT_DIR/terraform"
    
    # Initialize Terraform
    terraform init
    
    # Plan deployment
    terraform plan \
        -var="resource_group=$RESOURCE_GROUP" \
        -var="location=$LOCATION" \
        -var="cluster_name=$CLUSTER_NAME" \
        -var="domain=$DOMAIN" \
        -var="environment=$ENVIRONMENT" \
        -out=tfplan
    
    # Apply infrastructure
    terraform apply tfplan
    
    # Export outputs
    export VNET_ID=$(terraform output -raw vnet_id)
    export SUBNET_ID=$(terraform output -raw subnet_id)
    export POSTGRES_FQDN=$(terraform output -raw postgres_fqdn)
    export REDIS_HOSTNAME=$(terraform output -raw redis_hostname)
    export STORAGE_ACCOUNT=$(terraform output -raw storage_account)
    export CONTAINER_REGISTRY=$(terraform output -raw container_registry)
    export KEY_VAULT_NAME=$(terraform output -raw key_vault_name)
    
    cd "$SCRIPT_DIR"
    log $GREEN "✅ Infrastructure created"
}

# Function to create AKS cluster
create_aks_cluster() {
    log $BLUE "🎯 Creating AKS cluster..."
    
    # Create AKS cluster
    az aks create \
        --resource-group $RESOURCE_GROUP \
        --name $CLUSTER_NAME \
        --location $LOCATION \
        --node-count $NODE_COUNT \
        --node-vm-size $NODE_VM_SIZE \
        --network-plugin azure \
        --vnet-subnet-id $SUBNET_ID \
        --service-cidr 10.2.0.0/16 \
        --dns-service-ip 10.2.0.10 \
        --docker-bridge-address 172.17.0.1/16 \
        --enable-managed-identity \
        --enable-addons monitoring,azure-policy,azure-keyvault-secrets-provider \
        --enable-msi-auth-for-monitoring \
        --enable-cluster-autoscaler \
        --min-count 2 \
        --max-count 10 \
        --generate-ssh-keys
    
    # Get credentials
    az aks get-credentials \
        --resource-group $RESOURCE_GROUP \
        --name $CLUSTER_NAME \
        --overwrite-existing
    
    log $GREEN "✅ AKS cluster created"
}

# Function to install NGINX Ingress Controller
install_nginx_ingress() {
    log $BLUE "🔄 Installing NGINX Ingress Controller..."
    
    # Add ingress-nginx repository
    helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
    helm repo update
    
    # Install ingress controller with Azure Load Balancer
    helm install nginx-ingress ingress-nginx/ingress-nginx \
        --namespace ingress-nginx \
        --create-namespace \
        --set controller.service.type=LoadBalancer \
        --set controller.service.annotations."service\.beta\.kubernetes\.io/azure-load-balancer-health-probe-request-path"=/healthz \
        --set controller.service.externalTrafficPolicy=Local
    
    # Wait for external IP
    log $YELLOW "⏳ Waiting for External IP..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=120s
    
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

# Function to setup cert-manager
setup_cert_manager() {
    log $BLUE "🔒 Setting up cert-manager..."
    
    # Install cert-manager
    kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
    
    # Wait for cert-manager to be ready
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
    kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
    
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
          class: nginx
EOF
    
    log $GREEN "✅ cert-manager configured"
}

# Function to create Azure PostgreSQL
create_postgresql() {
    log $BLUE "🐘 Creating Azure Database for PostgreSQL..."
    
    # Generate admin password
    DB_PASSWORD=$(openssl rand -base64 32)
    
    # Store in Key Vault
    az keyvault secret set \
        --vault-name $KEY_VAULT_NAME \
        --name postgres-password \
        --value "$DB_PASSWORD"
    
    # Create PostgreSQL server
    az postgres server create \
        --resource-group $RESOURCE_GROUP \
        --name "${CLUSTER_NAME}-postgres" \
        --location $LOCATION \
        --admin-user zealadmin \
        --admin-password "$DB_PASSWORD" \
        --sku-name $POSTGRES_SKU \
        --version 11 \
        --storage-size 102400 \
        --backup-retention 30 \
        --geo-redundant-backup Enabled \
        --auto-grow Enabled
    
    # Configure firewall for Azure services
    az postgres server firewall-rule create \
        --resource-group $RESOURCE_GROUP \
        --server-name "${CLUSTER_NAME}-postgres" \
        --name AllowAzureServices \
        --start-ip-address 0.0.0.0 \
        --end-ip-address 0.0.0.0
    
    # Create database
    az postgres db create \
        --resource-group $RESOURCE_GROUP \
        --server-name "${CLUSTER_NAME}-postgres" \
        --name zeal_db
    
    # Enable Azure AD authentication
    PRINCIPAL_ID=$(az aks show --resource-group $RESOURCE_GROUP --name $CLUSTER_NAME --query identityProfile.kubeletidentity.objectId -o tsv)
    
    az postgres server ad-admin create \
        --resource-group $RESOURCE_GROUP \
        --server-name "${CLUSTER_NAME}-postgres" \
        --display-name AKSAdmin \
        --object-id $PRINCIPAL_ID
    
    log $GREEN "✅ PostgreSQL created"
}

# Function to create Azure Cache for Redis
create_redis() {
    log $BLUE "🔴 Creating Azure Cache for Redis..."
    
    # Create Redis cache
    az redis create \
        --resource-group $RESOURCE_GROUP \
        --name "${CLUSTER_NAME}-redis" \
        --location $LOCATION \
        --sku $REDIS_SKU \
        --vm-size c1 \
        --enable-non-ssl-port
    
    # Get access keys
    REDIS_KEY=$(az redis list-keys \
        --resource-group $RESOURCE_GROUP \
        --name "${CLUSTER_NAME}-redis" \
        --query primaryKey -o tsv)
    
    # Store in Key Vault
    az keyvault secret set \
        --vault-name $KEY_VAULT_NAME \
        --name redis-key \
        --value "$REDIS_KEY"
    
    log $GREEN "✅ Redis cache created"
}

# Function to create Azure Storage
create_storage() {
    log $BLUE "📦 Creating Azure Storage..."
    
    # Create storage account
    STORAGE_ACCOUNT_NAME="${CLUSTER_NAME}storage$(openssl rand -hex 4)"
    
    az storage account create \
        --resource-group $RESOURCE_GROUP \
        --name $STORAGE_ACCOUNT_NAME \
        --location $LOCATION \
        --sku Standard_GRS \
        --kind StorageV2 \
        --https-only true \
        --min-tls-version TLS1_2
    
    # Get connection string
    STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
        --resource-group $RESOURCE_GROUP \
        --name $STORAGE_ACCOUNT_NAME \
        --query connectionString -o tsv)
    
    # Create containers
    az storage container create \
        --name uploads \
        --connection-string "$STORAGE_CONNECTION_STRING" \
        --public-access off
    
    az storage container create \
        --name backups \
        --connection-string "$STORAGE_CONNECTION_STRING" \
        --public-access off
    
    # Store in Key Vault
    az keyvault secret set \
        --vault-name $KEY_VAULT_NAME \
        --name storage-connection-string \
        --value "$STORAGE_CONNECTION_STRING"
    
    log $GREEN "✅ Storage account created"
}

# Function to create namespace and secrets
setup_namespace() {
    log $BLUE "📦 Setting up namespace and secrets..."
    
    # Create namespace
    kubectl create namespace zeal-production --dry-run=client -o yaml | kubectl apply -f -
    
    # Get secrets from Key Vault
    DB_PASSWORD=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name postgres-password --query value -o tsv)
    REDIS_KEY=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name redis-key --query value -o tsv)
    STORAGE_CONNECTION_STRING=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name storage-connection-string --query value -o tsv)
    NEXTAUTH_SECRET=$(openssl rand -base64 32)
    
    # Create Kubernetes secret
    kubectl create secret generic zeal-secrets \
        --from-literal=database-password="$DB_PASSWORD" \
        --from-literal=redis-key="$REDIS_KEY" \
        --from-literal=storage-connection-string="$STORAGE_CONNECTION_STRING" \
        --from-literal=nextauth-secret="$NEXTAUTH_SECRET" \
        --namespace=zeal-production \
        --dry-run=client -o yaml | kubectl apply -f -
    
    log $GREEN "✅ Namespace and secrets configured"
}

# Function to deploy Zeal application
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
  DATABASE_URL: "postgresql://zealadmin@${CLUSTER_NAME}-postgres:${DB_PASSWORD}@${CLUSTER_NAME}-postgres.postgres.database.azure.com/zeal_db?ssl=true"
  REDIS_URL: "redis://:${REDIS_KEY}@${CLUSTER_NAME}-redis.redis.cache.windows.net:6379"
  NEXT_PUBLIC_API_URL: "https://$DOMAIN"
  NEXT_PUBLIC_BASE_URL: "https://$DOMAIN"
  NEXTAUTH_URL: "https://$DOMAIN"
  AZURE_STORAGE_ACCOUNT: "$STORAGE_ACCOUNT_NAME"
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
        aadpodidbinding: zeal-identity
    spec:
      containers:
      - name: zeal
        image: ${CONTAINER_REGISTRY}.azurecr.io/zeal:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: zeal-config
        - secretRef:
            name: zeal-secrets
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
    nginx.ingress.kubernetes.io/proxy-body-size: "100m"
    nginx.ingress.kubernetes.io/proxy-connect-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "600"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "600"
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
        log $BLUE "📊 Setting up Azure Monitor..."
        
        # Create Log Analytics workspace
        WORKSPACE_ID=$(az monitor log-analytics workspace create \
            --resource-group $RESOURCE_GROUP \
            --workspace-name "${CLUSTER_NAME}-logs" \
            --location $LOCATION \
            --query id -o tsv)
        
        # Enable Container Insights
        az aks enable-addons \
            --resource-group $RESOURCE_GROUP \
            --name $CLUSTER_NAME \
            --addons monitoring \
            --workspace-resource-id $WORKSPACE_ID
        
        # Create Application Insights
        az monitor app-insights component create \
            --resource-group $RESOURCE_GROUP \
            --app "${CLUSTER_NAME}-insights" \
            --location $LOCATION \
            --workspace $WORKSPACE_ID
        
        # Deploy Prometheus
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        helm install prometheus prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --create-namespace \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=managed-premium \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi
        
        log $GREEN "✅ Monitoring configured"
    fi
}

# Function to setup backups
setup_backups() {
    if [ "$ENABLE_BACKUPS" = "true" ]; then
        log $BLUE "💾 Setting up Azure Backup..."
        
        # Create Recovery Services vault
        az backup vault create \
            --resource-group $RESOURCE_GROUP \
            --name "${CLUSTER_NAME}-vault" \
            --location $LOCATION
        
        # Enable backup for PostgreSQL
        az backup protection enable-for-vm \
            --resource-group $RESOURCE_GROUP \
            --vault-name "${CLUSTER_NAME}-vault" \
            --vm "${CLUSTER_NAME}-postgres" \
            --policy-name DefaultPolicy
        
        # Create backup policy for AKS
        cat <<EOF | kubectl apply -f -
apiVersion: batch/v1
kind: CronJob
metadata:
  name: backup-job
  namespace: zeal-production
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: backup
            image: mcr.microsoft.com/azure-cli
            command:
            - /bin/sh
            - -c
            - |
              az login --identity
              # Backup database
              az postgres server backup --resource-group $RESOURCE_GROUP --name ${CLUSTER_NAME}-postgres
              # Backup to storage
              kubectl exec -n zeal-production postgres-0 -- pg_dump zeal_db | \
                az storage blob upload --account-name $STORAGE_ACCOUNT_NAME \
                  --container-name backups \
                  --name "backup-\$(date +%Y%m%d-%H%M%S).sql"
          restartPolicy: OnFailure
EOF
        
        log $GREEN "✅ Backup configured"
    fi
}

# Function to setup Azure Front Door (CDN)
setup_cdn() {
    log $BLUE "🌐 Setting up Azure Front Door..."
    
    # Create Front Door profile
    az network front-door create \
        --resource-group $RESOURCE_GROUP \
        --name "${CLUSTER_NAME}-frontdoor" \
        --backend-address $INGRESS_IP \
        --accepted-protocols Http Https \
        --forwarding-protocol HttpsOnly
    
    # Add custom domain
    az network front-door frontend-endpoint create \
        --resource-group $RESOURCE_GROUP \
        --front-door-name "${CLUSTER_NAME}-frontdoor" \
        --name custom-domain \
        --host-name $DOMAIN
    
    # Enable WAF
    az network front-door waf-policy create \
        --resource-group $RESOURCE_GROUP \
        --name "${CLUSTER_NAME}waf" \
        --mode Prevention
    
    log $GREEN "✅ Azure Front Door configured"
}

# Function to display connection information
display_info() {
    log $CYAN "
╔═══════════════════════════════════════════════════════════╗
║             Zeal Azure Deployment Complete                 ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  🌐 Application URL: https://$DOMAIN                      ║
║  🎯 AKS Cluster: $CLUSTER_NAME                           ║
║  📍 Location: $LOCATION                                  ║
║  🔗 Resource Group: $RESOURCE_GROUP                      ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                    Azure Resources                        ║
╠═══════════════════════════════════════════════════════════╣
║  PostgreSQL: ${CLUSTER_NAME}-postgres.postgres.database.azure.com
║  Redis: ${CLUSTER_NAME}-redis.redis.cache.windows.net    ║
║  Storage: $STORAGE_ACCOUNT_NAME.blob.core.windows.net    ║
║  Registry: ${CONTAINER_REGISTRY}.azurecr.io              ║
║  Key Vault: $KEY_VAULT_NAME                              ║
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
║  Access AKS cluster:                                      ║
║    az aks get-credentials -g $RESOURCE_GROUP -n $CLUSTER_NAME ║
║                                                           ║
║  View metrics:                                            ║
║    az monitor metrics list --resource <resource-id>       ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"
}

# Main deployment function
main() {
    log $MAGENTA "
╔═══════════════════════════════════════════════════════════╗
║             Zeal Azure AKS Deployment Script              ║
╚═══════════════════════════════════════════════════════════╝
"
    
    check_prerequisites
    create_resource_group
    create_infrastructure
    create_aks_cluster
    install_nginx_ingress
    setup_cert_manager
    create_postgresql
    create_redis  
    create_storage
    setup_namespace
    deploy_zeal
    setup_monitoring
    setup_backups
    setup_cdn
    display_info
    
    log $GREEN "✅ Deployment completed successfully!"
}

# Run main function
main "$@"