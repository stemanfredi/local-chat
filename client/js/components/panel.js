import { $, clearChildren } from '../utils/dom.js';
import { events, EVENTS } from '../utils/events.js';
import { state, saveSetting } from '../state.js';
import { webllm } from '../services/webllm.js';
import { syncService } from '../services/sync.js';
import { documentService } from '../services/documents.js';
import { authApi } from '../api/auth.js';
import { usersApi } from '../api/users.js';
import { SYNC_MODES, SETTINGS_KEYS } from '../../../shared/constants.js';

/**
 * Panel component - shows Settings, Users, or Documents based on context
 */
export class Panel {
    constructor(container) {
        this.container = container;
        this.mode = 'settings'; // 'settings', 'users', or 'documents'
        this.models = [];
        this.users = [];
        this.documents = [];
        this.render();
        this.bindEvents();
    }

    render() {
        const titles = {
            settings: 'Settings',
            users: 'Manage Users',
            documents: 'Documents'
        };
        const title = titles[this.mode] || 'Settings';

        this.container.innerHTML = `
            <div class="panel-header">
                <div class="panel-title">${title}</div>
                <button class="close-btn" id="panel-close-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <div class="panel-content" id="panel-content"></div>
        `;

        this.contentEl = $('#panel-content', this.container);

        // Bind close button (must rebind after each render)
        $('#panel-close-btn', this.container).addEventListener('click', () => this.close());

        if (this.mode === 'settings') {
            this.renderSettings();
        } else if (this.mode === 'users') {
            this.renderUsers();
        } else if (this.mode === 'documents') {
            this.renderDocuments();
        }
    }

    // ==================== Settings ====================

    renderSettings() {
        this.contentEl.innerHTML = `
            ${!state.user ? `
                <div class="panel-section">
                    <div class="panel-section-title">Account</div>
                    <div class="panel-guest-info">
                        <div class="panel-avatar guest">G</div>
                        <div class="panel-user-details">
                            <div class="panel-username">Guest</div>
                            <div class="panel-role">Local only - sign in to sync</div>
                        </div>
                    </div>
                    <div class="panel-auth-form">
                        <input type="text" class="panel-input" id="auth-username" placeholder="Username" autocomplete="username">
                        <input type="password" class="panel-input" id="auth-password" placeholder="Password" autocomplete="current-password">
                        <div class="panel-error hidden" id="auth-error"></div>
                        <div class="panel-auth-buttons">
                            <button class="panel-btn-primary" id="login-btn">Sign In</button>
                            <button class="panel-btn" id="register-btn">Register</button>
                        </div>
                    </div>
                </div>
            ` : ''}

            <div class="panel-section">
                <div class="panel-section-title">Model</div>
                <div class="panel-option">
                    <label class="panel-label" for="inference-model">Inference Model</label>
                    <select class="panel-select" id="inference-model">
                        <option value="">Loading models...</option>
                    </select>
                </div>
                <div class="panel-option">
                    <button class="panel-btn-primary" id="load-model-btn">Load Model</button>
                </div>
                <div class="panel-option">
                    <button class="panel-btn" id="refresh-models-btn">Refresh Model List</button>
                </div>
            </div>

            <div class="panel-section">
                <div class="panel-section-title">Sync</div>
                <div class="panel-option">
                    <label class="panel-label" for="sync-mode">Sync Mode</label>
                    <select class="panel-select" id="sync-mode" ${!state.user ? 'disabled' : ''}>
                        <option value="${SYNC_MODES.PURE_OFFLINE}">Pure Offline</option>
                        <option value="${SYNC_MODES.OFFLINE_FIRST}">Offline-First (Sync when online)</option>
                    </select>
                    ${!state.user ? '<p class="panel-hint">Sign in to enable sync</p>' : ''}
                </div>
                ${state.user && state.syncMode === SYNC_MODES.OFFLINE_FIRST ? `
                    <div class="panel-option">
                        <p class="panel-text-muted" id="sync-status">
                            ${state.isSyncing ? 'Syncing...' : (state.lastSyncAt ? `Last synced: ${new Date(state.lastSyncAt).toLocaleString()}` : 'Not synced yet')}
                        </p>
                        <button class="panel-btn" id="sync-now-btn" ${state.isSyncing ? 'disabled' : ''}>
                            ${state.isSyncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                    </div>
                ` : ''}
            </div>

            <div class="panel-section">
                <div class="panel-section-title">About</div>
                <p class="panel-text">Local Chat v0.1.0</p>
                <p class="panel-text-muted">AI chat running in your browser using WebLLM.</p>
            </div>
        `;

        this.loadModels();
        this.bindSettingsEvents();

        // Set current sync mode
        const syncModeSelect = $('#sync-mode', this.contentEl);
        if (syncModeSelect) {
            syncModeSelect.value = state.syncMode;
        }
    }

    bindSettingsEvents() {
        // Auth form (only if guest)
        if (!state.user) {
            const loginBtn = $('#login-btn', this.contentEl);
            const registerBtn = $('#register-btn', this.contentEl);
            const usernameInput = $('#auth-username', this.contentEl);
            const passwordInput = $('#auth-password', this.contentEl);
            const errorEl = $('#auth-error', this.contentEl);

            const handleAuth = async (isRegister) => {
                const username = usernameInput.value.trim();
                const password = passwordInput.value;

                if (!username || !password) {
                    errorEl.textContent = 'Please fill in all fields';
                    errorEl.classList.remove('hidden');
                    return;
                }

                loginBtn.disabled = true;
                registerBtn.disabled = true;

                try {
                    if (isRegister) {
                        await authApi.register(username, password);
                    } else {
                        await authApi.login(username, password);
                    }
                    this.render(); // Re-render without login form
                } catch (error) {
                    errorEl.textContent = error.message;
                    errorEl.classList.remove('hidden');
                    loginBtn.disabled = false;
                    registerBtn.disabled = false;
                }
            };

            loginBtn?.addEventListener('click', () => handleAuth(false));
            registerBtn?.addEventListener('click', () => handleAuth(true));
            passwordInput?.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') handleAuth(false);
            });
        }

