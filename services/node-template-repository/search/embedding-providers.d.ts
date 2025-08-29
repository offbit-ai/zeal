/**
 * Embedding vendor providers for AI models
 * Supports OpenAI, Azure OpenAI, Google, and other vendors
 */
export interface EmbeddingVendorConfig {
    vendor: 'openai' | 'azure-openai' | 'google' | 'anthropic' | 'cohere' | 'mock';
    model: string;
    apiKey: string;
    dimensions: number;
    endpoint?: string;
    apiVersion?: string;
    region?: string;
    projectId?: string;
    maxTokens?: number;
    batchSize?: number;
    rateLimitDelay?: number;
}
export interface EmbeddingResult {
    embedding: Float32Array;
    tokens?: number;
    model?: string;
}
export interface BatchEmbeddingResult {
    embeddings: Float32Array[];
    totalTokens?: number;
    model?: string;
}
export declare abstract class EmbeddingVendor {
    protected config: EmbeddingVendorConfig;
    constructor(config: EmbeddingVendorConfig);
    abstract generateEmbedding(text: string): Promise<EmbeddingResult>;
    abstract generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
    protected abstract validateConfig(): void;
    get dimensions(): number;
    get vendor(): string;
    get model(): string;
}
/**
 * OpenAI Embedding Vendor
 */
export declare class OpenAIEmbeddingVendor extends EmbeddingVendor {
    private baseUrl;
    protected validateConfig(): void;
    generateEmbedding(text: string): Promise<EmbeddingResult>;
    generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
}
/**
 * Azure OpenAI Embedding Vendor
 */
export declare class AzureOpenAIEmbeddingVendor extends EmbeddingVendor {
    protected validateConfig(): void;
    generateEmbedding(text: string): Promise<EmbeddingResult>;
    generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
}
/**
 * Google Embedding Vendor (Vertex AI)
 */
export declare class GoogleEmbeddingVendor extends EmbeddingVendor {
    protected validateConfig(): void;
    generateEmbedding(text: string): Promise<EmbeddingResult>;
    generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
}
/**
 * Mock Embedding Vendor for testing/development
 */
export declare class MockEmbeddingVendor extends EmbeddingVendor {
    protected validateConfig(): void;
    generateEmbedding(text: string): Promise<EmbeddingResult>;
    generateBatchEmbeddings(texts: string[]): Promise<BatchEmbeddingResult>;
    private generateMockEmbedding;
}
/**
 * Factory function to create embedding vendors
 */
export declare function createEmbeddingVendor(config: EmbeddingVendorConfig): EmbeddingVendor;
/**
 * Configuration builder for embedding vendors
 */
export declare class EmbeddingConfigBuilder {
    private config;
    static openai(): EmbeddingConfigBuilder;
    static azureOpenai(): EmbeddingConfigBuilder;
    static google(): EmbeddingConfigBuilder;
    static mock(): EmbeddingConfigBuilder;
    vendor(vendor: EmbeddingVendorConfig['vendor']): this;
    model(model: string): this;
    apiKey(apiKey: string): this;
    dimensions(dimensions: number): this;
    endpoint(endpoint: string): this;
    apiVersion(apiVersion: string): this;
    region(region: string): this;
    projectId(projectId: string): this;
    batchSize(batchSize: number): this;
    rateLimitDelay(delay: number): this;
    build(): EmbeddingVendorConfig;
    private getDefaultDimensions;
}
//# sourceMappingURL=embedding-providers.d.ts.map