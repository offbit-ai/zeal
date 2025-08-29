#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
POSTGRES_CONTAINER="zeal-postgres"
TIMESCALE_CONTAINER="zeal-timescaledb"
REDIS_CONTAINER="zeal-redis"
CRDT_CONTAINER="zeal-crdt-server"
MINIO_CONTAINER="zeal-minio"
DOCKER_NETWORK="zeal-network"
DB_NAME="zeal_db"
DB_USER="zeal_user"
DB_PASSWORD="zeal_password"
DB_PORT="5432"
# Auth database configuration
AUTH_SCHEMA="zeal_auth"
TIMESCALE_DB_NAME="zeal_traces"
TIMESCALE_PORT="5433"
REDIS_PORT="6379"
REDIS_PASSWORD="redispass123"
CRDT_PORT="8080"
MINIO_PORT="9000"
MINIO_CONSOLE_PORT="9001"
MINIO_ROOT_USER="minioadmin"
MINIO_ROOT_PASSWORD="minioadmin123"
MINIO_BUCKET="zeal-uploads"

echo -e "${BLUE}🚀 Starting Zeal Development Environment${NC}"
echo -e "${YELLOW}Tip: Use --skip-prompts to skip configuration questions${NC}"
echo ""

# Check for flags
if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    echo -e "${GREEN}Usage:${NC}"
    echo -e "  ./start-dev.sh                    # Start normally"
    echo -e "  ./start-dev.sh --rebuild-crdt     # Force rebuild CRDT server"
    echo -e "  ./start-dev.sh --reingest         # Force re-ingest templates"
    echo -e "  ./start-dev.sh --skip-prompts     # Skip AI configuration prompts, use existing values"
    echo -e "  FORCE_REBUILD_CRDT=true ./start-dev.sh  # Alternative way to force rebuild"
    echo ""
    echo -e "${BLUE}What it does:${NC}"
    echo -e "  - Loads existing .env.local configuration if present"
    echo -e "  - Starts PostgreSQL, TimescaleDB, Redis, MinIO, and CRDT server in Docker"
    echo -e "  - Creates/updates .env.local with proper configuration"
    echo -e "  - Ingests node templates into the database"
    echo -e "  - Starts the Next.js development server"
    echo ""
    echo -e "${BLUE}Environment Variables:${NC}"
    echo -e "  - If .env.local exists, its values are loaded as defaults"
    echo -e "  - AI service keys (OpenAI, OpenRouter) are preserved"
    echo -e "  - Use --skip-prompts to skip configuration questions"
    echo ""
    exit 0
fi

# Parse command line arguments
FORCE_REINGEST=false
SKIP_PROMPTS=false
for arg in "$@"; do
    case $arg in
        --rebuild-crdt)
            export FORCE_REBUILD_CRDT=true
            ;;
        --reingest)
            FORCE_REINGEST=true
            ;;
        --skip-prompts)
            SKIP_PROMPTS=true
            ;;
    esac
done

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
}

# Function to create Docker network if it doesn't exist
create_docker_network() {
    if ! docker network ls | grep -q "^${DOCKER_NETWORK} "; then
        echo -e "${BLUE}🌐 Creating Docker network...${NC}"
        docker network create $DOCKER_NETWORK > /dev/null
        echo -e "${GREEN}✅ Docker network created${NC}"
    else
        echo -e "${GREEN}✅ Docker network already exists${NC}"
    fi
}

