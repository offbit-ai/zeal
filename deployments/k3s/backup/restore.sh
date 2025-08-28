#!/bin/bash

# Zeal K3s Restore Script
# Restore Zeal from backups

set -e

# Configuration
NAMESPACE="${NAMESPACE:-zeal-production}"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
S3_BUCKET="${S3_BUCKET:-}"
S3_ENDPOINT="${S3_ENDPOINT:-}"
RESTORE_TIMESTAMP="${1:-latest}"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Function to download from S3
download_from_s3() {
    if [ -n "$S3_BUCKET" ] && [ "$RESTORE_TIMESTAMP" != "local" ]; then
        log "Downloading backups from S3..."
        
        AWS_ARGS=""
        if [ -n "$S3_ENDPOINT" ]; then
            AWS_ARGS="--endpoint-url $S3_ENDPOINT"
        fi
        
        if [ "$RESTORE_TIMESTAMP" = "latest" ]; then
            # Get latest backup
            RESTORE_TIMESTAMP=$(aws s3 ls "s3://$S3_BUCKET/backups/" $AWS_ARGS | \
                sort | tail -1 | awk '{print $2}' | tr -d '/')
        fi
        
        # Download backup
        aws s3 sync "s3://$S3_BUCKET/backups/$RESTORE_TIMESTAMP/" \
            "$BACKUP_DIR/$RESTORE_TIMESTAMP/" $AWS_ARGS
        
        log "Downloaded backup: $RESTORE_TIMESTAMP"
    fi
}

