/**
 * Batch Mode Entry
 *
 * Handles batch processing mode for the Actor.
 * This is the standard Apify Actor flow: input → process → output.
 */

import { Actor, log } from 'apify';
import type { Input, EnrichmentConfig, ProcessingReport } from '../types/index.js';
import { runPipeline } from '../pipeline/index.js';
import { formatOutput, generateMarkdownDocument, getDefaultChunkSize } from '../utils/index.js';
import {
    createKnowledgeBase,
    getKnowledgeBase,
    generateKBId,
    saveChunks,
    convertToKBChunks,
    updateKnowledgeBaseStats,
    updateKnowledgeBaseStatus,
} from '../storage/knowledge-base.js';
import { createJob, updateJobProgress, completeJob, failJob } from '../storage/jobs.js';

/**
 * Extended input with internal MCP spawn fields
 */
interface ExtendedInput extends Input {
    _knowledgeBaseId?: string;  // Set by MCP when spawning
}

/**
 * Run the Actor in batch processing mode
 *
 * Reads input, runs the pipeline, and saves output to Apify storage.
 */
export async function runBatchMode(): Promise<void> {
    const input = await Actor.getInput<ExtendedInput>();

    if (!input?.startUrl) {
        throw new Error('startUrl is required');
    }

    // Set defaults
    const config: ExtendedInput = {
        startUrl: input.startUrl,
        maxPages: input.maxPages ?? 50,
        crawlDepth: input.crawlDepth ?? 3,
        chunkSize: input.chunkSize || getDefaultChunkSize(input.outputFormat || 'rag'),
        chunkOverlap: input.chunkOverlap ?? 50,
        outputFormat: input.outputFormat || 'rag',
        generateQA: input.generateQA ?? false,
        generateSummary: input.generateSummary ?? false,
        questionsPerChunk: input.questionsPerChunk ?? 3,
        llmProvider: input.llmProvider || 'openai',
        llmApiKey: input.llmApiKey,
        urlPatterns: input.urlPatterns || [],
        excludePatterns: input.excludePatterns || ['**/changelog**', '**/blog**', '**/news**'],
        generateEmbeddings: input.generateEmbeddings ?? false,
        embeddingModel: input.embeddingModel || 'text-embedding-3-small',
        embeddingApiKey: input.embeddingApiKey,
        _knowledgeBaseId: input._knowledgeBaseId,
    };

    // Enrichment is enabled if either Q&A or summary generation is requested
    const enrichmentEnabled = config.generateQA || config.generateSummary;

    // Build enrichment config object for internal use
    const enrichmentConfig: EnrichmentConfig = {
        enabled: enrichmentEnabled,
        generateQA: config.generateQA,
        generateSummary: config.generateSummary,
        questionsPerChunk: config.questionsPerChunk,
    };

    log.info('Context Layer starting...', {
        startUrl: config.startUrl,
        maxPages: config.maxPages,
        outputFormat: config.outputFormat,
        generateQA: config.generateQA,
        generateSummary: config.generateSummary,
        generateEmbeddings: config.generateEmbeddings,
    });

    // Validate enrichment config
    if (enrichmentEnabled && !config.llmApiKey) {
        throw new Error('LLM API key is required when Generate Q&A or Generate Summaries is enabled');
    }

    // Validate embedding config
    if (config.generateEmbeddings && !config.embeddingApiKey) {
        throw new Error('Embedding API key is required when embeddings are enabled');
    }

    // ========================================================================
    // Knowledge Base & Job Setup
    // ========================================================================

    // Get or create run ID for job tracking
    const runId = Actor.getEnv().actorRunId ?? `local-${Date.now()}`;

    // Use existing KB ID (MCP spawn case) or generate new one
    const kbId = config._knowledgeBaseId ?? generateKBId(config.startUrl);
    let existingKB = await getKnowledgeBase(kbId);

    // Create KB if it doesn't exist
    if (!existingKB) {
        existingKB = await createKnowledgeBase(config.startUrl, {
            chunkSize: config.chunkSize,
            chunkOverlap: config.chunkOverlap,
            outputFormat: config.outputFormat,
            hasEmbeddings: config.generateEmbeddings,
            hasEnrichment: enrichmentEnabled,
        });
    } else {
        // Update status to processing for re-crawl
        await updateKnowledgeBaseStatus(kbId, 'processing');
    }

    // Create job record
    const job = await createJob(runId, kbId);
    log.info(`Job created: ${job.id}`, { knowledgeBaseId: kbId });

    // Run the pipeline with error handling for job tracking
    let result;
    try {
        // Update job to crawling phase
        await updateJobProgress(runId, { phase: 'crawling', current: 0, total: config.maxPages });

        result = await runPipeline({
            crawlOptions: {
                startUrl: config.startUrl,
                maxPages: config.maxPages,
                crawlDepth: config.crawlDepth,
                urlPatterns: config.urlPatterns,
                excludePatterns: config.excludePatterns,
            },
            chunkOptions: {
                chunkSize: config.chunkSize,
                chunkOverlap: config.chunkOverlap,
                outputFormat: config.outputFormat,
            },
            enrichOptions: enrichmentEnabled ? {
                generateQA: config.generateQA,
                generateSummary: config.generateSummary,
                questionsPerChunk: config.questionsPerChunk,
                llmProvider: config.llmProvider,
                llmApiKey: config.llmApiKey!,
            } : undefined,
            embedOptions: config.generateEmbeddings ? {
                model: config.embeddingModel,
                apiKey: config.embeddingApiKey!,
            } : undefined,
        });

        if (result.pages.length === 0) {
            log.warning('No content extracted. Check if the URL is accessible and contains content.');
            await failJob(runId, 'No content extracted from the provided URL');
            return;
        }

        // Update job to saving phase
        await updateJobProgress(runId, {
            phase: 'saving',
            current: result.stats.pagesProcessed,
            total: result.stats.pagesProcessed,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await failJob(runId, errorMessage);
        throw error;
    }

    // Format output
    log.info(`Formatting output as ${config.outputFormat}...`);
    const formattedOutput = formatOutput(result.chunks, config.outputFormat, enrichmentConfig);

    // Handle output based on format
    if (config.outputFormat === 'markdown') {
        // Generate and save Markdown document
        const markdownContent = generateMarkdownDocument(result.chunks, enrichmentConfig);
        await Actor.setValue('context_layer.md', markdownContent, { contentType: 'text/markdown' });
        log.info('Saved Markdown document to key-value store as context_layer.md');
    } else {
        // Save to dataset for other formats
        const dataset = await Actor.openDataset();
        await dataset.pushData(formattedOutput);

        // Save JSONL file for fine-tuning formats
        if (config.outputFormat.startsWith('finetune')) {
            const jsonlContent = formattedOutput.map(item => JSON.stringify(item)).join('\n');
            await Actor.setValue('training_data.jsonl', jsonlContent, { contentType: 'application/jsonl' });
        }
    }

    // Save report
    const report: ProcessingReport = {
        pagesProcessed: result.stats.pagesProcessed,
        chunksCreated: result.stats.chunksCreated,
        outputRecords: config.outputFormat === 'markdown' ? 1 : formattedOutput.length,
        outputFormat: config.outputFormat,
        outputFile: config.outputFormat === 'markdown' ? 'context_layer.md' : null,
        generateQA: config.generateQA,
        generateSummary: config.generateSummary,
        generateEmbeddings: config.generateEmbeddings,
        embeddingModel: config.generateEmbeddings ? config.embeddingModel : null,
        timestamp: new Date().toISOString(),
    };
    await Actor.setValue('report', JSON.stringify(report, null, 2), { contentType: 'application/json' });

    // ========================================================================
    // Save to Knowledge Base
    // ========================================================================

    try {
        // Convert pipeline chunks to KB chunks and save
        const kbChunks = convertToKBChunks(result.chunks, kbId);
        await saveChunks(kbId, kbChunks);

        // Update KB stats with page count
        await updateKnowledgeBaseStats(kbId, {
            pageCount: result.stats.pagesProcessed,
        });

        // Complete job
        await completeJob(runId);
        log.info(`Knowledge base saved: ${kbId}`, {
            chunks: kbChunks.length,
            pages: result.stats.pagesProcessed,
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        log.error('Failed to save to knowledge base', { error: errorMessage });
        await failJob(runId, `Failed to save KB: ${errorMessage}`);
        // Don't throw - the standard output was already saved
    }

    // Charge for usage (pay-per-page)
    const chargeEvents = Math.ceil(result.stats.pagesProcessed / 10);
    if (chargeEvents > 0) {
        try {
            await Actor.charge({ eventName: 'pages-processed-10', count: chargeEvents });
            log.info(`Charged for ${chargeEvents} x 10 pages ($${(chargeEvents * 0.10).toFixed(2)})`);
        } catch (error) {
            log.warning('Charging not available (pay-per-event not configured)', { error });
        }
    }

    log.info('Context Layer complete!', report);
}
