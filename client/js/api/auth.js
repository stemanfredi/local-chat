import { api } from './client.js';
import { state, saveSetting } from '../state.js';
import { events, EVENTS } from '../utils/events.js';
import { SETTINGS_KEYS } from '../../../shared/constants.js';
import { db } from '../db/index.js';

/**
 * Auth API functions
 */
export const authApi = {
    /**
     * Register a new user
     * @param {string} username
     * @param {string} password
     * @returns {Promise<Object>}
     */
    async register(username, password) {
        const result = await api.post('/auth/register', { username, password });

        // Save auth state
        await saveAuthState(result.user, result.token);

        return result;
    },

    /**
     * Login
     * @param {string} username
     * @param {string} password
     * @returns {Promise<Object>}
     */
    async login(username, password) {
        const result = await api.post('/auth/login', { username, password });

        // Save auth state
        await saveAuthState(result.user, result.token);

        return result;
    },

    /**
     * Refresh token
     * @returns {Promise<Object>}
     */
    async refresh() {
        const result = await api.post('/auth/refresh');

        // Save new token
        await saveSetting(SETTINGS_KEYS.TOKEN, result.token);

        return result;
    },

    /**
     * Get current user
     * @returns {Promise<Object>}
     */
    async me() {
        return api.get('/auth/me');
    },

    /**
     * Logout
     */
    async logout() {
        await db.deleteSetting(SETTINGS_KEYS.TOKEN);
        await db.deleteSetting(SETTINGS_KEYS.USER);

        state.user = null;
        state.token = null;

        events.emit(EVENTS.AUTH_LOGOUT);
    },

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!state.token && !!state.user;
    },

    /**
     * Check if user is admin
     * @returns {boolean}
     */
    isAdmin() {
        return state.user?.isAdmin === true;
    }
};

/**
 * Save auth state to IndexedDB and state
 */
async function saveAuthState(user, token) {
    await saveSetting(SETTINGS_KEYS.USER, user);
    await saveSetting(SETTINGS_KEYS.TOKEN, token);

    state.user = user;
    state.token = token;

    events.emit(EVENTS.AUTH_LOGIN, user);
}
