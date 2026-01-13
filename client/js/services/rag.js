import { db } from '../db/index.js';
import { state } from '../state.js';
import { webllm } from './webllm.js';
import { events, EVENTS } from '../utils/events.js';

/**
 * RAG (Retrieval Augmented Generation) service
 * Handles document chunking, embedding, and retrieval
 */
class RAGService {
    constructor() {
        // Chunking config
        this.chunkSize = 1000;     // characters per chunk (larger for more context)
        this.chunkOverlap = 200;   // overlap between chunks
        this.topK = 5;             // number of chunks to retrieve
    }

    /**
     * Chunk text into smaller overlapping pieces
     * @param {string} text - Text to chunk
     * @param {string} docName - Document name for context
     * @returns {Array<{text: string, docName: string, index: number}>}
     */
    chunkText(text, docName) {
        const chunks = [];

        if (!text || typeof text !== 'string') {
            return chunks;
        }

        const cleanText = text.trim();

        if (cleanText.length === 0) {
            return chunks;
        }

        if (cleanText.length <= this.chunkSize) {
            chunks.push({ text: cleanText, docName, index: 0 });
            return chunks;
        }

        let start = 0;
        let index = 0;

        while (start < cleanText.length) {
            let end = start + this.chunkSize;

            // Try to end at a sentence or paragraph boundary
            if (end < cleanText.length) {
                const slice = cleanText.slice(start, end + 50);
                const boundaryMatch = slice.match(/[.!?\n]\s+/g);
                if (boundaryMatch) {
                    const lastBoundary = slice.lastIndexOf(boundaryMatch[boundaryMatch.length - 1]);
                    if (lastBoundary > this.chunkSize * 0.5) {
                        end = start + lastBoundary + 1;
                    }
                }
            }

            const chunkText = cleanText.slice(start, end).trim();
            if (chunkText.length > 0) {
                chunks.push({ text: chunkText, docName, index });
                index++;
            }

            start = end - this.chunkOverlap;
            if (start >= cleanText.length) break;
        }

        return chunks;
    }

    /**
     * Generate embeddings for document chunks
     * @param {Object} document - Document with content
     * @returns {Promise<Array<{text: string, docName: string, index: number, embedding: number[]}>>}
     */
    async generateChunkEmbeddings(document) {
        if (!webllm.isEmbeddingReady()) {
            throw new Error('Embedding model not loaded');
        }

        const chunks = this.chunkText(document.content, document.name);

        if (chunks.length === 0) {
            return [];
        }

        // Generate embeddings in batches to avoid memory issues
        const batchSize = 10;
        const results = [];

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const texts = batch.map(c => c.text);
            const embeddings = await webllm.generateEmbedding(texts);

            for (let j = 0; j < batch.length; j++) {
                results.push({
                    ...batch[j],
                    embedding: embeddings[j]
                });
            }
        }

