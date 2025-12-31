/**
 * Tests for jobs module
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Actor, log } from 'apify';
import { createJob, getJob, updateJobProgress, completeJob, failJob } from '../jobs.js';
import { updateKnowledgeBaseStatus } from '../knowledge-base.js';
import type { Job } from '../../types/index.js';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('apify');
vi.mock('../knowledge-base.js');

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test job object
 */
function createTestJob(overrides?: Partial<Job>): Job {
    return {
        id: 'test-run-123',
        knowledgeBaseId: 'kb-abc',
        status: 'pending',
        progress: {
            phase: 'crawling',
            current: 0,
            total: 0,
        },
        startedAt: '2025-01-01T00:00:00.000Z',
        ...overrides,
    };
}

/**
 * Setup mock store for tests
 */
function setupMockStore() {
    const mockStore = {
        getValue: vi.fn(),
        setValue: vi.fn(),
    };

    vi.mocked(Actor.openKeyValueStore).mockResolvedValue(mockStore as any);
    return mockStore;
}

// ============================================================================
// Tests
// ============================================================================

describe('createJob', () => {
    let mockStore: ReturnType<typeof setupMockStore>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = setupMockStore();
    });

    it('should create job with pending status', async () => {
        const job = await createJob('run-123', 'kb-456');

        expect(job.status).toBe('pending');
    });

    it('should create job with correct initial progress', async () => {
        const job = await createJob('run-123', 'kb-456');

        expect(job.progress.phase).toBe('crawling');
        expect(job.progress.current).toBe(0);
        expect(job.progress.total).toBe(0);
    });

    it('should save job to key-value store with correct key', async () => {
        await createJob('run-123', 'kb-456');

        expect(mockStore.setValue).toHaveBeenCalledWith(
            'job_run-123',
            expect.objectContaining({
                id: 'run-123',
                knowledgeBaseId: 'kb-456',
            })
        );
    });

    it('should set run ID as job ID', async () => {
        const job = await createJob('run-xyz', 'kb-abc');

        expect(job.id).toBe('run-xyz');
    });

    it('should set knowledge base ID correctly', async () => {
        const job = await createJob('run-123', 'kb-target');

        expect(job.knowledgeBaseId).toBe('kb-target');
    });

    it('should set startedAt timestamp', async () => {
        const beforeCreate = new Date().toISOString();
        const job = await createJob('run-123', 'kb-456');
        const afterCreate = new Date().toISOString();

        expect(job.startedAt).toBeDefined();
        expect(job.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
        expect(job.startedAt >= beforeCreate).toBe(true);
        expect(job.startedAt <= afterCreate).toBe(true);
    });

    it('should return the created job', async () => {
        const job = await createJob('run-123', 'kb-456');

        expect(job).toMatchObject({
            id: 'run-123',
            knowledgeBaseId: 'kb-456',
            status: 'pending',
            progress: {
                phase: 'crawling',
                current: 0,
                total: 0,
            },
        });
    });
});

describe('getJob', () => {
    let mockStore: ReturnType<typeof setupMockStore>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = setupMockStore();
    });

    it('should return job when exists', async () => {
        const testJob = createTestJob({ id: 'run-found' });
        mockStore.getValue.mockResolvedValue(testJob);

        const result = await getJob('run-found');

        expect(result).toEqual(testJob);
    });

    it('should query store with correct key', async () => {
        mockStore.getValue.mockResolvedValue(null);

        await getJob('run-123');

        expect(mockStore.getValue).toHaveBeenCalledWith('job_run-123');
    });

    it('should return null when job not found', async () => {
        mockStore.getValue.mockResolvedValue(null);

        const result = await getJob('non-existent');

        expect(result).toBeNull();
    });
});

