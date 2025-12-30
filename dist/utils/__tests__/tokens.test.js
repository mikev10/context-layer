/**
 * Tests for tokens module
 */
import { describe, it, expect } from 'vitest';
import { countTokens, getDefaultChunkSize } from '../tokens.js';
describe('countTokens', () => {
    it('should count tokens in simple text', () => {
        const result = countTokens('Hello world');
        expect(result).toBeGreaterThan(0);
    });
    it('should count tokens accurately for known text', () => {
        // "The quick brown fox" is typically 4 tokens
        const result = countTokens('The quick brown fox');
        expect(result).toBe(4);
    });
    it('should handle empty string', () => {
        const result = countTokens('');
        expect(result).toBe(0);
    });
    it('should count more tokens for longer text', () => {
        const short = countTokens('Hello');
        const long = countTokens('Hello world, this is a much longer sentence with more words.');
        expect(long).toBeGreaterThan(short);
    });
    it('should handle special characters', () => {
        const result = countTokens('Hello! @#$% World?');
        expect(result).toBeGreaterThan(0);
    });
    it('should handle unicode characters', () => {
        const result = countTokens('Hello 世界 🌍');
        expect(result).toBeGreaterThan(0);
    });
    it('should handle newlines', () => {
        const result = countTokens('Line one\nLine two\nLine three');
        expect(result).toBeGreaterThan(0);
    });
});
describe('getDefaultChunkSize', () => {
    it('should return 500 for rag format', () => {
        expect(getDefaultChunkSize('rag')).toBe(500);
    });
    it('should return 1000 for finetune-openai format', () => {
        expect(getDefaultChunkSize('finetune-openai')).toBe(1000);
    });
    it('should return 1000 for finetune-alpaca format', () => {
        expect(getDefaultChunkSize('finetune-alpaca')).toBe(1000);
    });
    it('should return 2000 for markdown format', () => {
        expect(getDefaultChunkSize('markdown')).toBe(2000);
    });
    it('should return 500 for unknown format', () => {
        expect(getDefaultChunkSize('unknown')).toBe(500);
    });
    it('should return 500 for empty string', () => {
        expect(getDefaultChunkSize('')).toBe(500);
    });
});
//# sourceMappingURL=tokens.test.js.map