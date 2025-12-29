/**
 * Crawl Module
 *
 * Handles web crawling using Crawlee's CheerioCrawler.
 * Collects HTML from documentation sites with configurable depth and URL patterns.
 */
import { log } from 'apify';
import { CheerioCrawler, RequestQueue } from 'crawlee';
import { matchesPattern } from '../utils/index.js';
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
export async function crawlSite(options) {
    const { startUrl, maxPages, crawlDepth, urlPatterns = [], excludePatterns = [], } = options;
    const pages = [];
    let pagesFailed = 0;
    const startTime = Date.now();
    // Open request queue and add seed URL
    const requestQueue = await RequestQueue.open();
    await requestQueue.addRequest({
        url: startUrl,
        userData: { depth: 0 },
    });
    // Configure and run crawler
    const crawler = new CheerioCrawler({
        requestQueue,
        maxRequestsPerCrawl: maxPages || undefined,
        async requestHandler({ request, body, enqueueLinks }) {
            const depth = request.userData.depth;
            log.info(`Crawling: ${request.url} (depth: ${depth})`);
            // Store the raw HTML
            pages.push({
                url: request.url,
                html: body.toString(),
                statusCode: 200,
            });
            // Enqueue links if within depth limit
            if (depth < crawlDepth) {
                await enqueueLinks({
                    strategy: 'same-domain',
                    userData: { depth: depth + 1 },
                    transformRequestFunction: (req) => {
                        const url = req.url;
                        // Check exclude patterns first
                        if (excludePatterns.length > 0 && matchesPattern(url, excludePatterns)) {
                            return false;
                        }
                        // Check include patterns if specified
                        if (urlPatterns.length > 0 && !matchesPattern(url, urlPatterns)) {
                            return false;
                        }
                        return req;
                    },
                });
            }
        },
        failedRequestHandler({ request }) {
            log.warning(`Failed to crawl: ${request.url}`);
            pagesFailed++;
        },
    });
    await crawler.run();
    const duration = Date.now() - startTime;
    log.info(`Crawl complete: ${pages.length} pages in ${duration}ms`);
    return {
        pages,
        stats: {
            pagesVisited: pages.length,
            pagesFailed,
            duration,
        },
    };
}
//# sourceMappingURL=crawl.js.map