/**
 * Tests for utils index module (matchesPattern)
 */
import { describe, it, expect } from 'vitest';
import { matchesPattern } from '../index.js';
describe('matchesPattern', () => {
    describe('when patterns array is empty', () => {
        it('should return true for any URL', () => {
            expect(matchesPattern('https://example.com/any/path', [])).toBe(true);
        });
    });
    describe('when using exact patterns', () => {
        it('should match exact URL', () => {
            const patterns = ['https://example.com/docs'];
            expect(matchesPattern('https://example.com/docs', patterns)).toBe(true);
        });
        it('should not match different URL', () => {
            const patterns = ['https://example.com/docs'];
            expect(matchesPattern('https://example.com/api', patterns)).toBe(false);
        });
    });
    describe('when using ** glob pattern', () => {
        it('should match any path with **', () => {
            const patterns = ['**/docs/**'];
            expect(matchesPattern('https://example.com/docs/getting-started', patterns)).toBe(true);
            expect(matchesPattern('https://example.com/v2/docs/api/reference', patterns)).toBe(true);
        });
        it('should match nested paths', () => {
            const patterns = ['https://example.com/**'];
            expect(matchesPattern('https://example.com/a/b/c/d/e', patterns)).toBe(true);
        });
    });
    describe('when using * glob pattern', () => {
        it('should match single path segment', () => {
            const patterns = ['https://example.com/*/docs'];
            expect(matchesPattern('https://example.com/v1/docs', patterns)).toBe(true);
            expect(matchesPattern('https://example.com/v2/docs', patterns)).toBe(true);
        });
        it('should not match across slashes', () => {
            const patterns = ['https://example.com/*/docs'];
            expect(matchesPattern('https://example.com/a/b/docs', patterns)).toBe(false);
        });
    });
    describe('when using ? glob pattern', () => {
        it('should match single character', () => {
            const patterns = ['https://example.com/v?/docs'];
            expect(matchesPattern('https://example.com/v1/docs', patterns)).toBe(true);
            expect(matchesPattern('https://example.com/v2/docs', patterns)).toBe(true);
        });
        it('should not match multiple characters', () => {
            const patterns = ['https://example.com/v?/docs'];
            expect(matchesPattern('https://example.com/v10/docs', patterns)).toBe(false);
        });
    });
    describe('when using multiple patterns', () => {
        it('should match if any pattern matches', () => {
            const patterns = ['**/blog/**', '**/docs/**', '**/api/**'];
            expect(matchesPattern('https://example.com/docs/intro', patterns)).toBe(true);
            expect(matchesPattern('https://example.com/blog/post-1', patterns)).toBe(true);
            expect(matchesPattern('https://example.com/api/v1', patterns)).toBe(true);
        });
        it('should not match if no pattern matches', () => {
            const patterns = ['**/blog/**', '**/docs/**'];
            expect(matchesPattern('https://example.com/about', patterns)).toBe(false);
        });
    });
    describe('when pattern contains special regex characters', () => {
        it('should escape dots in pattern', () => {
            const patterns = ['https://example.com/file.txt'];
            expect(matchesPattern('https://example.com/file.txt', patterns)).toBe(true);
            expect(matchesPattern('https://example.com/fileXtxt', patterns)).toBe(false);
        });
        it('should escape parentheses in pattern', () => {
            const patterns = ['https://example.com/(test)'];
            expect(matchesPattern('https://example.com/(test)', patterns)).toBe(true);
        });
        it('should escape brackets in pattern', () => {
            const patterns = ['https://example.com/[docs]'];
            expect(matchesPattern('https://example.com/[docs]', patterns)).toBe(true);
        });
    });
    describe('edge cases', () => {
        it('should handle empty URL with empty patterns', () => {
            // Empty patterns array returns true for any URL
            expect(matchesPattern('', [])).toBe(true);
        });
        it('should handle URL with query parameters', () => {
            const patterns = ['**/docs/**'];
            expect(matchesPattern('https://example.com/docs/page?version=2', patterns)).toBe(true);
        });
        it('should handle URL with hash', () => {
            const patterns = ['**/docs/**'];
            expect(matchesPattern('https://example.com/docs/page#section', patterns)).toBe(true);
        });
    });
    describe('ReDoS protection', () => {
        it('should throw error for patterns exceeding max length', () => {
            const longPattern = 'a'.repeat(1001);
            expect(() => matchesPattern('https://example.com', [longPattern])).toThrow('Pattern too long');
        });
        it('should accept patterns at max length', () => {
            const maxPattern = 'a'.repeat(1000);
            // Should not throw
            expect(() => matchesPattern('https://example.com', [maxPattern])).not.toThrow();
        });
    });
});
//# sourceMappingURL=index.test.js.map