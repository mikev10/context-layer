/**
 * Context Layer Actor - Main Entry Point
 *
 * An Apify Actor that transforms documentation sites into AI-ready data:
 * - RAG chunks for vector databases
 * - Fine-tuning datasets (OpenAI/Alpaca formats)
 * - Markdown exports
 * - Vector embeddings via OpenAI
 *
 * Supports two modes:
 * - Batch Mode: Standard pipeline processing (default)
 * - Standby Mode: MCP server for AI agent integration (Phase 3)
 */

import { Actor, log } from 'apify';

/**
 * Detect which mode the Actor should run in
 *
 * @returns 'mcp' if running in Standby mode, 'batch' otherwise
 */
function detectMode(): 'mcp' | 'batch' {
    // APIFY_META_ORIGIN is set to 'STANDBY' when Actor is started via Standby mode
    const origin = process.env.APIFY_META_ORIGIN;
    return origin === 'STANDBY' ? 'mcp' : 'batch';
}

/**
 * Main entry point
 *
 * Initializes the Actor, detects the appropriate mode, and runs it.
 */
async function main(): Promise<void> {
    await Actor.init();

    const mode = detectMode();

    if (mode === 'mcp') {
        // MCP Server mode (Standby)
        const { startMCPServer } = await import('./modes/mcp.js');
        await startMCPServer();
    } else {
        // Batch processing mode (default)
        const { runBatchMode } = await import('./modes/batch.js');
        await runBatchMode();
    }

    await Actor.exit();
}

// Run and handle errors
main().catch((error) => {
    log.error('Actor failed:', error);
    process.exit(1);
});
