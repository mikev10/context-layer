/**
 * Embed Module
 *
 * Handles vector embedding generation using OpenAI's embedding models.
 * Produces embeddings for semantic search and RAG applications.
 */
import type { EnrichedChunk, EmbeddedChunk, EmbedOptions } from '../types/index.js';
/**
 * Generate embeddings for multiple chunks
 *
 * Processes chunks in batches to optimize API calls.
 * Uses OpenAI's embedding models (text-embedding-3-small by default).
 *
 * @param chunks - Array of chunks to embed
 * @param options - Embedding options including model and API key
 * @returns Array of chunks with embeddings
 */
export declare function embedChunks(chunks: EnrichedChunk[], options: EmbedOptions): Promise<EmbeddedChunk[]>;
/**
 * Generate embedding for a single text
 *
 * Utility function for MCP's search functionality.
 * Generates a single embedding vector for query text.
 *
 * @param text - Text to generate embedding for
 * @param options - Embedding options including model and API key
 * @returns Embedding vector as array of numbers
 */
export declare function generateEmbedding(text: string, options: EmbedOptions): Promise<number[]>;
//# sourceMappingURL=embed.d.ts.map