describe('updateJobProgress', () => {
    let mockStore: ReturnType<typeof setupMockStore>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = setupMockStore();
    });

    describe('when job exists', () => {
        it('should update progress phase', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);

            await updateJobProgress('test-run-123', { phase: 'chunking' });

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    progress: expect.objectContaining({
                        phase: 'chunking',
                    }),
                })
            );
        });

        it('should update progress current count', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);

            await updateJobProgress('test-run-123', { current: 5 });

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    progress: expect.objectContaining({
                        current: 5,
                    }),
                })
            );
        });

        it('should update progress total count', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);

            await updateJobProgress('test-run-123', { total: 10 });

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    progress: expect.objectContaining({
                        total: 10,
                    }),
                })
            );
        });

        it('should merge progress fields', async () => {
            const testJob = createTestJob({
                progress: {
                    phase: 'extracting',
                    current: 3,
                    total: 10,
                },
            });
            mockStore.getValue.mockResolvedValue(testJob);

            await updateJobProgress('test-run-123', { current: 5 });

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    progress: {
                        phase: 'extracting',
                        current: 5,
                        total: 10,
                    },
                })
            );
        });

        it('should change status from pending to running', async () => {
            const testJob = createTestJob({ status: 'pending' });
            mockStore.getValue.mockResolvedValue(testJob);

            await updateJobProgress('test-run-123', { current: 1 });

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    status: 'running',
                })
            );
        });

        it('should not change status if already running', async () => {
            const testJob = createTestJob({ status: 'running' });
            mockStore.getValue.mockResolvedValue(testJob);

            await updateJobProgress('test-run-123', { current: 2 });

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    status: 'running',
                })
            );
        });

        it('should preserve other job fields', async () => {
            const testJob = createTestJob({
                id: 'run-preserve',
                knowledgeBaseId: 'kb-preserve',
                startedAt: '2025-01-01T10:00:00.000Z',
            });
            mockStore.getValue.mockResolvedValue(testJob);

            await updateJobProgress('run-preserve', { current: 5 });

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_run-preserve',
                expect.objectContaining({
                    id: 'run-preserve',
                    knowledgeBaseId: 'kb-preserve',
                    startedAt: '2025-01-01T10:00:00.000Z',
                })
            );
        });
    });

    describe('when job not found', () => {
        it('should do nothing', async () => {
            mockStore.getValue.mockResolvedValue(null);

            await updateJobProgress('non-existent', { current: 5 });

            expect(mockStore.setValue).not.toHaveBeenCalled();
        });

        it('should log warning', async () => {
            mockStore.getValue.mockResolvedValue(null);

            await updateJobProgress('missing-job', { current: 5 });

            expect(log.warning).toHaveBeenCalledWith('Job not found: missing-job');
        });
    });
});

describe('completeJob', () => {
    let mockStore: ReturnType<typeof setupMockStore>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = setupMockStore();
    });

    describe('when job exists', () => {
        it('should set status to completed', async () => {
            const testJob = createTestJob({ status: 'running' });
            mockStore.getValue.mockResolvedValue(testJob);

            await completeJob('test-run-123');

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    status: 'completed',
                })
            );
        });

        it('should set completedAt timestamp', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);

            const beforeComplete = new Date().toISOString();
            await completeJob('test-run-123');
            const afterComplete = new Date().toISOString();

            const savedJob = mockStore.setValue.mock.calls[0][1] as Job;
            expect(savedJob.completedAt).toBeDefined();
            expect(savedJob.completedAt!).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(savedJob.completedAt! >= beforeComplete).toBe(true);
            expect(savedJob.completedAt! <= afterComplete).toBe(true);
        });

        it('should update KB status to ready', async () => {
            const testJob = createTestJob({ knowledgeBaseId: 'kb-complete' });
            mockStore.getValue.mockResolvedValue(testJob);

            await completeJob('test-run-123');

            expect(updateKnowledgeBaseStatus).toHaveBeenCalledWith('kb-complete', 'ready');
        });

        it('should preserve other job fields', async () => {
            const testJob = createTestJob({
                id: 'run-xyz',
                knowledgeBaseId: 'kb-xyz',
                startedAt: '2025-01-01T08:00:00.000Z',
                progress: {
                    phase: 'saving',
                    current: 10,
                    total: 10,
                },
            });
            mockStore.getValue.mockResolvedValue(testJob);

            await completeJob('run-xyz');

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_run-xyz',
                expect.objectContaining({
                    id: 'run-xyz',
                    knowledgeBaseId: 'kb-xyz',
                    startedAt: '2025-01-01T08:00:00.000Z',
                    progress: {
                        phase: 'saving',
                        current: 10,
                        total: 10,
                    },
                })
            );
        });
    });

    describe('when KB status update fails', () => {
        it('should handle failure gracefully', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);
            vi.mocked(updateKnowledgeBaseStatus).mockRejectedValue(new Error('KB update failed'));

            // Should not throw
            await expect(completeJob('test-run-123')).resolves.not.toThrow();

            // Should still save job as completed
            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    status: 'completed',
                })
            );
        });

        it('should log warning on KB update failure', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);
            vi.mocked(updateKnowledgeBaseStatus).mockRejectedValue(new Error('KB error'));

            await completeJob('test-run-123');

            expect(log.warning).toHaveBeenCalledWith(
                'Could not update KB status for job test-run-123',
                expect.objectContaining({ error: expect.any(Error) })
            );
        });
    });

    describe('when job not found', () => {
        it('should do nothing', async () => {
            mockStore.getValue.mockResolvedValue(null);

            await completeJob('non-existent');

            expect(mockStore.setValue).not.toHaveBeenCalled();
            expect(updateKnowledgeBaseStatus).not.toHaveBeenCalled();
        });

        it('should log warning', async () => {
            mockStore.getValue.mockResolvedValue(null);

            await completeJob('missing-job');

            expect(log.warning).toHaveBeenCalledWith('Job not found: missing-job');
        });
    });
});

