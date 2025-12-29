/**
 * Embed Module
 *
 * Handles vector embedding generation using OpenAI's embedding models.
 * Produces embeddings for semantic search and RAG applications.
 */

import { log } from 'apify';
import OpenAI from 'openai';
import type { EnrichedChunk, EmbeddedChunk, EmbedOptions } from '../types/index.js';

/** Batch size for embedding API calls */
const BATCH_SIZE = 20;

/** Delay between batches in milliseconds */
const BATCH_DELAY = 200;

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
export async function embedChunks(
    chunks: EnrichedChunk[],
    options: EmbedOptions
): Promise<EmbeddedChunk[]> {
    log.info(`Generating embeddings for ${chunks.length} chunks using ${options.model}...`);

    const openai = new OpenAI({ apiKey: options.apiKey });
    const embeddedChunks: EmbeddedChunk[] = [];

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const texts = batch.map(chunk => chunk.content);

        try {
            const response = await openai.embeddings.create({
                model: options.model,
                input: texts,
            });

            for (let j = 0; j < batch.length; j++) {
                embeddedChunks.push({
                    ...batch[j],
                    embedding: response.data[j].embedding,
                });
            }

            log.info(
                `Embedded chunks ${i + 1} to ${Math.min(i + BATCH_SIZE, chunks.length)} of ${chunks.length}`
            );

            // Small delay between batches to avoid rate limits
            if (i + BATCH_SIZE < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
            }
        } catch (error) {
            log.error(`Failed to generate embeddings for batch starting at ${i}: ${error}`);
            // Add chunks without embeddings on failure
            for (const chunk of batch) {
                embeddedChunks.push(chunk);
            }
        }
    }

    return embeddedChunks;
}

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
export async function generateEmbedding(
    text: string,
    options: EmbedOptions
): Promise<number[]> {
    const openai = new OpenAI({ apiKey: options.apiKey });

    const response = await openai.embeddings.create({
        model: options.model,
        input: text,
    });

    return response.data[0].embedding;
}
