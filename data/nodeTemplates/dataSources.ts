import { NodeTemplate } from './types'

/**
 * Data Sources Node Templates
 */
export const dataSourcesTemplates: NodeTemplate[] = [
  {
    id: 'tpl_github_api',
    type: 'api',
    title: 'GitHub API',
    subtitle: 'GitHub Operations',
    category: 'data-sources',
    subcategory: 'apis',
    description: 'Interact with GitHub repositories and data',
    icon: 'github',
    variant: 'gray-900',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'params-in',
        label: 'Parameters',
        type: 'input',
        position: 'left',
        description: 'API parameters including headers, query params, and request configuration',
      },
      {
        id: 'data-out',
        label: 'Data',
        type: 'output',
        position: 'right',
        description: 'Processed or retrieved data from the operation',
      },
      {
        id: 'rate-out',
        label: 'Rate Limit',
        type: 'output',
        position: 'bottom',
        description: 'API rate limit information including remaining requests and reset time',
      },
    ],
    properties: {
      operation: {
        type: 'select',
        options: ['get-repo', 'list-issues', 'create-issue', 'get-pr', 'list-commits'],
        defaultValue: 'get-repo',
      },
      owner: {
        type: 'text',
        required: true,
        placeholder: 'octocat',
      },
      repo: {
        type: 'text',
        required: true,
        placeholder: 'hello-world',
      },
      perPage: {
        type: 'number',
        defaultValue: 30,
        max: 100,
      },
    },
    requiredEnvVars: ['GITHUB_TOKEN'],
    tags: ['github', 'webhook', 'git', 'api', 'repository'],
    version: '1.0.0',
    isActive: true,
    propertyRules: {
      triggers: ['operation'],
      rules: [
        {
          when: "$.operation == 'get-repo'",
          updates: {
            title: 'GitHub Repo',
            subtitle: 'Repository Info',
            description: 'Get repository information',
          },
        },
        {
          when: "$.operation == 'list-issues'",
          updates: {
            title: 'GitHub Issues',
            subtitle: 'List Issues',
            description: 'List repository issues',
          },
        },
        {
          when: "$.operation == 'create-issue'",
          updates: {
            title: 'GitHub Create Issue',
            subtitle: 'New Issue',
            description: 'Create new repository issue',
          },
        },
        {
          when: "$.operation == 'get-pr'",
          updates: {
            title: 'GitHub PR',
            subtitle: 'Pull Request',
            description: 'Get pull request information',
          },
        },
        {
          when: "$.operation == 'list-commits'",
          updates: {
            title: 'GitHub Commits',
            subtitle: 'Commit History',
            description: 'List repository commits',
          },
        },
      ],
    },
  },
  {
    id: 'tpl_hubspot',
    type: 'crm',
    title: 'HubSpot',
    subtitle: 'Marketing & Sales',
    category: 'data-sources',
    subcategory: 'apis',
    description: 'Interact with HubSpot CRM and Marketing Hub',
    icon: 'hubspot',
    variant: 'orange-600',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'data-in',
        label: 'Data',
        type: 'input',
        position: 'left',
        description: 'Input data to be processed, transformed, or stored',
      },
      {
        id: 'filter-in',
        label: 'Filters',
        type: 'input',
        position: 'top',
        description: 'Filter conditions to apply to the data or operation',
      },
      {
        id: 'results-out',
        label: 'Results',
        type: 'output',
        position: 'right',
        description: 'Collection of results from the operation',
      },
      {
        id: 'metrics-out',
        label: 'Metrics',
        type: 'output',
        position: 'bottom',
        description: 'Performance metrics and statistics about the operation',
      },
    ],
    properties: {
      objectType: {
        type: 'select',
        options: ['contacts', 'companies', 'deals', 'tickets'],
        defaultValue: 'contacts',
      },
      operation: {
        type: 'select',
        options: ['get', 'create', 'update', 'search', 'batch'],
        defaultValue: 'get',
      },
      properties: {
        type: 'textarea',
        placeholder: 'firstname,lastname,email',
      },
      associations: {
        type: 'boolean',
        defaultValue: false,
      },
    },
    requiredEnvVars: ['HUBSPOT_API_KEY'],
    tags: ['hubspot', 'crm', 'marketing', 'sales'],
    version: '1.0.0',
    isActive: true,
    propertyRules: {
      triggers: ['operation', 'objectType'],
      rules: [
        {
          when: "$.operation == 'get'",
          updates: {
            subtitle: 'Get Records',
          },
        },
        {
          when: "$.operation == 'create'",
          updates: {
            subtitle: 'Create Records',
          },
        },
        {
          when: "$.operation == 'update'",
          updates: {
            subtitle: 'Update Records',
          },
        },
        {
          when: "$.operation == 'search'",
          updates: {
            subtitle: 'Search Records',
          },
        },
        {
          when: "$.operation == 'batch'",
          updates: {
            subtitle: 'Batch Operations',
          },
        },
      ],
    },
  },
  {
    id: 'tpl_salesforce',
    type: 'crm',
    title: 'Salesforce',
    subtitle: 'CRM Operations',
    category: 'data-sources',
    subcategory: 'apis',
    description: 'Interact with Salesforce CRM',
    icon: 'salesforce',
    variant: 'blue-600',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'query-in',
        label: 'Query/Data',
        type: 'input',
        position: 'left',
        description: 'Query parameters, filters, or search criteria',
      },
      {
        id: 'records-out',
        label: 'Records',
        type: 'output',
        position: 'right',
        description: 'Retrieved records from the data source',
      },
      {
        id: 'status-out',
        label: 'Status',
        type: 'output',
        position: 'bottom',
        description: 'Operation status information including success/failure and metadata',
      },
    ],
    properties: {
      operation: {
        type: 'select',
        options: ['query', 'insert', 'update', 'delete', 'upsert'],
        defaultValue: 'query',
      },
      object: {
        type: 'select',
        options: ['Account', 'Contact', 'Lead', 'Opportunity', 'Case'],
        defaultValue: 'Account',
      },
      soqlQuery: {
        type: 'textarea',
        placeholder: 'SELECT Id, Name FROM Account LIMIT 10',
      },
      externalIdField: {
        type: 'text',
        placeholder: 'External_Id__c',
      },
    },
    requiredEnvVars: [
      'SALESFORCE_CLIENT_ID',
      'SALESFORCE_CLIENT_SECRET',
      'SALESFORCE_USERNAME',
      'SALESFORCE_PASSWORD',
    ],
    tags: ['salesforce', 'crm', 'sales', 'enterprise'],
    version: '1.0.0',
    isActive: true,
    propertyRules: {
      triggers: ['operation'],
      rules: [
        {
          when: "$.operation == 'query'",
          updates: {
            title: 'SOQL Query',
            subtitle: 'Query Records',
            description: 'Execute SOQL queries on Salesforce',
          },
        },
        {
          when: "$.operation == 'insert'",
          updates: {
            title: 'SF Insert',
            subtitle: 'Create Records',
            description: 'Insert new records into Salesforce',
          },
        },
        {
          when: "$.operation == 'update'",
          updates: {
            title: 'SF Update',
            subtitle: 'Update Records',
            description: 'Update existing Salesforce records',
          },
        },
        {
          when: "$.operation == 'delete'",
          updates: {
            title: 'SF Delete',
            subtitle: 'Remove Records',
            description: 'Delete records from Salesforce',
          },
        },
        {
          when: "$.operation == 'upsert'",
          updates: {
            title: 'SF Upsert',
            subtitle: 'Insert or Update',
            description: 'Insert new or update existing records',
          },
        },
      ],
    },
  },
  {
    id: 'tpl_mongo_get_collection',
    type: 'mongo-operation',
    title: 'Get Collection',
    subtitle: 'MongoDB Collection Operations',
    category: 'data-sources',
    subcategory: 'databases',
    description: 'Retrieve documents from MongoDB collection',
    icon: 'mongodb',
    variant: 'green-600',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'pool-id',
        label: 'Pool ID',
        type: 'input',
        position: 'left',
        description: 'MongoDB connection pool identifier for database operations',
      },
      {
        id: 'query-in',
        label: 'Query',
        type: 'input',
        position: 'top',
        description: 'Query parameters, filters, or search criteria',
      },
      {
        id: 'docs-out',
        label: 'Documents',
        type: 'output',
        position: 'right',
        description: 'Retrieved documents from database query',
      },
      {
        id: 'count-out',
        label: 'Count',
        type: 'output',
        position: 'bottom',
        description: 'Count of processed or retrieved items',
      },
    ],
    properties: {
      collection: {
        type: 'text',
        required: true,
        placeholder: 'users',
      },
      operation: {
        type: 'select',
        options: ['find', 'findOne', 'aggregate'],
        defaultValue: 'find',
      },
      limit: {
        type: 'number',
        defaultValue: 100,
      },
      sort: {
        type: 'textarea',
        placeholder: '{ "createdAt": -1 }',
      },
      projection: {
        type: 'textarea',
        placeholder: '{ "password": 0 }',
      },
    },
    tags: ['mongodb', 'collection', 'query'],
    version: '1.0.0',
    isActive: true,
    propertyRules: {
      triggers: ['operation'],
      rules: [
        {
          when: "$.operation == 'find'",
          updates: {
            title: 'MongoDB Find',
            subtitle: 'Query Documents',
            description: 'Find multiple documents matching query',
          },
        },
        {
          when: "$.operation == 'findOne'",
          updates: {
            title: 'MongoDB Find One',
            subtitle: 'Single Document',
            description: 'Find first document matching query',
          },
        },
        {
          when: "$.operation == 'aggregate'",
          updates: {
            title: 'MongoDB Aggregate',
            subtitle: 'Pipeline Processing',
            description: 'Run aggregation pipeline on collection',
          },
        },
      ],
    },
  },
  {
    id: 'tpl_mongo_write_collection',
    type: 'mongo-operation',
    title: 'Write Collection',
    subtitle: 'MongoDB Write Operations',
    category: 'data-sources',
    subcategory: 'databases',
    description: 'Insert, update, or upsert documents in MongoDB collection',
    icon: 'mongodb',
    variant: 'green-600',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'pool-id',
        label: 'Pool ID',
        type: 'input',
        position: 'left',
        description: 'MongoDB connection pool identifier for database operations',
      },
      {
        id: 'data-in',
        label: 'Data',
        type: 'input',
        position: 'top',
        description: 'Input data to be processed, transformed, or stored',
      },
      {
        id: 'filter-in',
        label: 'Filter',
        type: 'input',
        position: 'left',
        description: 'Filter conditions to apply to the data or operation',
      },
      {
        id: 'result-out',
        label: 'Result',
        type: 'output',
        position: 'right',
        description: 'Operation result including success/failure status and data',
      },
      {
        id: 'status-out',
        label: 'Status',
        type: 'output',
        position: 'bottom',
        description: 'Operation status information including success/failure and metadata',
      },
    ],
    properties: {
      collection: {
        type: 'text',
        required: true,
        placeholder: 'users',
        description: 'Name of the MongoDB collection',
      },
      operation: {
        type: 'select',
        options: ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'upsertOne', 'replaceOne', 'deleteOne', 'deleteMany'],
        defaultValue: 'insertOne',
        description: 'Type of write operation to perform',
      },
      upsert: {
        type: 'boolean',
        defaultValue: false,
        description: 'Create a new document if no match is found (for update operations)',
      },
      ordered: {
        type: 'boolean',
        defaultValue: true,
        description: 'For insertMany: stop on first error if true',
      },
      returnDocument: {
        type: 'select',
        options: ['before', 'after'],
        defaultValue: 'after',
        description: 'For findAndModify operations: return document before or after modification',
      },
      writeConcern: {
        type: 'select',
        options: ['majority', '1', '0'],
        defaultValue: 'majority',
        description: 'Write concern level for the operation',
      },
    },
    tags: ['mongodb', 'collection', 'insert', 'update', 'upsert', 'delete', 'write'],
    version: '1.0.0',
    isActive: true,
    propertyRules: {
      triggers: ['operation'],
      rules: [
        {
          when: "$.operation == 'insertOne'",
          updates: {
            title: 'MongoDB Insert One',
            subtitle: 'Insert Document',
            description: 'Insert a single document into MongoDB collection',
          },
        },
        {
          when: "$.operation == 'insertMany'",
          updates: {
            title: 'MongoDB Insert Many',
            subtitle: 'Bulk Insert',
            description: 'Insert multiple documents into MongoDB collection',
          },
        },
        {
          when: "$.operation == 'updateOne'",
          updates: {
            title: 'MongoDB Update One',
            subtitle: 'Update Document',
            description: 'Update first matching document in MongoDB collection',
          },
        },
        {
          when: "$.operation == 'updateMany'",
          updates: {
            title: 'MongoDB Update Many',
            subtitle: 'Bulk Update',
            description: 'Update all matching documents in MongoDB collection',
          },
        },
        {
          when: "$.operation == 'upsertOne'",
          updates: {
            title: 'MongoDB Upsert',
            subtitle: 'Insert or Update',
            description: 'Update existing or insert new document in MongoDB collection',
          },
        },
        {
          when: "$.operation == 'replaceOne'",
          updates: {
            title: 'MongoDB Replace',
            subtitle: 'Replace Document',
            description: 'Replace entire document in MongoDB collection',
          },
        },
        {
          when: "$.operation == 'deleteOne'",
          updates: {
            title: 'MongoDB Delete One',
            subtitle: 'Remove Document',
            description: 'Delete first matching document from MongoDB collection',
          },
        },
        {
          when: "$.operation == 'deleteMany'",
          updates: {
            title: 'MongoDB Delete Many',
            subtitle: 'Bulk Delete',
            description: 'Delete all matching documents from MongoDB collection',
          },
        },
      ],
    },
  },
  {
    id: 'tpl_mongodb_pool_manager',
    type: 'database',
    title: 'MongoDB',
    subtitle: 'Database Connection Pool',
    category: 'data-sources',
    subcategory: 'databases',
    description: 'Connect to MongoDB database and return connection pool ID',
    icon: 'mongodb',
    variant: 'green-600',
    shape: 'circle',
    size: 'medium',
    ports: [
      {
        id: 'pool-id',
        label: 'Pool ID',
        type: 'output',
        position: 'right',
        description: 'MongoDB connection pool identifier that can be used by collection operation nodes',
      },
      {
        id: 'status-out',
        label: 'Status',
        type: 'output',
        position: 'bottom',
        description: 'Operation status information including success/failure and metadata',
      },
    ],
    properties: {
      host: {
        type: 'text',
        required: true,
        placeholder: 'localhost',
      },
      port: {
        type: 'number',
        defaultValue: 27017,
      },
      database: {
        type: 'text',
        required: true,
        placeholder: 'myapp',
      },
      maxConnections: {
        type: 'number',
        defaultValue: 10,
      },
      replicaSet: {
        type: 'text',
        placeholder: 'rs0',
      },
    },
    requiredEnvVars: ['MONGODB_URL', 'MONGODB_PASSWORD', 'MONGODB_USER'],
    tags: ['database', 'nosql', 'mongodb', 'pool'],
    version: '1.0.0',
    isActive: true,
  },
  {
    id: 'tpl_mysql',
    type: 'database',
    title: 'MySQL',
    subtitle: 'Database Connection Pool',
    category: 'data-sources',
    subcategory: 'databases',
    description: 'Connect to MySQL database and return connection pool ID',
    icon: 'mysql',
    variant: 'gray-700',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'pool-id',
        label: 'Pool ID',
        type: 'output',
        position: 'right',
        description: 'MySQL connection pool identifier for SQL query execution and database operations',
      },
      {
        id: 'status-out',
        label: 'Status',
        type: 'output',
        position: 'bottom',
        description: 'Operation status information including success/failure and metadata',
      },
    ],
    properties: {
      host: {
        type: 'text',
        required: true,
        placeholder: 'localhost',
      },
      port: {
        type: 'number',
        defaultValue: 3306,
      },
      database: {
        type: 'text',
        required: true,
        placeholder: 'myapp',
      },
      maxConnections: {
        type: 'number',
        defaultValue: 10,
      },
      connectionTimeout: {
        type: 'number',
        defaultValue: 30000,
      },
    },
    requiredEnvVars: ['MYSQL_URL', 'MYSQL_PASSWORD', 'MYSQL_USER'],
    tags: ['database', 'sql', 'mysql', 'pool'],
    version: '1.0.0',
    isActive: true,
  },
  {
    id: 'tpl_postgresql',
    type: 'database',
    title: 'PostgreSQL',
    subtitle: 'Database Connection Pool',
    category: 'data-sources',
    subcategory: 'databases',
    description: 'Connect to PostgreSQL database and return connection pool ID',
    icon: 'postgresql',
    variant: 'black',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'pool-id',
        label: 'Pool ID',
        type: 'output',
        position: 'right',
        description: 'PostgreSQL connection pool identifier for SQL queries, transactions, and database operations',
      },
      {
        id: 'status-out',
        label: 'Status',
        type: 'output',
        position: 'bottom',
        description: 'Operation status information including success/failure and metadata',
      },
    ],
    properties: {
      host: {
        type: 'text',
        required: true,
        placeholder: 'localhost',
      },
      port: {
        type: 'number',
        defaultValue: 5432,
      },
      database: {
        type: 'text',
        required: true,
        placeholder: 'myapp',
      },
      maxConnections: {
        type: 'number',
        defaultValue: 10,
      },
      connectionTimeout: {
        type: 'number',
        defaultValue: 30000,
      },
    },
    requiredEnvVars: ['DATABASE_URL', 'DB_PASSWORD', 'DB_USER'],
    tags: ['database', 'sql', 'postgresql', 'pool'],
    version: '1.0.0',
    isActive: true,
  },
  {
    id: 'tpl_s3_storage',
    type: 'storage',
    title: 'AWS S3',
    subtitle: 'Object Storage',
    category: 'data-sources',
    subcategory: 'files',
    description: 'Store and retrieve files from AWS S3',
    icon: 'aws',
    variant: 'orange-600',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'file-in',
        label: 'File',
        type: 'input',
        position: 'left',
        description: 'File path or file content for processing',
      },
      {
        id: 'key-in',
        label: 'Key',
        type: 'input',
        position: 'top',
        description: 'S3 object key (path) for file storage operations',
      },
      {
        id: 'url-out',
        label: 'URL',
        type: 'output',
        position: 'right',
        description: 'Public or signed URL for accessing the S3 object',
      },
      {
        id: 'metadata-out',
        label: 'Metadata',
        type: 'output',
        position: 'bottom',
        description: 'S3 object metadata including size, content type, and last modified date',
      },
    ],
    properties: {
      bucket: {
        type: 'text',
        required: true,
        placeholder: 'my-bucket',
      },
      operation: {
        type: 'select',
        options: ['upload', 'download', 'delete', 'list'],
        defaultValue: 'upload',
      },
      acl: {
        type: 'select',
        options: ['private', 'public-read', 'public-read-write'],
        defaultValue: 'private',
      },
      storageClass: {
        type: 'select',
        options: ['STANDARD', 'GLACIER', 'DEEP_ARCHIVE'],
        defaultValue: 'STANDARD',
      },
    },
    requiredEnvVars: ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_REGION'],
    tags: ['aws', 's3', 'storage', 'cloud'],
    version: '1.0.0',
    isActive: true,
    propertyRules: {
      triggers: ['operation'],
      rules: [
        {
          when: "$.operation == 'upload'",
          updates: {
            title: 'S3 Upload',
            subtitle: 'Upload File',
            description: 'Upload file to S3 bucket',
          },
        },
        {
          when: "$.operation == 'download'",
          updates: {
            title: 'S3 Download',
            subtitle: 'Download File',
            description: 'Download file from S3 bucket',
          },
        },
        {
          when: "$.operation == 'delete'",
          updates: {
            title: 'S3 Delete',
            subtitle: 'Delete Object',
            description: 'Delete object from S3 bucket',
          },
        },
        {
          when: "$.operation == 'list'",
          updates: {
            title: 'S3 List',
            subtitle: 'List Objects',
            description: 'List objects in S3 bucket',
          },
        },
      ],
    },
  },
  {
    id: 'tpl_excel_reader',
    type: 'spreadsheet',
    title: 'Excel Reader',
    subtitle: 'Read Excel Files',
    category: 'data-sources',
    subcategory: 'files',
    description: 'Read data from Excel files',
    icon: 'excel',
    variant: 'green-600',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'file-in',
        label: 'File Path',
        type: 'input',
        position: 'left',
        description: 'File path or file content for processing',
      },
      {
        id: 'sheet-in',
        label: 'Sheet Name',
        type: 'input',
        position: 'top',
        description: 'Excel worksheet name to read data from',
      },
      {
        id: 'data-out',
        label: 'Data',
        type: 'output',
        position: 'right',
        description: 'Processed or retrieved data from the operation',
      },
      {
        id: 'sheets-out',
        label: 'Sheet Names',
        type: 'output',
        position: 'bottom',
        description: 'List of all worksheet names available in the Excel file',
      },
    ],
    properties: {
      sheetName: {
        type: 'text',
        placeholder: 'Sheet1',
      },
      range: {
        type: 'text',
        placeholder: 'A1:Z1000',
      },
      hasHeaders: {
        type: 'boolean',
        defaultValue: true,
      },
      dateFormat: {
        type: 'text',
        defaultValue: 'YYYY-MM-DD',
      },
    },
    tags: ['excel', 'microsoft', 'spreadsheet', 'xlsx'],
    version: '1.0.0',
    isActive: true,
  },
  {
    id: 'tpl_google_sheets',
    type: 'spreadsheet',
    title: 'Google Sheets',
    subtitle: 'Read/Write Spreadsheets',
    category: 'data-sources',
    subcategory: 'files',
    description: 'Interact with Google Sheets',
    icon: 'google-sheets',
    variant: 'green-600',
    shape: 'rectangle',
    size: 'medium',
    ports: [
      {
        id: 'data-in',
        label: 'Data',
        type: 'input',
        position: 'left',
        description: 'Input data to be processed, transformed, or stored',
      },
      {
        id: 'range-in',
        label: 'Range',
        type: 'input',
        position: 'top',
        description: 'Google Sheets range notation (e.g., A1:Z100) for data operations',
      },
      {
        id: 'values-out',
        label: 'Values',
        type: 'output',
        position: 'right',
        description: 'Cell values retrieved from or written to Google Sheets',
      },
      {
        id: 'metadata-out',
        label: 'Metadata',
        type: 'output',
        position: 'bottom',
        description: 'Google Sheets metadata including sheet properties and update timestamp',
      },
    ],
    properties: {
      spreadsheetId: {
        type: 'text',
        required: true,
        placeholder: 'Spreadsheet ID',
      },
      operation: {
        type: 'select',
        options: ['read', 'write', 'append', 'clear'],
        defaultValue: 'read',
      },
      range: {
        type: 'text',
        defaultValue: 'A1:Z1000',
      },
      valueInputOption: {
        type: 'select',
        options: ['RAW', 'USER_ENTERED'],
        defaultValue: 'USER_ENTERED',
      },
    },
    requiredEnvVars: ['GOOGLE_SHEETS_API_KEY', 'GOOGLE_SHEETS_CLIENT_EMAIL'],
    tags: ['google', 'sheets', 'spreadsheet', 'data'],
    version: '1.0.0',
    isActive: true,
    propertyRules: {
      triggers: ['operation'],
      rules: [
        {
          when: "$.operation == 'read'",
          updates: {
            title: 'Sheets Read',
            subtitle: 'Read Data',
            description: 'Read data from Google Sheets',
          },
        },
        {
          when: "$.operation == 'write'",
          updates: {
            title: 'Sheets Write',
            subtitle: 'Write Data',
            description: 'Write data to Google Sheets',
          },
        },
        {
          when: "$.operation == 'append'",
          updates: {
            title: 'Sheets Append',
            subtitle: 'Add Rows',
            description: 'Append new rows to Google Sheets',
          },
        },
        {
          when: "$.operation == 'clear'",
          updates: {
            title: 'Sheets Clear',
            subtitle: 'Clear Data',
            description: 'Clear data from Google Sheets',
          },
        },
      ],
    },
  },
]
