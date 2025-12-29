/**
 * Output formatting utilities
 *
 * This module handles formatting chunks into various output formats:
 * - RAG (vector DB ready JSON)
 * - Fine-tuning (OpenAI and Alpaca formats)
 * - Markdown (human-readable document)
 */
import type { Chunk, EnrichmentConfig } from '../types/index.js';
/**
 * Format chunks based on selected output format
 *
 * @param chunks - The chunks to format
 * @param format - The output format ('rag', 'finetune-openai', 'finetune-alpaca', 'markdown')
 * @param enrichment - The enrichment configuration
 * @returns Formatted output records
 */
export declare function formatOutput(chunks: Chunk[], format: string, enrichment: EnrichmentConfig): unknown[];
/**
 * Generate a proper Markdown document from chunks
 *
 * Groups chunks by source URL and creates a readable document with:
 * - Page headers with source URLs
 * - Combined chunk content
 * - Optional enrichment (summaries, questions)
 *
 * @param chunks - The chunks to convert
 * @param enrichment - The enrichment configuration
 * @returns A markdown string
 */
export declare function generateMarkdownDocument(chunks: Chunk[], enrichment: EnrichmentConfig): string;
/**
 * Generate OpenAI fine-tuning format
 *
 * Creates conversation-style training data with system/user/assistant messages.
 *
 * @param chunks - The chunks to convert
 * @param enrichment - The enrichment configuration
 * @returns Array of OpenAI format records
 */
export declare function generateOpenAIFormat(chunks: Chunk[], enrichment: EnrichmentConfig): unknown[];
/**
 * Generate Alpaca fine-tuning format
 *
 * Creates instruction/input/output style training data.
 *
 * @param chunks - The chunks to convert
 * @param enrichment - The enrichment configuration
 * @returns Array of Alpaca format records
 */
export declare function generateAlpacaFormat(chunks: Chunk[], enrichment: EnrichmentConfig): unknown[];
//# sourceMappingURL=format.d.ts.map