import { VideoPlayer } from '@/components/media/VideoPlayer'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function VideoInputRenderer({
  nodeId,
  propertyValues,
  onPropertyChange,
}: NodeRendererProps) {
  return (
    <div
      className="w-full mt-3"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <VideoPlayer
        source={propertyValues.source || 'upload'}
        url={
          propertyValues.source === 'upload' ? propertyValues.videoFile : propertyValues.url
        }
        acceptedFormats={propertyValues.acceptedFormats || 'video/mp4,video/webm,video/ogg'}
        maxFileSize={propertyValues.maxFileSize || 100}
        previewHeight={propertyValues.previewHeight || 300}
        showControls={propertyValues.showControls !== false}
        autoplay={propertyValues.autoplay || false}
        loop={propertyValues.loop || false}
        muted={propertyValues.muted || false}
        streamType={propertyValues.streamType}
        buffering={propertyValues.buffering}
        nodeId={nodeId}
        onDataChange={data => {
          if (propertyValues.source === 'upload') {
            onPropertyChange?.('videoFile', data.url)
          }
          onPropertyChange?.('videoData', data.url)
          onPropertyChange?.('metadata', data.metadata)
        }}
      />
    </div>
  )
}
