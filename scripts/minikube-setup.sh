#!/bin/bash

# Zeal Minikube Local Development Setup
# This script sets up a local Kubernetes cluster with Minikube,
# builds and pushes images to a local registry, and deploys Zeal

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
REGISTRY_NAME="zeal-registry"
# Use port 5001 to avoid conflict with macOS AirPlay Receiver
REGISTRY_PORT="${REGISTRY_PORT:-5001}"
REGISTRY_URL="localhost:$REGISTRY_PORT"
MINIKUBE_PROFILE="zeal"
K8S_NAMESPACE="zeal"
DEPLOYMENT_FILE="$PROJECT_ROOT/k8s/deployment-generated.yaml"
# Allow memory override
MINIKUBE_MEMORY="${MINIKUBE_MEMORY:-}"

# Image configuration
NEXTJS_IMAGE_NAME="zeal-nextjs"
CRDT_IMAGE_NAME="zeal-crdt"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo -e "${GREEN}🚀 Zeal Minikube Local Development Setup${NC}"
echo -e "${GREEN}======================================${NC}"
echo

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    local missing=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing+=("docker")
    fi
    
    # Check Minikube
    if ! command -v minikube &> /dev/null; then
        missing+=("minikube")
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        missing+=("kubectl")
    else
        # Show kubectl version
        local kubectl_version=$(kubectl version --client --short 2>/dev/null | grep -oE 'v[0-9]+\.[0-9]+\.[0-9]+' || echo "unknown")
        echo -e "${GREEN}✅ kubectl version: $kubectl_version${NC}"
    fi
    
    if [ ${#missing[@]} -gt 0 ]; then
        echo -e "${RED}❌ Missing required tools: ${missing[*]}${NC}"
        echo
        echo "Installation instructions:"
        echo "  Docker: https://docs.docker.com/get-docker/"
        echo "  Minikube: https://minikube.sigs.k8s.io/docs/start/"
        echo "  kubectl: https://kubernetes.io/docs/tasks/tools/"
        exit 1
    fi
    
    echo -e "${GREEN}✅ All prerequisites installed${NC}"
    echo -e "${YELLOW}💡 Note: kubectl version warnings can usually be ignored${NC}"
    echo
    
    # Check ports
    check_all_ports
}

# Function to check port availability
check_port() {
    local port=$1
    # Check if lsof is available, fallback to nc if not
    if command -v lsof >/dev/null 2>&1; then
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            return 1
        else
            return 0
        fi
    elif command -v nc >/dev/null 2>&1; then
        # Fallback to netcat
        if nc -z localhost $port >/dev/null 2>&1; then
            return 1
        else
            return 0
        fi
    else
        # If neither tool is available, assume port is free
        echo -e "${YELLOW}⚠️  Cannot check port availability (install lsof or nc)${NC}"
        return 0
    fi
}

# Function to check all required ports
check_all_ports() {
    echo -e "${YELLOW}Checking port availability...${NC}"
    
    local ports_in_use=()
    local warnings=()
    
    # Check each port with service name
    # Using a simple function instead of associative array for compatibility
    check_port_with_name() {
        local port=$1
        local service=$2
        
        if ! check_port $port; then
            local process=""
            if command -v lsof >/dev/null 2>&1; then
                process=$(lsof -Pi :$port -sTCP:LISTEN 2>/dev/null | grep -v '^COMMAND' | head -n 1 | awk '{print $1}')
            fi
            if [ -n "$process" ]; then
                echo -e "${YELLOW}⚠️  Port $port ($service): IN USE by $process${NC}"
            else
                echo -e "${YELLOW}⚠️  Port $port ($service): IN USE${NC}"
            fi
            
            # Add to warnings for specific ports
            if [ "$port" = "$REGISTRY_PORT" ]; then
                warnings+=("Registry port $REGISTRY_PORT is in use. Will find alternative.")
            elif [ "$port" != "5432" ] && [ "$port" != "6379" ]; then
                # PostgreSQL and Redis might be external services, so we don't fail
                ports_in_use+=($port)
            fi
        else
            echo -e "${GREEN}✅ Port $port ($service): Available${NC}"
        fi
    }
    
    # Check each required port
    check_port_with_name 3000 "Next.js"
    check_port_with_name 5432 "PostgreSQL"
    check_port_with_name 6379 "Redis"
    check_port_with_name 8080 "CRDT Server"
    check_port_with_name $REGISTRY_PORT "Docker Registry"
    
    # Special check for macOS AirPlay on port 5000
    if [[ "$OSTYPE" == "darwin"* ]] && [ "$REGISTRY_PORT" = "5000" ] && ! check_port 5000; then
        echo
        echo -e "${YELLOW}💡 Port 5000 is likely used by macOS AirPlay Receiver${NC}"
        echo -e "${YELLOW}   You can disable it in: System Settings > General > AirDrop & Handoff${NC}"
        echo -e "${YELLOW}   Or the script will automatically use an alternative port${NC}"
    fi
    
    # Fail if critical ports are in use (excluding registry which we can change)
    if [ ${#ports_in_use[@]} -gt 0 ]; then
        echo
        echo -e "${RED}❌ Critical ports are in use: ${ports_in_use[*]}${NC}"
        echo -e "${RED}Please stop the conflicting services or use Docker Compose instead${NC}"
        exit 1
    fi
    
    # Show warnings
    if [ ${#warnings[@]} -gt 0 ]; then
        echo
        for warning in "${warnings[@]}"; do
            echo -e "${YELLOW}⚠️  $warning${NC}"
        done
    fi
    
    echo
}

# Function to find available port
find_available_port() {
    local start_port=$1
    local port=$start_port
    
    while ! check_port $port; do
        echo -e "${YELLOW}Port $port is in use, trying next port...${NC}"
        port=$((port + 1))
        if [ $port -gt $((start_port + 10)) ]; then
            echo -e "${RED}❌ Could not find available port in range $start_port-$port${NC}"
            exit 1
        fi
    done
    
    echo $port
}

# Function to start local Docker registry
start_local_registry() {
    echo -e "${YELLOW}Starting local Docker registry...${NC}"
    
    # Check if registry is already running
    if docker ps -a --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
        if docker ps --format '{{.Names}}' | grep -q "^${REGISTRY_NAME}$"; then
            # Get the port of the running registry
            EXISTING_PORT=$(docker port $REGISTRY_NAME 2>/dev/null | grep '5000/tcp' | cut -d':' -f2)
            if [ -n "$EXISTING_PORT" ]; then
                REGISTRY_PORT=$EXISTING_PORT
                REGISTRY_URL="localhost:$REGISTRY_PORT"
                echo -e "${GREEN}✅ Registry already running on port $REGISTRY_PORT${NC}"
                return 0
            fi
        else
            echo -e "${YELLOW}Removing stopped registry container...${NC}"
            docker rm $REGISTRY_NAME
        fi
    fi
    
    # Find available port
    if ! check_port $REGISTRY_PORT; then
        echo -e "${YELLOW}Port $REGISTRY_PORT is not available${NC}"
        if [[ "$OSTYPE" == "darwin"* ]] && [ "$REGISTRY_PORT" == "5000" ]; then
            echo -e "${YELLOW}Note: Port 5000 is used by AirPlay Receiver on macOS${NC}"
            echo -e "${YELLOW}You can disable it in System Preferences > Sharing > AirPlay Receiver${NC}"
        fi
        REGISTRY_PORT=$(find_available_port $REGISTRY_PORT)
        REGISTRY_URL="localhost:$REGISTRY_PORT"
    fi
    
    echo -e "${YELLOW}Creating new registry on port $REGISTRY_PORT...${NC}"
    docker run -d \
        --restart=always \
        --name $REGISTRY_NAME \
        -p $REGISTRY_PORT:5000 \
        registry:2
    
    # Wait for registry to be ready
    echo -e "${YELLOW}Waiting for registry to be ready...${NC}"
    for i in {1..30}; do
        if curl -s http://$REGISTRY_URL/v2/ > /dev/null; then
            echo -e "${GREEN}✅ Registry is ready${NC}"
            return 0
        fi
        sleep 1
    done
    
    echo -e "${RED}❌ Registry failed to start${NC}"
    exit 1
}

# Function to get Docker Desktop memory limit
get_docker_memory() {
    local memory_mb=0
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS - Docker Desktop
        if command -v docker >/dev/null 2>&1; then
            # Try to get memory from Docker info
            local docker_memory=$(docker info 2>/dev/null | grep -i "Total Memory" | grep -o '[0-9.]\+[GM]iB')
            if [ -n "$docker_memory" ]; then
                # Convert to MB
                if [[ "$docker_memory" =~ ^([0-9.]+)GiB$ ]]; then
                    # Use awk for floating point math
                    memory_mb=$(echo "${BASH_REMATCH[1]}" | awk '{print int($1 * 1024)}')
                elif [[ "$docker_memory" =~ ^([0-9.]+)MiB$ ]]; then
                    memory_mb=$(echo "${BASH_REMATCH[1]}" | awk '{print int($1)}')
                fi
            fi
        fi
    else
        # Linux - get system memory
        memory_mb=$(free -m | awk '/^Mem:/{print $2}')
    fi
    
    echo $memory_mb
}

# Function to calculate appropriate Minikube memory
calculate_minikube_memory() {
    # Check if memory is manually specified
    if [ -n "$MINIKUBE_MEMORY" ]; then
        echo -e "${YELLOW}Using specified Minikube memory: ${MINIKUBE_MEMORY}MB${NC}" >&2
        echo $MINIKUBE_MEMORY
        return
    fi
    
    local docker_memory=$(get_docker_memory)
    local minikube_memory=4096  # Default 4GB
    
    if [ $docker_memory -gt 0 ]; then
        # Use 60% of Docker Desktop memory, max 8GB
        local suggested_memory=$((docker_memory * 60 / 100))
        
        if [ $suggested_memory -lt 4096 ]; then
            minikube_memory=4096  # Minimum 4GB
        elif [ $suggested_memory -gt 8192 ]; then
            minikube_memory=8192  # Maximum 8GB
        else
            minikube_memory=$suggested_memory
        fi
        
        echo -e "${YELLOW}Docker Desktop memory: ${docker_memory}MB${NC}" >&2
        echo -e "${YELLOW}Allocating ${minikube_memory}MB to Minikube (60% of available)${NC}" >&2
    else
        echo -e "${YELLOW}Could not detect Docker memory, using default: ${minikube_memory}MB${NC}" >&2
    fi
    
    # Only output the numeric value to stdout
    echo $minikube_memory
}

# Function to start Minikube
start_minikube() {
    echo -e "${YELLOW}Starting Minikube cluster...${NC}"
    
    # Calculate appropriate memory (capture only the numeric output)
    local memory=$(calculate_minikube_memory | tail -n 1)
    
    # Validate memory is a number
    if ! [[ "$memory" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}❌ Error calculating memory allocation${NC}"
        exit 1
    fi
    
    # Check if Minikube profile exists
    if minikube profile list 2>/dev/null | grep -q "$MINIKUBE_PROFILE"; then
        echo -e "${YELLOW}Minikube profile '$MINIKUBE_PROFILE' exists${NC}"
        
        # Check if it's running
        if minikube status -p $MINIKUBE_PROFILE 2>/dev/null | grep -q "Running"; then
            echo -e "${GREEN}✅ Minikube already running${NC}"
        else
            echo -e "${YELLOW}Starting Minikube...${NC}"
            minikube start -p $MINIKUBE_PROFILE
        fi
    else
        echo -e "${YELLOW}Creating new Minikube profile...${NC}"
        echo -e "${YELLOW}Configuration:${NC}"
        echo -e "${YELLOW}  CPUs: 2${NC}"
        echo -e "${YELLOW}  Memory: ${memory}MB${NC}"
        echo -e "${YELLOW}  Disk: 20GB${NC}"
        
        # Use a more recent Kubernetes version
        # v1.30.0 is stable and compatible with kubectl 1.32.x
        minikube start -p $MINIKUBE_PROFILE \
            --cpus=2 \
            --memory="${memory}m" \
            --disk-size=20g \
            --kubernetes-version=v1.30.0 \
            --insecure-registry="$REGISTRY_URL" \
            --insecure-registry="host.docker.internal:5001" \
            --insecure-registry="host.docker.internal:5000"
    fi
    
    # Set kubectl context
    kubectl config use-context $MINIKUBE_PROFILE
    
    # Enable ingress addon
    echo -e "${YELLOW}Enabling ingress addon...${NC}"
    minikube addons enable ingress -p $MINIKUBE_PROFILE
    
    # Configure Docker to use Minikube's Docker daemon (optional)
    # eval $(minikube -p $MINIKUBE_PROFILE docker-env)
    
    echo -e "${GREEN}✅ Minikube is ready${NC}"
}

# Function to configure registry access in Minikube
configure_registry_access() {
    echo -e "${YELLOW}Configuring registry access in Minikube...${NC}"
    
    # Get host IP as seen from Minikube
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        HOST_IP="host.docker.internal"
    else
        # Linux
        HOST_IP=$(minikube ssh -p $MINIKUBE_PROFILE "route -n | grep '^0.0.0.0' | awk '{print \$2}'")
    fi
    
    # Update Minikube's /etc/hosts
    minikube ssh -p $MINIKUBE_PROFILE "echo '$HOST_IP host.docker.internal' | sudo tee -a /etc/hosts > /dev/null"
    
    echo -e "${GREEN}✅ Registry access configured${NC}"
}

# Function to build images
build_images() {
    echo -e "${YELLOW}Building Docker images...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Build Next.js image
    echo -e "${YELLOW}Building Next.js image...${NC}"
    # Determine CRDT URL based on ingress port (will be set later)
    local CRDT_URL="ws://zeal.local"
    if [ "${INGRESS_PORT:-80}" != "80" ]; then
        CRDT_URL="ws://zeal.local:${INGRESS_PORT:-8080}"
    fi
    docker build -t $NEXTJS_IMAGE_NAME:$IMAGE_TAG \
        --build-arg NODE_ENV=production \
        --build-arg NEXT_PUBLIC_CRDT_SERVER_URL="$CRDT_URL" \
        -f Dockerfile .
    
    # Build CRDT server image
    echo -e "${YELLOW}Building CRDT server image...${NC}"
    docker build -t $CRDT_IMAGE_NAME:$IMAGE_TAG \
        -f crdt-server/Dockerfile \
        ./crdt-server
    
    echo -e "${GREEN}✅ Images built successfully${NC}"
}

# Function to push images to local registry
push_images() {
    echo -e "${YELLOW}Loading images into Minikube...${NC}"
    
    # For Minikube, we'll load images directly instead of using a registry
    # This avoids HTTPS/insecure registry issues
    echo -e "${YELLOW}Loading Next.js image...${NC}"
    docker save $NEXTJS_IMAGE_NAME:$IMAGE_TAG | minikube -p $MINIKUBE_PROFILE image load -
    
    echo -e "${YELLOW}Loading CRDT server image...${NC}"
    docker save $CRDT_IMAGE_NAME:$IMAGE_TAG | minikube -p $MINIKUBE_PROFILE image load -
    
    # Also tag for registry (for backward compatibility)
    docker tag $NEXTJS_IMAGE_NAME:$IMAGE_TAG $REGISTRY_URL/$NEXTJS_IMAGE_NAME:$IMAGE_TAG
    docker tag $CRDT_IMAGE_NAME:$IMAGE_TAG $REGISTRY_URL/$CRDT_IMAGE_NAME:$IMAGE_TAG
    
    echo -e "${GREEN}✅ Images loaded into Minikube${NC}"
}

# Function to deploy Supabase
deploy_supabase() {
    echo -e "${YELLOW}Deploying local Supabase...${NC}"
    
    # Ensure namespace exists
    kubectl create namespace $K8S_NAMESPACE --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1
    
    # Use minimal version for better ARM64 compatibility
    if [ -f "$PROJECT_ROOT/k8s/supabase-minimal.yaml" ]; then
        kubectl apply -f "$PROJECT_ROOT/k8s/supabase-minimal.yaml"
    else
        kubectl apply -f "$PROJECT_ROOT/k8s/supabase-local.yaml"
    fi
    
    # Wait for core Supabase services to be ready
    echo -e "${YELLOW}Waiting for Supabase services to be ready...${NC}"
    kubectl wait --for=condition=available --timeout=120s \
        deployment/supabase-db \
        deployment/supabase-auth \
        deployment/supabase-rest \
        -n $K8S_NAMESPACE 2>/dev/null || true
    
    # Also wait for gateway if using minimal setup
    kubectl wait --for=condition=available --timeout=60s \
        deployment/supabase-gateway \
        -n $K8S_NAMESPACE 2>/dev/null || true
    
    echo -e "${GREEN}✅ Supabase deployed${NC}"
    
    # Initialize database schema
    echo -e "${YELLOW}Initializing Supabase database schema...${NC}"
    
    # Wait a bit more for services to stabilize
    sleep 10
    
    # Apply schema if file exists
    if [ -f "$PROJECT_ROOT/supabase-init.sql" ]; then
        # Get the pod name
        DB_POD=$(kubectl get pods -n $K8S_NAMESPACE -l app=supabase-db -o jsonpath='{.items[0].metadata.name}' 2>/dev/null)
        
        if [ -n "$DB_POD" ]; then
            echo -e "${YELLOW}Applying database schema...${NC}"
            # Copy and execute the init SQL
            kubectl cp "$PROJECT_ROOT/supabase-init.sql" $K8S_NAMESPACE/$DB_POD:/tmp/init.sql
            kubectl exec -n $K8S_NAMESPACE $DB_POD -- psql -U postgres -d postgres -f /tmp/init.sql || true
            echo -e "${GREEN}✅ Database schema initialized${NC}"
        else
            echo -e "${YELLOW}⚠️  Could not find database pod to initialize schema${NC}"
        fi
    fi
}

# Function to generate K8s deployment config
generate_deployment() {
    echo -e "${YELLOW}Generating Kubernetes deployment configuration...${NC}"
    
    # Create a temporary answers file for the deployment generator
    ANSWERS_FILE=$(mktemp)
    
    # Determine registry URL from Minikube's perspective
    if [[ "$OSTYPE" == "darwin"* ]]; then
        MINIKUBE_REGISTRY_URL="host.docker.internal:$REGISTRY_PORT"
    else
        HOST_IP=$(minikube ssh -p $MINIKUBE_PROFILE "route -n | grep '^0.0.0.0' | awk '{print \$2}'")
        MINIKUBE_REGISTRY_URL="$HOST_IP:$REGISTRY_PORT"
    fi
    
    # Generate NextAuth secret if not provided
    if [ -z "$NEXTAUTH_SECRET" ]; then
        NEXTAUTH_SECRET=$(openssl rand -base64 32)
    fi
    
    # Determine if we should use Supabase (check if explicitly set to false)
    local USE_SUPABASE="${USE_SUPABASE:-no}"
    
    if [[ "$USE_SUPABASE" =~ ^[Nn][Oo]?$ ]]; then
        # Use PostgreSQL - use local images without registry prefix
        cat > "$ANSWERS_FILE" << EOF
$K8S_NAMESPACE
zeal.local
$NEXTJS_IMAGE_NAME:$IMAGE_TAG
$CRDT_IMAGE_NAME:$IMAGE_TAG

2
1
no
postgresql://postgres:postgres@postgres-service:5432/zeal_db
$NEXTAUTH_SECRET
http://zeal.local
no

EOF
    else
        # Use Supabase - use local images without registry prefix
        cat > "$ANSWERS_FILE" << EOF
$K8S_NAMESPACE
zeal.local
$NEXTJS_IMAGE_NAME:$IMAGE_TAG
$CRDT_IMAGE_NAME:$IMAGE_TAG

2
1
yes
http://supabase-gateway:8000
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MjA2OTc5MDU5OCwiaWF0IjoxNzU0NDMwNTk4fQ.Zpmigdx8mkloUQhtD-ZtwKWp9LmmbgSbHXU45KSqOHA
postgresql://postgres:postgres@supabase-db:5432/postgres
$NEXTAUTH_SECRET
http://zeal.local
no

EOF
    fi
    
    # Run the generator script with answers
    cd "$PROJECT_ROOT"
    ./scripts/generate-k8s-deployment.sh < "$ANSWERS_FILE"
    
    # Clean up
    rm -f "$ANSWERS_FILE"
    
    # Add PostgreSQL deployment to the generated file if not using Supabase
    if [[ "$USE_SUPABASE" =~ ^[Nn][Oo]?$ ]]; then
        cat >> "$DEPLOYMENT_FILE" << 'EOF'
---
# PostgreSQL Deployment for local development
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres-deployment
  namespace: zeal
spec:
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
        image: postgres:16-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          value: "postgres"
        - name: POSTGRES_PASSWORD
          value: "postgres"
        - name: POSTGRES_DB
          value: "zeal_db"
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        - name: init-sql
          mountPath: /docker-entrypoint-initdb.d/init.sql
          subPath: init.sql
      volumes:
      - name: postgres-storage
        emptyDir: {}
      - name: init-sql
        configMap:
          name: postgres-init
---
apiVersion: v1
kind: Service
metadata:
  name: postgres-service
  namespace: zeal
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432
  type: ClusterIP
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: postgres-init
  namespace: zeal
data:
  init.sql: |
EOF
    
        # Append init.sql content
        if [ -f "$PROJECT_ROOT/init.sql" ]; then
            cat "$PROJECT_ROOT/init.sql" | sed 's/^/    /' >> "$DEPLOYMENT_FILE"
        fi
    fi
    
    echo -e "${GREEN}✅ Deployment configuration generated${NC}"
    
    # Return whether Supabase is being used
    if [[ "$USE_SUPABASE" =~ ^[Nn][Oo]?$ ]]; then
        echo "no"
    else
        echo "yes"
    fi
}

# Function to deploy to Kubernetes
deploy_to_k8s() {
    echo -e "${YELLOW}Deploying to Kubernetes...${NC}"
    
    # Ensure namespace exists
    kubectl create namespace $K8S_NAMESPACE --dry-run=client -o yaml | kubectl apply -f - >/dev/null 2>&1
    
    # Apply the deployment
    kubectl apply -f "$DEPLOYMENT_FILE"
    
    # Wait for deployments to be ready
    echo -e "${YELLOW}Waiting for deployments to be ready...${NC}"
    
    # Base deployments to wait for
    local deployments="deployment/nextjs-deployment deployment/crdt-deployment deployment/redis-deployment"
    
    # Add database deployment based on what was generated
    if kubectl get deployment/postgres-deployment -n $K8S_NAMESPACE &>/dev/null; then
        deployments="$deployments deployment/postgres-deployment"
    fi
    
    kubectl wait --for=condition=available --timeout=300s $deployments -n $K8S_NAMESPACE
    
    echo -e "${GREEN}✅ Deployment complete${NC}"
}

# Function to setup local DNS
setup_local_access() {
    echo -e "${YELLOW}Setting up local access...${NC}"
    
    # Get Minikube IP
    MINIKUBE_IP=$(minikube ip -p $MINIKUBE_PROFILE)
    
    # Check if /etc/hosts has the entry
    if ! grep -q "zeal.local" /etc/hosts; then
        echo -e "${YELLOW}Adding zeal.local to /etc/hosts (requires sudo)...${NC}"
        echo "127.0.0.1 zeal.local" | sudo tee -a /etc/hosts > /dev/null
        echo -e "${GREEN}✅ Added zeal.local to /etc/hosts${NC}"
    else
        # Update existing entry if IP changed
        CURRENT_IP=$(grep "zeal.local" /etc/hosts | awk '{print $1}')
        if [ "$CURRENT_IP" != "$MINIKUBE_IP" ]; then
            echo -e "${YELLOW}Updating zeal.local IP in /etc/hosts (requires sudo)...${NC}"
            sudo sed -i.bak "s/.*zeal.local.*/127.0.0.1 zeal.local/" /etc/hosts
            echo -e "${GREEN}✅ Updated zeal.local IP to $MINIKUBE_IP${NC}"
        fi
    fi
    
    # For Docker driver on macOS, tunnel often has issues
    # So we'll use ingress controller port forwarding instead
    echo -e "${YELLOW}Setting up ingress access...${NC}"
    
    # Kill any existing port forwards on port 80
    lsof -ti:80 | xargs kill -9 2>/dev/null || true
    
    # Start port forwarding to ingress controller
    echo -e "${YELLOW}Starting ingress controller port forwarding...${NC}"
    kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 80:80 > /dev/null 2>&1 &
    INGRESS_PID=$!
    
    # Save PID for cleanup
    echo $INGRESS_PID > "$PROJECT_ROOT/.minikube-ingress.pid"
    
    # Wait for port forward to be ready
    sleep 3
    
    # Test if it's working
    if curl -s -o /dev/null -w "%{http_code}" -H "Host: zeal.local" http://localhost 2>/dev/null | grep -q "200\|302"; then
        echo -e "${GREEN}✅ Ingress port forwarding started successfully${NC}"
        INGRESS_PORT=80
    else
        echo -e "${YELLOW}⚠️  Port 80 requires sudo. Trying alternative port 8080...${NC}"
        kill $INGRESS_PID 2>/dev/null || true
        
        # Try port 8080 instead
        kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8080:80 > /dev/null 2>&1 &
        INGRESS_PID=$!
        echo $INGRESS_PID > "$PROJECT_ROOT/.minikube-ingress.pid"
        sleep 3
        
        if curl -s -o /dev/null -w "%{http_code}" -H "Host: zeal.local" http://localhost:8080 2>/dev/null | grep -q "200\|302"; then
            echo -e "${GREEN}✅ Ingress port forwarding started on port 8080${NC}"
            INGRESS_PORT=8080
        else
            echo -e "${YELLOW}⚠️  Ingress setup may need manual configuration${NC}"
            INGRESS_PORT=8080
        fi
    fi
    
    echo
    echo -e "${GREEN}✅ Setup complete!${NC}"
    echo
    echo -e "${YELLOW}Registry running on port: $REGISTRY_PORT${NC}"
    echo
    if [ "${INGRESS_PORT:-80}" = "80" ]; then
        echo -e "${GREEN}🎉 Zeal is now accessible at: http://zeal.local${NC}"
    else
        echo -e "${GREEN}🎉 Zeal is now accessible at: http://zeal.local:${INGRESS_PORT}${NC}"
        echo -e "${YELLOW}   Note: Using port ${INGRESS_PORT} because port 80 requires sudo${NC}"
    fi
    echo
    echo -e "${YELLOW}Ingress controller forwarding is running in the background (PID: $INGRESS_PID)${NC}"
    echo
    echo -e "${YELLOW}Important: For proper domain access, configure your browser:${NC}"
    echo "1. Install a hosts file manager extension (like 'Livehosts' for Chrome)"
    echo "2. Or modify your system's hosts file"
    echo "3. Or access with curl: curl -H 'Host: zeal.local' http://localhost:${INGRESS_PORT:-80}"
    echo
    echo -e "${YELLOW}Alternative access (direct service):${NC}"
    echo "   kubectl port-forward svc/nextjs-service 3000:3000 -n zeal"
    echo "   Access at http://localhost:3000"
    echo
    # Check if Supabase is deployed
    if kubectl get deployment/supabase-gateway -n $K8S_NAMESPACE &>/dev/null; then
        echo -e "${YELLOW}Supabase Local Instance:${NC}"
        echo "  URL: http://zeal.local:8000"
        echo "  Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        echo "  Service Role Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
        echo
    fi
    
    echo -e "${YELLOW}Useful commands:${NC}"
    echo "  View pods:        kubectl get pods -n $K8S_NAMESPACE"
    echo "  View logs:        kubectl logs -f deployment/nextjs-deployment -n $K8S_NAMESPACE"
    echo "  Port forward:     kubectl port-forward svc/nextjs-service 3000:3000 -n $K8S_NAMESPACE"
    echo "  Minikube dashboard: minikube dashboard -p $MINIKUBE_PROFILE"
    echo
}

# Function to cleanup
cleanup() {
    echo -e "${YELLOW}Cleaning up...${NC}"
    
    # Stop ingress port forwarding if running
    if [ -f "$PROJECT_ROOT/.minikube-ingress.pid" ]; then
        PID=$(cat "$PROJECT_ROOT/.minikube-ingress.pid")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}Stopping ingress port forwarding (PID: $PID)...${NC}"
            kill $PID
        fi
        rm -f "$PROJECT_ROOT/.minikube-ingress.pid"
    fi
    
    # Delete Kubernetes resources
    if [ -f "$DEPLOYMENT_FILE" ]; then
        kubectl delete -f "$DEPLOYMENT_FILE" --ignore-not-found=true
    fi
    
    # Stop Minikube
    minikube stop -p $MINIKUBE_PROFILE
    
    # Stop registry
    docker stop $REGISTRY_NAME || true
    
    echo -e "${GREEN}✅ Cleanup complete${NC}"
    echo -e "${YELLOW}Note: /etc/hosts entry for zeal.local was preserved${NC}"
    echo -e "${YELLOW}To remove it: sudo sed -i '' '/zeal.local/d' /etc/hosts${NC}"
}

# Main script logic
case "${1:-setup}" in
    "setup")
        check_prerequisites
        start_local_registry
        start_minikube
        configure_registry_access
        build_images
        push_images
        using_supabase=$(generate_deployment)
        if [ "$using_supabase" = "yes" ]; then
            deploy_supabase
        fi
        deploy_to_k8s
        setup_local_access
        ;;
    "build")
        build_images
        push_images
        ;;
    "deploy")
        deploy_to_k8s
        ;;
    "clean")
        cleanup
        ;;
    "status")
        echo -e "${YELLOW}Minikube status:${NC}"
        minikube status -p $MINIKUBE_PROFILE
        echo
        echo -e "${YELLOW}Kubernetes resources:${NC}"
        kubectl get all -n $K8S_NAMESPACE
        ;;
    *)
        echo "Usage: $0 {setup|build|deploy|clean|status}"
        echo
        echo "Commands:"
        echo "  setup   - Complete setup (build, push, deploy)"
        echo "  build   - Build and push images only"
        echo "  deploy  - Deploy to Kubernetes only"
        echo "  clean   - Clean up all resources"
        echo "  status  - Show current status"
        exit 1
        ;;
esac