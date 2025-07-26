"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDynamicNodeMetadata = updateDynamicNodeMetadata;
exports.hasDynamicMetadata = hasDynamicMetadata;
exports.getDynamicTriggers = getDynamicTriggers;
exports.shouldUpdateDynamicMetadata = shouldUpdateDynamicMetadata;
/**
 * Configuration for dynamic node behavior using JSON queries
 */
const DYNAMIC_NODE_CONFIGS = {
    'tpl_math_round': {
        triggers: ['method'],
        rules: [
            {
                when: "$.method == 'round'",
                updates: {
                    title: 'Round',
                    subtitle: 'Round Number',
                    description: 'Round a number to specified precision'
                }
            },
            {
                when: "$.method == 'floor'",
                updates: {
                    title: 'Floor',
                    subtitle: 'Round Down',
                    description: 'Round down to the nearest integer or precision'
                }
            },
            {
                when: "$.method == 'ceil'",
                updates: {
                    title: 'Ceiling',
                    subtitle: 'Round Up',
                    description: 'Round up to the nearest integer or precision'
                }
            },
            {
                when: "$.method == 'trunc'",
                updates: {
                    title: 'Truncate',
                    subtitle: 'Remove Decimals',
                    description: 'Remove decimal places without rounding'
                }
            }
        ]
    }
};
/**
 * Simple JSON query evaluator for basic expressions
 * Supports: $.property == 'value', $.property != 'value', $.property > 5, etc.
 */
function evaluateJsonQuery(query, data) {
    try {
        // Replace $.property with data.property for evaluation
        let expression = query.replace(/\$\.(\w+)/g, 'data.$1');
        // Handle string comparisons safely
        expression = expression.replace(/==\s*'([^']+)'/g, "=== '$1'");
        expression = expression.replace(/!=\s*'([^']+)'/g, "!== '$1'");
        // Evaluate the expression safely
        return Function('data', `return ${expression}`)(data);
    }
    catch (error) {
        console.warn('Failed to evaluate JSON query:', query, error);
        return false;
    }
}
/**
 * Updates node metadata with dynamic changes based on property values using JSON queries
 */
function updateDynamicNodeMetadata(metadata, propertyValues) {
    const config = DYNAMIC_NODE_CONFIGS[metadata.templateId];
    if (!config) {
        return metadata; // No dynamic config, return as-is
    }
    let updatedMetadata = { ...metadata };
    // Evaluate each rule in order
    for (const rule of config.rules) {
        if (evaluateJsonQuery(rule.when, propertyValues)) {
            // Apply updates from this rule
            if (rule.updates.title) {
                updatedMetadata.title = rule.updates.title;
            }
            if (rule.updates.subtitle) {
                updatedMetadata.subtitle = rule.updates.subtitle;
            }
            if (rule.updates.icon) {
                // Note: Icon changes would require importing the icon component
                // For now, keeping it simple with title/subtitle
            }
            if (rule.updates.variant) {
                updatedMetadata.variant = rule.updates.variant;
            }
            if (rule.updates.properties) {
                // Could update property definitions dynamically
                // This would be more complex and require careful handling
            }
            // Take first matching rule
            break;
        }
    }
    return updatedMetadata;
}
/**
 * Checks if a node template supports dynamic metadata updates
 */
function hasDynamicMetadata(templateId) {
    return templateId in DYNAMIC_NODE_CONFIGS;
}
/**
 * Gets the properties that trigger dynamic updates for a given template
 */
function getDynamicTriggers(templateId) {
    const config = DYNAMIC_NODE_CONFIGS[templateId];
    return config?.triggers || [];
}
/**
 * Checks if a property change should trigger dynamic metadata update
 */
function shouldUpdateDynamicMetadata(templateId, propertyId) {
    const triggers = getDynamicTriggers(templateId);
    return triggers.includes(propertyId);
}
