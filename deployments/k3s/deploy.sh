#!/bin/bash

# Zeal K3s Production Deployment Script
# This script deploys Zeal to a K3s cluster for self-hosted production use

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_NAME="${DEPLOYMENT_NAME:-zeal}"
NAMESPACE="${NAMESPACE:-zeal-production}"
DOMAIN="${DOMAIN:-zeal.local}"
STORAGE_CLASS="${STORAGE_CLASS:-local-path}"
ENABLE_MONITORING="${ENABLE_MONITORING:-true}"
ENABLE_BACKUPS="${ENABLE_BACKUPS:-true}"
ENABLE_TLS="${ENABLE_TLS:-true}"
POSTGRES_STORAGE_SIZE="${POSTGRES_STORAGE_SIZE:-20Gi}"
TIMESCALE_STORAGE_SIZE="${TIMESCALE_STORAGE_SIZE:-50Gi}"
REDIS_STORAGE_SIZE="${REDIS_STORAGE_SIZE:-10Gi}"
MINIO_STORAGE_SIZE="${MINIO_STORAGE_SIZE:-100Gi}"

# Function to print colored output
log() {
    local color=$1
    shift
    echo -e "${color}$@${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log $BLUE "🔍 Checking prerequisites..."
    
    # Check for k3s
    if ! command -v kubectl &> /dev/null; then
        log $RED "❌ kubectl not found. Please install k3s first."
        log $YELLOW "   Run: curl -sfL https://get.k3s.io | sh -"
        exit 1
    fi
    
    # Check for helm
    if ! command -v helm &> /dev/null; then
        log $YELLOW "⚠️  Helm not found. Installing Helm..."
        curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
    fi
    
    # Check for jq
    if ! command -v jq &> /dev/null; then
        log $YELLOW "⚠️  jq not found. Please install jq for JSON processing."
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info &> /dev/null; then
        log $RED "❌ Cannot connect to Kubernetes cluster. Please ensure k3s is running."
        exit 1
    fi
    
    log $GREEN "✅ All prerequisites met"
}

# Function to create namespace
create_namespace() {
    log $BLUE "📦 Creating namespace: $NAMESPACE"
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    kubectl label namespace $NAMESPACE name=$NAMESPACE --overwrite
}

# Function to generate secrets
generate_secrets() {
    log $BLUE "🔐 Generating secrets..."
    
    # Generate random passwords if not provided
    DB_PASSWORD="${DB_PASSWORD:-$(openssl rand -base64 32)}"
    REDIS_PASSWORD="${REDIS_PASSWORD:-$(openssl rand -base64 32)}"
    NEXTAUTH_SECRET="${NEXTAUTH_SECRET:-$(openssl rand -base64 32)}"
    MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:-$(openssl rand -base64 32)}"
    
    # Create secrets manifest
    cat > "$SCRIPT_DIR/manifests/secrets.yaml" <<EOF
apiVersion: v1
kind: Secret
metadata:
  name: zeal-secrets
  namespace: $NAMESPACE
type: Opaque
stringData:
  database-password: "$DB_PASSWORD"
  redis-password: "$REDIS_PASSWORD"
  nextauth-secret: "$NEXTAUTH_SECRET"
  minio-root-password: "$MINIO_ROOT_PASSWORD"
EOF
    
    kubectl apply -f "$SCRIPT_DIR/manifests/secrets.yaml"
    log $GREEN "✅ Secrets created"
}

# Function to deploy cert-manager for TLS
deploy_cert_manager() {
    if [ "$ENABLE_TLS" = "true" ]; then
        log $BLUE "🔒 Deploying cert-manager for TLS..."
        
        # Install cert-manager
        kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
        
        # Wait for cert-manager to be ready
        kubectl wait --for=condition=available --timeout=300s deployment/cert-manager -n cert-manager
        kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-webhook -n cert-manager
        kubectl wait --for=condition=available --timeout=300s deployment/cert-manager-cainjector -n cert-manager
        
        # Create ClusterIssuer for Let's Encrypt
        cat > "$SCRIPT_DIR/manifests/cluster-issuer.yaml" <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ${ACME_EMAIL:-admin@$DOMAIN}
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: traefik
EOF
        
        kubectl apply -f "$SCRIPT_DIR/manifests/cluster-issuer.yaml"
        log $GREEN "✅ Cert-manager deployed"
    fi
}

