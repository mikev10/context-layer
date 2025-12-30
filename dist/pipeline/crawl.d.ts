/**
 * Crawl Module
 *
 * Handles web crawling using Crawlee's CheerioCrawler.
 * Collects HTML from documentation sites with configurable depth and URL patterns.
 */
import type { CrawlOptions, CrawlResult } from '../types/index.js';
/**
 * Crawl a documentation site and collect HTML from all pages
 *
 * Uses Crawlee's CheerioCrawler to:
 * - Start from a seed URL
 * - Follow links within the same domain
 * - Respect depth and page limits
 * - Filter URLs based on include/exclude patterns
 *
 * @param options - Crawl configuration
 * @returns Crawl results including pages and stats
 */
export declare function crawlSite(options: CrawlOptions): Promise<CrawlResult>;
//# sourceMappingURL=crawl.d.ts.map