import { $, el, clearChildren } from '../utils/dom.js';
import { events, EVENTS } from '../utils/events.js';
import { state, createChat, selectChat, deleteChat } from '../state.js';
import { authApi } from '../api/auth.js';

/**
 * Sidebar component - chat list and navigation
 */
export class Sidebar {
    constructor(container) {
        this.container = container;
        this.menuOpen = false;
        this.isMobile = window.innerWidth <= 768;
        this.render();
        this.createOverlay();
        this.bindEvents();

        // Start collapsed on mobile
        if (this.isMobile) {
            this.container.classList.add('collapsed');
        }
    }

    createOverlay() {
        // Create overlay element for mobile (inside .app for proper z-index)
        this.overlay = document.createElement('div');
        this.overlay.className = 'sidebar-overlay';
        const app = document.querySelector('.app');
        app.appendChild(this.overlay);

        // Click overlay to close sidebar
        this.overlay.addEventListener('click', () => {
            this.hide();
        });
    }

    render() {
        this.container.innerHTML = `
            <div class="sidebar-header">
                <span class="sidebar-title">Chats</span>
                <button class="new-chat-btn" id="new-chat-btn" title="New chat (Ctrl+N)">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                </button>
            </div>
            <div class="chat-list" id="chat-list"></div>
            <div class="sidebar-footer">
                <div class="user-menu-container">
                    <button class="user-menu-btn" id="user-menu-btn">
                        <div class="user-menu-avatar" id="user-menu-avatar">G</div>
                        <div class="user-menu-info">
                            <div class="user-menu-name" id="user-menu-name">Guest</div>
                            <div class="user-menu-status" id="user-menu-status">Local only</div>
                        </div>
                        <svg class="user-menu-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                    </button>
                    <div class="user-menu-dropdown hidden" id="user-menu-dropdown"></div>
                </div>
            </div>
        `;

        this.chatList = $('#chat-list', this.container);
        this.renderChatList();
        this.renderUserMenu();
    }

