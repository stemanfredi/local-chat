import { $ } from './utils/dom.js';
import { events, EVENTS } from './utils/events.js';
import { state, loadState } from './state.js';
import { webllm } from './services/webllm.js';
import { Sidebar } from './components/sidebar.js';
import { ChatView } from './components/chat-view.js';
import { Settings } from './components/settings.js';

/**
 * Main application
 */
class App {
    constructor() {
        this.sidebar = null;
        this.chatView = null;
        this.settings = null;
    }

    async init() {
        // Load persisted state
        await loadState();

        // Initialize components
        this.sidebar = new Sidebar($('#sidebar'));
        this.chatView = new ChatView($('#main'));
        this.settings = new Settings($('#settings-panel'));

        // Bind global events
        this.bindEvents();

        console.log('Local Chat initialized');
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

        events.on(EVENTS.MODEL_LOADED, () => {
            this.hideModelLoading();
        });

        events.on(EVENTS.MODEL_ERROR, ({ error }) => {
            this.hideModelLoading();
            this.showError(`Failed to load model: ${error}`);
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

            // Escape = Close settings
            if (e.key === 'Escape') {
                this.settings.close();
            }
        });
    }

    async loadModelWithOverlay(modelId) {
        this.showModelLoading(0, 'Initializing...');
        try {
            await webllm.loadModel(modelId);
        } catch (error) {
            console.error('Failed to load model:', error);
            // Don't show error on initial load - user can pick a different model
        }
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

    showError(message) {
        // Simple alert for now - could be improved with a toast system
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
