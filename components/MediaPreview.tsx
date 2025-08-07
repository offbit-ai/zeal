import React, { useState, useRef, useEffect } from 'react'
import { Upload, Link, Image as ImageIcon, AlertCircle, X } from 'lucide-react'

interface ImagePreviewProps {
  source: 'upload' | 'url' | 'base64'
  url?: string
  displayMode: 'contain' | 'cover' | 'fill' | 'none'
  previewHeight: number
  acceptedFormats: string
  maxFileSize: number
  pauseGifOnHover?: boolean
  onDataChange?: (data: { url?: string; metadata?: any }) => void
}

export function ImagePreview({
  source,
  url,
  displayMode,
  previewHeight,
  acceptedFormats,
  maxFileSize,
  pauseGifOnHover = false,
  onDataChange,
}: ImagePreviewProps) {
  const [imageData, setImageData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [isGif, setIsGif] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastUrlRef = useRef<string | undefined>()

  useEffect(() => {
    if (source === 'url' && url && url !== lastUrlRef.current) {
      setImageData(url)
      setError(null)
      setIsGif(url.toLowerCase().endsWith('.gif'))
      lastUrlRef.current = url
      onDataChange?.({ url, metadata: { source: 'url' } })
    }
  }, [source, url, onDataChange])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > maxFileSize * 1024 * 1024) {
      setError(`File size exceeds ${maxFileSize}MB limit`)
      return
    }

    // Validate file type
    const acceptedTypes = acceptedFormats.split(',').map(t => t.trim())
    if (!acceptedTypes.includes(file.type)) {
      setError(`Invalid file type. Accepted: ${acceptedFormats}`)
      return
    }

    try {
      // TODO: In production, implement S3 upload here
      // const formData = new FormData()
      // formData.append('file', file)
      // const response = await fetch('/api/upload/image', {
      //   method: 'POST',
      //   body: formData,
      // })
      // const { url: s3Url, thumbnailUrl } = await response.json()
      // setImageData(thumbnailUrl || s3Url) // Use optimized version if available

      // For now, use local blob URL as placeholder
      if (imageData && imageData.startsWith('blob:')) {
        URL.revokeObjectURL(imageData)
      }
      const objectUrl = URL.createObjectURL(file)
      setImageData(objectUrl)
      setError(null)

      const meta = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        source: 'upload',
        path: file.name, // In production, this would be the S3 key
      }
      setMetadata(meta)
      setIsGif(file.type === 'image/gif')
      
      // In production, this would pass the S3 URL
      onDataChange?.({ url: objectUrl, metadata: meta })
    } catch (err) {
      setError('Failed to upload image')
      console.error('Upload error:', err)
    }
  }

  const clearImage = () => {
    // Revoke object URL to free memory
    if (imageData && imageData.startsWith('blob:')) {
      URL.revokeObjectURL(imageData)
    }
    
    setImageData(null)
    setError(null)
    setMetadata(null)
    setIsGif(false)
    setIsPaused(false)
    lastUrlRef.current = undefined
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onDataChange?.({ url: undefined, metadata: undefined })
  }

  const handleGifPause = () => {
    if (!isGif || !pauseGifOnHover || !imageRef.current || !canvasRef.current) return

    if (!isPaused) {
      // Capture current frame to canvas
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        canvasRef.current.width = imageRef.current.naturalWidth
        canvasRef.current.height = imageRef.current.naturalHeight
        ctx.drawImage(imageRef.current, 0, 0)
        setIsPaused(true)
      }
    }
  }

  const handleGifResume = () => {
    if (!isGif || !pauseGifOnHover) return
    setIsPaused(false)
  }

  if (displayMode === 'none') {
    return null
  }

  return (
    <div className="w-full">
      {!imageData && source === 'upload' && (
        <div className="relative" onClick={e => e.stopPropagation()}>
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedFormats}
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-gray-400 transition-colors flex flex-col items-center justify-center"
            style={{ height: previewHeight }}
          >
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">Click to upload image</span>
            <span className="text-xs text-gray-400 mt-1">Max {maxFileSize}MB</span>
          </button>
        </div>
      )}

      {imageData && (
        <div
          className="relative group"
          onClick={e => e.stopPropagation()}
          onMouseEnter={handleGifPause}
          onMouseLeave={handleGifResume}
        >
          <img
            ref={imageRef}
            src={imageData}
            alt="Preview"
            className={`w-full rounded-lg ${isPaused ? 'hidden' : ''}`}
            style={{
              height: previewHeight,
              objectFit: displayMode === 'fill' ? 'fill' : displayMode,
            }}
            onError={() => setError('Failed to load image')}
          />
          {isGif && pauseGifOnHover && (
            <canvas
              ref={canvasRef}
              className={`w-full rounded-lg ${isPaused ? '' : 'hidden'}`}
              style={{
                height: previewHeight,
                objectFit: displayMode === 'fill' ? 'fill' : displayMode,
              }}
            />
          )}
          <button
            onClick={clearImage}
            className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          {isGif && metadata?.name && (
            <div className="absolute bottom-2 left-2 text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
              GIF • {metadata.name}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-2 text-red-500 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
