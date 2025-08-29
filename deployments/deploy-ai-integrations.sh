#!/bin/bash

# Deploy AI Integrations for Zeal
# This script deploys OpenAI Functions and MCP servers alongside Zeal

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_TYPE="${1:-docker}"  # docker, k8s, or swarm
ENVIRONMENT="${2:-production}"  # development, staging, or production
BUILD_GRAPHRAG="${3:-true}"     # Whether to build GraphRAG

echo -e "${GREEN}🚀 Deploying Zeal AI Integrations${NC}"
echo "Deployment Type: $DEPLOYMENT_TYPE"
echo "Environment: $ENVIRONMENT"
echo ""

# Check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check for required environment variables
    if [ -z "$OPENROUTER_API_KEY" ] && [ "$BUILD_GRAPHRAG" = "true" ]; then
        echo -e "${YELLOW}⚠️  Warning: OPENROUTER_API_KEY not set. AI features will be limited.${NC}"
        echo "   Set this in your .env file to enable full AI capabilities."
        read -p "Continue without AI features? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check Docker
    if [ "$DEPLOYMENT_TYPE" = "docker" ] || [ "$DEPLOYMENT_TYPE" = "swarm" ]; then
        if ! command -v docker &> /dev/null; then
            echo -e "${RED}❌ Docker not found. Please install Docker.${NC}"
            exit 1
        fi
        
        if ! docker info &> /dev/null; then
            echo -e "${RED}❌ Docker daemon not running. Please start Docker.${NC}"
            exit 1
        fi
    fi
    
    # Check Kubernetes
    if [ "$DEPLOYMENT_TYPE" = "k8s" ]; then
        if ! command -v kubectl &> /dev/null; then
            echo -e "${RED}❌ kubectl not found. Please install kubectl.${NC}"
            exit 1
        fi
        
        if ! kubectl cluster-info &> /dev/null; then
            echo -e "${RED}❌ Cannot connect to Kubernetes cluster. Please configure kubectl.${NC}"
            exit 1
        fi
    fi
    
    echo -e "${GREEN}✅ Prerequisites check passed${NC}"
}

# Build GraphRAG knowledge graph
build_graphrag() {
    if [ "$BUILD_GRAPHRAG" != "true" ]; then
        echo -e "${YELLOW}Skipping GraphRAG build...${NC}"
        return
    fi
    
    echo -e "${YELLOW}Building GraphRAG knowledge graph...${NC}"
    
    if [ -f "data/graphrag-snapshot.json" ]; then
        echo "GraphRAG snapshot already exists."
        read -p "Rebuild? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Using existing GraphRAG snapshot."
            return
        fi
    fi
    
    # Run GraphRAG builder
    if [ -n "$OPENROUTER_API_KEY" ]; then
        OPENROUTER_API_KEY=$OPENROUTER_API_KEY npm run graphrag:build || {
            echo -e "${YELLOW}⚠️  GraphRAG build failed. Continuing without it...${NC}"
        }
    else
        echo -e "${YELLOW}⚠️  Skipping GraphRAG build (no API key)${NC}"
    fi
}

# Build Docker images
build_docker_images() {
    echo -e "${YELLOW}Building Docker images...${NC}"
    
    # Build OpenAI Functions server
    echo "Building OpenAI Functions server..."
    docker build -t zeal/openai-functions:latest \
        -f ai-integrations/openai-functions/Dockerfile \
        ai-integrations/openai-functions
    
    # Build MCP server
    echo "Building MCP server..."
    docker build -t zeal/mcp-server:latest \
        -f ai-integrations/mcp-server/Dockerfile \
        ai-integrations/mcp-server
    
    echo -e "${GREEN}✅ Docker images built${NC}"
}

# Deploy with Docker Compose
deploy_docker_compose() {
    echo -e "${YELLOW}Deploying with Docker Compose...${NC}"
    
    # Build images
    build_docker_images
    
    # Start services
    if [ "$ENVIRONMENT" = "development" ]; then
        docker-compose -f docker-compose.yml -f docker-compose.ai.yml up -d
    else
        docker-compose -f docker-compose.yml -f docker-compose.ai.yml -f docker-compose.prod.yml up -d
    fi
    
    echo -e "${GREEN}✅ AI services deployed with Docker Compose${NC}"
    echo ""
    echo "Services available at:"
    echo "  - OpenAI Functions: http://localhost:3456"
    echo "  - MCP Server: http://localhost:3457"
    echo "  - AI Load Balancer: http://localhost:3450 (if using production profile)"
}