# Function to start TimescaleDB for flow traces
start_timescaledb() {
    echo -e "${BLUE}⏰ Starting TimescaleDB for flow traces...${NC}"
    
    # Check if container exists
    if [ "$(docker ps -aq -f name=^${TIMESCALE_CONTAINER}$)" ]; then
        if [ "$(docker ps -q -f name=^${TIMESCALE_CONTAINER}$)" ]; then
            echo -e "${YELLOW}TimescaleDB is already running${NC}"
            return
        else
            echo -e "Starting existing TimescaleDB container..."
            docker start $TIMESCALE_CONTAINER > /dev/null
        fi
    else
        echo -e "Creating new TimescaleDB container..."
        docker run -d \
            --name $TIMESCALE_CONTAINER \
            --network $DOCKER_NETWORK \
            -e POSTGRES_DB=$TIMESCALE_DB_NAME \
            -e POSTGRES_USER=$DB_USER \
            -e POSTGRES_PASSWORD=$DB_PASSWORD \
            -p $TIMESCALE_PORT:5432 \
            -v zeal-timescale-data:/var/lib/postgresql/data \
            -v "$(pwd)/timescaledb-init.sql:/docker-entrypoint-initdb.d/init.sql:ro" \
            timescale/timescaledb:latest-pg15 > /dev/null
    fi
    
    # Wait for TimescaleDB to be ready
    echo -e "Waiting for TimescaleDB..."
    for i in {1..30}; do
        if docker exec $TIMESCALE_CONTAINER pg_isready -U $DB_USER > /dev/null 2>&1; then
            echo -e "${GREEN}✅ TimescaleDB is ready${NC}"
            
            # Check if database needs initialization
            echo -e "${BLUE}Checking TimescaleDB schema...${NC}"
            if ! docker exec $TIMESCALE_CONTAINER psql -U $DB_USER -d $TIMESCALE_DB_NAME -c "SELECT 1 FROM flow_trace_sessions LIMIT 1;" > /dev/null 2>&1; then
                echo -e "${YELLOW}Initializing TimescaleDB schema...${NC}"
                # Copy init.sql into container and run it
                docker cp timescaledb-init.sql $TIMESCALE_CONTAINER:/tmp/init.sql
                if docker exec $TIMESCALE_CONTAINER psql -U $DB_USER -d $TIMESCALE_DB_NAME -f /tmp/init.sql > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ TimescaleDB schema initialized with hypertables${NC}"
                else
                    echo -e "${YELLOW}⚠️  TimescaleDB initialization had warnings (this is normal for IF NOT EXISTS statements)${NC}"
                fi
            else
                echo -e "${GREEN}✅ TimescaleDB schema already exists${NC}"
            fi
            
            # Apply configurable retention policies
            echo -e "${BLUE}Applying retention policies...${NC}"
            
            # Load retention policy environment variables
            TIMESCALE_RETENTION_FLOW_TRACES="${TIMESCALE_RETENTION_FLOW_TRACES:-30 days}"
            TIMESCALE_RETENTION_TRACE_EVENTS="${TIMESCALE_RETENTION_TRACE_EVENTS:-7 days}"
            TIMESCALE_RETENTION_SESSIONS="${TIMESCALE_RETENTION_SESSIONS:-90 days}"
            
            # Create retention policy SQL
            cat > /tmp/retention-policies.sql << EOSQL
-- Remove existing policies if they exist
SELECT remove_retention_policy('flow_traces', if_exists => TRUE);
SELECT remove_retention_policy('flow_trace_events', if_exists => TRUE);
SELECT remove_retention_policy('flow_trace_sessions', if_exists => TRUE);

-- Apply new retention policies
SELECT add_retention_policy('flow_traces', 
  INTERVAL '${TIMESCALE_RETENTION_FLOW_TRACES}',
  if_not_exists => TRUE
);

SELECT add_retention_policy('flow_trace_events',
  INTERVAL '${TIMESCALE_RETENTION_TRACE_EVENTS}',
  if_not_exists => TRUE
);

SELECT add_retention_policy('flow_trace_sessions',
  INTERVAL '${TIMESCALE_RETENTION_SESSIONS}',
  if_not_exists => TRUE
);
EOSQL
            
            # Copy and execute retention policy SQL
            docker cp /tmp/retention-policies.sql $TIMESCALE_CONTAINER:/tmp/retention-policies.sql
            if docker exec $TIMESCALE_CONTAINER psql -U $DB_USER -d $TIMESCALE_DB_NAME -f /tmp/retention-policies.sql > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Retention policies applied: Traces=${TIMESCALE_RETENTION_FLOW_TRACES}, Events=${TIMESCALE_RETENTION_TRACE_EVENTS}, Sessions=${TIMESCALE_RETENTION_SESSIONS}${NC}"
            else
                echo -e "${YELLOW}⚠️  Retention policy application had warnings${NC}"
            fi
            rm -f /tmp/retention-policies.sql
            
            # Show TimescaleDB info
            echo -e "${BLUE}TimescaleDB Configuration:${NC}"
            docker exec $TIMESCALE_CONTAINER psql -U $DB_USER -d $TIMESCALE_DB_NAME -c "SELECT extversion FROM pg_extension WHERE extname='timescaledb';" 2>/dev/null | grep -E '[0-9]+\.[0-9]+' || echo "   Version: Unknown"
            
            return
        fi
        sleep 1
    done
    echo -e "${RED}❌ TimescaleDB failed to start${NC}"
    exit 1
}

