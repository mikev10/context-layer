/**
 * Job Tracking Module
 *
 * Tracks processing jobs for async operations (MCP spawned runs).
 * Uses Apify Key-Value Store for persistence.
 */
import type { Job } from '../types/index.js';
/**
 * Create a new job record
 *
 * @param runId - Actor run ID
 * @param knowledgeBaseId - Associated knowledge base ID
 * @returns The created job
 */
export declare function createJob(runId: string, knowledgeBaseId: string): Promise<Job>;
/**
 * Get a job by run ID
 *
 * @param runId - Actor run ID
 * @returns The job or null if not found
 */
export declare function getJob(runId: string): Promise<Job | null>;
/**
 * Update job progress
 *
 * @param runId - Actor run ID
 * @param progress - Progress update
 */
export declare function updateJobProgress(runId: string, progress: Partial<Job['progress']>): Promise<void>;
/**
 * Mark job as completed and update KB status
 *
 * @param runId - Actor run ID
 */
export declare function completeJob(runId: string): Promise<void>;
/**
 * Mark job as failed and update KB status
 *
 * @param runId - Actor run ID
 * @param error - Error message
 */
export declare function failJob(runId: string, error: string): Promise<void>;
//# sourceMappingURL=jobs.d.ts.map