import { $, clearChildren } from '../utils/dom.js';
import { events, EVENTS } from '../utils/events.js';
import { state, saveSetting } from '../state.js';
import { webllm } from '../services/webllm.js';
import { SYNC_MODES, SETTINGS_KEYS } from '../../../shared/constants.js';

/**
 * Settings panel component
 */
export class Settings {
    constructor(container) {
        this.container = container;
        this.models = [];
        this.render();
        this.bindEvents();
        this.loadModels();
    }

    render() {
        this.container.innerHTML = `
            <div class="settings-header">
                <span class="settings-title">Settings</span>
                <button class="close-btn" id="settings-close-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="settings-content">
                <div class="settings-section">
                    <div class="settings-section-title">Model</div>
                    <div class="settings-option">
                        <label class="settings-label" for="inference-model">Inference Model</label>
                        <select class="settings-select" id="inference-model">
                            <option value="">Loading models...</option>
                        </select>
                    </div>
                    <div class="settings-option">
                        <button class="new-chat-btn" id="load-model-btn" style="width: 100%;">
                            Load Model
                        </button>
                    </div>
                    <div class="settings-option">
                        <button class="settings-btn" id="refresh-models-btn" style="width: 100%;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                            </svg>
                            Refresh Model List
                        </button>
                    </div>
                </div>

                <div class="settings-section">
                    <div class="settings-section-title">Sync</div>
                    <div class="settings-option">
                        <label class="settings-label" for="sync-mode">Sync Mode</label>
                        <select class="settings-select" id="sync-mode">
                            <option value="${SYNC_MODES.PURE_OFFLINE}">Pure Offline</option>
                            <option value="${SYNC_MODES.OFFLINE_FIRST}">Offline-First (Sync when online)</option>
                        </select>
                    </div>
                </div>

                <div class="settings-section">
                    <div class="settings-section-title">About</div>
                    <div style="font-size: var(--font-size-sm); color: var(--color-text-muted);">
                        <p>Local Chat v0.1.0</p>
                        <p style="margin-top: var(--spacing-sm);">
                            AI chat running entirely in your browser using WebLLM.
                        </p>
                    </div>
                </div>
            </div>
        `;

        this.modelSelect = $('#inference-model', this.container);
        this.syncModeSelect = $('#sync-mode', this.container);

        // Set current values
        this.syncModeSelect.value = state.syncMode;
    }

    async loadModels() {
        try {
            this.models = await webllm.getAvailableModels();
            this.renderModelOptions();
        } catch (error) {
            console.error('Failed to load models:', error);
            this.modelSelect.innerHTML = '<option value="">Failed to load models</option>';
        }
    }

    renderModelOptions() {
        clearChildren(this.modelSelect);

        // Group models by size
        const small = this.models.filter(m => m.size === 'small');
        const large = this.models.filter(m => m.size === 'large');

        if (small.length > 0) {
            const smallGroup = document.createElement('optgroup');
            smallGroup.label = 'Smaller Models (Low VRAM)';
            for (const model of small) {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = `${model.name}${model.vram ? ` (${model.vram}MB)` : ''}`;
                if (model.id === state.inferenceModel) {
                    option.selected = true;
                }
                smallGroup.appendChild(option);
            }
            this.modelSelect.appendChild(smallGroup);
        }

        if (large.length > 0) {
            const largeGroup = document.createElement('optgroup');
            largeGroup.label = 'Larger Models';
            for (const model of large) {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = `${model.name}${model.vram ? ` (${model.vram}MB)` : ''}`;
                if (model.id === state.inferenceModel) {
                    option.selected = true;
                }
                largeGroup.appendChild(option);
            }
            this.modelSelect.appendChild(largeGroup);
        }
    }

    bindEvents() {
        // Close button
        $('#settings-close-btn', this.container).addEventListener('click', () => {
            this.close();
        });

        // Load model button
        $('#load-model-btn', this.container).addEventListener('click', async () => {
            const modelId = this.modelSelect.value;
            if (!modelId) return;

            await saveSetting(SETTINGS_KEYS.INFERENCE_MODEL, modelId);

            try {
                await webllm.loadModel(modelId);
            } catch (error) {
                alert(`Failed to load model: ${error.message}`);
            }
        });

        // Refresh models button
        $('#refresh-models-btn', this.container).addEventListener('click', () => {
            this.loadModels();
        });

        // Model select
        this.modelSelect.addEventListener('change', async () => {
            await saveSetting(SETTINGS_KEYS.INFERENCE_MODEL, this.modelSelect.value);
        });

        // Sync mode select
        this.syncModeSelect.addEventListener('change', async () => {
            await saveSetting(SETTINGS_KEYS.SYNC_MODE, this.syncModeSelect.value);
        });

        // Listen for toggle event
        events.on(EVENTS.SETTINGS_TOGGLE, () => {
            this.toggle();
        });
    }

    open() {
        this.container.classList.add('open');
    }

    close() {
        this.container.classList.remove('open');
    }

    toggle() {
        this.container.classList.toggle('open');
    }
}
