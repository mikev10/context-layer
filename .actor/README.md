# Context Layer

Transform documentation sites into a clean, structured **context layer** for AI systems — optimized for RAG, fine-tuning, embeddings, and semantic search.

Context Layer is an end-to-end pipeline that **scrapes and extracts** documentation, help centers, and knowledge bases, then converts them into AI-ready data in minutes instead of days. No custom code required.

---

## 🚀 What This Actor Does

Context Layer automates the hardest part of AI knowledge engineering: preparing high-quality context from real documentation.

It performs the full pipeline:

1. **Crawls** documentation sites and knowledge bases
2. **Extracts** clean content (removes navigation, footers, ads, UI noise)
3. **Chunks** content intelligently using semantic boundaries and token-aware sizing
4. **Enriches** content with AI-generated summaries and Q&A pairs (optional)
5. **Embeds** chunks with vector embeddings for semantic search (optional)
6. **Exports** data in formats ready for RAG systems, fine-tuning, or markdown

This Actor is designed for **AI systems**, not raw scraping.

---

## ⚡ Quick Start

**1. Enter a documentation URL**

```json
{
  "startUrl": "https://docs.example.com"
}
```

**2. Run the Actor**

Click "Start" and wait for the crawl to complete.

**3. Download your data**

- Go to the **Dataset** tab for structured JSON chunks
- Or download `context_layer.md` from the **Key-value store** for markdown output

That's it — your documentation is now AI-ready.

---

## 🎯 When to Use Context Layer

Use this Actor when you want to:

* Build a **RAG chatbot** from your documentation
* Prepare clean datasets for **LLM fine-tuning**
* Generate **semantic embeddings** for vector databases
* Convert docs into a **portable markdown knowledge base**
* Power **semantic search** over documentation
* **Extract and scrape API documentation** for AI processing

You likely don't need this Actor if you only want raw HTML or screenshots.

---

## 📦 Output Formats

### RAG Format (Default)

Optimized for vector databases such as Pinecone, Weaviate, Qdrant, or Chroma.

```json
{
  "id": "chunk-0001",
  "content": "The actual chunk text...",
  "metadata": {
    "source_url": "https://docs.example.com/getting-started",
    "title": "Getting Started",
    "section": "Installation",
    "chunk_index": 0,
    "total_chunks": 5
  },
  "enrichment": {
    "summary": "This section explains how to install...",
    "questions": [
      "How do I install the software?",
      "What are the system requirements?"
    ]
  },
  "embedding": [0.123, -0.456, "..."]
}
```

---

### Fine-tuning Format (OpenAI)

Ready for the OpenAI fine-tuning API (JSONL).

```json
{
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "How do I install the software?" },
    { "role": "assistant", "content": "To install, follow these steps..." }
  ]
}
```

---

### Fine-tuning Format (Alpaca)

Instruction-tuning format for open-source models.

```json
{
  "instruction": "How do I reset my password?",
  "input": "",
  "output": "To reset your password, go to Settings..."
}
```

---

### Markdown Format

Exports a clean `context_layer.md` file containing all processed documentation, organized by source page.

---

## ⚙️ Input Options

### Crawling

| Parameter         | Description                                  | Default                                        |
| ----------------- | -------------------------------------------- | ---------------------------------------------- |
| `startUrl`        | URL of the documentation or knowledge base   | **Required**                                   |
| `maxPages`        | Maximum pages to crawl (0 = unlimited)       | 50                                             |
| `crawlDepth`      | Link depth from the start URL                | 3                                              |
| `urlPatterns`     | Only crawl URLs matching these glob patterns | `[]`                                           |
| `excludePatterns` | Skip URLs matching these patterns            | `["**/changelog**", "**/blog**", "**/news**"]` |

---

### Chunking

| Parameter      | Description                            | Default |
| -------------- | -------------------------------------- | ------- |
| `chunkSize`    | Target chunk size in tokens (0 = auto) | 0       |
| `chunkOverlap` | Overlapping tokens between chunks      | 50      |

**Auto chunk sizes:**

* RAG: ~500 tokens
* Fine-tuning: ~1000 tokens
* Markdown: ~2000 tokens

---

### Output

