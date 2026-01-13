import { DB_NAME, DB_VERSION, SYNC_STATUS } from '../../../shared/constants.js';
import { ulid } from '../../../shared/ulid.js';

/**
 * IndexedDB wrapper for local-chat
 */
class Database {
    constructor() {
        this.db = null;
        this.ready = this.init();
    }

    /**
     * Initialize the database
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Settings store
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Chats store
                if (!db.objectStoreNames.contains('chats')) {
                    const chatsStore = db.createObjectStore('chats', { keyPath: 'localId', autoIncrement: true });
                    chatsStore.createIndex('id', 'id', { unique: true });
                    chatsStore.createIndex('updatedAt', 'updatedAt');
                    chatsStore.createIndex('syncStatus', 'syncStatus');
                }

                // Messages store
                if (!db.objectStoreNames.contains('messages')) {
                    const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
                    messagesStore.createIndex('chatLocalId', 'chatLocalId');
                    messagesStore.createIndex('updatedAt', 'updatedAt');
                    messagesStore.createIndex('syncStatus', 'syncStatus');
                }

                // Documents store
                if (!db.objectStoreNames.contains('documents')) {
                    const docsStore = db.createObjectStore('documents', { keyPath: 'id' });
                    docsStore.createIndex('updatedAt', 'updatedAt');
                    docsStore.createIndex('syncStatus', 'syncStatus');
                }

                // Sync metadata store
                if (!db.objectStoreNames.contains('syncMeta')) {
                    db.createObjectStore('syncMeta', { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Get a transaction and store
     * @param {string} storeName
     * @param {IDBTransactionMode} mode
     * @returns {IDBObjectStore}
     */
    getStore(storeName, mode = 'readonly') {
        const tx = this.db.transaction(storeName, mode);
        return tx.objectStore(storeName);
    }

