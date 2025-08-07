import React, { useState, useRef, useEffect } from 'react'
import { Play, Pause, Upload, Mic, Link, AlertCircle, X } from 'lucide-react'

interface AudioPlayerProps {
  source: 'upload' | 'url' | 'record'
  url?: string
  acceptedFormats: string
  maxFileSize: number
  showWaveform: boolean
  autoplay: boolean
  loop: boolean
  onDataChange?: (data: { url?: string; metadata?: any }) => void
}

export function AudioPlayer({
  source,
  url,
  acceptedFormats,
  maxFileSize,
  showWaveform,
  autoplay,
  loop,
  onDataChange,
}: AudioPlayerProps) {
  const [audioData, setAudioData] = useState<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (source === 'url' && url) {
      setAudioData(url)
      setError(null)
      onDataChange?.({ url, metadata: { source: 'url' } })
    }
  }, [source, url, onDataChange])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.autoplay = autoplay
      audioRef.current.loop = loop
    }
  }, [autoplay, loop])

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

    // Show loading state
    setIsLoading(true)
    setError(null)

    try {
      // TODO: In production, implement S3 multipart upload here
      // const formData = new FormData()
      // formData.append('file', file)
      // const response = await fetch('/api/upload/audio', {
      //   method: 'POST',
      //   body: formData,
      // })
      // const { url: s3Url } = await response.json()
      // setAudioData(s3Url)

      // For now, use local blob URL as placeholder
      if (audioData && audioData.startsWith('blob:')) {
        URL.revokeObjectURL(audioData)
      }
      const objectUrl = URL.createObjectURL(file)
      setAudioData(objectUrl)

      const meta = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        source: 'upload',
        path: file.name, // In production, this would be the S3 key
      }
      setMetadata(meta)
      
      // In production, this would pass the S3 URL
      onDataChange?.({ url: objectUrl, metadata: meta })
    } catch (err) {
      setError('Failed to upload audio')
      console.error('Upload error:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const togglePlayPause = () => {
    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime)
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
    }
  }

  const handleSeek = (event: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(event.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const clearAudio = () => {
    // First, stop any playing audio to free resources
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.src = ''
    }
    
    // Revoke object URL to free memory
    if (audioData && audioData.startsWith('blob:')) {
      URL.revokeObjectURL(audioData)
    }
    
    // Clear all states immediately
    setAudioData(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setError(null)
    setMetadata(null)
    
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    onDataChange?.({ url: undefined, metadata: undefined })
  }

  return (
    <div className="w-full">
      {!audioData && !isLoading && source === 'upload' && (
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
          >
            <Upload className="w-8 h-8 text-gray-400 mb-2" />
            <span className="text-sm text-gray-500">Click to upload audio</span>
            <span className="text-xs text-gray-400 mt-1">Max {maxFileSize}MB</span>
          </button>
        </div>
      )}

      {isLoading && (
        <div className="w-full bg-gray-50 rounded-lg p-6 flex flex-col items-center justify-center">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-sm text-gray-600">Loading audio...</span>
        </div>
      )}

      {!audioData && source === 'record' && (
        <div className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center">
          <Mic className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">Recording not implemented</span>
        </div>
      )}

      {audioData && !isLoading && (
        <div className="w-full bg-gray-50 rounded-lg p-3" onClick={e => e.stopPropagation()}>
          <audio
            ref={audioRef}
            src={audioData}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={() => setError('Failed to load audio')}
          />

          <div className="flex items-center gap-3">
            <button
              onClick={togglePlayPause}
              className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 transition-colors"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <div className="flex-1">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <button
              onClick={clearAudio}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {metadata?.name && (
            <div className="text-xs text-gray-500 mt-2 truncate">{metadata.name}</div>
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