# Function to deploy PostgreSQL
deploy_postgresql() {
    log $BLUE "🐘 Deploying PostgreSQL..."
    
    cat > "$SCRIPT_DIR/manifests/postgresql.yaml" <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: $STORAGE_CLASS
  resources:
    requests:
      storage: $POSTGRES_STORAGE_SIZE
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: $NAMESPACE
spec:
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: $NAMESPACE
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg15
        env:
        - name: POSTGRES_DB
          value: zeal_db
        - name: POSTGRES_USER
          value: zeal_user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: database-password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: init-script
          mountPath: /docker-entrypoint-initdb.d
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - zeal_user
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - zeal_user
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc
      - name: init-script
        configMap:
          name: postgres-init
EOF
    
    kubectl apply -f "$SCRIPT_DIR/manifests/postgresql.yaml"
    log $GREEN "✅ PostgreSQL deployed"
}

# Function to deploy TimescaleDB
deploy_timescaledb() {
    log $BLUE "⏰ Deploying TimescaleDB..."
    
    cat > "$SCRIPT_DIR/manifests/timescaledb.yaml" <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: timescale-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: $STORAGE_CLASS
  resources:
    requests:
      storage: $TIMESCALE_STORAGE_SIZE
---
apiVersion: v1
kind: Service
metadata:
  name: timescaledb
  namespace: $NAMESPACE
spec:
  selector:
    app: timescaledb
  ports:
    - port: 5433
      targetPort: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: timescaledb
  namespace: $NAMESPACE
spec:
  serviceName: timescaledb
  replicas: 1
  selector:
    matchLabels:
      app: timescaledb
  template:
    metadata:
      labels:
        app: timescaledb
    spec:
      containers:
      - name: timescaledb
        image: timescale/timescaledb:latest-pg15
        env:
        - name: POSTGRES_DB
          value: zeal_traces
        - name: POSTGRES_USER
          value: zeal_user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: database-password
        - name: PGDATA
          value: /var/lib/postgresql/data/pgdata
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: timescale-storage
          mountPath: /var/lib/postgresql/data
        - name: init-script
          mountPath: /docker-entrypoint-initdb.d
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        livenessProbe:
          exec:
            command:
            - pg_isready
            - -U
            - zeal_user
          initialDelaySeconds: 30
          periodSeconds: 10
      volumes:
      - name: timescale-storage
        persistentVolumeClaim:
          claimName: timescale-pvc
      - name: init-script
        configMap:
          name: timescale-init
EOF
    
    kubectl apply -f "$SCRIPT_DIR/manifests/timescaledb.yaml"
    log $GREEN "✅ TimescaleDB deployed"
}

# Function to deploy Redis
deploy_redis() {
    log $BLUE "🔴 Deploying Redis..."
    
    cat > "$SCRIPT_DIR/manifests/redis.yaml" <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: $STORAGE_CLASS
  resources:
    requests:
      storage: $REDIS_STORAGE_SIZE
---
apiVersion: v1
kind: Service
metadata:
  name: redis
  namespace: $NAMESPACE
spec:
  selector:
    app: redis
  ports:
    - port: 6379
      targetPort: 6379
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: redis
  template:
    metadata:
      labels:
        app: redis
    spec:
      containers:
      - name: redis
        image: redis:7-alpine
        command:
        - redis-server
        - --requirepass
        - \$(REDIS_PASSWORD)
        - --appendonly
        - "yes"
        - --appendfsync
        - everysec
        env:
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: redis-password
        ports:
        - containerPort: 6379
        volumeMounts:
        - name: redis-storage
          mountPath: /data
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          tcpSocket:
            port: 6379
          initialDelaySeconds: 15
          periodSeconds: 10
        readinessProbe:
          exec:
            command:
            - redis-cli
            - ping
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: redis-storage
        persistentVolumeClaim:
          claimName: redis-pvc
EOF
    
    kubectl apply -f "$SCRIPT_DIR/manifests/redis.yaml"
    log $GREEN "✅ Redis deployed"
}

