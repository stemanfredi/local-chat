import { $ } from './utils/dom.js';
import { events, EVENTS } from './utils/events.js';
import { state, loadState, saveLastLoadedModel, getLastLoadedModel, saveLastLoadedEmbedModel, getLastLoadedEmbedModel } from './state.js';
import { webllm } from './services/webllm.js';
import { syncService } from './services/sync.js';
import { rag } from './services/rag.js';
import { Sidebar } from './components/sidebar.js';
import { ChatView } from './components/chat-view.js';
import { Panel } from './components/panel.js';

/**
 * Main application
 */
class App {
    constructor() {
        this.sidebar = null;
        this.chatView = null;
        this.panel = null;
    }

    async init() {
        // Load persisted state
        await loadState();

        // Initialize components
        this.sidebar = new Sidebar($('#sidebar'));
        this.chatView = new ChatView($('#main'));
        this.panel = new Panel($('#panel'));

        // Initialize sync service
        syncService.init();

        // Bind global events
        this.bindEvents();

        // Auto-load last used models for current user/guest
        await this.autoLoadModel();
        await this.autoLoadEmbedModel();

        console.log('Local Chat initialized');
    }

    /**
     * Auto-load the last successfully loaded model for current user/guest
     */
    async autoLoadModel() {
        const lastModel = await getLastLoadedModel();
        if (lastModel) {
            console.log('Auto-loading last used model:', lastModel);
            try {
                await webllm.loadModel(lastModel);
            } catch (error) {
                console.error('Failed to auto-load model:', error);
            }
        }
    }

    /**
     * Auto-load the last successfully loaded embedding model for current user/guest
     */
    async autoLoadEmbedModel() {
        const lastModel = await getLastLoadedEmbedModel();
        if (lastModel) {
            console.log('Auto-loading last used embedding model:', lastModel);
            try {
                await webllm.loadEmbeddingModel(lastModel);
                // Embed any documents that don't have embeddings yet
                const stats = await rag.getStats();
                if (stats.pending > 0) {
                    console.log(`Auto-embedding ${stats.pending} documents...`);
                    await rag.embedAllDocuments();
                }
            } catch (error) {
                console.error('Failed to auto-load embedding model:', error);
            }
        }
    }

    bindEvents() {
        // Sidebar toggle
        events.on(EVENTS.SIDEBAR_TOGGLE, () => {
            this.sidebar.toggle();
        });

        // Model loading overlay
        events.on(EVENTS.MODEL_LOADING, ({ progress, text }) => {
            this.showModelLoading(progress, text);
        });

        events.on(EVENTS.MODEL_LOADED, async ({ modelId }) => {
            this.hideModelLoading();
            // Save as last loaded model for current user/guest
            await saveLastLoadedModel(modelId);
        });

        events.on(EVENTS.MODEL_ERROR, ({ error }) => {
            this.hideModelLoading();
            this.showError(`Failed to load model: ${error}`);
        });

        // Embedding model loading events
        events.on(EVENTS.EMBED_MODEL_LOADING, ({ progress, text }) => {
            this.showEmbedModelLoading(progress, text);
        });

        events.on(EVENTS.EMBED_MODEL_LOADED, async ({ modelId }) => {
            this.hideEmbedModelLoading();
            await saveLastLoadedEmbedModel(modelId);
        });

        events.on(EVENTS.EMBED_MODEL_ERROR, ({ error }) => {
            this.hideEmbedModelLoading();
            console.error('Failed to load embedding model:', error);
        });

        // Auth events
        events.on(EVENTS.AUTH_LOGIN, async () => {
            console.log('User logged in:', state.user?.username);
            // Auto-load user's last models (may differ from guest's)
            await this.autoLoadModel();
            await this.autoLoadEmbedModel();
        });

        events.on(EVENTS.AUTH_LOGOUT, async () => {
            console.log('User logged out');
            // Auto-load guest's last models (may differ from user's)
            await this.autoLoadModel();
            await this.autoLoadEmbedModel();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl + N = New chat
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                events.emit(EVENTS.CHAT_CREATED);
            }

            // Cmd/Ctrl + , = Settings
            if ((e.metaKey || e.ctrlKey) && e.key === ',') {
                e.preventDefault();
                events.emit(EVENTS.SETTINGS_TOGGLE);
            }

            // Escape = Close panel
            if (e.key === 'Escape') {
                this.panel.close();
            }
        });
    }

    showModelLoading(progress, text) {
        let overlay = $('#model-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'model-loading-overlay';
            overlay.className = 'model-loading';
            overlay.innerHTML = `
                <div class="model-loading-text">Loading AI Model...</div>
                <div class="model-loading-progress">
                    <div class="model-loading-bar" id="model-loading-bar"></div>
                </div>
                <div style="margin-top: var(--spacing-md); color: var(--color-text-muted); font-size: var(--font-size-sm);" id="model-loading-status"></div>
            `;
            document.body.appendChild(overlay);
        }

        const bar = $('#model-loading-bar');
        const status = $('#model-loading-status');
        if (bar) bar.style.width = `${progress * 100}%`;
        if (status) status.textContent = text || `${Math.round(progress * 100)}%`;
    }

    hideModelLoading() {
        const overlay = $('#model-loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    showEmbedModelLoading(progress, text) {
        let overlay = $('#embed-loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'embed-loading-overlay';
            overlay.className = 'model-loading';
            overlay.innerHTML = `
                <div class="model-loading-text">Loading Embedding Model...</div>
                <div class="model-loading-progress">
                    <div class="model-loading-bar" id="embed-loading-bar"></div>
                </div>
                <div style="margin-top: var(--spacing-md); color: var(--color-text-muted); font-size: var(--font-size-sm);" id="embed-loading-status"></div>
            `;
            document.body.appendChild(overlay);
        }

        const bar = $('#embed-loading-bar');
        const status = $('#embed-loading-status');
        if (bar) bar.style.width = `${progress * 100}%`;
        if (status) status.textContent = text || `${Math.round(progress * 100)}%`;
    }

    hideEmbedModelLoading() {
        const overlay = $('#embed-loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }

    showError(message) {
        alert(message);
    }
}

// Initialize app when DOM is ready
const app = new App();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.init());
} else {
    app.init();
}

export { app };
