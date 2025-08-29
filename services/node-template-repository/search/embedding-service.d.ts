/**
 * Embedding service for semantic search
 * Generates vector embeddings for templates using various AI vendor models
 */
import { NodeTemplate, TemplateEmbeddings } from '../core/models';
export interface EmbeddingConfig {
    vendor: 'openai' | 'azure-openai' | 'google' | 'mock';
    model?: string;
    dimensions: number;
    apiKey?: string;
    batchSize: number;
    endpoint?: string;
    apiVersion?: string;
    region?: string;
    projectId?: string;
    rateLimitDelay?: number;
}
export declare class EmbeddingService {
    private config;
    private dimensions;
    private vendor;
    constructor(config: EmbeddingConfig);
    private createVendor;
    private getDefaultModel;
    generateEmbeddings(template: NodeTemplate): Promise<TemplateEmbeddings>;
    generateQueryEmbedding(query: string): Promise<Float32Array>;
    /**
     * Get vendor information for debugging/logging
     */
    getVendorInfo(): {
        vendor: string;
        model: string;
        dimensions: number;
    };
    /**
     * Create embedding service from environment variables
     */
    static fromEnvironment(): EmbeddingService;
    /**
     * Get embedding configuration from environment variables
     */
    static getConfigFromEnvironment(): EmbeddingConfig;
    private generateMockEmbeddings;
    private generateMockEmbedding;
    private generateTitleText;
    private generateDescriptionText;
    private generateCombinedText;
    private generateCapabilityText;
    private generateUseCaseText;
    static cosineSimilarity(a: Float32Array, b: Float32Array): number;
    static euclideanDistance(a: Float32Array, b: Float32Array): number;
}
//# sourceMappingURL=embedding-service.d.ts.map