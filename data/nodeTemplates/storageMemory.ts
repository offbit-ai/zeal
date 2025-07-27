import { NodeTemplate } from './types'

/**
 * Storage Memory Node Templates
 */
export const storageMemoryTemplates: NodeTemplate[] = [
  {
    "id": "tpl_cache",
    "type": "cache",
    "title": "Cache",
    "subtitle": "In-Memory Cache",
    "category": "storage-memory",
    "subcategory": "cache",
    "description": "Cache data in memory with TTL support",
    "icon": "database",
    "variant": "gray-700",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "key-in",
        "label": "Key",
        "type": "input",
        "position": "left"
      },
      {
        "id": "value-in",
        "label": "Value",
        "type": "input",
        "position": "top"
      },
      {
        "id": "cached-out",
        "label": "Cached Value",
        "type": "output",
        "position": "right"
      },
      {
        "id": "hit-out",
        "label": "Cache Hit",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "operation": {
        "type": "select",
        "options": [
          "get",
          "set",
          "delete",
          "clear",
          "has"
        ],
        "defaultValue": "get"
      },
      "ttl": {
        "type": "number",
        "defaultValue": 300,
        "description": "Time to live in seconds"
      },
      "maxSize": {
        "type": "number",
        "defaultValue": 1000,
        "description": "Maximum cache entries"
      },
      "evictionPolicy": {
        "type": "select",
        "options": [
          "lru",
          "lfu",
          "fifo"
        ],
        "defaultValue": "lru"
      }
    },
    "tags": [
      "cache",
      "memory",
      "performance",
      "storage"
    ],
    "version": "1.0.0",
    "isActive": true,
    "propertyRules": {
      "triggers": [
        "operation"
      ],
      "rules": [
        {
          "when": "$.operation == 'get'",
          "updates": {
            "title": "Cache Get",
            "subtitle": "Retrieve Value",
            "description": "Get cached value by key"
          }
        },
        {
          "when": "$.operation == 'set'",
          "updates": {
            "title": "Cache Set",
            "subtitle": "Store Value",
            "description": "Store value in cache with TTL"
          }
        },
        {
          "when": "$.operation == 'delete'",
          "updates": {
            "title": "Cache Delete",
            "subtitle": "Remove Entry",
            "description": "Remove cached entry by key"
          }
        },
        {
          "when": "$.operation == 'clear'",
          "updates": {
            "title": "Cache Clear",
            "subtitle": "Clear All",
            "description": "Clear all cached entries"
          }
        },
        {
          "when": "$.operation == 'has'",
          "updates": {
            "title": "Cache Has",
            "subtitle": "Check Existence",
            "description": "Check if key exists in cache"
          }
        }
      ]
    }
  },
  {
    "id": "tpl_redis",
    "type": "redis",
    "title": "Redis",
    "subtitle": "Redis Operations",
    "category": "storage-memory",
    "subcategory": "cache",
    "description": "Interact with Redis for caching and data storage",
    "icon": "redis",
    "variant": "gray-800",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "command-in",
        "label": "Command",
        "type": "input",
        "position": "left"
      },
      {
        "id": "args-in",
        "label": "Arguments",
        "type": "input",
        "position": "top"
      },
      {
        "id": "result-out",
        "label": "Result",
        "type": "output",
        "position": "right"
      },
      {
        "id": "error-out",
        "label": "Error",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "command": {
        "type": "select",
        "options": [
          "GET",
          "SET",
          "DEL",
          "EXISTS",
          "EXPIRE",
          "HGET",
          "HSET",
          "LPUSH",
          "RPOP"
        ],
        "defaultValue": "GET"
      },
      "key": {
        "type": "text",
        "required": true,
        "placeholder": "mykey"
      },
      "database": {
        "type": "number",
        "defaultValue": 0,
        "min": 0,
        "max": 15
      },
      "expiry": {
        "type": "number",
        "placeholder": 3600
      }
    },
    "requiredEnvVars": [
      "REDIS_URL",
      "REDIS_PASSWORD"
    ],
    "tags": [
      "redis",
      "cache",
      "database",
      "nosql"
    ],
    "version": "1.0.0",
    "isActive": true,
    "propertyRules": {
      "triggers": [
        "command"
      ],
      "rules": [
        {
          "when": "$.command == 'GET'",
          "updates": {
            "title": "Redis GET",
            "subtitle": "Get Value",
            "description": "Get value from Redis by key"
          }
        },
        {
          "when": "$.command == 'SET'",
          "updates": {
            "title": "Redis SET",
            "subtitle": "Set Value",
            "description": "Set key-value pair in Redis"
          }
        },
        {
          "when": "$.command == 'DEL'",
          "updates": {
            "title": "Redis DEL",
            "subtitle": "Delete Key",
            "description": "Delete key from Redis"
          }
        },
        {
          "when": "$.command == 'EXISTS'",
          "updates": {
            "title": "Redis EXISTS",
            "subtitle": "Check Key",
            "description": "Check if key exists in Redis"
          }
        },
        {
          "when": "$.command == 'EXPIRE'",
          "updates": {
            "title": "Redis EXPIRE",
            "subtitle": "Set TTL",
            "description": "Set expiration time for Redis key"
          }
        },
        {
          "when": "$.command == 'HGET'",
          "updates": {
            "title": "Redis HGET",
            "subtitle": "Get Hash Field",
            "description": "Get field value from Redis hash"
          }
        },
        {
          "when": "$.command == 'HSET'",
          "updates": {
            "title": "Redis HSET",
            "subtitle": "Set Hash Field",
            "description": "Set field value in Redis hash"
          }
        },
        {
          "when": "$.command == 'LPUSH'",
          "updates": {
            "title": "Redis LPUSH",
            "subtitle": "Push to List",
            "description": "Push element to left of Redis list"
          }
        },
        {
          "when": "$.command == 'RPOP'",
          "updates": {
            "title": "Redis RPOP",
            "subtitle": "Pop from List",
            "description": "Pop element from right of Redis list"
          }
        }
      ]
    }
  },
  {
    "id": "tpl_event_emitter",
    "type": "event",
    "title": "Event Emitter",
    "subtitle": "Publish Events",
    "category": "storage-memory",
    "subcategory": "sessions",
    "description": "Emit events to event bus or pub/sub systems",
    "icon": "broadcast",
    "variant": "gray-700",
    "shape": "circle",
    "size": "medium",
    "ports": [
      {
        "id": "event-in",
        "label": "Event",
        "type": "input",
        "position": "left"
      },
      {
        "id": "data-in",
        "label": "Data",
        "type": "input",
        "position": "top"
      },
      {
        "id": "published-out",
        "label": "Published",
        "type": "output",
        "position": "right"
      },
      {
        "id": "id-out",
        "label": "Event ID",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "eventName": {
        "type": "text",
        "required": true,
        "placeholder": "user.created"
      },
      "channel": {
        "type": "text",
        "placeholder": "default"
      },
      "persistence": {
        "type": "boolean",
        "defaultValue": false
      },
      "priority": {
        "type": "select",
        "options": [
          "low",
          "normal",
          "high"
        ],
        "defaultValue": "normal"
      }
    },
    "tags": [
      "event",
      "pubsub",
      "messaging",
      "async"
    ],
    "version": "1.0.0",
    "isActive": true
  },
  {
    "id": "tpl_queue",
    "type": "queue",
    "title": "Queue",
    "subtitle": "Message Queue",
    "category": "storage-memory",
    "subcategory": "sessions",
    "description": "Send and receive messages from queues",
    "icon": "list",
    "variant": "gray-800",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "message-in",
        "label": "Message",
        "type": "input",
        "position": "left"
      },
      {
        "id": "options-in",
        "label": "Options",
        "type": "input",
        "position": "top"
      },
      {
        "id": "received-out",
        "label": "Received",
        "type": "output",
        "position": "right"
      },
      {
        "id": "ack-out",
        "label": "Acknowledgment",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "operation": {
        "type": "select",
        "options": [
          "send",
          "receive",
          "peek",
          "ack",
          "nack"
        ],
        "defaultValue": "send"
      },
      "queueName": {
        "type": "text",
        "required": true,
        "placeholder": "task-queue"
      },
      "provider": {
        "type": "select",
        "options": [
          "rabbitmq",
          "sqs",
          "kafka",
          "redis"
        ],
        "defaultValue": "rabbitmq"
      },
      "maxMessages": {
        "type": "number",
        "defaultValue": 1,
        "min": 1,
        "max": 10
      }
    },
    "requiredEnvVars": [
      "QUEUE_CONNECTION_STRING"
    ],
    "tags": [
      "queue",
      "messaging",
      "async",
      "mq"
    ],
    "version": "1.0.0",
    "isActive": true,
    "propertyRules": {
      "triggers": ["operation", "provider"],
      "rules": [
        {
          "when": "$.provider == 'rabbitmq'",
          "updates": {
            "title": "RabbitMQ Queue",
            "subtitle": "AMQP Messaging",
            "description": "Send and receive messages via RabbitMQ",
            "icon": "rabbit"
          }
        },
        {
          "when": "$.provider == 'sqs'",
          "updates": {
            "title": "Amazon SQS",
            "subtitle": "AWS Queue Service",
            "description": "Send and receive messages via Amazon SQS",
            "icon": "aws"
          }
        },
        {
          "when": "$.provider == 'kafka'",
          "updates": {
            "title": "Apache Kafka",
            "subtitle": "Event Streaming",
            "description": "Send and receive messages via Apache Kafka",
            "icon": "kafka"
          }
        },
        {
          "when": "$.provider == 'redis'",
          "updates": {
            "title": "Redis Queue",
            "subtitle": "Redis Lists",
            "description": "Send and receive messages via Redis lists",
            "icon": "redis"
          }
        },
        {
          "when": "$.operation == 'send'",
          "updates": {
            "title": "Queue Send",
            "subtitle": "Send Message",
            "description": "Send message to queue"
          }
        },
        {
          "when": "$.operation == 'receive'",
          "updates": {
            "title": "Queue Receive",
            "subtitle": "Receive Message",
            "description": "Receive message from queue"
          }
        },
        {
          "when": "$.operation == 'peek'",
          "updates": {
            "title": "Queue Peek",
            "subtitle": "Peek Message",
            "description": "Peek at message without removing"
          }
        },
        {
          "when": "$.operation == 'ack'",
          "updates": {
            "title": "Queue ACK",
            "subtitle": "Acknowledge",
            "description": "Acknowledge message processing"
          }
        },
        {
          "when": "$.operation == 'nack'",
          "updates": {
            "title": "Queue NACK",
            "subtitle": "Not Acknowledge",
            "description": "Reject message processing"
          }
        }
      ]
    }
  },
  {
    "id": "tpl_state_store",
    "type": "storage",
    "title": "State Store",
    "subtitle": "Persistent State Management",
    "category": "storage-memory",
    "subcategory": "sessions",
    "description": "Store and retrieve persistent state across workflow executions",
    "icon": "hard-drive",
    "variant": "gray-700",
    "shape": "rectangle",
    "size": "medium",
    "ports": [
      {
        "id": "key-in",
        "label": "Key",
        "type": "input",
        "position": "left"
      },
      {
        "id": "value-in",
        "label": "Value",
        "type": "input",
        "position": "top"
      },
      {
        "id": "stored-out",
        "label": "Stored Value",
        "type": "output",
        "position": "right"
      },
      {
        "id": "success-out",
        "label": "Success",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "operation": {
        "type": "select",
        "options": [
          "get",
          "set",
          "delete",
          "exists"
        ],
        "defaultValue": "get"
      },
      "namespace": {
        "type": "text",
        "placeholder": "workflow_state"
      },
      "ttl": {
        "type": "number",
        "placeholder": 3600,
        "description": "Time to live in seconds (0 = no expiry)"
      },
      "storageType": {
        "type": "select",
        "options": [
          "memory",
          "redis",
          "file"
        ],
        "defaultValue": "memory"
      }
    },
    "tags": [
      "storage",
      "state",
      "memory",
      "persistence"
    ],
    "version": "1.0.0",
    "isActive": true,
    "propertyRules": {
      "triggers": [
        "operation"
      ],
      "rules": [
        {
          "when": "$.operation == 'get'",
          "updates": {
            "title": "State Get",
            "subtitle": "Retrieve State",
            "description": "Get stored state value by key"
          }
        },
        {
          "when": "$.operation == 'set'",
          "updates": {
            "title": "State Set",
            "subtitle": "Store State",
            "description": "Store state value with key"
          }
        },
        {
          "when": "$.operation == 'delete'",
          "updates": {
            "title": "State Delete",
            "subtitle": "Remove State",
            "description": "Delete stored state by key"
          }
        },
        {
          "when": "$.operation == 'exists'",
          "updates": {
            "title": "State Exists",
            "subtitle": "Check State",
            "description": "Check if state key exists"
          }
        }
      ]
    }
  },
  {
    "id": "tpl_variable_lookup",
    "type": "variable",
    "title": "Variable Lookup",
    "subtitle": "Dynamic Variable Access",
    "category": "storage-memory",
    "subcategory": "variables",
    "description": "Look up and resolve variables from different scopes",
    "icon": "search",
    "variant": "gray-600",
    "shape": "circle",
    "size": "small",
    "ports": [
      {
        "id": "name-in",
        "label": "Variable Name",
        "type": "input",
        "position": "left"
      },
      {
        "id": "value-out",
        "label": "Value",
        "type": "output",
        "position": "right"
      },
      {
        "id": "found-out",
        "label": "Found",
        "type": "output",
        "position": "bottom"
      }
    ],
    "properties": {
      "scope": {
        "type": "select",
        "options": [
          "workflow",
          "global",
          "environment",
          "runtime"
        ],
        "defaultValue": "workflow"
      },
      "defaultValue": {
        "type": "text",
        "placeholder": "Default if not found"
      },
      "cacheResult": {
        "type": "boolean",
        "defaultValue": true
      },
      "throwOnMissing": {
        "type": "boolean",
        "defaultValue": false
      }
    },
    "tags": [
      "variable",
      "lookup",
      "scope",
      "dynamic"
    ],
    "version": "1.0.0",
    "isActive": true
  }
]
