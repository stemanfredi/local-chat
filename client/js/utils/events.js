/**
 * Simple event bus for cross-component communication
 */
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event once
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    once(event, callback) {
        const wrapper = (...args) => {
            this.off(event, wrapper);
            callback(...args);
        };
        this.on(event, wrapper);
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     */
    off(event, callback) {
        this.listeners.get(event)?.delete(callback);
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     */
    emit(event, data) {
        this.listeners.get(event)?.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in event listener for ${event}:`, error);
            }
        });
    }

    /**
     * Remove all listeners for an event
     * @param {string} event - Event name (optional, removes all if not provided)
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }
}

// Singleton instance
export const events = new EventBus();

// Event names
export const EVENTS = {
    // Chat events
    CHAT_CREATED: 'chat:created',
    CHAT_UPDATED: 'chat:updated',
    CHAT_DELETED: 'chat:deleted',
    CHAT_SELECTED: 'chat:selected',

    // Message events
    MESSAGE_CREATED: 'message:created',
    MESSAGE_STREAMING: 'message:streaming',
    MESSAGE_COMPLETE: 'message:complete',
    MESSAGE_ERROR: 'message:error',

    // Model events
    MODEL_LOADING: 'model:loading',
    MODEL_LOADED: 'model:loaded',
    MODEL_ERROR: 'model:error',

    // Sync events
    SYNC_STARTED: 'sync:started',
    SYNC_COMPLETED: 'sync:completed',
    SYNC_ERROR: 'sync:error',

    // Auth events
    AUTH_LOGIN: 'auth:login',
    AUTH_LOGOUT: 'auth:logout',

    // Settings events
    SETTINGS_CHANGED: 'settings:changed',

    // UI events
    SIDEBAR_TOGGLE: 'sidebar:toggle',
    SETTINGS_TOGGLE: 'settings:toggle'
};