# Function to start PostgreSQL
start_postgres() {
    echo -e "${BLUE}🐘 Starting PostgreSQL...${NC}"
    
    # Check if container exists
    if [ "$(docker ps -aq -f name=^${POSTGRES_CONTAINER}$)" ]; then
        if [ "$(docker ps -q -f name=^${POSTGRES_CONTAINER}$)" ]; then
            echo -e "${YELLOW}PostgreSQL is already running${NC}"
            return
        else
            echo -e "Starting existing PostgreSQL container..."
            docker start $POSTGRES_CONTAINER > /dev/null
        fi
    else
        echo -e "Creating new PostgreSQL container..."
        docker run -d \
            --name $POSTGRES_CONTAINER \
            --network $DOCKER_NETWORK \
            -e POSTGRES_DB=$DB_NAME \
            -e POSTGRES_USER=$DB_USER \
            -e POSTGRES_PASSWORD=$DB_PASSWORD \
            -p $DB_PORT:5432 \
            -v zeal-postgres-data:/var/lib/postgresql/data \
            -v "$(pwd)/init.sql:/docker-entrypoint-initdb.d/init.sql:ro" \
            pgvector/pgvector:pg15 > /dev/null
    fi
    
    # Wait for PostgreSQL to be ready
    echo -e "Waiting for PostgreSQL..."
    for i in {1..30}; do
        if docker exec $POSTGRES_CONTAINER pg_isready -U $DB_USER > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
            
            # Check if database needs initialization
            echo -e "${BLUE}Checking database schema...${NC}"
            if ! docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT 1 FROM workflows LIMIT 1;" > /dev/null 2>&1; then
                echo -e "${YELLOW}Initializing database schema...${NC}"
                # Copy init.sql into container and run it
                docker cp init.sql $POSTGRES_CONTAINER:/tmp/init.sql
                if docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -f /tmp/init.sql > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ Database schema initialized${NC}"
                else
                    echo -e "${YELLOW}⚠️  Database initialization had warnings (this is normal for IF NOT EXISTS statements)${NC}"
                fi
            else
                echo -e "${GREEN}✅ Database schema already exists${NC}"
            fi
            
            # Initialize auth schema if enabled
            if [ "$ZEAL_AUTH_ENABLED" = "true" ] || [ "$SETUP_AUTH" = "true" ]; then
                echo -e "${BLUE}🔐 Checking authorization schema...${NC}"
                if ! docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -c "SELECT 1 FROM information_schema.schemata WHERE schema_name = '$AUTH_SCHEMA';" | grep -q 1; then
                    echo -e "${YELLOW}Initializing authorization schema...${NC}"
                    # Create auth schema initialization SQL
                    cat > /tmp/auth-init.sql << 'EOSQL'
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

-- Create hierarchy table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_policies_tenant ON zeal_auth.policies(tenant_id);
CREATE INDEX IF NOT EXISTS idx_policies_priority ON zeal_auth.policies(priority DESC);
CREATE INDEX IF NOT EXISTS idx_hierarchy_tenant ON zeal_auth.hierarchy(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_parent ON zeal_auth.hierarchy(parent_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_timestamp ON zeal_auth.audit_logs(tenant_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_type_timestamp ON zeal_auth.audit_logs(type, timestamp DESC);
EOSQL
                    docker cp /tmp/auth-init.sql $POSTGRES_CONTAINER:/tmp/auth-init.sql
                    if docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -f /tmp/auth-init.sql > /dev/null 2>&1; then
                        echo -e "${GREEN}✅ Authorization schema initialized${NC}"
                    else
                        echo -e "${YELLOW}⚠️  Auth schema initialization had warnings${NC}"
                    fi
                    rm -f /tmp/auth-init.sql
                else
                    echo -e "${GREEN}✅ Authorization schema already exists${NC}"
                fi
                
                # Apply tenant isolation migration
                echo -e "${BLUE}🔐 Applying tenant isolation migration...${NC}"
                if [ -f "migrations/add-tenant-isolation.sql" ]; then
                    docker cp migrations/add-tenant-isolation.sql $POSTGRES_CONTAINER:/tmp/add-tenant-isolation.sql
                    if docker exec $POSTGRES_CONTAINER psql -U $DB_USER -d $DB_NAME -f /tmp/add-tenant-isolation.sql > /dev/null 2>&1; then
                        echo -e "${GREEN}✅ Tenant isolation migration applied${NC}"
                    else
                        echo -e "${YELLOW}⚠️  Tenant isolation migration had warnings (columns may already exist)${NC}"
                    fi
                else
                    echo -e "${YELLOW}⚠️  Tenant isolation migration file not found${NC}"
                fi
            fi
            
            return
        fi
        sleep 1
    done
    echo -e "${RED}❌ PostgreSQL failed to start${NC}"
    exit 1
}

# Function to start Redis
start_redis() {
    echo -e "${BLUE}🔴 Starting Redis...${NC}"
    
    # Check if container exists
    if [ "$(docker ps -aq -f name=^${REDIS_CONTAINER}$)" ]; then
        if [ "$(docker ps -q -f name=^${REDIS_CONTAINER}$)" ]; then
            echo -e "${YELLOW}Redis is already running${NC}"
            return
        else
            echo -e "Starting existing Redis container..."
            docker start $REDIS_CONTAINER > /dev/null
        fi
    else
        echo -e "Creating new Redis container..."
        docker run -d \
            --name $REDIS_CONTAINER \
            --network $DOCKER_NETWORK \
            -p $REDIS_PORT:6379 \
            -v zeal-redis-data:/data \
            redis:7-alpine \
            redis-server --requirepass $REDIS_PASSWORD > /dev/null
    fi
    
    # Wait for Redis to be ready
    echo -e "Waiting for Redis..."
    for i in {1..10}; do
        if docker exec $REDIS_CONTAINER redis-cli -a $REDIS_PASSWORD ping > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis is ready${NC}"
            return
        fi
        sleep 1
    done
    echo -e "${RED}❌ Redis failed to start${NC}"
    exit 1
}

# Function to start MinIO
start_minio() {
    echo -e "${BLUE}📦 Starting MinIO (S3-compatible storage)...${NC}"
    
    # Check if container exists
    if [ "$(docker ps -aq -f name=^${MINIO_CONTAINER}$)" ]; then
        if [ "$(docker ps -q -f name=^${MINIO_CONTAINER}$)" ]; then
            echo -e "${YELLOW}MinIO is already running${NC}"
            return
        else
            echo -e "Starting existing MinIO container..."
            docker start $MINIO_CONTAINER > /dev/null
        fi
    else
        echo -e "Creating new MinIO container..."
        docker run -d \
            --name $MINIO_CONTAINER \
            --network $DOCKER_NETWORK \
            -p $MINIO_PORT:9000 \
            -p $MINIO_CONSOLE_PORT:9001 \
            -e MINIO_ROOT_USER=$MINIO_ROOT_USER \
            -e MINIO_ROOT_PASSWORD=$MINIO_ROOT_PASSWORD \
            -v zeal-minio-data:/data \
            minio/minio:latest \
            server /data --console-address ":9001" > /dev/null
    fi
    
    # Wait for MinIO to be ready
    echo -e "Waiting for MinIO..."
    for i in {1..30}; do
        if curl -s http://localhost:$MINIO_PORT/minio/health/live > /dev/null 2>&1; then
            echo -e "${GREEN}✅ MinIO is ready${NC}"
            
            # Create default bucket if it doesn't exist
            echo -e "Creating default bucket..."
            docker exec $MINIO_CONTAINER mkdir -p /data/$MINIO_BUCKET > /dev/null 2>&1
            
            # Set up MinIO client alias and set bucket policy
            echo -e "Setting up bucket policy..."
            docker exec $MINIO_CONTAINER mc alias set myminio http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD > /dev/null 2>&1
            docker exec $MINIO_CONTAINER mc anonymous set download myminio/$MINIO_BUCKET > /dev/null 2>&1
            
            return
        fi
        sleep 1
    done
    echo -e "${RED}❌ MinIO failed to start${NC}"
    exit 1
}

# Function to start CRDT server
start_crdt_server() {
    echo -e "${BLUE}🦀 Starting CRDT server...${NC}"
    
    # Check if we should force rebuild
    if [ "$1" = "--rebuild" ] || [ "$FORCE_REBUILD_CRDT" = "true" ]; then
        echo -e "${YELLOW}Force rebuilding CRDT server...${NC}"
        # Stop and remove existing container
        if [ "$(docker ps -aq -f name=^${CRDT_CONTAINER}$)" ]; then
            docker stop $CRDT_CONTAINER > /dev/null 2>&1
            docker rm $CRDT_CONTAINER > /dev/null 2>&1
        fi
        # Remove existing image to force full rebuild
        docker rmi zeal-crdt-server:latest > /dev/null 2>&1
    else
        # Check if container exists
        if [ "$(docker ps -aq -f name=^${CRDT_CONTAINER}$)" ]; then
            if [ "$(docker ps -q -f name=^${CRDT_CONTAINER}$)" ]; then
                echo -e "${YELLOW}CRDT server is already running${NC}"
                return
            else
                echo -e "Starting existing CRDT server container..."
                docker start $CRDT_CONTAINER > /dev/null
                return
            fi
        fi
    fi
    
    # If we get here, we need to build and start
        echo -e "Building and starting CRDT server..."
        # Build the CRDT server image if it doesn't exist
        if [ -d "crdt-server" ]; then
            echo -e "${YELLOW}Building CRDT server with --no-cache to ensure latest changes...${NC}"
            # Don't suppress output so we can see build errors
            if ! docker build --no-cache -t zeal-crdt-server:latest ./crdt-server; then
                echo -e "${RED}❌ Failed to build CRDT server image${NC}"
                echo -e "${YELLOW}Check the build output above for errors${NC}"
                return 1
            fi
            echo -e "${GREEN}✅ CRDT server image built successfully${NC}"
            
            # Run the CRDT server
            docker run -d \
                --name $CRDT_CONTAINER \
                --network $DOCKER_NETWORK \
                -p $CRDT_PORT:$CRDT_PORT \
                -e REDIS_URL="redis://:${REDIS_PASSWORD}@${REDIS_CONTAINER}:6379" \
                -e RUST_LOG=info \
                zeal-crdt-server:latest \
                server --port $CRDT_PORT > /dev/null
        else
            echo -e "${RED}❌ CRDT server directory not found${NC}"
            return
        fi
    
    # Wait for CRDT server to be ready
    echo -e "Waiting for CRDT server..."
    for i in {1..10}; do
        if curl -s http://localhost:$CRDT_PORT/health > /dev/null 2>&1; then
            echo -e "${GREEN}✅ CRDT server is ready${NC}"
            return
        fi
        sleep 1
    done
    echo -e "${YELLOW}⚠️  CRDT server may not be fully ready${NC}"
}

# Function to load existing .env.local values
load_existing_env() {
    if [ -f .env.local ]; then
        echo -e "${BLUE}📂 Loading existing .env.local configuration...${NC}"
        
        # Use a more robust method to load environment variables
        # This handles quotes, spaces, and special characters properly
        set -a  # Mark variables for export
        source .env.local 2>/dev/null || {
            # Fallback to manual parsing if source fails
            while IFS='=' read -r key value; do
                # Skip comments and empty lines
                if [[ ! "$key" =~ ^[[:space:]]*# ]] && [[ ! -z "${key// }" ]]; then
                    # Remove leading/trailing whitespace from key
                    key="${key#"${key%%[![:space:]]*}"}"
                    key="${key%"${key##*[![:space:]]}"}" 
                    
                    # Handle quoted values
                    if [[ "$value" =~ ^\".*\"$ ]]; then
                        value="${value:1:-1}"
                    elif [[ "$value" =~ ^\'.*\'$ ]]; then
                        value="${value:1:-1}"
                    fi
                    
                    # Export the variable if key is valid
                    if [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
                        export "$key=$value"
                    fi
                fi
            done < .env.local
        }
        set +a  # Stop marking variables for export
        
        # Show what was loaded (for important variables)
        echo -e "${GREEN}✅ Loaded configuration from existing .env.local${NC}"
        
        # Report on key configurations
        if [ ! -z "$EMBEDDING_API_KEY" ]; then
            echo -e "   ${GREEN}✓${NC} OpenAI API key loaded"
        fi
        if [ ! -z "$OPENROUTER_API_KEY" ]; then
            echo -e "   ${GREEN}✓${NC} OpenRouter API key loaded"
        fi
        if [ ! -z "$DATABASE_URL" ] && [[ "$DATABASE_URL" != *"localhost"* ]]; then
            echo -e "   ${GREEN}✓${NC} Custom database URL loaded"
        fi
        
        echo ""
    fi
}

# Function to configure authorization
configure_auth_services() {
    if [ "$SKIP_PROMPTS" = "true" ]; then
        echo -e "${BLUE}🔐 Authorization Configuration${NC}"
        echo -e "${YELLOW}Skipping prompts, using existing configuration...${NC}"
        
        if [ "$ZEAL_AUTH_ENABLED" = "true" ]; then
            echo -e "   ${GREEN}✓ Authorization: Enabled${NC}"
            ZEAL_AUTH_MODE="${ZEAL_AUTH_MODE:-development}"
            echo -e "   Mode: $ZEAL_AUTH_MODE"
        else
            echo -e "   ${YELLOW}○ Authorization: Disabled${NC}"
        fi
        echo ""
        return
    fi
    
    echo -e "${BLUE}🔐 Authorization Configuration${NC}"
    echo -e "${YELLOW}Authorization is disabled by default for easier development.${NC}"
    echo -e "${YELLOW}Enable it to protect your APIs and enforce access control.${NC}"
    echo ""
    
    # Check if user wants to enable auth (default to disabled for development)
    if [ -z "$ZEAL_AUTH_ENABLED" ]; then
        read -p "   Enable authorization? (y/N): " enable_auth
        if [[ "$enable_auth" =~ ^[Yy]$ ]]; then
            ZEAL_AUTH_ENABLED="true"
            SETUP_AUTH="true"
            
            # Ask for auth mode
            echo -e "\n   ${GREEN}Authorization Modes:${NC}"
            echo -e "   1. Development (mock auth with configurable defaults)"
            echo -e "   2. Production (requires external identity provider)"
            read -p "   Select mode (1-2) [1]: " auth_mode
            
            case $auth_mode in
                2)
                    ZEAL_AUTH_MODE="production"
                    echo -e "\n   ${YELLOW}Production mode requires an external identity provider${NC}"
                    read -p "   JWT Issuer URL: " AUTH_JWT_ISSUER
                    read -p "   JWT Audience: " AUTH_JWT_AUDIENCE
                    read -p "   JWKS URI (or press Enter to use public key): " AUTH_JWT_JWKS_URI
                    
                    if [ -z "$AUTH_JWT_JWKS_URI" ]; then
                        echo -e "   Enter JWT public key (paste and press Ctrl+D when done):"
                        AUTH_JWT_PUBLIC_KEY=$(cat)
                    fi
                    ;;
                *)
                    ZEAL_AUTH_MODE="development"
                    echo -e "\n   ${GREEN}Using development mode with mock authentication${NC}"
                    ZEAL_DEV_USER_ID="${ZEAL_DEV_USER_ID:-dev-user}"
                    ZEAL_DEV_TENANT_ID="${ZEAL_DEV_TENANT_ID:-dev-tenant}"
                    ZEAL_DEV_ORG_ID="${ZEAL_DEV_ORG_ID:-dev-org}"
                    ZEAL_DEV_ROLES="${ZEAL_DEV_ROLES:-user,developer}"
                    ;;
            esac
        else
            ZEAL_AUTH_ENABLED="false"
            echo -e "   ${YELLOW}Authorization disabled${NC}"
        fi
    else
        echo -e "   ${GREEN}✓ Using existing ZEAL_AUTH_ENABLED setting: $ZEAL_AUTH_ENABLED${NC}"
        ZEAL_AUTH_MODE="${ZEAL_AUTH_MODE:-development}"
    fi
    
    echo ""
}

# Function to prompt for AI configuration
configure_ai_services() {
    if [ "$SKIP_PROMPTS" = "true" ]; then
        echo -e "${BLUE}🤖 AI Services Configuration${NC}"
        echo -e "${YELLOW}Skipping prompts, using existing configuration...${NC}"
        
        # Set defaults for embedding if not already set
        if [ ! -z "$EMBEDDING_API_KEY" ]; then
            echo -e "   ${GREEN}✓ OpenAI Embeddings: Using existing configuration${NC}"
            EMBEDDING_VENDOR="${EMBEDDING_VENDOR:-openai}"
            EMBEDDING_MODEL="${EMBEDDING_MODEL:-text-embedding-3-small}"
        else
            echo -e "   ${YELLOW}○ OpenAI Embeddings: Using mock (no API key found)${NC}"
            EMBEDDING_VENDOR="${EMBEDDING_VENDOR:-mock}"
            EMBEDDING_DIMENSIONS="${EMBEDDING_DIMENSIONS:-1536}"
            EMBEDDING_BATCH_SIZE="${EMBEDDING_BATCH_SIZE:-100}"
        fi
        
        if [ ! -z "$OPENROUTER_API_KEY" ]; then
            echo -e "   ${GREEN}✓ OpenRouter: Using existing configuration${NC}"
            OPENROUTER_MODEL="${OPENROUTER_MODEL:-anthropic/claude-3.5-sonnet}"
        else
            echo -e "   ${YELLOW}○ OpenRouter: Not configured${NC}"
        fi
        echo ""
        return
    fi
    
    echo -e "${BLUE}🤖 AI Services Configuration${NC}"
    echo -e "${YELLOW}These are optional but enable advanced features like semantic search and orchestration${NC}"
    echo ""
    
    # OpenAI Configuration for Embeddings
    echo -e "${GREEN}1. OpenAI Embeddings (for semantic search)${NC}"
    if [ -z "$EMBEDDING_API_KEY" ]; then
        read -p "   Enter OpenAI API key (or press Enter to skip): " openai_key
        if [ ! -z "$openai_key" ]; then
            EMBEDDING_API_KEY="$openai_key"
            EMBEDDING_VENDOR="openai"
            EMBEDDING_MODEL="text-embedding-3-small"
        else
            echo -e "   ${YELLOW}Using mock embeddings (no API key required)${NC}"
            EMBEDDING_VENDOR="mock"
            EMBEDDING_DIMENSIONS="1536"
            EMBEDDING_BATCH_SIZE="100"
        fi
    else
        echo -e "   ${GREEN}✓ Using existing EMBEDDING_API_KEY${NC}"
        # Set vendor and model if not already set
        EMBEDDING_VENDOR="${EMBEDDING_VENDOR:-openai}"
        EMBEDDING_MODEL="${EMBEDDING_MODEL:-text-embedding-3-small}"
    fi
    
    echo ""
    
    # OpenRouter Configuration for Orchestration
    echo -e "${GREEN}2. OpenRouter (for AI orchestration)${NC}"
    if [ -z "$OPENROUTER_API_KEY" ]; then
        read -p "   Enter OpenRouter API key (or press Enter to skip): " openrouter_key
        if [ ! -z "$openrouter_key" ]; then
            OPENROUTER_API_KEY="$openrouter_key"
            OPENROUTER_MODEL="${OPENROUTER_MODEL:-anthropic/claude-3.5-sonnet}"
        else
            echo -e "   ${YELLOW}Orchestration features will be disabled${NC}"
            OPENROUTER_API_KEY=""
        fi
    else
        echo -e "   ${GREEN}✓ Using existing OPENROUTER_API_KEY${NC}"
        OPENROUTER_MODEL="${OPENROUTER_MODEL:-anthropic/claude-3.5-sonnet}"
    fi
    
    echo ""
}

# Function to create .env.local file
create_env_file() {
    echo -e "${BLUE}📝 Creating .env.local file...${NC}"
    
    # Check if .env.local already exists
    if [ -f .env.local ]; then
        echo -e "${YELLOW}⚠️  .env.local already exists. Creating backup...${NC}"
        cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Also preserve certain values from existing .env.local if they weren't set via prompts
    # This handles database URLs, ports, and other infrastructure settings
    if [ -f .env.local.backup.* ]; then
        # Get the most recent backup
        LATEST_BACKUP=$(ls -t .env.local.backup.* | head -n1)
        
        # Extract DATABASE_URL if not overridden
        if [ -z "$DATABASE_URL_OVERRIDE" ]; then
            OLD_DATABASE_URL=$(grep "^DATABASE_URL=" "$LATEST_BACKUP" 2>/dev/null | cut -d'=' -f2-)
            if [ ! -z "$OLD_DATABASE_URL" ] && [[ "$OLD_DATABASE_URL" != *"localhost:5432"* ]]; then
                # User has a custom database URL (not localhost), preserve it
                DATABASE_URL="$OLD_DATABASE_URL"
                echo -e "${GREEN}✓ Preserving custom DATABASE_URL from existing config${NC}"
            fi
        fi
        
        # Extract Redis URL if not overridden
        if [ -z "$REDIS_URL_OVERRIDE" ]; then
            OLD_REDIS_URL=$(grep "^REDIS_URL=" "$LATEST_BACKUP" 2>/dev/null | cut -d'=' -f2-)
            if [ ! -z "$OLD_REDIS_URL" ] && [[ "$OLD_REDIS_URL" != *"localhost:6379"* ]]; then
                # User has a custom Redis URL (not localhost), preserve it
                REDIS_URL="$OLD_REDIS_URL"
                echo -e "${GREEN}✓ Preserving custom REDIS_URL from existing config${NC}"
            fi
        fi
    fi
    
    # Create .env.local with database and Redis configuration
    cat > .env.local << EOF
# Database Configuration
DATABASE_URL="${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}?schema=public}"

# TimescaleDB Configuration for Flow Traces
TIMESCALE_HOST="localhost"
TIMESCALE_PORT="${TIMESCALE_PORT}"
TIMESCALE_DATABASE="${TIMESCALE_DB_NAME}"
TIMESCALE_USER="${DB_USER}"
TIMESCALE_PASSWORD="${DB_PASSWORD}"

# TimescaleDB Retention Policies (PostgreSQL intervals)
TIMESCALE_RETENTION_FLOW_TRACES="${TIMESCALE_RETENTION_FLOW_TRACES:-30 days}"
TIMESCALE_RETENTION_TRACE_EVENTS="${TIMESCALE_RETENTION_TRACE_EVENTS:-7 days}"
TIMESCALE_RETENTION_SESSIONS="${TIMESCALE_RETENTION_SESSIONS:-90 days}"

# Redis Configuration
REDIS_URL="${REDIS_URL:-redis://:${REDIS_PASSWORD}@localhost:${REDIS_PORT}}"
REDIS_PASSWORD="${REDIS_PASSWORD}"

# Next.js Configuration
NEXT_PUBLIC_API_URL="http://localhost:3000"

# CRDT Server Configuration
NEXT_PUBLIC_RUST_CRDT_URL="ws://localhost:8080"
NEXT_PUBLIC_CRDT_SERVER_URL="ws://localhost:8080"

# Feature flags from .env.local.example
NEXT_PUBLIC_ENABLE_COLLABORATION=true
NEXT_PUBLIC_ENABLE_FLOW_TRACING=true
NEXT_PUBLIC_ENABLE_VERSION_HISTORY=true
NEXT_PUBLIC_DEBUG_CRDT=false
NEXT_PUBLIC_VERBOSE_LOGGING=false

# MinIO Configuration
MINIO_ENDPOINT="localhost:${MINIO_PORT}"
MINIO_ACCESS_KEY="${MINIO_ROOT_USER}"
MINIO_SECRET_KEY="${MINIO_ROOT_PASSWORD}"
MINIO_BUCKET="${MINIO_BUCKET}"
MINIO_USE_SSL=false
NEXT_PUBLIC_MINIO_URL="http://localhost:${MINIO_PORT}"

# Node Template Repository Configuration
USE_TEMPLATE_REPOSITORY=true
AUTO_INGEST_TEMPLATES=true

# AI Embedding Configuration (for semantic search)
EMBEDDING_VENDOR=${EMBEDDING_VENDOR}
${EMBEDDING_API_KEY:+EMBEDDING_API_KEY=${EMBEDDING_API_KEY}}
${EMBEDDING_MODEL:+EMBEDDING_MODEL=${EMBEDDING_MODEL}}
${EMBEDDING_DIMENSIONS:+EMBEDDING_DIMENSIONS=${EMBEDDING_DIMENSIONS}}
${EMBEDDING_BATCH_SIZE:+EMBEDDING_BATCH_SIZE=${EMBEDDING_BATCH_SIZE}}

# OpenRouter Configuration (for orchestration)
${OPENROUTER_API_KEY:+OPENROUTER_API_KEY=${OPENROUTER_API_KEY}}
${OPENROUTER_MODEL:+OPENROUTER_MODEL=${OPENROUTER_MODEL}}

# Embed API Configuration (for workflow embedding)
NEXT_PUBLIC_EMBED_ENABLED=true
EMBED_MAX_API_KEYS_PER_WORKFLOW=10
EMBED_DEFAULT_RATE_LIMIT=1000

# Development URLs
NEXT_PUBLIC_BASE_URL="http://localhost:3000"
NEXT_PUBLIC_EMBED_URL="http://localhost:3000/embed"

# ========================================
# Authorization Configuration
# ========================================

# Enable/Disable Authorization
ZEAL_AUTH_ENABLED=${ZEAL_AUTH_ENABLED:-false}
ZEAL_AUTH_MODE=${ZEAL_AUTH_MODE:-development}

# Secret key for HMAC token signing (required for SDK token generation)
# Generate a secure random key if not set
if [ -z "$ZEAL_SECRET_KEY" ]; then
    ZEAL_SECRET_KEY=$(openssl rand -base64 32 2>/dev/null || echo "dev-secret-key-change-in-production")
fi
ZEAL_SECRET_KEY=${ZEAL_SECRET_KEY}

# Development Mode Settings
${ZEAL_DEV_USER_ID:+ZEAL_DEV_USER_ID=${ZEAL_DEV_USER_ID}}
${ZEAL_DEV_TENANT_ID:+ZEAL_DEV_TENANT_ID=${ZEAL_DEV_TENANT_ID}}
${ZEAL_DEV_ORG_ID:+ZEAL_DEV_ORG_ID=${ZEAL_DEV_ORG_ID}}
${ZEAL_DEV_ROLES:+ZEAL_DEV_ROLES=${ZEAL_DEV_ROLES}}
ZEAL_DEV_ALLOW_ALL=${ZEAL_DEV_ALLOW_ALL:-false}

# Production Mode - Identity Provider Configuration
${AUTH_JWT_ISSUER:+AUTH_JWT_ISSUER=${AUTH_JWT_ISSUER}}
${AUTH_JWT_AUDIENCE:+AUTH_JWT_AUDIENCE=${AUTH_JWT_AUDIENCE}}
${AUTH_JWT_JWKS_URI:+AUTH_JWT_JWKS_URI=${AUTH_JWT_JWKS_URI}}
${AUTH_JWT_PUBLIC_KEY:+AUTH_JWT_PUBLIC_KEY="${AUTH_JWT_PUBLIC_KEY}"}

# Claim Mappings (defaults for most identity providers)
AUTH_CLAIM_SUBJECT_ID=${AUTH_CLAIM_SUBJECT_ID:-sub}
AUTH_CLAIM_TENANT=${AUTH_CLAIM_TENANT:-tenant_id}
AUTH_CLAIM_ORGANIZATION=${AUTH_CLAIM_ORGANIZATION:-org_id}
AUTH_CLAIM_ROLES=${AUTH_CLAIM_ROLES:-roles}
AUTH_CLAIM_PERMISSIONS=${AUTH_CLAIM_PERMISSIONS:-permissions}

# Policy Configuration
ZEAL_AUTH_POLICIES_PATH=${ZEAL_AUTH_POLICIES_PATH:-./auth-policies.yaml}
ZEAL_AUTH_DEFAULT_EFFECT=${ZEAL_AUTH_DEFAULT_EFFECT:-deny}

# Cache Configuration
ZEAL_AUTH_CACHE_ENABLED=${ZEAL_AUTH_CACHE_ENABLED:-true}
ZEAL_AUTH_CACHE_TTL=${ZEAL_AUTH_CACHE_TTL:-300}

# Audit Configuration
ZEAL_AUTH_AUDIT_ENABLED=${ZEAL_AUTH_AUDIT_ENABLED:-false}
ZEAL_AUTH_AUDIT_LEVEL=${ZEAL_AUTH_AUDIT_LEVEL:-info}

# Auth Database Configuration
ZEAL_AUTH_USE_WORKFLOW_DB=true
ZEAL_AUTH_SCHEMA_NAME=${AUTH_SCHEMA}
EOF

    echo -e "${GREEN}✅ .env.local file created${NC}"
    rm -f .env.local.backup.*  # Clean up backups to avoid clutter
    
    # Show configuration summary
    echo ""
    echo -e "${BLUE}📋 Configuration Summary:${NC}"
    
    # Auth summary
    echo -e "\n   ${BLUE}Authorization:${NC}"
    if [ "$ZEAL_AUTH_ENABLED" = "true" ]; then
        echo -e "   ${GREEN}✓${NC} Authorization: Enabled (Mode: $ZEAL_AUTH_MODE)"
        if [ "$ZEAL_AUTH_MODE" = "development" ]; then
            echo -e "      User: $ZEAL_DEV_USER_ID"
            echo -e "      Roles: $ZEAL_DEV_ROLES"
        else
            echo -e "      Issuer: $AUTH_JWT_ISSUER"
        fi
    else
        echo -e "   ${YELLOW}○${NC} Authorization: Disabled"
    fi
    
    # AI summary
    echo -e "\n   ${BLUE}AI Services:${NC}"
    if [ "$EMBEDDING_VENDOR" = "openai" ]; then
        echo -e "   ${GREEN}✓${NC} OpenAI Embeddings: Configured (semantic search enabled)"
    else
        echo -e "   ${YELLOW}○${NC} OpenAI Embeddings: Using mock (basic search only)"
    fi
    
    if [ ! -z "$OPENROUTER_API_KEY" ]; then
        echo -e "   ${GREEN}✓${NC} OpenRouter: Configured (AI orchestration enabled)"
    else
        echo -e "   ${YELLOW}○${NC} OpenRouter: Not configured (orchestration disabled)"
    fi
    echo ""
}

# Function to start the Next.js dev server
start_nextjs() {
    echo -e "${BLUE}🔥 Starting Next.js development server...${NC}"
    echo ""
    echo -e "${GREEN}📌 Development server will be available at:${NC}"
    echo -e "${BLUE}   http://localhost:3000${NC}"
    echo ""
    echo -e "${YELLOW}💡 Connection details:${NC}"
    echo -e "   PostgreSQL:     localhost:${DB_PORT} (user: ${DB_USER}, pass: ${DB_PASSWORD})"
    echo -e "   TimescaleDB:    localhost:${TIMESCALE_PORT} (db: ${TIMESCALE_DB_NAME})"
    echo -e "   Redis:          localhost:${REDIS_PORT} (pass: ${REDIS_PASSWORD})"
    echo -e "   CRDT Server:    ws://localhost:${CRDT_PORT}"
    echo -e "   MinIO S3:       http://localhost:${MINIO_PORT}"
    echo -e "   MinIO Console:  http://localhost:${MINIO_CONSOLE_PORT} (user: ${MINIO_ROOT_USER}, pass: ${MINIO_ROOT_PASSWORD})"
    echo ""
    echo -e "${GREEN}🎯 Press Ctrl+C to stop all services${NC}"
    echo ""
    
    # Export Redis URL for CRDT server
    export REDIS_URL="redis://:${REDIS_PASSWORD}@localhost:${REDIS_PORT}"
    
    # Start Next.js in development mode (without CRDT server since it's in Docker)
    npm run serve
}

# Function to cleanup on exit
cleanup() {
    echo ""
    echo -e "${YELLOW}🛑 Shutting down services...${NC}"
    
    # Don't stop containers - let them keep running
    echo -e "${GREEN}✅ Services will continue running in the background${NC}"
    echo -e "${BLUE}   To stop them manually, run: ./stop-dev.sh${NC}"
}

# Set trap to cleanup on script exit
trap cleanup EXIT

# Main execution
main() {
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ Please run this script from the root of your Next.js project${NC}"
        exit 1
    fi
    
    # Load existing .env.local if it exists
    load_existing_env
    
    # Check Docker
    check_docker
    
    # Create Docker network
    create_docker_network
    
    # Start PostgreSQL
    start_postgres
    
    # Start TimescaleDB for flow traces
    start_timescaledb
    
    # Start Redis
    start_redis
    
    # Start MinIO
    start_minio
    
    # Start CRDT server
    start_crdt_server
    
    # Configure authorization (optional)
    configure_auth_services
    
    # Configure AI services (optional)
    configure_ai_services
    
    # Create environment file
    create_env_file
    
    # Create auth policies file if auth is enabled and file doesn't exist
    if [ "$ZEAL_AUTH_ENABLED" = "true" ] && [ ! -f "auth-policies.yaml" ]; then
        echo -e "${BLUE}📝 Creating default auth policies...${NC}"
        if [ -f "auth-policies.example.yaml" ]; then
            cp auth-policies.example.yaml auth-policies.yaml
            echo -e "${GREEN}✅ Created auth-policies.yaml from example${NC}"
        else
            # Create minimal default policies
            cat > auth-policies.yaml << 'EOF'
version: "1.0"
metadata:
  description: "Default authorization policies for Zeal development"
  
policies:
  # Allow all in development mode
  - id: dev-allow-all
    description: "Allow all access in development mode"
    priority: 1000
    effect: allow
    resources:
      - type: "*"
    actions: ["*"]
    conditions:
      - type: environment
        value: development
        
  # Default deny for production
  - id: default-deny
    description: "Deny by default in production"
    priority: 1
    effect: deny
    resources:
      - type: "*"
    actions: ["*"]
EOF
            echo -e "${GREEN}✅ Created default auth-policies.yaml${NC}"
        fi
    fi
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Installing npm dependencies...${NC}"
        npm install
    fi
    
    # Ingest node templates
    echo -e "${BLUE}📥 Ensuring node templates are ingested...${NC}"
    if [ "$FORCE_REINGEST" = "true" ]; then
        echo -e "${YELLOW}Force re-ingesting templates...${NC}"
        if npm run templates:ingest:force; then
            echo -e "${GREEN}✅ Node templates re-ingested${NC}"
        else
            echo -e "${YELLOW}⚠️  Template ingestion had warnings (this is usually fine)${NC}"
        fi
    else
        if npm run templates:ingest; then
            echo -e "${GREEN}✅ Node templates ready${NC}"
        else
            echo -e "${YELLOW}⚠️  Template ingestion had warnings (this is usually fine)${NC}"
        fi
    fi
    
    # Build GraphRAG snapshot if needed
    echo -e "${BLUE}🧠 Checking GraphRAG snapshot...${NC}"
    
    # If force reingest, delete existing snapshots first
    if [ "$FORCE_REINGEST" = "true" ]; then
        echo -e "${YELLOW}Force reingest enabled - removing existing GraphRAG snapshots...${NC}"
        
        # Delete snapshot from data directory
        if [ -f "data/graphrag-snapshot.json" ]; then
            rm -f "data/graphrag-snapshot.json"
            echo -e "${GREEN}✅ Removed data/graphrag-snapshot.json${NC}"
        fi
        
        # Delete snapshot from public directory
        if [ -f "public/graphrag-snapshot.json" ]; then
            rm -f "public/graphrag-snapshot.json"
            echo -e "${GREEN}✅ Removed public/graphrag-snapshot.json${NC}"
        fi
    fi
    
    if [ ! -f "data/graphrag-snapshot.json" ] || [ "$FORCE_REINGEST" = "true" ]; then
        echo -e "${YELLOW}Building GraphRAG snapshot...${NC}"
        if npm run graphrag:build; then
            echo -e "${GREEN}✅ GraphRAG snapshot built${NC}"
        else
            echo -e "${YELLOW}⚠️  GraphRAG build had warnings (using fallback mode)${NC}"
        fi
    else
        echo -e "${GREEN}✅ GraphRAG snapshot exists${NC}"
    fi
    
    echo ""
    echo -e "${GREEN}✅ All services are ready!${NC}"
    echo ""
    
    # Start Next.js
    start_nextjs
}

# Run main function
main