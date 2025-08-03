import { NodeTemplate } from './types'

/**
 * Server Node Templates
 * These nodes handle server request/response operations for workflow endpoints
 */
export const serverNodeTemplates: NodeTemplate[] = [
  {
    "id": "tpl_server_request",
    "type": "server-request",
    "title": "Server Request",
    "subtitle": "Incoming Request Handler",
    "category": "tools-utilities",
    "subcategory": "http",
    "description": "Receives and processes incoming HTTP/WebSocket requests with configurable data extraction",
    "icon": "download",
    "variant": "blue-600",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "request-out",
        "label": "Request Data",
        "type": "output",
        "position": "right"
      }
    ],
    "properties": {
      "requestType": {
        "type": "select",
        "label": "Request Type",
        "options": ["HTTP", "WebSocket", "Any"],
        "defaultValue": "Any",
        "required": true,
        "description": "Type of request this node will handle"
      },
      "dataFormat": {
        "type": "select",
        "label": "Expected Format",
        "options": ["JSON", "Form Data", "Plain Text", "Binary", "Auto-detect"],
        "defaultValue": "Auto-detect",
        "required": true,
        "description": "Expected format of incoming request data"
      },
      "extractFields": {
        "type": "dataOperations",
        "label": "Extract Fields",
        "description": "Configure which fields to extract from the request (headers, body, query params, etc.)"
      },
      "validation": {
        "type": "code-editor",
        "label": "Validation Schema",
        "language": "json",
        "placeholder": "{\n  \"type\": \"object\",\n  \"properties\": {\n    \"field\": { \"type\": \"string\" }\n  },\n  \"required\": [\"field\"]\n}",
        "height": 200,
        "description": "JSON Schema for request validation (optional)"
      },
      "authentication": {
        "type": "select",
        "label": "Authentication",
        "options": ["None", "Bearer Token", "API Key", "Basic Auth", "Custom"],
        "defaultValue": "None",
        "description": "Required authentication method for this endpoint"
      }
    },
    "tags": [
      "server",
      "request",
      "endpoint",
      "input",
      "http",
      "websocket"
    ],
    "version": "1.0.0",
    "isActive": true,
    "propertyRules": {
      "triggers": ["requestType", "authentication"],
      "rules": [
        {
          "when": "$.requestType == 'HTTP'",
          "updates": {
            "subtitle": "HTTP Request Handler",
            "icon": "globe"
          }
        },
        {
          "when": "$.requestType == 'WebSocket'",
          "updates": {
            "subtitle": "WebSocket Message Handler",
            "icon": "cable"
          }
        },
        {
          "when": "$.authentication == 'Bearer Token'",
          "updates": {
            "requiredEnvVars": ["AUTH_SECRET_KEY"]
          }
        },
        {
          "when": "$.authentication == 'API Key'",
          "updates": {
            "requiredEnvVars": ["API_KEY_HEADER", "VALID_API_KEYS"]
          }
        }
      ]
    }
  },
  {
    "id": "tpl_server_response",
    "type": "server-response",
    "title": "Server Response",
    "subtitle": "Success Response",
    "category": "tools-utilities",
    "subcategory": "http",
    "description": "Sends formatted responses back to the client with configurable status and headers",
    "icon": "check-circle",
    "variant": "green-600",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "data-in",
        "label": "Response Data",
        "type": "input",
        "position": "left"
      }
    ],
    "properties": {
      "responseType": {
        "type": "select",
        "label": "Response Type",
        "options": ["Success", "Error", "Redirect", "Custom"],
        "defaultValue": "Success",
        "required": true,
        "description": "Type of response to send"
      },
      "statusCode": {
        "type": "number",
        "label": "Status Code",
        "defaultValue": 200,
        "min": 100,
        "max": 599,
        "required": true,
        "description": "HTTP status code"
      },
      "contentType": {
        "type": "select",
        "label": "Content Type",
        "options": [
          "application/json",
          "text/plain",
          "text/html",
          "application/xml",
          "application/octet-stream",
          "Custom"
        ],
        "defaultValue": "application/json",
        "required": true,
        "description": "Response content type"
      },
      "customContentType": {
        "type": "text",
        "label": "Custom Content Type",
        "placeholder": "application/pdf",
        "description": "Specify custom content type when 'Custom' is selected",
        "visibleWhen": "contentType === 'Custom'"
      },
      "headers": {
        "type": "dataOperations",
        "label": "Custom Headers",
        "description": "Add custom response headers"
      },
      "responseFormat": {
        "type": "code-editor",
        "label": "Response Format",
        "language": "json",
        "placeholder": "{\n  \"success\": true,\n  \"data\": \"${data}\",\n  \"timestamp\": \"${timestamp}\"\n}",
        "height": 200,
        "description": "Template for formatting the response. Use ${data} for input data, ${timestamp} for current time"
      },
      "compression": {
        "type": "boolean",
        "label": "Enable Compression",
        "defaultValue": true,
        "description": "Enable gzip compression for response"
      },
      "cache": {
        "type": "select",
        "label": "Cache Control",
        "options": ["No Cache", "Public", "Private", "Custom"],
        "defaultValue": "No Cache",
        "description": "Cache control settings"
      },
      "cacheMaxAge": {
        "type": "number",
        "label": "Cache Max Age (seconds)",
        "defaultValue": 3600,
        "min": 0,
        "max": 31536000,
        "description": "Maximum cache age in seconds",
        "visibleWhen": "cache !== 'No Cache'"
      },
      "redirectUrl": {
        "type": "text",
        "label": "Redirect URL",
        "placeholder": "https://example.com/path",
        "description": "URL to redirect to",
        "visibleWhen": "responseType === 'Redirect'"
      }
    },
    "tags": [
      "server",
      "response",
      "endpoint",
      "output",
      "http",
      "result"
    ],
    "version": "1.0.0",
    "isActive": true,
    "propertyRules": {
      "triggers": ["responseType", "contentType", "cache"],
      "rules": [
        {
          "when": "$.responseType == 'Success'",
          "updates": {
            "icon": "check-circle",
            "variant": "green-600",
            "subtitle": "Success Response",
            "properties": {
              "statusCode": 200
            }
          }
        },
        {
          "when": "$.responseType == 'Error'",
          "updates": {
            "icon": "alert-circle",
            "variant": "red-600",
            "subtitle": "Error Response",
            "properties": {
              "statusCode": 400
            }
          }
        },
        {
          "when": "$.responseType == 'Redirect'",
          "updates": {
            "icon": "external-link",
            "variant": "yellow-600",
            "subtitle": "Redirect Response",
            "properties": {
              "statusCode": 302
            }
          }
        },
        {
          "when": "$.responseType == 'Custom'",
          "updates": {
            "icon": "settings",
            "variant": "gray-600",
            "subtitle": "Custom Response"
          }
        }
      ]
    }
  }
]