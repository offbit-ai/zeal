import { NodeTemplate } from './types'

/**
 * Data Processing Node Templates
 */
export const dataProcessingTemplates: NodeTemplate[] = [
  {
    "id": "tpl_arrow_operations",
    "type": "arrow",
    "title": "Apache Arrow",
    "subtitle": "High-Performance Data Processing",
    "category": "data-processing",
    "subcategory": "aggregators",
    "description": "Process data using Apache Arrow columnar format",
    "icon": "zap",
    "variant": "gray-900",
    "shape": "rectangle",
    "size": "large",
    "ports": [
      {
        "id": "data-in",
        "label": "Data",
        "type": "input",
        "position": "left"
      },
      {
        "id": "schema-in",
        "label": "Schema",
        "type": "input",
        "position": "top"
      },
      {
        "id": "table-out",
        "label": "Arrow Table",
        "type": "output",
        "position": "right"
      },
      {
        "id": "stats-out",
        "label": "Statistics",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "operation": {
        "type": "select",
        "options": [
          "convert",
          "filter",
          "aggregate",
          "join",
          "sort"
        ],
        "defaultValue": "convert"
      },
      "compression": {
        "type": "select",
        "options": [
          "none",
          "snappy",
          "gzip",
          "lz4"
        ],
        "defaultValue": "snappy"
      },
      "chunkSize": {
        "type": "number",
        "defaultValue": 10000
      },
      "enableStatistics": {
        "type": "boolean",
        "defaultValue": true
      }
    },
    "tags": [
      "arrow",
      "columnar",
      "performance",
      "analytics"
    ],
    "version": "1.0.0",
    "isActive": true
  },
  {
    "id": "tpl_csv_reader",
    "type": "reader",
    "title": "CSV Reader",
    "subtitle": "Parse CSV Files",
    "category": "data-processing",
    "subcategory": "transformers",
    "description": "Read and parse CSV files with configurable options",
    "icon": "file-text",
    "variant": "green-600",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "file-in",
        "label": "File Path",
        "type": "input",
        "position": "left"
      },
      {
        "id": "data-out",
        "label": "Parsed Data",
        "type": "output",
        "position": "right"
      },
      {
        "id": "errors-out",
        "label": "Parse Errors",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "delimiter": {
        "type": "select",
        "options": [
          ",",
          ";",
          "\t",
          "|"
        ],
        "defaultValue": ","
      },
      "hasHeader": {
        "type": "boolean",
        "defaultValue": true
      },
      "skipRows": {
        "type": "number",
        "defaultValue": 0
      },
      "encoding": {
        "type": "select",
        "options": [
          "utf-8",
          "latin1",
          "ascii"
        ],
        "defaultValue": "utf-8"
      },
      "dateFormat": {
        "type": "text",
        "placeholder": "YYYY-MM-DD"
      }
    },
    "tags": [
      "csv",
      "reader",
      "parser",
      "file"
    ],
    "version": "1.0.0",
    "isActive": true,
    "propertyRules": {
      "triggers": [
        "delimiter",
        "encoding"
      ],
      "rules": [
        {
          "when": "$.delimiter == ','",
          "updates": {
            "title": "CSV Reader",
            "subtitle": "Comma Separated",
            "description": "Read comma-separated values file"
          }
        },
        {
          "when": "$.delimiter == ';'",
          "updates": {
            "title": "CSV Reader",
            "subtitle": "Semicolon Separated",
            "description": "Read semicolon-separated values file"
          }
        },
        {
          "when": "$.delimiter == '\t'",
          "updates": {
            "title": "TSV Reader",
            "subtitle": "Tab Separated",
            "description": "Read tab-separated values file"
          }
        },
        {
          "when": "$.delimiter == '|'",
          "updates": {
            "title": "PSV Reader",
            "subtitle": "Pipe Separated",
            "description": "Read pipe-separated values file"
          }
        }
      ]
    }
  },
  {
    "id": "tpl_data_transformer",
    "type": "transformer",
    "title": "Data Transformer",
    "subtitle": "Transform & Process Data",
    "category": "data-processing",
    "subcategory": "transformers",
    "description": "Transform and manipulate data using filters and operations",
    "icon": "shuffle",
    "variant": "blue-700",
    "shape": "rectangle",
    "size": "large",
    "ports": [
      {
        "id": "data-in",
        "label": "Input Data",
        "type": "input",
        "position": "left"
      },
      {
        "id": "schema-in",
        "label": "Schema",
        "type": "input",
        "position": "top"
      },
      {
        "id": "transformed-out",
        "label": "Transformed",
        "type": "output",
        "position": "right"
      },
      {
        "id": "errors-out",
        "label": "Errors",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "dataOperations": {
        "type": "dataOperations",
        "availableFields": [
          "id",
          "name",
          "email",
          "status",
          "created_at",
          "updated_at",
          "first_name",
          "last_name",
          "age",
          "department",
          "salary",
          "role",
          "address",
          "phone"
        ],
        "description": "Configure data transformation pipelines including mapping, filtering, sorting, and aggregation"
      },
      "errorHandling": {
        "type": "select",
        "options": [
          "ignore",
          "skip_item",
          "stop_pipeline",
          "log_and_continue"
        ],
        "defaultValue": "log_and_continue"
      },
      "batchSize": {
        "type": "number",
        "defaultValue": 1000,
        "description": "Number of items to process in each batch"
      },
      "enableValidation": {
        "type": "boolean",
        "defaultValue": true,
        "description": "Validate data before and after transformation"
      }
    },
    "tags": [
      "transform",
      "data",
      "processing",
      "filter"
    ],
    "version": "1.0.0",
    "isActive": true
  }
]
