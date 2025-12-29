# Context Layer MCP Implementation Plan

## Overview

Transform the Context Layer Actor into a **Single Actor, Dual Mode** system that:
- **Standby Mode**: Acts as an MCP server, exposing tools to AI agents
- **Batch Mode**: Runs the existing pipeline (current behavior, unchanged)

This approach provides a unified product while preserving all existing functionality.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                    Context Layer Actor                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────┐    ┌─────────────────────────┐   │
│  │   STANDBY MODE      │    │     BATCH MODE          │   │
│  │   (MCP Server)      │    │     (Pipeline)          │   │
│  │                     │    │                         │   │
│  │  - Tool calls       │    │  - Crawl → Extract      │   │
│  │  - Quick operations │    │  - Chunk → Enrich       │   │
│  │  - Job management   │    │  - Embed → Export       │   │
│  │  - Search/Query     │    │                         │   │
│  └──────────┬──────────┘    └────────────▲────────────┘   │
│             │                            │                 │
│             │     Heavy operations       │                 │
│             └────────────────────────────┘                 │
│                   (self-spawn)                             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## MCP Tools to Expose

| Tool | Type | Description | Pricing |
|------|------|-------------|---------|
| `process_documentation` | Heavy (async) | Crawl & process entire site | $0.50 base + $0.01/page |
| `get_job_status` | Quick | Check processing job status | Free |
| `list_knowledge_bases` | Quick | List all processed sites | Free |
| `search_knowledge_base` | Quick | Semantic search in processed data | $0.01/query |
| `get_chunks` | Quick | Retrieve specific chunks by ID | $0.005/chunk |
| `chunk_text` | Quick | Chunk arbitrary text (utility) | $0.01/call |
| `extract_url` | Medium | Extract content from single URL | $0.05/url |
| `delete_knowledge_base` | Quick | Remove processed knowledge base | Free |

---

## Phase 1: Pipeline Refactoring

**Goal**: Extract the monolithic pipeline into composable, reusable modules.

**Duration**: Foundation work

### Step 1.1: Create Module Structure

Create new directory structure:

```
src/
├── main.ts                 # Entry point (mode detection)
├── modes/
│   ├── batch.ts            # Batch mode entry
│   └── mcp.ts              # MCP server entry
├── pipeline/
│   ├── index.ts            # Pipeline orchestrator
│   ├── crawl.ts            # Web crawling
│   ├── extract.ts          # Content extraction
│   ├── chunk.ts            # Text chunking
│   ├── enrich.ts           # LLM enrichment
│   └── embed.ts            # Embedding generation
├── mcp/
│   ├── server.ts           # MCP protocol handler
│   ├── tools/
│   │   ├── index.ts        # Tool registry
│   │   ├── process.ts      # process_documentation
│   │   ├── search.ts       # search_knowledge_base
│   │   ├── chunks.ts       # get_chunks, chunk_text
│   │   ├── extract.ts      # extract_url
│   │   ├── jobs.ts         # get_job_status
│   │   └── knowledge.ts    # list/delete knowledge bases
│   └── types.ts            # MCP type definitions
├── storage/
│   ├── index.ts            # Storage abstraction
│   ├── knowledge-base.ts   # Knowledge base CRUD
│   └── jobs.ts             # Job tracking
├── types/
│   └── index.ts            # Shared type definitions
└── utils/
    └── index.ts            # Shared utilities
```

### Step 1.2: Extract Crawl Module

**File**: `src/pipeline/crawl.ts`

```typescript
// Extract from main.ts
export interface CrawlOptions {
    startUrl: string;
    maxPages: number;
    crawlDepth: number;
    urlPatterns?: string[];
    excludePatterns?: string[];
}

export interface CrawledPage {
    url: string;
    html: string;
    statusCode: number;
}

export async function crawlSite(options: CrawlOptions): Promise<CrawledPage[]> {
    // Move CheerioCrawler logic here
}
```

### Step 1.3: Extract Extract Module

**File**: `src/pipeline/extract.ts`

```typescript
export interface ExtractedPage {
    url: string;
    title: string;
    content: string;
    headings: string[];
}

export function extractContent(html: string, url: string): ExtractedPage {
    // Move extractContent logic here
}
```

### Step 1.4: Extract Chunk Module

**File**: `src/pipeline/chunk.ts`

```typescript
export interface ChunkOptions {
    chunkSize: number;
    chunkOverlap: number;
    outputFormat: string;
}

export interface Chunk {
    id: string;
    content: string;
    tokenCount: number;
    metadata: ChunkMetadata;
}

export function chunkContent(
    pages: ExtractedPage[],
    options: ChunkOptions
): Chunk[] {
    // Move chunking logic here
}

// Also expose as standalone utility for MCP
export function chunkText(text: string, options: ChunkOptions): Chunk[] {
    // Simplified version for arbitrary text
}
```

### Step 1.5: Extract Enrich Module

**File**: `src/pipeline/enrich.ts`

```typescript
export interface EnrichOptions {
    generateQA: boolean;
    generateSummary: boolean;
    questionsPerChunk: number;
    llmProvider: 'openai' | 'anthropic';
    llmApiKey: string;
}

export interface EnrichedChunk extends Chunk {
    enrichment?: {
        summary?: string;
        questions?: string[];
    };
}

export async function enrichChunks(
    chunks: Chunk[],
    options: EnrichOptions
): Promise<EnrichedChunk[]> {
    // Move enrichment logic here
}
```

### Step 1.6: Extract Embed Module

**File**: `src/pipeline/embed.ts`

```typescript
export interface EmbedOptions {
    model: string;
    apiKey: string;
}

export interface EmbeddedChunk extends EnrichedChunk {
    embedding?: number[];
}

export async function embedChunks(
    chunks: EnrichedChunk[],
    options: EmbedOptions
): Promise<EmbeddedChunk[]> {
    // Move embedding logic here
}
```