# Function to deploy MinIO
deploy_minio() {
    log $BLUE "📦 Deploying MinIO..."
    
    cat > "$SCRIPT_DIR/manifests/minio.yaml" <<EOF
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minio-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: $STORAGE_CLASS
  resources:
    requests:
      storage: $MINIO_STORAGE_SIZE
---
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: $NAMESPACE
spec:
  selector:
    app: minio
  ports:
    - name: api
      port: 9000
      targetPort: 9000
    - name: console
      port: 9001
      targetPort: 9001
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: $NAMESPACE
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      containers:
      - name: minio
        image: minio/minio:latest
        args:
        - server
        - /data
        - --console-address
        - ":9001"
        env:
        - name: MINIO_ROOT_USER
          value: minioadmin
        - name: MINIO_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: minio-root-password
        ports:
        - containerPort: 9000
        - containerPort: 9001
        volumeMounts:
        - name: minio-storage
          mountPath: /data
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /minio/health/live
            port: 9000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /minio/health/ready
            port: 9000
          initialDelaySeconds: 10
          periodSeconds: 5
      volumes:
      - name: minio-storage
        persistentVolumeClaim:
          claimName: minio-pvc
EOF
    
    kubectl apply -f "$SCRIPT_DIR/manifests/minio.yaml"
    log $GREEN "✅ MinIO deployed"
}

# Function to build and deploy CRDT server
deploy_crdt_server() {
    log $BLUE "🦀 Deploying CRDT server..."
    
    cat > "$SCRIPT_DIR/manifests/crdt-server.yaml" <<EOF
apiVersion: v1
kind: Service
metadata:
  name: crdt-server
  namespace: $NAMESPACE
spec:
  selector:
    app: crdt-server
  ports:
    - port: 8080
      targetPort: 8080
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: crdt-server
  namespace: $NAMESPACE
spec:
  replicas: 2
  selector:
    matchLabels:
      app: crdt-server
  template:
    metadata:
      labels:
        app: crdt-server
    spec:
      containers:
      - name: crdt-server
        image: ${REGISTRY:-localhost:5000}/zeal-crdt-server:latest
        env:
        - name: REDIS_URL
          value: redis://:$(REDIS_PASSWORD)@redis:6379
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: redis-password
        - name: RUST_LOG
          value: info
        ports:
        - containerPort: 8080
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 10
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
EOF
    
    kubectl apply -f "$SCRIPT_DIR/manifests/crdt-server.yaml"
    log $GREEN "✅ CRDT server deployed"
}

