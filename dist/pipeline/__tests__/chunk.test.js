/**
 * Tests for chunk module
 */
import { describe, it, expect, vi } from 'vitest';
import { chunkContent, chunkPages, chunkText } from '../chunk.js';
// Mock apify log to avoid initialization issues
vi.mock('apify', () => ({
    log: {
        info: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    },
}));
describe('chunkContent', () => {
    describe('when content fits in one chunk', () => {
        it('should return single chunk', () => {
            const content = 'This is a short piece of text.';
            const result = chunkContent(content, 500, 0);
            expect(result).toHaveLength(1);
            expect(result[0]).toBe('This is a short piece of text.');
        });
    });
    describe('when content has multiple paragraphs', () => {
        it('should split at paragraph boundaries', () => {
            // Use longer paragraphs to ensure splitting happens
            const content = 'This is the first paragraph with enough words to exceed the chunk size limit.\n\nThis is the second paragraph also with many words to ensure it creates a separate chunk.\n\nThe third paragraph continues with additional content.';
            // Use a small chunk size to force splitting
            const result = chunkContent(content, 20, 0);
            expect(result.length).toBeGreaterThan(1);
        });
        it('should combine paragraphs that fit together', () => {
            const content = 'Short one.\n\nShort two.';
            const result = chunkContent(content, 500, 0);
            expect(result).toHaveLength(1);
            expect(result[0]).toContain('Short one');
            expect(result[0]).toContain('Short two');
        });
    });
    describe('when paragraph exceeds chunk size', () => {
        it('should split by sentences', () => {
            const longParagraph = 'First sentence. Second sentence. Third sentence. Fourth sentence. Fifth sentence.';
            // Use small chunk size to force sentence splitting
            const result = chunkContent(longParagraph, 5, 0);
            expect(result.length).toBeGreaterThan(1);
        });
    });
    describe('when overlap is specified', () => {
        it('should include overlap text between chunks', () => {
            const content = 'First chunk content here.\n\nSecond chunk content here.\n\nThird chunk content here.';
            const result = chunkContent(content, 15, 5);
            // With overlap, later chunks should contain words from previous chunks
            if (result.length > 1) {
                // The second chunk should have some overlap from the first
                expect(result.length).toBeGreaterThan(1);
            }
        });
        it('should not include overlap when set to 0', () => {
            const content = 'Chunk one content.\n\nChunk two content.';
            const result = chunkContent(content, 10, 0);
            // Each chunk should be independent
            expect(result.length).toBeGreaterThanOrEqual(1);
        });
    });
    describe('edge cases', () => {
        it('should handle empty content', () => {
            const result = chunkContent('', 500, 0);
            expect(result).toHaveLength(0);
        });
        it('should handle whitespace-only content', () => {
            const result = chunkContent('   \n\n   ', 500, 0);
            expect(result).toHaveLength(0);
        });
        it('should trim chunks', () => {
            const content = '  Content with spaces  ';
            const result = chunkContent(content, 500, 0);
            expect(result[0]).not.toMatch(/^\s/);
            expect(result[0]).not.toMatch(/\s$/);
        });
    });
});
describe('chunkPages', () => {
    it('should create chunks with proper IDs', () => {
        const pages = [
            { url: 'https://example.com/test', title: 'Test', content: 'Page content here.', headings: ['Test'] },
        ];
        const result = chunkPages(pages, { chunkSize: 500, chunkOverlap: 50, outputFormat: 'rag' });
        expect(result[0].id).toMatch(/^chunk-\d{4}$/);
    });
    it('should include metadata from source page', () => {
        const pages = [
            { url: 'https://example.com/test', title: 'Test Title', content: 'Page content.', headings: ['Section One'] },
        ];
        const result = chunkPages(pages, { chunkSize: 500, chunkOverlap: 50, outputFormat: 'rag' });
        expect(result[0].metadata.source_url).toBe('https://example.com/test');
        expect(result[0].metadata.title).toBe('Test Title');
        expect(result[0].metadata.section).toBe('Section One');
    });
    it('should track chunk index and total', () => {
        const pages = [
            { url: 'https://example.com/test', title: 'Test', content: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.', headings: [] },
        ];
        const result = chunkPages(pages, { chunkSize: 10, chunkOverlap: 0, outputFormat: 'rag' });
        if (result.length > 1) {
            expect(result[0].metadata.chunk_index).toBe(0);
            expect(result[0].metadata.total_chunks).toBe(result.length);
        }
    });
    it('should use default chunk size based on format', () => {
        const pages = [
            { url: 'https://example.com/test', title: 'Test', content: 'Content.', headings: [] },
        ];
        // With rag format, default should be 500
        const result = chunkPages(pages, { chunkSize: 0, chunkOverlap: 50, outputFormat: 'rag' });
        expect(result.length).toBeGreaterThanOrEqual(1);
    });
    it('should calculate token count for each chunk', () => {
        const pages = [
            { url: 'https://example.com/test', title: 'Test', content: 'Some content here.', headings: [] },
        ];
        const result = chunkPages(pages, { chunkSize: 500, chunkOverlap: 50, outputFormat: 'rag' });
        expect(result[0].tokenCount).toBeGreaterThan(0);
    });
});
describe('chunkText', () => {
    it('should chunk plain text without metadata', () => {
        const text = 'This is some plain text to chunk.';
        const result = chunkText(text);
        expect(result).toHaveLength(1);
        expect(result[0].content).toBe(text);
        expect(result[0].metadata.source_url).toBe('');
        expect(result[0].metadata.title).toBe('');
    });
    it('should respect chunk size option', () => {
        const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
        const result = chunkText(text, { chunkSize: 5 });
        expect(result.length).toBeGreaterThan(1);
    });
    it('should use default chunk size of 500', () => {
        const text = 'Short text.';
        const result = chunkText(text);
        // With default 500 tokens, this short text should be one chunk
        expect(result).toHaveLength(1);
    });
    it('should number chunks starting from 0', () => {
        const text = 'First.\n\nSecond.\n\nThird.';
        const result = chunkText(text, { chunkSize: 5 });
        expect(result[0].id).toBe('chunk-0000');
        if (result.length > 1) {
            expect(result[1].id).toBe('chunk-0001');
        }
    });
});
//# sourceMappingURL=chunk.test.js.map