# Deployment Guide

This guide covers various deployment options for Zeal, from development to production environments.

## Prerequisites

- Docker and Docker Compose (for containerized deployment)
- PostgreSQL 14+ (for manual deployment)
- Redis 6+ (for manual deployment)
- Node.js 20+ (for manual deployment)
- Rust 1.75+ (for building CRDT server)

## Deployment Options

### 1. Docker Compose (Recommended)

The easiest way to deploy Zeal is using Docker Compose, which sets up all required services.

#### Quick Start

```bash
# Clone the repository
git clone https://github.com/offbit-ai/zeal.git
cd zeal

# Create environment file
cp .env.example .env

# Edit .env file with your configuration
nano .env

# Start all services
docker-compose up -d

# Check service health
docker-compose ps

# View logs
docker-compose logs -f
```

#### Production Configuration

For production, use the included nginx profile:

```bash
# Start with production profile
docker-compose --profile production up -d
```

This adds:
- Nginx reverse proxy with SSL
- Rate limiting
- Caching
- Security headers

#### SSL Configuration

1. Place your SSL certificates in `nginx/ssl/`:
   - `cert.pem` - SSL certificate
   - `key.pem` - Private key

2. Update nginx configuration if using custom domains

### 2. Kubernetes Deployment

For scalable production deployments, use Kubernetes:

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: zeal
```

Apply the full configuration:

```bash
kubectl apply -f k8s/
```

See `k8s/` directory for complete manifests including:
- Deployments for each service
- Services and Ingress
- ConfigMaps and Secrets
- PersistentVolumeClaims
- HorizontalPodAutoscalers

### 3. Manual Deployment

For custom deployments or development:

#### Database Setup

```bash
# Create database
createdb zeal_db

# Run migrations
psql zeal_db < init.sql

# Create user (optional)
psql -c "CREATE USER zeal WITH PASSWORD 'secure_password';"
psql -c "GRANT ALL PRIVILEGES ON DATABASE zeal_db TO zeal;"
```

#### Redis Setup

```bash
# Install Redis
sudo apt-get install redis-server

# Configure Redis (edit /etc/redis/redis.conf)
requirepass your_redis_password
maxmemory 256mb
maxmemory-policy allkeys-lru

# Start Redis
sudo systemctl start redis-server
```

#### CRDT Server

```bash
# Build CRDT server
cd crdt-server
cargo build --release

# Run CRDT server
./target/release/server --port 8080
```

#### Next.js Application

```bash
# Install dependencies
npm install

# Build application
npm run build

# Start production server
npm start
```

### 4. Cloud Platform Deployment

#### Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

Note: You'll need to deploy the CRDT server separately (see below).

#### AWS

Use AWS services:
- **ECS/Fargate**: For containerized deployment
- **RDS**: PostgreSQL database
- **ElastiCache**: Redis
- **ALB**: Load balancing
- **CloudFront**: CDN

#### Google Cloud Platform

Use GCP services:
- **Cloud Run**: For containers
- **Cloud SQL**: PostgreSQL
- **Memorystore**: Redis
- **Load Balancer**: For traffic distribution

#### Azure

Use Azure services:
- **Container Instances**: For containers
- **Database for PostgreSQL**: Managed PostgreSQL
- **Cache for Redis**: Managed Redis
- **Application Gateway**: Load balancing

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Redis
REDIS_URL=redis://default:password@host:6379

# CRDT Server
NEXT_PUBLIC_CRDT_SERVER_URL=wss://crdt.example.com

# Authentication
NEXTAUTH_URL=https://app.example.com
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32

# Optional API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

### Production Checklist

- [ ] Set strong passwords for all services
- [ ] Configure SSL/TLS certificates
- [ ] Set up backup strategy
- [ ] Configure monitoring and alerts
- [ ] Set appropriate resource limits
- [ ] Enable security headers
- [ ] Configure CORS properly
- [ ] Set up log aggregation
- [ ] Plan for horizontal scaling
- [ ] Configure rate limiting

## Scaling Considerations

### Horizontal Scaling

#### Next.js Application
- Stateless design allows multiple instances
- Use Redis for session sharing
- Configure sticky sessions for WebSocket

#### CRDT Server
- Can handle multiple rooms per instance
- Scale based on active room count
- Use load balancer with WebSocket support

#### Database
- Use read replicas for read-heavy operations
- Consider partitioning for large datasets
- Regular VACUUM and index optimization

### Vertical Scaling

Recommended minimum resources:
- **Next.js**: 2 CPU, 4GB RAM
- **CRDT Server**: 2 CPU, 2GB RAM
- **PostgreSQL**: 4 CPU, 8GB RAM
- **Redis**: 1 CPU, 2GB RAM

## Monitoring & Maintenance

### Health Checks

All services expose health endpoints:
- Next.js: `GET /api/health`
- CRDT Server: `GET /health`
- PostgreSQL: `pg_isready`
- Redis: `redis-cli ping`

### Monitoring Stack

```yaml
# docker-compose.monitoring.yml
services:
  prometheus:
    image: prom/prometheus
    # ... configuration

  grafana:
    image: grafana/grafana
    # ... configuration

  loki:
    image: grafana/loki
    # ... configuration
```

### Backup Strategy

#### Database Backups

```bash
# Automated backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backup_$DATE.sql
aws s3 cp backup_$DATE.sql s3://backups/zeal/
```

#### Application Data

- Workflow definitions: Stored in PostgreSQL
- User uploads: Stored in filesystem/S3
- Redis data: Not critical (cache only)

### Updates & Maintenance

1. **Zero-downtime deployment**:
   ```bash
   # Update one service at a time
   docker-compose up -d --no-deps app
   ```

2. **Database migrations**:
   ```bash
   # Run migrations before updating app
   psql $DATABASE_URL < migrations/latest.sql
   ```

3. **Dependency updates**:
   ```bash
   # Update Node dependencies
   npm update
   npm audit fix
   
   # Update Rust dependencies
   cd crdt-server && cargo update
   ```

## Security Best Practices

1. **Network Security**
   - Use private networks for internal communication
   - Expose only necessary ports
   - Configure firewall rules

2. **Data Security**
   - Encrypt data at rest
   - Use SSL/TLS for all connections
   - Regular security audits

3. **Access Control**
   - Use strong authentication
   - Implement least privilege principle
   - Regular permission reviews

4. **Monitoring**
   - Set up intrusion detection
   - Monitor for unusual activity
   - Regular log analysis

## Troubleshooting

### Common Issues

**Container won't start**
```bash
# Check logs
docker-compose logs service-name

# Verify environment variables
docker-compose config

# Check resource availability
docker system df
```

**Database connection issues**
```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check firewall rules
telnet hostname 5432
```

**CRDT sync problems**
```bash
# Check WebSocket connectivity
wscat -c ws://localhost:8080

# Verify CORS settings
curl -I http://localhost:8080
```

**Performance issues**
```bash
# Check resource usage
docker stats

# Database query analysis
psql -c "SELECT * FROM pg_stat_statements"

# Redis memory usage
redis-cli info memory
```

## Support

For deployment assistance:
- Community: GitHub Discussions
- Enterprise: support@example.com
- Documentation: https://docs.example.com