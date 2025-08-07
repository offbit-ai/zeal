# Minikube Local Kubernetes Development

This guide explains how to run Zeal in a local Kubernetes cluster using Minikube.

## Prerequisites

1. **Docker Desktop** or **Docker Engine**
   - macOS/Windows: [Docker Desktop](https://www.docker.com/products/docker-desktop)
   - Linux: [Docker Engine](https://docs.docker.com/engine/install/)

2. **Minikube**

   ```bash
   # macOS
   brew install minikube

   # Linux/Windows
   # See: https://minikube.sigs.k8s.io/docs/start/
   ```

3. **kubectl**

   ```bash
   # macOS
   brew install kubectl

   # Linux/Windows
   # See: https://kubernetes.io/docs/tasks/tools/
   ```

**Note**: The script uses Kubernetes v1.30.0 by default. kubectl version warnings about compatibility can usually be ignored as kubectl is compatible with clusters within +/- 1 minor version.

## Quick Start

For a completely automated setup with default values:

```bash
./scripts/minikube-quick-setup.sh
```

This will:

- Start a local Docker registry
- Create a Minikube cluster
- Build and push images
- Deploy Zeal with PostgreSQL
- Configure `/etc/hosts` for domain access
- **Automatically start Minikube tunnel**
- **Enable access at http://zeal.local**

**Note**: You'll be prompted for sudo password to:

- Update `/etc/hosts`
- Start Minikube tunnel

## Manual Setup

### 1. Complete Setup (Recommended)

Run the interactive setup script:

```bash
./scripts/minikube-setup.sh setup
```

This will guide you through:

- Checking all required ports for availability
- Starting a local Docker registry (default port 5001, auto-detects conflicts)
- Creating/starting a Minikube cluster
- Building the Next.js and CRDT server images
- Pushing images to the local registry
- Generating Kubernetes deployment configuration
- Deploying all services
- Setting up local access

**Features**:

- Automatic port conflict detection and resolution
- macOS AirPlay Receiver detection (port 5000)
- Intelligent port selection for Docker registry
- Pre-flight checks for all services

### 2. Step-by-Step Setup

If you prefer to run steps individually:

```bash
# Start local registry and Minikube
./scripts/minikube-setup.sh setup

# Build and push images only
./scripts/minikube-setup.sh build

# Deploy to Kubernetes only
./scripts/minikube-setup.sh deploy

# Check status
./scripts/minikube-setup.sh status

# Clean up everything
./scripts/minikube-setup.sh clean
```

## How It Works

### Pre-flight Checks

Before starting, the script:

1. Verifies Docker, Minikube, and kubectl are installed
2. Checks all required ports (3000, 5001, 5432, 6379, 8080)
3. Detects port conflicts and suggests alternatives
4. Identifies macOS-specific issues (AirPlay)

### Architecture

The Minikube setup creates:

```
┌─────────────────┐
│   Minikube VM   │
├─────────────────┤
│ ┌─────────────┐ │     ┌──────────────┐
│ │ Next.js Pod │ │────▶│ Local Docker │
│ └─────────────┘ │     │   Registry   │
│ ┌─────────────┐ │     │  Port 5000   │
│ │  CRDT Pod   │ │◀────│              │
│ └─────────────┘ │     └──────────────┘
│ ┌─────────────┐ │
│ │ PostgreSQL  │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │   Redis     │ │
│ └─────────────┘ │
└─────────────────┘
```

## Accessing the Application

The setup script automatically configures Minikube tunnel and updates `/etc/hosts`, making Zeal accessible at **http://zeal.local**.

### Automatic Setup

During setup, the script:

1. Adds/updates `zeal.local` in `/etc/hosts` (requires sudo)
2. Starts Minikube tunnel in the background
3. Verifies access is working

You'll be prompted for your password to:

- Modify `/etc/hosts`
- Start the tunnel (requires sudo)

### Managing the Tunnel

Use the provided script to manage the tunnel:

```bash
# Check tunnel status
./scripts/manage-minikube-tunnel.sh status

# Stop tunnel
./scripts/manage-minikube-tunnel.sh stop

# Start tunnel (if not running)
./scripts/manage-minikube-tunnel.sh start

# Restart tunnel
./scripts/manage-minikube-tunnel.sh restart
```

### Alternative: Port Forwarding

If you prefer not to use sudo or have issues with the tunnel:

```bash
# Use port forwarding instead
kubectl port-forward svc/nextjs-service 3000:3000 -n zeal

# Access at http://localhost:3000
```

### Troubleshooting Access

1. **Tunnel not working?**

   ```bash
   # Check if tunnel is running
   ps aux | grep 'minikube tunnel'

   # Restart tunnel manually
   sudo minikube tunnel -p zeal --cleanup=true
   ```

2. **Can't access http://zeal.local?**

   ```bash
   # Verify /etc/hosts entry
   cat /etc/hosts | grep zeal.local

   # Should show: 192.168.58.2 zeal.local (IP may vary)
   ```

3. **Permission denied?**
   - The tunnel requires sudo to modify network routes
   - You'll be prompted for your password during setup

## Useful Commands

### Port Forwarding (Alternative Access)

If you can't modify /etc/hosts or prefer direct access:

```bash
# Forward Next.js service
kubectl port-forward svc/nextjs-service 3000:3000 -n zeal

# Access at http://localhost:3000
```

### View Resources

```bash
# All resources in zeal namespace
kubectl get all -n zeal

# Watch pods
kubectl get pods -n zeal -w

# Describe a pod
kubectl describe pod <pod-name> -n zeal
```

### View Logs

```bash
# Next.js logs
kubectl logs -f deployment/nextjs-deployment -n zeal

# CRDT server logs
kubectl logs -f deployment/crdt-deployment -n zeal

# PostgreSQL logs
kubectl logs -f deployment/postgres-deployment -n zeal
```

### Debugging

```bash
# Open Minikube dashboard
minikube dashboard -p zeal

# SSH into Minikube
minikube ssh -p zeal

# Execute commands in a pod
kubectl exec -it <pod-name> -n zeal -- /bin/sh
```

### Manage Images

```bash
# List images in local registry (adjust port if needed)
curl http://localhost:5001/v2/_catalog

# List tags for an image
curl http://localhost:5001/v2/zeal-nextjs/tags/list
```

## Configuration

The setup script generates a deployment with these defaults:

| Setting            | Default Value         |
| ------------------ | --------------------- |
| Namespace          | zeal                  |
| Domain             | zeal.local            |
| Next.js Replicas   | 2                     |
| CRDT Replicas      | 1                     |
| Database           | PostgreSQL (local)    |
| Registry           | localhost:5001        |
| Kubernetes Version | v1.30.0               |
| Minikube CPUs      | 2                     |
| Minikube Memory    | 60% of Docker Desktop |

To customize, edit the generated `k8s/deployment-generated.yaml` before deploying.

## Using with Supabase

### Option 1: Local Supabase (Default)

The setup script now deploys a local Supabase instance by default. This includes:

- PostgreSQL database
- Auth service (GoTrue)
- REST API (PostgREST)
- Storage service
- Kong API Gateway
- Realtime server

**Note**: On ARM64 (Apple Silicon) systems, some Supabase components may have compatibility issues:

- Kong may require alternative images
- Realtime server may need additional configuration

### Option 2: Cloud Supabase

To use your existing Supabase project:

1. Set environment variables:

   ```bash
   export USE_SUPABASE=no  # Disable local Supabase
   export SUPABASE_URL="your-supabase-url"
   export SUPABASE_ANON_KEY="your-anon-key"
   export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
   ```

2. Run the setup:
   ```bash
   ./scripts/minikube-setup.sh setup
   ```

## Troubleshooting

### Memory Issues

**"Docker Desktop has only XXXXMB memory but you specified YYYYMB"**

1. **Increase Docker Desktop memory**:
   - Open Docker Desktop Settings
   - Go to Resources > Advanced
   - Increase Memory allocation
   - Apply & Restart

2. **Use less memory for Minikube**:

   ```bash
   # Specify custom memory (in MB)
   MINIKUBE_MEMORY=4096 ./scripts/minikube-setup.sh setup
   ```

3. **Check current Docker memory**:
   ```bash
   docker info | grep "Total Memory"
   ```

### kubectl Version Warning

**"❗ kubectl is version X.XX.X, which may have incompatibilities"**

This warning can usually be ignored. kubectl is designed to work with Kubernetes clusters within +/- 1 minor version:

- kubectl 1.32 works fine with Kubernetes 1.30-1.31
- kubectl 1.31 works fine with Kubernetes 1.29-1.30

If you want to eliminate the warning:

1. Update Minikube's Kubernetes version to match kubectl
2. Or downgrade kubectl to match the cluster version

### Port Conflicts

The setup script automatically detects and handles port conflicts. If a port is in use:

1. **Registry Port**: Script automatically finds an available port
2. **Critical Service Ports** (3000, 8080): Script will fail and ask you to stop conflicting services
3. **Database Ports** (5432, 6379): Warning only (might be external services)

**Manual port configuration**:

```bash
# Use a specific registry port
REGISTRY_PORT=5002 ./scripts/minikube-setup.sh

# Check what's using a port
lsof -i :5001
```

**macOS AirPlay Receiver**:
If port 5000 is in use, the script will detect it's AirPlay and automatically use 5001.
To disable AirPlay: System Settings > General > AirDrop & Handoff > AirPlay Receiver

### Registry Connection Issues

If pods can't pull images with "server gave HTTP response to HTTPS client" error:

**Solution 1: Load images directly (Recommended)**
The updated setup script now loads images directly into Minikube instead of using a registry:

```bash
docker save zeal-nextjs:latest | minikube -p zeal image load -
docker save zeal-crdt:latest | minikube -p zeal image load -
```

**Solution 2: Fix insecure registry**
If you need to use a registry:

```bash
# Restart Minikube with insecure registry
minikube stop -p zeal
minikube start -p zeal --insecure-registry="host.docker.internal:5001"

# Or configure containerd (if used)
minikube ssh -p zeal
sudo mkdir -p /etc/containerd/certs.d/host.docker.internal:5001
echo 'server = "http://host.docker.internal:5001"' | sudo tee /etc/containerd/certs.d/host.docker.internal:5001/hosts.toml
sudo systemctl restart containerd
```

### Pod Crashes

Check pod logs and events:

```bash
# View recent events
kubectl get events -n zeal --sort-by='.lastTimestamp'

# Describe problematic pod
kubectl describe pod <pod-name> -n zeal
```

### Database Connection Issues

Ensure PostgreSQL is running and initialized:

```bash
# Check PostgreSQL pod
kubectl logs deployment/postgres-deployment -n zeal

# Connect to PostgreSQL
kubectl exec -it deployment/postgres-deployment -n zeal -- psql -U postgres -d zeal_db
```

### Clean Start

For a completely fresh start:

```bash
# Clean up everything
./scripts/minikube-setup.sh clean

# Delete Minikube profile
minikube delete -p zeal

# Remove local registry
docker rm -f zeal-registry

# Start over
./scripts/minikube-setup.sh setup
```

## Resource Requirements

### Minimum Requirements

- **Docker Desktop Memory**: 6GB (4GB minimum for Minikube)
- **CPU**: 2 cores
- **Disk**: 20GB free space

### Recommended Requirements

- **Docker Desktop Memory**: 8GB or more
- **CPU**: 4 cores
- **Disk**: 30GB free space

### Memory Allocation

The script automatically detects available Docker Desktop memory and allocates:

- **Minimum**: 4GB to Minikube
- **Default**: 60% of Docker Desktop memory
- **Maximum**: 8GB to Minikube

### Configuring Docker Desktop Memory

**macOS**:

1. Open Docker Desktop
2. Go to Settings (⚙️) > Resources
3. Increase Memory to at least 6GB
4. Click "Apply & Restart"

**Windows**:

1. Open Docker Desktop
2. Go to Settings > Resources > Advanced
3. Increase Memory to at least 6GB
4. Click "Apply & Restart"

**Linux**:

- Docker uses system memory directly
- Ensure you have at least 8GB total RAM

## Security Notes

This setup is for **local development only**:

- Uses insecure registry without TLS
- Default passwords for PostgreSQL
- No network policies
- Basic auth secrets

For production, use proper:

- TLS certificates
- Secret management
- Network policies
- RBAC configuration

## Next Steps

1. Make code changes
2. Rebuild and push images: `./scripts/minikube-setup.sh build`
3. Apply changes: `kubectl rollout restart deployment -n zeal`
4. Monitor: `kubectl get pods -n zeal -w`

For production deployment, see the [Kubernetes Deployment Guide](../k8s/README.md).
