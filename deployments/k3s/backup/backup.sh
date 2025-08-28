#!/bin/bash

# Zeal K3s Backup Script
# Comprehensive backup solution for all Zeal components

set -e

# Configuration
NAMESPACE="${NAMESPACE:-zeal-production}"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
S3_BUCKET="${S3_BUCKET:-}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
    exit 1
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Function to backup PostgreSQL
backup_postgresql() {
    log "Backing up PostgreSQL database..."
    
    kubectl exec -n "$NAMESPACE" postgres-0 -- \
        sh -c "PGPASSWORD=\$POSTGRES_PASSWORD pg_dump -U zeal_user -d zeal_db" \
        > "$BACKUP_DIR/postgres_${TIMESTAMP}.sql"
    
    # Compress the backup
    gzip "$BACKUP_DIR/postgres_${TIMESTAMP}.sql"
    
    log "PostgreSQL backup completed: postgres_${TIMESTAMP}.sql.gz"
}

# Function to backup TimescaleDB
backup_timescaledb() {
    log "Backing up TimescaleDB..."
    
    kubectl exec -n "$NAMESPACE" timescaledb-0 -- \
        sh -c "PGPASSWORD=\$POSTGRES_PASSWORD pg_dump -U zeal_user -d zeal_traces --format=directory --jobs=4 --file=/tmp/backup" || true
    
    # Copy backup from pod
    kubectl cp "$NAMESPACE/timescaledb-0:/tmp/backup" "$BACKUP_DIR/timescale_${TIMESTAMP}"
    
    # Tar and compress
    tar czf "$BACKUP_DIR/timescale_${TIMESTAMP}.tar.gz" -C "$BACKUP_DIR" "timescale_${TIMESTAMP}"
    rm -rf "$BACKUP_DIR/timescale_${TIMESTAMP}"
    
    log "TimescaleDB backup completed: timescale_${TIMESTAMP}.tar.gz"
}

# Function to backup Redis
backup_redis() {
    log "Backing up Redis..."
    
    # Trigger BGSAVE
    kubectl exec -n "$NAMESPACE" redis-0 -- redis-cli -a "\$REDIS_PASSWORD" BGSAVE
    
    # Wait for backup to complete
    sleep 5
    
    # Copy dump.rdb
    kubectl cp "$NAMESPACE/redis-0:/data/dump.rdb" "$BACKUP_DIR/redis_${TIMESTAMP}.rdb"
    
    log "Redis backup completed: redis_${TIMESTAMP}.rdb"
}

# Function to backup MinIO
backup_minio() {
    log "Backing up MinIO data..."
    
    # Use mc client to mirror bucket
    kubectl exec -n "$NAMESPACE" minio-0 -- \
        mc mirror --overwrite minio/zeal-uploads /tmp/minio-backup/
    
    # Copy backup from pod
    kubectl cp "$NAMESPACE/minio-0:/tmp/minio-backup" "$BACKUP_DIR/minio_${TIMESTAMP}"
    
    # Tar and compress
    tar czf "$BACKUP_DIR/minio_${TIMESTAMP}.tar.gz" -C "$BACKUP_DIR" "minio_${TIMESTAMP}"
    rm -rf "$BACKUP_DIR/minio_${TIMESTAMP}"
    
    log "MinIO backup completed: minio_${TIMESTAMP}.tar.gz"
}

# Function to backup Kubernetes resources
backup_kubernetes() {
    log "Backing up Kubernetes resources..."
    
    # Export all resources in namespace
    kubectl get all,cm,secret,pvc,pv,ingress -n "$NAMESPACE" -o yaml \
        > "$BACKUP_DIR/k8s_resources_${TIMESTAMP}.yaml"
    
    # Compress
    gzip "$BACKUP_DIR/k8s_resources_${TIMESTAMP}.yaml"
    
    log "Kubernetes resources backup completed: k8s_resources_${TIMESTAMP}.yaml.gz"
}

# Function to backup persistent volumes
backup_volumes() {
    log "Backing up persistent volumes..."
    
    # Get all PVCs in namespace
    PVCS=$(kubectl get pvc -n "$NAMESPACE" -o jsonpath='{.items[*].metadata.name}')
    
    for PVC in $PVCS; do
        log "Backing up PVC: $PVC"
        
        # Create a backup pod
        cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: backup-pod-${PVC}
  namespace: $NAMESPACE
spec:
  containers:
  - name: backup
    image: busybox
    command: ['sh', '-c', 'tar czf /backup/${PVC}.tar.gz /data/*']
    volumeMounts:
    - name: data
      mountPath: /data
    - name: backup
      mountPath: /backup
  volumes:
  - name: data
    persistentVolumeClaim:
      claimName: ${PVC}
  - name: backup
    emptyDir: {}
  restartPolicy: Never
EOF
        
        # Wait for pod to complete
        kubectl wait --for=condition=Completed pod/backup-pod-${PVC} -n "$NAMESPACE" --timeout=300s
        
        # Copy backup
        kubectl cp "$NAMESPACE/backup-pod-${PVC}:/backup/${PVC}.tar.gz" \
            "$BACKUP_DIR/pvc_${PVC}_${TIMESTAMP}.tar.gz"
        
        # Delete backup pod
        kubectl delete pod backup-pod-${PVC} -n "$NAMESPACE"
    done
    
    log "Persistent volumes backup completed"
}

