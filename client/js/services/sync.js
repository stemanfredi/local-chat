import { syncApi } from '../api/sync.js';
import { db } from '../db/index.js';
import { state } from '../state.js';
import { events, EVENTS } from '../utils/events.js';
import { SYNC_MODES, SYNC_STATUS } from '../../../shared/constants.js';

/**
 * Sync service for offline-first synchronization
 */
class SyncService {
    constructor() {
        this.isSyncing = false;
        this.syncInterval = null;
        this.retryTimeout = null;
    }

    /**
     * Initialize sync service
     * Starts automatic sync if in offline-first mode and logged in
     */
    init() {
        // Listen for auth changes
        events.on(EVENTS.AUTH_LOGIN, () => this.startAutoSync());
        events.on(EVENTS.AUTH_LOGOUT, () => this.stopAutoSync());

        // Listen for online/offline
        window.addEventListener('online', () => this.onOnline());
        window.addEventListener('offline', () => this.onOffline());

        // Listen for sync mode changes
        events.on(EVENTS.SETTINGS_CHANGED, ({ key, value }) => {
            if (key === 'syncMode') {
                if (value === SYNC_MODES.OFFLINE_FIRST) {
                    this.startAutoSync();
                } else {
                    this.stopAutoSync();
                }
            }
        });

        // Start if already logged in and in offline-first mode
        if (state.user && state.syncMode === SYNC_MODES.OFFLINE_FIRST) {
            this.startAutoSync();
        }
    }

    /**
     * Start automatic sync (every 30 seconds when online)
     */
    startAutoSync() {
        if (!state.user || state.syncMode !== SYNC_MODES.OFFLINE_FIRST) {
            return;
        }

        this.stopAutoSync();

        // Sync immediately
        this.sync().catch(console.error);

        // Then sync periodically
        this.syncInterval = setInterval(() => {
            if (state.isOnline) {
                this.sync().catch(console.error);
            }
        }, 30000);

        console.log('Auto-sync started');
    }

    /**
     * Stop automatic sync
     */
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
        console.log('Auto-sync stopped');
    }

    /**
     * Handle coming online
     */
    onOnline() {
        console.log('Network online, syncing...');
        if (state.user && state.syncMode === SYNC_MODES.OFFLINE_FIRST) {
            this.sync().catch(console.error);
        }
    }

    /**
     * Handle going offline
     */
    onOffline() {
        console.log('Network offline');
    }

    /**
     * Perform full sync (push then pull)
     * @returns {Promise<{pushed: number, pulled: number}>}
     */
    async sync() {
        if (this.isSyncing) {
            console.log('Sync already in progress');
            return { pushed: 0, pulled: 0 };
        }

        if (!state.isOnline) {
            console.log('Offline, skipping sync');
            return { pushed: 0, pulled: 0 };
        }

        if (!state.user) {
            console.log('Not logged in, skipping sync');
            return { pushed: 0, pulled: 0 };
        }

        this.isSyncing = true;
        state.isSyncing = true;
        events.emit(EVENTS.SYNC_STARTED);

        try {
            // Push local changes first
            const pushed = await this.push();

            // Then pull server changes
            const pulled = await this.pull();

            events.emit(EVENTS.SYNC_COMPLETED, { pushed, pulled });
            console.log(`Sync complete: pushed ${pushed}, pulled ${pulled}`);

            return { pushed, pulled };
        } catch (error) {
            console.error('Sync failed:', error);
            events.emit(EVENTS.SYNC_ERROR, { error: error.message });

            // Retry in 10 seconds
            this.retryTimeout = setTimeout(() => {
                this.sync().catch(console.error);
            }, 10000);

            throw error;
        } finally {
            this.isSyncing = false;
            state.isSyncing = false;
        }
    }

    /**
     * Push local changes to server
     * @returns {Promise<number>} Number of items pushed
     */
    async push() {
        const pending = await db.getPendingSyncRecords();

        if (pending.chats.length === 0 && pending.messages.length === 0) {
            return 0;
        }

        // Transform for server
        const chats = pending.chats.map(c => ({
            id: c.id,
            title: c.title,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
            deletedAt: c.deletedAt
        }));

        const messages = pending.messages.map(m => ({
            id: m.id,
            chatId: m.chatId, // Need to get chat's ULID from localId
            role: m.role,
            content: m.content,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
            deletedAt: m.deletedAt
        }));

        // For messages, we need to resolve chatLocalId to chatId (ULID)
        for (const msg of messages) {
            if (!msg.chatId) {
                // Find the chat by localId
                const chat = await db.getChat(pending.messages.find(m => m.id === msg.id).chatLocalId);
                if (chat) {
                    msg.chatId = chat.id;
                }
            }
        }

        // Filter out messages without valid chatId
        const validMessages = messages.filter(m => m.chatId);

        const result = await syncApi.push({ chats, messages: validMessages });

        // Mark successfully synced items
        const syncedChatIds = result.results.chats
            .filter(r => r.synced)
            .map(r => r.id);
        const syncedMessageIds = result.results.messages
            .filter(r => r.synced)
            .map(r => r.id);

        await db.markAsSynced('chats', syncedChatIds);
        await db.markAsSynced('messages', syncedMessageIds);

        // Update last sync timestamp
        await db.setLastSyncAt(result.syncedAt);

        return syncedChatIds.length + syncedMessageIds.length;
    }

    /**
     * Pull changes from server
     * @returns {Promise<number>} Number of items pulled
     */
    async pull() {
        const lastSyncAt = await db.getLastSyncAt();
        const result = await syncApi.pull(lastSyncAt);

        let pulled = 0;

        // Merge chats
        for (const chat of result.chats) {
            const merged = await db.mergeChat(chat);
            if (merged) pulled++;
        }

        // Merge messages
        for (const msg of result.messages) {
            const merged = await db.mergeMessage(msg);
            if (merged) pulled++;
        }

        // Update last sync timestamp
        await db.setLastSyncAt(result.syncedAt);
        state.lastSyncAt = result.syncedAt;

        // Reload chats in state if any were pulled
        if (pulled > 0) {
            state.chats = await db.getAllChats();
            events.emit(EVENTS.CHATS_UPDATED);
        }

        return pulled;
    }
}

export const syncService = new SyncService();
