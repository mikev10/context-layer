/**
 * Tests for format module
 */
import { describe, it, expect } from 'vitest';
import {
    formatOutput,
    generateMarkdownDocument,
    generateOpenAIFormat,
    generateAlpacaFormat,
} from '../format.js';
import type { Chunk, EnrichmentConfig } from '../../types/index.js';

const createChunk = (overrides: Partial<Chunk> = {}): Chunk => ({
    id: 'chunk-0001',
    content: 'Test content here.',
    tokenCount: 10,
    metadata: {
        source_url: 'https://example.com/test',
        title: 'Test Title',
        section: 'Test Section',
        chunk_index: 0,
        total_chunks: 1,
    },
    ...overrides,
});

const baseEnrichmentConfig: EnrichmentConfig = {
    enabled: false,
    generateQA: false,
    generateSummary: false,
    questionsPerChunk: 3,
};

describe('formatOutput', () => {
    describe('when format is rag', () => {
        it('should return RAG formatted output', () => {
            const chunks = [createChunk()];
            const result = formatOutput(chunks, 'rag', baseEnrichmentConfig);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('id', 'chunk-0001');
            expect(result[0]).toHaveProperty('content', 'Test content here.');
            expect(result[0]).toHaveProperty('metadata');
            expect(result[0]).toHaveProperty('enrichment');
        });

        it('should include embedding if present', () => {
            const chunks = [createChunk({ embedding: [0.1, 0.2, 0.3] })];
            const result = formatOutput(chunks, 'rag', baseEnrichmentConfig);

            expect(result[0]).toHaveProperty('embedding', [0.1, 0.2, 0.3]);
        });

        it('should not include embedding if not present', () => {
            const chunks = [createChunk()];
            const result = formatOutput(chunks, 'rag', baseEnrichmentConfig);

            expect(result[0]).not.toHaveProperty('embedding');
        });
    });

    describe('when format is finetune-openai', () => {
        it('should return OpenAI format output', () => {
            const chunks = [createChunk()];
            const result = formatOutput(chunks, 'finetune-openai', baseEnrichmentConfig);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('messages');
        });
    });

    describe('when format is finetune-alpaca', () => {
        it('should return Alpaca format output', () => {
            const chunks = [createChunk()];
            const result = formatOutput(chunks, 'finetune-alpaca', baseEnrichmentConfig);

            expect(result).toHaveLength(1);
            expect(result[0]).toHaveProperty('instruction');
            expect(result[0]).toHaveProperty('input');
            expect(result[0]).toHaveProperty('output');
        });
    });

    describe('when format is markdown', () => {
        it('should return empty array', () => {
            const chunks = [createChunk()];
            const result = formatOutput(chunks, 'markdown', baseEnrichmentConfig);

            expect(result).toHaveLength(0);
        });
    });

    describe('when format is unknown', () => {
        it('should return chunks as-is', () => {
            const chunks = [createChunk()];
            const result = formatOutput(chunks, 'unknown', baseEnrichmentConfig);

            expect(result).toEqual(chunks);
        });
    });
});

describe('generateMarkdownDocument', () => {
    it('should generate markdown with page headers', () => {
        const chunks = [createChunk()];
        const result = generateMarkdownDocument(chunks, baseEnrichmentConfig);

        expect(result).toContain('# Test Title');
        expect(result).toContain('> **Source:** https://example.com/test');
    });

    it('should include chunk content', () => {
        const chunks = [createChunk({ content: 'Unique content marker.' })];
        const result = generateMarkdownDocument(chunks, baseEnrichmentConfig);

        expect(result).toContain('Unique content marker.');
    });

    it('should group chunks by source URL', () => {
        const chunks = [
            createChunk({ id: 'chunk-0001', metadata: { ...createChunk().metadata, source_url: 'https://example.com/page1', chunk_index: 0 } }),
            createChunk({ id: 'chunk-0002', metadata: { ...createChunk().metadata, source_url: 'https://example.com/page1', chunk_index: 1 } }),
            createChunk({ id: 'chunk-0003', metadata: { ...createChunk().metadata, source_url: 'https://example.com/page2', chunk_index: 0 } }),
        ];
        const result = generateMarkdownDocument(chunks, baseEnrichmentConfig);

        expect(result).toContain('https://example.com/page1');
        expect(result).toContain('https://example.com/page2');
    });

    it('should include enrichment when enabled', () => {
        const chunks = [createChunk({
            enrichment: {
                summary: 'This is a summary.',
                questions: ['What is this?', 'Why is it important?'],
            },
        })];
        const enrichmentConfig: EnrichmentConfig = {
            enabled: true,
            generateQA: true,
            generateSummary: true,
            questionsPerChunk: 3,
        };
        const result = generateMarkdownDocument(chunks, enrichmentConfig);

        expect(result).toContain('**Summary:** This is a summary.');
        expect(result).toContain('**Related Questions:**');
        expect(result).toContain('- What is this?');
    });

    it('should include page separators', () => {
        const chunks = [createChunk()];
        const result = generateMarkdownDocument(chunks, baseEnrichmentConfig);

        expect(result).toContain('---');
    });
});

