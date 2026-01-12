import { db, chatQueries, messageQueries } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { validateChat } from '../../shared/validation/chat.js';
import { validateMessage } from '../../shared/validation/message.js';

/**
 * Send JSON response
 */
function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

export const syncRoutes = {
    /**
     * POST /api/sync/pull
     * Get all changes since a given timestamp
     * Body: { since: ISO timestamp or null for all }
     */
    async pull(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const { since } = req.body;
        const sinceTime = since || '1970-01-01T00:00:00.000Z';

        // Get chats updated since timestamp
        const chats = chatQueries.findUpdatedSince.all(user.id, sinceTime);

        // Get messages updated since timestamp
        const messages = messageQueries.findUpdatedSince.all(user.id, sinceTime);

        const now = new Date().toISOString();

        json(res, 200, {
            syncedAt: now,
            chats: chats.map(c => ({
                id: c.id,
                title: c.title,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
                deletedAt: c.deleted_at
            })),
            messages: messages.map(m => ({
                id: m.id,
                chatId: m.chat_id,
                role: m.role,
                content: m.content,
                createdAt: m.created_at,
                updatedAt: m.updated_at,
                deletedAt: m.deleted_at
            }))
        });
    },

    /**
     * POST /api/sync/push
     * Push local changes to server
     * Body: { chats: [...], messages: [...] }
     * Uses last-write-wins conflict resolution
     */
    async push(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const { chats = [], messages = [] } = req.body;
        const results = { chats: [], messages: [] };
        const errors = [];

        // Process chats using transaction
        const processChats = db.transaction(() => {
            for (const chat of chats) {
                try {
                    // Validate
                    const validation = validateChat({ title: chat.title });
                    if (!validation.valid) {
                        errors.push({ type: 'chat', id: chat.id, errors: validation.errors });
                        continue;
                    }

                    // Check if chat exists
                    const existing = db.prepare('SELECT * FROM chats WHERE id = ?').get(chat.id);

                    if (existing) {
                        // Check ownership
                        if (existing.user_id !== user.id) {
                            errors.push({ type: 'chat', id: chat.id, error: 'Unauthorized' });
                            continue;
                        }

                        // Last-write-wins: only update if incoming is newer
                        if (new Date(chat.updatedAt) > new Date(existing.updated_at)) {
                            db.prepare(`
                                UPDATE chats SET title = ?, updated_at = ?, deleted_at = ?
                                WHERE id = ?
                            `).run(chat.title, chat.updatedAt, chat.deletedAt || null, chat.id);
                        }
                    } else {
                        // Insert new chat
                        chatQueries.create.run(
                            chat.id,
                            user.id,
                            chat.title || null,
                            chat.createdAt,
                            chat.updatedAt,
                            chat.deletedAt || null
                        );
                    }

                    results.chats.push({ id: chat.id, synced: true });
                } catch (err) {
                    console.error('Sync chat error:', err);
                    errors.push({ type: 'chat', id: chat.id, error: err.message });
                }
            }
        });

        // Process messages using transaction
        const processMessages = db.transaction(() => {
            for (const msg of messages) {
                try {
                    // Validate
                    const validation = validateMessage({ role: msg.role, content: msg.content });
                    if (!validation.valid) {
                        errors.push({ type: 'message', id: msg.id, errors: validation.errors });
                        continue;
                    }

                    // Verify chat ownership
                    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(msg.chatId);
                    if (!chat || chat.user_id !== user.id) {
                        errors.push({ type: 'message', id: msg.id, error: 'Chat not found or unauthorized' });
                        continue;
                    }

                    // Check if message exists
                    const existing = db.prepare('SELECT * FROM messages WHERE id = ?').get(msg.id);

                    if (existing) {
                        // Last-write-wins: only update if incoming is newer
                        if (new Date(msg.updatedAt) > new Date(existing.updated_at)) {
                            db.prepare(`
                                UPDATE messages SET content = ?, updated_at = ?, deleted_at = ?
                                WHERE id = ?
                            `).run(msg.content, msg.updatedAt, msg.deletedAt || null, msg.id);
                        }
                    } else {
                        // Insert new message
                        messageQueries.create.run(
                            msg.id,
                            msg.chatId,
                            msg.role,
                            msg.content,
                            msg.createdAt,
                            msg.updatedAt,
                            msg.deletedAt || null
                        );
                    }

                    results.messages.push({ id: msg.id, synced: true });
                } catch (err) {
                    console.error('Sync message error:', err);
                    errors.push({ type: 'message', id: msg.id, error: err.message });
                }
            }
        });

        // Execute transactions
        try {
            processChats();
            processMessages();
        } catch (err) {
            console.error('Sync transaction error:', err);
            return json(res, 500, { error: 'Sync failed', details: err.message });
        }

        const now = new Date().toISOString();

        json(res, 200, {
            syncedAt: now,
            results,
            errors: errors.length > 0 ? errors : undefined
        });
    }
};