### Step 1.7: Create Pipeline Orchestrator

**File**: `src/pipeline/index.ts`

```typescript
import { crawlSite } from './crawl';
import { extractContent } from './extract';
import { chunkContent } from './chunk';
import { enrichChunks } from './enrich';
import { embedChunks } from './embed';

export async function runPipeline(input: PipelineInput): Promise<PipelineOutput> {
    // 1. Crawl
    const pages = await crawlSite(input.crawlOptions);

    // 2. Extract
    const extracted = pages.map(p => extractContent(p.html, p.url));

    // 3. Chunk
    const chunks = chunkContent(extracted, input.chunkOptions);

    // 4. Enrich (optional)
    const enriched = input.enrichOptions
        ? await enrichChunks(chunks, input.enrichOptions)
        : chunks;

    // 5. Embed (optional)
    const embedded = input.embedOptions
        ? await embedChunks(enriched, input.embedOptions)
        : enriched;

    return { chunks: embedded, pages: extracted };
}

// Re-export individual functions for MCP tools
export { crawlSite, extractContent, chunkContent, chunkText, enrichChunks, embedChunks };
```

### Step 1.8: Update Main Entry Point

**File**: `src/main.ts`

```typescript
import { Actor } from 'apify';

async function main() {
    await Actor.init();

    const isStandbyMode = process.env.APIFY_META_ORIGIN === 'STANDBY';

    if (isStandbyMode) {
        // MCP Server Mode
        const { startMCPServer } = await import('./modes/mcp');
        await startMCPServer();
    } else {
        // Batch Pipeline Mode (existing behavior)
        const { runBatchMode } = await import('./modes/batch');
        await runBatchMode();
    }

    await Actor.exit();
}

main();
```

### Step 1.9: Create Batch Mode Entry

**File**: `src/modes/batch.ts`

```typescript
import { Actor } from 'apify';
import { runPipeline } from '../pipeline';
import { saveKnowledgeBase } from '../storage/knowledge-base';
import { formatOutput } from '../utils/format';

export async function runBatchMode() {
    const input = await Actor.getInput<Input>();

    // Validate input
    if (!input?.startUrl) {
        throw new Error('startUrl is required');
    }

    // Run pipeline (existing logic)
    const result = await runPipeline({
        crawlOptions: {
            startUrl: input.startUrl,
            maxPages: input.maxPages ?? 100,
            crawlDepth: input.crawlDepth ?? 3,
            urlPatterns: input.urlPatterns,
            excludePatterns: input.excludePatterns,
        },
        chunkOptions: {
            chunkSize: input.chunkSize ?? 500,
            chunkOverlap: input.chunkOverlap ?? 50,
            outputFormat: input.outputFormat ?? 'rag',
        },
        enrichOptions: (input.generateQA || input.generateSummary) ? {
            generateQA: input.generateQA ?? false,
            generateSummary: input.generateSummary ?? false,
            questionsPerChunk: input.questionsPerChunk ?? 3,
            llmProvider: input.llmProvider ?? 'openai',
            llmApiKey: input.llmApiKey ?? '',
        } : undefined,
        embedOptions: input.generateEmbeddings ? {
            model: input.embeddingModel ?? 'text-embedding-3-small',
            apiKey: input.embeddingApiKey ?? '',
        } : undefined,
    });

    // Format and save output (existing logic)
    const formatted = formatOutput(result.chunks, input.outputFormat);
    await saveKnowledgeBase(input.startUrl, formatted);

    // Charge for usage
    await Actor.charge({ eventName: 'pages-processed', count: result.pages.length });
}
```

### Deliverables for Phase 1

- [ ] Directory structure created
- [ ] `crawl.ts` module with tests
- [ ] `extract.ts` module with tests
- [ ] `chunk.ts` module with tests
- [ ] `enrich.ts` module with tests
- [ ] `embed.ts` module with tests
- [ ] Pipeline orchestrator working
- [ ] Batch mode unchanged from user perspective
- [ ] All existing tests passing

---

## Phase 2: Storage & Knowledge Base Management

**Goal**: Add persistent storage for knowledge bases that can be queried after processing.

### Step 2.1: Design Knowledge Base Schema

**File**: `src/storage/knowledge-base.ts`

```typescript
export interface KnowledgeBase {
    id: string;                    // Unique ID (hash of source URL)
    name: string;                  // Human-readable name
    sourceUrl: string;             // Original URL crawled
    createdAt: string;             // ISO timestamp
    updatedAt: string;             // ISO timestamp
    status: 'processing' | 'ready' | 'failed';
    stats: {
        pageCount: number;
        chunkCount: number;
        totalTokens: number;
    };
    config: {
        chunkSize: number;
        chunkOverlap: number;
        outputFormat: string;
        hasEmbeddings: boolean;
        hasEnrichment: boolean;
    };
}

export interface KnowledgeBaseChunk {
    id: string;
    knowledgeBaseId: string;
    content: string;
    tokenCount: number;
    embedding?: number[];
    metadata: {
        sourceUrl: string;
        title: string;
        section?: string;
        chunkIndex: number;
        totalChunks: number;
    };
    enrichment?: {
        summary?: string;
        questions?: string[];
    };
}
```

### Step 2.2: Implement Storage Functions

