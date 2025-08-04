'use client'

import { useState } from 'react'
import { Plus, X, GripVertical } from 'lucide-react'
import { RuleSet, RuleGroup, Rule, RuleOperator, RuleConnector } from '@/types/workflow'

interface RuleBuilderProps {
  value: RuleSet[]
  onChange: (value: RuleSet[]) => void
  availableFields?: string[]
  availableOperators?: RuleOperator[]
}

// Default operators if not specified
const DEFAULT_OPERATORS: RuleOperator[] = [
  'is',
  'is_not',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'greater_equal',
  'less_equal',
  'empty',
  'not_empty',
]

// Operator display names
const OPERATOR_LABELS: Record<RuleOperator, string> = {
  is: 'is',
  is_not: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  greater_than: '>',
  less_than: '<',
  greater_equal: '>=',
  less_equal: '<=',
  between: 'between',
  empty: 'is empty',
  not_empty: 'is not empty',
}

export function RuleBuilder({
  value = [],
  onChange,
  availableFields = [],
  availableOperators = DEFAULT_OPERATORS,
}: RuleBuilderProps) {
  const generateId = () => Math.random().toString(36).substr(2, 9)

  // Create a new rule
  const createRule = (): Rule => ({
    id: generateId(),
    field: availableFields[0] || '',
    operator: 'is',
    value: '',
    valueType: 'string',
  })

  // Create a new rule group
  const createRuleGroup = (): RuleGroup => ({
    id: generateId(),
    connector: 'AND',
    rules: [createRule()],
  })

  // Create a new rule set
  const createRuleSet = (): RuleSet => ({
    id: generateId(),
    type: 'IF',
    groups: [createRuleGroup()],
  })

  // Add new rule set
  const addRuleSet = () => {
    onChange([...value, createRuleSet()])
  }

  // Remove rule set
  const removeRuleSet = (setIndex: number) => {
    onChange(value.filter((_, index) => index !== setIndex))
  }

  // Update rule set
  const updateRuleSet = (setIndex: number, updates: Partial<RuleSet>) => {
    const newValue = [...value]
    newValue[setIndex] = { ...newValue[setIndex], ...updates }
    onChange(newValue)
  }

  // Add rule group to set
  const addRuleGroup = (setIndex: number) => {
    const newValue = [...value]
    newValue[setIndex].groups.push(createRuleGroup())
    onChange(newValue)
  }

  // Remove rule group
  const removeRuleGroup = (setIndex: number, groupIndex: number) => {
    const newValue = [...value]
    newValue[setIndex].groups = newValue[setIndex].groups.filter((_, index) => index !== groupIndex)
    onChange(newValue)
  }

  // Update rule group
  const updateRuleGroup = (setIndex: number, groupIndex: number, updates: Partial<RuleGroup>) => {
    const newValue = [...value]
    newValue[setIndex].groups[groupIndex] = { ...newValue[setIndex].groups[groupIndex], ...updates }
    onChange(newValue)
  }

  // Add rule to group
  const addRule = (setIndex: number, groupIndex: number) => {
    const newValue = [...value]
    newValue[setIndex].groups[groupIndex].rules.push(createRule())
    onChange(newValue)
  }

  // Remove rule
  const removeRule = (setIndex: number, groupIndex: number, ruleIndex: number) => {
    const newValue = [...value]
    newValue[setIndex].groups[groupIndex].rules = newValue[setIndex].groups[
      groupIndex
    ].rules.filter((_, index) => index !== ruleIndex)
    onChange(newValue)
  }

  // Update rule
  const updateRule = (
    setIndex: number,
    groupIndex: number,
    ruleIndex: number,
    updates: Partial<Rule>
  ) => {
    const newValue = [...value]
    newValue[setIndex].groups[groupIndex].rules[ruleIndex] = {
      ...newValue[setIndex].groups[groupIndex].rules[ruleIndex],
      ...updates,
    }
    onChange(newValue)
  }

  return (
    <div className="space-y-4">
      {value.map((ruleSet, setIndex) => (
        <div key={ruleSet.id} className="border border-gray-200 rounded-lg bg-gray-50 p-4">
          {/* Rule Set Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="px-2 py-1 bg-blue-500 text-white text-xs font-medium rounded">
                {ruleSet.type}
              </span>
              <select
                value={ruleSet.type}
                onChange={e => updateRuleSet(setIndex, { type: e.target.value as 'IF' | 'OR' })}
                className="text-xs border border-gray-300 rounded px-2 py-1"
              >
                <option value="IF">IF</option>
                <option value="OR">OR</option>
              </select>
            </div>
            <button
              onClick={() => removeRuleSet(setIndex)}
              className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Rule Groups */}
          <div className="space-y-3">
            {ruleSet.groups.map((group, groupIndex) => (
              <div key={group.id} className="bg-white border border-gray-200 rounded-md p-3">
                {/* Group Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {String.fromCharCode(65 + groupIndex)}
                    </span>
                    {groupIndex > 0 && (
                      <select
                        value={group.connector}
                        onChange={e =>
                          updateRuleGroup(setIndex, groupIndex, {
                            connector: e.target.value as RuleConnector,
                          })
                        }
                        className="text-xs bg-blue-100 text-blue-700 border border-blue-300 rounded px-2 py-1"
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    )}
                  </div>
                  <button
                    onClick={() => removeRuleGroup(setIndex, groupIndex)}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Rules */}
                <div className="space-y-2">
                  {group.rules.map((rule, ruleIndex) => (
                    <div
                      key={rule.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-100"
                    >
                      <GripVertical className="w-3 h-3 text-gray-400" />

                      {/* Field Selection */}
                      <select
                        value={rule.field}
                        onChange={e =>
                          updateRule(setIndex, groupIndex, ruleIndex, { field: e.target.value })
                        }
                        className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                      >
                        {availableFields.map(field => (
                          <option key={field} value={field}>
                            {field}
                          </option>
                        ))}
                      </select>

                      {/* Operator Selection */}
                      <select
                        value={rule.operator}
                        onChange={e =>
                          updateRule(setIndex, groupIndex, ruleIndex, {
                            operator: e.target.value as RuleOperator,
                          })
                        }
                        className="text-xs border border-gray-200 rounded px-2 py-1"
                      >
                        {availableOperators.map(op => (
                          <option key={op} value={op}>
                            {OPERATOR_LABELS[op]}
                          </option>
                        ))}
                      </select>

                      {/* Value Input */}
                      {!['empty', 'not_empty'].includes(rule.operator) && (
                        <input
                          type="text"
                          value={rule.value}
                          onChange={e =>
                            updateRule(setIndex, groupIndex, ruleIndex, { value: e.target.value })
                          }
                          placeholder="Value"
                          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1"
                        />
                      )}

                      {/* Remove Rule */}
                      <button
                        onClick={() => removeRule(setIndex, groupIndex, ruleIndex)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {/* Add Rule Button */}
                  <button
                    onClick={() => addRule(setIndex, groupIndex)}
                    className="w-full py-2 text-xs text-gray-500 border border-dashed border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    + Add Rule
                  </button>
                </div>
              </div>
            ))}

            {/* Add Group Button */}
            <button
              onClick={() => addRuleGroup(setIndex)}
              className="w-full py-2 text-xs text-blue-600 border border-dashed border-blue-300 rounded hover:bg-blue-50 transition-colors"
            >
              + Add Rule Group
            </button>
          </div>
        </div>
      ))}

      {/* Add Rule Set Button */}
      <button
        onClick={addRuleSet}
        className="w-full py-3 text-sm text-gray-600 border border-dashed border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
      >
        <Plus className="w-4 h-4" />
        Add Rule Set
      </button>

      {value.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-sm">No rules configured</div>
          <div className="text-xs mt-1">Click "Add Rule Set" to create your first rule</div>
        </div>
      )}
    </div>
  )
}
