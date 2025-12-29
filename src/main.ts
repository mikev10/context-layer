import { Actor, log } from 'apify';
import { CheerioCrawler, RequestQueue, type CheerioCrawlingContext } from 'crawlee';
import { encoding_for_model } from 'tiktoken';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Types
interface EnrichmentConfig {
    enabled: boolean;
    generateQA: boolean;
    generateSummary: boolean;
    questionsPerChunk: number;
}

interface Input {
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

interface ExtractedPage {
    url: string;
    title: string;
    content: string;
    headings: string[];
}

interface Chunk {
    id: string;
    content: string;
    tokenCount: number;
    metadata: {
        source_url: string;
        title: string;
        section: string;
        chunk_index: number;
        total_chunks: number;
    };
    enrichment?: {
        summary?: string;
        questions?: string[];
    };
    embedding?: number[];
}

// Initialize tiktoken encoder
const encoder = encoding_for_model('gpt-4');

function countTokens(text: string): number {
    return encoder.encode(text).length;
}

function getDefaultChunkSize(outputFormat: string): number {
    switch (outputFormat) {
        case 'rag':
            return 500;
        case 'finetune-openai':
        case 'finetune-alpaca':
            return 1000;
        case 'markdown':
            return 2000;
        default:
            return 500;
    }
}

// Extract main content from HTML
function extractContent($: CheerioCrawlingContext['$']): { content: string; title: string; headings: string[] } {
    // Remove unwanted elements - comprehensive list for various site types
    const removeSelectors = [
        // Basic elements
        'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
        // Navigation and layout
        'nav', 'header', 'footer', 'aside',
        '.sidebar', '.navigation', '.menu', '.breadcrumb', '.breadcrumbs',
        '.pagination', '.pager', '.page-navigation',
        // Common UI elements
        '.comments', '.comment-section', '.advertisement', '.ads', '.ad-container',
        '.social-share', '.share-buttons', '.social-links', '.social-icons',
        '.search', '.search-box', '.search-form', '.search-container',
        '.newsletter', '.subscribe', '.subscription',
        '.cookie-banner', '.cookie-notice', '.gdpr',
        '.popup', '.modal', '.overlay',
        '.related-articles', '.related-posts', '.suggested',
        '.author-bio', '.author-info',
        '.tags', '.tag-list', '.categories',
        '.back-to-top', '.scroll-top',
        // Help center / Zendesk specific
        '.promoted-articles', '.article-list', '.section-list',
        '.article-votes', '.article-vote', '.vote-buttons',
        '.article-meta', '.article-info', '.meta-data',
        '.article-relatives', '.article-sidebar',
        '.follow-article', '.follow-section',
        '.see-all-articles', '.see-more',
        '.request-form', '.submit-request',
        '.recently-viewed', '.recent-activity',
        // ARIA roles
        '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
        '[role="complementary"]', '[role="search"]',
        // Common class patterns
        '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]',
        '[class*="newsletter"]', '[class*="subscribe"]',
        '[class*="social-"]', '[class*="share-"]',
        '[class*="advertisement"]', '[class*="-ad-"]', '[class*="ad-"]',
    ];
    $(removeSelectors.join(', ')).remove();

    // Try to find main content area
    const mainSelectors = [
        // Documentation sites
        '.article-body', '.article-content', '.article__body',
        '.doc-content', '.docs-content', '.documentation-content',
        '.markdown-body', '.prose', '.content-body',
        // Help centers
        '.hc-article-body', '.zendesk-article-body',
        // Generic
        'main', 'article', '[role="main"]',
        '.content', '.main-content', '#content', '#main-content',
        '.post-content', '.entry-content', '.page-content',
    ];
    let mainContent = '';

    for (const selector of mainSelectors) {
        const element = $(selector);
        if (element.length > 0) {
            mainContent = element.text();
            break;
        }
    }

    // Fallback to body if no main content found
    if (!mainContent) {
        mainContent = $('body').text();
    }

    // Get title
    const title = $('h1').first().text() || $('title').text() || '';

    // Get headings for structure
    const headings: string[] = [];
    $('h1, h2, h3').each((_, el) => {
        const text = $(el).text().trim();
        if (text) headings.push(text);
    });

    // Clean up the content
    mainContent = mainContent
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        // Remove "See all X articles" patterns
        .replace(/See all \d+ articles?/gi, '')
        .replace(/View all \d+ articles?/gi, '')
        .replace(/Show all \d+ articles?/gi, '')
        // Remove "X min read" patterns
        .replace(/\d+\s*min(ute)?\s*read/gi, '')
        // Remove standalone dates (various formats)
        .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s*\d{1,2}:\d{2}\b/gi, '')
        .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\s*\d{1,2}:\d{2}\b/g, '')
        // Remove "Updated X days/hours ago" patterns
        .replace(/Updated?\s+\d+\s+(days?|hours?|minutes?|weeks?|months?)\s+ago/gi, '')
        .replace(/Last updated:?\s*[\w\s,]+\d{4}/gi, '')
        // Remove "Was this article helpful?" patterns
        .replace(/Was this (article|page|content) helpful\??/gi, '')
        .replace(/Did (this|you find this) (help|article helpful)\??/gi, '')
        // Remove vote/feedback prompts
        .replace(/\d+\s*(out of|\/)\s*\d+\s*found this helpful/gi, '')
        .replace(/Yes\s*No\s*(Was this helpful\?)?/gi, '')
        // Remove "Have more questions?" patterns
        .replace(/Have (more )?questions\?\s*(Submit a request|Contact us)?/gi, '')
        // Remove navigation prompts
        .replace(/Skip to (main )?content/gi, '')
        .replace(/Back to top/gi, '')
        .replace(/Return to top/gi, '')
        // Clean up multiple spaces and trim
        .replace(/\s{2,}/g, ' ')
        .trim();

    return { content: mainContent, title: title.trim(), headings };
}

