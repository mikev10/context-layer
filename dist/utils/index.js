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
 * Escape special regex characters in a string
 *
 * @param str - The string to escape
 * @returns The escaped string safe for use in RegExp
 */
function escapeRegex(str) {
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
export function matchesPattern(url, patterns) {
    if (patterns.length === 0)
        return true;
    return patterns.some(pattern => {
        // First escape regex special chars (except *, ?, which are glob wildcards)
        const escaped = escapeRegex(pattern);
        const regex = new RegExp(escaped
            .replace(/\*\*/g, '.*') // ** → match any chars including /
            .replace(/\*/g, '[^/]*') // * → match any chars except /
            .replace(/\?/g, '.') // ? → match single char
        );
        return regex.test(url);
    });
}
//# sourceMappingURL=index.js.map