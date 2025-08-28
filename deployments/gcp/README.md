# Zeal GCP GKE Deployment

Enterprise-grade deployment of Zeal on Google Cloud Platform using GKE, Cloud SQL, Memorystore, and other GCP managed services.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Detailed Setup](#detailed-setup)
- [Security](#security)
- [Monitoring](#monitoring)
- [Backup & Recovery](#backup--recovery)
- [Scaling](#scaling)
- [Troubleshooting](#troubleshooting)

## Overview

This deployment leverages GCP managed services for a highly available, scalable, and secure Zeal installation:

- **GKE** - Google Kubernetes Engine for container orchestration
- **Cloud SQL PostgreSQL** - Managed PostgreSQL with regional availability
- **Cloud SQL for TimescaleDB** - Time-series database for flow traces
- **Memorystore Redis** - Managed Redis with high availability
- **Cloud Storage** - Object storage for uploads and backups
- **Cloud CDN** - Global content delivery network
- **Cloud DNS** - DNS management
- **Certificate Manager** - SSL/TLS certificate management
- **Cloud Monitoring** - Comprehensive monitoring and logging
- **Secret Manager** - Secure secrets management
- **Cloud Backup** - Automated backup solution

## Architecture

```mermaid
graph TB
    subgraph "Google Cloud Platform"
        subgraph "Cloud DNS"
            DNS[DNS Records]
        end
        
        subgraph "Cloud Load Balancing"
            LB[HTTP(S) Load Balancer]
            CDN[Cloud CDN]
        end
        
        subgraph "VPC Network"
            subgraph "GKE Subnet"
                subgraph "GKE Cluster"
                    NODES[Node Pools<br/>n2-standard-4]
                    ZEAL[Zeal Pods]
                    CRDT[CRDT Pods]
                end
            end
            
            subgraph "Database Subnet"
                PSQL[(Cloud SQL PostgreSQL<br/>Regional)]
                TSDB[(Cloud SQL TimescaleDB)]
                REDIS[(Memorystore Redis<br/>HA)]
            end
        end
        
        subgraph "Storage"
            GCS[Cloud Storage<br/>Buckets]
            AR[Artifact Registry]
        end
        
        subgraph "Management"
            MON[Cloud Monitoring]
            LOG[Cloud Logging]
            SM[Secret Manager]
            BACKUP[Cloud Backup]
        end
    end
    
    Users --> DNS
    DNS --> LB
    LB --> CDN
    CDN --> NODES
    NODES --> ZEAL
    NODES --> CRDT
    ZEAL --> PSQL
    ZEAL --> TSDB
    ZEAL --> REDIS
    ZEAL --> GCS
    ZEAL --> SM
    MON --> NODES
    LOG --> NODES
```

## Prerequisites

### Required Tools

- Google Cloud SDK (gcloud) 450.0+
- kubectl 1.28+
- Terraform 1.5+
- Helm 3.12+
- Docker

### GCP Project Setup

1. **Create or Select Project**:
```bash
# Create new project
gcloud projects create zeal-production --name="Zeal Production"

# Select existing project
gcloud config set project YOUR_PROJECT_ID
```

2. **Enable Billing**:
```bash
# List billing accounts
gcloud billing accounts list

# Link project to billing account
gcloud billing projects link YOUR_PROJECT_ID --billing-account=BILLING_ACCOUNT_ID
```

3. **Set up authentication**:
```bash
# Login to GCP
gcloud auth login

# Set application default credentials
gcloud auth application-default login
```

## Quick Start

1. **Clone the repository**:
```bash
git clone https://github.com/offbit-ai/zeal.git
cd zeal/deployments/gcp
```

2. **Configure deployment**:
```bash
# Set environment variables
export PROJECT_ID=your-project-id
export CLUSTER_NAME=zeal-gke
export REGION=us-central1
export DOMAIN=zeal.example.com

# Create terraform.tfvars
cat > terraform/terraform.tfvars << EOF
project_id   = "$PROJECT_ID"
cluster_name = "$CLUSTER_NAME"
region       = "$REGION"
domain       = "$DOMAIN"
environment  = "production"
EOF
```

3. **Run deployment**:
```bash
./deploy.sh
```

## Detailed Setup

### Step 1: Infrastructure Setup with Terraform

```bash
cd terraform

# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan -var="project_id=$PROJECT_ID" -var="domain=$DOMAIN"

# Apply infrastructure
terraform apply -var="project_id=$PROJECT_ID" -var="domain=$DOMAIN"
```

This creates:
- VPC network with regional subnets
- Cloud SQL PostgreSQL with regional HA
- Cloud SQL for TimescaleDB
- Memorystore Redis with HA
- Cloud Storage buckets
- Artifact Registry
- Secret Manager secrets
- Service accounts and IAM roles

### Step 2: GKE Cluster Creation

```bash
# Get cluster credentials
gcloud container clusters get-credentials $CLUSTER_NAME --region $REGION

# Verify cluster access
kubectl get nodes
```

### Step 3: Install Required Controllers

```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer
```

### Step 4: Configure Workload Identity

```bash
# Create Kubernetes service account
kubectl create namespace zeal-production
kubectl create serviceaccount zeal-sa -n zeal-production

# Annotate for Workload Identity
kubectl annotate serviceaccount zeal-sa \
  -n zeal-production \
  iam.gke.io/gcp-service-account=zeal-gke-sa@$PROJECT_ID.iam.gserviceaccount.com
```

### Step 5: Deploy Zeal Application

```bash
# Get secrets from Secret Manager
DB_PASSWORD=$(gcloud secrets versions access latest --secret=postgres-password)
REDIS_AUTH=$(gcloud secrets versions access latest --secret=redis-auth)

# Create Kubernetes secrets
kubectl create secret generic zeal-secrets \
  --from-literal=database-password="$DB_PASSWORD" \
  --from-literal=redis-auth="$REDIS_AUTH" \
  -n zeal-production

# Deploy application
kubectl apply -f kubernetes/
```

## Cost Optimization

### Cost Optimization Tips

1. **Use GKE Autopilot** for automatic resource optimization
2. **Preemptible instances** for non-critical workloads (significant savings)
3. **Committed Use Discounts** for predictable workloads (substantial discounts)
4. **Cloud Storage lifecycle policies** for automated tiering
5. **Regional persistent disks** instead of zonal for HA workloads
6. **Sustained use discounts** for continuous workloads

## Security

### Network Security

- Private GKE cluster with authorized networks
- VPC-native networking with IP aliasing
- Private service networking for Cloud SQL
- Cloud NAT for secure outbound access
- Network policies for pod-to-pod communication

### Identity & Access Management

- Workload Identity for pod authentication
- Service accounts with least privilege
- IAM conditions for fine-grained access control
- Binary Authorization for container image security
- Pod Security Standards enforcement

### Data Protection

- Encryption at rest for all data services
- Encryption in transit with TLS 1.3
- Customer-managed encryption keys (CMEK)
- Secret Manager for credential management
- VPC Service Controls for data exfiltration protection

### Compliance & Auditing

- Cloud Audit Logs for all API calls
- Security Command Center for threat detection
- Policy Intelligence for access analysis
- Forseti Security for compliance monitoring
- GKE security bulletins and recommendations

## Monitoring

### Cloud Monitoring

Pre-configured dashboards for:
- GKE cluster and node metrics
- Application performance metrics
- Database performance insights
- Redis cache utilization
- Custom business metrics

### Alerting

```bash
# Create alerting policy
gcloud alpha monitoring policies create \
  --policy-from-file=monitoring/alerting-policy.yaml
```

Automated alerts for:
- High CPU/memory usage
- Pod restart loops
- Database connection issues
- Cache hit rate drops
- Application error rates

### Logging

```bash
# View application logs
gcloud logging read "resource.type=k8s_container AND resource.labels.namespace_name=zeal-production"

# Create log-based metrics
gcloud logging metrics create error_rate \
  --description="Application error rate" \
  --log-filter="resource.type=k8s_container AND severity>=ERROR"
```

### SLOs and Error Budgets

```bash
# Create SLO
gcloud monitoring slos create \
  --service=zeal-production \
  --slo-id=availability-slo \
  --display-name="99.9% Availability" \
  --request-based-sli \
  --good-total-ratio-threshold=0.999
```

## Backup & Recovery

### Automated Backups

- Cloud SQL: Automated daily backups with 30-day retention
- Persistent Disks: Scheduled snapshots
- Cloud Storage: Versioning and lifecycle management
- GKE: Backup for GKE service

### Point-in-Time Recovery

```bash
# Restore Cloud SQL to specific time
gcloud sql instances clone zeal-postgres zeal-postgres-restored \
  --point-in-time='2024-01-01T12:00:00.000Z'

# Create disk snapshot
gcloud compute disks snapshot DISK_NAME \
  --zone=us-central1-a \
  --snapshot-names=zeal-data-$(date +%Y%m%d)
```

### Disaster Recovery

```bash
# Restore from backup
gcloud container clusters create zeal-gke-dr \
  --region us-west1 \
  --num-nodes 3

# Import data from backup bucket
gsutil -m cp -r gs://zeal-backups/2024-01-01/ ./restore/
```

## Scaling

### Cluster Autoscaling

```bash
# Enable cluster autoscaling
gcloud container clusters update $CLUSTER_NAME \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 10 \
  --region $REGION
```

### Horizontal Pod Autoscaling

```bash
# Enable HPA
kubectl autoscale deployment zeal \
  --cpu-percent=70 \
  --min=3 \
  --max=20 \
  -n zeal-production
```

### Vertical Pod Autoscaling

```bash
# Enable VPA
kubectl apply -f - <<EOF
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: zeal-vpa
  namespace: zeal-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: zeal
  updatePolicy:
    updateMode: "Auto"
EOF
```

### Database Scaling

```bash
# Scale Cloud SQL instance
gcloud sql instances patch zeal-postgres \
  --tier=db-n1-standard-8 \
  --backup-start-time=03:00

# Create read replica
gcloud sql instances create zeal-postgres-read \
  --master-instance-name=zeal-postgres \
  --tier=db-n1-standard-4 \
  --region=us-central1
```

## Troubleshooting

### Common Issues

#### GKE Node Issues
```bash
# Check node status
kubectl get nodes -o wide
kubectl describe node NODE_NAME

# Check node logs via Serial Console
gcloud compute instances get-serial-port-output INSTANCE_NAME --zone ZONE

# Check cluster events
kubectl get events --all-namespaces --sort-by='.lastTimestamp'
```

#### Database Connectivity Issues
```bash
# Test Cloud SQL connectivity
gcloud sql connect zeal-postgres --user=zeal_user --database=zeal_db

# Check Cloud SQL Proxy logs
kubectl logs -n zeal-production deployment/zeal -c cloud-sql-proxy

# Verify private IP connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h PRIVATE_IP -U zeal_user -d zeal_db
```

#### Load Balancer Issues
```bash
# Check ingress status
kubectl describe ingress -n zeal-production

# Check backend services
gcloud compute backend-services list
gcloud compute backend-services get-health BACKEND_SERVICE_NAME --global

# Check SSL certificates
gcloud compute ssl-certificates list
```

#### Performance Issues
```bash
# Check resource usage
kubectl top nodes
kubectl top pods -n zeal-production

# Check Cloud SQL performance
gcloud sql instances describe zeal-postgres
gcloud monitoring timeseries list \
  --filter='resource.type="cloudsql_database" AND metric.type="cloudsql.googleapis.com/database/cpu/utilization"'

# Check Redis metrics
gcloud redis instances describe zeal-redis --region=$REGION
```

### Debug Tools

```bash
# Deploy debug pod
kubectl run debug-pod --image=nicolaka/netshoot -it --rm --restart=Never

# Check DNS resolution
nslookup zeal-postgres.c.PROJECT_ID.internal

# Test network connectivity
curl -v https://zeal.example.com/api/health

# Check certificate chain
openssl s_client -connect zeal.example.com:443 -showcerts
```

## Maintenance

### Updates

```bash
# Update GKE cluster
gcloud container clusters update $CLUSTER_NAME \
  --region $REGION \
  --cluster-version=1.28.3-gke.1286000

# Update node pools
gcloud container node-pools upgrade NODE_POOL_NAME \
  --cluster=$CLUSTER_NAME \
  --region=$REGION
```

### Database Maintenance

```bash
# Schedule maintenance window
gcloud sql instances patch zeal-postgres \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=4

# Apply minor version update
gcloud sql instances patch zeal-postgres \
  --database-version=POSTGRES_15
```

## Clean Up

To destroy all resources:

```bash
# Delete Kubernetes resources
kubectl delete namespace zeal-production

# Destroy Terraform resources
cd terraform
terraform destroy -var="project_id=$PROJECT_ID"

# Clean up any remaining resources
gcloud compute firewall-rules delete $(gcloud compute firewall-rules list --filter="name~'gke-'" --format="value(name)")
gcloud storage rm -r gs://zeal-storage-*
```

## Support

- GCP Support: https://cloud.google.com/support
- Zeal Documentation: https://github.com/offbit-ai/zeal
- Community: https://discord.gg/zeal