# Function to deploy Zeal application
deploy_zeal_app() {
    log $BLUE "🚀 Deploying Zeal application..."
    
    # Create ConfigMap for environment variables
    cat > "$SCRIPT_DIR/manifests/zeal-config.yaml" <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: zeal-config
  namespace: $NAMESPACE
data:
  DATABASE_URL: "postgresql://zeal_user:\$(DATABASE_PASSWORD)@postgres:5432/zeal_db?schema=public"
  TIMESCALE_HOST: "timescaledb"
  TIMESCALE_PORT: "5432"
  TIMESCALE_DATABASE: "zeal_traces"
  TIMESCALE_USER: "zeal_user"
  REDIS_URL: "redis://:\$(REDIS_PASSWORD)@redis:6379"
  NEXT_PUBLIC_CRDT_SERVER_URL: "ws://crdt-server:8080"
  NEXT_PUBLIC_API_URL: "https://$DOMAIN"
  NEXT_PUBLIC_BASE_URL: "https://$DOMAIN"
  NEXTAUTH_URL: "https://$DOMAIN"
  MINIO_ENDPOINT: "minio:9000"
  MINIO_ACCESS_KEY: "minioadmin"
  MINIO_BUCKET: "zeal-uploads"
  MINIO_USE_SSL: "false"
  USE_TEMPLATE_REPOSITORY: "true"
  AUTO_INGEST_TEMPLATES: "true"
  NEXT_PUBLIC_ENABLE_COLLABORATION: "true"
  NEXT_PUBLIC_ENABLE_FLOW_TRACING: "true"
  NEXT_PUBLIC_ENABLE_VERSION_HISTORY: "true"
  NEXT_PUBLIC_EMBED_ENABLED: "true"
EOF
    
    kubectl apply -f "$SCRIPT_DIR/manifests/zeal-config.yaml"
    
    # Deploy Zeal application
    cat > "$SCRIPT_DIR/manifests/zeal-app.yaml" <<EOF
apiVersion: v1
kind: Service
metadata:
  name: zeal
  namespace: $NAMESPACE
spec:
  selector:
    app: zeal
  ports:
    - port: 3000
      targetPort: 3000
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: zeal
  namespace: $NAMESPACE
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
      initContainers:
      - name: wait-for-postgres
        image: busybox:1.35
        command: ['sh', '-c', 'until nc -z postgres 5432; do echo waiting for postgres; sleep 2; done']
      - name: wait-for-redis
        image: busybox:1.35
        command: ['sh', '-c', 'until nc -z redis 6379; do echo waiting for redis; sleep 2; done']
      containers:
      - name: zeal
        image: ${REGISTRY:-localhost:5000}/zeal:latest
        envFrom:
        - configMapRef:
            name: zeal-config
        env:
        - name: DATABASE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: database-password
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: redis-password
        - name: NEXTAUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: nextauth-secret
        - name: MINIO_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: minio-root-password
        - name: TIMESCALE_PASSWORD
          valueFrom:
            secretKeyRef:
              name: zeal-secrets
              key: database-password
        ports:
        - containerPort: 3000
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
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
EOF
    
    kubectl apply -f "$SCRIPT_DIR/manifests/zeal-app.yaml"
    log $GREEN "✅ Zeal application deployed"
}

# Function to deploy Ingress
deploy_ingress() {
    log $BLUE "🌐 Deploying Ingress..."
    
    local tls_config=""
    if [ "$ENABLE_TLS" = "true" ]; then
        tls_config="
  tls:
  - hosts:
    - $DOMAIN
    secretName: zeal-tls"
    fi
    
    cat > "$SCRIPT_DIR/manifests/ingress.yaml" <<EOF
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: zeal-ingress
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/ingress.class: traefik
    ${ENABLE_TLS:+cert-manager.io/cluster-issuer: letsencrypt-prod}
    traefik.ingress.kubernetes.io/router.middlewares: $NAMESPACE-cors@kubernetescrd
spec:$tls_config
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
      - path: /ws
        pathType: Prefix
        backend:
          service:
            name: crdt-server
            port:
              number: 8080
      - path: /zip/events
        pathType: Prefix
        backend:
          service:
            name: zeal
            port:
              number: 3000
EOF
    
    # Create CORS middleware
    cat > "$SCRIPT_DIR/manifests/cors-middleware.yaml" <<EOF
apiVersion: traefik.containo.us/v1alpha1
kind: Middleware
metadata:
  name: cors
  namespace: $NAMESPACE
spec:
  headers:
    accessControlAllowMethods:
      - GET
      - POST
      - PUT
      - DELETE
      - OPTIONS
    accessControlAllowHeaders:
      - "*"
    accessControlAllowOriginList:
      - "*"
    accessControlMaxAge: 100
    addVaryHeader: true
EOF
    
    kubectl apply -f "$SCRIPT_DIR/manifests/cors-middleware.yaml"
    kubectl apply -f "$SCRIPT_DIR/manifests/ingress.yaml"
    log $GREEN "✅ Ingress deployed"
}

