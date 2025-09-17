/**
 * Production-Ready Multi-Cloud Storage Client
 * 
 * This file re-exports the storage client functionality for backward compatibility.
 * The actual implementation uses native SDKs for each cloud provider.
 * 
 * Supported providers:
 * - AWS S3 (native AWS SDK)
 * - Azure Blob Storage (native Azure SDK)
 * - Google Cloud Storage (native GCS SDK)
 * - MinIO/S3-compatible (AWS SDK with S3 compatibility)
 * 
 * Environment variables:
 * 
 * AWS S3:
 * - AWS_S3_BUCKET: S3 bucket name
 * - AWS_REGION or AWS_DEFAULT_REGION: AWS region
 * - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: Optional, uses IAM role if not set
 * 
 * Azure Blob Storage:
 * - AZURE_STORAGE_ACCOUNT: Storage account name
 * - AZURE_STORAGE_CONTAINER: Optional, defaults to 'zeal-uploads'
 * - AZURE_STORAGE_KEY: Storage account key (for SAS generation)
 * - AZURE_STORAGE_CONNECTION_STRING: Alternative to account+key
 * 
 * Google Cloud Storage:
 * - GCS_BUCKET: GCS bucket name
 * - GOOGLE_APPLICATION_CREDENTIALS: Path to service account JSON
 * - GCS_CLIENT_EMAIL, GCS_PRIVATE_KEY: Alternative inline credentials
 * - GCP_PROJECT_ID: Optional project ID
 * 
 * MinIO/S3-compatible:
 * - MINIO_ENDPOINT: Endpoint URL
 * - MINIO_BUCKET: Bucket name
 * - MINIO_ACCESS_KEY, MINIO_SECRET_KEY: Access credentials
 * - MINIO_USE_SSL: "true" or "false"
 * - NEXT_PUBLIC_MINIO_URL: Public URL for file access
 */

// Re-export everything from the new storage client
export {
  StorageProvider,
  getBucketName,
  UPLOAD_BUCKET,
  generateFileKey,
  uploadFile,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  deleteFile,
  getPublicUrl,
  extractKeyFromUrl,
  getStorageProvider,
  isStorageConfigured,
} from './storage/storage-client'