/**
 * Knowledge Base Storage Module
 *
 * Handles CRUD operations for knowledge bases and their chunks.
 * Uses Apify Key-Value Store for metadata and Named Datasets for chunk storage.
 */

import crypto from 'crypto';
import { Actor, log } from 'apify';
import type { KnowledgeBase, KnowledgeBaseChunk, EmbeddedChunk } from '../types/index.js';

// ============================================================================
// Constants
// ============================================================================

const KB_INDEX_KEY = 'kb_index';
const KB_META_PREFIX = 'kb_';
const KB_META_SUFFIX = '_meta';

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate deterministic KB ID from source URL using MD5 hash
 *
 * @param sourceUrl - The URL that was crawled
 * @returns 12-character hex string
 */
export function generateKBId(sourceUrl: string): string {
    return crypto.createHash('md5').update(sourceUrl).digest('hex').slice(0, 12);
}

/**
 * Extract hostname from URL for human-readable name
 */
function extractHostname(url: string): string {
    try {
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        return url;
    }
}

// ============================================================================
// Index Management
// ============================================================================

/**
 * Add KB ID to the global index
 */
async function addToKBIndex(id: string): Promise<void> {
    const store = await Actor.openKeyValueStore();
    const index = await store.getValue<string[]>(KB_INDEX_KEY) ?? [];
    if (!index.includes(id)) {
        index.push(id);
        await store.setValue(KB_INDEX_KEY, index);
    }
}

/**
 * Remove KB ID from the global index
 */
async function removeFromKBIndex(id: string): Promise<void> {
    const store = await Actor.openKeyValueStore();
    const index = await store.getValue<string[]>(KB_INDEX_KEY) ?? [];
    const filtered = index.filter(kbId => kbId !== id);
    await store.setValue(KB_INDEX_KEY, filtered);
}

// ============================================================================
// Knowledge Base CRUD Operations
// ============================================================================

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
export async function createKnowledgeBase(
    sourceUrl: string,
    config: CreateKBConfig
): Promise<KnowledgeBase> {
    const id = generateKBId(sourceUrl);
    const now = new Date().toISOString();

    const kb: KnowledgeBase = {
        id,
        name: extractHostname(sourceUrl),
        sourceUrl,
        createdAt: now,
        updatedAt: now,
        status: 'processing',
        stats: {
            pageCount: 0,
            chunkCount: 0,
            totalTokens: 0,
        },
        config: {
            chunkSize: config.chunkSize,
            chunkOverlap: config.chunkOverlap,
            outputFormat: config.outputFormat,
            hasEmbeddings: config.hasEmbeddings,
            hasEnrichment: config.hasEnrichment,
        },
    };

    const store = await Actor.openKeyValueStore();
    await store.setValue(`${KB_META_PREFIX}${id}${KB_META_SUFFIX}`, kb);
    await addToKBIndex(id);

    log.info(`Created knowledge base: ${id}`, { sourceUrl, name: kb.name });
    return kb;
}

/**
 * Get a knowledge base by ID
 *
 * @param id - Knowledge base ID
 * @returns The knowledge base or null if not found
 */
export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
    const store = await Actor.openKeyValueStore();
    return store.getValue<KnowledgeBase>(`${KB_META_PREFIX}${id}${KB_META_SUFFIX}`);
}

/**
 * List all knowledge bases
 *
 * @returns Array of knowledge base metadata
 */
export async function listKnowledgeBases(): Promise<KnowledgeBase[]> {
    const store = await Actor.openKeyValueStore();
    const index = await store.getValue<string[]>(KB_INDEX_KEY) ?? [];

    const knowledgeBases: KnowledgeBase[] = [];
    for (const id of index) {
        const kb = await getKnowledgeBase(id);
        if (kb) {
            knowledgeBases.push(kb);
        }
    }

    return knowledgeBases;
}

/**
 * Update knowledge base status
 *
 * @param id - Knowledge base ID
 * @param status - New status
 */
export async function updateKnowledgeBaseStatus(
    id: string,
    status: KnowledgeBase['status']
): Promise<void> {
    const kb = await getKnowledgeBase(id);
    if (!kb) {
        throw new Error(`Knowledge base not found: ${id}`);
    }

    kb.status = status;
    kb.updatedAt = new Date().toISOString();

    const store = await Actor.openKeyValueStore();
    await store.setValue(`${KB_META_PREFIX}${id}${KB_META_SUFFIX}`, kb);
}

/**
 * Update knowledge base stats
 *
 * @param id - Knowledge base ID
 * @param stats - Updated stats
 */
export async function updateKnowledgeBaseStats(
    id: string,
    stats: Partial<KnowledgeBase['stats']>
): Promise<void> {
    const kb = await getKnowledgeBase(id);
    if (!kb) {
        throw new Error(`Knowledge base not found: ${id}`);
    }

    kb.stats = { ...kb.stats, ...stats };
    kb.updatedAt = new Date().toISOString();

    const store = await Actor.openKeyValueStore();
    await store.setValue(`${KB_META_PREFIX}${id}${KB_META_SUFFIX}`, kb);
}

/**
 * Delete a knowledge base and all its chunks
 *
 * @param id - Knowledge base ID
 */
