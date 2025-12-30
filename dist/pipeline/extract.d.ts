/**
 * Extract Module
 *
 * Handles content extraction from HTML using Cheerio.
 * Removes navigation, ads, and other noise to extract main content.
 */
import type { ExtractedPage, ExtractOptions, CrawledPage } from '../types/index.js';
/**
 * Extract main content from HTML string
 *
 * Uses a multi-step process:
 * 1. Remove noise elements (nav, ads, etc.)
 * 2. Find main content area using selector chain
 * 3. Extract and clean text
 * 4. Extract title and headings for metadata
 *
 * @param html - Raw HTML string
 * @param url - Source URL for the page
 * @param options - Extraction options
 * @returns Extracted page data
 */
export declare function extractContent(html: string, url: string, options?: ExtractOptions): ExtractedPage;
/**
 * Extract content from multiple crawled pages
 *
 * Filters out pages with insufficient content.
 *
 * @param pages - Array of crawled pages with HTML
 * @param options - Extraction options
 * @returns Array of extracted pages
 */
export declare function extractPages(pages: CrawledPage[], options?: ExtractOptions): ExtractedPage[];
/**
 * Extract content from a single URL
 *
 * Utility function for MCP's extract_url tool.
 *
 * @param url - URL to fetch and extract
 * @param options - Extraction options
 * @returns Extracted page data
 */
export declare function extractFromUrl(url: string, options?: ExtractOptions): Promise<ExtractedPage>;
//# sourceMappingURL=extract.d.ts.map