/**
 * Node Templates Index
 * Exports all node templates organized by category
 */

// Import all template arrays
import { dataSourcesTemplates } from './dataSources'
import { toolsUtilitiesTemplates } from './toolsUtilities'
import { aiModelsTemplates } from './aiModels'
import { communicationTemplates } from './communication'
import { storageMemoryTemplates } from './storageMemory'
import { scriptingTemplates } from './scripting'
import { logicControlTemplates } from './logicControl'
import { dataProcessingTemplates } from './dataProcessing'
import { serverNodeTemplates } from './serverNodes'

// Re-export for convenience
export { dataSourcesTemplates } from './dataSources'
export { toolsUtilitiesTemplates } from './toolsUtilities'
export { aiModelsTemplates } from './aiModels'
export { communicationTemplates } from './communication'
export { storageMemoryTemplates } from './storageMemory'
export { scriptingTemplates } from './scripting'
export { logicControlTemplates } from './logicControl'
export { dataProcessingTemplates } from './dataProcessing'
export { serverNodeTemplates } from './serverNodes'

export type { NodeTemplate, Port, PropertyDefinition, PropertyRule, PropertyRules } from './types'

// Combine all templates into a single array
export const allNodeTemplates = [
  ...dataSourcesTemplates,
  ...toolsUtilitiesTemplates,
  ...aiModelsTemplates,
  ...communicationTemplates,
  ...storageMemoryTemplates,
  ...scriptingTemplates,
  ...logicControlTemplates,
  ...dataProcessingTemplates,
  ...serverNodeTemplates
]