```typescript
// Create/Update knowledge base
export async function createKnowledgeBase(
    sourceUrl: string,
    config: KnowledgeBaseConfig
): Promise<KnowledgeBase>;

// Save chunks to knowledge base
export async function saveChunks(
    knowledgeBaseId: string,
    chunks: KnowledgeBaseChunk[]
): Promise<void>;

// List all knowledge bases
export async function listKnowledgeBases(): Promise<KnowledgeBase[]>;

// Get knowledge base by ID
export async function getKnowledgeBase(id: string): Promise<KnowledgeBase | null>;

// Get chunks from knowledge base
export async function getChunks(
    knowledgeBaseId: string,
    options?: { limit?: number; offset?: number }
): Promise<KnowledgeBaseChunk[]>;

// Search knowledge base (simple text search)
export async function searchKnowledgeBase(
    knowledgeBaseId: string,
    query: string,
    limit?: number
): Promise<KnowledgeBaseChunk[]>;

// Search with embeddings (semantic search)
export async function semanticSearch(
    knowledgeBaseId: string,
    queryEmbedding: number[],
    limit?: number
): Promise<KnowledgeBaseChunk[]>;

// Delete knowledge base
export async function deleteKnowledgeBase(id: string): Promise<void>;
```

### Step 2.3: Storage Implementation Options

**Option A: Apify Key-Value Store (Simple, MVP)**

```typescript
// Store structure:
// - kb_index.json: List of all knowledge bases
// - kb_{id}_meta.json: Knowledge base metadata
// - kb_{id}_chunks.json: All chunks (may need pagination for large sets)

async function saveChunks(kbId: string, chunks: Chunk[]) {
    const store = await Actor.openKeyValueStore();
    await store.setValue(`kb_${kbId}_chunks`, chunks);
}
```

**Option B: Apify Dataset (Better for large data)**

```typescript
// Each knowledge base gets its own named dataset
async function saveChunks(kbId: string, chunks: Chunk[]) {
    const dataset = await Actor.openDataset(`kb-${kbId}`);
    await dataset.pushData(chunks);
}
```

**Option C: External Vector DB (Best for search, Phase 4+)**
- Pinecone, Qdrant, or Weaviate integration
- Store embeddings and metadata
- Fast semantic search at scale

**Recommendation**: Start with Option B (Apify Dataset), add Option C later.

### Step 2.4: Job Tracking

**File**: `src/storage/jobs.ts`

```typescript
export interface Job {
    id: string;                    // Actor run ID
    knowledgeBaseId: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: {
        phase: string;             // 'crawling' | 'extracting' | 'chunking' | etc.
        current: number;
        total: number;
    };
    startedAt: string;
    completedAt?: string;
    error?: string;
}

export async function createJob(runId: string, kbId: string): Promise<Job>;
export async function updateJobProgress(runId: string, progress: Progress): Promise<void>;
export async function getJob(runId: string): Promise<Job | null>;
export async function listJobs(knowledgeBaseId?: string): Promise<Job[]>;
```

### Deliverables for Phase 2

- [ ] Knowledge base schema defined
- [ ] CRUD operations for knowledge bases
- [ ] Chunk storage and retrieval
- [ ] Basic text search
- [ ] Job tracking system
- [ ] Integration with batch mode (save KB after processing)

---

## Phase 3: MCP Server Implementation

**Goal**: Add MCP protocol support with SSE transport for Standby mode.

### Step 3.1: Add MCP Dependencies

```bash
npm install @modelcontextprotocol/sdk
```

**File**: `package.json` (additions)

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

### Step 3.2: Create MCP Server

**File**: `src/mcp/server.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { registerTools } from './tools';

export async function startMCPServer() {
    const server = new McpServer({
        name: 'context-layer',
        version: '1.0.0',
    });

    // Register all tools
    registerTools(server);

    // Start SSE transport for Apify Standby mode
    const transport = new SSEServerTransport({
        endpoint: '/sse',
    });

    await server.connect(transport);

    console.log('MCP Server started on /sse');
}
```

### Step 3.3: Create Tool Registry

**File**: `src/mcp/tools/index.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProcessTool } from './process';
import { registerSearchTool } from './search';
import { registerChunkTools } from './chunks';
import { registerExtractTool } from './extract';
import { registerJobTools } from './jobs';
import { registerKnowledgeTools } from './knowledge';

export function registerTools(server: McpServer) {
    registerProcessTool(server);
    registerSearchTool(server);
    registerChunkTools(server);
    registerExtractTool(server);
    registerJobTools(server);
    registerKnowledgeTools(server);
}
```

### Step 3.4: Implement Quick Tools

**File**: `src/mcp/tools/chunks.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Actor } from 'apify';
import { chunkText } from '../../pipeline/chunk';
import { getChunks } from '../../storage/knowledge-base';

export function registerChunkTools(server: McpServer) {
    // chunk_text - Utility tool to chunk arbitrary text
    server.tool(
        'chunk_text',
        {
            description: 'Split text into chunks optimized for RAG or fine-tuning',
            inputSchema: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'Text to chunk' },
                    chunkSize: { type: 'number', default: 500 },
                    chunkOverlap: { type: 'number', default: 50 },
                },
                required: ['text'],
            },
        },
        async ({ text, chunkSize, chunkOverlap }) => {
            // Charge for usage
            await Actor.charge({ eventName: 'chunk-text' });

            const chunks = chunkText(text, {
                chunkSize: chunkSize ?? 500,
                chunkOverlap: chunkOverlap ?? 50,
                outputFormat: 'rag',
            });

            return {
                content: [{ type: 'text', text: JSON.stringify(chunks, null, 2) }],
            };
        }
    );

    // get_chunks - Retrieve chunks from a knowledge base
    server.tool(
        'get_chunks',
        {
            description: 'Retrieve chunks from a processed knowledge base',
            inputSchema: {
                type: 'object',
                properties: {
                    knowledgeBaseId: { type: 'string' },
                    limit: { type: 'number', default: 10 },
                    offset: { type: 'number', default: 0 },
                },
                required: ['knowledgeBaseId'],
            },
        },
        async ({ knowledgeBaseId, limit, offset }) => {
            const chunks = await getChunks(knowledgeBaseId, { limit, offset });

            // Charge per chunk retrieved
            await Actor.charge({ eventName: 'get-chunk', count: chunks.length });

            return {
                content: [{ type: 'text', text: JSON.stringify(chunks, null, 2) }],
            };
        }
    );
}
```

