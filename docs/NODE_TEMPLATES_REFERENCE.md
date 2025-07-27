# Node Templates Reference

This document provides comprehensive documentation for all node templates in the workflow system, including their properties and visual property rules that enable dynamic node appearance based on configuration.

## Table of Contents

1. [AI Models](#ai-models)
2. [Communication](#communication)
3. [Data Processing](#data-processing)
4. [Data Sources](#data-sources)
5. [Logic Control](#logic-control)
6. [Scripting](#scripting)
7. [Server Nodes](#server-nodes)
8. [Storage & Memory](#storage--memory)
9. [Tools & Utilities](#tools--utilities)

---

## AI Models

### LangChain Agent (`tpl_langchain_agent`)
**Type:** `ai-agent` | **Category:** `ai-models` | **Subcategory:** `agent-tools`

AI agent with access to multiple tools for complex reasoning and action execution.

#### Properties
- **agentType** (select): Agent reasoning type
  - Options: `zero-shot-react`, `conversational`, `plan-and-execute`
  - Default: `zero-shot-react`
- **enabledTools** (multi-select): Available tools for the agent
  - Options: `search`, `calculator`, `wikipedia`, `weather`, `news`
  - Default: `["search", "calculator"]`
- **maxIterations** (number): Safety limit for iterations (1-20)
  - Default: `5`
- **memory** (boolean): Enable conversation memory
  - Default: `true`

#### Property Rules
**Triggers:** `agentType`

| Agent Type | Title | Subtitle | Description |
|------------|-------|----------|-------------|
| `zero-shot-react` | ReAct Agent | Reasoning + Acting | Agent that reasons about actions and observes results |
| `conversational` | Conversational Agent | Memory-Aware | Agent that maintains conversation context |
| `plan-and-execute` | Planning Agent | Strategic Execution | Agent that plans tasks before execution |

---

### Claude (`tpl_claude`)
**Type:** `ai-model` | **Category:** `ai-models` | **Subcategory:** `llm`

Anthropic Claude AI assistant for text generation and analysis.

#### Properties
- **model** (select): Claude model version
  - Options: `claude-3-5-sonnet`, `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`
  - Default: `claude-3-5-sonnet`
- **maxTokens** (number): Maximum response tokens (1-4000)
  - Default: `1000`
- **temperature** (number): Response creativity (0-1, step 0.1)
  - Default: `0.7`
- **systemPrompt** (textarea): Define AI assistant behavior
- **responseRules** (rules): Process and route AI responses based on content analysis

#### Property Rules
**Triggers:** `model`

| Model | Title | Subtitle | Description |
|-------|-------|----------|-------------|
| `claude-3-5-sonnet` | Claude 3.5 Sonnet | Most Intelligent | Most capable Claude model with advanced reasoning |
| `claude-3-opus` | Claude 3 Opus | Powerful & Complex | Excellent at complex tasks requiring deep understanding |
| `claude-3-sonnet` | Claude 3 Sonnet | Balanced Performance | Good balance of capability and speed |
| `claude-3-haiku` | Claude 3 Haiku | Fast & Light | Fastest Claude model for simple tasks |

---

### OpenAI GPT (`tpl_openai_gpt`)
**Type:** `ai-model` | **Category:** `ai-models` | **Subcategory:** `llm`

OpenAI GPT models for text generation and analysis.

#### Properties
- **model** (select): GPT model version
  - Options: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`
  - Default: `gpt-4`
- **maxTokens** (number): Maximum response tokens (1-4000)
  - Default: `1000`
- **temperature** (number): Response creativity (0-2, step 0.1)
  - Default: `0.7`
- **topP** (number): Nucleus sampling (0-1, step 0.1)
  - Default: `1`
- **systemPrompt** (textarea): System message to guide model behavior

#### Property Rules
**Triggers:** `model`

| Model | Title | Subtitle | Description |
|-------|-------|----------|-------------|
| `gpt-4` | GPT-4 | Most Capable | OpenAI most advanced language model |
| `gpt-4-turbo` | GPT-4 Turbo | Fast & Advanced | Faster GPT-4 with larger context window |
| `gpt-3.5-turbo` | GPT-3.5 Turbo | Fast & Affordable | Cost-effective model for simpler tasks |

---

### Gemini (`tpl_gemini`)
**Type:** `ai-model` | **Category:** `ai-models` | **Subcategory:** `llm`

Google Gemini for multimodal AI tasks.

#### Properties
- **model** (select): Gemini model type
  - Options: `gemini-pro`, `gemini-pro-vision`
  - Default: `gemini-pro`
- **maxTokens** (number): Maximum response tokens (1-8192)
  - Default: `1000`
- **temperature** (number): Response creativity (0-1, step 0.1)
  - Default: `0.7`
- **safetySettings** (select): Content filtering level
  - Options: `block_none`, `block_few`, `block_some`, `block_most`
  - Default: `block_few`

#### Property Rules
**Triggers:** `model`

| Model | Title | Subtitle | Description |
|-------|-------|----------|-------------|
| `gemini-pro` | Gemini Pro | Text Generation | Google's advanced text generation model |
| `gemini-pro-vision` | Gemini Pro Vision | Multimodal AI | Process both text and images |

---

### OpenRouter (`tpl_openrouter`)
**Type:** `ai-model` | **Category:** `ai-models` | **Subcategory:** `llm`

Access multiple AI models through OpenRouter unified API.

#### Properties
- **provider** (select): AI model provider
  - Options: `openai`, `anthropic`, `google`, `meta`, `mistral`, `cohere`
  - Default: `openai`
- **model** (select): Specific model (options vary by provider)
  - Default: `gpt-4-turbo`
- **maxTokens** (number): Maximum response tokens (1-8192)
  - Default: `1000`
- **temperature** (number): Response creativity (0-1, step 0.1)
  - Default: `0.7`
- **stream** (boolean): Stream the response
  - Default: `false`

#### Property Rules
**Triggers:** `provider`, `model`

**Compound Rules (provider && model):**
- `openai && gpt-4-turbo` → "OpenRouter GPT-4" / "GPT-4 Turbo" (green-600, openai icon)
- `anthropic && claude-3-opus` → "OpenRouter Claude" / "Claude 3 Opus" (black, anthropic icon)
- `google && gemini-pro` → "OpenRouter Gemini" / "Gemini Pro" (blue-600, gemini icon)
- *...and many more combinations*

**Simple Rules (provider only):**
- `openai` → green-600 variant, openai icon
- `anthropic` → black variant, anthropic icon
- `google` → blue-600 variant, gemini icon
- `meta` → blue-500 variant, meta icon
- `mistral` → orange-600 variant, mistral icon
- `cohere` → red-600 variant, cohere icon

---

### HuggingFace (`tpl_huggingface`)
**Type:** `ai-model` | **Category:** `ai-models` | **Subcategory:** `llm`

Access thousands of open-source models via HuggingFace Inference API.

#### Properties
- **taskType** (select): Type of AI task to perform
  - Options: `text-generation`, `text-classification`, `translation`, `summarization`, `question-answering`, `image-classification`, `object-detection`, `text-to-image`
  - Default: `text-generation`
- **model** (text): HuggingFace model identifier
- **useGPU** (boolean): Use GPU acceleration (requires Pro account)
  - Default: `false`
- **waitForModel** (boolean): Wait for model to load if not ready
  - Default: `true`
- **maxLength** (number): Maximum output length (1-2048)
  - Default: `100`

#### Property Rules
**Triggers:** `taskType`

| Task Type | Title | Subtitle | Icon | Variant | Description |
|-----------|-------|----------|------|---------|-------------|
| `text-generation` | HF Text Generation | Generate Text | file-text | yellow-600 | Generate text using language models |
| `text-classification` | HF Classification | Classify Text | tag | green-600 | Classify text into categories |
| `translation` | HF Translation | Translate Text | globe | blue-600 | Translate text between languages |
| `summarization` | HF Summarization | Summarize Text | file-minus | purple-600 | Generate text summaries |
| `question-answering` | HF Q&A | Answer Questions | help-circle | indigo-600 | Answer questions based on context |
| `image-classification` | HF Image Classifier | Classify Images | image | pink-600 | Classify images into categories |
| `object-detection` | HF Object Detection | Detect Objects | scan | red-600 | Detect objects in images |
| `text-to-image` | HF Image Generation | Generate Images | image-plus | orange-600 | Generate images from text descriptions |

---

## Communication

### Email Sender (`tpl_email_sender`)
**Type:** `communication` | **Category:** `communication` | **Subcategory:** `email`

Send emails via SMTP or email service providers.

#### Properties
- **provider** (select): Email service provider
  - Options: `smtp`, `sendgrid`, `mailgun`, `ses`
  - Default: `smtp`
- **subject** (text, required): Email subject line
- **fromEmail** (text, required): Sender email address
- **fromName** (text): Sender display name
- **templateEngine** (select): Email template engine
  - Options: `none`, `handlebars`, `mustache`
  - Default: `none`

#### Property Rules
**Triggers:** `provider`, `templateEngine`

| Provider | Title | Subtitle | Description | Required Env Vars |
|----------|-------|----------|-------------|-------------------|
| `smtp` | SMTP Email | Direct SMTP | Send emails via SMTP server | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` |
| `sendgrid` | SendGrid Email | Cloud Email Service | Send emails via SendGrid API | `SENDGRID_API_KEY` |
| `mailgun` | Mailgun Email | Email API Service | Send emails via Mailgun API | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` |
| `ses` | Amazon SES | AWS Email Service | Send emails via Amazon SES | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` |

---

## Data Processing

### Apache Arrow (`tpl_arrow_operations`)
**Type:** `arrow` | **Category:** `data-processing` | **Subcategory:** `aggregators`

Process data using Apache Arrow columnar format for high-performance operations.

#### Properties
- **operation** (select): Arrow operation type
  - Options: `convert`, `filter`, `aggregate`, `join`, `sort`
  - Default: `convert`
- **compression** (select): Data compression method
  - Options: `none`, `snappy`, `gzip`, `lz4`
  - Default: `snappy`
- **chunkSize** (number): Processing chunk size
  - Default: `10000`
- **enableStatistics** (boolean): Generate processing statistics
  - Default: `true`

#### Property Rules
**Triggers:** `operation`

| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `convert` | Arrow Convert | Data Conversion | Convert data to Apache Arrow columnar format |
| `filter` | Arrow Filter | Filter Rows | Filter rows using Apache Arrow operations |
| `aggregate` | Arrow Aggregate | Aggregate Data | Perform aggregations using Apache Arrow |
| `join` | Arrow Join | Join Tables | Join datasets using Apache Arrow operations |
| `sort` | Arrow Sort | Sort Data | Sort data using Apache Arrow operations |

---

### CSV Reader (`tpl_csv_reader`)
**Type:** `reader` | **Category:** `data-processing` | **Subcategory:** `transformers`

Read and parse CSV files with configurable options.

#### Properties
- **delimiter** (select): Field separator
  - Options: `,`, `;`, `\t`, `|`
  - Default: `,`
- **hasHeader** (boolean): File contains header row
  - Default: `true`
- **skipRows** (number): Number of rows to skip
  - Default: `0`
- **encoding** (select): File character encoding
  - Options: `utf-8`, `latin1`, `ascii`
  - Default: `utf-8`
- **dateFormat** (text): Date parsing format

#### Property Rules
**Triggers:** `delimiter`, `encoding`

| Delimiter | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `,` | CSV Reader | Comma Separated | Read comma-separated values file |
| `;` | CSV Reader | Semicolon Separated | Read semicolon-separated values file |
| `\t` | TSV Reader | Tab Separated | Read tab-separated values file |
| `|` | PSV Reader | Pipe Separated | Read pipe-separated values file |

---

## Data Sources

### GitHub API (`tpl_github_api`)
**Type:** `api` | **Category:** `data-sources` | **Subcategory:** `apis`

Interact with GitHub repositories and data.

#### Properties
- **operation** (select): GitHub API operation
  - Options: `get-repo`, `list-issues`, `create-issue`, `get-pr`, `list-commits`
  - Default: `get-repo`
- **owner** (text, required): Repository owner
- **repo** (text, required): Repository name
- **perPage** (number): Results per page (max 100)
  - Default: `30`

#### Property Rules
**Triggers:** `operation`

| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `get-repo` | GitHub Repo | Repository Info | Get repository information |
| `list-issues` | GitHub Issues | List Issues | List repository issues |
| `create-issue` | GitHub Create Issue | New Issue | Create new repository issue |
| `get-pr` | GitHub PR | Pull Request | Get pull request information |
| `list-commits` | GitHub Commits | Commit History | List repository commits |

---

### HubSpot (`tpl_hubspot`)
**Type:** `crm` | **Category:** `data-sources` | **Subcategory:** `apis`

Interact with HubSpot CRM and Marketing Hub.

#### Properties
- **objectType** (select): HubSpot object type
  - Options: `contacts`, `companies`, `deals`, `tickets`
  - Default: `contacts`
- **operation** (select): CRUD operation
  - Options: `get`, `create`, `update`, `search`, `batch`
  - Default: `get`
- **properties** (textarea): Comma-separated property list
- **associations** (boolean): Include object associations
  - Default: `false`

#### Property Rules
**Triggers:** `operation`, `objectType`

| Operation | Subtitle |
|-----------|----------|
| `get` | Get Records |
| `create` | Create Records |
| `update` | Update Records |
| `search` | Search Records |
| `batch` | Batch Operations |

---

### Salesforce (`tpl_salesforce`)
**Type:** `crm` | **Category:** `data-sources` | **Subcategory:** `apis`

Interact with Salesforce CRM.

#### Properties
- **operation** (select): Salesforce operation
  - Options: `query`, `insert`, `update`, `delete`, `upsert`
  - Default: `query`
- **object** (select): Salesforce object type
  - Options: `Account`, `Contact`, `Lead`, `Opportunity`, `Case`
  - Default: `Account`
- **soqlQuery** (textarea): SOQL query string
- **externalIdField** (text): External ID field for upserts

#### Property Rules
**Triggers:** `operation`

| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `query` | SOQL Query | Query Records | Execute SOQL queries on Salesforce |
| `insert` | SF Insert | Create Records | Insert new records into Salesforce |
| `update` | SF Update | Update Records | Update existing Salesforce records |
| `delete` | SF Delete | Remove Records | Delete records from Salesforce |
| `upsert` | SF Upsert | Insert or Update | Insert new or update existing records |

---

### MongoDB Collection (`tpl_mongo_get_collection`)
**Type:** `mongo-operation` | **Category:** `data-sources` | **Subcategory:** `databases`

Retrieve documents from MongoDB collection.

#### Properties
- **collection** (text, required): Collection name
- **operation** (select): MongoDB operation
  - Options: `find`, `findOne`, `aggregate`
  - Default: `find`
- **limit** (number): Maximum documents to return
  - Default: `100`
- **sort** (textarea): Sort specification (JSON)
- **projection** (textarea): Field projection (JSON)

#### Property Rules
**Triggers:** `operation`

| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `find` | MongoDB Find | Query Documents | Find multiple documents matching query |
| `findOne` | MongoDB Find One | Single Document | Find first document matching query |
| `aggregate` | MongoDB Aggregate | Pipeline Processing | Run aggregation pipeline on collection |

---

### AWS S3 (`tpl_s3_storage`)
**Type:** `storage` | **Category:** `data-sources` | **Subcategory:** `files`

Store and retrieve files from AWS S3.

#### Properties
- **bucket** (text, required): S3 bucket name
- **operation** (select): S3 operation
  - Options: `upload`, `download`, `delete`, `list`
  - Default: `upload`
- **acl** (select): Access control level
  - Options: `private`, `public-read`, `public-read-write`
  - Default: `private`
- **storageClass** (select): S3 storage class
  - Options: `STANDARD`, `GLACIER`, `DEEP_ARCHIVE`
  - Default: `STANDARD`

#### Property Rules
**Triggers:** `operation`

| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `upload` | S3 Upload | Upload File | Upload file to S3 bucket |
| `download` | S3 Download | Download File | Download file from S3 bucket |
| `delete` | S3 Delete | Delete Object | Delete object from S3 bucket |
| `list` | S3 List | List Objects | List objects in S3 bucket |

---

### Google Sheets (`tpl_google_sheets`)
**Type:** `spreadsheet` | **Category:** `data-sources` | **Subcategory:** `files`

Interact with Google Sheets for data operations.

#### Properties
- **spreadsheetId** (text, required): Google Sheets ID
- **operation** (select): Sheets operation
  - Options: `read`, `write`, `append`, `clear`
  - Default: `read`
- **range** (text): Cell range (A1 notation)
  - Default: `A1:Z1000`
- **valueInputOption** (select): Value interpretation
  - Options: `RAW`, `USER_ENTERED`
  - Default: `USER_ENTERED`

#### Property Rules
**Triggers:** `operation`

| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `read` | Sheets Read | Read Data | Read data from Google Sheets |
| `write` | Sheets Write | Write Data | Write data to Google Sheets |
| `append` | Sheets Append | Add Rows | Append new rows to Google Sheets |
| `clear` | Sheets Clear | Clear Data | Clear data from Google Sheets |

---

## Logic Control

### Loop (`tpl_loop`)
**Type:** `control` | **Category:** `logic-control` | **Subcategory:** `loops`

Loop through arrays or collections with different iteration strategies.

#### Properties
- **loopType** (select): Type of loop iteration
  - Options: `for-each`, `while`, `do-while`
  - Default: `for-each`
- **batchSize** (number): Process items in batches
  - Default: `1`
- **maxIterations** (number): Safety limit for iterations
  - Default: `1000`
- **breakCondition** (textarea): JavaScript condition to break loop

#### Property Rules
**Triggers:** `loopType`

| Loop Type | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `for-each` | For Each Loop | Iterate Array | Iterate through each item in an array |
| `while` | While Loop | Conditional Loop | Loop while condition is true |
| `do-while` | Do-While Loop | Execute Then Check | Execute at least once, then loop while condition is true |

---

## Scripting

### SQL Script (`tpl_sql_script`)
**Type:** `script` | **Category:** `scripting` | **Subcategory:** `sql`

Execute SQL queries using database connection pool.

#### Properties
- **query** (code-editor): SQL query with parameters
  - Language: `sql`
- **queryType** (select): Type of SQL operation
  - Options: `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `TRANSACTION`
  - Default: `SELECT`
- **timeout** (number): Query timeout in milliseconds (1000-300000)
  - Default: `30000`
- **maxRows** (number): Maximum rows to return
  - Default: `1000`

#### Property Rules
**Triggers:** `queryType`

| Query Type | Title | Subtitle | Description |
|------------|-------|----------|-------------|
| `SELECT` | SQL Select | Query Data | Retrieve data from database tables |
| `INSERT` | SQL Insert | Add Records | Insert new records into database |
| `UPDATE` | SQL Update | Modify Records | Update existing records in database |
| `DELETE` | SQL Delete | Remove Records | Delete records from database |
| `TRANSACTION` | SQL Transaction | Atomic Operations | Execute multiple SQL operations atomically |

---

## Server Nodes

### Server Request (`tpl_server_request`)
**Type:** `server-request` | **Category:** `tools-utilities` | **Subcategory:** `http`

Receives and processes incoming HTTP/WebSocket requests.

#### Properties
- **requestType** (select): Type of request to handle
  - Options: `HTTP`, `WebSocket`, `Any`
  - Default: `Any`
- **dataFormat** (select): Expected request data format
  - Options: `JSON`, `Form Data`, `Plain Text`, `Binary`, `Auto-detect`
  - Default: `Auto-detect`
- **extractFields** (dataOperations): Configure field extraction
- **validation** (code-editor): JSON Schema for request validation
- **authentication** (select): Required authentication method
  - Options: `None`, `Bearer Token`, `API Key`, `Basic Auth`, `Custom`
  - Default: `None`

#### Property Rules
**Triggers:** `requestType`, `authentication`

| Request Type | Subtitle | Icon |
|--------------|----------|------|
| `HTTP` | HTTP Request Handler | globe |
| `WebSocket` | WebSocket Message Handler | cable |

| Authentication | Required Env Vars |
|-----------------|-------------------|
| `Bearer Token` | `AUTH_SECRET_KEY` |
| `API Key` | `API_KEY_HEADER`, `VALID_API_KEYS` |

---

### Server Response (`tpl_server_response`)
**Type:** `server-response` | **Category:** `tools-utilities` | **Subcategory:** `http`

Sends formatted responses back to the client.

#### Properties
- **responseType** (select): Type of response to send
  - Options: `Success`, `Error`, `Redirect`, `Custom`
  - Default: `Success`
- **statusCode** (number): HTTP status code (100-599)
  - Default: `200`
- **contentType** (select): Response content type
  - Options: `application/json`, `text/plain`, `text/html`, `application/xml`, `application/octet-stream`, `Custom`
  - Default: `application/json`
- **headers** (dataOperations): Custom response headers
- **responseFormat** (code-editor): Response template with variables
- **compression** (boolean): Enable gzip compression
  - Default: `true`
- **cache** (select): Cache control settings
  - Options: `No Cache`, `Public`, `Private`, `Custom`
  - Default: `No Cache`

#### Property Rules
**Triggers:** `responseType`, `contentType`, `cache`

| Response Type | Status Code | Icon | Variant | Subtitle |
|---------------|-------------|------|---------|----------|
| `Success` | 200 | check-circle | green-600 | Success Response |
| `Error` | 400 | alert-circle | red-600 | Error Response |
| `Redirect` | 302 | external-link | yellow-600 | Redirect Response |
| `Custom` | - | settings | gray-600 | Custom Response |

---

## Storage & Memory

### Cache (`tpl_cache`)
**Type:** `cache` | **Category:** `storage-memory` | **Subcategory:** `cache`

Cache data in memory with TTL support and eviction policies.

#### Properties
- **operation** (select): Cache operation
  - Options: `get`, `set`, `delete`, `clear`, `has`
  - Default: `get`
- **ttl** (number): Time to live in seconds
  - Default: `300`
- **maxSize** (number): Maximum cache entries
  - Default: `1000`
- **evictionPolicy** (select): Cache eviction strategy
  - Options: `lru`, `lfu`, `fifo`
  - Default: `lru`

#### Property Rules
**Triggers:** `operation`

| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `get` | Cache Get | Retrieve Value | Get cached value by key |
| `set` | Cache Set | Store Value | Store value in cache with TTL |
| `delete` | Cache Delete | Remove Entry | Remove cached entry by key |
| `clear` | Cache Clear | Clear All | Clear all cached entries |
| `has` | Cache Has | Check Existence | Check if key exists in cache |

---

### Redis (`tpl_redis`)
**Type:** `redis` | **Category:** `storage-memory` | **Subcategory:** `cache`

Interact with Redis for caching and data storage.

#### Properties
- **command** (select): Redis command
  - Options: `GET`, `SET`, `DEL`, `EXISTS`, `EXPIRE`, `HGET`, `HSET`, `LPUSH`, `RPOP`
  - Default: `GET`
- **key** (text, required): Redis key
- **database** (number): Redis database number (0-15)
  - Default: `0`
- **expiry** (number): Key expiration time in seconds

#### Property Rules
**Triggers:** `command`

| Command | Title | Subtitle | Description |
|---------|-------|----------|-------------|
| `GET` | Redis GET | Get Value | Get value from Redis by key |
| `SET` | Redis SET | Set Value | Set key-value pair in Redis |
| `DEL` | Redis DEL | Delete Key | Delete key from Redis |
| `EXISTS` | Redis EXISTS | Check Key | Check if key exists in Redis |
| `EXPIRE` | Redis EXPIRE | Set TTL | Set expiration time for Redis key |
| `HGET` | Redis HGET | Get Hash Field | Get field value from Redis hash |
| `HSET` | Redis HSET | Set Hash Field | Set field value in Redis hash |
| `LPUSH` | Redis LPUSH | Push to List | Push element to left of Redis list |
| `RPOP` | Redis RPOP | Pop from List | Pop element from right of Redis list |

---

### Queue (`tpl_queue`)
**Type:** `queue` | **Category:** `storage-memory` | **Subcategory:** `sessions`

Send and receive messages from various queue providers.

#### Properties
- **operation** (select): Queue operation
  - Options: `send`, `receive`, `peek`, `ack`, `nack`
  - Default: `send`
- **queueName** (text, required): Queue identifier
- **provider** (select): Message queue provider
  - Options: `rabbitmq`, `sqs`, `kafka`, `redis`
  - Default: `rabbitmq`
- **maxMessages** (number): Maximum messages to process (1-10)
  - Default: `1`

#### Property Rules
**Triggers:** `operation`, `provider`

**Operation Rules:**
| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `send` | Queue Send | Send Message | Send message to queue |
| `receive` | Queue Receive | Receive Message | Receive message from queue |
| `peek` | Queue Peek | Peek Message | Peek at message without removing |
| `ack` | Queue ACK | Acknowledge | Acknowledge message processing |
| `nack` | Queue NACK | Not Acknowledge | Reject message processing |

**Provider Rules:**
| Provider | Title | Subtitle | Description | Icon |
|----------|-------|----------|-------------|------|
| `rabbitmq` | RabbitMQ Queue | AMQP Messaging | Send and receive messages via RabbitMQ | rabbit |
| `sqs` | Amazon SQS | AWS Queue Service | Send and receive messages via Amazon SQS | aws |
| `kafka` | Apache Kafka | Event Streaming | Send and receive messages via Apache Kafka | kafka |
| `redis` | Redis Queue | Redis Lists | Send and receive messages via Redis lists | redis |

---

### State Store (`tpl_state_store`)
**Type:** `storage` | **Category:** `storage-memory` | **Subcategory:** `sessions`

Store and retrieve persistent state across workflow executions.

#### Properties
- **operation** (select): State operation
  - Options: `get`, `set`, `delete`, `exists`
  - Default: `get`
- **namespace** (text): State namespace
- **ttl** (number): Time to live in seconds (0 = no expiry)
- **storageType** (select): Storage backend
  - Options: `memory`, `redis`, `file`
  - Default: `memory`

#### Property Rules
**Triggers:** `operation`

| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `get` | State Get | Retrieve State | Get stored state value by key |
| `set` | State Set | Store State | Store state value with key |
| `delete` | State Delete | Remove State | Delete stored state by key |
| `exists` | State Exists | Check State | Check if state key exists |

---

## Tools & Utilities

### GraphQL Query (`tpl_graphql_query`)
**Type:** `graphql` | **Category:** `tools-utilities` | **Subcategory:** `http`

Execute GraphQL queries, mutations, and subscriptions.

#### Properties
- **endpoint** (text, required): GraphQL endpoint URL
- **query** (code-editor): GraphQL query/mutation/subscription
  - Language: `graphql`
- **operationType** (select): GraphQL operation type
  - Options: `query`, `mutation`, `subscription`
  - Default: `query`

#### Property Rules
**Triggers:** `operationType`

| Operation Type | Title | Subtitle | Description |
|----------------|-------|----------|-------------|
| `query` | GraphQL Query | Fetch Data | Execute GraphQL query to fetch data |
| `mutation` | GraphQL Mutation | Modify Data | Execute GraphQL mutation to modify data |
| `subscription` | GraphQL Subscription | Real-time Data | Subscribe to real-time GraphQL updates |

---

### HTTP Request (`tpl_http_request`)
**Type:** `http` | **Category:** `tools-utilities` | **Subcategory:** `http`

Make HTTP requests to external APIs and services.

#### Properties
- **url** (text, required): Request URL
- **method** (select): HTTP method
  - Options: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
  - Default: `GET`
- **timeout** (number): Request timeout in milliseconds (1000-300000)
  - Default: `30000`
- **retryCount** (number): Number of retry attempts (0-10)
  - Default: `3`
- **followRedirects** (boolean): Follow HTTP redirects
  - Default: `true`

#### Property Rules
**Triggers:** `method`

| Method | Title | Subtitle | Description |
|--------|-------|----------|-------------|
| `GET` | HTTP GET | Fetch Data | Retrieve data from web API |
| `POST` | HTTP POST | Send Data | Send data to web API |
| `PUT` | HTTP PUT | Update Resource | Update or create resource via API |
| `PATCH` | HTTP PATCH | Partial Update | Partially update resource via API |
| `DELETE` | HTTP DELETE | Remove Resource | Delete resource via API |

---

### RPC Call (`tpl_rpc_call`)
**Type:** `rpc` | **Category:** `tools-utilities` | **Subcategory:** `http`

Make remote procedure calls using various RPC protocols.

#### Properties
- **protocol** (select): RPC protocol
  - Options: `json-rpc`, `grpc`, `xml-rpc`
  - Default: `json-rpc`
- **endpoint** (text, required): RPC endpoint URL
- **method** (text, required): RPC method name
- **version** (text): Protocol version
  - Default: `2.0`

#### Property Rules
**Triggers:** `protocol`

| Protocol | Title | Subtitle | Description |
|----------|-------|----------|-------------|
| `json-rpc` | JSON-RPC Call | JSON Remote Call | Make JSON-RPC remote procedure call |
| `grpc` | gRPC Call | Binary RPC | Make gRPC binary remote procedure call |
| `xml-rpc` | XML-RPC Call | XML Remote Call | Make XML-RPC remote procedure call |

---

### Math Round (`tpl_math_round`)
**Type:** `math` | **Category:** `tools-utilities` | **Subcategory:** `math`

Round numbers using different rounding methods.

#### Properties
- **precision** (number): Number of decimal places (0-10)
  - Default: `0`
- **method** (select): Rounding method
  - Options: `round`, `floor`, `ceil`, `trunc`
  - Default: `round`

#### Property Rules
**Triggers:** `method`

| Method | Title | Subtitle | Description |
|--------|-------|----------|-------------|
| `round` | Round | Round Number | Round a number to specified precision |
| `floor` | Floor | Round Down | Round down to the nearest integer or precision |
| `ceil` | Ceiling | Round Up | Round up to the nearest integer or precision |
| `trunc` | Truncate | Remove Decimals | Remove decimal places without rounding |

---

### Date/Time (`tpl_date_time`)
**Type:** `datetime` | **Category:** `tools-utilities` | **Subcategory:** `utilities`

Parse, format, and manipulate dates and times.

#### Properties
- **operation** (select): Date/time operation
  - Options: `format`, `parse`, `add`, `subtract`, `diff`, `now`
  - Default: `format`
- **format** (text): Date format pattern
  - Default: `YYYY-MM-DD HH:mm:ss`
- **timezone** (text): Timezone identifier
  - Default: `UTC`
- **unit** (select): Time unit for add/subtract operations
  - Options: `years`, `months`, `days`, `hours`, `minutes`, `seconds`
  - Default: `days`

#### Property Rules
**Triggers:** `operation`

| Operation | Title | Subtitle | Description |
|-----------|-------|----------|-------------|
| `format` | Date Format | Format Date | Format date using specified pattern |
| `parse` | Date Parse | Parse Date | Parse date string into date object |
| `add` | Date Add | Add Time | Add time duration to date |
| `subtract` | Date Subtract | Subtract Time | Subtract time duration from date |
| `diff` | Date Diff | Calculate Difference | Calculate difference between two dates |
| `now` | Current Time | Get Now | Get current date and time |

---

## Property Rules System

### How Property Rules Work

Property rules enable dynamic visual updates to node templates based on property values. When a user changes a property that's listed in the `triggers` array, the system evaluates all rules and applies the first matching rule's updates.

### Rule Evaluation Order

1. **Compound Rules First**: Rules with `&&` operators (e.g., `$.provider == 'openai' && $.model == 'gpt-4'`)
2. **Simple Rules Second**: Single condition rules (e.g., `$.operation == 'get'`)
3. **First Match Wins**: Only the first matching rule is applied

### Supported Updates

Property rules can update these node properties:
- **title**: Node display name
- **subtitle**: Secondary text below title
- **description**: Detailed description
- **icon**: Icon identifier
- **variant**: Color variant (e.g., `green-600`, `blue-500`)
- **requiredEnvVars**: Array of required environment variables

### JSONPath Syntax

Rules use JSONPath expressions with these operators:
- `==`: Equal to
- `!=`: Not equal to
- `>`: Greater than
- `<`: Less than
- `>=`: Greater than or equal
- `<=`: Less than or equal
- `&&`: Logical AND
- `||`: Logical OR

### Example Rule Structure

```json
{
  "triggers": ["operation", "provider"],
  "rules": [
    {
      "when": "$.provider == 'aws' && $.operation == 'upload'",
      "updates": {
        "title": "AWS S3 Upload",
        "subtitle": "Upload to S3",
        "icon": "aws",
        "variant": "orange-600"
      }
    },
    {
      "when": "$.operation == 'upload'",
      "updates": {
        "title": "File Upload",
        "subtitle": "Upload File"
      }
    }
  ]
}
```

This system ensures that nodes visually reflect their configuration, making it easy for users to distinguish between different setups and understand node functionality at a glance.