describe('failJob', () => {
    let mockStore: ReturnType<typeof setupMockStore>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = setupMockStore();
    });

    describe('when job exists', () => {
        it('should set status to failed', async () => {
            const testJob = createTestJob({ status: 'running' });
            mockStore.getValue.mockResolvedValue(testJob);

            await failJob('test-run-123', 'Test error');

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    status: 'failed',
                })
            );
        });

        it('should set completedAt timestamp', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);

            const beforeFail = new Date().toISOString();
            await failJob('test-run-123', 'Error');
            const afterFail = new Date().toISOString();

            const savedJob = mockStore.setValue.mock.calls[0][1] as Job;
            expect(savedJob.completedAt).toBeDefined();
            expect(savedJob.completedAt!).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
            expect(savedJob.completedAt! >= beforeFail).toBe(true);
            expect(savedJob.completedAt! <= afterFail).toBe(true);
        });

        it('should set error message', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);

            await failJob('test-run-123', 'Crawl failed: timeout');

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    error: 'Crawl failed: timeout',
                })
            );
        });

        it('should update KB status to failed', async () => {
            const testJob = createTestJob({ knowledgeBaseId: 'kb-fail' });
            mockStore.getValue.mockResolvedValue(testJob);

            await failJob('test-run-123', 'Error');

            expect(updateKnowledgeBaseStatus).toHaveBeenCalledWith('kb-fail', 'failed');
        });

        it('should log error with message', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);

            await failJob('test-run-123', 'Extraction error');

            expect(log.error).toHaveBeenCalledWith(
                'Job failed: test-run-123',
                { error: 'Extraction error' }
            );
        });

        it('should preserve other job fields', async () => {
            const testJob = createTestJob({
                id: 'run-fail',
                knowledgeBaseId: 'kb-fail',
                startedAt: '2025-01-01T09:00:00.000Z',
                progress: {
                    phase: 'enriching',
                    current: 5,
                    total: 10,
                },
            });
            mockStore.getValue.mockResolvedValue(testJob);

            await failJob('run-fail', 'LLM API error');

            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_run-fail',
                expect.objectContaining({
                    id: 'run-fail',
                    knowledgeBaseId: 'kb-fail',
                    startedAt: '2025-01-01T09:00:00.000Z',
                    progress: {
                        phase: 'enriching',
                        current: 5,
                        total: 10,
                    },
                })
            );
        });
    });

    describe('when KB status update fails', () => {
        it('should handle failure gracefully', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);
            vi.mocked(updateKnowledgeBaseStatus).mockRejectedValue(new Error('KB update failed'));

            // Should not throw
            await expect(failJob('test-run-123', 'Job error')).resolves.not.toThrow();

            // Should still save job as failed
            expect(mockStore.setValue).toHaveBeenCalledWith(
                'job_test-run-123',
                expect.objectContaining({
                    status: 'failed',
                    error: 'Job error',
                })
            );
        });

        it('should log warning on KB update failure', async () => {
            const testJob = createTestJob();
            mockStore.getValue.mockResolvedValue(testJob);
            vi.mocked(updateKnowledgeBaseStatus).mockRejectedValue(new Error('KB error'));

            await failJob('test-run-123', 'Job failed');

            expect(log.warning).toHaveBeenCalledWith(
                'Could not update KB status for job test-run-123',
                expect.objectContaining({ error: expect.any(Error) })
            );
        });
    });

    describe('when job not found', () => {
        it('should do nothing', async () => {
            mockStore.getValue.mockResolvedValue(null);

            await failJob('non-existent', 'Error');

            expect(mockStore.setValue).not.toHaveBeenCalled();
            expect(updateKnowledgeBaseStatus).not.toHaveBeenCalled();
        });

        it('should log warning', async () => {
            mockStore.getValue.mockResolvedValue(null);

            await failJob('missing-job', 'Error');

            expect(log.warning).toHaveBeenCalledWith('Job not found: missing-job');
        });
    });
});

