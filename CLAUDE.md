# Context Layer - Global Conventions

## Project Context (Auto-Loaded)

@../.claude/PLANNING.md
@../.claude/TASK.md

## Response Optimization (MANDATORY)

**Token conservation is critical. Follow these rules strictly:**

### Core Rules
- **Never repeat content back** - Don't paste code after editing; say what changed
- **No code unless asked** - Use `file:line` references instead of pasting code
- **Concise by default** - "Done. Fixed X." not verbose explanations
- **No narration** - Don't explain what you're about to do; just do it
- **No preamble** - Skip "Great question!" or restating questions
- **Edit responses**: Single line like "Fixed `file.tsx:23` - added null check"
- **Multi-step tasks**: Use TodoWrite but final summary as bullet points only

### Verbose ONLY When
- User explicitly asks for explanation
- Complex tradeoffs require discussion
- Debugging needs evidence trail

### Context Optimization Methods
- Use subagents for parallelizable work
- Grep/Glob before reading full files
- Summary-first reporting from agents
- Progressive file reading: search → identify → read sections

### File Reading Limits (CRITICAL)
- **Max token limit**: 25,000 tokens per file read - NEVER exceed this
- **Large files**: Be strategic - use `offset`/`limit` to read in chunks
- **Quick lookups**: Prefer Grep for specific content searches
- **Full doc review**: When needed, read incrementally in sections
- **Progressive approach**: Search → identify sections → read targeted chunks → expand if needed

## Project Overview

**Context Layer** is an Apify Actor that transforms documentation sites into AI-ready data:
- **RAG chunks** for vector databases
- **Fine-tuning datasets** for LLM training (OpenAI/Alpaca formats)
- **Markdown exports** for documentation
- **Vector embeddings** via OpenAI

**Dual Mode Architecture** (planned):
- **Batch Mode**: Pipeline processing (crawl → extract → chunk → enrich → embed)
- **Standby Mode**: MCP server for AI agent integration

## Tech Stack

| Category | Technology | Version | Purpose |
|----------|------------|---------|---------|
| **Runtime** | Node.js | 18+ | JavaScript runtime |
| **Language** | TypeScript | 5.9.3 | Type safety |
| **Platform** | Apify Actor | 3.5.2 | Serverless execution |
| **Crawling** | Crawlee | 3.11.0 | Web crawling framework |
| **HTML Parsing** | Cheerio | 1.0.0 | DOM manipulation |
| **LLM - OpenAI** | openai | 4.70.0 | GPT-4o-mini, embeddings |
| **LLM - Anthropic** | @anthropic-ai/sdk | 0.30.0 | Claude 3 Haiku |
| **Tokenization** | tiktoken | 1.0.22 | Token counting |
| **MCP** | @modelcontextprotocol/sdk | 1.0.0 | MCP server (Phase 3) |
| **Build** | tsc | 5.9.3 | TypeScript compilation |
| **Dev Runner** | tsx | 4.20.3 | Development execution |

## Code Structure

### Current (Monolithic)
```
context-layer/
├── .actor/
│   ├── actor.json           # Actor configuration
│   ├── input_schema.json    # Input schema definition
│   └── README.md            # Actor README
├── src/
│   └── main.ts              # All logic (~800 lines)
├── storage/                 # Local development storage
├── package.json
├── tsconfig.json
├── Dockerfile
└── (see PRPs/plans/mcp-implementation-PLAN.md)
```

### Planned (Modular - Phase 1+)
```
src/
├── main.ts                  # Entry point (mode detection)
├── modes/
│   ├── batch.ts             # Batch pipeline entry
│   └── mcp.ts               # MCP server entry
├── pipeline/
│   ├── index.ts             # Pipeline orchestrator
│   ├── crawl.ts             # CheerioCrawler wrapper
│   ├── extract.ts           # Content extraction
│   ├── chunk.ts             # Semantic chunking
│   ├── enrich.ts            # LLM enrichment
│   └── embed.ts             # Embedding generation
├── mcp/
│   ├── server.ts            # MCP protocol handler
│   └── tools/               # Individual tool implementations
├── storage/
│   ├── knowledge-base.ts    # KB CRUD operations
│   └── jobs.ts              # Job tracking
├── types/
│   └── index.ts             # Shared type definitions
└── utils/
    └── index.ts             # Shared utilities
```

