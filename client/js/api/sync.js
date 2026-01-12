import { api } from './client.js';

/**
 * Sync API endpoints
 */
export const syncApi = {
    /**
     * Pull changes from server since a given timestamp
     * @param {string|null} since - ISO timestamp or null for all
     * @returns {Promise<{syncedAt: string, chats: Object[], messages: Object[]}>}
     */
    async pull(since = null) {
        return api.post('/sync/pull', { since });
    },

    /**
     * Push local changes to server
     * @param {Object} data - { chats: [...], messages: [...] }
     * @returns {Promise<{syncedAt: string, results: Object, errors?: Object[]}>}
     */
    async push(data) {
        return api.post('/sync/push', data);
    }
};