describe('Job lifecycle transitions', () => {
    let mockStore: ReturnType<typeof setupMockStore>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockStore = setupMockStore();
    });

    it('should transition from pending → running → completed', async () => {
        // Create job (pending)
        const createdJob = await createJob('run-lifecycle', 'kb-lifecycle');
        expect(createdJob.status).toBe('pending');

        // Update progress (running)
        mockStore.getValue.mockResolvedValue(createdJob);
        await updateJobProgress('run-lifecycle', { current: 5, total: 10 });

        const runningJob = mockStore.setValue.mock.calls[1][1] as Job;
        expect(runningJob.status).toBe('running');

        // Complete job
        mockStore.getValue.mockResolvedValue(runningJob);
        await completeJob('run-lifecycle');

        const completedJob = mockStore.setValue.mock.calls[2][1] as Job;
        expect(completedJob.status).toBe('completed');
        expect(completedJob.completedAt).toBeDefined();
    });

    it('should transition from pending → running → failed', async () => {
        // Create job (pending)
        const createdJob = await createJob('run-fail', 'kb-fail');
        expect(createdJob.status).toBe('pending');

        // Update progress (running)
        mockStore.getValue.mockResolvedValue(createdJob);
        await updateJobProgress('run-fail', { phase: 'crawling', current: 3 });

        const runningJob = mockStore.setValue.mock.calls[1][1] as Job;
        expect(runningJob.status).toBe('running');

        // Fail job
        mockStore.getValue.mockResolvedValue(runningJob);
        await failJob('run-fail', 'Network timeout');

        const failedJob = mockStore.setValue.mock.calls[2][1] as Job;
        expect(failedJob.status).toBe('failed');
        expect(failedJob.error).toBe('Network timeout');
        expect(failedJob.completedAt).toBeDefined();
    });

    it('should track progress through all phases', async () => {
        const createdJob = await createJob('run-phases', 'kb-phases');
        mockStore.getValue.mockResolvedValue(createdJob);

        // Crawling
        await updateJobProgress('run-phases', { phase: 'crawling', current: 10, total: 50 });
        let savedJob = mockStore.setValue.mock.calls[1][1] as Job;
        expect(savedJob.progress.phase).toBe('crawling');

        // Extracting
        mockStore.getValue.mockResolvedValue(savedJob);
        await updateJobProgress('run-phases', { phase: 'extracting', current: 20 });
        savedJob = mockStore.setValue.mock.calls[2][1] as Job;
        expect(savedJob.progress.phase).toBe('extracting');

        // Chunking
        mockStore.getValue.mockResolvedValue(savedJob);
        await updateJobProgress('run-phases', { phase: 'chunking', current: 30 });
        savedJob = mockStore.setValue.mock.calls[3][1] as Job;
        expect(savedJob.progress.phase).toBe('chunking');

        // Enriching
        mockStore.getValue.mockResolvedValue(savedJob);
        await updateJobProgress('run-phases', { phase: 'enriching', current: 40 });
        savedJob = mockStore.setValue.mock.calls[4][1] as Job;
        expect(savedJob.progress.phase).toBe('enriching');

        // Embedding
        mockStore.getValue.mockResolvedValue(savedJob);
        await updateJobProgress('run-phases', { phase: 'embedding', current: 45 });
        savedJob = mockStore.setValue.mock.calls[5][1] as Job;
        expect(savedJob.progress.phase).toBe('embedding');

        // Saving
        mockStore.getValue.mockResolvedValue(savedJob);
        await updateJobProgress('run-phases', { phase: 'saving', current: 50 });
        savedJob = mockStore.setValue.mock.calls[6][1] as Job;
        expect(savedJob.progress.phase).toBe('saving');
        expect(savedJob.progress.current).toBe(50);
        expect(savedJob.progress.total).toBe(50);
    });
});
