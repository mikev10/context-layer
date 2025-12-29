/**
 * Chunk Module
 *
 * Handles token-aware semantic chunking of text content.
 * Splits content at paragraph and sentence boundaries while respecting token limits.
 */

import { log } from 'apify';
import type { ExtractedPage, Chunk, ChunkOptions } from '../types/index.js';
import { countTokens, getDefaultChunkSize } from '../utils/tokens.js';

/**
 * Get overlap text from end of chunk
 *
 * Extracts words from the end of text to maintain context between chunks.
 *
 * @param text - Source text to get overlap from
 * @param overlapTokens - Target number of tokens for overlap
 * @returns Overlap text
 */
function getOverlapText(text: string, overlapTokens: number): string {
    if (overlapTokens <= 0) return '';

    const words = text.split(/\s+/);
    let result = '';
    let tokens = 0;

    for (let i = words.length - 1; i >= 0 && tokens < overlapTokens; i--) {
        result = words[i] + (result ? ' ' + result : '');
        tokens = countTokens(result);
    }

    return result;
}

/**
 * Chunk content intelligently based on semantic boundaries
 *
 * Algorithm:
 * 1. Split by paragraphs (double newlines)
 * 2. If paragraph exceeds chunk size, split by sentences
 * 3. Maintain overlap from end of previous chunk for context
 * 4. Track token counts for each chunk
 *
 * @param content - Text content to chunk
 * @param chunkSize - Maximum tokens per chunk
 * @param overlap - Number of overlap tokens between chunks
 * @returns Array of chunk text strings
 */
export function chunkContent(
    content: string,
    chunkSize: number,
    overlap: number
): string[] {
    const chunks: string[] = [];
    const paragraphs = content.split(/\n\n+/);

    let currentChunk = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
        const paragraphTokens = countTokens(paragraph);

        // If single paragraph exceeds chunk size, split it
        if (paragraphTokens > chunkSize) {
            // Save current chunk if not empty
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
                currentTokens = 0;
            }

            // Split large paragraph by sentences
            const sentences = paragraph.split(/(?<=[.!?])\s+/);
            for (const sentence of sentences) {
                const sentenceTokens = countTokens(sentence);
                if (currentTokens + sentenceTokens > chunkSize && currentChunk) {
                    chunks.push(currentChunk.trim());
                    // Keep overlap
                    const overlapText = getOverlapText(currentChunk, overlap);
                    currentChunk = overlapText + ' ' + sentence;
                    currentTokens = countTokens(currentChunk);
                } else {
                    currentChunk += (currentChunk ? ' ' : '') + sentence;
                    currentTokens += sentenceTokens;
                }
            }
        } else if (currentTokens + paragraphTokens > chunkSize) {
            // Save current chunk and start new one
            chunks.push(currentChunk.trim());
            // Keep overlap
            const overlapText = getOverlapText(currentChunk, overlap);
            currentChunk = overlapText + '\n\n' + paragraph;
            currentTokens = countTokens(currentChunk);
        } else {
            currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            currentTokens += paragraphTokens;
        }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Chunk multiple extracted pages into Chunk objects
 *
 * Processes all pages and creates Chunk objects with:
 * - Unique IDs
 * - Token counts
 * - Source metadata
 *
 * @param pages - Array of extracted pages
 * @param options - Chunking options
 * @returns Array of Chunk objects
 */
export function chunkPages(
    pages: ExtractedPage[],
    options: ChunkOptions
): Chunk[] {
    const chunkSize = options.chunkSize || getDefaultChunkSize(options.outputFormat);
    const chunkOverlap = options.chunkOverlap ?? 50;

    const allChunks: Chunk[] = [];
    let chunkId = 0;

    for (const page of pages) {
        const textChunks = chunkContent(page.content, chunkSize, chunkOverlap);

        for (let i = 0; i < textChunks.length; i++) {
            allChunks.push({
                id: `chunk-${String(chunkId++).padStart(4, '0')}`,
                content: textChunks[i],
                tokenCount: countTokens(textChunks[i]),
                metadata: {
                    source_url: page.url,
                    title: page.title,
                    section: page.headings[0] || '',
                    chunk_index: i,
                    total_chunks: textChunks.length,
                },
            });
        }
    }

    log.info(`Created ${allChunks.length} chunks from ${pages.length} pages`);
    return allChunks;
}

/**
 * Chunk arbitrary text into Chunk objects
 *
 * Standalone utility function for MCP's chunk_text tool.
 * Creates chunks from plain text without source metadata.
 *
 * @param text - Text to chunk
 * @param options - Partial chunking options
 * @returns Array of Chunk objects
 */
export function chunkText(
    text: string,
    options: Partial<ChunkOptions> = {}
): Chunk[] {
    const chunkSize = options.chunkSize || 500;
    const chunkOverlap = options.chunkOverlap ?? 50;

    const textChunks = chunkContent(text, chunkSize, chunkOverlap);

    return textChunks.map((content, i) => ({
        id: `chunk-${String(i).padStart(4, '0')}`,
        content,
        tokenCount: countTokens(content),
        metadata: {
            source_url: '',
            title: '',
            section: '',
            chunk_index: i,
            total_chunks: textChunks.length,
        },
    }));
}
