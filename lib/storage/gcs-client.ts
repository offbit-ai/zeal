/**
 * Google Cloud Storage Client
 * Production-ready implementation using native GCS SDK
 */

import { Storage } from '@google-cloud/storage'

export class GcsStorageClient {
  private storage: Storage
  private bucketName: string

  constructor() {
    this.bucketName = process.env.GCS_BUCKET!
    
    // Initialize GCS client
    const options: any = {}
    
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // Use service account key file
      options.keyFilename = process.env.GOOGLE_APPLICATION_CREDENTIALS
    } else if (process.env.GCS_CLIENT_EMAIL && process.env.GCS_PRIVATE_KEY) {
      // Use inline credentials
      options.credentials = {
        client_email: process.env.GCS_CLIENT_EMAIL,
        private_key: process.env.GCS_PRIVATE_KEY.replace(/\\n/g, '\n'), // Handle escaped newlines
      }
    }
    
    if (process.env.GCP_PROJECT_ID) {
      options.projectId = process.env.GCP_PROJECT_ID
    }
    
    this.storage = new Storage(options)
  }

  async uploadFile(
    file: Buffer | Uint8Array,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName)
    const fileObj = bucket.file(key)
    
    await fileObj.save(file, {
      metadata: {
        contentType,
        metadata,
      },
    })
    
    return this.getPublicUrl(key)
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName)
    const file = bucket.file(key)
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresIn * 1000,
      contentType,
    })
    
    return url
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const bucket = this.storage.bucket(this.bucketName)
    const file = bucket.file(key)
    
    const [url] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresIn * 1000,
    })
    
    return url
  }

  async deleteFile(key: string): Promise<void> {
    const bucket = this.storage.bucket(this.bucketName)
    const file = bucket.file(key)
    await file.delete()
  }

  getPublicUrl(key: string): string {
    // Public URL format for GCS
    return `https://storage.googleapis.com/${this.bucketName}/${key}`
  }
}