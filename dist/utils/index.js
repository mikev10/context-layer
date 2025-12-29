/**
 * Utility functions for Context Layer Actor
 *
 * Re-exports all utilities from submodules.
 */
// Token utilities
export { countTokens, getDefaultChunkSize } from './tokens.js';
// Format utilities
export { formatOutput, generateMarkdownDocument, generateOpenAIFormat, generateAlpacaFormat, } from './format.js';
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
export function matchesPattern(url, patterns) {
    if (patterns.length === 0)
        return true;
    return patterns.some(pattern => {
        const regex = new RegExp(pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '.'));
        return regex.test(url);
    });
}
//# sourceMappingURL=index.js.map