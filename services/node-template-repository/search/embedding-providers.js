"use strict";
/**
 * Embedding vendor providers for AI models
 * Supports OpenAI, Azure OpenAI, Google, and other vendors
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbeddingConfigBuilder = exports.MockEmbeddingVendor = exports.GoogleEmbeddingVendor = exports.AzureOpenAIEmbeddingVendor = exports.OpenAIEmbeddingVendor = exports.EmbeddingVendor = void 0;
exports.createEmbeddingVendor = createEmbeddingVendor;
class EmbeddingVendor {
    config;
    constructor(config) {
        this.config = config;
        this.validateConfig();
    }
    get dimensions() {
        return this.config.dimensions;
    }
    get vendor() {
        return this.config.vendor;
    }
    get model() {
        return this.config.model;
    }
}
exports.EmbeddingVendor = EmbeddingVendor;
/**
 * OpenAI Embedding Vendor
 */
class OpenAIEmbeddingVendor extends EmbeddingVendor {
    baseUrl = 'https://api.openai.com/v1';
    validateConfig() {
        if (!this.config.apiKey) {
            throw new Error('OpenAI API key is required');
        }
        if (!this.config.model) {
            throw new Error('OpenAI model is required (e.g., text-embedding-3-small, text-embedding-3-large)');
        }
    }
    async generateEmbedding(text) {
        try {
            // Validate input
            if (!text || typeof text !== 'string' || text.trim().length === 0) {
                throw new Error('Invalid text provided for embedding generation');
            }
            const requestBody = {
                input: text.trim(),
                model: this.config.model,
            };
            // Only add dimensions if specified and model supports it
            if (this.config.dimensions && this.config.model.includes('text-embedding-3')) {
                ;
                requestBody.dimensions = this.config.dimensions;
            }
            const response = await fetch(`${this.baseUrl}/embeddings`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI API error: ${response.status} ${error}`);
            }
            const data = (await response.json());
            const embedding = new Float32Array(data.data[0].embedding);
            return {
                embedding,
                tokens: data.usage?.total_tokens,
                model: this.config.model,
            };
        }
        catch (error) {
            console.error('OpenAI embedding generation failed:', error);
            throw error;
        }
    }
    async generateBatchEmbeddings(texts) {
        const batchSize = this.config.batchSize || 100;
        const embeddings = [];
        let totalTokens = 0;
        // Validate and filter texts
        const validTexts = texts.filter(text => text && typeof text === 'string' && text.trim().length > 0);
        if (validTexts.length === 0) {
            throw new Error('No valid texts provided for embedding generation');
        }
        for (let i = 0; i < validTexts.length; i += batchSize) {
            const batch = validTexts.slice(i, i + batchSize);
            // Ensure batch is not empty
            if (batch.length === 0)
                continue;
            const requestBody = {
                input: batch,
                model: this.config.model,
            };
            // Only add dimensions if specified and model supports it
            if (this.config.dimensions && this.config.model.includes('text-embedding-3')) {
                ;
                requestBody.dimensions = this.config.dimensions;
            }
            try {
                // Add timeout to prevent hanging on connection issues
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
                const response = await fetch(`${this.baseUrl}/embeddings`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestBody),
                    signal: controller.signal,
                }).finally(() => clearTimeout(timeoutId));
                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`OpenAI API error: ${response.status} ${error}`);
                }
                const data = (await response.json());
                for (const item of data.data) {
                    embeddings.push(new Float32Array(item.embedding));
                }
                totalTokens += data.usage?.total_tokens || 0;
                // Rate limiting delay
                if (this.config.rateLimitDelay && i + batchSize < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
                }
            }
            catch (error) {
                console.error(`OpenAI batch embedding failed for batch ${i / batchSize + 1}:`, error);
                // Retry logic for transient errors
                if (error instanceof Error && error.message.includes('503')) {
                    console.warn('OpenAI API returned 503, retrying after delay...');
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
                    // Retry once
                    try {
                        const retryController = new AbortController();
                        const retryTimeoutId = setTimeout(() => retryController.abort(), 15000); // 15 second timeout
                        const retryResponse = await fetch(`${this.baseUrl}/embeddings`, {
                            method: 'POST',
                            headers: {
                                Authorization: `Bearer ${this.config.apiKey}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify(requestBody),
                            signal: retryController.signal,
                        }).finally(() => clearTimeout(retryTimeoutId));
                        if (!retryResponse.ok) {
                            throw new Error(`OpenAI API retry failed: ${retryResponse.status}`);
                        }
                        const retryData = (await retryResponse.json());
                        for (const item of retryData.data) {
                            embeddings.push(new Float32Array(item.embedding));
                        }
                        totalTokens += retryData.usage?.total_tokens || 0;
                        // Continue to next batch after successful retry
                        continue;
                    }
                    catch (retryError) {
                        console.error('OpenAI retry also failed:', retryError);
                        // Fall through to original error
                    }
                }
                throw error;
            }
        }
        return {
            embeddings,
            totalTokens,
            model: this.config.model,
        };
    }
}
exports.OpenAIEmbeddingVendor = OpenAIEmbeddingVendor;
/**
 * Azure OpenAI Embedding Vendor
 */