    renderChatList() {
        clearChildren(this.chatList);

        if (state.chats.length === 0) {
            this.chatList.innerHTML = `
                <div class="chat-list-empty">
                    No chats yet
                </div>
            `;
            return;
        }

        for (const chat of state.chats) {
            const isActive = state.currentChat?.localId === chat.localId;
            const item = el('div', {
                className: `chat-item ${isActive ? 'active' : ''}`,
                dataset: { localId: chat.localId }
            },
                el('span', { className: 'chat-item-title' },
                    chat.title || 'New chat'
                )
            );

            // Add delete button with proper SVG (el() doesn't handle SVG namespace)
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'chat-item-delete';
            deleteBtn.title = 'Delete';
            deleteBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            `;
            deleteBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm(`Delete "${chat.title || 'New chat'}"?`)) {
                    await deleteChat(chat.localId);
                }
            });
            item.appendChild(deleteBtn);

            item.addEventListener('click', () => this.onChatClick(chat.localId));
            this.chatList.appendChild(item);
        }
    }

    renderUserMenu() {
        const avatar = $('#user-menu-avatar', this.container);
        const name = $('#user-menu-name', this.container);
        const status = $('#user-menu-status', this.container);
        const dropdown = $('#user-menu-dropdown', this.container);

        if (state.user) {
            avatar.textContent = state.user.username.charAt(0).toUpperCase();
            avatar.classList.remove('guest');
            name.textContent = state.user.username;
            status.textContent = state.user.isAdmin ? 'Admin' : 'Signed in';
        } else {
            avatar.textContent = 'G';
            avatar.classList.add('guest');
            name.textContent = 'Guest';
            status.textContent = 'Local only';
        }

        // Render dropdown menu
        dropdown.innerHTML = `
            <button class="user-menu-item" id="menu-settings">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                </svg>
                Settings
            </button>
            <button class="user-menu-item" id="menu-documents">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                Documents
            </button>
            ${state.user?.isAdmin ? `
                <button class="user-menu-item" id="menu-users">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                        <circle cx="9" cy="7" r="4"></circle>
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    Manage Users
                </button>
            ` : ''}
            <div class="user-menu-divider"></div>
            ${state.user ? `
                <button class="user-menu-item" id="menu-logout">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Sign Out
                </button>
            ` : `
                <button class="user-menu-item" id="menu-login">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                        <polyline points="10 17 15 12 10 7"></polyline>
                        <line x1="15" y1="12" x2="3" y2="12"></line>
                    </svg>
                    Sign In
                </button>
            `}
        `;

        this.bindMenuEvents();
    }

    bindMenuEvents() {
        const settingsBtn = $('#menu-settings', this.container);
        const documentsBtn = $('#menu-documents', this.container);
        const usersBtn = $('#menu-users', this.container);
        const logoutBtn = $('#menu-logout', this.container);
        const loginBtn = $('#menu-login', this.container);

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.closeMenu();
                events.emit(EVENTS.SETTINGS_TOGGLE);
            });
        }

        if (documentsBtn) {
            documentsBtn.addEventListener('click', () => {
                this.closeMenu();
                events.emit(EVENTS.PANEL_DOCUMENTS);
            });
        }

        if (usersBtn) {
            usersBtn.addEventListener('click', () => {
                this.closeMenu();
                events.emit(EVENTS.PANEL_USERS);
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                this.closeMenu();
                await authApi.logout();
            });
        }

        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                this.closeMenu();
                events.emit(EVENTS.SETTINGS_TOGGLE);
            });
        }
    }

    toggleMenu() {
        const dropdown = $('#user-menu-dropdown', this.container);
        const btn = $('#user-menu-btn', this.container);

        this.menuOpen = !this.menuOpen;
        dropdown.classList.toggle('hidden', !this.menuOpen);
        btn.classList.toggle('active', this.menuOpen);
    }

    closeMenu() {
        const dropdown = $('#user-menu-dropdown', this.container);
        const btn = $('#user-menu-btn', this.container);

        this.menuOpen = false;
        dropdown.classList.add('hidden');
        btn.classList.remove('active');
    }

    bindEvents() {
        // New chat button
        $('#new-chat-btn', this.container).addEventListener('click', async () => {
            await createChat();
            // Close sidebar on mobile after creating chat
            if (this.isMobile) {
                this.hide();
            }
        });

        // User menu button
        $('#user-menu-btn', this.container).addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (this.menuOpen && !e.target.closest('.user-menu-container')) {
                this.closeMenu();
            }
        });

        // Update mobile state on resize
        window.addEventListener('resize', () => {
            this.checkMobile();
        });

        // Listen for state changes
        events.on(EVENTS.CHAT_CREATED, () => this.renderChatList());
        events.on(EVENTS.CHAT_UPDATED, () => this.renderChatList());
        events.on(EVENTS.CHAT_DELETED, () => this.renderChatList());
        events.on(EVENTS.CHAT_SELECTED, () => this.renderChatList());
        events.on(EVENTS.MESSAGE_CREATED, () => this.renderChatList());
        events.on(EVENTS.CHATS_UPDATED, () => this.renderChatList());
        events.on(EVENTS.AUTH_LOGIN, () => {
            this.renderUserMenu();
            this.renderChatList();
        });
        events.on(EVENTS.AUTH_LOGOUT, () => {
            this.renderUserMenu();
            this.renderChatList();
        });
    }

    async onChatClick(localId) {
        await selectChat(localId);
        // Close sidebar on mobile after selecting chat
        if (this.isMobile) {
            this.hide();
        }
    }

    toggle() {
        if (this.container.classList.contains('collapsed')) {
            this.show();
        } else {
            this.hide();
        }
    }

    show() {
        this.container.classList.remove('collapsed');
        if (this.isMobile) {
            this.overlay.classList.add('visible');
        }
    }

    hide() {
        this.container.classList.add('collapsed');
        this.overlay.classList.remove('visible');
    }

    /**
     * Check if currently mobile viewport
     */
    checkMobile() {
        this.isMobile = window.innerWidth <= 768;
    }
}
