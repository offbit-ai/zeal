import React, { useState, useRef, useEffect } from 'react'
import { Upload, File, X, Image, Music, Video } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow-store'

interface FileUploadFieldProps {
  value: string | null
  onChange: (value: string | null, metadata?: any) => void
  acceptedFormats?: string
  maxFileSize?: number
  fileType?: 'image' | 'audio' | 'video' | 'any'
  label?: string
  description?: string
  nodeId?: string
}

export function FileUploadField({
  value,
  onChange,
  acceptedFormats = '*/*',
  maxFileSize = 10,
  fileType = 'any',
  label,
  description,
  nodeId,
}: FileUploadFieldProps) {
  const { workflowId, currentGraphId } = useWorkflowStore()
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Initialize fileName from value if it exists
  useEffect(() => {
    if (value && !fileName) {
      // Try to extract filename from URL
      try {
        const url = new URL(value)
        const pathname = url.pathname
        const parts = pathname.split('/')
        // MinIO URLs have format: /bucket/category/timestamp-random.ext
        const name = parts[parts.length - 1] || 'Uploaded file'
        setFileName(decodeURIComponent(name))
      } catch {
        setFileName('Uploaded file')
      }
    }
  }, [value, fileName])

  // Get appropriate icon based on file type
  const getFileIcon = () => {
    switch (fileType) {
      case 'image':
        return <Image className="w-4 h-4" />
      case 'audio':
        return <Music className="w-4 h-4" />
      case 'video':
        return <Video className="w-4 h-4" />
      default:
        return <File className="w-4 h-4" />
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > maxFileSize * 1024 * 1024) {
      setError(`File size exceeds ${maxFileSize}MB limit`)
      return
    }

    // Validate file type
    if (acceptedFormats !== '*/*') {
      const acceptedTypes = acceptedFormats.split(',').map(t => t.trim())
      if (!acceptedTypes.includes(file.type)) {
        setError(`Invalid file type. Accepted: ${acceptedFormats}`)
        return
      }
    }

    setError(null)
    setIsLoading(true)

    try {
      // Upload to S3/MinIO
      const formData = new FormData()
      formData.append('file', file)

      // Add IDs for namespacing
      if (workflowId) formData.append('workflowId', workflowId)
      if (currentGraphId) formData.append('graphId', currentGraphId)
      if (nodeId) formData.append('nodeId', nodeId)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const data = await response.json()
      setFileName(file.name)
      onChange(data.url, {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        key: data.key,
        url: data.url,
      })
      setIsLoading(false)
    } catch (err) {
      setError('Failed to upload file')
      console.error('Upload error:', err)
      setIsLoading(false)
    }
  }

  const handleClear = () => {
    // No need to revoke base64 data URLs
    setFileName(null)
    setError(null)
    onChange(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats}
        onChange={handleFileSelect}
        className="hidden"
      />

      {!value ? (
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="w-full p-3 border border-gray-200 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
              <span className="text-gray-600">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 text-gray-400" />
              <span className="text-gray-600">
                {label || `Upload ${fileType === 'any' ? 'file' : fileType}`}
              </span>
            </>
          )}
        </button>
      ) : (
        <div className="w-full p-3 border border-gray-200 rounded bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm min-w-0">
            <div className="text-gray-400">{getFileIcon()}</div>
            <span className="text-gray-700 truncate">{fileName || 'File uploaded'}</span>
          </div>
          <button
            onClick={handleClear}
            className="p-1 hover:bg-gray-200 rounded transition-colors"
            title="Remove file"
          >
            <X className="w-3 h-3 text-gray-500" />
          </button>
        </div>
      )}

      {description && !error && <p className="text-xs text-gray-500 mt-1">{description}</p>}

      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}