### Naming Conventions
- Files: kebab-case (`knowledge-base.ts`)
- Interfaces/Types: PascalCase (`KnowledgeBase`, `CrawlOptions`)
- Functions/variables: camelCase (`crawlSite`, `extractContent`)
- Constants: UPPER_SNAKE_CASE (`DEFAULT_CHUNK_SIZE`)

### Import Order
1. Node.js built-ins (`fs`, `path`)
2. External dependencies (`apify`, `crawlee`, `cheerio`)
3. Internal absolute imports
4. Relative imports (`./types`, `../utils`)
5. Type imports (`import type { ... }`)

## Tech Stack Patterns

### Apify Actor
```typescript
import { Actor, log } from 'apify';

Actor.main(async () => {
    const input = await Actor.getInput<Input>();
    // ... processing ...
    await Actor.pushData(results);
    await Actor.setValue('report', report);
});
```

**Key APIs:**
- `Actor.getInput<T>()` - Get typed input
- `Actor.pushData()` - Save to dataset
- `Actor.setValue()` - Save to key-value store
- `Actor.openDataset()` - Named datasets
- `Actor.charge()` - Pay-per-event billing
- `log.info/warning/error()` - Structured logging

### Crawlee (CheerioCrawler)
```typescript
import { CheerioCrawler, RequestQueue } from 'crawlee';

const crawler = new CheerioCrawler({
    requestQueue,
    maxRequestsPerCrawl: config.maxPages,
    async requestHandler({ request, $, enqueueLinks }) {
        // Extract content using Cheerio ($)
        const content = $('article').text();

        // Enqueue more links
        await enqueueLinks({
            strategy: 'same-domain',
            userData: { depth: depth + 1 },
        });
    },
    failedRequestHandler({ request }) {
        log.warning(`Failed: ${request.url}`);
    },
});
```

**Best Practices:**
- Always use `RequestQueue` for crawl state
- Use `userData` to track depth/metadata
- Use `enqueueLinks` with transforms for filtering
- Handle failures gracefully in `failedRequestHandler`

### Cheerio (HTML Parsing)
```typescript
function extractContent($: CheerioAPI): { content: string; title: string } {
    // Remove unwanted elements first
    $('script, style, nav, footer').remove();

    // Find main content (fallback chain)
    const main = $('article').text()
        || $('main').text()
        || $('.content').text();

    const title = $('h1').first().text() || $('title').text();

    return { content: main.trim(), title: title.trim() };
}
```

**Selector Strategy:**
- Remove noise elements before extraction
- Use fallback chains for content selection
- Extract structure (headings) for metadata

### tiktoken (Token Counting)
```typescript
import { encoding_for_model } from 'tiktoken';

const encoder = encoding_for_model('gpt-4');

function countTokens(text: string): number {
    return encoder.encode(text).length;
}
```

**Important:**
- Initialize encoder once (expensive operation)
- Use `gpt-4` model for accurate counts
- Consider token limits for chunking

### OpenAI SDK
```typescript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey });

// Chat completion
const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
});

// Embeddings
const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
});
```

**Rate Limiting:**
- Batch API calls (5 for chat, 20 for embeddings)
- Add delays between batches (500ms chat, 200ms embeddings)
- Handle errors gracefully (continue without enrichment)

### Anthropic SDK
```typescript
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey });

const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
});

const text = message.content[0]?.type === 'text'
    ? message.content[0].text
    : '';
```