### Step 3.5: Implement Heavy Tool (Process Documentation)

**File**: `src/mcp/tools/process.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Actor } from 'apify';
import { createKnowledgeBase } from '../../storage/knowledge-base';
import { createJob } from '../../storage/jobs';

export function registerProcessTool(server: McpServer) {
    server.tool(
        'process_documentation',
        {
            description: 'Crawl and process a documentation site into a searchable knowledge base. Returns a job ID for tracking progress.',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'URL of documentation site to process' },
                    maxPages: { type: 'number', default: 100, description: 'Maximum pages to crawl' },
                    generateEmbeddings: { type: 'boolean', default: true },
                    generateQA: { type: 'boolean', default: false },
                },
                required: ['url'],
            },
        },
        async ({ url, maxPages, generateEmbeddings, generateQA }) => {
            // Create knowledge base record
            const kb = await createKnowledgeBase(url, {
                maxPages: maxPages ?? 100,
                generateEmbeddings: generateEmbeddings ?? true,
                generateQA: generateQA ?? false,
            });

            // Spawn Actor run for heavy processing (calls itself in batch mode)
            const run = await Actor.call('context-layer', {
                startUrl: url,
                maxPages: maxPages ?? 100,
                generateEmbeddings: generateEmbeddings ?? true,
                generateQA: generateQA ?? false,
                // Internal flag to link to knowledge base
                _knowledgeBaseId: kb.id,
            });

            // Track the job
            await createJob(run.id, kb.id);

            // Charge base fee
            await Actor.charge({ eventName: 'process-documentation-start' });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        jobId: run.id,
                        knowledgeBaseId: kb.id,
                        status: 'processing',
                        message: `Processing started. Use get_job_status with jobId "${run.id}" to check progress.`,
                    }, null, 2),
                }],
            };
        }
    );
}
```

### Step 3.6: Implement Search Tool

**File**: `src/mcp/tools/search.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Actor } from 'apify';
import { searchKnowledgeBase, semanticSearch } from '../../storage/knowledge-base';
import { generateEmbedding } from '../../pipeline/embed';

export function registerSearchTool(server: McpServer) {
    server.tool(
        'search_knowledge_base',
        {
            description: 'Search a knowledge base for relevant content. Uses semantic search if embeddings are available.',
            inputSchema: {
                type: 'object',
                properties: {
                    knowledgeBaseId: { type: 'string' },
                    query: { type: 'string' },
                    limit: { type: 'number', default: 5 },
                },
                required: ['knowledgeBaseId', 'query'],
            },
        },
        async ({ knowledgeBaseId, query, limit }) => {
            // Charge for search
            await Actor.charge({ eventName: 'search-query' });

            // Try semantic search first (if KB has embeddings)
            const kb = await getKnowledgeBase(knowledgeBaseId);

            let results;
            if (kb?.config.hasEmbeddings) {
                const queryEmbedding = await generateEmbedding(query);
                results = await semanticSearch(knowledgeBaseId, queryEmbedding, limit);
            } else {
                results = await searchKnowledgeBase(knowledgeBaseId, query, limit);
            }

            return {
                content: [{ type: 'text', text: JSON.stringify(results, null, 2) }],
            };
        }
    );
}
```

### Step 3.7: Implement Job Status Tool

**File**: `src/mcp/tools/jobs.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Actor } from 'apify';
import { getJob } from '../../storage/jobs';

export function registerJobTools(server: McpServer) {
    server.tool(
        'get_job_status',
        {
            description: 'Check the status of a processing job',
            inputSchema: {
                type: 'object',
                properties: {
                    jobId: { type: 'string' },
                },
                required: ['jobId'],
            },
        },
        async ({ jobId }) => {
            // Get job from our tracking
            const job = await getJob(jobId);

            if (!job) {
                // Try to get Actor run status directly
                const run = await Actor.apifyClient.run(jobId).get();
                return {
                    content: [{
                        type: 'text',
                        text: JSON.stringify({
                            jobId,
                            status: run?.status ?? 'unknown',
                            message: run ? `Actor run status: ${run.status}` : 'Job not found',
                        }, null, 2),
                    }],
                };
            }

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        jobId: job.id,
                        knowledgeBaseId: job.knowledgeBaseId,
                        status: job.status,
                        progress: job.progress,
                        startedAt: job.startedAt,
                        completedAt: job.completedAt,
                        error: job.error,
                    }, null, 2),
                }],
            };
        }
    );
}
```

### Step 3.8: Implement Knowledge Base Management Tools

**File**: `src/mcp/tools/knowledge.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
    listKnowledgeBases,
    getKnowledgeBase,
    deleteKnowledgeBase,
} from '../../storage/knowledge-base';

export function registerKnowledgeTools(server: McpServer) {
    server.tool(
        'list_knowledge_bases',
        {
            description: 'List all processed knowledge bases',
            inputSchema: {
                type: 'object',
                properties: {},
            },
        },
        async () => {
            const kbs = await listKnowledgeBases();
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(kbs, null, 2),
                }],
            };
        }
    );

    server.tool(
        'delete_knowledge_base',
        {
            description: 'Delete a knowledge base and all its chunks',
            inputSchema: {
                type: 'object',
                properties: {
                    knowledgeBaseId: { type: 'string' },
                },
                required: ['knowledgeBaseId'],
            },
        },
        async ({ knowledgeBaseId }) => {
            await deleteKnowledgeBase(knowledgeBaseId);
            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        message: `Knowledge base ${knowledgeBaseId} deleted`,
                    }, null, 2),
                }],
            };
        }
    );
}
```