// Chunk content intelligently
function chunkContent(content: string, chunkSize: number, overlap: number): string[] {
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

// Get overlap text from end of chunk
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

// LLM Enrichment
async function enrichChunks(
    chunks: Chunk[],
    config: EnrichmentConfig,
    provider: 'openai' | 'anthropic',
    apiKey: string
): Promise<Chunk[]> {
    if (!config.enabled || !apiKey) {
        return chunks;
    }

    log.info(`Enriching ${chunks.length} chunks with ${provider}...`);

    const enrichedChunks: Chunk[] = [];
    const batchSize = 5; // Process in batches to avoid rate limits

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const enrichedBatch = await Promise.all(
            batch.map(chunk => enrichSingleChunk(chunk, config, provider, apiKey))
        );
        enrichedChunks.push(...enrichedBatch);

        if (i + batchSize < chunks.length) {
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return enrichedChunks;
}

async function enrichSingleChunk(
    chunk: Chunk,
    config: EnrichmentConfig,
    provider: 'openai' | 'anthropic',
    apiKey: string
): Promise<Chunk> {
    const prompt = buildEnrichmentPrompt(chunk.content, config);

    try {
        let response: string;

        if (provider === 'openai') {
            const openai = new OpenAI({ apiKey });
            const completion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.7,
            });
            response = completion.choices[0]?.message?.content || '';
        } else {
            const anthropic = new Anthropic({ apiKey });
            const message = await anthropic.messages.create({
                model: 'claude-3-haiku-20240307',
                max_tokens: 1024,
                messages: [{ role: 'user', content: prompt }],
            });
            response = message.content[0]?.type === 'text' ? message.content[0].text : '';
        }

        // Parse response
        const enrichment = parseEnrichmentResponse(response, config);
        return { ...chunk, enrichment };
    } catch (error) {
        log.warning(`Failed to enrich chunk ${chunk.id}: ${error}`);
        return chunk;
    }
}

