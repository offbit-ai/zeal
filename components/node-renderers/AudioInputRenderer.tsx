import { AudioPlayer } from '@/components/AudioPlayer'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function AudioInputRenderer({
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
      <AudioPlayer
        source={propertyValues.source || 'upload'}
        url={
          propertyValues.source === 'upload' ? propertyValues.audioFile : propertyValues.url
        }
        acceptedFormats={
          propertyValues.acceptedFormats || 'audio/mpeg,audio/wav,audio/ogg,audio/webm'
        }
        maxFileSize={propertyValues.maxFileSize || 50}
        showWaveform={propertyValues.showWaveform !== false}
        autoplay={propertyValues.autoplay || false}
        loop={propertyValues.loop || false}
        nodeId={nodeId}
        onDataChange={data => {
          if (propertyValues.source === 'upload') {
            onPropertyChange?.('audioFile', data.url)
          }
          onPropertyChange?.('audioData', data.url)
          onPropertyChange?.('metadata', data.metadata)
        }}
      />
    </div>
  )
}
