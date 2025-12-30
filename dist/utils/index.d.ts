/**
 * Utility functions for Context Layer Actor
 *
 * Re-exports all utilities from submodules.
 */
export { countTokens, getDefaultChunkSize } from './tokens.js';
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
export declare function matchesPattern(url: string, patterns: string[]): boolean;
//# sourceMappingURL=index.d.ts.map