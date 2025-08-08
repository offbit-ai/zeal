import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Initialize S3 client with MinIO configuration
const s3Client = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT
    ? `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT}`
    : 'http://localhost:9000',
  region: 'us-east-1', // MinIO doesn't care about region but SDK requires it
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
    secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  },
  forcePathStyle: true, // Required for MinIO
})

export const UPLOAD_BUCKET = process.env.MINIO_BUCKET || 'zeal-uploads'

// Helper to generate unique file names
export function generateFileKey(prefix: string, originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split('.').pop()
  return `${prefix}/${timestamp}-${random}.${extension}`
}

// Upload file to S3/MinIO
export async function uploadFile(
  file: Buffer | Uint8Array,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    Body: file,
    ContentType: contentType,
    Metadata: metadata,
  })

  await s3Client.send(command)

  // Return the public URL
  const publicUrl = process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:9000'
  return `${publicUrl}/${UPLOAD_BUCKET}/${key}`
}

// Generate presigned URL for direct upload from client
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
    ContentType: contentType,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

// Generate presigned URL for download
export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600 // 1 hour default
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
  })

  return await getSignedUrl(s3Client, command, { expiresIn })
}

// Delete file from S3/MinIO
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: UPLOAD_BUCKET,
    Key: key,
  })

  await s3Client.send(command)
}

// Extract key from public URL
export function extractKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/')
    if (pathParts.length >= 3 && pathParts[1] === UPLOAD_BUCKET) {
      return pathParts.slice(2).join('/')
    }
    return null
  } catch {
    return null
  }
}