### Step 3.9: Implement Extract URL Tool

**File**: `src/mcp/tools/extract.ts`

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Actor } from 'apify';
import { extractContent } from '../../pipeline/extract';

export function registerExtractTool(server: McpServer) {
    server.tool(
        'extract_url',
        {
            description: 'Extract and clean content from a single URL',
            inputSchema: {
                type: 'object',
                properties: {
                    url: { type: 'string' },
                },
                required: ['url'],
            },
        },
        async ({ url }) => {
            // Charge for extraction
            await Actor.charge({ eventName: 'extract-url' });

            // Fetch and extract
            const response = await fetch(url);
            const html = await response.text();
            const extracted = extractContent(html, url);

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(extracted, null, 2),
                }],
            };
        }
    );
}
```

### Deliverables for Phase 3

- [ ] MCP SDK integrated
- [ ] MCP server with SSE transport
- [ ] All 8 tools implemented and working
- [ ] Mode detection (Standby vs Batch)
- [ ] Self-spawning for heavy operations
- [ ] Basic error handling

---

## Phase 4: Monetization Setup

**Goal**: Configure pay-per-event pricing for MCP tools.

### Step 4.1: Create Pay-Per-Event Configuration

**File**: `.actor/pay_per_event.json`

```json
[
    {
        "process-documentation-start": {
            "eventTitle": "Process Documentation (Base)",
            "eventDescription": "Base fee for starting a documentation processing job",
            "eventPriceUsd": 0.50
        }
    },
    {
        "page-processed": {
            "eventTitle": "Page Processed",
            "eventDescription": "Per-page fee for crawling and processing",
            "eventPriceUsd": 0.01
        }
    },
    {
        "search-query": {
            "eventTitle": "Search Query",
            "eventDescription": "Semantic or text search in knowledge base",
            "eventPriceUsd": 0.01
        }
    },
    {
        "get-chunk": {
            "eventTitle": "Chunk Retrieved",
            "eventDescription": "Retrieve a chunk from knowledge base",
            "eventPriceUsd": 0.005
        }
    },
    {
        "chunk-text": {
            "eventTitle": "Chunk Text",
            "eventDescription": "Chunk arbitrary text into RAG-ready pieces",
            "eventPriceUsd": 0.01
        }
    },
    {
        "extract-url": {
            "eventTitle": "Extract URL",
            "eventDescription": "Extract content from a single URL",
            "eventPriceUsd": 0.05
        }
    }
]
```

### Step 4.2: Update Actor Configuration

**File**: `.actor/actor.json`

```json
{
    "actorSpecification": 1,
    "name": "context-layer",
    "version": "1.0.0",
    "title": "Context Layer - AI Knowledge Base Builder",
    "description": "Transform documentation into AI-ready knowledge bases with MCP support",
    "usesStandbyMode": true,
    "minMemoryMbytes": 512,
    "maxMemoryMbytes": 4096,
    "webServerMcpPath": "/sse",
    "buildTag": "latest"
}
```

### Step 4.3: Add Charging Throughout Code

Ensure every billable operation calls `Actor.charge()`:

```typescript
// In each tool handler
await Actor.charge({ eventName: 'event-name', count: numberOfItems });
```

### Deliverables for Phase 4

- [ ] `pay_per_event.json` configured
- [ ] `actor.json` updated for MCP/Standby
- [ ] All tools calling `Actor.charge()`
- [ ] Pricing tested end-to-end

---

## Phase 5: Testing & Documentation

**Goal**: Ensure quality and prepare for Apify Store submission.

### Step 5.1: Unit Tests

```typescript
// tests/pipeline/chunk.test.ts
describe('chunkContent', () => {
    it('should split text at semantic boundaries');
    it('should respect token limits');
    it('should handle overlap correctly');
});

