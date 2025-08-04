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
      },
      {
        id: 'data-out',
        label: 'Data',
        type: 'output',
        position: 'right',
      },
      {
        id: 'rate-out',
        label: 'Rate Limit',
        type: 'output',
        position: 'bottom',
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
    tags: ['github', 'git', 'api', 'repository'],
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
      },
      {
        id: 'filter-in',
        label: 'Filters',
        type: 'input',
        position: 'top',
      },
      {
        id: 'results-out',
        label: 'Results',
        type: 'output',
        position: 'right',
      },
      {
        id: 'metrics-out',
        label: 'Metrics',
        type: 'output',
        position: 'bottom',
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
      },
      {
        id: 'records-out',
        label: 'Records',
        type: 'output',
        position: 'right',
      },
      {
        id: 'status-out',
        label: 'Status',
        type: 'output',
        position: 'bottom',
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
        id: 'pool-in',
        label: 'Pool ID',
        type: 'input',
        position: 'left',
      },
      {
        id: 'query-in',
        label: 'Query',
        type: 'input',
        position: 'top',
      },
      {
        id: 'docs-out',
        label: 'Documents',
        type: 'output',
        position: 'right',
      },
      {
        id: 'count-out',
        label: 'Count',
        type: 'output',
        position: 'bottom',
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
    id: 'tpl_mongodb',
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
        id: 'pool-out',
        label: 'Pool ID',
        type: 'output',
        position: 'right',
      },
      {
        id: 'status-out',
        label: 'Status',
        type: 'output',
        position: 'bottom',
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
        id: 'pool-out',
        label: 'Pool ID',
        type: 'output',
        position: 'right',
      },
      {
        id: 'status-out',
        label: 'Status',
        type: 'output',
        position: 'bottom',
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
        id: 'pool-out',
        label: 'Pool ID',
        type: 'output',
        position: 'right',
      },
      {
        id: 'status-out',
        label: 'Status',
        type: 'output',
        position: 'bottom',
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
      },
      {
        id: 'key-in',
        label: 'Key',
        type: 'input',
        position: 'top',
      },
      {
        id: 'url-out',
        label: 'URL',
        type: 'output',
        position: 'right',
      },
      {
        id: 'metadata-out',
        label: 'Metadata',
        type: 'output',
        position: 'bottom',
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
      },
      {
        id: 'sheet-in',
        label: 'Sheet Name',
        type: 'input',
        position: 'top',
      },
      {
        id: 'data-out',
        label: 'Data',
        type: 'output',
        position: 'right',
      },
      {
        id: 'sheets-out',
        label: 'Sheet Names',
        type: 'output',
        position: 'bottom',
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
      },
      {
        id: 'range-in',
        label: 'Range',
        type: 'input',
        position: 'top',
      },
      {
        id: 'values-out',
        label: 'Values',
        type: 'output',
        position: 'right',
      },
      {
        id: 'metadata-out',
        label: 'Metadata',
        type: 'output',
        position: 'bottom',
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
