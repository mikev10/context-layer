/**
 * Token counting utilities using tiktoken
 *
 * This module provides token counting for accurate chunk sizing.
 */

import { encoding_for_model } from 'tiktoken';

// Initialize tiktoken encoder once (expensive operation)
const encoder = encoding_for_model('gpt-4');

/**
 * Count the number of tokens in a text string
 *
 * Uses GPT-4 tokenizer for accurate counting compatible with OpenAI models.
 *
 * @param text - The text to count tokens for
 * @returns The number of tokens
 */
export function countTokens(text: string): number {
    return encoder.encode(text).length;
}

/**
 * Get the default chunk size based on output format
 *
 * Different formats have different optimal chunk sizes:
 * - RAG: 500 tokens (small for precise retrieval)
 * - Fine-tuning: 1000 tokens (medium for context)
 * - Markdown: 2000 tokens (large for readability)
 *
 * @param outputFormat - The output format
 * @returns The recommended chunk size in tokens
 */
export function getDefaultChunkSize(outputFormat: string): number {
    switch (outputFormat) {
        case 'rag':
            return 500;
        case 'finetune-openai':
        case 'finetune-alpaca':
            return 1000;
        case 'markdown':
            return 2000;
        default:
            return 500;
    }
}
