# Zeal Production Deployment Guide

Comprehensive deployment solutions for Zeal across different platforms and cloud providers.

## 📋 Table of Contents

- [Deployment Options](#deployment-options)
- [AI Integrations](#ai-integrations)
- [Quick Decision Guide](#quick-decision-guide)
- [Platform Comparison](#platform-comparison)
- [Architecture Overview](#architecture-overview)
- [Component Requirements](#component-requirements)

## 🚀 Deployment Options

### AI Integrations (Optional Add-on)
**Enhance Zeal with AI-powered workflow orchestration**

- **[AI Integrations Guide](#ai-integrations)** - OpenAI Functions & Anthropic MCP servers
- GraphRAG-powered intelligent node selection
- Natural language workflow generation
- Automatic optimization and debugging
- Compatible with all deployment options below

```bash
# Quick deployment with Docker
./deployments/deploy-ai-integrations.sh
```

### 1. K3s (Self-Hosted)
**Best for**: On-premise, edge computing, cost-conscious deployments

- **[K3s Deployment Guide](k3s/)** - Lightweight Kubernetes for self-hosted environments
- Single-node or multi-node cluster support
- Automatic TLS with Let's Encrypt
- Built-in monitoring with Prometheus/Grafana
- Automated backup and restore

```bash
cd deployments/k3s
./deploy.sh --domain zeal.example.com
```

### 2. AWS
**Best for**: Scalable cloud deployments with AWS services integration

- **[AWS EKS Deployment Guide](aws/)** - Production-ready AWS deployment
- **EKS** (Elastic Kubernetes Service) deployment
- **RDS** for PostgreSQL with Multi-AZ + TimescaleDB
- **ElastiCache** for Redis cluster mode
- **S3** for object storage and backups
- **CloudFront** CDN integration
- **Route53** DNS management
- **AWS Backup** for automated backups

```bash
cd deployments/aws
./deploy.sh
```

### 3. Azure
**Best for**: Microsoft ecosystem integration

- **[Azure AKS Deployment Guide](azure/)** - Enterprise Azure deployment
- **AKS** (Azure Kubernetes Service) deployment
- **Azure Database for PostgreSQL** Flexible Server
- **Azure Cache for Redis** Premium tier
- **Azure Blob Storage** with lifecycle policies
- **Azure Front Door** CDN and WAF
- **Azure DNS** management
- **Azure Backup** and Key Vault integration

```bash
cd deployments/azure
./deploy.sh
```

### 4. GCP
**Best for**: Google Cloud Platform users

- **[GCP GKE Deployment Guide](gcp/)** - Scalable GCP deployment
- **GKE** (Google Kubernetes Engine) with Autopilot option
- **Cloud SQL** for PostgreSQL + separate TimescaleDB
- **Memorystore** for Redis with HA
- **Cloud Storage** with intelligent tiering
- **Cloud CDN** and Load Balancing
- **Cloud DNS** and Certificate Manager
- **Secret Manager** and Workload Identity

```bash
cd deployments/gcp
./deploy.sh
```

## 🎯 Quick Decision Guide

| Criteria | K3s | AWS | Azure | GCP |
|----------|-----|-----|-------|-----|
| **Setup Complexity** | Medium | High | High | High |
| **Cost** | Low | High | High | High |
| **Scalability** | Good | Excellent | Excellent | Excellent |
| **Maintenance** | Manual | Managed | Managed | Managed |
| **Geographic Distribution** | Limited | Global | Global | Global |
| **Compliance** | Self-managed | AWS compliance | Azure compliance | GCP compliance |
| **Best For** | Small-Medium | Enterprise | Microsoft shops | Google ecosystem |

## 📊 Platform Comparison

### Resource Requirements

| Component | K3s (Min) | K3s (Recommended) | Cloud (Typical) |
|-----------|-----------|-------------------|-----------------|
| **Nodes** | 1 | 3 | 3-10 |
| **CPU per Node** | 4 cores | 8 cores | 8-16 cores |
| **RAM per Node** | 8GB | 16GB | 32GB |
| **Storage** | 100GB SSD | 500GB SSD | 1TB SSD |
| **Network** | 1Gbps | 10Gbps | 10Gbps+ |

### Cost Optimization

All cloud deployments include comprehensive cost optimization strategies:

- **Auto-scaling** to match resource usage with demand
- **Spot/Preemptible instances** for significant cost savings
- **Reserved instances** for predictable workloads
- **Storage lifecycle policies** for automated cost management
- **Resource monitoring** to identify optimization opportunities

*Note: Actual costs vary significantly based on region, usage patterns, and specific configurations. Each deployment guide includes platform-specific optimization tips.*

## 🏗️ Architecture Overview

All deployment options implement the following architecture:

```mermaid
graph TB
    subgraph "External Services"
        DNS[DNS Provider]
        CDN[CDN]
        S3[Object Storage]
    end
    
    subgraph "Kubernetes Cluster"
        subgraph "Ingress Layer"
            LB[Load Balancer]
            ING[Ingress Controller]
            CERT[Cert Manager]
        end
        
        subgraph "Application Layer"
            ZEAL[Zeal App<br/>3+ replicas]
            CRDT[CRDT Server<br/>2+ replicas]
            ZIP[ZIP WebSocket]
        end
        
        subgraph "Data Layer"
            PG[(PostgreSQL<br/>Primary + Replicas)]
            TS[(TimescaleDB<br/>For Traces)]
            REDIS[(Redis<br/>Cache & PubSub)]
            MINIO[(Object Storage<br/>Local/S3)]
        end
        
        subgraph "Observability"
            PROM[Prometheus]
            GRAF[Grafana]
            LOKI[Loki]
            JAEGER[Jaeger]
        end
    end
    
    Users[Users] --> DNS
    DNS --> CDN
    CDN --> LB
    LB --> ING
    ING --> ZEAL
    ING --> ZIP
    ZEAL --> CRDT
    ZEAL --> PG
    ZEAL --> TS
    ZEAL --> REDIS
    ZEAL --> MINIO
    CRDT --> REDIS
```

## 📦 Component Requirements

### Core Components

| Component | Purpose | Required | Alternatives |
|-----------|---------|----------|--------------|
| **PostgreSQL** | Main database | Yes | Supabase |
| **TimescaleDB** | Flow trace storage | Yes | PostgreSQL with partitioning |
| **Redis** | Cache & PubSub | Yes | KeyDB, DragonflyDB |
| **MinIO** | Object storage | Yes | AWS S3, Azure Blob, GCS |
| **CRDT Server** | Real-time sync | Yes | None |

### Supporting Services

| Service | Purpose | Required | Notes |
|---------|---------|----------|-------|
| **Ingress Controller** | HTTP routing | Yes | Traefik, NGINX, HAProxy |
| **Cert Manager** | TLS certificates | Recommended | Manual certificates |
| **Prometheus** | Metrics | Recommended | For monitoring |
| **Grafana** | Dashboards | Recommended | For visualization |
| **Loki** | Logs | Optional | For log aggregation |
| **Jaeger** | Tracing | Optional | For distributed tracing |

## 🤖 AI Integrations

Optional AI-powered features for intelligent workflow orchestration.

### Components

1. **OpenAI Functions Server** - GPT integration for workflow automation
2. **Anthropic MCP Server** - Claude integration with advanced AI features
3. **GraphRAG Engine** - Knowledge graph for intelligent node selection

### Deployment Options

#### Docker Compose (Recommended for Quick Start)
```bash
# Deploy alongside main Zeal instance
docker-compose -f docker-compose.yml -f docker-compose.ai.yml up -d

# Or use the deployment script
./deployments/deploy-ai-integrations.sh docker production
```

#### Kubernetes
```bash
# Deploy to Kubernetes cluster
kubectl apply -f deployments/k8s/ai-integrations.yaml

# Or use the deployment script
./deployments/deploy-ai-integrations.sh k8s production
```

#### Docker Swarm
```bash
# Deploy to Docker Swarm
./deployments/deploy-ai-integrations.sh swarm production
```

### Configuration

Required environment variables for AI features:

```bash
# OpenRouter API (for GraphRAG and LLM features)
OPENROUTER_API_KEY=your-api-key
OPENROUTER_MODEL=anthropic/claude-3-haiku-20240307

# Service URLs (automatically configured in Docker)
OPENAI_FUNCTIONS_URL=http://openai-functions:3456
MCP_SERVER_URL=http://mcp-server:3457

# Optional settings
ENABLE_AI_OPTIMIZATION=true
ENABLE_AUTO_DESIGN=true
ENABLE_SMART_DEBUG=true
```

### Building GraphRAG

Before using AI features, build the knowledge graph:

```bash
# One-time setup
./ai-integrations/setup-ai.sh

# Or manually
OPENROUTER_API_KEY=your-key npm run graphrag:build
```

### Service Endpoints

- **OpenAI Functions**: Port 3456
  - `/tools` - List available functions
  - `/execute` - Execute functions
  - `/stream` - SSE streaming

- **MCP Server**: Port 3457
  - `/tools` - List MCP tools
  - `/resources` - Available resources
  - `/prompts` - Prompt templates

### Load Balancing

For production deployments with multiple AI server instances:

```yaml
# Use the included nginx load balancer
services:
  ai-loadbalancer:
    profiles:
      - production
```

### Monitoring

AI services expose metrics at `/metrics`:
- Function call frequency
- Response times (p50, p95, p99)
- Error rates by function
- Token usage tracking

### Security

- API key authentication
- Rate limiting (configurable)
- JWT token support
- Network isolation

## 🔧 Common Configuration

### Environment Variables

All deployments use these core environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/zeal_db
TIMESCALE_HOST=timescaledb
TIMESCALE_PORT=5432
TIMESCALE_DATABASE=zeal_traces

# Redis
REDIS_URL=redis://:password@redis:6379

# CRDT Server
NEXT_PUBLIC_CRDT_SERVER_URL=wss://zeal.example.com/ws

# Authentication
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=https://zeal.example.com

# Storage
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=<generated-password>
MINIO_BUCKET=zeal-uploads

# Features
NEXT_PUBLIC_ENABLE_COLLABORATION=true
NEXT_PUBLIC_ENABLE_FLOW_TRACING=true
NEXT_PUBLIC_ENABLE_VERSION_HISTORY=true
```

### Security Considerations

All deployments should implement:

1. **Network Security**
   - Network policies for pod-to-pod communication
   - Firewall rules for external access
   - Private subnets for databases

2. **Data Security**
   - Encryption at rest for all storage
   - Encryption in transit (TLS/SSL)
   - Regular security updates

3. **Access Control**
   - RBAC for Kubernetes resources
   - Database user permissions
   - API authentication

4. **Backup & Recovery**
   - Automated daily backups
   - Point-in-time recovery
   - Disaster recovery plan

5. **Monitoring & Alerting**
   - Resource usage monitoring
   - Application performance monitoring
   - Security event monitoring
   - Alert routing (email, Slack, PagerDuty)

## 📚 Documentation

- **[K3s Deployment](k3s/)** - Complete guide for K3s deployment
- **[AWS EKS Deployment](aws/)** - Enterprise AWS deployment with EKS
- **[Azure AKS Deployment](azure/)** - Microsoft Azure deployment with AKS
- **[GCP GKE Deployment](gcp/)** - Google Cloud deployment with GKE
- **[Monitoring Setup](k3s/monitoring/)** - Prometheus, Grafana, and alerting
- **[Backup & Recovery](k3s/backup/)** - Automated backup strategies
- **[Security Hardening](k3s/docs/security.md)** - Security best practices
- **[Troubleshooting](k3s/docs/troubleshooting.md)** - Common issues and solutions

## 🤝 Support

For deployment assistance:
- GitHub Issues: https://github.com/offbit-ai/zeal/issues
- Documentation: https://docs.zeal.com
- Community: https://discord.gg/zeal

## 📄 License

Apache 2.0 - See [LICENSE](../LICENSE) for details