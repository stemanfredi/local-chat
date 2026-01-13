import { chatQueries, messageQueries } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validateChat } from '../../shared/validation/chat.js';
import { validateMessage } from '../../shared/validation/message.js';
import { ulid } from '../../shared/ulid.js';
import { json } from '../utils/response.js';

export const chatRoutes = {
    /**
     * GET /api/chats
     * List user's chats
     */
    async list(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const chats = chatQueries.findByUser.all(user.id);

        json(res, 200, {
            chats: chats.map(c => ({
                id: c.id,
                title: c.title,
                createdAt: c.created_at,
                updatedAt: c.updated_at
            }))
        });
    },

    /**
     * POST /api/chats
     * Create a new chat
     */
    async create(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const { title } = req.body;

        // Validate
        const validation = validateChat({ title });
        if (!validation.valid) {
            return json(res, 400, { errors: validation.errors });
        }

        const now = new Date().toISOString();
        const id = ulid();

        chatQueries.create.run(id, user.id, title || null, now, now, null);

        json(res, 201, {
            chat: {
                id,
                title: title || null,
                createdAt: now,
                updatedAt: now
            }
        });
    },

    /**
     * GET /api/chats/:id
     * Get a chat with messages
     */
    async get(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const chat = chatQueries.findById.get(req.params.id);
        if (!chat || chat.user_id !== user.id) {
            return json(res, 404, { error: 'Chat not found' });
        }

        const messages = messageQueries.findByChat.all(chat.id);

        json(res, 200, {
            chat: {
                id: chat.id,
                title: chat.title,
                createdAt: chat.created_at,
                updatedAt: chat.updated_at
            },
            messages: messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: m.created_at,
                updatedAt: m.updated_at
            }))
        });
    },

    /**
     * PATCH /api/chats/:id
     * Update a chat
     */
    async update(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const chat = chatQueries.findById.get(req.params.id);
        if (!chat || chat.user_id !== user.id) {
            return json(res, 404, { error: 'Chat not found' });
        }

        const { title } = req.body;

        // Validate
        const validation = validateChat({ title });
        if (!validation.valid) {
            return json(res, 400, { errors: validation.errors });
        }

        const now = new Date().toISOString();
        chatQueries.update.run(title !== undefined ? title : chat.title, now, chat.id);

        json(res, 200, {
            chat: {
                id: chat.id,
                title: title !== undefined ? title : chat.title,
                createdAt: chat.created_at,
                updatedAt: now
            }
        });
    },

    /**
     * DELETE /api/chats/:id
     * Soft delete a chat
     */
    async delete(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const chat = chatQueries.findById.get(req.params.id);
        if (!chat || chat.user_id !== user.id) {
            return json(res, 404, { error: 'Chat not found' });
        }

        const now = new Date().toISOString();
        chatQueries.softDelete.run(now, now, chat.id);

        json(res, 200, { success: true });
    },

    /**
     * GET /api/chats/:id/messages
     * Get messages for a chat
     */
    async getMessages(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const chat = chatQueries.findById.get(req.params.id);
        if (!chat || chat.user_id !== user.id) {
            return json(res, 404, { error: 'Chat not found' });
        }

        const messages = messageQueries.findByChat.all(chat.id);

        json(res, 200, {
            messages: messages.map(m => ({
                id: m.id,
                role: m.role,
                content: m.content,
                createdAt: m.created_at,
                updatedAt: m.updated_at
            }))
        });
    },

    /**
     * POST /api/chats/:id/messages
     * Create a message in a chat
     */
    async createMessage(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const chat = chatQueries.findById.get(req.params.id);
        if (!chat || chat.user_id !== user.id) {
            return json(res, 404, { error: 'Chat not found' });
        }

        const { role, content } = req.body;

        // Validate
        const validation = validateMessage({ role, content });
        if (!validation.valid) {
            return json(res, 400, { errors: validation.errors });
        }

        const now = new Date().toISOString();
        const id = ulid();

        messageQueries.create.run(id, chat.id, role, content, now, now, null);

        // Update chat's updatedAt
        chatQueries.update.run(chat.title, now, chat.id);

        json(res, 201, {
            message: {
                id,
                role,
                content,
                createdAt: now,
                updatedAt: now
            }
        });
    }
};
