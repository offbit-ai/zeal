#!/bin/bash

# Script to manage Kubernetes port forwarding for Zeal

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PID_FILE="$PROJECT_ROOT/.minikube-port-forward.pid"
K8S_NAMESPACE="zeal"
DEFAULT_PORT="3000"

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 1
    else
        return 0
    fi
}

# Function to start port forwarding
start_forwarding() {
    local port=${1:-$DEFAULT_PORT}
    
    # Check if already running
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}Port forwarding is already running (PID: $PID)${NC}"
            echo -e "${YELLOW}Access Zeal at: http://localhost:$port${NC}"
            return 0
        fi
    fi
    
    # Check if port is available
    if ! check_port $port; then
        echo -e "${RED}Port $port is already in use${NC}"
        echo -e "${YELLOW}Try a different port: $0 start 3001${NC}"
        return 1
    fi
    
    # Start port forwarding
    echo -e "${YELLOW}Starting port forwarding on port $port...${NC}"
    kubectl port-forward svc/nextjs-service $port:3000 -n $K8S_NAMESPACE > /dev/null 2>&1 &
    PID=$!
    
    # Save PID
    echo $PID > "$PID_FILE"
    
    # Wait and test
    sleep 3
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port | grep -q "200\|302"; then
        echo -e "${GREEN}✅ Port forwarding started successfully${NC}"
        echo -e "${GREEN}🎉 Access Zeal at: http://localhost:$port${NC}"
    else
        echo -e "${YELLOW}⚠️  Port forwarding started but may need a moment to be ready${NC}"
        echo -e "${YELLOW}Try accessing: http://localhost:$port${NC}"
    fi
}

# Function to stop port forwarding
stop_forwarding() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${YELLOW}Stopping port forwarding (PID: $PID)...${NC}"
            kill $PID
            rm -f "$PID_FILE"
            echo -e "${GREEN}✅ Port forwarding stopped${NC}"
        else
            echo -e "${YELLOW}Port forwarding is not running${NC}"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${YELLOW}No port forwarding instance found${NC}"
    fi
}

# Function to check status
check_status() {
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 $PID 2>/dev/null; then
            echo -e "${GREEN}✅ Port forwarding is running (PID: $PID)${NC}"
            
            # Find which port is being used
            PORT=$(lsof -p $PID -a -i -P 2>/dev/null | grep LISTEN | awk '{print $9}' | cut -d: -f2 | head -1)
            if [ -n "$PORT" ]; then
                echo -e "${GREEN}   Access at: http://localhost:$PORT${NC}"
            fi
        else
            echo -e "${RED}Port forwarding process not found${NC}"
            rm -f "$PID_FILE"
        fi
    else
        echo -e "${YELLOW}Port forwarding is not running${NC}"
    fi
}

# Main logic
case "${1:-status}" in
    "start")
        start_forwarding "${2:-$DEFAULT_PORT}"
        ;;
    "stop")
        stop_forwarding
        ;;
    "restart")
        stop_forwarding
        sleep 1
        start_forwarding "${2:-$DEFAULT_PORT}"
        ;;
    "status")
        check_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status} [port]"
        echo
        echo "Commands:"
        echo "  start [port]  - Start port forwarding (default: 3000)"
        echo "  stop          - Stop port forwarding"
        echo "  restart [port] - Restart port forwarding"
        echo "  status        - Check if port forwarding is running"
        echo
        echo "Examples:"
        echo "  $0 start      # Start on default port 3000"
        echo "  $0 start 3001 # Start on port 3001"
        echo "  $0 stop       # Stop port forwarding"
        echo "  $0 status     # Check status"
        exit 1
        ;;
esac