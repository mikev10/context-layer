/**
 * Enrich Module
 *
 * Handles LLM-based enrichment of chunks using OpenAI or Anthropic.
 * Generates Q&A pairs and summaries for enhanced RAG/fine-tuning.
 */
import type { Chunk, EnrichedChunk, EnrichOptions } from '../types/index.js';
/**
 * Enrich multiple chunks with LLM-generated content
 *
 * Processes chunks in batches to avoid rate limits.
 * Adds summaries and/or Q&A pairs based on configuration.
 *
 * @param chunks - Array of chunks to enrich
 * @param options - Enrichment options including provider and API key
 * @returns Array of enriched chunks
 */
export declare function enrichChunks(chunks: Chunk[], options: EnrichOptions): Promise<EnrichedChunk[]>;
//# sourceMappingURL=enrich.d.ts.map