// tests/mcp/tools/search.test.ts
describe('search_knowledge_base', () => {
    it('should return relevant results');
    it('should use semantic search when embeddings available');
    it('should fall back to text search');
});
```

### Step 5.2: Integration Tests

```typescript
// tests/integration/mcp-server.test.ts
describe('MCP Server', () => {
    it('should handle process_documentation tool');
    it('should handle search_knowledge_base tool');
    it('should charge correctly for operations');
});
```

### Step 5.3: Update README

**File**: `.actor/README.md`

Update to document:
- MCP server capabilities
- Available tools and their parameters
- Pricing information
- Usage examples with different MCP clients

### Step 5.4: Create MCP Client Examples

```typescript
// examples/claude-desktop-config.json
{
    "mcpServers": {
        "context-layer": {
            "url": "https://YOUR_USERNAME--context-layer.apify.actor/sse",
            "headers": {
                "Authorization": "Bearer YOUR_APIFY_TOKEN"
            }
        }
    }
}
```

### Deliverables for Phase 5

- [ ] Unit tests for all pipeline modules
- [ ] Unit tests for all MCP tools
- [ ] Integration tests
- [ ] README updated
- [ ] Example configurations for popular MCP clients
- [ ] Error messages are user-friendly

---

## Phase 6: Deployment & Launch

**Goal**: Deploy to Apify and submit to MCP marketplace.

### Step 6.1: Deploy to Apify

```bash
apify login
apify push
```

### Step 6.2: Enable Standby Mode

1. Go to Apify Console → Your Actor
2. Settings → Enable "Standby mode"
3. Set idle timeout (300 seconds recommended)
4. Configure memory (512MB minimum)

### Step 6.3: Test MCP Connection

```bash
# Test with MCP Inspector
npx @anthropic-ai/mcp-inspector https://YOUR_USERNAME--context-layer.apify.actor/sse
```

### Step 6.4: Submit for MCP Marketplace Badge

1. Ensure `webServerMcpPath` is set in `actor.json`
2. Test all tools work correctly
3. Submit for Apify review

### Step 6.5: Promote

- Announce on social media
- Create demo video
- Write blog post about the tool

### Deliverables for Phase 6

- [ ] Actor deployed and running
- [ ] Standby mode enabled and tested
- [ ] MCP connection verified with inspector
- [ ] MCP marketplace badge obtained
- [ ] Promotional materials created

---

## Phase 7: Framework Integrations

**Goal**: Enable seamless integration with popular RAG frameworks and vector databases.

### Overview

Context Layer sits in the "Context" preparation layer of the AI stack:

```
┌─────────────────────────────────────────────────────────────┐
│  AI Application (Agent, Chatbot, RAG App)                   │
├─────────────────────────────────────────────────────────────┤
│  Orchestration: LangChain, LlamaIndex, CrewAI, Haystack     │
├─────────────────────────────────────────────────────────────┤
│  Protocol: MCP, REST API, Direct SDK                        │
├─────────────────────────────────────────────────────────────┤
│  Context Preparation: CONTEXT LAYER ◄───────────────────    │
│  (crawl, extract, chunk, enrich, embed)                     │
├─────────────────────────────────────────────────────────────┤
│  Storage: Pinecone, Qdrant, Weaviate, Chroma, pgvector      │
└─────────────────────────────────────────────────────────────┘
```

### Step 7.1: LangChain Document Loader

**Package**: `langchain-context-layer` (published to npm/PyPI)

**File**: `integrations/langchain/loader.py`

```python
from typing import Iterator, List, Optional
from langchain_core.document_loaders import BaseLoader
from langchain_core.documents import Document
import requests

class ContextLayerLoader(BaseLoader):
    """Load documents from a Context Layer knowledge base."""

    def __init__(
        self,
        knowledge_base_id: str,
        apify_token: str,
        base_url: str = "https://api.apify.com/v2",
    ):
        self.knowledge_base_id = knowledge_base_id
        self.apify_token = apify_token
        self.base_url = base_url

    def lazy_load(self) -> Iterator[Document]:
        """Lazily load documents from Context Layer."""
        chunks = self._fetch_chunks()
        for chunk in chunks:
            yield Document(
                page_content=chunk["content"],
                metadata={
                    "source": chunk["metadata"]["sourceUrl"],
                    "title": chunk["metadata"]["title"],
                    "chunk_id": chunk["id"],
                    "chunk_index": chunk["metadata"]["chunkIndex"],
                    "token_count": chunk["tokenCount"],
                    # Include enrichments if available
                    "summary": chunk.get("enrichment", {}).get("summary"),
                    "questions": chunk.get("enrichment", {}).get("questions", []),
                },
            )

    def load(self) -> List[Document]:
        """Load all documents."""
        return list(self.lazy_load())

    def _fetch_chunks(self) -> List[dict]:
        """Fetch chunks from Context Layer API."""
        # Implementation using Apify Dataset API
        pass
```

**Usage Example**:

```python
from langchain_context_layer import ContextLayerLoader
from langchain.vectorstores import Chroma
from langchain.embeddings import OpenAIEmbeddings

# Load from Context Layer
loader = ContextLayerLoader(
    knowledge_base_id="kb_abc123",
    apify_token="your_token"
)
docs = loader.load()

# Use with any LangChain vector store
vectorstore = Chroma.from_documents(docs, OpenAIEmbeddings())
retriever = vectorstore.as_retriever()
```

### Step 7.2: LlamaIndex Reader

**Package**: `llama-index-readers-context-layer` (published to PyPI)

**File**: `integrations/llamaindex/reader.py`

```python
from typing import List, Optional
from llama_index.core.readers.base import BaseReader
from llama_index.core.schema import Document

class ContextLayerReader(BaseReader):
    """Read documents from a Context Layer knowledge base."""

    def __init__(
        self,
        apify_token: str,
        base_url: str = "https://api.apify.com/v2",
    ):
        self.apify_token = apify_token
        self.base_url = base_url

    def load_data(
        self,
        knowledge_base_id: str,
        include_embeddings: bool = False,
    ) -> List[Document]:
        """Load documents from Context Layer.

        Args:
            knowledge_base_id: The ID of the knowledge base to load
            include_embeddings: Whether to include pre-computed embeddings

        Returns:
            List of LlamaIndex Document objects
        """
        chunks = self._fetch_chunks(knowledge_base_id)

        documents = []
        for chunk in chunks:
            doc = Document(
                text=chunk["content"],
                metadata={
                    "source_url": chunk["metadata"]["sourceUrl"],
                    "title": chunk["metadata"]["title"],
                    "chunk_id": chunk["id"],
                    "chunk_index": chunk["metadata"]["chunkIndex"],
                    "section": chunk["metadata"].get("section"),
                },
                # Include pre-computed embeddings if available
                embedding=chunk.get("embedding") if include_embeddings else None,
            )

            # Add enrichment data as extra info
            if "enrichment" in chunk:
                doc.metadata["summary"] = chunk["enrichment"].get("summary")
                doc.metadata["questions"] = chunk["enrichment"].get("questions", [])

            documents.append(doc)

        return documents

    def _fetch_chunks(self, kb_id: str) -> List[dict]:
        """Fetch chunks from Context Layer API."""
        # Implementation using Apify Dataset API
        pass
```

**Usage Example**:

```python
from llama_index.readers.context_layer import ContextLayerReader
from llama_index.core import VectorStoreIndex

