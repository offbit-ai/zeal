# Embedding Configuration

This document describes how to configure embedding providers for the Node Template Repository's semantic search functionality.

## Environment Variables

### Core Configuration

- `EMBEDDING_VENDOR`: The embedding vendor to use (default: 'mock')
  - Options: `openai`, `azure-openai`, `google`, `mock`
- `EMBEDDING_MODEL`: The specific model to use (vendor-specific defaults apply)
- `EMBEDDING_DIMENSIONS`: Vector dimensions (default: 1536)
- `EMBEDDING_API_KEY`: API key for the embedding service
- `EMBEDDING_BATCH_SIZE`: Batch size for bulk embedding generation (default: 100)
- `EMBEDDING_RATE_LIMIT_DELAY`: Delay between API calls in milliseconds (default: 100)

### OpenAI Configuration

```bash
EMBEDDING_VENDOR=openai
EMBEDDING_MODEL=text-embedding-3-small  # or text-embedding-3-large
EMBEDDING_API_KEY=sk-your-openai-api-key
EMBEDDING_DIMENSIONS=1536  # 1536 for small, 3072 for large
```

### Azure OpenAI Configuration

```bash
EMBEDDING_VENDOR=azure-openai
EMBEDDING_MODEL=text-embedding-ada-002  # your deployment name
EMBEDDING_API_KEY=your-azure-api-key
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-02-01
EMBEDDING_DIMENSIONS=1536
```

### Google Vertex AI Configuration

```bash
EMBEDDING_VENDOR=google
EMBEDDING_MODEL=textembedding-gecko@latest
EMBEDDING_API_KEY=your-google-access-token
GOOGLE_PROJECT_ID=your-project-id
GOOGLE_REGION=us-central1
EMBEDDING_DIMENSIONS=768
```

### Mock Configuration (for development/testing)

```bash
EMBEDDING_VENDOR=mock
EMBEDDING_DIMENSIONS=1536
```

## Model Options

### OpenAI Models

- `text-embedding-3-small`: 1536 dimensions, optimized for efficiency
- `text-embedding-3-large`: 3072 dimensions, highest performance
- `text-embedding-ada-002`: 1536 dimensions, legacy model

### Azure OpenAI Models

Use your deployment name as configured in Azure OpenAI Studio:

- `text-embedding-ada-002` (most common)
- `text-embedding-3-small`
- `text-embedding-3-large`

### Google Vertex AI Models

- `textembedding-gecko@latest`: 768 dimensions, multilingual
- `textembedding-gecko@001`: 768 dimensions, stable version
- `text-embedding-preview-0409`: 768 dimensions, preview model

## Configuration Examples

### Production with OpenAI

```bash
# .env.production
EMBEDDING_VENDOR=openai
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_API_KEY=sk-your-production-key
EMBEDDING_DIMENSIONS=1536
EMBEDDING_BATCH_SIZE=50
EMBEDDING_RATE_LIMIT_DELAY=200
```

### Development with Mock

```bash
# .env.development
EMBEDDING_VENDOR=mock
EMBEDDING_DIMENSIONS=1536
```

### Enterprise with Azure OpenAI

```bash
# .env.enterprise
EMBEDDING_VENDOR=azure-openai
EMBEDDING_MODEL=text-embedding-deployment
EMBEDDING_API_KEY=your-azure-key
AZURE_OPENAI_ENDPOINT=https://company.openai.azure.com
AZURE_OPENAI_API_VERSION=2024-02-01
EMBEDDING_DIMENSIONS=1536
```

## Usage in Code

### Automatic Configuration

The embedding service automatically reads from environment variables:

```typescript
import { EmbeddingService } from './embedding-service'

// Creates service with env var configuration
const embeddingService = EmbeddingService.fromEnvironment()
```

### Manual Configuration

```typescript
import { EmbeddingService, EmbeddingConfigBuilder } from './embedding-service'

// OpenAI configuration
const config = EmbeddingConfigBuilder.openai()
  .model('text-embedding-3-small')
  .apiKey('sk-your-key')
  .dimensions(1536)
  .build()

const embeddingService = new EmbeddingService(config)

// Azure OpenAI configuration
const azureConfig = EmbeddingConfigBuilder.azureOpenai()
  .model('text-embedding-deployment')
  .apiKey('your-azure-key')
  .endpoint('https://your-resource.openai.azure.com')
  .apiVersion('2024-02-01')
  .dimensions(1536)
  .build()

const azureEmbeddingService = new EmbeddingService(azureConfig)
```

## Best Practices

### Performance

1. **Batch Size**: Start with 100, reduce if you hit rate limits
2. **Rate Limiting**: Increase delay between calls if you get 429 errors
3. **Model Selection**: Use `text-embedding-3-small` for most use cases

### Cost Optimization

1. **OpenAI**: Use `text-embedding-3-small` instead of `3-large` unless you need the extra performance
2. **Batch Processing**: Process embeddings in batches to reduce API calls
3. **Caching**: The system automatically caches embeddings in the database

### Security

1. **API Keys**: Never commit API keys to version control
2. **Environment Variables**: Use secure environment variable management
3. **Access Control**: Limit API key permissions to embedding endpoints only

### Error Handling

The embedding service includes automatic fallback to mock embeddings when:

- API keys are invalid
- Network requests fail
- Rate limits are exceeded
- Vendor services are unavailable

This ensures the system continues to function even when embedding services are down.

## Troubleshooting

### Common Issues

1. **"Invalid API Key"**: Check your API key and permissions
2. **"Rate Limit Exceeded"**: Increase `EMBEDDING_RATE_LIMIT_DELAY`
3. **"Model Not Found"**: Verify model name for your vendor
4. **"Endpoint Not Found"**: Check Azure endpoint URL format

### Debugging

Enable verbose logging by setting:

```bash
DEBUG=embedding:*
```

Check vendor configuration:

```typescript
const embeddingService = EmbeddingService.fromEnvironment()
console.log(embeddingService.getVendorInfo())
```

### Testing Configuration

Test your embedding configuration:

```typescript
const embeddingService = EmbeddingService.fromEnvironment()
const result = await embeddingService.generateQueryEmbedding('test query')
console.log(`Generated ${result.length} dimensional embedding`)
```
