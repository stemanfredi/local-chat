import { documentQueries } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { ulid } from '../../shared/ulid.js';

/**
 * Send JSON response
 */
function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

export const documentRoutes = {
    /**
     * GET /api/documents
     * List user's documents
     */
    async list(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const docs = documentQueries.findByUser.all(user.id);

        json(res, 200, {
            documents: docs.map(d => ({
                id: d.id,
                name: d.name,
                type: d.type,
                createdAt: d.created_at,
                updatedAt: d.updated_at
            }))
        });
    },

    /**
     * POST /api/documents
     * Create a new document
     */
    async create(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const { id, name, type, content, createdAt, updatedAt } = req.body;

        if (!name || !type) {
            return json(res, 400, { error: 'Name and type are required' });
        }

        const now = new Date().toISOString();
        const docId = id || ulid();

        documentQueries.create.run(
            docId,
            user.id,
            name,
            type,
            content || null,
            null, // embedding
            createdAt || now,
            updatedAt || now,
            null // deletedAt
        );

        json(res, 201, {
            document: {
                id: docId,
                name,
                type,
                createdAt: createdAt || now,
                updatedAt: updatedAt || now
            }
        });
    },

    /**
     * GET /api/documents/:id
     * Get a document with content
     */
    async get(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const doc = documentQueries.findById.get(req.params.id);
        if (!doc || doc.user_id !== user.id) {
            return json(res, 404, { error: 'Document not found' });
        }

        json(res, 200, {
            document: {
                id: doc.id,
                name: doc.name,
                type: doc.type,
                content: doc.content,
                createdAt: doc.created_at,
                updatedAt: doc.updated_at
            }
        });
    },

    /**
     * PATCH /api/documents/:id
     * Update a document
     */
    async update(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const doc = documentQueries.findById.get(req.params.id);
        if (!doc || doc.user_id !== user.id) {
            return json(res, 404, { error: 'Document not found' });
        }

        const { name, content, embedding } = req.body;
        const now = new Date().toISOString();

        documentQueries.update.run(
            name !== undefined ? name : doc.name,
            content !== undefined ? content : doc.content,
            embedding !== undefined ? embedding : doc.embedding,
            now,
            doc.id
        );

        json(res, 200, {
            document: {
                id: doc.id,
                name: name !== undefined ? name : doc.name,
                type: doc.type,
                createdAt: doc.created_at,
                updatedAt: now
            }
        });
    },

    /**
     * DELETE /api/documents/:id
     * Soft delete a document
     */
    async delete(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const doc = documentQueries.findById.get(req.params.id);
        if (!doc || doc.user_id !== user.id) {
            return json(res, 404, { error: 'Document not found' });
        }

        const now = new Date().toISOString();
        documentQueries.softDelete.run(now, now, doc.id);

        json(res, 200, { success: true });
    }
};