# Function to deploy monitoring stack
deploy_monitoring() {
    if [ "$ENABLE_MONITORING" = "true" ]; then
        log $BLUE "📊 Deploying monitoring stack..."
        
        # Deploy Prometheus
        helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
        helm repo update
        
        helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
            --namespace monitoring \
            --create-namespace \
            --set grafana.adminPassword="${GRAFANA_PASSWORD:-$(openssl rand -base64 12)}" \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.storageClassName=$STORAGE_CLASS \
            --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=20Gi
        
        log $GREEN "✅ Monitoring stack deployed"
    fi
}

# Function to setup backups
setup_backups() {
    if [ "$ENABLE_BACKUPS" = "true" ]; then
        log $BLUE "💾 Setting up backups..."
        
        # Deploy Velero for backups
        helm repo add vmware-tanzu https://vmware-tanzu.github.io/helm-charts
        helm repo update
        
        # Note: This requires configuration for your backup storage provider
        # Example for local MinIO backup storage
        cat > "$SCRIPT_DIR/backup/backup-cronjob.yaml" <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: $NAMESPACE
spec:
  schedule: "0 2 * * *"  # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: zeal-secrets
                  key: database-password
            command:
            - /bin/bash
            - -c
            - |
              DATE=\$(date +%Y%m%d_%H%M%S)
              pg_dump -h postgres -U zeal_user -d zeal_db > /backup/zeal_db_\${DATE}.sql
              find /backup -name "*.sql" -mtime +7 -delete
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          restartPolicy: OnFailure
          volumes:
          - name: backup-storage
            persistentVolumeClaim:
              claimName: backup-pvc
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: backup-pvc
  namespace: $NAMESPACE
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: $STORAGE_CLASS
  resources:
    requests:
      storage: 50Gi
EOF
        
        kubectl apply -f "$SCRIPT_DIR/backup/backup-cronjob.yaml"
        log $GREEN "✅ Backup system configured"
    fi
}

# Function to create init scripts ConfigMaps
create_init_scripts() {
    log $BLUE "📝 Creating initialization scripts..."
    
    # Copy init.sql from main repo
    if [ -f "$SCRIPT_DIR/../../init.sql" ]; then
        kubectl create configmap postgres-init \
            --from-file=init.sql="$SCRIPT_DIR/../../init.sql" \
            --namespace=$NAMESPACE \
            --dry-run=client -o yaml | kubectl apply -f -
    fi
    
    # Copy timescaledb-init.sql
    if [ -f "$SCRIPT_DIR/../../timescaledb-init.sql" ]; then
        kubectl create configmap timescale-init \
            --from-file=init.sql="$SCRIPT_DIR/../../timescaledb-init.sql" \
            --namespace=$NAMESPACE \
            --dry-run=client -o yaml | kubectl apply -f -
    fi
    
    log $GREEN "✅ Initialization scripts created"
}

# Function to wait for deployments
wait_for_deployments() {
    log $BLUE "⏳ Waiting for all deployments to be ready..."
    
    kubectl wait --for=condition=available --timeout=600s deployment --all -n $NAMESPACE
    
    log $GREEN "✅ All deployments are ready"
}