### MCP Server (Phase 3)
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

const server = new McpServer({
    name: 'context-layer',
    version: '1.0.0',
});

server.tool('tool_name', {
    description: 'Tool description',
    inputSchema: { type: 'object', properties: { ... } },
}, async (params) => {
    // Tool implementation
    return { content: [{ type: 'text', text: result }] };
});

const transport = new SSEServerTransport({ endpoint: '/sse' });
await server.connect(transport);
```

## Task Management

**Three-Level Task System:**

**Level 1: Master TASK.md (Epic/Feature Level - Persistent):**
- High-level features tracked in `../.claude/TASK.md`
- Each task has unique ID (TASK-001 through TASK-007 for MCP phases)
- References detailed task files in `../.claude/tasks/`

**Level 2: Feature Task Files (Subtask Level - Persistent):**
- Concrete implementation steps
- Located in `../.claude/tasks/TASK-XXX-*.md`
- Aligns with MCP Implementation Plan phases

**Level 3: TodoWrite (Session-Level - Temporary):**
- Granular step-by-step tasks for current work
- One task `in_progress` at a time
- Mark `completed` immediately when done

**Task-to-Phase Alignment:**

| Task | Phase | Focus |
|------|-------|-------|
| TASK-001 | Phase 1 | Pipeline Refactoring |
| TASK-002 | Phase 2 | Storage & Knowledge Base |
| TASK-003 | Phase 3 | MCP Server |
| TASK-004 | Phase 4 | Monetization |
| TASK-005 | Phase 5 | Testing & Docs |
| TASK-006 | Phase 6 | Deployment |
| TASK-007 | Phase 7 | Integrations |

## Testing Requirements

**Test Structure:**
```typescript
// tests/pipeline/chunk.test.ts
describe('chunkContent', () => {
    describe('when content fits in one chunk', () => {
        it('should return single chunk', () => {
            // Arrange → Act → Assert
        });
    });
});
```

**Test Patterns:**
- Unit tests for pure functions (chunking, extraction)
- Integration tests for pipeline stages
- E2E tests for full Actor runs (Apify test toolkit)

**Coverage Goals:**
- Minimum 80% for business logic
- 100% for chunking/extraction algorithms

## Validation Commands (BLOCKS ON FAILURE)

```bash
# Type check (must exit 0)
npm run build

# Lint check (must exit 0)
npm run lint

# Fix lint issues
npm run lint:fix

