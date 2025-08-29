/**
 * Core data models for Node Template Repository
 */
export declare enum TemplateStatus {
    DRAFT = "draft",
    ACTIVE = "active",
    DEPRECATED = "deprecated",
    ARCHIVED = "archived"
}
export declare enum NodeShape {
    RECTANGLE = "rectangle",
    ROUNDED = "rounded",
    CIRCLE = "circle",
    DIAMOND = "diamond",
    HEXAGON = "hexagon"
}
export interface TemplateSource {
    type: 'file' | 'api' | 'script' | 'manual' | 'generated';
    location?: string;
    schema?: any;
    generatorVersion?: string;
}
export interface Port {
    id: string;
    label: string;
    type: 'input' | 'output';
    position?: 'left' | 'right' | 'top' | 'bottom';
    description?: string;
    schema?: any;
    required?: boolean;
    multiple?: boolean;
}
export interface PropertyDefinition {
    type: string;
    label: string;
    defaultValue?: any;
    description?: string;
    required?: boolean;
    options?: any[];
    validation?: any;
    visibleWhen?: string;
    format?: string;
    placeholder?: string;
    min?: number;
    max?: number;
    readOnly?: boolean;
    multiple?: boolean;
    language?: string;
}
export interface PropertyRule {
    when: string;
    updates: {
        title?: string;
        subtitle?: string;
        icon?: string;
        variant?: string;
        description?: string;
        ports?: Port[];
    };
}
export interface PropertyRules {
    triggers: string[];
    rules: PropertyRule[];
}
export interface NodeTemplate {
    id: string;
    version: string;
    status: TemplateStatus;
    type: string;
    title: string;
    subtitle?: string;
    description: string;
    category: string;
    subcategory?: string;
    tags: string[];
    icon: string;
    variant?: string;
    shape: NodeShape;
    size: 'small' | 'medium' | 'large';
    ports: Port[];
    properties: Record<string, PropertyDefinition>;
    propertyRules?: PropertyRules;
    requiredEnvVars?: string[];
    dependencies?: string[];
    source: TemplateSource;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    updatedBy: string;
    isActive: boolean;
}
export interface TemplateEmbeddings {
    title: Float32Array;
    description: Float32Array;
    combined: Float32Array;
    capabilities: Float32Array;
    useCase: Float32Array;
}
export interface TemplateRepository {
    id: string;
    templateId: string;
    templateData: NodeTemplate;
    embeddings: TemplateEmbeddings;
    capabilities: string[];
    inputTypes: string[];
    outputTypes: string[];
    useCases: string[];
    relationships: {
        commonlyUsedWith: string[];
        alternatives: string[];
        upgrades: string[];
        requiredTemplates: string[];
    };
    stats: {
        usageCount: number;
        averageRating: number;
        lastUsed?: Date;
        errorRate: number;
        averageExecutionTime?: number;
    };
    searchText: string;
    searchVector: Float32Array;
    keywords: string[];
    versions: TemplateVersion[];
    latestVersion: string;
    createdAt: Date;
    updatedAt: Date;
    indexedAt: Date;
    lastValidated?: Date;
}
export interface TemplateVersion {
    id: string;
    templateId: string;
    version: string;
    changes: VersionChange[];
    releaseNotes?: string;
    breaking: boolean;
    deprecated: boolean;
    createdAt: Date;
    createdBy: string;
}
export interface VersionChange {
    type: 'added' | 'modified' | 'removed' | 'deprecated';
    field: string;
    description: string;
    breaking: boolean;
}
export interface DynamicTemplate {
    id: string;
    name: string;
    sourceType: 'api' | 'script' | 'database' | 'graphql';
    apiDefinition?: {
        openApiSpec?: string;
        endpoint: string;
        method: string;
        authentication?: any;
        headers?: Record<string, string>;
        requestSchema?: any;
        responseSchema?: any;
    };
    scriptDefinition?: {
        language: 'javascript' | 'python' | 'sql';
        code: string;
        runtime?: string;
        dependencies?: string[];
    };
    generationRules: {
        portMapping: any[];
        propertyMapping: any[];
        errorHandling: any;
    };
    generatedTemplate?: NodeTemplate;
    generatedAt?: Date;
    validationStatus?: 'pending' | 'valid' | 'invalid';
}
export interface SearchQuery {
    query: string;
    category?: string;
    subcategory?: string;
    tags?: string[];
    capabilities?: string[];
    limit?: number;
    offset?: number;
    includeDeprecated?: boolean;
}
export interface SearchResult {
    template: NodeTemplate;
    score: number;
    highlights: {
        title?: string;
        description?: string;
        capabilities?: string[];
    };
    relatedTemplates?: string[];
}
export interface IngestionResult {
    processed: number;
    succeeded: number;
    failed: number;
    skipped: number;
    errors: Array<{
        file: string;
        error: string;
    }>;
}
export interface TemplateFile {
    path: string;
    category: string;
    lastModified: Date;
}
//# sourceMappingURL=models.d.ts.map