# Function to upload to S3
upload_to_s3() {
    if [ -n "$S3_BUCKET" ]; then
        log "Uploading backups to S3..."
        
        # Install awscli if not present
        if ! command -v aws &> /dev/null; then
            pip install awscli
        fi
        
        # Configure endpoint if provided
        AWS_ARGS=""
        if [ -n "$S3_ENDPOINT" ]; then
            AWS_ARGS="--endpoint-url $S3_ENDPOINT"
        fi
        
        # Upload all backup files
        aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/backups/$TIMESTAMP/" $AWS_ARGS
        
        log "Backups uploaded to S3: s3://$S3_BUCKET/backups/$TIMESTAMP/"
    fi
}

# Function to clean old backups
cleanup_old_backups() {
    log "Cleaning up old backups (retention: $RETENTION_DAYS days)..."
    
    # Local cleanup
    find "$BACKUP_DIR" -type f -mtime +$RETENTION_DAYS -delete
    
    # S3 cleanup if configured
    if [ -n "$S3_BUCKET" ]; then
        # List and delete old S3 objects
        CUTOFF_DATE=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
        
        aws s3 ls "s3://$S3_BUCKET/backups/" $AWS_ARGS | \
        while read -r line; do
            BACKUP_DATE=$(echo "$line" | awk '{print $2}' | cut -d'/' -f1)
            if [[ "$BACKUP_DATE" < "$CUTOFF_DATE" ]]; then
                aws s3 rm --recursive "s3://$S3_BUCKET/backups/$BACKUP_DATE/" $AWS_ARGS
            fi
        done
    fi
    
    log "Cleanup completed"
}

# Function to verify backups
verify_backups() {
    log "Verifying backups..."
    
    # Check if files exist and have size > 0
    for file in "$BACKUP_DIR"/*_${TIMESTAMP}*; do
        if [ -f "$file" ]; then
            SIZE=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null)
            if [ "$SIZE" -gt 0 ]; then
                log "✓ $(basename "$file"): $(numfmt --to=iec-i --suffix=B "$SIZE")"
            else
                warning "✗ $(basename "$file"): Empty file"
            fi
        fi
    done
}

# Function to create backup report
create_report() {
    REPORT_FILE="$BACKUP_DIR/backup_report_${TIMESTAMP}.txt"
    
    cat > "$REPORT_FILE" <<EOF
Zeal Backup Report
==================
Timestamp: $TIMESTAMP
Namespace: $NAMESPACE

Backup Summary:
--------------
EOF
    
    # List all backup files with sizes
    ls -lh "$BACKUP_DIR"/*_${TIMESTAMP}* >> "$REPORT_FILE" 2>/dev/null || true
    
    # Add checksums
    echo -e "\nChecksums:" >> "$REPORT_FILE"
    for file in "$BACKUP_DIR"/*_${TIMESTAMP}*; do
        if [ -f "$file" ]; then
            sha256sum "$file" >> "$REPORT_FILE"
        fi
    done
    
    # Add system info
    echo -e "\nSystem Info:" >> "$REPORT_FILE"
    kubectl get nodes >> "$REPORT_FILE"
    kubectl get pods -n "$NAMESPACE" >> "$REPORT_FILE"
    
    log "Backup report created: $REPORT_FILE"
}

# Main backup process
main() {
    log "Starting Zeal backup process..."
    log "Backup directory: $BACKUP_DIR"
    log "Timestamp: $TIMESTAMP"
    
    # Create backup subdirectory for this run
    BACKUP_RUN_DIR="$BACKUP_DIR/$TIMESTAMP"
    mkdir -p "$BACKUP_RUN_DIR"
    cd "$BACKUP_RUN_DIR"
    
    # Perform backups
    backup_postgresql
    backup_timescaledb
    backup_redis
    backup_minio
    backup_kubernetes
    # backup_volumes  # Optional: can be slow for large volumes
    
    # Verify backups
    verify_backups
    
    # Create report
    create_report
    
    # Upload to S3 if configured
    upload_to_s3
    
    # Cleanup old backups
    cleanup_old_backups
    
    log "Backup process completed successfully!"
    
    # Send notification if configured
    if [ -n "$SLACK_WEBHOOK" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"Zeal backup completed successfully. Timestamp: $TIMESTAMP\"}" \
            "$SLACK_WEBHOOK"
    fi
}

# Error handling
trap 'error "Backup failed at line $LINENO"' ERR

# Run main function
main "$@"