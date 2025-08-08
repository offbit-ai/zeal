import React, { useState, useRef, useEffect } from 'react'
import { Upload, Link, Video, Youtube, AlertCircle, X } from 'lucide-react'
import { useWorkflowStore } from '@/store/workflow-store'

interface VideoPlayerProps {
  source: 'upload' | 'url' | 'stream' | 'youtube' | 'vimeo'
  url?: string
  acceptedFormats: string
  maxFileSize: number
  previewHeight: number
  showControls: boolean
  autoplay: boolean
  loop: boolean
  muted: boolean
  streamType?: 'auto' | 'hls' | 'dash'
  buffering?: boolean
  nodeId?: string
  onDataChange?: (data: { url?: string; metadata?: any }) => void
}

export function VideoPlayer({
  source,
  url,
  acceptedFormats,
  maxFileSize,
  previewHeight,
  showControls,
  autoplay,
  loop,
  muted,
  streamType = 'auto',
  buffering = true,
  nodeId,
  onDataChange,
}: VideoPlayerProps) {
  const { workflowId, currentGraphId } = useWorkflowStore()

  // Use a ref to store the video player state to avoid multiple useState issues
  const stateRef = useRef({
    videoData: null as string | null,
    embedUrl: null as string | null,
    error: null as string | null,
    metadata: null as any,
    isBuffering: false,
    isLoading: false,
    lastUrl: undefined as string | undefined,
  })

  // Individual state hooks for UI reactivity
  const [videoData, setVideoData] = useState<string | null>(null)
  const [embedUrl, setEmbedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [isBuffering, setIsBuffering] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const onDataChangeRef = useRef(onDataChange)

  // Keep onDataChange ref current
  useEffect(() => {
    onDataChangeRef.current = onDataChange
  }, [onDataChange])

  useEffect(() => {
    if (source === 'url' && url && url !== stateRef.current.lastUrl) {
      setVideoData(url)
      setError(null)
      stateRef.current.videoData = url
      stateRef.current.error = null
      stateRef.current.lastUrl = url
      onDataChangeRef.current?.({ url, metadata: { source: 'url' } })
    } else if (source === 'upload' && url && url !== stateRef.current.lastUrl) {
      // Handle pre-uploaded file from property panel
      setVideoData(url)
      setError(null)
      stateRef.current.videoData = url
      stateRef.current.error = null
      stateRef.current.lastUrl = url
      // Don't call onDataChange here as the data is already saved
    } else if (source === 'stream' && url && url !== stateRef.current.lastUrl) {
      setVideoData(url)
      setError(null)
      stateRef.current.videoData = url
      stateRef.current.error = null
      stateRef.current.lastUrl = url
      onDataChangeRef.current?.({ url, metadata: { source: 'stream', streamType } })
    } else if (source === 'youtube' && url && url !== stateRef.current.lastUrl) {
      // Extract YouTube video ID
      const match = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/
      )
      if (match) {
        const videoId = match[1]
        const embed = `https://www.youtube.com/embed/${videoId}${autoplay ? '?autoplay=1' : ''}${loop ? '&loop=1' : ''}${muted ? '&mute=1' : ''}`
        setEmbedUrl(embed)
        setError(null)
        stateRef.current.embedUrl = embed
        stateRef.current.error = null
        stateRef.current.lastUrl = url
        onDataChangeRef.current?.({ url: embed, metadata: { source: 'youtube', videoId } })
      } else {
        setError('Invalid YouTube URL')
        stateRef.current.error = 'Invalid YouTube URL'
        stateRef.current.lastUrl = url
      }
    } else if (source === 'vimeo' && url && url !== stateRef.current.lastUrl) {
      // Extract Vimeo video ID
      const match = url.match(/vimeo\.com\/(\d+)/)
      if (match) {
        const videoId = match[1]
        const embed = `https://player.vimeo.com/video/${videoId}${autoplay ? '?autoplay=1' : ''}${loop ? '&loop=1' : ''}${muted ? '&muted=1' : ''}`
        setEmbedUrl(embed)
        setError(null)
        stateRef.current.embedUrl = embed
        stateRef.current.error = null
        stateRef.current.lastUrl = url
        onDataChangeRef.current?.({ url: embed, metadata: { source: 'vimeo', videoId } })
      } else {
        setError('Invalid Vimeo URL')
        stateRef.current.error = 'Invalid Vimeo URL'
        stateRef.current.lastUrl = url
      }
    } else if (!url && stateRef.current.lastUrl) {
      // Clear video data if url becomes null/undefined
      setVideoData(null)
      setEmbedUrl(null)
      setError(null)
      stateRef.current.videoData = null
      stateRef.current.embedUrl = null
      stateRef.current.error = null
      stateRef.current.lastUrl = undefined
    }
  }, [source, url, autoplay, loop, muted, streamType])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size
    if (file.size > maxFileSize * 1024 * 1024) {
      setError(`File size exceeds ${maxFileSize}MB limit`)
      stateRef.current.error = `File size exceeds ${maxFileSize}MB limit`
      return
    }

    // Validate file type
    const acceptedTypes = acceptedFormats.split(',').map(t => t.trim())
    if (!acceptedTypes.includes(file.type)) {
      setError(`Invalid file type. Accepted: ${acceptedFormats}`)
      stateRef.current.error = `Invalid file type. Accepted: ${acceptedFormats}`
      return
    }

    // Show loading state
    setIsLoading(true)
    setError(null)
    stateRef.current.isLoading = true
    stateRef.current.error = null

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
      setVideoData(data.url)
      stateRef.current.videoData = data.url

      const meta = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        source: 'upload',
        key: data.key,
        url: data.url,
      }
      setMetadata(meta)
      stateRef.current.metadata = meta

      onDataChangeRef.current?.({ url: data.url, metadata: meta })
      setIsLoading(false)
      stateRef.current.isLoading = false
    } catch (err) {
      setError('Failed to upload video')
      stateRef.current.error = 'Failed to upload video'
      console.error('Upload error:', err)
      setIsLoading(false)
      stateRef.current.isLoading = false
    }
  }

  const clearVideo = () => {
    // First, stop any playing video to free resources
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.src = ''
    }

    // Clear all states immediately
    setVideoData(null)
    setEmbedUrl(null)
    setError(null)
    setMetadata(null)
    setIsBuffering(false)

    // Update ref state as well
    stateRef.current.videoData = null
    stateRef.current.embedUrl = null
    stateRef.current.error = null
    stateRef.current.metadata = null
    stateRef.current.isBuffering = false
    stateRef.current.lastUrl = undefined

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }

    onDataChangeRef.current?.({ url: undefined, metadata: undefined })
  }

  const handleBufferStart = () => {
    if (buffering) {
      setIsBuffering(true)
      stateRef.current.isBuffering = true
    }
  }

  const handleBufferEnd = () => {
    setIsBuffering(false)
    stateRef.current.isBuffering = false
  }

  return (
    <div className="w-full">
      {!videoData && !embedUrl && !isLoading && (
        <div className="relative">
          {source === 'upload' ? (
            <div onClick={e => e.stopPropagation()}>
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
                <span className="text-sm text-gray-500">Click to upload video</span>
                <span className="text-xs text-gray-400 mt-1">Max {maxFileSize}MB</span>
              </button>
            </div>
          ) : (
            <div
              className="w-full bg-black rounded-lg flex flex-col items-center justify-center"
              style={{ height: previewHeight }}
            >
              <Video className="w-12 h-12 text-gray-600 mb-3" />
              <span className="text-sm text-gray-500">Video data is not available</span>
            </div>
          )}
        </div>
      )}

      {isLoading && (
        <div
          className="w-full bg-black rounded-lg flex flex-col items-center justify-center"
          style={{ height: previewHeight }}
        >
          <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-sm text-gray-400">Loading video...</span>
        </div>
      )}

      {videoData && !isLoading && (
        <div className="relative group" onClick={e => e.stopPropagation()}>
          <video
            ref={videoRef}
            src={videoData}
            controls={showControls}
            autoPlay={autoplay}
            loop={loop}
            muted={muted}
            className="w-full rounded-lg bg-black"
            style={{ height: previewHeight }}
            onError={() => {
              setError('Failed to load video')
              stateRef.current.error = 'Failed to load video'
            }}
            onWaiting={handleBufferStart}
            onPlaying={handleBufferEnd}
            onCanPlay={handleBufferEnd}
          />
          {isBuffering && (
            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                <span className="text-white text-sm">Buffering...</span>
              </div>
            </div>
          )}
          <button
            onClick={clearVideo}
            className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          {metadata?.name && (
            <div className="absolute bottom-2 left-2 text-xs text-white bg-black bg-opacity-50 px-2 py-1 rounded">
              {metadata.name}
            </div>
          )}
          {source === 'stream' && (
            <div className="absolute top-2 left-2 text-xs text-white bg-green-600 bg-opacity-80 px-2 py-1 rounded">
              LIVE • {streamType.toUpperCase()}
            </div>
          )}
        </div>
      )}

      {embedUrl && !isLoading && (
        <div className="relative group" onClick={e => e.stopPropagation()}>
          <iframe
            src={embedUrl}
            className="w-full rounded-lg"
            style={{ height: previewHeight }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          <button
            onClick={clearVideo}
            className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
          >
            <X className="w-4 h-4 text-white" />
          </button>
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
