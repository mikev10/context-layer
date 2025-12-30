/**
 * Knowledge Base Storage Module
 *
 * Handles CRUD operations for knowledge bases and their chunks.
 * Uses Apify Key-Value Store for metadata and Named Datasets for chunk storage.
 */
import type { KnowledgeBase, KnowledgeBaseChunk, EmbeddedChunk } from '../types/index.js';
/**
 * Generate deterministic KB ID from source URL using MD5 hash
 *
 * @param sourceUrl - The URL that was crawled
 * @returns 12-character hex string
 */
export declare function generateKBId(sourceUrl: string): string;
/**
 * Configuration for creating a new knowledge base
 */
export interface CreateKBConfig {
    chunkSize: number;
    chunkOverlap: number;
    outputFormat: string;
    hasEmbeddings: boolean;
    hasEnrichment: boolean;
}
/**
 * Create a new knowledge base
 *
 * @param sourceUrl - The URL being crawled
 * @param config - Processing configuration
 * @returns The created knowledge base
 */
export declare function createKnowledgeBase(sourceUrl: string, config: CreateKBConfig): Promise<KnowledgeBase>;
/**
 * Get a knowledge base by ID
 *
 * @param id - Knowledge base ID
 * @returns The knowledge base or null if not found
 */
export declare function getKnowledgeBase(id: string): Promise<KnowledgeBase | null>;
/**
 * List all knowledge bases
 *
 * @returns Array of knowledge base metadata
 */
export declare function listKnowledgeBases(): Promise<KnowledgeBase[]>;
/**
 * Update knowledge base status
 *
 * @param id - Knowledge base ID
 * @param status - New status
 */
export declare function updateKnowledgeBaseStatus(id: string, status: KnowledgeBase['status']): Promise<void>;
/**
 * Update knowledge base stats
 *
 * @param id - Knowledge base ID
 * @param stats - Updated stats
 */
export declare function updateKnowledgeBaseStats(id: string, stats: Partial<KnowledgeBase['stats']>): Promise<void>;
/**
 * Delete a knowledge base and all its chunks
 *
 * @param id - Knowledge base ID
 */
export declare function deleteKnowledgeBase(id: string): Promise<void>;
/**
 * Convert pipeline chunks to KB chunks
 */
export declare function convertToKBChunks(chunks: EmbeddedChunk[], knowledgeBaseId: string): KnowledgeBaseChunk[];
/**
 * Save chunks to a knowledge base
 *
 * @param kbId - Knowledge base ID
 * @param chunks - Chunks to save
 */
export declare function saveChunks(kbId: string, chunks: KnowledgeBaseChunk[]): Promise<void>;
/**
 * Options for retrieving chunks
 */
export interface GetChunksOptions {
    offset?: number;
    limit?: number;
}
/**
 * Get chunks from a knowledge base with pagination
 *
 * @param kbId - Knowledge base ID
 * @param options - Pagination options
 * @returns Chunks and total count
 */
export declare function getChunks(kbId: string, options?: GetChunksOptions): Promise<{
    chunks: KnowledgeBaseChunk[];
    total: number;
}>;
/**
 * Search chunks by text content (case-insensitive)
 *
 * @param kbId - Knowledge base ID
 * @param query - Search query
 * @param limit - Maximum results to return
 * @returns Matching chunks
 */
export declare function searchKnowledgeBase(kbId: string, query: string, limit?: number): Promise<KnowledgeBaseChunk[]>;
/**
 * Calculate cosine similarity between two vectors
 */
export declare function cosineSimilarity(a: number[], b: number[]): number;
/**
 * Semantic search using pre-computed embeddings
 *
 * @param kbId - Knowledge base ID
 * @param queryEmbedding - Query vector
 * @param limit - Maximum results to return
 * @returns Chunks sorted by similarity (highest first)
 */
export declare function semanticSearch(kbId: string, queryEmbedding: number[], limit?: number): Promise<Array<KnowledgeBaseChunk & {
    similarity: number;
}>>;
//# sourceMappingURL=knowledge-base.d.ts.map