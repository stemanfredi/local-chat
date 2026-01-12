import { events, EVENTS } from './utils/events.js';
import { SYNC_MODES, SETTINGS_KEYS, DEFAULT_INFERENCE_MODEL } from '../../shared/constants.js';
import { db } from './db/index.js';

/**
 * Global application state
 */
const initialState = {
    // Auth
    user: null,
    token: null,

    // Chat
    chats: [],
    currentChat: null,
    messages: [],

    // Model
    isModelLoading: false,
    modelLoadProgress: 0,
    currentModel: null,
    availableModels: [],

    // Streaming
    isStreaming: false,
    streamingContent: '',

    // Settings
    syncMode: SYNC_MODES.PURE_OFFLINE,
    inferenceModel: DEFAULT_INFERENCE_MODEL,
    embeddingModel: null,

    // Network
    isOnline: navigator.onLine,

    // Sync
    isSyncing: false,
    lastSyncAt: null,

    // UI
    sidebarOpen: true,
    settingsOpen: false
};

// Create reactive state proxy
function createReactiveState(initial) {
    const handlers = {
        set(target, key, value) {
            const oldValue = target[key];
            target[key] = value;

            // Emit state change event
            if (oldValue !== value) {
                events.emit(`state:${key}`, { value, oldValue });
            }

            return true;
        }
    };

    return new Proxy({ ...initial }, handlers);
}

export const state = createReactiveState(initialState);

/**
 * Load initial state from IndexedDB
 */
export async function loadState() {
    // Load settings
    const syncMode = await db.getSetting(SETTINGS_KEYS.SYNC_MODE);
    if (syncMode) state.syncMode = syncMode;

    const inferenceModel = await db.getSetting(SETTINGS_KEYS.INFERENCE_MODEL);
    if (inferenceModel) state.inferenceModel = inferenceModel;

    const embeddingModel = await db.getSetting(SETTINGS_KEYS.EMBEDDING_MODEL);
    if (embeddingModel) state.embeddingModel = embeddingModel;

    // Load auth
    const token = await db.getSetting(SETTINGS_KEYS.TOKEN);
    if (token) state.token = token;

    const user = await db.getSetting(SETTINGS_KEYS.USER);
    if (user) state.user = user;

    // Load chats
    state.chats = await db.getAllChats();

    // Load last sync time
    const lastSyncAt = await db.getLastSyncAt();
    if (lastSyncAt) state.lastSyncAt = lastSyncAt;
}

/**
 * Save a setting to IndexedDB
 * @param {string} key
 * @param {*} value
 */
export async function saveSetting(key, value) {
    await db.setSetting(key, value);
    state[key] = value;
    events.emit(EVENTS.SETTINGS_CHANGED, { key, value });
}

/**
 * Select a chat
 * @param {number} localId
 */
export async function selectChat(localId) {
    if (localId === null) {
        state.currentChat = null;
        state.messages = [];
        events.emit(EVENTS.CHAT_SELECTED, null);
        return;
    }

    const chat = await db.getChat(localId);
    if (chat) {
        state.currentChat = chat;
        state.messages = await db.getChatMessages(localId);
        events.emit(EVENTS.CHAT_SELECTED, chat);
    }
}

/**
 * Create a new chat and select it
 * @returns {Promise<Object>}
 */
export async function createChat() {
    const chat = await db.createChat();
    state.chats = [chat, ...state.chats];
    await selectChat(chat.localId);
    events.emit(EVENTS.CHAT_CREATED, chat);
    return chat;
}

/**
 * Delete the current chat
 */
export async function deleteCurrentChat() {
    if (!state.currentChat) return;

    await db.deleteChat(state.currentChat.localId);
    state.chats = state.chats.filter(c => c.localId !== state.currentChat.localId);

    events.emit(EVENTS.CHAT_DELETED, state.currentChat);

    // Select next chat or none
    if (state.chats.length > 0) {
        await selectChat(state.chats[0].localId);
    } else {
        await selectChat(null);
    }
}

/**
 * Add a message to the current chat
 * @param {string} role
 * @param {string} content
 * @returns {Promise<Object>}
 */
export async function addMessage(role, content) {
    if (!state.currentChat) {
        await createChat();
    }

    const message = await db.createMessage(state.currentChat.localId, { role, content });
    state.messages = [...state.messages, message];

    // Update chat title if first user message
    if (role === 'user' && state.messages.filter(m => m.role === 'user').length === 1) {
        const title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
        await db.updateChat(state.currentChat.localId, { title });
        state.currentChat = { ...state.currentChat, title };
        state.chats = state.chats.map(c =>
            c.localId === state.currentChat.localId ? state.currentChat : c
        );
    }

    events.emit(EVENTS.MESSAGE_CREATED, message);
    return message;
}

/**
 * Update a message (for streaming)
 * @param {string} id
 * @param {string} content
 */
export async function updateMessage(id, content) {
    await db.updateMessage(id, { content });
    state.messages = state.messages.map(m =>
        m.id === id ? { ...m, content } : m
    );
}

// Listen for online/offline events
window.addEventListener('online', () => {
    state.isOnline = true;
});

window.addEventListener('offline', () => {
    state.isOnline = false;
});
