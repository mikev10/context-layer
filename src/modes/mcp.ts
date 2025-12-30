/**
 * MCP Server Mode (Placeholder)
 *
 * This module will contain the MCP (Model Context Protocol) server implementation.
 * For now, it's a placeholder that falls back to batch mode.
 *
 * Implementation planned for Phase 3 of the MCP Implementation Plan.
 *
 * Future features:
 * - SSE transport for real-time communication
 * - Tool registration (process_documentation, search_knowledge_base, etc.)
 * - Knowledge base management
 * - Semantic search with embeddings
 */

import { log } from 'apify';

/**
 * Start the MCP server (placeholder)
 *
 * Currently logs a message and falls back to batch mode.
 * Will be implemented in Phase 3.
 */
export async function startMCPServer(): Promise<void> {
    log.info('MCP Server mode not yet implemented (Phase 3)');
    log.info('Falling back to batch mode...');

    // TODO: Implement in Phase 3
    // - MCP SDK integration (@modelcontextprotocol/sdk)
    // - SSE transport setup
    // - Tool registration:
    //   - process_documentation (heavy, async)
    //   - get_job_status (quick)
    //   - list_knowledge_bases (quick)
    //   - search_knowledge_base (quick)
    //   - get_chunks (quick)
    //   - chunk_text (quick)
    //   - extract_url (medium)
    //   - delete_knowledge_base (quick)
    // - Knowledge base storage integration
    // - Billing integration with Actor.charge()

    // For now, import and run batch mode
    const { runBatchMode } = await import('./batch.js');
    await runBatchMode();
}
