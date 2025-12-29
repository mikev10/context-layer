/**
 * Chunk Module
 *
 * Handles token-aware semantic chunking of text content.
 * Splits content at paragraph and sentence boundaries while respecting token limits.
 */
import type { ExtractedPage, Chunk, ChunkOptions } from '../types/index.js';
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
export declare function chunkContent(content: string, chunkSize: number, overlap: number): string[];
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
export declare function chunkPages(pages: ExtractedPage[], options: ChunkOptions): Chunk[];
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
export declare function chunkText(text: string, options?: Partial<ChunkOptions>): Chunk[];
//# sourceMappingURL=chunk.d.ts.map