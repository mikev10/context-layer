/**
 * Utility functions for Context Layer Actor
 *
 * Re-exports all utilities from submodules.
 */

// Token utilities
export { countTokens, getDefaultChunkSize } from './tokens.js';

// Format utilities
export {
    formatOutput,
    generateMarkdownDocument,
    generateOpenAIFormat,
    generateAlpacaFormat,
} from './format.js';

/** Maximum pattern length to prevent ReDoS attacks */
const MAX_PATTERN_LENGTH = 1000;

/**
 * Escape special regex characters in a string
 *
 * @param str - The string to escape
 * @returns The escaped string safe for use in RegExp
 * @throws Error if string exceeds MAX_PATTERN_LENGTH
 */
function escapeRegex(str: string): string {
    if (str.length > MAX_PATTERN_LENGTH) {
        throw new Error(`Pattern too long (max ${MAX_PATTERN_LENGTH} chars): ${str.slice(0, 50)}...`);
    }
    return str.replace(/[.+^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a URL matches any of the provided glob patterns
 *
 * Supports glob-style patterns:
 * - ** matches any characters including /
 * - * matches any characters except /
 * - ? matches a single character
 *
 * @param url - The URL to check
 * @param patterns - Array of glob patterns
 * @returns True if URL matches any pattern, false otherwise
 */
export function matchesPattern(url: string, patterns: string[]): boolean {
    if (patterns.length === 0) return true;

    return patterns.some(pattern => {
        // First escape regex special chars (except *, ?, which are glob wildcards)
        const escaped = escapeRegex(pattern);
        const regex = new RegExp(
            escaped
                .replace(/\*\*/g, '.*')      // ** → match any chars including /
                .replace(/\*/g, '[^/]*')     // * → match any chars except /
                .replace(/\?/g, '.')         // ? → match single char
        );
        return regex.test(url);
    });
}