function buildEnrichmentPrompt(content: string, config: EnrichmentConfig): string {
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

function parseEnrichmentResponse(response: string, config: EnrichmentConfig): Chunk['enrichment'] {
    try {
        // Extract JSON from response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return {};

        const parsed = JSON.parse(jsonMatch[0]);
        const enrichment: Chunk['enrichment'] = {};

        if (config.generateSummary && parsed.summary) {
            enrichment.summary = parsed.summary;
        }

        if (config.generateQA && parsed.questions) {
            enrichment.questions = parsed.questions.map((q: { question: string }) => q.question);
        }

        return enrichment;
    } catch {
        log.warning('Failed to parse enrichment response');
        return {};
    }
}

// Generate embeddings for chunks
async function generateEmbeddings(
    chunks: Chunk[],
    model: string,
    apiKey: string
): Promise<Chunk[]> {
    log.info(`Generating embeddings for ${chunks.length} chunks using ${model}...`);

    const openai = new OpenAI({ apiKey });
    const batchSize = 20; // OpenAI allows up to 2048 inputs, but we batch for safety
    const embeddedChunks: Chunk[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const texts = batch.map(chunk => chunk.content);

        try {
            const response = await openai.embeddings.create({
                model: model,
                input: texts,
            });

            for (let j = 0; j < batch.length; j++) {
                embeddedChunks.push({
                    ...batch[j],
                    embedding: response.data[j].embedding,
                });
            }

            log.info(`Embedded chunks ${i + 1} to ${Math.min(i + batchSize, chunks.length)} of ${chunks.length}`);

            // Small delay between batches to avoid rate limits
            if (i + batchSize < chunks.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        } catch (error) {
            log.error(`Failed to generate embeddings for batch starting at ${i}: ${error}`);
            // Add chunks without embeddings on failure
            for (const chunk of batch) {
                embeddedChunks.push(chunk);
            }
        }
    }

    return embeddedChunks;
}

// Format output based on selected format
function formatOutput(chunks: Chunk[], format: string, enrichment: EnrichmentConfig): unknown[] {
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

// Generate a proper Markdown document from chunks
function generateMarkdownDocument(chunks: Chunk[], enrichment: EnrichmentConfig): string {
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

function generateOpenAIFormat(chunks: Chunk[], enrichment: EnrichmentConfig): unknown[] {
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

function generateAlpacaFormat(chunks: Chunk[], enrichment: EnrichmentConfig): unknown[] {
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

// Check if URL matches patterns
function matchesPattern(url: string, patterns: string[]): boolean {
    if (patterns.length === 0) return true;

    return patterns.some(pattern => {
        const regex = new RegExp(
            pattern
                .replace(/\*\*/g, '.*')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '.')
        );
        return regex.test(url);
    });
}

// Main Actor logic
Actor.main(async () => {
    const input = await Actor.getInput<Input>();
    if (!input?.startUrl) {
        throw new Error('startUrl is required');
    }

    // Set defaults
    const config: Input = {
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

    const extractedPages: ExtractedPage[] = [];
    const requestQueue = await RequestQueue.open();
    await requestQueue.addRequest({ url: config.startUrl, userData: { depth: 0 } });

    // Get base URL for same-domain filtering
    const baseUrl = new URL(config.startUrl);

    // Set up crawler
    const crawler = new CheerioCrawler({
        requestQueue,
        maxRequestsPerCrawl: config.maxPages || undefined,
        async requestHandler({ request, $, enqueueLinks }) {
            const depth = request.userData.depth as number;
            log.info(`Crawling: ${request.url} (depth: ${depth})`);

            // Extract content
            const { content, title, headings } = extractContent($);

            if (content.length > 100) { // Skip nearly empty pages
                extractedPages.push({
                    url: request.url,
                    title,
                    content,
                    headings,
                });
            }

            // Enqueue links if within depth limit
            if (depth < config.crawlDepth) {
                await enqueueLinks({
                    strategy: 'same-domain',
                    userData: { depth: depth + 1 },
                    transformRequestFunction: (req) => {
                        const url = req.url;

                        // Check exclude patterns
                        if (matchesPattern(url, config.excludePatterns)) {
                            return false;
                        }

                        // Check include patterns
                        if (config.urlPatterns.length > 0 && !matchesPattern(url, config.urlPatterns)) {
                            return false;
                        }

                        return req;
                    },
                });
            }
        },
        failedRequestHandler({ request }) {
            log.warning(`Failed to crawl: ${request.url}`);
        },
    });

    await crawler.run();
    log.info(`Crawled ${extractedPages.length} pages`);

    if (extractedPages.length === 0) {
        log.warning('No content extracted. Check if the URL is accessible and contains content.');
        return;
    }

    // Process pages into chunks
    log.info('Chunking content...');
    const allChunks: Chunk[] = [];
    let chunkId = 0;

    for (const page of extractedPages) {
        const textChunks = chunkContent(page.content, config.chunkSize, config.chunkOverlap);

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

    log.info(`Created ${allChunks.length} chunks`);

    // Enrich chunks if enabled
    let enrichedChunks = allChunks;
    if (enrichmentConfig.enabled && config.llmApiKey) {
        enrichedChunks = await enrichChunks(
            allChunks,
            enrichmentConfig,
            config.llmProvider,
            config.llmApiKey
        );
    }

    // Generate embeddings if enabled
    let finalChunks = enrichedChunks;
    if (config.generateEmbeddings && config.embeddingApiKey) {
        finalChunks = await generateEmbeddings(
            enrichedChunks,
            config.embeddingModel,
            config.embeddingApiKey
        );
    }

    // Format output
    log.info(`Formatting output as ${config.outputFormat}...`);
    const formattedOutput = formatOutput(finalChunks, config.outputFormat, enrichmentConfig);

    // Handle output based on format
    if (config.outputFormat === 'markdown') {
        // Generate and save Markdown document
        const markdownContent = generateMarkdownDocument(finalChunks, enrichmentConfig);
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
    const report = {
        pagesProcessed: extractedPages.length,
        chunksCreated: allChunks.length,
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

    // Charge for usage (pay-per-page)
    const chargeEvents = Math.ceil(extractedPages.length / 10); // $0.01 per page = $0.10 per 10 pages
    if (chargeEvents > 0) {
        try {
            await Actor.charge({ eventName: 'pages-processed-10', count: chargeEvents });
            log.info(`Charged for ${chargeEvents} x 10 pages ($${(chargeEvents * 0.10).toFixed(2)})`);
        } catch {
            log.warning('Charging not available (pay-per-event not configured)');
        }
    }

    log.info('Context Layer complete!', report);
});
