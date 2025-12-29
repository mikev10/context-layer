/**
 * Pipeline Orchestrator
 *
 * Central coordinator that chains pipeline modules together.
 * Provides the main runPipeline function and re-exports individual modules.
 */
import { log } from 'apify';
// Import pipeline modules
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
export async function runPipeline(input) {
    const startTime = Date.now();
    // Stage 1: Crawl
    log.info('Stage 1: Crawling site...');
    const { pages: crawledPages, stats: crawlStats } = await crawlSite(input.crawlOptions);
    if (crawledPages.length === 0) {
        log.warning('No pages crawled. Check if the URL is accessible.');
        return {
            chunks: [],
            pages: [],
            stats: {
                pagesProcessed: 0,
                chunksCreated: 0,
                enrichmentApplied: false,
                embeddingsGenerated: false,
            },
        };
    }
    // Stage 2: Extract
    log.info('Stage 2: Extracting content...');
    const extractedPages = extractPages(crawledPages, { minContentLength: 100 });
    log.info(`Extracted ${extractedPages.length} pages with content`);
    if (extractedPages.length === 0) {
        log.warning('No content extracted. Check if pages contain readable content.');
        return {
            chunks: [],
            pages: [],
            stats: {
                pagesProcessed: 0,
                chunksCreated: 0,
                enrichmentApplied: false,
                embeddingsGenerated: false,
            },
        };
    }
    // Stage 3: Chunk
    log.info('Stage 3: Chunking content...');
    let chunks = chunkPages(extractedPages, input.chunkOptions);
    // Stage 4: Enrich (optional)
    let enrichmentApplied = false;
    if (input.enrichOptions) {
        log.info('Stage 4: Enriching chunks...');
        chunks = await enrichChunks(chunks, input.enrichOptions);
        enrichmentApplied = true;
    }
    else {
        log.info('Stage 4: Skipping enrichment (not configured)');
    }
    // Stage 5: Embed (optional)
    let embeddingsGenerated = false;
    if (input.embedOptions) {
        log.info('Stage 5: Generating embeddings...');
        chunks = await embedChunks(chunks, input.embedOptions);
        embeddingsGenerated = true;
    }
    else {
        log.info('Stage 5: Skipping embeddings (not configured)');
    }
    const duration = Date.now() - startTime;
    log.info(`Pipeline complete in ${duration}ms`);
    return {
        chunks,
        pages: extractedPages,
        stats: {
            pagesProcessed: extractedPages.length,
            chunksCreated: chunks.length,
            enrichmentApplied,
            embeddingsGenerated,
        },
    };
}
// Re-export individual modules for MCP tools and direct use
export { 
// Crawl module
crawlSite, 
// Extract module
extractContent, extractPages, extractFromUrl, 
// Chunk module
chunkPages, chunkText, chunkContent, 
// Enrich module
enrichChunks, 
// Embed module
embedChunks, generateEmbedding, };
//# sourceMappingURL=index.js.map