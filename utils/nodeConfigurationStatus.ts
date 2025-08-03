import { NodeMetadata, PropertyDefinition } from '@/types/workflow'

/**
 * Check if a node has properties with default values that haven't been explicitly configured by the user
 */
export function hasUnconfiguredDefaults(metadata: NodeMetadata): boolean {
  if (!metadata.properties || Object.keys(metadata.properties).length === 0) {
    return false
  }

  const propertyValues = metadata.propertyValues || {}
  
  // Check each property for unconfigured defaults
  for (const [propertyId, property] of Object.entries(metadata.properties)) {
    // Only check required fields
    if (property.required) {
      const currentValue = propertyValues[propertyId]
      
      // If property value is undefined, null, or empty string
      if (currentValue === undefined || currentValue === null || currentValue === '') {
        return true
      }
    }
  }
  return false
}

/**
 * Get list of properties that need user configuration
 */
export function getUnconfiguredProperties(metadata: NodeMetadata): PropertyDefinition[] {
  if (!metadata.properties || Object.keys(metadata.properties).length === 0) {
    return []
  }

  const propertyValues = metadata.propertyValues || {}
  const unconfigured: PropertyDefinition[] = []
  
  for (const [propertyId, property] of Object.entries(metadata.properties)) {
    // Only check required fields
    if (property.required) {
      const currentValue = propertyValues[propertyId]
      
      // If property value is undefined, null, or empty string
      if (currentValue === undefined || currentValue === null || currentValue === '') {
        property.id = propertyId // Ensure property has an ID for display
        property.label = property.label || propertyId // Use ID as label if not provided
        unconfigured.push(property)
      }
    }
  }
  
  return unconfigured
}

/**
 * Get a user-friendly message about unconfigured properties
 */
export function getConfigurationMessage(metadata: NodeMetadata): string {
  const unconfigured = getUnconfiguredProperties(metadata)
  
  if (unconfigured.length === 0) {
    return ''
  }
  
  if (unconfigured.length === 1) {
    return `Please configure the "${unconfigured[0].label}" property`
  }
  
  if (unconfigured.length === 2) {
    return `Please configure "${unconfigured[0].label}" and "${unconfigured[1].label}"`
  }
  
  return `Please configure ${unconfigured.length} properties: ${unconfigured.slice(0, 2).map(p => p.label).join(', ')} and others`
}