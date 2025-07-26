import { NodeMetadata } from '@/types/workflow'
import { JSONPath } from 'jsonpath-plus'

/**
 * JSON Query-based dynamic node configuration
 */
interface DynamicNodeRule {
  // When condition - JSON query to check if rule should apply
  when: string
  // Updates to apply when condition is met
  updates: {
    title?: string
    subtitle?: string
    description?: string
    icon?: string
    variant?: string
    requiredEnvVars?: string[]
    // Can extend to support any metadata property or even property definitions
    properties?: Record<string, any>
  }
}

interface PropertyRules {
  // Property changes that trigger evaluation
  triggers: string[]
  // Rules to evaluate in order
  rules: DynamicNodeRule[]
}

/**
 * Evaluates JSON query conditions using JSONPath
 * Supports: $.property == 'value', $.property != 'value', $.property > 5, etc.
 * Also supports compound conditions with && and ||
 */
function evaluateJsonQuery(query: string, data: Record<string, any>): boolean {
  try {
    // Handle compound conditions by splitting on && and ||
    const compoundParts = query.split(/(\s*&&\s*|\s*\|\|\s*)/);
    let results: boolean[] = [];
    let operators: string[] = [];
    
    for (let i = 0; i < compoundParts.length; i++) {
      const part = compoundParts[i].trim();
      
      if (part === '&&' || part === '||') {
        operators.push(part);
        continue;
      }
      
      // Parse individual condition: $.property operator value
      const conditionMatch = part.match(/(\$[.\w\[\]]+)\s*(==|!=|>|<|>=|<=)\s*(.+)/);
      
      if (!conditionMatch) {
        console.warn('Failed to parse condition:', part);
        return false;
      }
      
      const [, jsonPath, operator, expectedValueRaw] = conditionMatch;
      
      // Use JSONPath to get the actual value
      const actualValues = JSONPath({ path: jsonPath, json: data });
      
      if (actualValues.length === 0) {
        // Path not found, condition is false
        results.push(false);
        continue;
      }
      
      const actualValue = actualValues[0];
      
      // Clean expected value (remove quotes if present)
      const expectedValue = expectedValueRaw.trim().replace(/^['"]|['"]$/g, '');
      
      let result = false;
      
      switch (operator) {
        case '==':
          result = String(actualValue) === expectedValue;
          break;
        case '!=':
          result = String(actualValue) !== expectedValue;
          break;
        case '>':
          result = Number(actualValue) > Number(expectedValue);
          break;
        case '<':
          result = Number(actualValue) < Number(expectedValue);
          break;
        case '>=':
          result = Number(actualValue) >= Number(expectedValue);
          break;
        case '<=':
          result = Number(actualValue) <= Number(expectedValue);
          break;
      }
      
      results.push(result);
    }
    
    // Evaluate compound conditions
    if (results.length === 1) {
      return results[0];
    }
    
    // Process compound conditions left to right
    let finalResult = results[0];
    for (let i = 0; i < operators.length; i++) {
      if (operators[i] === '&&') {
        finalResult = finalResult && results[i + 1];
      } else if (operators[i] === '||') {
        finalResult = finalResult || results[i + 1];
      }
    }
    
    return finalResult;
  } catch (error) {
    console.error('Failed to evaluate JSON query:', query, error);
    return false;
  }
}

/**
 * Updates node metadata with dynamic changes based on property values using JSON queries
 */
export async function updateDynamicNodeMetadata(
  metadata: NodeMetadata, 
  propertyValues: Record<string, any>,
  propertyRules?: PropertyRules
): Promise<NodeMetadata> {
  if (!propertyRules) {
    return metadata // No property rules, return as-is
  }
  
  let updatedMetadata = { ...metadata }
  
  // Evaluate rules from most specific to least specific
  // First, apply compound rules (provider && model)
  let ruleApplied = false
  
  for (const rule of propertyRules.rules) {
    // Check if this is a compound rule (contains &&)
    if (rule.when.includes('&&')) {
      if (evaluateJsonQuery(rule.when, propertyValues)) {
        // Apply updates from this rule
        if (rule.updates.title) {
          updatedMetadata.title = rule.updates.title
        }
        if (rule.updates.subtitle) {
          updatedMetadata.subtitle = rule.updates.subtitle
        }
        if (rule.updates.icon) {
          updatedMetadata.icon = rule.updates.icon
        }
        if (rule.updates.variant) {
          updatedMetadata.variant = rule.updates.variant as any
        }
        if (rule.updates.requiredEnvVars) {
          updatedMetadata.requiredEnvVars = rule.updates.requiredEnvVars
        }
        if (rule.updates.properties) {
          // Could update property definitions dynamically
          // This would be more complex and require careful handling
        }
        
        ruleApplied = true
        break // Take first matching compound rule
      }
    }
  }
  
  // If no compound rule matched, try simple rules
  if (!ruleApplied) {
    for (const rule of propertyRules.rules) {
      // Skip compound rules
      if (rule.when.includes('&&')) continue
      
      if (evaluateJsonQuery(rule.when, propertyValues)) {
        // Apply updates from this rule
        if (rule.updates.title) {
          updatedMetadata.title = rule.updates.title
        }
        if (rule.updates.subtitle) {
          updatedMetadata.subtitle = rule.updates.subtitle
        }
        if (rule.updates.icon) {
          updatedMetadata.icon = rule.updates.icon
        }
        if (rule.updates.variant) {
          updatedMetadata.variant = rule.updates.variant as any
        }
        if (rule.updates.requiredEnvVars) {
          updatedMetadata.requiredEnvVars = rule.updates.requiredEnvVars
        }
        if (rule.updates.properties) {
          // Could update property definitions dynamically
          // This would be more complex and require careful handling
        }
        
        break // Take first matching simple rule
      }
    }
  }
  
  // Log metadata changes for debugging
  if (
    updatedMetadata.title !== metadata.title ||
    updatedMetadata.subtitle !== metadata.subtitle ||
    updatedMetadata.icon !== metadata.icon ||
    updatedMetadata.variant !== metadata.variant
  ) {
    console.log('✅ Dynamic metadata updated:', {
      title: `${metadata.title} → ${updatedMetadata.title}`,
      icon: `${metadata.icon} → ${updatedMetadata.icon}`,
      variant: `${metadata.variant} → ${updatedMetadata.variant}`
    });
  }
  
  // Ensure propertyValues are preserved
  if (!updatedMetadata.propertyValues && metadata.propertyValues) {
    updatedMetadata.propertyValues = metadata.propertyValues
  }
  
  return updatedMetadata
}

/**
 * Checks if a property change should trigger dynamic metadata update
 */
export function shouldUpdateDynamicMetadata(propertyRules: PropertyRules | undefined, propertyId: string): boolean {
  if (!propertyRules) return false
  return propertyRules.triggers.includes(propertyId)
}