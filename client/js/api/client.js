import { state } from '../state.js';
import { events, EVENTS } from '../utils/events.js';

const API_BASE = '/api';

/**
 * API client for server communication
 */
class ApiClient {
    /**
     * Make an API request
     * @param {string} method
     * @param {string} path
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async request(method, path, data = null) {
        const headers = {
            'Content-Type': 'application/json'
        };

        // Add auth token if available
        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }

        const options = {
            method,
            headers
        };

        if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(`${API_BASE}${path}`, options);
        const result = await response.json();

        // Handle 401 - token expired
        if (response.status === 401 && state.token) {
            events.emit(EVENTS.AUTH_LOGOUT);
        }

        if (!response.ok) {
            // Handle validation errors
            let message = result.error || 'API request failed';
            if (result.errors) {
                // Get first validation error message
                const firstError = Object.values(result.errors)[0];
                if (firstError) message = firstError;
            }
            const error = new Error(message);
            error.status = response.status;
            error.errors = result.errors;
            throw error;
        }

        return result;
    }

    // Convenience methods
    get(path) {
        return this.request('GET', path);
    }

    post(path, data) {
        return this.request('POST', path, data);
    }

    patch(path, data) {
        return this.request('PATCH', path, data);
    }

    delete(path) {
        return this.request('DELETE', path);
    }
}

export const api = new ApiClient();
