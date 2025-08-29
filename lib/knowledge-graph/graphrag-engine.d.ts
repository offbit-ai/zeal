import Graph from 'graphology';
import { RelevanceScore } from './types';
export interface GraphRAGIntent {
    action: string;
    services: string[];
    capabilities: string[];
    dataFlow: string[];
}
export declare class GraphRAGEngine {
    private graph;
    private llm;
    private embeddings;
    private graphSnapshot;
    private snapshotLoaded;
    constructor(graph: Graph, llm: any, embeddings: any);
    private buildSnapshotFromGraph;
    private loadGraphSnapshot;
    extractIntent(userRequest: string): Promise<GraphRAGIntent>;
    private basicIntentExtraction;
    findRelevantNodes(userRequest: string, intent: GraphRAGIntent): Promise<RelevanceScore[]>;
    preventDuplicates(selectedNodes: RelevanceScore[]): Promise<RelevanceScore[]>;
    findOptimalConnections(nodes: RelevanceScore[]): Promise<Array<{
        from: string;
        to: string;
        confidence: number;
    }>>;
    /**
     * Pre-filter nodes using semantic similarity search with embeddings
     * This dramatically reduces token usage by filtering out semantically irrelevant nodes
     */
    private preFilterRelevantNodes;
    private semanticPreFilter;
    private keywordPreFilter;
    private cleanJsonResponse;
    explainSelection(selectedNodes: RelevanceScore[]): string;
}
//# sourceMappingURL=graphrag-engine.d.ts.map