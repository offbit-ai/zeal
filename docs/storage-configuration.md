# Multi-Cloud Storage Configuration

Zeal supports multiple cloud storage providers out of the box through a unified interface. The storage client automatically detects which provider to use based on environment variables.

## Supported Storage Providers

### 1. AWS S3

**Environment Variables:**
```bash
AWS_S3_BUCKET=my-zeal-bucket
AWS_REGION=us-east-1  # or AWS_DEFAULT_REGION
AWS_ACCESS_KEY_ID=AKIA...  # Optional, uses IAM role if not set
AWS_SECRET_ACCESS_KEY=secret...  # Optional, uses IAM role if not set
```

### 2. Azure Blob Storage

**Environment Variables:**
```bash
AZURE_STORAGE_ACCOUNT=myzealstorage
AZURE_STORAGE_CONTAINER=zeal-uploads  # Optional, defaults to 'zeal-uploads'
AZURE_STORAGE_KEY=base64key...  # Optional, uses DefaultAzureCredential if not set
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;...  # Optional, overrides other settings
```

**Note:** Azure Blob Storage is accessed through S3-compatible API. For production use with advanced features like SAS tokens, consider using the native Azure SDK.

### 3. Google Cloud Storage (GCS)

**Environment Variables:**
```bash
GCS_BUCKET=my-zeal-bucket
GCS_ACCESS_KEY_ID=GOOG...  # HMAC key for S3-compatible access
GCS_SECRET_ACCESS_KEY=secret...  # HMAC secret
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json  # Optional for native auth
GCP_PROJECT_ID=my-project  # Optional
```

**Setup for GCS:**
1. Enable interoperability mode in GCS
2. Generate HMAC keys for S3-compatible access
3. Set the environment variables above

### 4. MinIO / S3-Compatible Storage

**Environment Variables:**
```bash
MINIO_ENDPOINT=localhost:9000  # Without protocol
MINIO_BUCKET=zeal-uploads
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_USE_SSL=false  # Set to 'true' for HTTPS
NEXT_PUBLIC_MINIO_URL=http://localhost:9000  # Public URL for file access
```

## Provider Detection Priority

The storage client detects providers in the following order:
1. AWS S3 (if `AWS_S3_BUCKET` is set)
2. Azure Blob Storage (if `AZURE_STORAGE_ACCOUNT` is set)
3. Google Cloud Storage (if `GCS_BUCKET` is set)
4. MinIO/S3-Compatible (default fallback)

## Deployment-Specific Configurations

### Railway Deployment
```bash
# For AWS S3
railway vars set AWS_S3_BUCKET=my-bucket AWS_REGION=us-east-1

# For Azure
railway vars set AZURE_STORAGE_ACCOUNT=myaccount AZURE_STORAGE_KEY=key

# For GCS
railway vars set GCS_BUCKET=my-bucket GCS_ACCESS_KEY_ID=key GCS_SECRET_ACCESS_KEY=secret

# For MinIO
railway vars set MINIO_ENDPOINT=minio.railway.internal:9000 MINIO_BUCKET=zeal-uploads
```

### Kubernetes/K3s Deployment
Create a ConfigMap with the appropriate environment variables:
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: storage-config
data:
  # AWS S3
  AWS_S3_BUCKET: "my-bucket"
  AWS_REGION: "us-east-1"
  
  # OR Azure
  AZURE_STORAGE_ACCOUNT: "myaccount"
  
  # OR GCS
  GCS_BUCKET: "my-bucket"
  
  # OR MinIO
  MINIO_ENDPOINT: "minio-service:9000"
  MINIO_BUCKET: "zeal-uploads"
```

### Docker Compose
Add to your `.env` file:
```bash
# Choose one set of variables:

# AWS S3
AWS_S3_BUCKET=my-bucket
AWS_REGION=us-east-1

# Azure
AZURE_STORAGE_ACCOUNT=myaccount
AZURE_STORAGE_KEY=key

# GCS
GCS_BUCKET=my-bucket

# MinIO (default for local development)
MINIO_ENDPOINT=localhost:9000
MINIO_BUCKET=zeal-uploads
```

## Features by Provider

| Feature | AWS S3 | Azure | GCS | MinIO |
|---------|--------|-------|-----|-------|
| File Upload | ✅ | ✅ | ✅ | ✅ |
| File Download | ✅ | ✅ | ✅ | ✅ |
| File Delete | ✅ | ✅ | ✅ | ✅ |
| Presigned URLs | ✅ | ⚠️* | ⚠️* | ✅ |
| Public URLs | ✅ | ✅ | ✅ | ✅ |
| IAM/Managed Identity | ✅ | ✅** | ✅** | ❌ |

\* Presigned URLs for Azure and GCS work through S3-compatible API but may have limitations. Consider using native SDKs for production.
\** Requires additional configuration or native SDK integration.

## Debugging

The storage client logs its configuration in development mode:
```
Storage Provider: aws-s3
Bucket/Container: my-zeal-bucket
```

To check if storage is configured:
```typescript
import { isStorageConfigured, getStorageProvider } from '@/lib/s3-client'

if (!isStorageConfigured()) {
  console.error('Storage is not properly configured')
}

console.log('Using storage provider:', getStorageProvider())
```

## Migration Between Providers

To migrate from one storage provider to another:

1. Set up the new provider's environment variables
2. Use cloud-native tools to copy data:
   - AWS: `aws s3 sync`
   - Azure: `azcopy`
   - GCS: `gsutil rsync`
   - MinIO: `mc mirror`
3. Update your environment variables
4. Restart the application

## Security Best Practices

1. **Use IAM roles/Managed Identities** when possible instead of access keys
2. **Rotate access keys** regularly if using them
3. **Use private buckets** and generate presigned URLs for temporary access
4. **Enable encryption** at rest and in transit
5. **Set up proper CORS policies** for browser uploads
6. **Use bucket policies** to restrict access by IP or VPC
7. **Enable versioning** for important data
8. **Set up lifecycle policies** to manage old data

## Troubleshooting

### Files not uploading
- Check environment variables are set correctly
- Verify bucket/container exists
- Check IAM permissions or access keys
- Review CORS settings for browser uploads

### Presigned URLs not working
- For Azure/GCS, consider using native SDKs
- Check expiration times
- Verify clock synchronization
- Review bucket policies

### Wrong storage provider detected
- Check environment variable priority
- Ensure only one provider's variables are set
- Use `getStorageProvider()` to debug

## Future Enhancements

- Native Azure Blob Storage SDK integration for SAS tokens
- Native Google Cloud Storage SDK for better signed URL support
- Support for additional providers (DigitalOcean Spaces, Backblaze B2, etc.)
- Streaming upload/download for large files
- Multipart upload support
- Client-side encryption options