/**
 * Extract Module
 *
 * Handles content extraction from HTML using Cheerio.
 * Removes navigation, ads, and other noise to extract main content.
 */
import * as cheerio from 'cheerio';
/**
 * Selectors for elements to remove before extraction
 * These elements typically contain navigation, ads, or other non-content
 */
const REMOVE_SELECTORS = [
    // Basic elements
    'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
    // Navigation and layout
    'nav', 'header', 'footer', 'aside',
    '.sidebar', '.navigation', '.menu', '.breadcrumb', '.breadcrumbs',
    '.pagination', '.pager', '.page-navigation',
    // Common UI elements
    '.comments', '.comment-section', '.advertisement', '.ads', '.ad-container',
    '.social-share', '.share-buttons', '.social-links', '.social-icons',
    '.search', '.search-box', '.search-form', '.search-container',
    '.newsletter', '.subscribe', '.subscription',
    '.cookie-banner', '.cookie-notice', '.gdpr',
    '.popup', '.modal', '.overlay',
    '.related-articles', '.related-posts', '.suggested',
    '.author-bio', '.author-info',
    '.tags', '.tag-list', '.categories',
    '.back-to-top', '.scroll-top',
    // Help center / Zendesk specific
    '.promoted-articles', '.article-list', '.section-list',
    '.article-votes', '.article-vote', '.vote-buttons',
    '.article-meta', '.article-info', '.meta-data',
    '.article-relatives', '.article-sidebar',
    '.follow-article', '.follow-section',
    '.see-all-articles', '.see-more',
    '.request-form', '.submit-request',
    '.recently-viewed', '.recent-activity',
    // ARIA roles
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]', '[role="search"]',
    // Common class patterns
    '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]',
    '[class*="newsletter"]', '[class*="subscribe"]',
    '[class*="social-"]', '[class*="share-"]',
    '[class*="advertisement"]', '[class*="-ad-"]', '[class*="ad-"]',
];
/**
 * Selectors for finding main content area (in priority order)
 */
const MAIN_CONTENT_SELECTORS = [
    // Documentation sites
    '.article-body', '.article-content', '.article__body',
    '.doc-content', '.docs-content', '.documentation-content',
    '.markdown-body', '.prose', '.content-body',
    // Help centers
    '.hc-article-body', '.zendesk-article-body',
    // Generic
    'main', 'article', '[role="main"]',
    '.content', '.main-content', '#content', '#main-content',
    '.post-content', '.entry-content', '.page-content',
];
/**
 * Clean up extracted text content
 *
 * Removes common noise patterns like:
 * - "See all X articles" links
 * - "X min read" labels
 * - Standalone dates
 * - "Was this helpful?" prompts
 *
 * @param content - Raw extracted text
 * @returns Cleaned text
 */
function cleanContent(content) {
    return content
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        // Remove "See all X articles" patterns
        .replace(/See all \d+ articles?/gi, '')
        .replace(/View all \d+ articles?/gi, '')
        .replace(/Show all \d+ articles?/gi, '')
        // Remove "X min read" patterns
        .replace(/\d+\s*min(ute)?\s*read/gi, '')
        // Remove standalone dates (various formats)
        .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s*\d{1,2}:\d{2}\b/gi, '')
        .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\s*\d{1,2}:\d{2}\b/g, '')
        // Remove "Updated X days/hours ago" patterns
        .replace(/Updated?\s+\d+\s+(days?|hours?|minutes?|weeks?|months?)\s+ago/gi, '')
        .replace(/Last updated:?\s*[\w\s,]+\d{4}/gi, '')
        // Remove "Was this article helpful?" patterns
        .replace(/Was this (article|page|content) helpful\??/gi, '')
        .replace(/Did (this|you find this) (help|article helpful)\??/gi, '')
        // Remove vote/feedback prompts
        .replace(/\d+\s*(out of|\/)\s*\d+\s*found this helpful/gi, '')
        .replace(/Yes\s*No\s*(Was this helpful\?)?/gi, '')
        // Remove "Have more questions?" patterns
        .replace(/Have (more )?questions\?\s*(Submit a request|Contact us)?/gi, '')
        // Remove navigation prompts
        .replace(/Skip to (main )?content/gi, '')
        .replace(/Back to top/gi, '')
        .replace(/Return to top/gi, '')
        // Clean up multiple spaces and trim
        .replace(/\s{2,}/g, ' ')
        .trim();
}
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
export function extractContent(html, url, _options = {}) {
    const $ = cheerio.load(html);
    // Remove unwanted elements
    $(REMOVE_SELECTORS.join(', ')).remove();
    // Try to find main content area
    let mainContent = '';
    for (const selector of MAIN_CONTENT_SELECTORS) {
        const element = $(selector);
        if (element.length > 0) {
            mainContent = element.text();
            break;
        }
    }
    // Fallback to body if no main content found
    if (!mainContent) {
        mainContent = $('body').text();
    }
    // Get title
    const title = $('h1').first().text().trim() || $('title').text().trim() || '';
    // Get headings for structure
    const headings = [];
    $('h1, h2, h3').each((_, el) => {
        const text = $(el).text().trim();
        if (text)
            headings.push(text);
    });
    // Clean up the content
    mainContent = cleanContent(mainContent);
    return {
        url,
        title,
        content: mainContent,
        headings,
    };
}
/**
 * Extract content from multiple crawled pages
 *
 * Filters out pages with insufficient content.
 *
 * @param pages - Array of crawled pages with HTML
 * @param options - Extraction options
 * @returns Array of extracted pages
 */
export function extractPages(pages, options = {}) {
    const minContentLength = options.minContentLength ?? 100;
    return pages
        .map(page => extractContent(page.html, page.url, options))
        .filter(page => page.content.length >= minContentLength);
}
/**
 * Extract content from a single URL
 *
 * Utility function for MCP's extract_url tool.
 *
 * @param url - URL to fetch and extract
 * @param options - Extraction options
 * @returns Extracted page data
 */
export async function extractFromUrl(url, options = {}) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    }
    const html = await response.text();
    return extractContent(html, url, options);
}
//# sourceMappingURL=extract.js.map