/**
 * Type definitions for Context Layer Actor
 *
 * This module contains all shared TypeScript interfaces used across the pipeline.
 */

// ============================================================================
// Input Types
// ============================================================================

/**
 * Actor input schema matching .actor/input_schema.json
 */
export interface Input {
    startUrl: string;
    maxPages: number;
    crawlDepth: number;
    chunkSize: number;
    chunkOverlap: number;
    outputFormat: 'rag' | 'finetune-openai' | 'finetune-alpaca' | 'markdown';
    generateQA: boolean;
    generateSummary: boolean;
    questionsPerChunk: number;
    llmProvider: 'openai' | 'anthropic';
    llmApiKey?: string;
    urlPatterns: string[];
    excludePatterns: string[];
    generateEmbeddings: boolean;
    embeddingModel: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
    embeddingApiKey?: string;
}

// ============================================================================
// Crawl Module Types
// ============================================================================

/**
 * Options for crawling a site
 */
export interface CrawlOptions {
    startUrl: string;
    maxPages: number;
    crawlDepth: number;
    urlPatterns?: string[];
    excludePatterns?: string[];
}

/**
 * A single crawled page with raw HTML
 */
export interface CrawledPage {
    url: string;
    html: string;
    statusCode: number;
}

/**
 * Result from crawling a site
 */
export interface CrawlResult {
    pages: CrawledPage[];
    stats: {
        pagesVisited: number;
        pagesFailed: number;
        duration: number;
    };
}

// ============================================================================
// Extract Module Types
// ============================================================================

/**
 * A page with extracted content
 */
export interface ExtractedPage {
    url: string;
    title: string;
    content: string;
    headings: string[];
}

/**
 * Options for content extraction
 */
export interface ExtractOptions {
    minContentLength?: number;  // Default: 100
}

// ============================================================================
// Chunk Module Types
// ============================================================================

/**
 * Options for chunking content
 */
export interface ChunkOptions {
    chunkSize: number;
    chunkOverlap: number;
    outputFormat: string;
}

/**
 * Metadata for a chunk
 */
export interface ChunkMetadata {
    source_url: string;
    title: string;
    section: string;
    chunk_index: number;
    total_chunks: number;
}

/**
 * A text chunk with metadata
 */
export interface Chunk {
    id: string;
    content: string;
    tokenCount: number;
    metadata: ChunkMetadata;
    enrichment?: Enrichment;
    embedding?: number[];
}

// ============================================================================
// Enrich Module Types
// ============================================================================

/**
 * Configuration for LLM enrichment
 */
export interface EnrichmentConfig {
    enabled: boolean;
    generateQA: boolean;
    generateSummary: boolean;
    questionsPerChunk: number;
}

/**
 * Options for enriching chunks
 */
export interface EnrichOptions {
    generateQA: boolean;
    generateSummary: boolean;
    questionsPerChunk: number;
    llmProvider: 'openai' | 'anthropic';
    llmApiKey: string;
}

/**
 * Enrichment data added to chunks
 */
export interface Enrichment {
    summary?: string;
    questions?: string[];
}

/**
 * A chunk with enrichment data
 */
export interface EnrichedChunk extends Chunk {
    enrichment?: Enrichment;
}

// ============================================================================
// Embed Module Types
// ============================================================================

/**
 * Options for generating embeddings
 */
export interface EmbedOptions {
    model: 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
    apiKey: string;
}

/**
 * A chunk with embedding vector
 */
export interface EmbeddedChunk extends EnrichedChunk {
    embedding?: number[];
}

// ============================================================================
// Pipeline Types
// ============================================================================

/**
 * Input for running the full pipeline
 */
export interface PipelineInput {
    crawlOptions: CrawlOptions;
    chunkOptions: ChunkOptions;
    enrichOptions?: EnrichOptions;
    embedOptions?: EmbedOptions;
}

/**
 * Output from running the full pipeline
 */
export interface PipelineOutput {
    chunks: EmbeddedChunk[];
    pages: ExtractedPage[];
    stats: {
        pagesProcessed: number;
        chunksCreated: number;
        enrichmentApplied: boolean;
        embeddingsGenerated: boolean;
    };
}

// ============================================================================
// Output Format Types
// ============================================================================

/**
 * RAG output format - vector DB ready
 */
export interface RAGOutput {
    id: string;
    content: string;
    metadata: ChunkMetadata;
    enrichment: Enrichment;
    embedding?: number[];
}

/**
 * OpenAI fine-tuning message format
 */
export interface OpenAIMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * OpenAI fine-tuning output format
 */
export interface OpenAIFineTuneOutput {
    messages: OpenAIMessage[];
}

/**
 * Alpaca fine-tuning output format
 */
export interface AlpacaFineTuneOutput {
    instruction: string;
    input: string;
    output: string;
}

/**
 * Union type for all output formats
 */
export type FormattedOutput = RAGOutput | OpenAIFineTuneOutput | AlpacaFineTuneOutput | Chunk;

// ============================================================================
// Report Types
// ============================================================================

/**
 * Processing report saved to key-value store
 */
export interface ProcessingReport {
    pagesProcessed: number;
    chunksCreated: number;
    outputRecords: number;
    outputFormat: string;
    outputFile: string | null;
    generateQA: boolean;
    generateSummary: boolean;
    generateEmbeddings: boolean;
    embeddingModel: string | null;
    timestamp: string;
}
