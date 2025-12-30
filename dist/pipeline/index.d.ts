/**
 * Pipeline Orchestrator
 *
 * Central coordinator that chains pipeline modules together.
 * Provides the main runPipeline function and re-exports individual modules.
 */
import type { PipelineInput, PipelineOutput } from '../types/index.js';
import { crawlSite } from './crawl.js';
import { extractContent, extractPages, extractFromUrl } from './extract.js';
import { chunkPages, chunkText, chunkContent } from './chunk.js';
import { enrichChunks } from './enrich.js';
import { embedChunks, generateEmbedding } from './embed.js';
/**
 * Run the complete documentation processing pipeline
 *
 * Executes stages in order:
 * 1. Crawl - Collect HTML from documentation site
 * 2. Extract - Clean and extract main content
 * 3. Chunk - Split into token-aware chunks
 * 4. Enrich (optional) - Add LLM-generated summaries/Q&A
 * 5. Embed (optional) - Generate vector embeddings
 *
 * @param input - Pipeline configuration
 * @returns Pipeline output with chunks, pages, and stats
 */
export declare function runPipeline(input: PipelineInput): Promise<PipelineOutput>;
export { crawlSite, extractContent, extractPages, extractFromUrl, chunkPages, chunkText, chunkContent, enrichChunks, embedChunks, generateEmbedding, };
//# sourceMappingURL=index.d.ts.map