import { ImagePreview } from '@/components/media/MediaPreview'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function ImageInputRenderer({
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
      <ImagePreview
        source={propertyValues.source || 'upload'}
        url={
          propertyValues.source === 'upload' ? propertyValues.imageFile : propertyValues.url
        }
        displayMode={propertyValues.displayMode || 'contain'}
        previewHeight={propertyValues.previewHeight || 200}
        acceptedFormats={
          propertyValues.acceptedFormats || 'image/jpeg,image/png,image/gif,image/webp'
        }
        maxFileSize={propertyValues.maxFileSize || 10}
        pauseGifOnHover={propertyValues.pauseGifOnHover}
        nodeId={nodeId}
        onDataChange={data => {
          if (propertyValues.source === 'upload') {
            onPropertyChange?.('imageFile', data.url)
          }
          onPropertyChange?.('imageData', data.url)
          onPropertyChange?.('metadata', data.metadata)
        }}
      />
    </div>
  )
}
