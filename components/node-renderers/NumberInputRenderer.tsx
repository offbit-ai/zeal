import { NumberInputControl } from '@/components/property-pane/UserInputControls'
import type { NodeRendererProps } from '@/lib/node-renderer-registry'

export default function NumberInputRenderer({
  propertyValues,
  onPropertyChange,
}: NodeRendererProps) {
  return (
    <div
      className="w-full mt-3"
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      <NumberInputControl
        defaultValue={propertyValues.defaultValue || 0}
        min={propertyValues.min}
        max={propertyValues.max}
        step={propertyValues.step || 1}
        format={propertyValues.format || 'decimal'}
        decimals={propertyValues.decimals || 2}
        onValueChange={value => onPropertyChange?.('value', value)}
      />
    </div>
  )
}
