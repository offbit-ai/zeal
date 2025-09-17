/**
 * Azure Blob Storage Client
 * Production-ready implementation using native Azure SDK
 */

import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob'

export class AzureStorageClient {
  private blobServiceClient: BlobServiceClient
  private containerName: string

  constructor() {
    this.containerName = process.env.AZURE_STORAGE_CONTAINER || 'zeal-uploads'
    
    // Initialize Azure Blob Service Client
    if (process.env.AZURE_STORAGE_CONNECTION_STRING) {
      // Use connection string if provided
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        process.env.AZURE_STORAGE_CONNECTION_STRING
      )
    } else if (process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY) {
      // Use account name and key
      const account = process.env.AZURE_STORAGE_ACCOUNT
      const accountKey = process.env.AZURE_STORAGE_KEY
      const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey)
      
      this.blobServiceClient = new BlobServiceClient(
        `https://${account}.blob.core.windows.net`,
        sharedKeyCredential
      )
    } else if (process.env.AZURE_STORAGE_ACCOUNT) {
      // Use DefaultAzureCredential (managed identity, etc.)
      // Note: Requires @azure/identity package for production
      const account = process.env.AZURE_STORAGE_ACCOUNT
      this.blobServiceClient = new BlobServiceClient(
        `https://${account}.blob.core.windows.net`
      )
    } else {
      throw new Error('Azure Storage configuration not found')
    }
  }

  async uploadFile(
    file: Buffer | Uint8Array,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(key)
    
    await blockBlobClient.upload(file, file.length, {
      blobHTTPHeaders: {
        blobContentType: contentType,
      },
      metadata,
    })
    
    return blockBlobClient.url
  }

  async getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(key)
    
    if (process.env.AZURE_STORAGE_KEY) {
      // Generate SAS token
      const account = process.env.AZURE_STORAGE_ACCOUNT!
      const accountKey = process.env.AZURE_STORAGE_KEY
      const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey)
      
      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName: key,
          permissions: BlobSASPermissions.parse('racw'), // read, add, create, write
          startsOn: new Date(),
          expiresOn: new Date(Date.now() + expiresIn * 1000),
          contentType: contentType,
        },
        sharedKeyCredential
      ).toString()
      
      return `${blockBlobClient.url}?${sasToken}`
    }
    
    // Without account key, can't generate SAS tokens
    throw new Error('Azure Storage Key required for generating SAS tokens')
  }

  async getPresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(key)
    
    if (process.env.AZURE_STORAGE_KEY) {
      const account = process.env.AZURE_STORAGE_ACCOUNT!
      const accountKey = process.env.AZURE_STORAGE_KEY
      const sharedKeyCredential = new StorageSharedKeyCredential(account, accountKey)
      
      const sasToken = generateBlobSASQueryParameters(
        {
          containerName: this.containerName,
          blobName: key,
          permissions: BlobSASPermissions.parse('r'), // read only
          startsOn: new Date(),
          expiresOn: new Date(Date.now() + expiresIn * 1000),
        },
        sharedKeyCredential
      ).toString()
      
      return `${blockBlobClient.url}?${sasToken}`
    }
    
    throw new Error('Azure Storage Key required for generating SAS tokens')
  }

  async deleteFile(key: string): Promise<void> {
    const containerClient = this.blobServiceClient.getContainerClient(this.containerName)
    const blockBlobClient = containerClient.getBlockBlobClient(key)
    await blockBlobClient.delete()
  }

  getPublicUrl(key: string): string {
    const account = process.env.AZURE_STORAGE_ACCOUNT!
    return `https://${account}.blob.core.windows.net/${this.containerName}/${key}`
  }
}