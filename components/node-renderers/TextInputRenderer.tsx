import { TextInputControl } from '@/components/property-pane/UserInputControls'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function TextInputRenderer({ propertyValues, onPropertyChange }: NodeRendererProps) {
  return (
    <div
      className="w-full mt-3"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <TextInputControl
        defaultValue={propertyValues.defaultValue || ''}
        placeholder={propertyValues.placeholder || 'Enter text...'}
        multiline={propertyValues.multiline || false}
        maxLength={propertyValues.maxLength}
        validation={propertyValues.validation || 'none'}
        validationPattern={propertyValues.validationPattern}
        onValueChange={value => onPropertyChange?.('value', value)}
      />
    </div>
  )
}
