# Zeal Kubernetes Deployment

This directory contains Kubernetes manifests for deploying Zeal to a Kubernetes cluster.

## Deployment Options

### Option 1: Interactive Script (Recommended for first-time setup)

Use the interactive script to generate a customized deployment:

```bash
./scripts/generate-k8s-deployment.sh
```

This script will:

- Prompt you for all required configuration values
- Generate a complete deployment manifest
- Save it to `k8s/deployment-generated.yaml`

### Option 2: Environment Variable Template

Use environment variables with the template file:

1. Copy the example environment file:

   ```bash
   cp k8s/.env.k8s.example k8s/.env.k8s
   ```

2. Edit `.env.k8s` with your values:

   ```bash
   # Required variables
   ZEAL_NEXTJS_IMAGE=myregistry/zeal-nextjs:v1.0.0
   ZEAL_CRDT_IMAGE=myregistry/zeal-crdt:v1.0.0
   ZEAL_DOMAIN=zeal.example.com
   ZEAL_NEXTAUTH_SECRET=your-secret-here
   ZEAL_DATABASE_URL=postgresql://user:pass@host:5432/db
   ```

3. Generate and deploy:
   ```bash
   ./scripts/deploy-k8s.sh
   ```

### Option 3: Manual Deployment

Edit `deployment.yaml` directly and apply:

```bash
kubectl apply -f k8s/deployment.yaml
```

## Configuration Variables

### Required Variables

| Variable               | Description                 | Example                                 |
| ---------------------- | --------------------------- | --------------------------------------- |
| `ZEAL_NEXTJS_IMAGE`    | Next.js container image     | `myregistry/zeal-nextjs:v1.0.0`         |
| `ZEAL_CRDT_IMAGE`      | CRDT server container image | `myregistry/zeal-crdt:v1.0.0`           |
| `ZEAL_DOMAIN`          | Domain name for ingress     | `zeal.example.com`                      |
| `ZEAL_NEXTAUTH_SECRET` | NextAuth secret key         | Generate with `openssl rand -base64 32` |
| `ZEAL_DATABASE_URL`    | PostgreSQL connection URL   | `postgresql://user:pass@host:5432/db`   |

### Optional Variables

| Variable               | Description                        | Default            |
| ---------------------- | ---------------------------------- | ------------------ |
| `ZEAL_NAMESPACE`       | Kubernetes namespace               | `zeal`             |
| `ZEAL_REDIS_IMAGE`     | Redis container image              | `redis:7-alpine`   |
| `ZEAL_NEXTJS_REPLICAS` | Number of Next.js pods             | `3`                |
| `ZEAL_CRDT_REPLICAS`   | Number of CRDT server pods         | `2`                |
| `ZEAL_USE_SUPABASE`    | Use Supabase instead of PostgreSQL | `false`            |
| `ZEAL_ENABLE_TLS`      | Enable HTTPS/TLS                   | `true`             |
| `ZEAL_CLUSTER_ISSUER`  | Cert-manager cluster issuer        | `letsencrypt-prod` |

### Supabase Variables (if `ZEAL_USE_SUPABASE=true`)

| Variable                         | Description               |
| -------------------------------- | ------------------------- |
| `ZEAL_SUPABASE_URL`              | Supabase project URL      |
| `ZEAL_SUPABASE_ANON_KEY`         | Supabase anonymous key    |
| `ZEAL_SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

### MinIO/S3 Storage Variables

| Variable                   | Description                          | Default               |
| -------------------------- | ------------------------------------ | --------------------- |
| `ZEAL_MINIO_ENABLED`       | Deploy MinIO in cluster              | `true`                |
| `ZEAL_MINIO_IMAGE`         | MinIO container image                | `minio/minio:latest`  |
| `ZEAL_MINIO_REPLICAS`      | Number of MinIO pods                 | `1`                   |
| `ZEAL_MINIO_ACCESS_KEY`    | MinIO access key                     | `minioadmin`          |
| `ZEAL_MINIO_SECRET_KEY`    | MinIO secret key                     | `minioadmin123`       |
| `ZEAL_MINIO_BUCKET`        | Default bucket name                  | `zeal-uploads`        |
| `ZEAL_MINIO_STORAGE_SIZE`  | PVC size for MinIO                   | `10Gi`                |
| `ZEAL_MINIO_USE_SSL`       | Enable SSL for MinIO                 | `true` (production)   |
| `ZEAL_MINIO_PUBLIC_URL`    | Public URL for MinIO/S3              | `https://s3.example.com` |

