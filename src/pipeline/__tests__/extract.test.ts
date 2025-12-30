/**
 * Tests for extract module
 */
import { describe, it, expect } from 'vitest';
import { extractContent, extractPages } from '../extract.js';

describe('extractContent', () => {
    describe('when given valid HTML', () => {
        it('should extract main content from article element', () => {
            const html = `
                <html>
                    <body>
                        <nav>Navigation</nav>
                        <article>
                            <h1>Test Article</h1>
                            <p>This is the main content of the article.</p>
                        </article>
                        <footer>Footer content</footer>
                    </body>
                </html>
            `;
            const result = extractContent(html, 'https://example.com/test');

            expect(result.title).toBe('Test Article');
            expect(result.content).toContain('main content');
            expect(result.content).not.toContain('Navigation');
            expect(result.content).not.toContain('Footer');
            expect(result.url).toBe('https://example.com/test');
        });

        it('should extract headings from content', () => {
            const html = `
                <html>
                    <body>
                        <article>
                            <h1>Main Title</h1>
                            <h2>Section One</h2>
                            <p>Content one</p>
                            <h3>Subsection</h3>
                            <p>Content two</p>
                        </article>
                    </body>
                </html>
            `;
            const result = extractContent(html, 'https://example.com/test');

            expect(result.headings).toContain('Main Title');
            expect(result.headings).toContain('Section One');
            expect(result.headings).toContain('Subsection');
        });

        it('should remove script and style elements', () => {
            const html = `
                <html>
                    <head>
                        <style>body { color: red; }</style>
                    </head>
                    <body>
                        <script>alert('hi');</script>
                        <article>
                            <p>Real content here.</p>
                        </article>
                    </body>
                </html>
            `;
            const result = extractContent(html, 'https://example.com/test');

            expect(result.content).not.toContain('alert');
            expect(result.content).not.toContain('color: red');
            expect(result.content).toContain('Real content');
        });

        it('should remove common UI elements', () => {
            const html = `
                <html>
                    <body>
                        <div class="cookie-banner">Accept cookies</div>
                        <div class="social-share">Share on Twitter</div>
                        <article>
                            <p>Article content.</p>
                        </article>
                        <div class="comments">User comments here</div>
                    </body>
                </html>
            `;
            const result = extractContent(html, 'https://example.com/test');

            expect(result.content).not.toContain('cookies');
            expect(result.content).not.toContain('Twitter');
            expect(result.content).not.toContain('comments');
            expect(result.content).toContain('Article content');
        });

        it('should clean up noise patterns from content', () => {
            const html = `
                <html>
                    <body>
                        <article>
                            <p>Real content. See all 15 articles. Was this article helpful? 5 min read.</p>
                        </article>
                    </body>
                </html>
            `;
            const result = extractContent(html, 'https://example.com/test');

            expect(result.content).toContain('Real content');
            expect(result.content).not.toContain('See all 15 articles');
            expect(result.content).not.toContain('Was this article helpful');
            expect(result.content).not.toContain('5 min read');
        });

        it('should fallback to body if no main content found', () => {
            const html = `
                <html>
                    <body>
                        <div>Some body content without semantic markup.</div>
                    </body>
                </html>
            `;
            const result = extractContent(html, 'https://example.com/test');

            expect(result.content).toContain('body content');
        });

        it('should use title tag if no h1 found', () => {
            const html = `
                <html>
                    <head>
                        <title>Page Title</title>
                    </head>
                    <body>
                        <p>Content without H1.</p>
                    </body>
                </html>
            `;
            const result = extractContent(html, 'https://example.com/test');

            expect(result.title).toBe('Page Title');
        });
    });

    describe('when minContentLength option is provided', () => {
        it('should return empty content if below threshold', () => {
            const html = `
                <html>
                    <body>
                        <article><p>Short.</p></article>
                    </body>
                </html>
            `;
            const result = extractContent(html, 'https://example.com/test', { minContentLength: 100 });

            expect(result.content).toBe('');
        });

        it('should return content if above threshold', () => {
            const html = `
                <html>
                    <body>
                        <article>
                            <p>This is a longer piece of content that should definitely exceed the minimum content length threshold we set.</p>
                        </article>
                    </body>
                </html>
            `;
            const result = extractContent(html, 'https://example.com/test', { minContentLength: 50 });

            expect(result.content.length).toBeGreaterThan(50);
        });
    });
});

describe('extractPages', () => {
    it('should extract content from multiple pages', () => {
        const pages = [
            { url: 'https://example.com/1', html: '<html><body><article><h1>Page 1</h1><p>This is the content for page one which has enough text to pass the minimum content length threshold that filters out short pages.</p></article></body></html>', statusCode: 200 },
            { url: 'https://example.com/2', html: '<html><body><article><h1>Page 2</h1><p>This is the content for page two which also has enough text to pass the minimum content length threshold that filters out short pages.</p></article></body></html>', statusCode: 200 },
        ];

        const result = extractPages(pages);

        expect(result).toHaveLength(2);
        expect(result[0].title).toBe('Page 1');
        expect(result[1].title).toBe('Page 2');
    });

    it('should filter out pages with short content', () => {
        const pages = [
            { url: 'https://example.com/1', html: '<html><body><article><h1>Good Page</h1><p>This has enough content to pass the minimum threshold check.</p></article></body></html>', statusCode: 200 },
            { url: 'https://example.com/2', html: '<html><body><article><p>Short</p></article></body></html>', statusCode: 200 },
        ];

        const result = extractPages(pages, { minContentLength: 50 });

        expect(result).toHaveLength(1);
        expect(result[0].url).toBe('https://example.com/1');
    });
});
