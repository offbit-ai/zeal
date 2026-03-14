import { ImageStreamDisplay } from '@/components/ImageStreamDisplay'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function ImageStreamRenderer({
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
      <ImageStreamDisplay
        displayMode={propertyValues.displayMode || 'contain'}
        previewHeight={propertyValues.previewHeight || 300}
        nodeId={nodeId}
        onDataChange={data => {
          onPropertyChange?.('metadata', data.metadata)
        }}
      />
    </div>
  )
}