# Function to display access information
display_access_info() {
    log $CYAN "
╔═══════════════════════════════════════════════════════════╗
║                   Zeal Deployment Complete                 ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  🌐 Web UI:        https://$DOMAIN                        ║
║  🔧 CRDT Server:   wss://$DOMAIN/ws                       ║
║  📡 ZIP WebSocket: wss://$DOMAIN/zip/events               ║
║                                                           ║"
    
    if [ "$ENABLE_MONITORING" = "true" ]; then
        GRAFANA_PASSWORD=$(kubectl get secret --namespace monitoring prometheus-grafana -o jsonpath="{.data.admin-password}" | base64 --decode)
        log $CYAN "║  📊 Grafana:       https://$DOMAIN/grafana                ║
║     Username: admin                                      ║
║     Password: $GRAFANA_PASSWORD                          ║"
    fi
    
    log $CYAN "║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                    Database Credentials                   ║
╠═══════════════════════════════════════════════════════════╣
║  PostgreSQL:                                              ║
║    Host: postgres.$NAMESPACE.svc.cluster.local            ║
║    Port: 5432                                            ║
║    Database: zeal_db                                     ║
║    Username: zeal_user                                   ║
║                                                           ║
║  TimescaleDB:                                            ║
║    Host: timescaledb.$NAMESPACE.svc.cluster.local        ║
║    Port: 5433                                            ║
║    Database: zeal_traces                                 ║
║    Username: zeal_user                                   ║
║                                                           ║
║  Redis:                                                   ║
║    Host: redis.$NAMESPACE.svc.cluster.local              ║
║    Port: 6379                                            ║
║                                                           ║
║  MinIO:                                                   ║
║    API: minio.$NAMESPACE.svc.cluster.local:9000          ║
║    Console: https://$DOMAIN/minio                        ║
║    Username: minioadmin                                  ║
║                                                           ║
╠═══════════════════════════════════════════════════════════╣
║                    Useful Commands                        ║
╠═══════════════════════════════════════════════════════════╣
║  View logs:                                               ║
║    kubectl logs -f deployment/zeal -n $NAMESPACE          ║
║                                                           ║
║  Scale deployment:                                        ║
║    kubectl scale deployment/zeal --replicas=5 -n $NAMESPACE║
║                                                           ║
║  Port forward for local access:                          ║
║    kubectl port-forward svc/zeal 3000:3000 -n $NAMESPACE ║
║                                                           ║
║  Get pod status:                                         ║
║    kubectl get pods -n $NAMESPACE                        ║
║                                                           ║
║  View secrets:                                           ║
║    kubectl get secret zeal-secrets -o yaml -n $NAMESPACE ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
"
}

# Main deployment function
main() {
    log $MAGENTA "
╔═══════════════════════════════════════════════════════════╗
║           Zeal K3s Production Deployment Script           ║
╚═══════════════════════════════════════════════════════════╝
"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            --domain)
                DOMAIN="$2"
                shift 2
                ;;
            --storage-class)
                STORAGE_CLASS="$2"
                shift 2
                ;;
            --no-monitoring)
                ENABLE_MONITORING="false"
                shift
                ;;
            --no-backups)
                ENABLE_BACKUPS="false"
                shift
                ;;
            --no-tls)
                ENABLE_TLS="false"
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --namespace NAME       Kubernetes namespace (default: zeal-production)"
                echo "  --domain DOMAIN       Domain name (default: zeal.local)"
                echo "  --storage-class NAME  Storage class name (default: local-path)"
                echo "  --no-monitoring       Disable monitoring stack deployment"
                echo "  --no-backups         Disable backup system"
                echo "  --no-tls            Disable TLS/HTTPS"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                log $RED "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Run deployment steps
    check_prerequisites
    create_namespace
    generate_secrets
    deploy_cert_manager
    create_init_scripts
    deploy_postgresql
    deploy_timescaledb
    deploy_redis
    deploy_minio
    deploy_crdt_server
    deploy_zeal_app
    deploy_ingress
    deploy_monitoring
    setup_backups
    wait_for_deployments
    display_access_info
    
    log $GREEN "
✅ Deployment completed successfully!
   
   To access Zeal, configure your DNS to point $DOMAIN to your k3s cluster IP.
   Or add an entry to /etc/hosts:
   
   echo \"$(kubectl get node -o wide | grep master | awk '{print $6}') $DOMAIN\" | sudo tee -a /etc/hosts
"
}

# Run main function
main "$@"