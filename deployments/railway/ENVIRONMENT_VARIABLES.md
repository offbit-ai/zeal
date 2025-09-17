# Railway Environment Variables Guide

## How Railway Handles Environment Variables

### Automatic Injection
Railway **automatically injects** all environment variables into your Docker containers at runtime. This means:

- ✅ **No .env files needed** in your container
- ✅ **No sourcing scripts** required in Dockerfile
- ✅ **Direct access** via `process.env` in Node.js or `$VAR_NAME` in shell
- ✅ **Secure handling** - variables never exposed in build logs

### Sources of Environment Variables

#### 1. Railway-Provided (Automatic)
When you add services through Railway, these are automatically available:

| Variable | Source | Example |
|----------|--------|---------|
| `DATABASE_URL` | PostgreSQL plugin | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis plugin | `redis://:password@host:6379` |
| `PORT` | Railway runtime | `3000` |
| `RAILWAY_PUBLIC_DOMAIN` | Railway | `myapp.up.railway.app` |
| `RAILWAY_ENVIRONMENT` | Railway | `production` |

#### 2. Custom Variables (You Set)
Set via Railway Dashboard, CLI, or API:

```bash
# Via CLI
railway variables set NEXT_PUBLIC_APP_URL=https://myapp.railway.app
railway variables set ZEAL_AUTH_ENABLED=true

# Or bulk set from file
railway variables set $(cat .env.production)
```

### Service Communication

For multi-service deployments (like our CRDT + Next.js setup):

1. **Internal Communication**: Services can reference each other using Railway's private networking:
   ```
   NEXT_PUBLIC_CRDT_SERVER_URL=ws://crdt-server.railway.internal:8080
   ```

2. **Public URLs**: For external access:
   ```
   NEXT_PUBLIC_CRDT_SERVER_URL=wss://crdt.myapp.railway.app
   ```

### Required Environment Variables for Zeal

#### Core Application
```bash
# Automatic from Railway
DATABASE_URL=<provided-by-railway>
REDIS_URL=<provided-by-railway>
PORT=<provided-by-railway>

# You need to set
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://$RAILWAY_PUBLIC_DOMAIN
NEXTAUTH_URL=https://$RAILWAY_PUBLIC_DOMAIN
NEXTAUTH_SECRET=<generate-secure-secret>
```

#### CRDT Server
```bash
# Automatic from Railway
REDIS_URL=<provided-by-railway>
PORT=8080

# You need to set
NEXT_PUBLIC_CRDT_SERVER_URL=wss://crdt-$RAILWAY_PUBLIC_DOMAIN
VERBOSE=false
MAX_CLIENTS_PER_ROOM=100
CLIENT_TIMEOUT_MINUTES=30
```

#### Authentication
```bash
ZEAL_AUTH_ENABLED=true
ZEAL_AUTH_MODE=production
ZEAL_SECRET_KEY=<generate-secure-secret>

# For JWT auth
AUTH_JWT_ISSUER=https://your-idp.com
AUTH_JWT_AUDIENCE=your-app-id
AUTH_JWT_JWKS_URI=https://your-idp.com/.well-known/jwks.json
```

#### TimescaleDB (Second PostgreSQL)
```bash
# These need manual configuration after adding second PostgreSQL
TIMESCALE_HOST=<from-railway-dashboard>
TIMESCALE_PORT=5432
TIMESCALE_DATABASE=zeal_traces
TIMESCALE_USER=postgres
TIMESCALE_PASSWORD=<from-railway-dashboard>
```

#### Storage Options

##### MinIO (S3-compatible)
```bash
MINIO_ENDPOINT=s3.amazonaws.com
MINIO_BUCKET=your-bucket
MINIO_ACCESS_KEY=<your-key>
MINIO_SECRET_KEY=<your-secret>
MINIO_USE_SSL=true
```

##### AWS S3
```bash
AWS_S3_BUCKET=your-bucket
AWS_ACCESS_KEY_ID=<your-key>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=us-east-1
```

##### Azure Blob Storage
```bash
AZURE_STORAGE_ACCOUNT=youraccount
AZURE_STORAGE_ACCESS_KEY=<your-key>
AZURE_STORAGE_CONTAINER=zeal-uploads
```

##### Google Cloud Storage
```bash
GCS_BUCKET=your-bucket
GCS_PROJECT_ID=your-project
GCS_CLIENT_EMAIL=service@project.iam.gserviceaccount.com
GCS_PRIVATE_KEY=<your-private-key>
```

### Setting Variables in Railway

#### Method 1: Dashboard (Recommended for secrets)
1. Go to your Railway project
2. Click on your service
3. Go to "Variables" tab
4. Add variables one by one
5. They're automatically injected on next deployment

#### Method 2: CLI (Good for bulk setup)
```bash
# Single variable
railway variables set KEY=value

# Multiple variables
railway variables set \
  NODE_ENV=production \
  ZEAL_AUTH_ENABLED=true \
  NEXT_PUBLIC_APP_URL=https://myapp.railway.app

# From env file
railway variables set $(cat .env.production | xargs)
```

#### Method 3: railway.toml (Not for secrets!)
```toml
[variables]
NODE_ENV = "production"
NEXT_PUBLIC_ENABLE_COLLABORATION = "true"
# Don't put secrets here - use dashboard or CLI
```

### Debugging Environment Variables

#### Check what's set in Railway:
```bash
railway variables
```

#### Inside your container (for debugging):
```javascript
// In your Next.js app
console.log('Environment:', {
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL ? '✓ Set' : '✗ Missing',
  REDIS_URL: process.env.REDIS_URL ? '✓ Set' : '✗ Missing',
  PORT: process.env.PORT
});
```

#### In start script:
```bash
echo "=== Environment Check ==="
echo "DATABASE_URL: ${DATABASE_URL:+✓ Set}"
echo "REDIS_URL: ${REDIS_URL:+✓ Set}"
echo "PORT: $PORT"
```

### Important Notes

1. **Build vs Runtime**: Variables are available at both build time and runtime
2. **NEXT_PUBLIC_* prefix**: Required for client-side Next.js variables
3. **Automatic restarts**: Changing variables triggers automatic redeployment
4. **No interpolation in Railway**: Use literal values, not `$OTHER_VAR`
5. **Secrets are encrypted**: Railway encrypts sensitive variables at rest

### Common Issues

#### Variable not available in app?
- Check if it's set: `railway variables`
- For Next.js client-side: needs `NEXT_PUBLIC_` prefix
- May need rebuild: `railway up --build`

#### Database connection fails?
- Railway provides `DATABASE_URL` automatically when PostgreSQL is added
- Check format: `postgresql://user:pass@host:port/database`
- Ensure service dependency in docker-compose

#### CRDT can't connect to Redis?
- `REDIS_URL` should include auth: `redis://:password@host:6379`
- Check Redis service is running: Railway dashboard
- Verify format in CRDT logs

### Migration from Docker Compose

If migrating from `docker-compose.yml`:
1. Railway services replace compose services
2. Environment variables from compose become Railway variables
3. Volume mounts become Railway volumes or external storage
4. Internal networking handled automatically by Railway