#!/bin/bash

# Script to manage Minikube tunnel for Zeal

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MINIKUBE_PROFILE="zeal"

# Function to check if tunnel is running
is_tunnel_running() {
    pgrep -f "minikube tunnel.*$MINIKUBE_PROFILE" > /dev/null
}

# Function to start tunnel
start_tunnel() {
    if is_tunnel_running; then
        echo -e "${YELLOW}Minikube tunnel is already running${NC}"
        echo -e "${GREEN}Access Zeal at: http://zeal.local${NC}"
        return 0
    fi
    
    echo -e "${YELLOW}Starting Minikube tunnel...${NC}"
    echo -e "${YELLOW}This requires sudo access${NC}"
    
    # Check if Minikube is running
    if ! minikube status -p $MINIKUBE_PROFILE 2>/dev/null | grep -q "Running"; then
        echo -e "${RED}Minikube cluster '$MINIKUBE_PROFILE' is not running${NC}"
        echo -e "${YELLOW}Start it with: minikube start -p $MINIKUBE_PROFILE${NC}"
        return 1
    fi
    
    # Get Minikube IP
    MINIKUBE_IP=$(minikube ip -p $MINIKUBE_PROFILE)
    
    # Update /etc/hosts if needed
    if ! grep -q "zeal.local" /etc/hosts; then
        echo -e "${YELLOW}Adding zeal.local to /etc/hosts...${NC}"
        echo "$MINIKUBE_IP zeal.local" | sudo tee -a /etc/hosts > /dev/null
    else
        CURRENT_IP=$(grep "zeal.local" /etc/hosts | awk '{print $1}')
        if [ "$CURRENT_IP" != "$MINIKUBE_IP" ]; then
            echo -e "${YELLOW}Updating zeal.local IP in /etc/hosts...${NC}"
            sudo sed -i.bak "s/.*zeal.local.*/$MINIKUBE_IP zeal.local/" /etc/hosts
        fi
    fi
    
    echo -e "${GREEN}Starting tunnel...${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop the tunnel${NC}"
    echo
    
    # Run tunnel in foreground
    sudo minikube tunnel -p $MINIKUBE_PROFILE --cleanup=true
}

# Function to stop tunnel
stop_tunnel() {
    if is_tunnel_running; then
        echo -e "${YELLOW}Stopping Minikube tunnel...${NC}"
        sudo pkill -f "minikube tunnel.*$MINIKUBE_PROFILE"
        echo -e "${GREEN}✅ Tunnel stopped${NC}"
    else
        echo -e "${YELLOW}Minikube tunnel is not running${NC}"
    fi
}

# Function to check status
check_status() {
    if is_tunnel_running; then
        echo -e "${GREEN}✅ Minikube tunnel is running${NC}"
        echo -e "${GREEN}   Access Zeal at: http://zeal.local${NC}"
        
        # Check if hosts entry exists
        if grep -q "zeal.local" /etc/hosts; then
            IP=$(grep "zeal.local" /etc/hosts | awk '{print $1}')
            echo -e "${GREEN}   Hosts entry: $IP zeal.local${NC}"
        fi
        
        # Show tunnel processes
        echo -e "${YELLOW}Tunnel processes:${NC}"
        ps aux | grep "minikube tunnel" | grep -v grep
    else
        echo -e "${YELLOW}Minikube tunnel is not running${NC}"
        
        # Check if cluster is running
        if minikube status -p $MINIKUBE_PROFILE 2>/dev/null | grep -q "Running"; then
            echo -e "${GREEN}Minikube cluster is running${NC}"
            echo -e "${YELLOW}Start tunnel with: $0 start${NC}"
        else
            echo -e "${RED}Minikube cluster is not running${NC}"
            echo -e "${YELLOW}Start cluster with: minikube start -p $MINIKUBE_PROFILE${NC}"
        fi
    fi
}

# Main logic
case "${1:-status}" in
    "start")
        start_tunnel
        ;;
    "stop")
        stop_tunnel
        ;;
    "restart")
        stop_tunnel
        sleep 1
        start_tunnel
        ;;
    "status")
        check_status
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status}"
        echo
        echo "Commands:"
        echo "  start   - Start Minikube tunnel (requires sudo)"
        echo "  stop    - Stop Minikube tunnel"
        echo "  restart - Restart Minikube tunnel"
        echo "  status  - Check if tunnel is running"
        echo
        echo "When tunnel is running, access Zeal at: http://zeal.local"
        exit 1
        ;;
esac