# Deploy with Docker Swarm
deploy_docker_swarm() {
    echo -e "${YELLOW}Deploying with Docker Swarm...${NC}"
    
    # Build images
    build_docker_images
    
    # Initialize swarm if needed
    if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
        echo "Initializing Docker Swarm..."
        docker swarm init
    fi
    
    # Create overlay network
    docker network create --driver overlay zeal-network 2>/dev/null || true
    
    # Deploy stack
    docker stack deploy -c docker-compose.yml -c docker-compose.ai.yml zeal-ai
    
    echo -e "${GREEN}✅ AI services deployed with Docker Swarm${NC}"
    echo ""
    echo "Check status with: docker stack services zeal-ai"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    echo -e "${YELLOW}Deploying to Kubernetes...${NC}"
    
    # Build and push images (assuming a registry is configured)
    if [ -n "$DOCKER_REGISTRY" ]; then
        echo "Building and pushing images to $DOCKER_REGISTRY..."
        
        # Build images
        build_docker_images
        
        # Tag and push
        docker tag zeal/openai-functions:latest $DOCKER_REGISTRY/zeal/openai-functions:latest
        docker tag zeal/mcp-server:latest $DOCKER_REGISTRY/zeal/mcp-server:latest
        
        docker push $DOCKER_REGISTRY/zeal/openai-functions:latest
        docker push $DOCKER_REGISTRY/zeal/mcp-server:latest
        
        # Update image references in K8s manifests
        sed -i "s|zeal/openai-functions:latest|$DOCKER_REGISTRY/zeal/openai-functions:latest|g" deployments/k8s/ai-integrations.yaml
        sed -i "s|zeal/mcp-server:latest|$DOCKER_REGISTRY/zeal/mcp-server:latest|g" deployments/k8s/ai-integrations.yaml
    fi
    
    # Apply Kubernetes manifests
    echo "Applying Kubernetes manifests..."
    kubectl apply -f deployments/k8s/ai-integrations.yaml
    
    # Wait for deployments
    echo "Waiting for deployments to be ready..."
    kubectl -n zeal-ai wait --for=condition=available --timeout=300s deployment/openai-functions
    kubectl -n zeal-ai wait --for=condition=available --timeout=300s deployment/mcp-server
    
    echo -e "${GREEN}✅ AI services deployed to Kubernetes${NC}"
    echo ""
    echo "Check status with: kubectl -n zeal-ai get pods"
    echo "Port forward for local access:"
    echo "  kubectl -n zeal-ai port-forward svc/openai-functions 3456:3456"
    echo "  kubectl -n zeal-ai port-forward svc/mcp-server 3457:3457"
}

# Health check
check_health() {
    echo -e "${YELLOW}Checking service health...${NC}"
    
    # Wait a bit for services to start
    sleep 10
    
    # Check OpenAI Functions
    if curl -f http://localhost:3456/health &> /dev/null; then
        echo -e "${GREEN}✅ OpenAI Functions server is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  OpenAI Functions server not responding${NC}"
    fi
    
    # Check MCP Server
    if curl -f http://localhost:3457/health &> /dev/null; then
        echo -e "${GREEN}✅ MCP server is healthy${NC}"
    else
        echo -e "${YELLOW}⚠️  MCP server not responding${NC}"
    fi
}

# Cleanup function
cleanup() {
    echo -e "${YELLOW}Cleaning up AI services...${NC}"
    
    case $DEPLOYMENT_TYPE in
        docker)
            docker-compose -f docker-compose.yml -f docker-compose.ai.yml down
            ;;
        swarm)
            docker stack rm zeal-ai
            ;;
        k8s)
            kubectl delete -f deployments/k8s/ai-integrations.yaml
            ;;
    esac
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Show usage
show_usage() {
    echo "Usage: $0 [deployment_type] [environment] [build_graphrag]"
    echo ""
    echo "Arguments:"
    echo "  deployment_type: docker (default), k8s, or swarm"
    echo "  environment: development, staging, or production (default)"
    echo "  build_graphrag: true (default) or false"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy with Docker Compose in production"
    echo "  $0 k8s development    # Deploy to Kubernetes in development"
    echo "  $0 swarm production false  # Deploy to Swarm without GraphRAG"
    echo ""
    echo "Commands:"
    echo "  $0 cleanup [deployment_type]  # Remove AI services"
}

# Main execution
main() {
    # Handle cleanup command
    if [ "$1" = "cleanup" ]; then
        DEPLOYMENT_TYPE="${2:-docker}"
        cleanup
        exit 0
    fi
    
    # Handle help command
    if [ "$1" = "help" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_usage
        exit 0
    fi
    
    # Check prerequisites
    check_prerequisites
    
    # Build GraphRAG if needed
    build_graphrag
    
    # Deploy based on type
    case $DEPLOYMENT_TYPE in
        docker)
            deploy_docker_compose
            check_health
            ;;
        swarm)
            deploy_docker_swarm
            ;;
        k8s)
            deploy_kubernetes
            ;;
        *)
            echo -e "${RED}❌ Invalid deployment type: $DEPLOYMENT_TYPE${NC}"
            show_usage
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}🎉 AI Integrations deployment complete!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure your AI clients to use the services"
    echo "2. Test with: curl http://localhost:3456/tools"
    echo "3. Monitor logs: docker-compose logs -f openai-functions mcp-server"
    echo ""
    echo "For cleanup, run: $0 cleanup $DEPLOYMENT_TYPE"
}

# Run main function
main "$@"