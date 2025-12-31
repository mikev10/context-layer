/**
 * Tests for knowledge-base storage module
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    generateKBId,
    createKnowledgeBase,
    getKnowledgeBase,
    listKnowledgeBases,
    updateKnowledgeBaseStatus,
    updateKnowledgeBaseStats,
    deleteKnowledgeBase,
    convertToKBChunks,
    saveChunks,
    getChunks,
    searchKnowledgeBase,
    cosineSimilarity,
    semanticSearch,
    type CreateKBConfig,
} from '../knowledge-base.js';
import type { KnowledgeBase, KnowledgeBaseChunk, EmbeddedChunk } from '../../types/index.js';

// ============================================================================
// Mock Setup
// ============================================================================

const mockStore = {
    getValue: vi.fn(),
    setValue: vi.fn(),
};

const mockDataset = {
    pushData: vi.fn(),
    getData: vi.fn(),
    drop: vi.fn(),
};

vi.mock('apify', () => ({
    Actor: {
        openKeyValueStore: vi.fn(() => Promise.resolve(mockStore)),
        openDataset: vi.fn(() => Promise.resolve(mockDataset)),
    },
    log: {
        info: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
    },
}));

// ============================================================================
// Test Helpers
// ============================================================================

function createMockConfig(): CreateKBConfig {
    return {
        chunkSize: 500,
        chunkOverlap: 50,
        outputFormat: 'rag',
        hasEmbeddings: true,
        hasEnrichment: true,
    };
}

function createMockKB(): KnowledgeBase {
    return {
        id: 'test-kb-123',
        name: 'docs.example.com',
        sourceUrl: 'https://docs.example.com',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        status: 'ready',
        stats: {
            pageCount: 10,
            chunkCount: 50,
            totalTokens: 25000,
        },
        config: {
            chunkSize: 500,
            chunkOverlap: 50,
            outputFormat: 'rag',
            hasEmbeddings: true,
            hasEnrichment: true,
        },
    };
}

function createMockChunk(overrides: Partial<KnowledgeBaseChunk> = {}): KnowledgeBaseChunk {
    return {
        id: 'chunk-0001',
        knowledgeBaseId: 'test-kb-123',
        content: 'This is test chunk content.',
        tokenCount: 10,
        embedding: [0.1, 0.2, 0.3],
        metadata: {
            sourceUrl: 'https://docs.example.com/page',
            title: 'Test Page',
            section: 'Introduction',
            chunkIndex: 0,
            totalChunks: 5,
        },
        enrichment: {
            summary: 'A test chunk',
            questions: ['What is this?'],
        },
        ...overrides,
    };
}

function createMockEmbeddedChunk(overrides: Partial<EmbeddedChunk> = {}): EmbeddedChunk {
    return {
        id: 'chunk-0001',
        content: 'This is test chunk content.',
        tokenCount: 10,
        embedding: [0.1, 0.2, 0.3],
        metadata: {
            source_url: 'https://docs.example.com/page',
            title: 'Test Page',
            section: 'Introduction',
            chunk_index: 0,
            total_chunks: 5,
        },
        enrichment: {
            summary: 'A test chunk',
            questions: ['What is this?'],
        },
        ...overrides,
    };
}

// ============================================================================
// Tests
// ============================================================================

describe('generateKBId', () => {
    it('should return deterministic 12-char hex string', () => {
        const url = 'https://docs.example.com';
        const id = generateKBId(url);

        expect(id).toHaveLength(12);
        expect(id).toMatch(/^[a-f0-9]{12}$/);
    });

    it('should return same ID for same URL', () => {
        const url = 'https://docs.example.com';
        const id1 = generateKBId(url);
        const id2 = generateKBId(url);

        expect(id1).toBe(id2);
    });

    it('should return different IDs for different URLs', () => {
        const id1 = generateKBId('https://docs.example.com');
        const id2 = generateKBId('https://api.example.com');

        expect(id1).not.toBe(id2);
    });

    it('should handle URLs with query params', () => {
        const id1 = generateKBId('https://docs.example.com');
        const id2 = generateKBId('https://docs.example.com?foo=bar');

        // Different URLs should produce different IDs
        expect(id1).not.toBe(id2);
    });
});

describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
        const a = [1, 0, 0];
        const b = [1, 0, 0];

        const similarity = cosineSimilarity(a, b);

        expect(similarity).toBe(1);
    });

    it('should return 0 for orthogonal vectors', () => {
        const a = [1, 0, 0];
        const b = [0, 1, 0];

        const similarity = cosineSimilarity(a, b);

        expect(similarity).toBe(0);
    });

    it('should return -1 for opposite vectors', () => {
        const a = [1, 0, 0];
        const b = [-1, 0, 0];

        const similarity = cosineSimilarity(a, b);

        expect(similarity).toBe(-1);
    });

    it('should return 0 for zero vectors', () => {
        const a = [0, 0, 0];
        const b = [1, 2, 3];

        const similarity = cosineSimilarity(a, b);

        expect(similarity).toBe(0);
    });

    it('should calculate similarity for arbitrary vectors', () => {
        const a = [1, 2, 3];
        const b = [4, 5, 6];

        const similarity = cosineSimilarity(a, b);

        // Dot product: 1*4 + 2*5 + 3*6 = 32
        // Norm a: sqrt(1 + 4 + 9) = sqrt(14)
        // Norm b: sqrt(16 + 25 + 36) = sqrt(77)
        // Expected: 32 / (sqrt(14) * sqrt(77)) ≈ 0.9746
        expect(similarity).toBeCloseTo(0.9746, 3);
    });

    it('should throw error for mismatched dimensions', () => {
        const a = [1, 2, 3];
        const b = [1, 2];

        expect(() => cosineSimilarity(a, b)).toThrow('Vector dimension mismatch: 3 vs 2');
    });
});

describe('createKnowledgeBase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStore.getValue.mockResolvedValue([]); // Empty index initially
    });

    it('should create and return KB with generated ID', async () => {
        const sourceUrl = 'https://docs.example.com';
        const config = createMockConfig();

        const kb = await createKnowledgeBase(sourceUrl, config);

        expect(kb.id).toHaveLength(12);
        expect(kb.sourceUrl).toBe(sourceUrl);
        expect(kb.name).toBe('docs.example.com');
        expect(kb.status).toBe('processing');
    });

    it('should save KB metadata to store', async () => {
        const sourceUrl = 'https://docs.example.com';
        const config = createMockConfig();

        await createKnowledgeBase(sourceUrl, config);

        expect(mockStore.setValue).toHaveBeenCalledWith(
            expect.stringMatching(/^kb_.+_meta$/),
            expect.objectContaining({
                sourceUrl,
                status: 'processing',
            })
        );
    });

    it('should add KB ID to index', async () => {
        const sourceUrl = 'https://docs.example.com';
        const config = createMockConfig();

        await createKnowledgeBase(sourceUrl, config);

        // Should read index
        expect(mockStore.getValue).toHaveBeenCalledWith('kb_index');
        // Should write updated index
        expect(mockStore.setValue).toHaveBeenCalledWith('kb_index', expect.any(Array));
    });

    it('should initialize stats to zero', async () => {
        const sourceUrl = 'https://docs.example.com';
        const config = createMockConfig();

        const kb = await createKnowledgeBase(sourceUrl, config);

        expect(kb.stats).toEqual({
            pageCount: 0,
            chunkCount: 0,
            totalTokens: 0,
        });
    });

    it('should copy config correctly', async () => {
        const sourceUrl = 'https://docs.example.com';
        const config = createMockConfig();

        const kb = await createKnowledgeBase(sourceUrl, config);

        expect(kb.config.chunkSize).toBe(500);
        expect(kb.config.chunkOverlap).toBe(50);
        expect(kb.config.outputFormat).toBe('rag');
        expect(kb.config.hasEmbeddings).toBe(true);
        expect(kb.config.hasEnrichment).toBe(true);
    });

    it('should set createdAt and updatedAt timestamps', async () => {
        const sourceUrl = 'https://docs.example.com';
        const config = createMockConfig();

        const kb = await createKnowledgeBase(sourceUrl, config);

        expect(kb.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
        expect(kb.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
});

describe('getKnowledgeBase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return KB when found', async () => {
        const mockKB = createMockKB();
        mockStore.getValue.mockResolvedValue(mockKB);

        const kb = await getKnowledgeBase('test-kb-123');

        expect(kb).toEqual(mockKB);
        expect(mockStore.getValue).toHaveBeenCalledWith('kb_test-kb-123_meta');
    });

    it('should return null when not found', async () => {
        mockStore.getValue.mockResolvedValue(null);

        const kb = await getKnowledgeBase('nonexistent');

        expect(kb).toBeNull();
    });
});

describe('listKnowledgeBases', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return empty array when no KBs exist', async () => {
        mockStore.getValue.mockResolvedValue([]); // Empty index

        const kbs = await listKnowledgeBases();

        expect(kbs).toEqual([]);
    });

    it('should return array of KBs', async () => {
        const mockKB1 = createMockKB();
        const mockKB2 = { ...createMockKB(), id: 'test-kb-456', sourceUrl: 'https://api.example.com' };

        mockStore.getValue
            .mockResolvedValueOnce(['test-kb-123', 'test-kb-456']) // Index
            .mockResolvedValueOnce(mockKB1) // First KB
            .mockResolvedValueOnce(mockKB2); // Second KB

        const kbs = await listKnowledgeBases();

        expect(kbs).toHaveLength(2);
        expect(kbs[0]).toEqual(mockKB1);
        expect(kbs[1]).toEqual(mockKB2);
    });

    it('should skip KBs that do not exist', async () => {
        const mockKB1 = createMockKB();

        mockStore.getValue
            .mockResolvedValueOnce(['test-kb-123', 'deleted-kb']) // Index with deleted KB
            .mockResolvedValueOnce(mockKB1) // First KB exists
            .mockResolvedValueOnce(null); // Second KB deleted

        const kbs = await listKnowledgeBases();

        expect(kbs).toHaveLength(1);
        expect(kbs[0]).toEqual(mockKB1);
    });
});

describe('updateKnowledgeBaseStatus', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should update status and updatedAt timestamp', async () => {
        const mockKB = createMockKB();
        mockStore.getValue.mockResolvedValue(mockKB);

        await updateKnowledgeBaseStatus('test-kb-123', 'ready');

        expect(mockStore.setValue).toHaveBeenCalledWith(
            'kb_test-kb-123_meta',
            expect.objectContaining({
                status: 'ready',
                updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
            })
        );
    });

    it('should throw error when KB not found', async () => {
        mockStore.getValue.mockResolvedValue(null);

        await expect(
            updateKnowledgeBaseStatus('nonexistent', 'ready')
        ).rejects.toThrow('Knowledge base not found: nonexistent');
    });

    it('should preserve other fields when updating', async () => {
        const mockKB = createMockKB();
        mockStore.getValue.mockResolvedValue(mockKB);

        await updateKnowledgeBaseStatus('test-kb-123', 'failed');

        expect(mockStore.setValue).toHaveBeenCalledWith(
            'kb_test-kb-123_meta',
            expect.objectContaining({
                id: mockKB.id,
                sourceUrl: mockKB.sourceUrl,
                stats: mockKB.stats,
            })
        );
    });
});

describe('updateKnowledgeBaseStats', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should merge stats and update timestamp', async () => {
        const mockKB = createMockKB();
        mockStore.getValue.mockResolvedValue(mockKB);

        await updateKnowledgeBaseStats('test-kb-123', { pageCount: 20 });

        expect(mockStore.setValue).toHaveBeenCalledWith(
            'kb_test-kb-123_meta',
            expect.objectContaining({
                stats: {
                    pageCount: 20, // Updated
                    chunkCount: 50, // Preserved
                    totalTokens: 25000, // Preserved
                },
                updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
            })
        );
    });

    it('should throw error when KB not found', async () => {
        mockStore.getValue.mockResolvedValue(null);

        await expect(
            updateKnowledgeBaseStats('nonexistent', { pageCount: 10 })
        ).rejects.toThrow('Knowledge base not found: nonexistent');
    });

    it('should update multiple stats fields', async () => {
        const mockKB = createMockKB();
        mockStore.getValue.mockResolvedValue(mockKB);

        await updateKnowledgeBaseStats('test-kb-123', {
            chunkCount: 100,
            totalTokens: 50000,
        });

        expect(mockStore.setValue).toHaveBeenCalledWith(
            'kb_test-kb-123_meta',
            expect.objectContaining({
                stats: {
                    pageCount: 10, // Preserved
                    chunkCount: 100, // Updated
                    totalTokens: 50000, // Updated
                },
            })
        );
    });
});

describe('deleteKnowledgeBase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStore.getValue.mockResolvedValue(['test-kb-123', 'other-kb']); // Index
    });

    it('should delete chunks dataset', async () => {
        await deleteKnowledgeBase('test-kb-123');

        expect(mockDataset.drop).toHaveBeenCalled();
    });

    it('should delete metadata from store', async () => {
        await deleteKnowledgeBase('test-kb-123');

        expect(mockStore.setValue).toHaveBeenCalledWith('kb_test-kb-123_meta', null);
    });

    it('should remove KB from index', async () => {
        await deleteKnowledgeBase('test-kb-123');

        expect(mockStore.setValue).toHaveBeenCalledWith('kb_index', ['other-kb']);
    });

    it('should handle dataset drop failure gracefully', async () => {
        mockDataset.drop.mockRejectedValue(new Error('Dataset not found'));

        // Should not throw
        await expect(deleteKnowledgeBase('test-kb-123')).resolves.toBeUndefined();
    });
});

describe('convertToKBChunks', () => {
    it('should convert EmbeddedChunk to KnowledgeBaseChunk format', () => {
        const embeddedChunk = createMockEmbeddedChunk();
        const kbId = 'test-kb-123';

        const result = convertToKBChunks([embeddedChunk], kbId);

        expect(result).toHaveLength(1);
        expect(result[0].knowledgeBaseId).toBe(kbId);
        expect(result[0].content).toBe(embeddedChunk.content);
        expect(result[0].tokenCount).toBe(embeddedChunk.tokenCount);
    });

    it('should transform metadata field names', () => {
        const embeddedChunk = createMockEmbeddedChunk();
        const kbId = 'test-kb-123';

        const result = convertToKBChunks([embeddedChunk], kbId);

        expect(result[0].metadata.sourceUrl).toBe(embeddedChunk.metadata.source_url);
        expect(result[0].metadata.chunkIndex).toBe(embeddedChunk.metadata.chunk_index);
        expect(result[0].metadata.totalChunks).toBe(embeddedChunk.metadata.total_chunks);
    });

    it('should preserve enrichment if present', () => {
        const embeddedChunk = createMockEmbeddedChunk();
        const kbId = 'test-kb-123';

        const result = convertToKBChunks([embeddedChunk], kbId);

        expect(result[0].enrichment).toEqual({
            summary: 'A test chunk',
            questions: ['What is this?'],
        });
    });

    it('should handle chunks without enrichment', () => {
        const embeddedChunk = createMockEmbeddedChunk({ enrichment: undefined });
        const kbId = 'test-kb-123';

        const result = convertToKBChunks([embeddedChunk], kbId);

        expect(result[0].enrichment).toBeUndefined();
    });

    it('should preserve embeddings', () => {
        const embeddedChunk = createMockEmbeddedChunk();
        const kbId = 'test-kb-123';

        const result = convertToKBChunks([embeddedChunk], kbId);

        expect(result[0].embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle empty array', () => {
        const result = convertToKBChunks([], 'test-kb-123');

        expect(result).toEqual([]);
    });
});

describe('saveChunks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should push chunks to dataset', async () => {
        const chunks = [createMockChunk()];
        const mockKB = createMockKB();
        mockStore.getValue.mockResolvedValue(mockKB);

        await saveChunks('test-kb-123', chunks);

        expect(mockDataset.pushData).toHaveBeenCalledWith(chunks);
    });

    it('should update KB stats after saving', async () => {
        const chunks = [
            createMockChunk({ tokenCount: 100 }),
            createMockChunk({ tokenCount: 150 }),
        ];
        const mockKB = createMockKB();
        mockStore.getValue.mockResolvedValue(mockKB);

        await saveChunks('test-kb-123', chunks);

        expect(mockStore.setValue).toHaveBeenCalledWith(
            'kb_test-kb-123_meta',
            expect.objectContaining({
                stats: {
                    pageCount: 10, // Preserved
                    chunkCount: 52, // 50 + 2
                    totalTokens: 25250, // 25000 + 100 + 150
                },
            })
        );
    });

    it('should handle empty chunks array', async () => {
        await saveChunks('test-kb-123', []);

        expect(mockDataset.pushData).not.toHaveBeenCalled();
    });

    it('should not fail if KB not found during stats update', async () => {
        const chunks = [createMockChunk()];
        mockStore.getValue.mockResolvedValue(null);

        // Should not throw
        await expect(saveChunks('test-kb-123', chunks)).resolves.toBeUndefined();
    });
});

describe('getChunks', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return chunks with default pagination', async () => {
        const chunks = [createMockChunk()];
        mockDataset.getData.mockResolvedValue({ items: chunks, total: 1 });

        const result = await getChunks('test-kb-123');

        expect(result.chunks).toEqual(chunks);
        expect(result.total).toBe(1);
        expect(mockDataset.getData).toHaveBeenCalledWith({
            offset: 0,
            limit: 100,
        });
    });

    it('should apply offset and limit options', async () => {
        const chunks = [createMockChunk()];
        mockDataset.getData.mockResolvedValue({ items: chunks, total: 50 });

        const result = await getChunks('test-kb-123', { offset: 10, limit: 20 });

        expect(result.chunks).toEqual(chunks);
        expect(result.total).toBe(50);
        expect(mockDataset.getData).toHaveBeenCalledWith({
            offset: 10,
            limit: 20,
        });
    });

    it('should handle empty results', async () => {
        mockDataset.getData.mockResolvedValue({ items: [], total: 0 });

        const result = await getChunks('test-kb-123');

        expect(result.chunks).toEqual([]);
        expect(result.total).toBe(0);
    });
});

describe('searchKnowledgeBase', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should find chunks matching query', async () => {
        const matchingChunk = createMockChunk({ content: 'This contains the search term.' });
        const nonMatchingChunk = createMockChunk({ content: 'This does not match.' });

        mockDataset.getData.mockResolvedValue({
            items: [matchingChunk, nonMatchingChunk],
        });

        const results = await searchKnowledgeBase('test-kb-123', 'search term');

        expect(results).toHaveLength(1);
        expect(results[0].content).toContain('search term');
    });

    it('should be case-insensitive', async () => {
        const chunk = createMockChunk({ content: 'This is UPPERCASE content.' });

        mockDataset.getData.mockResolvedValue({ items: [chunk] });

        const results = await searchKnowledgeBase('test-kb-123', 'uppercase');

        expect(results).toHaveLength(1);
    });

    it('should respect limit parameter', async () => {
        const chunks = Array.from({ length: 20 }, (_, i) =>
            createMockChunk({ id: `chunk-${i}`, content: 'matching content' })
        );

        mockDataset.getData.mockResolvedValue({ items: chunks });

        const results = await searchKnowledgeBase('test-kb-123', 'matching', 5);

        expect(results).toHaveLength(5);
    });

    it('should fetch in batches of 100', async () => {
        const chunks = Array.from({ length: 150 }, (_, i) =>
            createMockChunk({ id: `chunk-${i}`, content: 'test' })
        );

        mockDataset.getData
            .mockResolvedValueOnce({ items: chunks.slice(0, 100) })
            .mockResolvedValueOnce({ items: chunks.slice(100, 150) });

        await searchKnowledgeBase('test-kb-123', 'test', 200);

        expect(mockDataset.getData).toHaveBeenCalledTimes(2);
        expect(mockDataset.getData).toHaveBeenNthCalledWith(1, { offset: 0, limit: 100 });
        expect(mockDataset.getData).toHaveBeenNthCalledWith(2, { offset: 100, limit: 100 });
    });

    it('should stop fetching when limit reached', async () => {
        const chunks = Array.from({ length: 10 }, (_, i) =>
            createMockChunk({ id: `chunk-${i}`, content: 'matching' })
        );

        mockDataset.getData.mockResolvedValue({ items: chunks });

        const results = await searchKnowledgeBase('test-kb-123', 'matching', 5);

        expect(results).toHaveLength(5);
    });

    it('should return empty array when no matches', async () => {
        const chunks = [createMockChunk({ content: 'No match here.' })];
        mockDataset.getData.mockResolvedValue({ items: chunks });

        const results = await searchKnowledgeBase('test-kb-123', 'unicorn');

        expect(results).toEqual([]);
    });
});

describe('semanticSearch', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should return chunks sorted by similarity', async () => {
        const queryEmbedding = [1, 0, 0];

        const chunk1 = createMockChunk({
            id: 'chunk-1',
            embedding: [0.9, 0.1, 0], // High similarity
        });
        const chunk2 = createMockChunk({
            id: 'chunk-2',
            embedding: [0, 1, 0], // Low similarity
        });
        const chunk3 = createMockChunk({
            id: 'chunk-3',
            embedding: [1, 0, 0], // Perfect match
        });

        mockDataset.getData.mockResolvedValue({
            items: [chunk1, chunk2, chunk3],
        });

        const results = await semanticSearch('test-kb-123', queryEmbedding, 10);

        // Should be sorted by similarity (descending)
        expect(results[0].id).toBe('chunk-3'); // Perfect match (similarity = 1)
        expect(results[1].id).toBe('chunk-1'); // High similarity
        expect(results[2].id).toBe('chunk-2'); // Low similarity
        expect(results[0].similarity).toBeCloseTo(1, 5);
    });

    it('should respect limit parameter', async () => {
        const queryEmbedding = [1, 0, 0];
        const chunks = Array.from({ length: 20 }, (_, i) =>
            createMockChunk({
                id: `chunk-${i}`,
                embedding: [Math.random(), Math.random(), Math.random()],
            })
        );

        mockDataset.getData.mockResolvedValue({ items: chunks });

        const results = await semanticSearch('test-kb-123', queryEmbedding, 5);

        expect(results).toHaveLength(5);
    });

    it('should skip chunks without embeddings', async () => {
        const queryEmbedding = [1, 0, 0];
        const chunk1 = createMockChunk({ id: 'chunk-1', embedding: [1, 0, 0] });
        const chunk2 = createMockChunk({ id: 'chunk-2', embedding: undefined });

        mockDataset.getData.mockResolvedValue({ items: [chunk1, chunk2] });

        const results = await semanticSearch('test-kb-123', queryEmbedding);

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('chunk-1');
    });

    it('should skip chunks with empty embeddings', async () => {
        const queryEmbedding = [1, 0, 0];
        const chunk1 = createMockChunk({ id: 'chunk-1', embedding: [1, 0, 0] });
        const chunk2 = createMockChunk({ id: 'chunk-2', embedding: [] });

        mockDataset.getData.mockResolvedValue({ items: [chunk1, chunk2] });

        const results = await semanticSearch('test-kb-123', queryEmbedding);

        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('chunk-1');
    });

    it('should fetch all chunks in batches', async () => {
        const queryEmbedding = [1, 0, 0];
        const chunks1 = Array.from({ length: 100 }, (_, i) =>
            createMockChunk({ id: `chunk-${i}`, embedding: [0.5, 0.5, 0] })
        );
        const chunks2 = Array.from({ length: 50 }, (_, i) =>
            createMockChunk({ id: `chunk-${i + 100}`, embedding: [0.5, 0.5, 0] })
        );

        mockDataset.getData
            .mockResolvedValueOnce({ items: chunks1 })
            .mockResolvedValueOnce({ items: chunks2 })
            .mockResolvedValueOnce({ items: [] });

        const results = await semanticSearch('test-kb-123', queryEmbedding, 200);

        expect(results).toHaveLength(150); // All chunks with embeddings
    });

    it('should include similarity scores in results', async () => {
        const queryEmbedding = [1, 0, 0];
        const chunk = createMockChunk({ embedding: [0.8, 0.6, 0] });

        mockDataset.getData.mockResolvedValue({ items: [chunk] });

        const results = await semanticSearch('test-kb-123', queryEmbedding);

        expect(results[0]).toHaveProperty('similarity');
        expect(results[0].similarity).toBeGreaterThan(0);
        expect(results[0].similarity).toBeLessThanOrEqual(1);
    });
});