describe('generateOpenAIFormat', () => {
    it('should create conversation format with system message', () => {
        const chunks = [createChunk()];
        const result = generateOpenAIFormat(chunks, baseEnrichmentConfig);

        expect(result[0].messages[0].role).toBe('system');
        expect(result[0].messages[0].content).toBe('You are a helpful assistant.');
    });

    it('should use title for question when no enrichment', () => {
        const chunks = [createChunk()];
        const result = generateOpenAIFormat(chunks, baseEnrichmentConfig);

        expect(result[0].messages[1].role).toBe('user');
        expect(result[0].messages[1].content).toContain('Explain:');
        expect(result[0].messages[1].content).toContain('Test Title');
    });

    it('should use chunk content as assistant response', () => {
        const chunks = [createChunk({ content: 'The answer content.' })];
        const result = generateOpenAIFormat(chunks, baseEnrichmentConfig);

        expect(result[0].messages[2].role).toBe('assistant');
        expect(result[0].messages[2].content).toBe('The answer content.');
    });

    it('should create multiple records when enrichment has questions', () => {
        const chunks = [createChunk({
            enrichment: { questions: ['Q1?', 'Q2?'] },
        })];
        const enrichmentConfig: EnrichmentConfig = {
            enabled: true,
            generateQA: true,
            generateSummary: false,
            questionsPerChunk: 3,
        };
        const result = generateOpenAIFormat(chunks, enrichmentConfig);

        expect(result).toHaveLength(2);
        expect(result[0].messages[1].content).toBe('Q1?');
        expect(result[1].messages[1].content).toBe('Q2?');
    });
});

describe('generateAlpacaFormat', () => {
    it('should create instruction/input/output format', () => {
        const chunks = [createChunk()];
        const result = generateAlpacaFormat(chunks, baseEnrichmentConfig);

        expect(result[0]).toHaveProperty('instruction');
        expect(result[0]).toHaveProperty('input', '');
        expect(result[0]).toHaveProperty('output');
    });

    it('should use title for instruction when no enrichment', () => {
        const chunks = [createChunk()];
        const result = generateAlpacaFormat(chunks, baseEnrichmentConfig);

        expect(result[0].instruction).toContain('Explain:');
        expect(result[0].instruction).toContain('Test Title');
    });

    it('should use chunk content as output', () => {
        const chunks = [createChunk({ content: 'The output content.' })];
        const result = generateAlpacaFormat(chunks, baseEnrichmentConfig);

        expect(result[0].output).toBe('The output content.');
    });

    it('should create multiple records when enrichment has questions', () => {
        const chunks = [createChunk({
            enrichment: { questions: ['Question 1?', 'Question 2?'] },
        })];
        const enrichmentConfig: EnrichmentConfig = {
            enabled: true,
            generateQA: true,
            generateSummary: false,
            questionsPerChunk: 3,
        };
        const result = generateAlpacaFormat(chunks, enrichmentConfig);

        expect(result).toHaveLength(2);
        expect(result[0].instruction).toBe('Question 1?');
        expect(result[1].instruction).toBe('Question 2?');
    });
});
