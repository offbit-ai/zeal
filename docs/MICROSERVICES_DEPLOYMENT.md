# Microservices Deployment Guide

This guide explains how to deploy Zeal as microservices with support for Supabase as an alternative database provider.

## Architecture Overview

The microservices architecture separates Zeal into independent, scalable services:

1. **Next.js Frontend Service** - The web application UI
2. **CRDT Server Service** - Real-time collaboration engine (Rust)
3. **Database Service** - PostgreSQL (local) or Supabase (cloud)
4. **Redis Service** - CRDT state persistence
5. **Nginx Service** (optional) - Reverse proxy for production

## Deployment Options

### Option 1: Local PostgreSQL

Traditional deployment with all services running locally.

```bash
# Deploy with local PostgreSQL
./scripts/deploy-microservices.sh local
```

### Option 2: Supabase (Recommended for Production)

Use Supabase as a managed PostgreSQL database with additional features.

```bash
# Set up Supabase environment
cp .env.supabase.example .env.local

# Edit .env.local with your Supabase credentials
# Then deploy
USE_SUPABASE=true ./scripts/deploy-microservices.sh local
```

### Option 3: Kubernetes

For production-grade deployments at scale.

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/deployment.yaml
```

## Supabase Setup

### 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Create a new project
3. Note down:
   - Project URL
   - Anon Key
   - Service Role Key
   - Database connection string

### 2. Run Database Migrations

```sql
-- Connect to your Supabase SQL editor
-- Run the migration from supabase/migrations/001_initial_schema.sql
```

### 3. Configure Environment

```bash
# .env.local
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
DATABASE_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
USE_SUPABASE=true
```

## Docker Compose Microservices

The `docker-compose.microservices.yml` file provides:

- Service isolation
- Independent scaling
- Health checks
- Networking
- Volume management

### Services Configuration

#### Next.js Service

- Port: 3000
- Replicas: Scalable
- Health check: `/api/health`
- Environment: Production optimized

#### CRDT Server

- Port: 8080
- WebSocket support
- Redis persistence
- Rust performance

#### Redis

- Port: 6379
- Data persistence
- CRDT state storage

## Deployment Commands

### Local Development

```bash
# Start all services
./scripts/deploy-microservices.sh local

# View logs
./scripts/deploy-microservices.sh logs

# Stop services
./scripts/deploy-microservices.sh stop

# Clean up (removes volumes)
./scripts/deploy-microservices.sh clean
```

### Production Deployment

```bash
# Deploy with production settings
./scripts/deploy-microservices.sh production

# This includes:
# - Nginx reverse proxy
# - SSL termination ready
# - Production environment variables
# - Optimized builds
```

## Environment Variables

### Required for All Deployments

- `NEXTAUTH_URL` - Your application URL
- `NEXTAUTH_SECRET` - Random secret for NextAuth
- `DATABASE_URL` - PostgreSQL connection string

### Required for Supabase

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)
- `USE_SUPABASE=true` - Enable Supabase provider

### Required for CRDT Server

- `REDIS_URL` - Redis connection string
- `CRDT_SERVER_URL` - WebSocket URL for clients

## Database Provider Abstraction

The application supports multiple database providers through an abstraction layer:

```typescript
// Automatically selects provider based on USE_SUPABASE env var
import { createDatabaseProvider } from '@/lib/database/provider'

const provider = createDatabaseProvider()
```

### PostgreSQL Provider

- Direct SQL queries
- Connection pooling
- Transaction support

### Supabase Provider

- Supabase client SDK
- Row Level Security
- Real-time subscriptions (optional)

## Scaling Considerations

### Horizontal Scaling

1. **Next.js**: Multiple replicas behind load balancer
2. **CRDT Server**: Sticky sessions required for WebSocket
3. **Redis**: Consider Redis Cluster for high availability
4. **PostgreSQL**: Use read replicas

### Vertical Scaling

Adjust resource limits in:

- `docker-compose.microservices.yml`
- `k8s/deployment.yaml`

## Monitoring

### Health Checks

- Next.js: `http://localhost:3000/api/health`
- CRDT: `http://localhost:8080/health`
- Redis: `redis-cli ping`

### Logs

```bash
# All services
docker-compose -f docker-compose.microservices.yml logs -f

# Specific service
docker-compose -f docker-compose.microservices.yml logs -f nextjs
```

## Security

### Production Checklist

- [ ] Set strong `NEXTAUTH_SECRET`
- [ ] Use HTTPS/WSS in production
- [ ] Secure database credentials
- [ ] Enable Supabase RLS policies
- [ ] Restrict CORS origins
- [ ] Use environment-specific configs

### Supabase Security

- Row Level Security enabled by default
- Service role key only on backend
- Anonymous key for public operations

## Troubleshooting

### Common Issues

1. **CRDT connection failures**
   - Check WebSocket URL
   - Verify Redis is running
   - Check CORS settings

2. **Database connection errors**
   - Verify DATABASE_URL
   - Check Supabase project status
   - Ensure migrations ran

3. **Authentication issues**
   - Verify NEXTAUTH_SECRET
   - Check callback URLs
   - Ensure cookies are enabled

### Debug Mode

```bash
# Enable debug logging
RUST_LOG=debug ./scripts/deploy-microservices.sh local

# Next.js debug
DEBUG=* npm run dev
```

## Migration from Monolith

1. Export existing data
2. Run Supabase migrations
3. Update environment variables
4. Deploy microservices
5. Import data
6. Update DNS/proxy

## Future Enhancements

- GraphQL API Gateway
- Service mesh (Istio)
- Distributed tracing
- Auto-scaling policies
- Multi-region deployment