export async function deleteKnowledgeBase(id: string): Promise<void> {
    // Delete chunks dataset
    try {
        const dataset = await Actor.openDataset(`kb-${id}`);
        await dataset.drop();
    } catch (error) {
        log.warning(`Could not delete chunks dataset for KB ${id}`, { error });
    }

    // Delete metadata
    const store = await Actor.openKeyValueStore();
    await store.setValue(`${KB_META_PREFIX}${id}${KB_META_SUFFIX}`, null);

    // Remove from index
    await removeFromKBIndex(id);

    log.info(`Deleted knowledge base: ${id}`);
}

// ============================================================================
// Chunk Storage Operations
// ============================================================================

/**
 * Convert pipeline chunks to KB chunks
 */
export function convertToKBChunks(
    chunks: EmbeddedChunk[],
    knowledgeBaseId: string
): KnowledgeBaseChunk[] {
    return chunks.map(chunk => ({
        id: chunk.id,
        knowledgeBaseId,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: chunk.embedding,
        metadata: {
            sourceUrl: chunk.metadata.source_url,
            title: chunk.metadata.title,
            section: chunk.metadata.section,
            chunkIndex: chunk.metadata.chunk_index,
            totalChunks: chunk.metadata.total_chunks,
        },
        enrichment: chunk.enrichment ? {
            summary: chunk.enrichment.summary,
            questions: chunk.enrichment.questions,
        } : undefined,
    }));
}

/**
 * Save chunks to a knowledge base
 *
 * @param kbId - Knowledge base ID
 * @param chunks - Chunks to save
 */
export async function saveChunks(
    kbId: string,
    chunks: KnowledgeBaseChunk[]
): Promise<void> {
    if (chunks.length === 0) {
        return;
    }

    const dataset = await Actor.openDataset(`kb-${kbId}`);
    await dataset.pushData(chunks);

    // Update KB stats
    const totalTokens = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);
    const kb = await getKnowledgeBase(kbId);
    if (kb) {
        await updateKnowledgeBaseStats(kbId, {
            chunkCount: kb.stats.chunkCount + chunks.length,
            totalTokens: kb.stats.totalTokens + totalTokens,
        });
    }

    log.info(`Saved ${chunks.length} chunks to KB ${kbId}`);
}

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
export async function getChunks(
    kbId: string,
    options: GetChunksOptions = {}
): Promise<{ chunks: KnowledgeBaseChunk[]; total: number }> {
    const { offset = 0, limit = 100 } = options;

    const dataset = await Actor.openDataset(`kb-${kbId}`);
    const { items, total } = await dataset.getData({
        offset,
        limit,
    });

    return { chunks: items as KnowledgeBaseChunk[], total };
}

// ============================================================================
// Search Functions
// ============================================================================

/**
 * Search chunks by text content (case-insensitive)
 *
 * @param kbId - Knowledge base ID
 * @param query - Search query
 * @param limit - Maximum results to return
 * @returns Matching chunks
 */
export async function searchKnowledgeBase(
    kbId: string,
    query: string,
    limit: number = 10
): Promise<KnowledgeBaseChunk[]> {
    const queryLower = query.toLowerCase();
    const results: KnowledgeBaseChunk[] = [];

    // Fetch all chunks and filter
    // Note: For large KBs, consider implementing server-side search
    const dataset = await Actor.openDataset(`kb-${kbId}`);
    let offset = 0;
    const batchSize = 100;

    while (results.length < limit) {
        const { items } = await dataset.getData({
            offset,
            limit: batchSize,
        });

        if (items.length === 0) {
            break;
        }

        for (const item of items) {
            const chunk = item as KnowledgeBaseChunk;
            if (chunk.content.toLowerCase().includes(queryLower)) {
                results.push(chunk);
                if (results.length >= limit) {
                    break;
                }
            }
        }

        offset += batchSize;
    }

    return results;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
    }

    let dot = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] ** 2;
        normB += b[i] ** 2;
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    if (denominator === 0) {
        return 0;
    }

    return dot / denominator;
}

/**
 * Semantic search using pre-computed embeddings
 *
 * @param kbId - Knowledge base ID
 * @param queryEmbedding - Query vector
 * @param limit - Maximum results to return
 * @returns Chunks sorted by similarity (highest first)
 */
export async function semanticSearch(
    kbId: string,
    queryEmbedding: number[],
    limit: number = 10
): Promise<Array<KnowledgeBaseChunk & { similarity: number }>> {
    const scored: Array<KnowledgeBaseChunk & { similarity: number }> = [];

    // Fetch all chunks with embeddings
    const dataset = await Actor.openDataset(`kb-${kbId}`);
    let offset = 0;
    const batchSize = 100;

    while (true) {
        const { items } = await dataset.getData({
            offset,
            limit: batchSize,
        });

        if (items.length === 0) {
            break;
        }

        for (const item of items) {
            const chunk = item as KnowledgeBaseChunk;
            if (chunk.embedding && chunk.embedding.length > 0) {
                const similarity = cosineSimilarity(queryEmbedding, chunk.embedding);
                scored.push({ ...chunk, similarity });
            }
        }

        offset += batchSize;
    }

    // Sort by similarity (descending) and return top results
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
}
