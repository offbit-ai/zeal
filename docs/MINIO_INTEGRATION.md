# MinIO S3-Compatible Storage Integration

This document describes the MinIO integration for handling file uploads in Zeal, replacing base64 storage with S3-compatible object storage.

## Overview

MinIO provides S3-compatible object storage that allows us to:
- Store files outside the CRDT store (avoiding size limitations)
- Support larger file uploads (images, audio, video)
- Maintain file persistence across reloads
- Enable efficient file streaming and CDN integration

## Local Development Setup

### Using start-dev.sh

The `start-dev.sh` script automatically sets up MinIO along with other services:

```bash
./start-dev.sh
```

This will:
- Start MinIO on port 9000 (API) and 9001 (Console)
- Create the default bucket `zeal-uploads`
- Configure environment variables in `.env.local`

### MinIO Console Access

Access the MinIO console at: http://localhost:9001
- Username: `minioadmin`
- Password: `minioadmin123`

### Manual Docker Setup

If you need to run MinIO manually:

```bash
docker run -d \
  --name zeal-minio \
  -p 9000:9000 \
  -p 9001:9001 \
  -e MINIO_ROOT_USER=minioadmin \
  -e MINIO_ROOT_PASSWORD=minioadmin123 \
  -v zeal-minio-data:/data \
  minio/minio:latest \
  server /data --console-address ":9001"
```

## Production Deployment

### Docker Compose

MinIO is included in the docker-compose.yml configuration:

```bash
./docker-compose-prod.sh up -d
```

### Kubernetes

Deploy MinIO to Kubernetes:

```bash
kubectl apply -f k8s/minio.yaml
```

This creates:
- MinIO deployment with persistent storage
- Services for API and console access
- A job to create the default bucket

## API Usage

### Upload Endpoint

POST `/api/upload`
- Accepts multipart form data with a `file` field
- Returns the public URL and metadata
- Validates file type and size

Example:
```javascript
const formData = new FormData()
formData.append('file', file)

const response = await fetch('/api/upload', {
  method: 'POST',
  body: formData,
})

const { url, key, size, type, name } = await response.json()
```

### Presigned URL Endpoint

POST `/api/upload/presigned`
- Generates a presigned URL for direct browser uploads
- Useful for large files or progress tracking

Example:
```javascript
const response = await fetch('/api/upload/presigned', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    fileName: 'example.jpg',
    fileType: 'image/jpeg',
  }),
})

const { presignedUrl, publicUrl, key } = await response.json()

// Upload directly to MinIO
await fetch(presignedUrl, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
})
```

## File Size Limits

Default limits by file type:
- Images: 10MB (configurable up to 100MB)
- Audio: 50MB (configurable up to 500MB)
- Video: 100MB (configurable up to 1GB)

These can be adjusted in:
- `/app/api/upload/route.ts` - API limits
- `/data/nodeTemplates/userInputs.ts` - Node property limits

## Environment Variables

Required environment variables:

```env
# MinIO Configuration
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=zeal-uploads
MINIO_USE_SSL=false
NEXT_PUBLIC_MINIO_URL=http://localhost:9000
```

## Migration from Base64

The system has been updated to use S3 URLs instead of base64:
- Files are uploaded to MinIO when selected
- Only the S3 URL is stored in CRDT (not the file data)
- Files persist across page reloads
- Supports much larger file sizes

## Security Considerations

For production:
1. Change default MinIO credentials
2. Enable HTTPS/TLS
3. Configure proper CORS policies
4. Implement access control and bucket policies
5. Set up lifecycle policies for old uploads
6. Consider using presigned URLs with shorter expiration times

## Troubleshooting

### MinIO not starting
- Check if port 9000/9001 are already in use
- Verify Docker is running
- Check logs: `docker logs zeal-minio`

### Upload failures
- Verify MinIO is running and accessible
- Check bucket exists: `zeal-uploads`
- Verify environment variables are set correctly
- Check file size and type restrictions

### CORS issues
- MinIO allows all origins by default in dev mode
- For production, configure proper CORS policies in MinIO

## Future Enhancements

1. **CDN Integration**: Add CloudFront or similar CDN for global distribution
2. **Image Processing**: Add thumbnail generation and optimization
3. **Virus Scanning**: Integrate with ClamAV or similar for file scanning
4. **Backup Strategy**: Implement S3 replication or backup policies
5. **Analytics**: Track upload metrics and storage usage