class AzureOpenAIEmbeddingVendor extends EmbeddingVendor {
    validateConfig() {
        if (!this.config.apiKey) {
            throw new Error('Azure OpenAI API key is required');
        }
        if (!this.config.endpoint) {
            throw new Error('Azure OpenAI endpoint is required');
        }
        if (!this.config.model) {
            throw new Error('Azure OpenAI deployment name is required');
        }
        if (!this.config.apiVersion) {
            this.config.apiVersion = '2024-02-01';
        }
    }
    async generateEmbedding(text) {
        const url = `${this.config.endpoint}/openai/deployments/${this.config.model}/embeddings?api-version=${this.config.apiVersion}`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'api-key': this.config.apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    input: text,
                    dimensions: this.config.dimensions,
                }),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Azure OpenAI API error: ${response.status} ${error}`);
            }
            const data = (await response.json());
            const embedding = new Float32Array(data.data[0].embedding);
            return {
                embedding,
                tokens: data.usage?.total_tokens,
                model: this.config.model,
            };
        }
        catch (error) {
            console.error('Azure OpenAI embedding generation failed:', error);
            throw error;
        }
    }
    async generateBatchEmbeddings(texts) {
        const batchSize = this.config.batchSize || 100;
        const embeddings = [];
        let totalTokens = 0;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const url = `${this.config.endpoint}/openai/deployments/${this.config.model}/embeddings?api-version=${this.config.apiVersion}`;
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'api-key': this.config.apiKey,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        input: batch,
                        dimensions: this.config.dimensions,
                    }),
                });
                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Azure OpenAI API error: ${response.status} ${error}`);
                }
                const data = (await response.json());
                for (const item of data.data) {
                    embeddings.push(new Float32Array(item.embedding));
                }
                totalTokens += data.usage?.total_tokens || 0;
                // Rate limiting delay
                if (this.config.rateLimitDelay && i + batchSize < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
                }
            }
            catch (error) {
                console.error(`Azure OpenAI batch embedding failed for batch ${i / batchSize + 1}:`, error);
                throw error;
            }
        }
        return {
            embeddings,
            totalTokens,
            model: this.config.model,
        };
    }
}
exports.AzureOpenAIEmbeddingVendor = AzureOpenAIEmbeddingVendor;
/**
 * Google Embedding Vendor (Vertex AI)
 */
class GoogleEmbeddingVendor extends EmbeddingVendor {
    validateConfig() {
        if (!this.config.apiKey) {
            throw new Error('Google API key is required');
        }
        if (!this.config.projectId) {
            throw new Error('Google Project ID is required');
        }
        if (!this.config.region) {
            this.config.region = 'us-central1';
        }
        if (!this.config.model) {
            this.config.model = 'textembedding-gecko@latest';
        }
    }
    async generateEmbedding(text) {
        const url = `https://${this.config.region}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.region}/publishers/google/models/${this.config.model}:predict`;
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    instances: [{ content: text }],
                }),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Google Vertex AI error: ${response.status} ${error}`);
            }
            const data = (await response.json());
            const embedding = new Float32Array(data.predictions[0].embeddings.values);
            return {
                embedding,
                model: this.config.model,
            };
        }
        catch (error) {
            console.error('Google embedding generation failed:', error);
            throw error;
        }
    }
    async generateBatchEmbeddings(texts) {
        const batchSize = this.config.batchSize || 100;
        const embeddings = [];
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const url = `https://${this.config.region}-aiplatform.googleapis.com/v1/projects/${this.config.projectId}/locations/${this.config.region}/publishers/google/models/${this.config.model}:predict`;
            try {
                const instances = batch.map(text => ({ content: text }));
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ instances }),
                });
                if (!response.ok) {
                    const error = await response.text();
                    throw new Error(`Google Vertex AI error: ${response.status} ${error}`);
                }
                const data = (await response.json());
                for (const prediction of data.predictions) {
                    embeddings.push(new Float32Array(prediction.embeddings.values));
                }
                // Rate limiting delay
                if (this.config.rateLimitDelay && i + batchSize < texts.length) {
                    await new Promise(resolve => setTimeout(resolve, this.config.rateLimitDelay));
                }
            }
            catch (error) {
                console.error(`Google batch embedding failed for batch ${i / batchSize + 1}:`, error);
                throw error;
            }
        }
        return {
            embeddings,
            model: this.config.model,
        };
    }
}
exports.GoogleEmbeddingVendor = GoogleEmbeddingVendor;
/**
 * Mock Embedding Vendor for testing/development
 */
