import { userQueries } from '../db/index.js';
import { requireAdmin } from '../middleware/auth.js';
import { json } from '../utils/response.js';

export const userRoutes = {
    /**
     * GET /api/users
     * List all users (admin only)
     */
    async list(req, res) {
        const admin = requireAdmin(req, res);
        if (!admin) return;

        const users = userQueries.getAll.all();

        json(res, 200, {
            users: users.map(u => ({
                id: u.id,
                username: u.username,
                isAdmin: !!u.is_admin,
                createdAt: u.created_at,
                updatedAt: u.updated_at
            }))
        });
    },

    /**
     * GET /api/users/:id
     * Get a specific user (admin only)
     */
    async get(req, res) {
        const admin = requireAdmin(req, res);
        if (!admin) return;

        const user = userQueries.findById.get(req.params.id);
        if (!user) {
            return json(res, 404, { error: 'User not found' });
        }

        json(res, 200, {
            user: {
                id: user.id,
                username: user.username,
                isAdmin: !!user.is_admin,
                createdAt: user.created_at,
                updatedAt: user.updated_at
            }
        });
    },

    /**
     * PATCH /api/users/:id
     * Update a user (admin only)
     */
    async update(req, res) {
        const admin = requireAdmin(req, res);
        if (!admin) return;

        const user = userQueries.findById.get(req.params.id);
        if (!user) {
            return json(res, 404, { error: 'User not found' });
        }

        const { username, isAdmin } = req.body;
        const now = new Date().toISOString();

        // Prevent removing own admin status
        if (user.id === admin.id && isAdmin === false) {
            return json(res, 400, { error: 'Cannot remove your own admin status' });
        }

        // Check username uniqueness if changing
        if (username && username !== user.username) {
            const existing = userQueries.findByUsername.get(username);
            if (existing) {
                return json(res, 400, { error: 'Username already taken' });
            }
        }

        userQueries.update.run(
            username || user.username,
            isAdmin !== undefined ? (isAdmin ? 1 : 0) : user.is_admin,
            now,
            user.id
        );

        const updated = userQueries.findById.get(req.params.id);

        json(res, 200, {
            user: {
                id: updated.id,
                username: updated.username,
                isAdmin: !!updated.is_admin,
                createdAt: updated.created_at,
                updatedAt: updated.updated_at
            }
        });
    },

    /**
     * DELETE /api/users/:id
     * Delete a user (admin only)
     */
    async delete(req, res) {
        const admin = requireAdmin(req, res);
        if (!admin) return;

        const user = userQueries.findById.get(req.params.id);
        if (!user) {
            return json(res, 404, { error: 'User not found' });
        }

        // Prevent self-deletion
        if (user.id === admin.id) {
            return json(res, 400, { error: 'Cannot delete yourself' });
        }

        userQueries.delete.run(user.id);

        json(res, 200, { success: true });
    }
};
