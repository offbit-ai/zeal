#!/bin/bash

# Zeal Microservices Deployment Script
# This script helps deploy Zeal as separate microservices

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_TYPE=""
USE_SUPABASE=false
COMPOSE_FILE="docker-compose.microservices.yml"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --supabase)
            USE_SUPABASE=true
            shift
            ;;
        local|production|logs|stop|clean)
            if [[ -z "$DEPLOYMENT_TYPE" ]]; then
                DEPLOYMENT_TYPE="$1"
            else
                echo -e "${RED}❌ Multiple deployment types specified${NC}"
                exit 1
            fi
            shift
            ;;
        -h|--help|help)
            DEPLOYMENT_TYPE="help"
            break
            ;;
        *)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            DEPLOYMENT_TYPE="help"
            break
            ;;
    esac
done

# Set default deployment type if not specified
DEPLOYMENT_TYPE=${DEPLOYMENT_TYPE:-local}

echo -e "${GREEN}🚀 Zeal Microservices Deployment${NC}"
echo -e "${GREEN}================================${NC}"

if [[ "$USE_SUPABASE" == "true" ]]; then
    echo -e "${YELLOW}Database Provider: Supabase${NC}"
else
    echo -e "${YELLOW}Database Provider: PostgreSQL${NC}"
fi
echo -e "${YELLOW}Deployment Type: ${DEPLOYMENT_TYPE}${NC}"
echo ""

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}❌ Docker is not installed${NC}"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}❌ Docker Compose is not installed${NC}"
        exit 1
    fi
    
    # Check environment file
    if [[ "$USE_SUPABASE" == "true" ]]; then
        if [[ ! -f .env.local ]]; then
            echo -e "${RED}❌ .env.local file not found${NC}"
            echo "Please copy .env.supabase.example to .env.local and configure it"
            exit 1
        fi
    else
        if [[ ! -f .env.local ]]; then
            echo -e "${YELLOW}⚠️  .env.local file not found, using defaults${NC}"
        fi
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to build services
build_services() {
    echo -e "${YELLOW}Building services...${NC}"
    
    # Build Next.js application
    echo -e "${YELLOW}Building Next.js application...${NC}"
    docker-compose -f $COMPOSE_FILE build nextjs
    
    # Build CRDT server
    echo -e "${YELLOW}Building CRDT server...${NC}"
    docker-compose -f $COMPOSE_FILE build crdt
    
    echo -e "${GREEN}✅ Services built successfully${NC}"
}

# Function to deploy local environment
deploy_local() {
    echo -e "${YELLOW}Deploying local environment...${NC}"
    
    if [[ "$USE_SUPABASE" == "true" ]]; then
        echo -e "${YELLOW}Using Supabase as database provider${NC}"
        docker-compose -f $COMPOSE_FILE up -d redis crdt nextjs
    else
        echo -e "${YELLOW}Using local PostgreSQL as database provider${NC}"
        docker-compose -f $COMPOSE_FILE --profile postgres up -d
    fi
    
    echo -e "${GREEN}✅ Local deployment complete${NC}"
    echo -e "${GREEN}Services:${NC}"
    echo "  - Next.js: http://localhost:3000"
    echo "  - CRDT Server: ws://localhost:8080"
    if [[ "$USE_SUPABASE" != "true" ]]; then
        echo "  - PostgreSQL: localhost:5432"
    fi
    echo "  - Redis: localhost:6379"
}

# Function to deploy production environment
deploy_production() {
    echo -e "${YELLOW}Deploying production environment...${NC}"
    
    # Check for production environment variables
    required_vars=("NEXTAUTH_SECRET")
    
    if [[ "$USE_SUPABASE" == "true" ]]; then
        echo -e "${YELLOW}Using Supabase as database provider${NC}"
        required_vars+=("SUPABASE_URL" "SUPABASE_ANON_KEY" "SUPABASE_SERVICE_ROLE_KEY")
    else
        echo -e "${YELLOW}Using PostgreSQL as database provider${NC}"
        required_vars+=("DATABASE_URL")
    fi
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            echo -e "${RED}❌ Missing required environment variable: $var${NC}"
            exit 1
        fi
    done
    
    # Deploy with nginx
    if [[ "$USE_SUPABASE" == "true" ]]; then
        # Don't start PostgreSQL when using Supabase
        docker-compose -f $COMPOSE_FILE up -d redis crdt nextjs nginx
    else
        # Start all services including PostgreSQL
        docker-compose -f $COMPOSE_FILE --profile production up -d
    fi
    
    echo -e "${GREEN}✅ Production deployment complete${NC}"
    echo -e "${GREEN}Services:${NC}"
    echo "  - Nginx: http://localhost (port 80)"
    echo "  - Next.js: http://localhost:3000 (internal)"
    echo "  - CRDT Server: ws://localhost:8080 (internal)"
    if [[ "$USE_SUPABASE" != "true" ]]; then
        echo "  - PostgreSQL: localhost:5432 (internal)"
    fi
    echo "  - Redis: localhost:6379 (internal)"
}

# Function to show logs
show_logs() {
    echo -e "${YELLOW}Showing logs (Ctrl+C to exit)...${NC}"
    docker-compose -f $COMPOSE_FILE logs -f
}

# Function to stop services
stop_services() {
    echo -e "${YELLOW}Stopping services...${NC}"
    docker-compose -f $COMPOSE_FILE down
    echo -e "${GREEN}✅ Services stopped${NC}"
}

# Function to clean up
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    docker-compose -f $COMPOSE_FILE down -v
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Main script logic
case "$DEPLOYMENT_TYPE" in
    "local")
        check_prerequisites
        build_services
        deploy_local
        ;;
    "production")
        check_prerequisites
        build_services
        deploy_production
        ;;
    "logs")
        show_logs
        ;;
    "stop")
        stop_services
        ;;
    "clean")
        cleanup
        ;;
    "help"|*)
        echo "Usage: $0 [OPTIONS] {local|production|logs|stop|clean}"
        echo ""
        echo "Commands:"
        echo "  local       - Deploy services locally"
        echo "  production  - Deploy services for production"
        echo "  logs        - Show service logs"
        echo "  stop        - Stop all services"
        echo "  clean       - Stop services and remove volumes"
        echo ""
        echo "Options:"
        echo "  --supabase  - Use Supabase instead of PostgreSQL"
        echo ""
        echo "Examples:"
        echo "  $0 local                    # Local deployment with PostgreSQL"
        echo "  $0 --supabase local         # Local deployment with Supabase"
        echo "  $0 production               # Production deployment with PostgreSQL"
        echo "  $0 --supabase production    # Production deployment with Supabase"
        exit 1
        ;;
esac