        return results;
    }

    /**
     * Embed a document and store chunks
     * @param {string} docId - Document ID
     * @returns {Promise<Object>} Updated document
     */
    async embedDocument(docId) {
        const docs = await db.getAllDocuments(state.user?.id || null);
        const doc = docs.find(d => d.id === docId);

        if (!doc) {
            throw new Error('Document not found');
        }

        if (!doc.content || typeof doc.content !== 'string' || doc.content.trim().length === 0) {
            return doc; // Skip documents without content
        }

        events.emit(EVENTS.DOCUMENT_EMBEDDING, { id: docId, name: doc.name });

        try {
            const chunks = await this.generateChunkEmbeddings(doc);

            // Store chunks in the embedding field as JSON
            const embeddingData = { chunks };
            await db.updateDocument(docId, { embedding: JSON.stringify(embeddingData) });

            events.emit(EVENTS.DOCUMENT_EMBEDDED, { id: docId, name: doc.name, chunkCount: chunks.length });

            return { ...doc, embedding: JSON.stringify(embeddingData) };
        } catch (error) {
            events.emit(EVENTS.DOCUMENT_EMBED_ERROR, { id: docId, error: error.message });
            throw error;
        }
    }

    /**
     * Embed all documents that don't have embeddings
     * @returns {Promise<number>} Number of documents embedded
     */
    async embedAllDocuments() {
        if (!webllm.isEmbeddingReady()) {
            throw new Error('Embedding model not loaded');
        }

        const docs = await db.getAllDocuments(state.user?.id || null);
        let count = 0;

        for (const doc of docs) {
            // Only embed docs with actual content that haven't been embedded
            if (!doc.embedding && doc.content && typeof doc.content === 'string' && doc.content.trim().length > 0) {
                await this.embedDocument(doc.id);
                count++;
            }
        }

        return count;
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param {number[]} a
     * @param {number[]} b
     * @returns {number}
     */
    cosineSimilarity(a, b) {
        if (a.length !== b.length) return 0;

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;

        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);

        if (normA === 0 || normB === 0) return 0;

        return dotProduct / (normA * normB);
    }

    /**
     * Search for relevant document chunks
     * @param {string} query - User query
     * @param {number} topK - Number of results (default: this.topK)
     * @returns {Promise<Array<{text: string, docName: string, score: number}>>}
     */
    async search(query, topK = this.topK) {
        if (!webllm.isEmbeddingReady()) {
            return []; // No embedding model, skip RAG
        }

        // Get query embedding
        const [queryEmbedding] = await webllm.generateEmbedding(query);

        // Get all documents with embeddings
        const docs = await db.getAllDocuments(state.user?.id || null);
        const allChunks = [];

        for (const doc of docs) {
            if (doc.embedding) {
                try {
                    const data = JSON.parse(doc.embedding);
                    if (data.chunks) {
                        for (const chunk of data.chunks) {
                            const score = this.cosineSimilarity(queryEmbedding, chunk.embedding);
                            allChunks.push({
                                text: chunk.text,
                                docName: chunk.docName,
                                score
                            });
                        }
                    }
                } catch (e) {
                    // Skip documents with invalid embedding data
                }
            }
        }

        // Sort by score and take top K
        allChunks.sort((a, b) => b.score - a.score);
        return allChunks.slice(0, topK);
    }

    /**
     * Get RAG context for a chat message
     * Returns formatted context string or null if no relevant docs
     * @param {string} query - User message
     * @param {number} minScore - Minimum similarity score (0-1)
     * @returns {Promise<string|null>}
     */
    async getContext(query, minScore = 0.2) {
        const results = await this.search(query);

        // Filter by minimum score
        const relevant = results.filter(r => r.score >= minScore);

        if (relevant.length === 0) {
            return null;
        }

        // Format context
        const contextParts = relevant.map(r => `[${r.docName}]:\n${r.text}`);

        return `Relevant context from documents:\n\n${contextParts.join('\n\n---\n\n')}`;
    }

    /**
     * Check if any documents have embeddings
     * @returns {Promise<boolean>}
     */
    async hasEmbeddedDocuments() {
        const docs = await db.getAllDocuments(state.user?.id || null);
        return docs.some(d => d.embedding);
    }

    /**
     * Get embedding stats
     * @returns {Promise<{total: number, embedded: number, pending: number}>}
     */
    async getStats() {
        const docs = await db.getAllDocuments(state.user?.id || null);
        // Only count docs with actual content
        const withContent = docs.filter(d => d.content && typeof d.content === 'string' && d.content.trim().length > 0);
        const embedded = withContent.filter(d => d.embedding).length;
        return {
            total: withContent.length,
            embedded,
            pending: withContent.length - embedded
        };
    }

    /**
     * Parse @mentions from text
     * @param {string} text
     * @returns {string[]} Array of mentioned document names
     */
    parseMentions(text) {
        // Match @"filename with spaces" or @filename
        const matches = text.match(/@"[^"]+"|@[\w.-]+/g) || [];
        return matches.map(m => m.startsWith('@"') ? m.slice(2, -1) : m.slice(1));
    }

    /**
     * Get documents by name (partial match)
     * @param {string[]} names
     * @returns {Promise<Object[]>}
     */
    async getDocumentsByName(names) {
        if (names.length === 0) return [];

        const docs = await db.getAllDocuments(state.user?.id || null);
        const results = [];

        for (const name of names) {
            const nameLower = name.toLowerCase();
            const doc = docs.find(d =>
                d.name.toLowerCase() === nameLower ||
                d.name.toLowerCase().startsWith(nameLower) ||
                d.name.toLowerCase().includes(nameLower)
            );
            if (doc) results.push(doc);
        }

        return results;
    }

    /**
     * Get context for explicitly mentioned documents
     * @param {string} text - User message with @mentions
     * @returns {Promise<{context: string|null, cleanText: string}>}
     */
    async getMentionedContext(text) {
        const mentions = this.parseMentions(text);

        if (mentions.length === 0) {
            return { context: null, cleanText: text };
        }

        const docs = await this.getDocumentsByName(mentions);

        if (docs.length === 0) {
            return { context: null, cleanText: text };
        }

        // Build context from mentioned documents
        const contextParts = docs.map(doc => {
            // Truncate very long documents
            const content = doc.content.length > 8000
                ? doc.content.slice(0, 8000) + '\n...(truncated)'
                : doc.content;
            return `[${doc.name}]:\n${content}`;
        });

        // Remove @mentions from the text for cleaner display
        let cleanText = text;
        for (const mention of mentions) {
            cleanText = cleanText.replace(new RegExp(`@"${mention}"|@${mention}`, 'g'), '').trim();
        }

        return {
            context: `Referenced documents:\n\n${contextParts.join('\n\n---\n\n')}`,
            cleanText: cleanText || text
        };
    }

    /**
     * Search documents for autocomplete
     * @param {string} query - Partial document name
     * @returns {Promise<Object[]>}
     */
    async searchDocuments(query) {
        const docs = await db.getAllDocuments(state.user?.id || null);
        const queryLower = query.toLowerCase();

        return docs
            .filter(d => d.name.toLowerCase().includes(queryLower))
            .slice(0, 5); // Limit to 5 suggestions
    }
}

export const rag = new RAGService();
