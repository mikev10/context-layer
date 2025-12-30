/**
 * Job Tracking Module
 *
 * Tracks processing jobs for async operations (MCP spawned runs).
 * Uses Apify Key-Value Store for persistence.
 */
import { Actor, log } from 'apify';
import { updateKnowledgeBaseStatus } from './knowledge-base.js';
// ============================================================================
// Constants
// ============================================================================
const JOB_PREFIX = 'job_';
// ============================================================================
// Job CRUD Operations
// ============================================================================
/**
 * Create a new job record
 *
 * @param runId - Actor run ID
 * @param knowledgeBaseId - Associated knowledge base ID
 * @returns The created job
 */
export async function createJob(runId, knowledgeBaseId) {
    const job = {
        id: runId,
        knowledgeBaseId,
        status: 'pending',
        progress: {
            phase: 'crawling',
            current: 0,
            total: 0,
        },
        startedAt: new Date().toISOString(),
    };
    const store = await Actor.openKeyValueStore();
    await store.setValue(`${JOB_PREFIX}${runId}`, job);
    log.info(`Created job: ${runId}`, { knowledgeBaseId });
    return job;
}
/**
 * Get a job by run ID
 *
 * @param runId - Actor run ID
 * @returns The job or null if not found
 */
export async function getJob(runId) {
    const store = await Actor.openKeyValueStore();
    return store.getValue(`${JOB_PREFIX}${runId}`);
}
/**
 * Update job progress
 *
 * @param runId - Actor run ID
 * @param progress - Progress update
 */
export async function updateJobProgress(runId, progress) {
    const job = await getJob(runId);
    if (!job) {
        log.warning(`Job not found: ${runId}`);
        return;
    }
    // Ensure status is running
    if (job.status === 'pending') {
        job.status = 'running';
    }
    job.progress = { ...job.progress, ...progress };
    const store = await Actor.openKeyValueStore();
    await store.setValue(`${JOB_PREFIX}${runId}`, job);
}
/**
 * Mark job as completed and update KB status
 *
 * @param runId - Actor run ID
 */
export async function completeJob(runId) {
    const job = await getJob(runId);
    if (!job) {
        log.warning(`Job not found: ${runId}`);
        return;
    }
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    const store = await Actor.openKeyValueStore();
    await store.setValue(`${JOB_PREFIX}${runId}`, job);
    // Update KB status to ready
    try {
        await updateKnowledgeBaseStatus(job.knowledgeBaseId, 'ready');
    }
    catch (error) {
        log.warning(`Could not update KB status for job ${runId}`, { error });
    }
    log.info(`Job completed: ${runId}`);
}
/**
 * Mark job as failed and update KB status
 *
 * @param runId - Actor run ID
 * @param error - Error message
 */
export async function failJob(runId, error) {
    const job = await getJob(runId);
    if (!job) {
        log.warning(`Job not found: ${runId}`);
        return;
    }
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.error = error;
    const store = await Actor.openKeyValueStore();
    await store.setValue(`${JOB_PREFIX}${runId}`, job);
    // Update KB status to failed
    try {
        await updateKnowledgeBaseStatus(job.knowledgeBaseId, 'failed');
    }
    catch (kbError) {
        log.warning(`Could not update KB status for job ${runId}`, { error: kbError });
    }
    log.error(`Job failed: ${runId}`, { error });
}
//# sourceMappingURL=jobs.js.map