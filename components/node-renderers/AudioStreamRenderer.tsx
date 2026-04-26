import { AudioStreamDisplay } from '@/components/media/AudioStreamDisplay'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function AudioStreamRenderer({
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
      <AudioStreamDisplay
        autoplay={propertyValues.autoplay || false}
        loop={propertyValues.loop || false}
        showWaveform={propertyValues.showWaveform !== false}
        nodeId={nodeId}
        onDataChange={data => {
          onPropertyChange?.('metadata', data.metadata)
        }}
      />
    </div>
  )
}
