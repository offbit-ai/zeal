import { RangeInputControl } from '@/components/UserInputControls'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function RangeInputRenderer({
  propertyValues,
  onPropertyChange,
}: NodeRendererProps) {
  return (
    <div
      className="w-full mt-3"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <RangeInputControl
        defaultValue={propertyValues.defaultValue || 50}
        min={propertyValues.min || 0}
        max={propertyValues.max || 100}
        step={propertyValues.step || 1}
        showValue={propertyValues.showValue !== false}
        showLabels={propertyValues.showLabels !== false}
        unit={propertyValues.unit || ''}
        onValueChange={value => onPropertyChange?.('value', value)}
      />
    </div>
  )
}
