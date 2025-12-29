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
export function formatOutput(
    chunks: Chunk[],
    format: string,
    enrichment: EnrichmentConfig
): unknown[] {
    switch (format) {
        case 'rag':
            return chunks.map(chunk => {
                const output: Record<string, unknown> = {
                    id: chunk.id,
                    content: chunk.content,
                    metadata: chunk.metadata,
                    enrichment: chunk.enrichment || {},
                };
                if (chunk.embedding) {
                    output.embedding = chunk.embedding;
                }
                return output;
            });

        case 'finetune-openai':
            return generateOpenAIFormat(chunks, enrichment);

        case 'finetune-alpaca':
            return generateAlpacaFormat(chunks, enrichment);

        case 'markdown':
            // For markdown, we return an empty array for the dataset
            // The actual markdown file is generated separately
            return [];

        default:
            return chunks;
    }
}

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
export function generateMarkdownDocument(
    chunks: Chunk[],
    enrichment: EnrichmentConfig
): string {
    const lines: string[] = [];

    // Group chunks by source URL to create sections
    const pageGroups = new Map<string, Chunk[]>();
    for (const chunk of chunks) {
        const url = chunk.metadata.source_url;
        if (!pageGroups.has(url)) {
            pageGroups.set(url, []);
        }
        pageGroups.get(url)!.push(chunk);
    }

    // Generate markdown for each page
    for (const [url, pageChunks] of pageGroups) {
        // Sort chunks by index
        pageChunks.sort((a, b) => a.metadata.chunk_index - b.metadata.chunk_index);

        const title = pageChunks[0].metadata.title || 'Untitled';

        // Page header
        lines.push(`# ${title}`);
        lines.push('');
        lines.push(`> **Source:** ${url}`);
        lines.push('');

        // Combine all chunks for this page
        for (const chunk of pageChunks) {
            lines.push(chunk.content);
            lines.push('');

            // Add enrichment if available
            if (enrichment.enabled && chunk.enrichment) {
                if (chunk.enrichment.summary) {
                    lines.push(`> **Summary:** ${chunk.enrichment.summary}`);
                    lines.push('');
                }
                if (chunk.enrichment.questions && chunk.enrichment.questions.length > 0) {
                    lines.push('**Related Questions:**');
                    for (const q of chunk.enrichment.questions) {
                        lines.push(`- ${q}`);
                    }
                    lines.push('');
                }
            }
        }

        // Page separator
        lines.push('---');
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Generate OpenAI fine-tuning format
 *
 * Creates conversation-style training data with system/user/assistant messages.
 *
 * @param chunks - The chunks to convert
 * @param enrichment - The enrichment configuration
 * @returns Array of OpenAI format records
 */
export function generateOpenAIFormat(
    chunks: Chunk[],
    enrichment: EnrichmentConfig
): unknown[] {
    const records: unknown[] = [];

    for (const chunk of chunks) {
        if (enrichment.enabled && chunk.enrichment?.questions) {
            // Use generated Q&A
            for (const question of chunk.enrichment.questions) {
                records.push({
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant.' },
                        { role: 'user', content: question },
                        { role: 'assistant', content: chunk.content },
                    ],
                });
            }
        } else {
            // Use chunk as response to "explain this" type question
            records.push({
                messages: [
                    { role: 'system', content: 'You are a helpful assistant.' },
                    { role: 'user', content: `Explain: ${chunk.metadata.title}` },
                    { role: 'assistant', content: chunk.content },
                ],
            });
        }
    }

    return records;
}

/**
 * Generate Alpaca fine-tuning format
 *
 * Creates instruction/input/output style training data.
 *
 * @param chunks - The chunks to convert
 * @param enrichment - The enrichment configuration
 * @returns Array of Alpaca format records
 */
export function generateAlpacaFormat(
    chunks: Chunk[],
    enrichment: EnrichmentConfig
): unknown[] {
    const records: unknown[] = [];

    for (const chunk of chunks) {
        if (enrichment.enabled && chunk.enrichment?.questions) {
            for (const question of chunk.enrichment.questions) {
                records.push({
                    instruction: question,
                    input: '',
                    output: chunk.content,
                });
            }
        } else {
            records.push({
                instruction: `Explain: ${chunk.metadata.title}`,
                input: '',
                output: chunk.content,
            });
        }
    }

    return records;
}
