#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
POSTGRES_CONTAINER="zeal-postgres"
REDIS_CONTAINER="zeal-redis"
CRDT_CONTAINER="zeal-crdt-server"
DOCKER_NETWORK="zeal-network"
DB_NAME="zeal_db"
DB_USER="zeal_user"
DB_PASSWORD="zeal_password"
DB_PORT="5432"
REDIS_PORT="6379"
REDIS_PASSWORD="redispass123"
CRDT_PORT="8080"

echo -e "${BLUE}🚀 Starting Zeal Development Environment${NC}"
echo ""

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
            postgres:15-alpine > /dev/null
    fi
    
    # Wait for PostgreSQL to be ready
    echo -e "Waiting for PostgreSQL..."
    for i in {1..30}; do
        if docker exec $POSTGRES_CONTAINER pg_isready -U $DB_USER > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
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

# Function to start CRDT server
start_crdt_server() {
    echo -e "${BLUE}🦀 Starting CRDT server...${NC}"
    
    # Check if container exists
    if [ "$(docker ps -aq -f name=^${CRDT_CONTAINER}$)" ]; then
        if [ "$(docker ps -q -f name=^${CRDT_CONTAINER}$)" ]; then
            echo -e "${YELLOW}CRDT server is already running${NC}"
            return
        else
            echo -e "Starting existing CRDT server container..."
            docker start $CRDT_CONTAINER > /dev/null
        fi
    else
        echo -e "Building and starting CRDT server..."
        # Build the CRDT server image if it doesn't exist
        if [ -d "crdt-server" ]; then
            docker build -t zeal-crdt-server:latest ./crdt-server > /dev/null 2>&1
            
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

# Function to create .env.local file
create_env_file() {
    echo -e "${BLUE}📝 Creating .env.local file...${NC}"
    
    # Check if .env.local already exists
    if [ -f .env.local ]; then
        echo -e "${YELLOW}⚠️  .env.local already exists. Creating backup...${NC}"
        cp .env.local .env.local.backup.$(date +%Y%m%d_%H%M%S)
    fi
    
    # Create .env.local with database and Redis configuration
    cat > .env.local << EOF
# Database Configuration
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:${DB_PORT}/${DB_NAME}?schema=public"

# Redis Configuration
REDIS_URL="redis://:${REDIS_PASSWORD}@localhost:${REDIS_PORT}"
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
EOF

    echo -e "${GREEN}✅ .env.local file created${NC}"
}

# Function to start the Next.js dev server
start_nextjs() {
    echo -e "${BLUE}🔥 Starting Next.js development server...${NC}"
    echo ""
    echo -e "${GREEN}📌 Development server will be available at:${NC}"
    echo -e "${BLUE}   http://localhost:3000${NC}"
    echo ""
    echo -e "${YELLOW}💡 Connection details:${NC}"
    echo -e "   PostgreSQL:  localhost:${DB_PORT} (user: ${DB_USER}, pass: ${DB_PASSWORD})"
    echo -e "   Redis:       localhost:${REDIS_PORT} (pass: ${REDIS_PASSWORD})"
    echo -e "   CRDT Server: ws://localhost:${CRDT_PORT}"
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
    
    # Check Docker
    check_docker
    
    # Create Docker network
    create_docker_network
    
    # Start PostgreSQL
    start_postgres
    
    # Start Redis
    start_redis
    
    # Start CRDT server
    start_crdt_server
    
    # Create environment file
    create_env_file
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        echo -e "${BLUE}📦 Installing npm dependencies...${NC}"
        npm install
    fi
    
    echo ""
    echo -e "${GREEN}✅ All services are ready!${NC}"
    echo ""
    
    # Start Next.js
    start_nextjs
}

# Run main function
main