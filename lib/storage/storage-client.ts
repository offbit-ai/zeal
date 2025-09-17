/**
 * Production-Ready Multi-Cloud Storage Client
 * 
 * Supports AWS S3, Azure Blob Storage, Google Cloud Storage, and MinIO
 * Uses native SDKs for each provider for optimal performance and features
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  S3ClientConfig,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { AzureStorageClient } from './azure-client'
import { GcsStorageClient } from './gcs-client'

// Storage provider detection
export enum StorageProvider {
  AWS_S3 = 'aws-s3',
  AZURE = 'azure',
  GCS = 'gcs',
  MINIO = 'minio',
}

// Unified storage interface
interface IStorageClient {
  uploadFile(
    file: Buffer | Uint8Array,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string>
  
  getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn?: number
  ): Promise<string>
  
  getPresignedDownloadUrl(
    key: string,
    expiresIn?: number
  ): Promise<string>
  
  deleteFile(key: string): Promise<void>
  
  getPublicUrl(key: string): string
}

// S3-compatible storage client (AWS S3 and MinIO)
class S3StorageClient implements IStorageClient {
  private client: S3Client
  private bucketName: string
  private isAws: boolean

  constructor(isAws: boolean = false) {
    this.isAws = isAws
    
    if (isAws) {
      // AWS S3 configuration
      this.bucketName = process.env.AWS_S3_BUCKET!
      const config: S3ClientConfig = {
        region: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1',
      }
      
      // Only add credentials if explicitly provided
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        config.credentials = {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      }
      // Otherwise, SDK will use default credential chain (IAM role, etc.)
      
      this.client = new S3Client(config)
    } else {
      // MinIO configuration
      this.bucketName = process.env.MINIO_BUCKET || 'zeal-uploads'
      this.client = new S3Client({
        endpoint: process.env.MINIO_ENDPOINT
          ? `http${process.env.MINIO_USE_SSL === 'true' ? 's' : ''}://${process.env.MINIO_ENDPOINT}`
          : 'http://localhost:9000',
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.MINIO_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || 'minioadmin',
          secretAccessKey: process.env.MINIO_SECRET_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'minioadmin123',
        },
        forcePathStyle: true,
      })
    }
  }

  async uploadFile(
    file: Buffer | Uint8Array,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file,
      ContentType: contentType,
      Metadata: metadata,
    })

    await this.client.send(command)
    return this.getPublicUrl(key)
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    })

    return await getSignedUrl(this.client, command, { expiresIn })
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    return await getSignedUrl(this.client, command, { expiresIn })
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    })

    await this.client.send(command)
  }

  getPublicUrl(key: string): string {
    if (this.isAws) {
      const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1'
      return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`
    } else {
      const publicUrl = process.env.NEXT_PUBLIC_MINIO_URL || 'http://localhost:9000'
      return `${publicUrl}/${this.bucketName}/${key}`
    }
  }
}

// Detect which storage provider to use
export function detectStorageProvider(): StorageProvider {
  if (process.env.AWS_S3_BUCKET) {
    return StorageProvider.AWS_S3
  }
  if (process.env.AZURE_STORAGE_ACCOUNT) {
    return StorageProvider.AZURE
  }
  if (process.env.GCS_BUCKET) {
    return StorageProvider.GCS
  }
  return StorageProvider.MINIO
}

// Create the appropriate storage client
function createStorageClient(): IStorageClient {
  const provider = detectStorageProvider()
  
  switch (provider) {
    case StorageProvider.AWS_S3:
      return new S3StorageClient(true)
    
    case StorageProvider.AZURE:
      return new AzureStorageClient() as any // TypeScript workaround for interface
    
    case StorageProvider.GCS:
      return new GcsStorageClient() as any // TypeScript workaround for interface
    
    case StorageProvider.MINIO:
    default:
      return new S3StorageClient(false)
  }
}

// Singleton storage client instance
let storageClient: IStorageClient | null = null

function getStorageClient(): IStorageClient {
  if (!storageClient) {
    storageClient = createStorageClient()
  }
  return storageClient
}

// Export the main functions that match the original s3-client.ts interface

export function getBucketName(): string {
  const provider = detectStorageProvider()
  switch (provider) {
    case StorageProvider.AWS_S3:
      return process.env.AWS_S3_BUCKET!
    case StorageProvider.AZURE:
      return process.env.AZURE_STORAGE_CONTAINER || 'zeal-uploads'
    case StorageProvider.GCS:
      return process.env.GCS_BUCKET!
    case StorageProvider.MINIO:
    default:
      return process.env.MINIO_BUCKET || 'zeal-uploads'
  }
}

export const UPLOAD_BUCKET = getBucketName()

export function generateFileKey(prefix: string, originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)
  const extension = originalName.split('.').pop()
  return `${prefix}/${timestamp}-${random}.${extension}`
}

export async function uploadFile(
  file: Buffer | Uint8Array,
  key: string,
  contentType: string,
  metadata?: Record<string, string>
): Promise<string> {
  const client = getStorageClient()
  return client.uploadFile(file, key, contentType, metadata)
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getStorageClient()
  return client.getPresignedUploadUrl(key, contentType, expiresIn)
}

export async function getPresignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  const client = getStorageClient()
  return client.getPresignedDownloadUrl(key, expiresIn)
}

export async function deleteFile(key: string): Promise<void> {
  const client = getStorageClient()
  return client.deleteFile(key)
}

export function getPublicUrl(key: string): string {
  const client = getStorageClient()
  return client.getPublicUrl(key)
}

export function extractKeyFromUrl(url: string): string | null {
  try {
    const urlObj = new URL(url)
    const provider = detectStorageProvider()
    
    switch (provider) {
      case StorageProvider.AWS_S3:
        // Format: https://bucket.s3.region.amazonaws.com/key
        return urlObj.pathname.substring(1) // Remove leading /
      
      case StorageProvider.AZURE:
        // Format: https://account.blob.core.windows.net/container/key
        const pathParts = urlObj.pathname.split('/')
        if (pathParts.length >= 3 && pathParts[1] === UPLOAD_BUCKET) {
          return pathParts.slice(2).join('/')
        }
        return null
      
      case StorageProvider.GCS:
        // Format: https://storage.googleapis.com/bucket/key
        const gcsPathParts = urlObj.pathname.split('/')
        if (gcsPathParts.length >= 3 && gcsPathParts[1] === UPLOAD_BUCKET) {
          return gcsPathParts.slice(2).join('/')
        }
        return null
      
      case StorageProvider.MINIO:
      default:
        // Format: http://localhost:9000/bucket/key
        const minioParts = urlObj.pathname.split('/')
        if (minioParts.length >= 3 && minioParts[1] === UPLOAD_BUCKET) {
          return minioParts.slice(2).join('/')
        }
        return null
    }
  } catch {
    return null
  }
}

export function getStorageProvider(): string {
  return detectStorageProvider()
}

export function isStorageConfigured(): boolean {
  const provider = detectStorageProvider()
  switch (provider) {
    case StorageProvider.AWS_S3:
      return !!process.env.AWS_S3_BUCKET
    case StorageProvider.AZURE:
      return !!process.env.AZURE_STORAGE_ACCOUNT
    case StorageProvider.GCS:
      return !!process.env.GCS_BUCKET
    case StorageProvider.MINIO:
      return !!process.env.MINIO_ENDPOINT || !!process.env.MINIO_BUCKET
  }
}

// Log the storage configuration on startup (for debugging)
if (process.env.NODE_ENV !== 'production') {
  console.log(`Storage Provider: ${detectStorageProvider()}`)
  console.log(`Bucket/Container: ${UPLOAD_BUCKET}`)
}