import { api } from './client.js';

/**
 * Users API functions (admin only)
 */
export const usersApi = {
    /**
     * List all users
     * @returns {Promise<Object>}
     */
    async list() {
        return api.get('/users');
    },

    /**
     * Get a specific user
     * @param {string} id
     * @returns {Promise<Object>}
     */
    async get(id) {
        return api.get(`/users/${id}`);
    },

    /**
     * Update a user
     * @param {string} id
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async update(id, data) {
        return api.patch(`/users/${id}`, data);
    },

    /**
     * Delete a user
     * @param {string} id
     * @returns {Promise<Object>}
     */
    async delete(id) {
        return api.delete(`/users/${id}`);
    }
};
