/**
 * Enrich Module
 *
 * Handles LLM-based enrichment of chunks using OpenAI or Anthropic.
 * Generates Q&A pairs and summaries for enhanced RAG/fine-tuning.
 */
import { log } from 'apify';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
/** Batch size for LLM API calls */
const BATCH_SIZE = 5;
/** Delay between batches in milliseconds */
const BATCH_DELAY = 500;
/**
 * Build the enrichment prompt for a chunk
 *
 * Creates a prompt asking for summary and/or Q&A pairs.
 *
 * @param content - The chunk content to enrich
 * @param config - Enrichment configuration
 * @returns The formatted prompt
 */
function buildEnrichmentPrompt(content, config) {
    let prompt = `Analyze the following content and provide:\n\n`;
    if (config.generateSummary) {
        prompt += `1. A brief summary (1-2 sentences)\n`;
    }
    if (config.generateQA) {
        prompt += `${config.generateSummary ? '2' : '1'}. ${config.questionsPerChunk} question-answer pairs that a user might ask about this content\n`;
    }
    prompt += `\nFormat your response as JSON:\n`;
    prompt += `{\n`;
    if (config.generateSummary) {
        prompt += `  "summary": "...",\n`;
    }
    if (config.generateQA) {
        prompt += `  "questions": [\n`;
        prompt += `    {"question": "...", "answer": "..."}\n`;
        prompt += `  ]\n`;
    }
    prompt += `}\n\n`;
    prompt += `Content:\n${content}`;
    return prompt;
}
/**
 * Parse the LLM enrichment response
 *
 * Extracts JSON from the response and normalizes the structure.
 *
 * @param response - Raw LLM response text
 * @param config - Enrichment configuration
 * @returns Parsed enrichment data
 */
function parseEnrichmentResponse(response, config) {
    try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            return {};
        const parsed = JSON.parse(jsonMatch[0]);
        const enrichment = {};
        if (config.generateSummary && parsed.summary) {
            enrichment.summary = parsed.summary;
        }
        if (config.generateQA && parsed.questions) {
            enrichment.questions = parsed.questions.map((q) => q.question);
        }
        return enrichment;
    }
    catch (error) {
        log.warning(`Failed to parse enrichment response: ${error instanceof Error ? error.message : String(error)}`);
        return {};
    }
}
/**
 * Enrich a single chunk using the configured LLM provider
 *
 * @param chunk - The chunk to enrich
 * @param config - Enrichment configuration
 * @param provider - LLM provider ('openai' or 'anthropic')
 * @param apiKey - API key for the provider
 * @returns The enriched chunk
 */
async function enrichSingleChunk(chunk, config, provider, apiKey) {
    const prompt = buildEnrichmentPrompt(chunk.content, config);
    try {
        let response;
        if (provider === 'openai') {
            const openai = new OpenAI({ apiKey });
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            });
            response = completion.choices[0]?.message?.content || '';
        }
        else {
            const anthropic = new Anthropic({ apiKey });
            const message = await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
            });
            response = message.content[0]?.type === 'text'
                ? message.content[0].text
                : '';
        }
        // Parse response
        const enrichment = parseEnrichmentResponse(response, config);
        return { ...chunk, enrichment };
    }
    catch (error) {
        log.warning(`Failed to enrich chunk ${chunk.id}: ${error}`);
        return chunk;
    }
}
/**
 * Enrich multiple chunks with LLM-generated content
 *
 * Processes chunks in batches to avoid rate limits.
 * Adds summaries and/or Q&A pairs based on configuration.
 *
 * @param chunks - Array of chunks to enrich
 * @param options - Enrichment options including provider and API key
 * @returns Array of enriched chunks
 */
export async function enrichChunks(chunks, options) {
    const config = {
        enabled: true,
        generateQA: options.generateQA,
        generateSummary: options.generateSummary,
        questionsPerChunk: options.questionsPerChunk,
    };
    log.info(`Enriching ${chunks.length} chunks with ${options.llmProvider}...`);
    const enrichedChunks = [];
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        const batch = chunks.slice(i, i + BATCH_SIZE);
        const enrichedBatch = await Promise.all(batch.map(chunk => enrichSingleChunk(chunk, config, options.llmProvider, options.llmApiKey)));
        enrichedChunks.push(...enrichedBatch);
        if (i + BATCH_SIZE < chunks.length) {
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
        log.info(`Enriched ${Math.min(i + BATCH_SIZE, chunks.length)}/${chunks.length} chunks`);
    }
    return enrichedChunks;
}
//# sourceMappingURL=enrich.js.map