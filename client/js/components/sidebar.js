import { $, $$, el, clearChildren } from '../utils/dom.js';
import { events, EVENTS } from '../utils/events.js';
import { state, createChat, selectChat } from '../state.js';

/**
 * Sidebar component - chat list and navigation
 */
export class Sidebar {
    constructor(container) {
        this.container = container;
        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="sidebar-header">
                <span class="sidebar-title">Chats</span>
                <button class="new-chat-btn" id="new-chat-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    New
                </button>
            </div>
            <div class="chat-list" id="chat-list"></div>
            <div class="sidebar-footer">
                <button class="settings-btn" id="settings-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="3"></circle>
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                    </svg>
                    Settings
                </button>
            </div>
        `;

        this.chatList = $('#chat-list', this.container);
        this.renderChatList();
    }

    renderChatList() {
        clearChildren(this.chatList);

        if (state.chats.length === 0) {
            this.chatList.innerHTML = `
                <div style="padding: var(--spacing-md); color: var(--color-text-muted); font-size: var(--font-size-sm);">
                    No chats yet. Click "New" to start.
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

            item.addEventListener('click', () => this.onChatClick(chat.localId));
            this.chatList.appendChild(item);
        }
    }

    bindEvents() {
        // New chat button
        $('#new-chat-btn', this.container).addEventListener('click', async () => {
            await createChat();
        });

        // Settings button
        $('#settings-btn', this.container).addEventListener('click', () => {
            events.emit(EVENTS.SETTINGS_TOGGLE);
        });

        // Listen for state changes
        events.on(EVENTS.CHAT_CREATED, () => this.renderChatList());
        events.on(EVENTS.CHAT_UPDATED, () => this.renderChatList());
        events.on(EVENTS.CHAT_DELETED, () => this.renderChatList());
        events.on(EVENTS.CHAT_SELECTED, () => this.renderChatList());
        events.on(EVENTS.MESSAGE_CREATED, () => this.renderChatList()); // For title updates
    }

    async onChatClick(localId) {
        await selectChat(localId);
    }

    toggle() {
        this.container.classList.toggle('collapsed');
    }

    show() {
        this.container.classList.remove('collapsed');
    }

    hide() {
        this.container.classList.add('collapsed');
    }
}