# Load from Context Layer
reader = ContextLayerReader(apify_token="your_token")
documents = reader.load_data(
    knowledge_base_id="kb_abc123",
    include_embeddings=True  # Use pre-computed embeddings
)

# Build index (skip embedding if already included)
index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine()

# Query
response = query_engine.query("How do I authenticate?")
```

### Step 7.3: Vector Database Exporters

Support direct export to popular vector databases.

**File**: `src/export/vector-db.ts`

```typescript
export interface VectorDBExporter {
    export(chunks: EmbeddedChunk[]): Promise<void>;
}

// Pinecone Exporter
export class PineconeExporter implements VectorDBExporter {
    constructor(
        private apiKey: string,
        private environment: string,
        private indexName: string,
    ) {}

    async export(chunks: EmbeddedChunk[]): Promise<void> {
        const { Pinecone } = await import('@pinecone-database/pinecone');
        const client = new Pinecone({ apiKey: this.apiKey });
        const index = client.index(this.indexName);

        const vectors = chunks.map(chunk => ({
            id: chunk.id,
            values: chunk.embedding!,
            metadata: {
                content: chunk.content,
                source_url: chunk.metadata.sourceUrl,
                title: chunk.metadata.title,
                ...chunk.enrichment,
            },
        }));

        // Batch upsert
        await index.upsert(vectors);
    }
}

// Qdrant Exporter
export class QdrantExporter implements VectorDBExporter {
    constructor(
        private url: string,
        private collectionName: string,
        private apiKey?: string,
    ) {}

    async export(chunks: EmbeddedChunk[]): Promise<void> {
        const { QdrantClient } = await import('@qdrant/js-client-rest');
        const client = new QdrantClient({ url: this.url, apiKey: this.apiKey });

        const points = chunks.map(chunk => ({
            id: chunk.id,
            vector: chunk.embedding!,
            payload: {
                content: chunk.content,
                source_url: chunk.metadata.sourceUrl,
                title: chunk.metadata.title,
                ...chunk.enrichment,
            },
        }));

        await client.upsert(this.collectionName, { points });
    }
}

// Weaviate Exporter
export class WeaviateExporter implements VectorDBExporter {
    constructor(
        private url: string,
        private className: string,
        private apiKey?: string,
    ) {}

    async export(chunks: EmbeddedChunk[]): Promise<void> {
        // Weaviate implementation
    }
}

// Chroma Exporter (for local development)
export class ChromaExporter implements VectorDBExporter {
    constructor(
        private collectionName: string,
        private path?: string,
    ) {}

    async export(chunks: EmbeddedChunk[]): Promise<void> {
        // ChromaDB implementation
    }
}
```

### Step 7.4: Add MCP Tools for Direct Export

**File**: `src/mcp/tools/export.ts`

```typescript
export function registerExportTools(server: McpServer) {
    server.tool(
        'export_to_pinecone',
        {
            description: 'Export a knowledge base directly to Pinecone vector database',
            inputSchema: {
                type: 'object',
                properties: {
                    knowledgeBaseId: { type: 'string' },
                    pineconeApiKey: { type: 'string' },
                    pineconeEnvironment: { type: 'string' },
                    indexName: { type: 'string' },
                },
                required: ['knowledgeBaseId', 'pineconeApiKey', 'indexName'],
            },
        },
        async ({ knowledgeBaseId, pineconeApiKey, pineconeEnvironment, indexName }) => {
            const chunks = await getChunks(knowledgeBaseId);
            const exporter = new PineconeExporter(pineconeApiKey, pineconeEnvironment, indexName);
            await exporter.export(chunks);

            await Actor.charge({ eventName: 'export-vectordb', count: chunks.length });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        chunksExported: chunks.length,
                        destination: `pinecone://${indexName}`,
                    }, null, 2),
                }],
            };
        }
    );

    server.tool(
        'export_to_qdrant',
        {
            description: 'Export a knowledge base directly to Qdrant vector database',
            inputSchema: {
                type: 'object',
                properties: {
                    knowledgeBaseId: { type: 'string' },
                    qdrantUrl: { type: 'string' },
                    collectionName: { type: 'string' },
                    qdrantApiKey: { type: 'string' },
                },
                required: ['knowledgeBaseId', 'qdrantUrl', 'collectionName'],
            },
        },
        async ({ knowledgeBaseId, qdrantUrl, collectionName, qdrantApiKey }) => {
            const chunks = await getChunks(knowledgeBaseId);
            const exporter = new QdrantExporter(qdrantUrl, collectionName, qdrantApiKey);
            await exporter.export(chunks);

            await Actor.charge({ eventName: 'export-vectordb', count: chunks.length });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: true,
                        chunksExported: chunks.length,
                        destination: `qdrant://${collectionName}`,
                    }, null, 2),
                }],
            };
        }
    );
}
```

### Step 7.5: GraphRAG-Compatible Export

For Microsoft GraphRAG, export in a format that can be ingested:

**File**: `src/export/graphrag.ts`

```typescript
export interface GraphRAGDocument {
    id: string;
    text: string;
    title: string;
    source: string;
}

export async function exportForGraphRAG(
    knowledgeBaseId: string,
    outputPath: string,
): Promise<void> {
    const chunks = await getChunks(knowledgeBaseId);

    // GraphRAG expects documents, not chunks
    // Group chunks by source URL and combine
    const documentsByUrl = new Map<string, GraphRAGDocument>();

    for (const chunk of chunks) {
        const url = chunk.metadata.sourceUrl;
        if (!documentsByUrl.has(url)) {
            documentsByUrl.set(url, {
                id: url,
                text: '',
                title: chunk.metadata.title,
                source: url,
            });
        }
        documentsByUrl.get(url)!.text += chunk.content + '\n\n';
    }

    // Write as JSONL or to input directory
    const documents = Array.from(documentsByUrl.values());
    // Save to outputPath for GraphRAG ingestion
}
```

### Step 7.6: LightRAG Integration

**File**: `integrations/lightrag/adapter.py`

```python
from lightrag import LightRAG
from typing import List, Dict

