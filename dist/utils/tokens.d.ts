/**
 * Token counting utilities using tiktoken
 *
 * This module provides token counting for accurate chunk sizing.
 */
/**
 * Count the number of tokens in a text string
 *
 * Uses GPT-4 tokenizer for accurate counting compatible with OpenAI models.
 *
 * @param text - The text to count tokens for
 * @returns The number of tokens
 */
export declare function countTokens(text: string): number;
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
export declare function getDefaultChunkSize(outputFormat: string): number;
//# sourceMappingURL=tokens.d.ts.map