# Run locally
npm run start:dev
```

**Enforcement Rules:**
- Run `npm run build` after EVERY significant change
- Run `npm run lint` before commits
- Test locally with `npm start` before pushing

## Security Rules (CRITICAL)

**API Key Handling:**
- ✅ ALWAYS pass API keys via Actor input (never hardcode)
- ✅ ALWAYS use `isSecret: true` in input schema for keys
- ❌ NEVER log API keys or include in error messages
- ❌ NEVER store API keys in key-value store

**Input Validation:**
- ✅ ALWAYS validate required fields (`startUrl`)
- ✅ ALWAYS validate URL format (must be HTTP/HTTPS)
- ✅ ALWAYS set reasonable limits (`maxPages`, `crawlDepth`)

**Rate Limiting:**
- ✅ ALWAYS batch LLM API calls
- ✅ ALWAYS add delays between batches
- ✅ ALWAYS handle rate limit errors gracefully

## Chunking Strategy (CRITICAL)

**Token-Aware Chunking:**
- Use tiktoken for accurate GPT-4 token counting
- Default sizes: RAG=500, fine-tune=1000, markdown=2000
- Overlap preserves context between chunks (default: 50 tokens)

**Semantic Boundaries:**
1. Split at paragraph boundaries first (`\n\n`)
2. If paragraph too large, split at sentences
3. Maintain overlap from end of previous chunk

**Content Cleaning:**
```typescript
// Remove noise patterns
content
    .replace(/See all \d+ articles?/gi, '')
    .replace(/\d+\s*min(ute)?\s*read/gi, '')
    .replace(/Was this (article|page) helpful\??/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
```

## Content Extraction Strategy

**Selector Priority (Main Content):**
1. `.article-body`, `.article-content`, `.markdown-body`
2. `main`, `article`, `[role="main"]`
3. `.content`, `.main-content`, `#content`
4. `body` (fallback)

**Elements to Remove:**
- `script`, `style`, `noscript`, `iframe`, `svg`
- `nav`, `header`, `footer`, `aside`
- `.sidebar`, `.navigation`, `.menu`, `.breadcrumb`
- `.comments`, `.advertisement`, `.social-share`
- `[role="navigation"]`, `[role="banner"]`, `[role="search"]`

## Error Handling

**Graceful Degradation:**
```typescript
try {
    enrichedChunks = await enrichChunks(chunks, config, apiKey);
} catch (error) {
    log.warning(`Enrichment failed: ${error}`);
    enrichedChunks = chunks; // Continue without enrichment
}
```

**Key Principles:**
- Never fail entire run for optional features (enrichment, embeddings)
- Log warnings for recoverable errors
- Throw for critical errors (missing `startUrl`, invalid API key format)
- Always save partial results if possible

## MCP Implementation Reference

**See**: `PRPs/plans/mcp-implementation-PLAN.md` for detailed implementation phases.

**Quick Reference:**
- Mode detection: `process.env.APIFY_META_ORIGIN === 'STANDBY'`
- SSE endpoint: `/sse`
- Self-spawn for heavy ops: `Actor.call('context-layer', input)`
- Billing: `Actor.charge({ eventName, count })`

**MCP Tools (Phase 3):**

| Tool | Type | Description |
|------|------|-------------|
| `process_documentation` | Heavy | Crawl & process site |
| `get_job_status` | Quick | Check job progress |
| `list_knowledge_bases` | Quick | List processed sites |
| `search_knowledge_base` | Quick | Semantic search |
| `get_chunks` | Quick | Retrieve chunks |
| `chunk_text` | Quick | Chunk arbitrary text |
| `extract_url` | Medium | Extract single URL |
| `delete_knowledge_base` | Quick | Remove KB |

## Critical Gotchas

**Apify:**
- `Actor.main()` handles init/exit automatically
- Dataset items have 9MB limit each
- Key-value store values have 9MB limit
- Pay-per-event must be configured in `.actor/pay_per_event.json`

**Crawlee:**
- `RequestQueue` persists state across restarts
- `enqueueLinks` transform returning `false` skips URL
- `maxRequestsPerCrawl: undefined` means unlimited

**Cheerio:**
- `$` is not a browser DOM (no `window`, `document`)
- `.text()` extracts all text including children
- `.remove()` modifies the DOM permanently

**TypeScript/ESM:**
- Project uses ES modules (`"type": "module"`)
- Use `.js` extensions in imports for ESM compatibility
- `tsx` handles TS directly for development

## Never Do This

❌ Hardcode API keys
❌ Log sensitive data (API keys, user content)
❌ Skip input validation
❌ Process unlimited pages without user consent
❌ Make unbatched LLM API calls
❌ Ignore rate limits
❌ Mutate input directly (use spread/copy)
❌ Use `any` type without strong justification
❌ Commit without running `npm run build`
❌ Skip overlap in chunking (context loss)

## Always Do This

✅ Validate all inputs before processing
✅ Use typed interfaces for all data structures
✅ Handle errors gracefully with logging
✅ Batch API calls with delays
✅ Set reasonable defaults for all options
✅ Save partial results on failure
✅ Use `log.info/warning/error` for visibility
✅ Run `npm run build` before committing
✅ Test locally with `npm start` before pushing
✅ Reference `PRPs/plans/mcp-implementation-PLAN.md` for architecture decisions
✅ Update TASK.md after completing work