class ContextLayerAdapter:
    """Adapter to use Context Layer data with LightRAG."""

    def __init__(self, apify_token: str):
        self.apify_token = apify_token

    def load_into_lightrag(
        self,
        knowledge_base_id: str,
        lightrag_instance: LightRAG,
    ) -> None:
        """Load Context Layer chunks into a LightRAG instance."""
        chunks = self._fetch_chunks(knowledge_base_id)

        # LightRAG expects text documents
        for chunk in chunks:
            lightrag_instance.insert(chunk["content"])

    def _fetch_chunks(self, kb_id: str) -> List[Dict]:
        # Fetch from Apify API
        pass
```

### Step 7.7: Haystack Integration

**File**: `integrations/haystack/retriever.py`

```python
from haystack import Document
from haystack.components.retrievers import InMemoryEmbeddingRetriever
from typing import List

class ContextLayerRetriever:
    """Haystack retriever backed by Context Layer knowledge base."""

    def __init__(
        self,
        apify_token: str,
        knowledge_base_id: str,
    ):
        self.apify_token = apify_token
        self.knowledge_base_id = knowledge_base_id
        self._documents = None

    def to_haystack_documents(self) -> List[Document]:
        """Convert Context Layer chunks to Haystack Documents."""
        chunks = self._fetch_chunks()

        return [
            Document(
                content=chunk["content"],
                meta={
                    "source": chunk["metadata"]["sourceUrl"],
                    "title": chunk["metadata"]["title"],
                },
                embedding=chunk.get("embedding"),
            )
            for chunk in chunks
        ]

    def _fetch_chunks(self) -> List[dict]:
        # Fetch from Apify API
        pass
```

### Step 7.8: NPM/PyPI Package Structure

Create separate packages for each integration:

```
integrations/
├── langchain/
│   ├── python/
│   │   ├── langchain_context_layer/
│   │   │   ├── __init__.py
│   │   │   ├── loader.py
│   │   │   └── retriever.py
│   │   ├── pyproject.toml
│   │   └── README.md
│   └── typescript/
│       ├── src/
│       │   └── index.ts
│       ├── package.json
│       └── README.md
├── llamaindex/
│   ├── llama_index_readers_context_layer/
│   │   ├── __init__.py
│   │   └── reader.py
│   ├── pyproject.toml
│   └── README.md
├── haystack/
│   └── ...
└── lightrag/
    └── ...
```

### Step 7.9: Update MCP Tools Table

Add new export tools to the MCP interface:

| Tool | Type | Description | Pricing |
|------|------|-------------|---------|
| `export_to_pinecone` | Medium | Export KB to Pinecone | $0.001/chunk |
| `export_to_qdrant` | Medium | Export KB to Qdrant | $0.001/chunk |
| `export_to_weaviate` | Medium | Export KB to Weaviate | $0.001/chunk |
| `get_langchain_config` | Quick | Get config for LangChain loader | Free |
| `get_llamaindex_config` | Quick | Get config for LlamaIndex reader | Free |

### Deliverables for Phase 7

- [ ] LangChain Document Loader (Python + TypeScript)
- [ ] LlamaIndex Reader (Python)
- [ ] Haystack integration
- [ ] LightRAG adapter
- [ ] Pinecone exporter + MCP tool
- [ ] Qdrant exporter + MCP tool
- [ ] Weaviate exporter + MCP tool
- [ ] GraphRAG-compatible export
- [ ] Published npm packages
- [ ] Published PyPI packages
- [ ] Integration documentation
- [ ] Example notebooks for each framework

---

## Summary Timeline

| Phase | Description | Dependencies |
|-------|-------------|--------------|
| **Phase 1** | Pipeline Refactoring | None |
| **Phase 2** | Storage & Knowledge Base | Phase 1 |
| **Phase 3** | MCP Server Implementation | Phase 1, 2 |
| **Phase 4** | Monetization Setup | Phase 3 |
| **Phase 5** | Testing & Documentation | Phase 1-4 |
| **Phase 6** | Deployment & Launch | Phase 1-5 |
| **Phase 7** | Framework Integrations | Phase 6 (can start earlier) |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Breaking existing batch functionality | Keep batch mode code separate, extensive testing |
| MCP SDK changes | Pin version, monitor for updates |
| Storage costs | Start with Apify Dataset, optimize later |
| Search performance at scale | Plan for vector DB in future phase |
| Pricing too high/low | Start conservative, adjust based on usage data |
| Framework API changes | Pin versions, use adapter pattern for easy updates |
| Package maintenance burden | Start with LangChain + LlamaIndex (highest value), add others based on demand |
| Vector DB credential security | Never store credentials, pass at runtime only |

---

## Future Enhancements (Post-Phase 7)

1. **Scheduled Re-crawling** - Keep knowledge bases fresh automatically
2. **Custom Extractors** - User-defined extraction rules for specific sites
3. **Team/Organization Support** - Shared knowledge bases with access control
4. **Analytics Dashboard** - Usage insights and cost tracking for users
5. **Webhook Notifications** - Notify when processing completes
6. **REST API** - Traditional REST API alongside MCP for non-AI clients
7. **GraphQL API** - Flexible querying for complex integrations
8. **Multi-language Support** - Content extraction in non-English languages
9. **PDF/Document Processing** - Extend beyond web pages to documents
10. **Knowledge Base Versioning** - Track changes over time, diff between versions