## Prerequisites

1. **Kubernetes Cluster**: Version 1.24+
2. **kubectl**: Configured to access your cluster
3. **Ingress Controller**: NGINX Ingress Controller installed
4. **Cert-Manager** (optional): For automatic TLS certificates
5. **Container Registry**: Push your images before deployment

## Building Container Images

Build and push your container images:

```bash
# Build Next.js image
docker build -t myregistry/zeal-nextjs:v1.0.0 .
docker push myregistry/zeal-nextjs:v1.0.0

# Build CRDT server image
docker build -t myregistry/zeal-crdt:v1.0.0 ./crdt-server
docker push myregistry/zeal-crdt:v1.0.0
```

## Deployment Steps

1. **Generate deployment manifest** using one of the options above

2. **Create namespace** (if not included in manifest):

   ```bash
   kubectl create namespace zeal
   ```

3. **Deploy MinIO** (if using built-in MinIO):

   ```bash
   kubectl apply -f k8s/minio.yaml
   ```

4. **Apply the main deployment**:

   ```bash
   kubectl apply -f k8s/deployment-generated.yaml
   ```

5. **Check deployment status**:

   ```bash
   kubectl get all -n zeal
   ```

6. **View logs**:

   ```bash
   # Next.js logs
   kubectl logs -f deployment/nextjs-deployment -n zeal

   # CRDT server logs
   kubectl logs -f deployment/crdt-deployment -n zeal
   
   # MinIO logs (if deployed)
   kubectl logs -f deployment/minio -n zeal
   ```

## Post-Deployment

### Configure DNS

Point your domain to your ingress controller's external IP:

```bash
kubectl get ingress -n zeal
```

### Monitor Health

Check application health:

```bash
# Next.js health
curl https://zeal.example.com/api/health

# CRDT server health
curl https://zeal.example.com/socket.io/health
```

### Scaling

Scale deployments manually:

```bash
# Scale Next.js
kubectl scale deployment nextjs-deployment --replicas=5 -n zeal

# Scale CRDT server
kubectl scale deployment crdt-deployment --replicas=3 -n zeal
```

Or let HPA handle it automatically (included in deployment).

## Troubleshooting

### Pods not starting

Check pod events:

```bash
kubectl describe pod <pod-name> -n zeal
```

### Connection issues

Check service endpoints:

```bash
kubectl get endpoints -n zeal
```

### Image pull errors

Ensure images are pushed and accessible:

```bash
kubectl get events -n zeal --sort-by='.lastTimestamp'
```

### Database connection issues

Verify secrets:

```bash
kubectl get secret zeal-secrets -n zeal -o yaml
```

## Security Considerations

1. **Secrets**: Use Kubernetes secrets or external secret management
2. **Network Policies**: Consider implementing network policies
3. **RBAC**: Set up proper role-based access control
4. **Image Security**: Scan images for vulnerabilities
5. **TLS**: Always use HTTPS in production

## Maintenance

### Update images

1. Build and push new images
2. Update deployment:
   ```bash
   kubectl set image deployment/nextjs-deployment nextjs=myregistry/zeal-nextjs:v1.0.1 -n zeal
   kubectl set image deployment/crdt-deployment crdt=myregistry/zeal-crdt:v1.0.1 -n zeal
   ```

### Backup

Regular backup considerations:

- PostgreSQL database (if not using Supabase)
- Redis data (CRDT state)
- MinIO data (uploaded files)
- Kubernetes secrets and configmaps

For MinIO backup:
```bash
# Backup MinIO data using mc (MinIO Client)
mc mirror minio/zeal-uploads /backup/minio/
```

## Support

For issues and questions:

- Check logs: `kubectl logs -f <pod-name> -n zeal`
- Review events: `kubectl get events -n zeal`
- Open an issue on GitHub