| Parameter      | Description                                                | Default |
| -------------- | ---------------------------------------------------------- | ------- |
| `outputFormat` | `rag`, `finetune-openai`, `finetune-alpaca`, or `markdown` | `rag`   |

---

### 🤖 AI Enrichment (Optional)

| Parameter           | Description                                            | Default  |
| ------------------- | ------------------------------------------------------ | -------- |
| `generateQA`        | Generate Q&A pairs for each chunk                      | false    |
| `generateSummary`   | Generate summaries for each chunk                      | false    |
| `questionsPerChunk` | Number of Q&A pairs per chunk                          | 3        |
| `llmProvider`       | `openai` (GPT-4o-mini) or `anthropic` (Claude 3 Haiku) | `openai` |
| `llmApiKey`         | API key for selected LLM provider                      | —        |

---

### 🔢 Vector Embeddings (Optional)

| Parameter            | Description                                        | Default                  |
| -------------------- | -------------------------------------------------- | ------------------------ |
| `generateEmbeddings` | Generate vector embeddings                         | false                    |
| `embeddingModel`     | `text-embedding-3-small`, `text-embedding-3-large` | `text-embedding-3-small` |
| `embeddingApiKey`    | OpenAI API key for embeddings                      | —                        |

---

## 📝 Example Usage

### Basic RAG Export

```json
{
  "startUrl": "https://docs.example.com",
  "outputFormat": "rag"
}
```

---

### RAG with Embeddings

```json
{
  "startUrl": "https://docs.example.com",
  "generateEmbeddings": true,
  "embeddingModel": "text-embedding-3-small",
  "embeddingApiKey": "sk-..."
}
```

---

### Fine-tuning with AI-Generated Q&A

```json
{
  "startUrl": "https://help.example.com",
  "outputFormat": "finetune-openai",
  "generateQA": true,
  "questionsPerChunk": 5,
  "llmProvider": "openai",
  "llmApiKey": "sk-..."
}
```

---

## 📂 Output Files

* **Default dataset** — all processed context chunks
* **training_data.jsonl** — for fine-tuning formats
* **context_layer.md** — markdown export (if selected)
* **report.json** — crawl and processing statistics

---

## 💰 Pricing

Context Layer uses **Pay-Per-Event** pricing:

| Event                        | Price   | Description                        |
| ---------------------------- | ------- | ---------------------------------- |
| `apify-actor-start`          | $0.02   | Charged once when the Actor starts |
| `apify-default-dataset-item` | $0.0015 | Charged per context chunk produced |

**Example cost:** Processing 100 pages producing 500 chunks ≈ $0.77

This pricing is designed to be fair, predictable, and scalable.

---

## 🌐 Why Use Apify?

Running Context Layer on Apify gives you:

* **Scheduled runs** — Keep your AI context fresh with automatic updates
* **REST API access** — Trigger runs programmatically from your app
* **Monitoring & alerts** — Get notified if something fails
* **Integrations** — Connect to Zapier, Make, Google Sheets, and more
* **No infrastructure** — No servers to manage or scale

---

## 🔧 Supported Documentation Platforms

Works with most public documentation sites, including:

* GitBook
* ReadTheDocs
* Docusaurus
* MkDocs
* Zendesk Help Centers
* Intercom Articles
* Notion (public pages)
* Confluence (public pages)
* Custom documentation sites

---

## ❓ FAQ

**Do I need an LLM API key?**
Only if you enable Q&A or summary generation.

**Do I need an embedding API key?**
Only if you enable embeddings.

**Can this crawl private or authenticated sites?**
No. Only publicly accessible content is supported.

**What makes this different from a scraper?**
Scrapers extract text. Context Layer produces **structured, semantic context** designed for AI systems.

**How do I handle large documentation sites?**
Increase `maxPages` and use `urlPatterns` to focus on specific sections.

---

## 💬 Support & Feedback

* **Issues or bugs?** Open an issue on the Actor's Issues tab
* **Feature requests?** We'd love to hear from you — drop a message in Issues
* **Custom solutions?** Contact us for enterprise or custom integration needs

---

## 📚 About

Context Layer is built for teams who want AI-ready knowledge without building and maintaining custom ingestion pipelines.

It fits naturally into modern AI stacks alongside vector databases, RAG frameworks, and agent systems — and serves as a foundational **context ingestion layer** for larger knowledge systems.