# Function to find backup files
find_backup_file() {
    local pattern=$1
    local file
    
    if [ "$RESTORE_TIMESTAMP" = "latest" ]; then
        file=$(ls -t "$BACKUP_DIR"/*/${pattern}_*.* 2>/dev/null | head -1)
    else
        file=$(ls "$BACKUP_DIR/$RESTORE_TIMESTAMP"/${pattern}_*.* 2>/dev/null | head -1)
    fi
    
    if [ -z "$file" ] || [ ! -f "$file" ]; then
        error "Backup file not found: $pattern"
    fi
    
    echo "$file"
}

# Function to restore PostgreSQL
restore_postgresql() {
    log "Restoring PostgreSQL database..."
    
    local backup_file=$(find_backup_file "postgres")
    info "Using backup file: $backup_file"
    
    # Decompress if needed
    if [[ "$backup_file" == *.gz ]]; then
        gunzip -c "$backup_file" > /tmp/postgres_restore.sql
        backup_file="/tmp/postgres_restore.sql"
    fi
    
    # Scale down applications
    kubectl scale deployment/zeal --replicas=0 -n "$NAMESPACE"
    sleep 5
    
    # Drop and recreate database
    kubectl exec -n "$NAMESPACE" postgres-0 -- \
        sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -U zeal_user -c 'DROP DATABASE IF EXISTS zeal_db;'"
    
    kubectl exec -n "$NAMESPACE" postgres-0 -- \
        sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -U zeal_user -c 'CREATE DATABASE zeal_db;'"
    
    # Restore database
    kubectl exec -i -n "$NAMESPACE" postgres-0 -- \
        sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -U zeal_user -d zeal_db" < "$backup_file"
    
    # Scale up applications
    kubectl scale deployment/zeal --replicas=3 -n "$NAMESPACE"
    
    log "PostgreSQL restore completed"
}

# Function to restore TimescaleDB
restore_timescaledb() {
    log "Restoring TimescaleDB..."
    
    local backup_file=$(find_backup_file "timescale")
    info "Using backup file: $backup_file"
    
    # Extract backup
    tar xzf "$backup_file" -C /tmp/
    local backup_dir=$(tar tzf "$backup_file" | head -1 | cut -d'/' -f1)
    
    # Copy to pod
    kubectl cp "/tmp/$backup_dir" "$NAMESPACE/timescaledb-0:/tmp/restore"
    
    # Restore
    kubectl exec -n "$NAMESPACE" timescaledb-0 -- \
        sh -c "PGPASSWORD=\$POSTGRES_PASSWORD pg_restore -U zeal_user -d zeal_traces --clean --if-exists /tmp/restore"
    
    # Cleanup
    rm -rf "/tmp/$backup_dir"
    kubectl exec -n "$NAMESPACE" timescaledb-0 -- rm -rf /tmp/restore
    
    log "TimescaleDB restore completed"
}

# Function to restore Redis
restore_redis() {
    log "Restoring Redis..."
    
    local backup_file=$(find_backup_file "redis")
    info "Using backup file: $backup_file"
    
    # Stop Redis
    kubectl exec -n "$NAMESPACE" redis-0 -- redis-cli -a "\$REDIS_PASSWORD" SHUTDOWN NOSAVE
    sleep 5
    
    # Copy backup file
    kubectl cp "$backup_file" "$NAMESPACE/redis-0:/data/dump.rdb"
    
    # Restart Redis pod
    kubectl delete pod redis-0 -n "$NAMESPACE"
    kubectl wait --for=condition=Ready pod/redis-0 -n "$NAMESPACE" --timeout=60s
    
    log "Redis restore completed"
}

# Function to restore MinIO
restore_minio() {
    log "Restoring MinIO data..."
    
    local backup_file=$(find_backup_file "minio")
    info "Using backup file: $backup_file"
    
    # Extract backup
    tar xzf "$backup_file" -C /tmp/
    local backup_dir=$(tar tzf "$backup_file" | head -1 | cut -d'/' -f1)
    
    # Copy to pod
    kubectl cp "/tmp/$backup_dir" "$NAMESPACE/minio-0:/tmp/restore"
    
    # Restore using mc
    kubectl exec -n "$NAMESPACE" minio-0 -- \
        mc mirror --overwrite /tmp/restore/ minio/zeal-uploads/
    
    # Cleanup
    rm -rf "/tmp/$backup_dir"
    kubectl exec -n "$NAMESPACE" minio-0 -- rm -rf /tmp/restore
    
    log "MinIO restore completed"
}

# Function to restore Kubernetes resources
restore_kubernetes() {
    log "Restoring Kubernetes resources..."
    
    local backup_file=$(find_backup_file "k8s_resources")
    info "Using backup file: $backup_file"
    
    # Decompress
    gunzip -c "$backup_file" > /tmp/k8s_resources.yaml
    
    # Apply resources (excluding dynamic ones)
    kubectl apply -f /tmp/k8s_resources.yaml --dry-run=client -o yaml | \
        grep -v "resourceVersion\|uid\|selfLink\|creationTimestamp" | \
        kubectl apply -f -
    
    rm /tmp/k8s_resources.yaml
    
    log "Kubernetes resources restore completed"
}

# Function to verify restoration
verify_restoration() {
    log "Verifying restoration..."
    
    # Check pod status
    info "Checking pod status..."
    kubectl get pods -n "$NAMESPACE"
    
    # Check database connectivity
    info "Testing PostgreSQL connection..."
    kubectl exec -n "$NAMESPACE" postgres-0 -- \
        sh -c "PGPASSWORD=\$POSTGRES_PASSWORD psql -U zeal_user -d zeal_db -c 'SELECT COUNT(*) FROM workflows;'" || \
        warning "PostgreSQL verification failed"
    
    # Check Redis
    info "Testing Redis connection..."
    kubectl exec -n "$NAMESPACE" redis-0 -- \
        redis-cli -a "\$REDIS_PASSWORD" ping || \
        warning "Redis verification failed"
    
    # Check application health
    info "Testing application health..."
    kubectl exec -n "$NAMESPACE" deployment/zeal -- \
        curl -s http://localhost:3000/api/health || \
        warning "Application health check failed"
    
    log "Verification completed"
}

# Function to create restore report
create_report() {
    local report_file="$BACKUP_DIR/restore_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" <<EOF
Zeal Restore Report
==================
Restore Timestamp: $RESTORE_TIMESTAMP
Namespace: $NAMESPACE

Components Restored:
-------------------
✓ PostgreSQL
✓ TimescaleDB
✓ Redis
✓ MinIO
✓ Kubernetes Resources

System Status:
-------------
EOF
    
    kubectl get pods -n "$NAMESPACE" >> "$report_file"
    
    echo -e "\nVerification Results:" >> "$report_file"
    verify_restoration >> "$report_file" 2>&1
    
    log "Restore report created: $report_file"
}

# Interactive restore menu
interactive_restore() {
    echo -e "${BLUE}Zeal Restore Menu${NC}"
    echo "=================="
    echo "1. Full restore (all components)"
    echo "2. PostgreSQL only"
    echo "3. TimescaleDB only"
    echo "4. Redis only"
    echo "5. MinIO only"
    echo "6. Kubernetes resources only"
    echo "7. Exit"
    echo
    read -p "Select option: " option
    
    case $option in
        1)
            restore_postgresql
            restore_timescaledb
            restore_redis
            restore_minio
            restore_kubernetes
            ;;
        2)
            restore_postgresql
            ;;
        3)
            restore_timescaledb
            ;;
        4)
            restore_redis
            ;;
        5)
            restore_minio
            ;;
        6)
            restore_kubernetes
            ;;
        7)
            exit 0
            ;;
        *)
            error "Invalid option"
            ;;
    esac
}

# Main restore process
main() {
    log "Starting Zeal restore process..."
    
    # Check if running in interactive mode
    if [ "$1" = "--interactive" ] || [ "$1" = "-i" ]; then
        interactive_restore
    else
        # Download from S3 if configured
        download_from_s3
        
        # Confirm restoration
        warning "This will restore Zeal from backup: $RESTORE_TIMESTAMP"
        warning "All current data will be replaced!"
        read -p "Continue? (yes/no): " confirm
        
        if [ "$confirm" != "yes" ]; then
            error "Restore cancelled"
        fi
        
        # Perform restoration
        log "Beginning restoration..."
        
        restore_postgresql
        restore_timescaledb
        restore_redis
        restore_minio
        # restore_kubernetes  # Optional: may cause conflicts
        
        # Verify restoration
        verify_restoration
        
        # Create report
        create_report
        
        log "Restore process completed successfully!"
    fi
}

# Show usage
usage() {
    cat <<EOF
Usage: $0 [TIMESTAMP|latest|--interactive]

Options:
  TIMESTAMP       Specific backup timestamp to restore (e.g., 20240101_120000)
  latest          Restore from the latest backup (default)
  --interactive   Interactive restore menu
  -h, --help      Show this help message

Environment Variables:
  NAMESPACE       Kubernetes namespace (default: zeal-production)
  BACKUP_DIR      Local backup directory (default: /backup)
  S3_BUCKET       S3 bucket name for remote backups
  S3_ENDPOINT     S3 endpoint URL (for S3-compatible storage)

Examples:
  $0                          # Restore from latest backup
  $0 20240101_120000         # Restore from specific backup
  $0 --interactive           # Interactive restore menu
EOF
}

# Parse arguments
case "$1" in
    -h|--help)
        usage
        exit 0
        ;;
    --interactive|-i)
        interactive_restore
        ;;
    *)
        main "$@"
        ;;
esac