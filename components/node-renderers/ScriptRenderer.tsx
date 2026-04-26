import { useCallback, useState } from 'react'
import { ResizableCodeEditor } from '@/components/property-pane/ResizableCodeEditor'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function ScriptRenderer({
  metadata,
  propertyValues,
  onPropertyChange,
  onSizeChange,
}: NodeRendererProps) {
  const [, setCodeEditorHeight] = useState(150)

  const handleHeightChange = useCallback(
    (height: number) => {
      setCodeEditorHeight(height)
      onSizeChange?.()
    },
    [onSizeChange]
  )

  // Find the code-editor property
  let codeEditorPropertyName: string | undefined
  let codeEditorProperty: any

  if (metadata.properties) {
    if (Array.isArray(metadata.properties)) {
      codeEditorProperty = metadata.properties.find((p: any) => p.type === 'code-editor')
      codeEditorPropertyName = codeEditorProperty?.id
    } else {
      const entry = Object.entries(metadata.properties).find(
        ([, p]: [string, any]) => p.type === 'code-editor'
      )
      if (entry) {
        codeEditorPropertyName = entry[0]
        codeEditorProperty = entry[1]
      }
    }
  }

  const codeValue = codeEditorPropertyName ? propertyValues?.[codeEditorPropertyName] || '' : ''

  return (
    <div
      className="w-full mt-2"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <ResizableCodeEditor
        value={codeValue}
        onChange={value =>
          codeEditorPropertyName && onPropertyChange?.(codeEditorPropertyName, value)
        }
        language={codeEditorProperty?.language || 'javascript'}
        placeholder={codeEditorProperty?.placeholder || '// Enter your code here'}
        defaultHeight={150}
        minHeight={100}
        maxHeight={400}
        onHeightChange={handleHeightChange}
        lineNumbers={true}
        wordWrap={true}
        theme="dark"
      />
    </div>
  )
}