class MockEmbeddingVendor extends EmbeddingVendor {
    validateConfig() {
        // No validation needed for mock
    }
    async generateEmbedding(text) {
        const embedding = this.generateMockEmbedding(text);
        return {
            embedding,
            tokens: Math.floor(text.length / 4), // Rough token estimate
            model: 'mock-embedding-model',
        };
    }
    async generateBatchEmbeddings(texts) {
        const embeddings = texts.map(text => this.generateMockEmbedding(text));
        const totalTokens = texts.reduce((sum, text) => sum + Math.floor(text.length / 4), 0);
        return {
            embeddings,
            totalTokens,
            model: 'mock-embedding-model',
        };
    }
    generateMockEmbedding(seed) {
        const embedding = new Float32Array(this.config.dimensions);
        // Handle empty or very short seeds
        if (!seed || seed.length === 0) {
            seed = 'default_seed';
        }
        // Simple hash function for deterministic values
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
            hash = hash & hash;
        }
        // Ensure hash is not zero to avoid issues
        if (hash === 0) {
            hash = 42;
        }
        // Fill with pseudo-random values
        for (let i = 0; i < this.config.dimensions; i++) {
            const value = Math.sin(hash * (i + 1)) * 0.5 + 0.5;
            embedding[i] = value * 2 - 1; // Normalize to [-1, 1]
            // Ensure no NaN or Infinity values
            if (!isFinite(embedding[i])) {
                embedding[i] = 0;
            }
        }
        // Normalize the vector
        const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        // Handle edge case where magnitude is 0 or NaN
        if (!isFinite(magnitude) || magnitude === 0) {
            // Create a simple normalized vector
            for (let i = 0; i < this.config.dimensions; i++) {
                embedding[i] = i === 0 ? 1 : 0;
            }
        }
        else {
            for (let i = 0; i < this.config.dimensions; i++) {
                embedding[i] /= magnitude;
            }
        }
        return embedding;
    }
}
exports.MockEmbeddingVendor = MockEmbeddingVendor;
/**
 * Factory function to create embedding vendors
 */
function createEmbeddingVendor(config) {
    switch (config.vendor) {
        case 'openai':
            return new OpenAIEmbeddingVendor(config);
        case 'azure-openai':
            return new AzureOpenAIEmbeddingVendor(config);
        case 'google':
            return new GoogleEmbeddingVendor(config);
        case 'mock':
            return new MockEmbeddingVendor(config);
        default:
            throw new Error(`Unsupported embedding vendor: ${config.vendor}`);
    }
}
/**
 * Configuration builder for embedding vendors
 */
class EmbeddingConfigBuilder {
    config = {};
    static openai() {
        return new EmbeddingConfigBuilder().vendor('openai');
    }
    static azureOpenai() {
        return new EmbeddingConfigBuilder().vendor('azure-openai');
    }
    static google() {
        return new EmbeddingConfigBuilder().vendor('google');
    }
    static mock() {
        return new EmbeddingConfigBuilder().vendor('mock');
    }
    vendor(vendor) {
        this.config.vendor = vendor;
        return this;
    }
    model(model) {
        this.config.model = model;
        return this;
    }
    apiKey(apiKey) {
        this.config.apiKey = apiKey;
        return this;
    }
    dimensions(dimensions) {
        this.config.dimensions = dimensions;
        return this;
    }
    endpoint(endpoint) {
        this.config.endpoint = endpoint;
        return this;
    }
    apiVersion(apiVersion) {
        this.config.apiVersion = apiVersion;
        return this;
    }
    region(region) {
        this.config.region = region;
        return this;
    }
    projectId(projectId) {
        this.config.projectId = projectId;
        return this;
    }
    batchSize(batchSize) {
        this.config.batchSize = batchSize;
        return this;
    }
    rateLimitDelay(delay) {
        this.config.rateLimitDelay = delay;
        return this;
    }
    build() {
        if (!this.config.vendor) {
            throw new Error('Vendor is required');
        }
        if (!this.config.model && this.config.vendor !== 'mock') {
            throw new Error('Model is required');
        }
        if (!this.config.apiKey && this.config.vendor !== 'mock') {
            throw new Error('API key is required');
        }
        if (!this.config.dimensions) {
            // Set default dimensions based on vendor/model
            this.config.dimensions = this.getDefaultDimensions();
        }
        return this.config;
    }
    getDefaultDimensions() {
        switch (this.config.vendor) {
            case 'openai':
                if (this.config.model?.includes('text-embedding-3-large'))
                    return 3072;
                if (this.config.model?.includes('text-embedding-3-small'))
                    return 1536;
                return 1536;
            case 'azure-openai':
                return 1536;
            case 'google':
                return 768;
            default:
                return 1536;
        }
    }
}
exports.EmbeddingConfigBuilder = EmbeddingConfigBuilder;
//# sourceMappingURL=embedding-providers.js.map