    /**
     * Wrap IDBRequest in a Promise
     * @param {IDBRequest} request
     * @returns {Promise}
     */
    promisify(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // ==================== Settings ====================

    /**
     * Get a setting
     * @param {string} key
     * @returns {Promise<*>}
     */
    async getSetting(key) {
        await this.ready;
        const store = this.getStore('settings');
        const result = await this.promisify(store.get(key));
        return result?.value;
    }

    /**
     * Set a setting
     * @param {string} key
     * @param {*} value
     */
    async setSetting(key, value) {
        await this.ready;
        const store = this.getStore('settings', 'readwrite');
        await this.promisify(store.put({ key, value }));
    }

    /**
     * Delete a setting
     * @param {string} key
     */
    async deleteSetting(key) {
        await this.ready;
        const store = this.getStore('settings', 'readwrite');
        await this.promisify(store.delete(key));
    }

    // ==================== Chats ====================

    /**
     * Create a new chat
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async createChat(data = {}) {
        await this.ready;
        const now = new Date().toISOString();
        const chat = {
            id: ulid(),
            userId: data.userId || null,  // null = guest, otherwise user id
            title: data.title || null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            syncStatus: SYNC_STATUS.LOCAL
        };

        const store = this.getStore('chats', 'readwrite');
        const localId = await this.promisify(store.add(chat));
        return { ...chat, localId };
    }

    /**
     * Get a chat by local ID
     * @param {number} localId
     * @returns {Promise<Object|null>}
     */
    async getChat(localId) {
        await this.ready;
        const store = this.getStore('chats');
        return this.promisify(store.get(localId));
    }

    /**
     * Get a chat by ULID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getChatById(id) {
        await this.ready;
        const store = this.getStore('chats');
        const index = store.index('id');
        return this.promisify(index.get(id));
    }

    /**
     * Get all chats for a user (not deleted)
     * @param {string|null} userId - User ID or null for guest
     * @returns {Promise<Object[]>}
     */
    async getAllChats(userId = null) {
        await this.ready;
        const store = this.getStore('chats');
        const all = await this.promisify(store.getAll());
        return all
            .filter(chat => !chat.deletedAt && (chat.userId ?? null) === userId)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    /**
     * Update a chat
     * @param {number} localId
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateChat(localId, updates) {
        await this.ready;
        const store = this.getStore('chats', 'readwrite');
        const chat = await this.promisify(store.get(localId));
        if (!chat) throw new Error('Chat not found');

        const updated = {
            ...chat,
            ...updates,
            updatedAt: new Date().toISOString(),
            syncStatus: chat.syncStatus === SYNC_STATUS.SYNCED ? SYNC_STATUS.PENDING : chat.syncStatus
        };

        await this.promisify(store.put(updated));
        return updated;
    }

    /**
     * Soft delete a chat
     * @param {number} localId
     */
    async deleteChat(localId) {
        await this.updateChat(localId, { deletedAt: new Date().toISOString() });
    }

    /**
     * Clear all chats and messages (for user switch)
     */
    async clearAllChatsAndMessages() {
        await this.ready;
        const chatStore = this.getStore('chats', 'readwrite');
        await this.promisify(chatStore.clear());

        const msgStore = this.getStore('messages', 'readwrite');
        await this.promisify(msgStore.clear());
    }

    // ==================== Messages ====================

    /**
     * Create a message
     * @param {number} chatLocalId
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async createMessage(chatLocalId, data) {
        await this.ready;
        const now = new Date().toISOString();
        const message = {
            id: ulid(),
            chatLocalId,
            role: data.role,
            content: data.content,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            syncStatus: SYNC_STATUS.LOCAL
        };

        const store = this.getStore('messages', 'readwrite');
        await this.promisify(store.add(message));

        // Update chat's updatedAt
        await this.updateChat(chatLocalId, {});

        return message;
    }

    /**
     * Get a message by ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async getMessage(id) {
        await this.ready;
        const store = this.getStore('messages');
        return this.promisify(store.get(id));
    }

    /**
     * Get all messages for a chat
     * @param {number} chatLocalId
     * @returns {Promise<Object[]>}
     */
    async getChatMessages(chatLocalId) {
        await this.ready;
        const store = this.getStore('messages');
        const index = store.index('chatLocalId');
        const all = await this.promisify(index.getAll(chatLocalId));
        return all
            .filter(msg => !msg.deletedAt)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    }

    /**
     * Update a message
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateMessage(id, updates) {
        await this.ready;
        const store = this.getStore('messages', 'readwrite');
        const message = await this.promisify(store.get(id));
        if (!message) throw new Error('Message not found');

        const updated = {
            ...message,
            ...updates,
            updatedAt: new Date().toISOString(),
            syncStatus: message.syncStatus === SYNC_STATUS.SYNCED ? SYNC_STATUS.PENDING : message.syncStatus
        };

        await this.promisify(store.put(updated));
        return updated;
    }

    /**
     * Delete a message
     * @param {string} id
     */
    async deleteMessage(id) {
        const message = await this.getMessage(id);
        if (message) {
            await this.updateMessage(id, { deletedAt: new Date().toISOString() });
        }
    }

    // ==================== Documents ====================

    /**
     * Create a document
     * @param {Object} data
     * @returns {Promise<Object>}
     */
    async createDocument(data) {
        await this.ready;
        const now = new Date().toISOString();
        const doc = {
            id: ulid(),
            userId: data.userId || null,  // null = guest, otherwise user id
            name: data.name,
            type: data.type,
            content: data.content || null,
            embedding: data.embedding || null,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            syncStatus: SYNC_STATUS.LOCAL
        };

        const store = this.getStore('documents', 'readwrite');
        await this.promisify(store.add(doc));
        return doc;
    }

    /**
     * Get all documents for a user (not deleted)
     * @param {string|null} userId - User ID or null for guest
     * @returns {Promise<Object[]>}
     */
    async getAllDocuments(userId = null) {
        await this.ready;
        const store = this.getStore('documents');
        const all = await this.promisify(store.getAll());
        return all
            .filter(doc => !doc.deletedAt && (doc.userId ?? null) === userId)
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }

    /**
     * Update a document
     * @param {string} id
     * @param {Object} updates
     * @returns {Promise<Object>}
     */
    async updateDocument(id, updates) {
        await this.ready;
        const store = this.getStore('documents', 'readwrite');
        const doc = await this.promisify(store.get(id));
        if (!doc) throw new Error('Document not found');

        const updated = {
            ...doc,
            ...updates,
            updatedAt: new Date().toISOString(),
            syncStatus: doc.syncStatus === SYNC_STATUS.SYNCED ? SYNC_STATUS.PENDING : doc.syncStatus
        };

        await this.promisify(store.put(updated));
        return updated;
    }

    /**
     * Delete a document
     * @param {string} id
     */
    async deleteDocument(id) {
        await this.updateDocument(id, { deletedAt: new Date().toISOString() });
    }

    // ==================== Sync Metadata ====================

    /**
     * Get last sync timestamp
     * @returns {Promise<string|null>}
     */
    async getLastSyncAt() {
        await this.ready;
        const store = this.getStore('syncMeta');
        const result = await this.promisify(store.get('lastSyncAt'));
        return result?.value || null;
    }

    /**
     * Set last sync timestamp
     * @param {string} timestamp
     */
    async setLastSyncAt(timestamp) {
        await this.ready;
        const store = this.getStore('syncMeta', 'readwrite');
        await this.promisify(store.put({ key: 'lastSyncAt', value: timestamp }));
    }

    /**
     * Get all pending sync records
     * @returns {Promise<{chats: Object[], messages: Object[], documents: Object[]}>}
     */
    async getPendingSyncRecords() {
        await this.ready;

        const getByStatus = async (storeName) => {
            const store = this.getStore(storeName);
            const index = store.index('syncStatus');
            const local = await this.promisify(index.getAll(SYNC_STATUS.LOCAL));
            const pending = await this.promisify(index.getAll(SYNC_STATUS.PENDING));
            return [...local, ...pending];
        };

        return {
            chats: await getByStatus('chats'),
            messages: await getByStatus('messages'),
            documents: await getByStatus('documents')
        };
    }

    /**
     * Mark records as synced
     * @param {string} storeName
     * @param {string[]} ids - Array of ULID ids
     */
    async markAsSynced(storeName, ids) {
        if (ids.length === 0) return;

        await this.ready;
        const store = this.getStore(storeName, 'readwrite');

        for (const id of ids) {
            let record;
            if (storeName === 'chats') {
                // Chats use localId as keyPath but we have ULID
                const index = store.index('id');
                record = await this.promisify(index.get(id));
            } else {
                record = await this.promisify(store.get(id));
            }

            if (record) {
                record.syncStatus = SYNC_STATUS.SYNCED;
                await this.promisify(store.put(record));
            }
        }
    }

    /**
     * Merge a chat from server (last-write-wins)
     * @param {Object} serverChat
     * @param {string} userId - Current user's ID (from authenticated sync)
     * @returns {Promise<boolean>} True if merged/created
     */
    async mergeChat(serverChat, userId) {
        await this.ready;
        const store = this.getStore('chats', 'readwrite');
        const index = store.index('id');

        const existing = await this.promisify(index.get(serverChat.id));

        if (existing) {
            // Last-write-wins: only update if server is newer
            if (new Date(serverChat.updatedAt) > new Date(existing.updatedAt)) {
                const updated = {
                    ...existing,
                    title: serverChat.title,
                    updatedAt: serverChat.updatedAt,
                    deletedAt: serverChat.deletedAt,
                    syncStatus: SYNC_STATUS.SYNCED
                };
                await this.promisify(store.put(updated));
                return true;
            }
            return false;
        }

        // Insert new chat from server
        const chat = {
            id: serverChat.id,
            userId,  // Associate with current user
            title: serverChat.title,
            createdAt: serverChat.createdAt,
            updatedAt: serverChat.updatedAt,
            deletedAt: serverChat.deletedAt,
            syncStatus: SYNC_STATUS.SYNCED
        };
        await this.promisify(store.add(chat));
        return true;
    }

    /**
     * Merge a message from server (last-write-wins)
     * @param {Object} serverMsg
     * @returns {Promise<boolean>} True if merged/created
     */
    async mergeMessage(serverMsg) {
        await this.ready;
        const msgStore = this.getStore('messages', 'readwrite');

        const existing = await this.promisify(msgStore.get(serverMsg.id));

        if (existing) {
            // Last-write-wins: only update if server is newer
            if (new Date(serverMsg.updatedAt) > new Date(existing.updatedAt)) {
                const updated = {
                    ...existing,
                    content: serverMsg.content,
                    updatedAt: serverMsg.updatedAt,
                    deletedAt: serverMsg.deletedAt,
                    syncStatus: SYNC_STATUS.SYNCED
                };
                await this.promisify(msgStore.put(updated));
                return true;
            }
            return false;
        }

        // Need to find local chat by ULID to get localId
        const chatStore = this.getStore('chats');
        const chatIndex = chatStore.index('id');
        const chat = await this.promisify(chatIndex.get(serverMsg.chatId));

        if (!chat) {
            console.warn('Cannot merge message: chat not found', serverMsg.chatId);
            return false;
        }

        // Insert new message from server
        const message = {
            id: serverMsg.id,
            chatLocalId: chat.localId,
            role: serverMsg.role,
            content: serverMsg.content,
            createdAt: serverMsg.createdAt,
            updatedAt: serverMsg.updatedAt,
            deletedAt: serverMsg.deletedAt,
            syncStatus: SYNC_STATUS.SYNCED
        };

        // Need new transaction for messages store
        const newMsgStore = this.getStore('messages', 'readwrite');
        await this.promisify(newMsgStore.add(message));
        return true;
    }

    /**
     * Merge a document from server (last-write-wins)
     * @param {Object} serverDoc
     * @param {string} userId - Current user's ID (from authenticated sync)
     * @returns {Promise<boolean>} True if merged/created
     */
    async mergeDocument(serverDoc, userId) {
        await this.ready;
        const store = this.getStore('documents', 'readwrite');

        const existing = await this.promisify(store.get(serverDoc.id));

        if (existing) {
            // Last-write-wins: only update if server is newer
            if (new Date(serverDoc.updatedAt) > new Date(existing.updatedAt)) {
                const updated = {
                    ...existing,
                    name: serverDoc.name,
                    content: serverDoc.content,
                    updatedAt: serverDoc.updatedAt,
                    deletedAt: serverDoc.deletedAt,
                    syncStatus: SYNC_STATUS.SYNCED
                };
                await this.promisify(store.put(updated));
                return true;
            }
            return false;
        }

        // Insert new document from server
        const doc = {
            id: serverDoc.id,
            userId,  // Associate with current user
            name: serverDoc.name,
            type: serverDoc.type,
            content: serverDoc.content,
            embedding: null,
            createdAt: serverDoc.createdAt,
            updatedAt: serverDoc.updatedAt,
            deletedAt: serverDoc.deletedAt,
            syncStatus: SYNC_STATUS.SYNCED
        };
        await this.promisify(store.add(doc));
        return true;
    }
}

// Singleton instance
export const db = new Database();
