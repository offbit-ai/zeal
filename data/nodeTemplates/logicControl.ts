import { NodeTemplate } from './types'

/**
 * Logic Control Node Templates
 */
export const logicControlTemplates: NodeTemplate[] = [
  {
    "id": "tpl_if_branch",
    "type": "condition",
    "title": "If Branch",
    "subtitle": "Conditional Logic",
    "category": "logic-control",
    "subcategory": "conditions",
    "description": "Route data flow based on conditional rules",
    "icon": "git-branch",
    "variant": "gray-700",
    "shape": "diamond",
    "size": "medium",
    "ports": [
      {
        "id": "input-in",
        "label": "Input",
        "type": "input",
        "position": "top"
      },
      {
        "id": "true-out",
        "label": "True",
        "type": "output",
        "position": "right"
      },
      {
        "id": "false-out",
        "label": "False",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "decisionRules": {
        "type": "rules",
        "availableFields": [
          "value",
          "count",
          "status",
          "type",
          "category",
          "price",
          "quantity",
          "date",
          "amount"
        ],
        "availableOperators": [
          "is",
          "is_not",
          "contains",
          "not_contains",
          "greater_than",
          "less_than",
          "greater_equal",
          "less_equal",
          "empty",
          "not_empty"
        ],
        "description": "Define the conditions that determine True or False output. If any rule set evaluates to true, the True port will be activated."
      }
    },
    "tags": [
      "logic",
      "conditional",
      "routing",
      "branch"
    ],
    "version": "1.0.0",
    "isActive": true
  },
  {
    "id": "tpl_switch",
    "type": "condition",
    "title": "Switch",
    "subtitle": "Multi-way Branch",
    "category": "logic-control",
    "subcategory": "conditions",
    "description": "Route data to multiple outputs based on value matching",
    "icon": "split",
    "variant": "orange-600",
    "shape": "rectangle",
    "size": "large",
    "ports": [
      {
        "id": "input-in",
        "label": "Input",
        "type": "input",
        "position": "left"
      },
      {
        "id": "case1-out",
        "label": "Case 1",
        "type": "output",
        "position": "top"
      },
      {
        "id": "case2-out",
        "label": "Case 2",
        "type": "output",
        "position": "right"
      },
      {
        "id": "case3-out",
        "label": "Case 3",
        "type": "output",
        "position": "bottom"
      },
      {
        "id": "default-out",
        "label": "Default",
        "type": "output",
        "position": "left"
      }
    ],
    "properties": {
      "switchField": {
        "type": "text",
        "required": true,
        "placeholder": "status",
        "description": "Field name to switch on"
      },
      "case1Value": {
        "type": "text",
        "placeholder": "active"
      },
      "case2Value": {
        "type": "text",
        "placeholder": "pending"
      },
      "case3Value": {
        "type": "text",
        "placeholder": "inactive"
      },
      "caseSensitive": {
        "type": "boolean",
        "defaultValue": true
      }
    },
    "tags": [
      "logic",
      "switch",
      "routing",
      "multi-branch"
    ],
    "version": "1.0.0",
    "isActive": true
  },
  {
    "id": "tpl_loop",
    "type": "control",
    "title": "Loop",
    "subtitle": "Iterate Over Data",
    "category": "logic-control",
    "subcategory": "loops",
    "description": "Loop through arrays or collections",
    "icon": "repeat",
    "variant": "blue-600",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "items-in",
        "label": "Items",
        "type": "input",
        "position": "left"
      },
      {
        "id": "item-out",
        "label": "Current Item",
        "type": "output",
        "position": "right"
      },
      {
        "id": "index-out",
        "label": "Index",
        "type": "output",
        "position": "top"
      },
      {
        "id": "done-out",
        "label": "Done",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "loopType": {
        "type": "select",
        "options": [
          "for-each",
          "while",
          "do-while"
        ],
        "defaultValue": "for-each"
      },
      "batchSize": {
        "type": "number",
        "defaultValue": 1,
        "description": "Process items in batches"
      },
      "maxIterations": {
        "type": "number",
        "defaultValue": 1000,
        "description": "Safety limit for iterations"
      },
      "breakCondition": {
        "type": "textarea",
        "placeholder": "item.status === 'stop'"
      }
    },
    "tags": [
      "loop",
      "iterate",
      "control",
      "batch"
    ],
    "version": "1.0.0",
    "isActive": true,
    "propertyRules": {
      "triggers": [
        "loopType"
      ],
      "rules": [
        {
          "when": "$.loopType == 'for-each'",
          "updates": {
            "title": "For Each Loop",
            "subtitle": "Iterate Array",
            "description": "Iterate through each item in an array"
          }
        },
        {
          "when": "$.loopType == 'while'",
          "updates": {
            "title": "While Loop",
            "subtitle": "Conditional Loop",
            "description": "Loop while condition is true"
          }
        },
        {
          "when": "$.loopType == 'do-while'",
          "updates": {
            "title": "Do-While Loop",
            "subtitle": "Execute Then Check",
            "description": "Execute at least once, then loop while condition is true"
          }
        }
      ]
    }
  }
]