        // Model controls
        const loadModelBtn = $('#load-model-btn', this.contentEl);
        const refreshModelsBtn = $('#refresh-models-btn', this.contentEl);
        const modelSelect = $('#inference-model', this.contentEl);
        const syncModeSelect = $('#sync-mode', this.contentEl);

        loadModelBtn?.addEventListener('click', async () => {
            const modelId = modelSelect?.value;
            if (!modelId) return;

            await saveSetting(SETTINGS_KEYS.INFERENCE_MODEL, modelId);
            try {
                await webllm.loadModel(modelId);
            } catch (error) {
                alert(`Failed to load model: ${error.message}`);
            }
        });

        refreshModelsBtn?.addEventListener('click', () => this.loadModels());

        modelSelect?.addEventListener('change', async () => {
            await saveSetting(SETTINGS_KEYS.INFERENCE_MODEL, modelSelect.value);
        });

        syncModeSelect?.addEventListener('change', async () => {
            await saveSetting(SETTINGS_KEYS.SYNC_MODE, syncModeSelect.value);
            // Re-render to show/hide sync status
            this.renderSettings();
        });

        // Sync now button
        const syncNowBtn = $('#sync-now-btn', this.contentEl);
        syncNowBtn?.addEventListener('click', async () => {
            try {
                await syncService.sync();
                this.renderSettings();
            } catch (error) {
                alert(`Sync failed: ${error.message}`);
            }
        });
    }

    async loadModels() {
        const modelSelect = $('#inference-model', this.contentEl);
        if (!modelSelect) return;

        try {
            this.models = await webllm.getAvailableModels();
            clearChildren(modelSelect);

            const small = this.models.filter(m => m.size === 'small');
            const large = this.models.filter(m => m.size === 'large');

            if (small.length > 0) {
                const group = document.createElement('optgroup');
                group.label = 'Smaller Models (Low VRAM)';
                for (const model of small) {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = `${model.name}${model.vram ? ` (${model.vram}MB)` : ''}`;
                    if (model.id === state.inferenceModel) option.selected = true;
                    group.appendChild(option);
                }
                modelSelect.appendChild(group);
            }

            if (large.length > 0) {
                const group = document.createElement('optgroup');
                group.label = 'Larger Models';
                for (const model of large) {
                    const option = document.createElement('option');
                    option.value = model.id;
                    option.textContent = `${model.name}${model.vram ? ` (${model.vram}MB)` : ''}`;
                    if (model.id === state.inferenceModel) option.selected = true;
                    group.appendChild(option);
                }
                modelSelect.appendChild(group);
            }
        } catch (error) {
            console.error('Failed to load models:', error);
            modelSelect.innerHTML = '<option value="">Failed to load models</option>';
        }
    }

    // ==================== Users ====================

    async renderUsers() {
        this.contentEl.innerHTML = `
            <div class="panel-section">
                <div id="users-list" class="users-list">
                    <div class="panel-loading">Loading users...</div>
                </div>
            </div>
        `;

        await this.loadUsers();
    }

    async loadUsers() {
        const listEl = $('#users-list', this.contentEl);
        if (!listEl) return;

        try {
            const result = await usersApi.list();
            this.users = result.users;
            this.renderUsersList();
        } catch (error) {
            listEl.innerHTML = `<div class="panel-error-msg">Failed to load users: ${error.message}</div>`;
        }
    }

    renderUsersList() {
        const listEl = $('#users-list', this.contentEl);
        if (!listEl) return;

        if (this.users.length === 0) {
            listEl.innerHTML = '<div class="panel-empty">No users found</div>';
            return;
        }

        listEl.innerHTML = this.users.map(user => {
            const isCurrentUser = user.id === state.user?.id;
            return `
                <div class="user-row" data-id="${user.id}">
                    <div class="user-row-avatar">${user.username.charAt(0).toUpperCase()}</div>
                    <div class="user-row-info">
                        <div class="user-row-name">
                            ${user.username}
                            ${isCurrentUser ? '<span class="user-row-badge">You</span>' : ''}
                        </div>
                        <div class="user-row-meta">
                            ${user.isAdmin ? 'Admin' : 'User'} · ${new Date(user.createdAt).toLocaleDateString()}
                        </div>
                    </div>
                    <div class="user-row-actions">
                        ${!isCurrentUser ? `
                            <label class="user-row-toggle" title="Admin">
                                <input type="checkbox" class="admin-toggle" data-id="${user.id}" ${user.isAdmin ? 'checked' : ''}>
                                <span>Admin</span>
                            </label>
                            <button class="user-row-delete" data-id="${user.id}" title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="3 6 5 6 21 6"></polyline>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Bind user events
        this.contentEl.querySelectorAll('.admin-toggle').forEach(toggle => {
            toggle.addEventListener('change', async (e) => {
                const userId = e.target.dataset.id;
                try {
                    await usersApi.update(userId, { isAdmin: e.target.checked });
                } catch (error) {
                    e.target.checked = !e.target.checked;
                    alert(`Failed: ${error.message}`);
                }
            });
        });

        this.contentEl.querySelectorAll('.user-row-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const userId = e.currentTarget.dataset.id;
                const user = this.users.find(u => u.id === userId);
                if (confirm(`Delete "${user.username}"?`)) {
                    try {
                        await usersApi.delete(userId);
                        await this.loadUsers();
                    } catch (error) {
                        alert(`Failed: ${error.message}`);
                    }
                }
            });
        });
    }

    // ==================== Documents ====================

    async renderDocuments() {
        this.contentEl.innerHTML = `
            <div class="panel-section">
                <div class="panel-option">
                    <label class="panel-label">Upload Document</label>
                    <input type="file" class="panel-file-input" id="document-upload"
                           accept="${documentService.getAcceptString()}" multiple>
                    <p class="panel-hint">Supported: PDF, DOCX, TXT, MD, JSON, JS, TS, PY, HTML, CSS</p>
                </div>
            </div>
            <div class="panel-section">
                <div class="panel-section-title">Your Documents</div>
                <div id="documents-list" class="documents-list">
                    <div class="panel-loading">Loading documents...</div>
                </div>
            </div>
        `;

        this.bindDocumentEvents();
        await this.loadDocuments();
    }

    bindDocumentEvents() {
        const uploadInput = $('#document-upload', this.contentEl);
        uploadInput?.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            for (const file of files) {
                try {
                    await documentService.uploadDocument(file);
                } catch (error) {
                    alert(`Failed to upload ${file.name}: ${error.message}`);
                }
            }

            // Clear input and reload list
            uploadInput.value = '';
            await this.loadDocuments();
        });
    }

    async loadDocuments() {
        const listEl = $('#documents-list', this.contentEl);
        if (!listEl) return;

        try {
            this.documents = await documentService.getDocuments();
            this.renderDocumentsList();
        } catch (error) {
            listEl.innerHTML = `<div class="panel-error-msg">Failed to load documents: ${error.message}</div>`;
        }
    }

    renderDocumentsList() {
        const listEl = $('#documents-list', this.contentEl);
        if (!listEl) return;

        if (this.documents.length === 0) {
            listEl.innerHTML = '<div class="panel-empty">No documents yet</div>';
            return;
        }

        listEl.innerHTML = this.documents.map(doc => {
            const icon = this.getDocumentIcon(doc.type);
            const size = doc.content ? `${Math.round(doc.content.length / 1024)}KB` : '';
            return `
                <div class="document-row" data-id="${doc.id}">
                    <div class="document-row-icon">${icon}</div>
                    <div class="document-row-info">
                        <div class="document-row-name">${doc.name}</div>
                        <div class="document-row-meta">${doc.type.toUpperCase()} ${size ? `· ${size}` : ''}</div>
                    </div>
                    <button class="document-row-delete" data-id="${doc.id}" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            `;
        }).join('');

        // Bind delete buttons
        this.contentEl.querySelectorAll('.document-row-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const docId = e.currentTarget.dataset.id;
                const doc = this.documents.find(d => d.id === docId);
                if (confirm(`Delete "${doc.name}"?`)) {
                    try {
                        await documentService.deleteDocument(docId);
                        await this.loadDocuments();
                    } catch (error) {
                        alert(`Failed: ${error.message}`);
                    }
                }
            });
        });
    }

    getDocumentIcon(type) {
        const icons = {
            pdf: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
            docx: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>',
            text: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>'
        };
        return icons[type] || icons.text;
    }

    // ==================== Panel Control ====================

    bindEvents() {
        events.on(EVENTS.SETTINGS_TOGGLE, () => this.toggle('settings'));
        events.on('panel:users', () => this.open('users'));
        events.on('panel:documents', () => this.open('documents'));
        events.on(EVENTS.AUTH_LOGIN, () => { if (this.mode === 'settings') this.render(); });
        events.on(EVENTS.AUTH_LOGOUT, () => { if (this.mode === 'settings') this.render(); });
        events.on(EVENTS.SYNC_STARTED, () => { if (this.mode === 'settings') this.updateSyncStatus(); });
        events.on(EVENTS.SYNC_COMPLETED, () => { if (this.mode === 'settings') this.updateSyncStatus(); });
        events.on(EVENTS.SYNC_ERROR, () => { if (this.mode === 'settings') this.updateSyncStatus(); });
    }

    updateSyncStatus() {
        const statusEl = $('#sync-status', this.contentEl);
        const btnEl = $('#sync-now-btn', this.contentEl);
        if (statusEl) {
            statusEl.textContent = state.isSyncing
                ? 'Syncing...'
                : (state.lastSyncAt ? `Last synced: ${new Date(state.lastSyncAt).toLocaleString()}` : 'Not synced yet');
        }
        if (btnEl) {
            btnEl.disabled = state.isSyncing;
            btnEl.textContent = state.isSyncing ? 'Syncing...' : 'Sync Now';
        }
    }

    open(mode = 'settings') {
        this.mode = mode;
        this.render();
        this.container.classList.add('open');
    }

    close() {
        this.container.classList.remove('open');
    }

    toggle(mode = 'settings') {
        if (this.container.classList.contains('open') && this.mode === mode) {
            this.close();
        } else {
            this.open(mode);
        }
    }
}
