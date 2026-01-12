import { $, el, clearChildren, parseMarkdown, autoResize, escapeHtml } from '../utils/dom.js';
import { events, EVENTS } from '../utils/events.js';
import { state, addMessage, updateMessage, createChat } from '../state.js';
import { webllm } from '../services/webllm.js';
import { rag } from '../services/rag.js';
import { MESSAGE_ROLES } from '../../../shared/constants.js';

/**
 * Chat view component - messages and input
 */
export class ChatView {
    constructor(container) {
        this.container = container;
        this.render();
        this.bindEvents();
    }

    render() {
        this.container.innerHTML = `
            <div class="header">
                <button class="menu-btn" id="menu-btn">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <span class="header-title" id="header-title">Local Chat</span>
                <div class="model-status" id="model-status">
                    <span class="model-status-dot" id="model-status-dot"></span>
                    <span id="model-status-text">No model</span>
                </div>
            </div>
            <div class="chat-container" id="chat-container">
                <div class="chat-messages" id="chat-messages"></div>
            </div>
            <div class="input-container">
                <div class="input-wrapper">
                    <div class="mention-autocomplete hidden" id="mention-autocomplete"></div>
                    <textarea
                        class="chat-input"
                        id="chat-input"
                        placeholder="Type a message... (use @filename to reference docs)"
                        rows="1"
                    ></textarea>
                    <button class="send-btn" id="send-btn" disabled>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        `;

        this.messagesContainer = $('#chat-messages', this.container);
        this.chatContainer = $('#chat-container', this.container);
        this.input = $('#chat-input', this.container);
        this.sendBtn = $('#send-btn', this.container);
        this.modelStatusDot = $('#model-status-dot', this.container);
        this.modelStatusText = $('#model-status-text', this.container);
        this.headerTitle = $('#header-title', this.container);
        this.autocomplete = $('#mention-autocomplete', this.container);

        this.mentionStart = -1; // Track where @ mention started
        this.selectedIndex = 0; // Track selected autocomplete item

        this.renderMessages();
        this.updateModelStatus();
    }

    renderMessages() {
        clearChildren(this.messagesContainer);

        if (!state.currentChat) {
            this.renderEmptyState();
            return;
        }

        if (state.messages.length === 0) {
            this.renderEmptyChat();
            return;
        }

        for (const message of state.messages) {
            this.renderMessage(message);
        }

        // Render streaming message if active
        if (state.isStreaming && state.streamingContent) {
            this.renderStreamingMessage();
        }

        this.scrollToBottom();
    }

    renderEmptyState() {
        this.messagesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-title">Welcome to Local Chat</div>
                <div class="empty-state-text">
                    Start a new chat to begin a conversation with AI running directly in your browser.
                </div>
            </div>
        `;
    }

    renderEmptyChat() {
        this.messagesContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">✨</div>
                <div class="empty-state-title">New Chat</div>
                <div class="empty-state-text">
                    Type a message below to start the conversation.
                </div>
            </div>
        `;
    }

    renderMessage(message) {
        const isUser = message.role === MESSAGE_ROLES.USER;
        const messageEl = el('div', { className: 'message', dataset: { id: message.id } },
            el('div', { className: `message-avatar ${isUser ? 'user' : ''}` },
                isUser ? 'U' : 'AI'
            ),
            el('div', { className: 'message-content' },
                el('div', { className: 'message-role' },
                    isUser ? 'You' : 'Assistant'
                ),
                el('div', { className: 'message-text' })
            )
        );

        const textEl = $('.message-text', messageEl);
        if (isUser) {
            textEl.textContent = message.content;
        } else {
            textEl.innerHTML = parseMarkdown(message.content);
        }

        this.messagesContainer.appendChild(messageEl);
    }

    renderStreamingMessage() {
        const messageEl = el('div', { className: 'message streaming', dataset: { id: 'streaming' } },
            el('div', { className: 'message-avatar' }, 'AI'),
            el('div', { className: 'message-content' },
                el('div', { className: 'message-role' }, 'Assistant'),
                el('div', { className: 'message-text' })
            )
        );

        const textEl = $('.message-text', messageEl);
        textEl.innerHTML = parseMarkdown(state.streamingContent) + '<span class="streaming-cursor"></span>';

        this.messagesContainer.appendChild(messageEl);
    }

    updateStreamingMessage(content) {
        const streamingEl = $('[data-id="streaming"]', this.messagesContainer);
        if (streamingEl) {
            const textEl = $('.message-text', streamingEl);
            textEl.innerHTML = parseMarkdown(content) + '<span class="streaming-cursor"></span>';
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    updateModelStatus() {
        if (state.isModelLoading) {
            this.modelStatusDot.className = 'model-status-dot loading';
            const percent = Math.round(state.modelLoadProgress * 100);
            this.modelStatusText.textContent = `Loading ${percent}%`;
        } else if (state.currentModel) {
            this.modelStatusDot.className = 'model-status-dot ready';
            const modelInfo = webllm.getModelInfo();
            this.modelStatusText.textContent = modelInfo?.name?.split(' ').slice(0, 2).join(' ') || 'Ready';
        } else {
            this.modelStatusDot.className = 'model-status-dot';
            this.modelStatusText.textContent = 'No model';
        }
    }

    bindEvents() {
        // Menu button
        $('#menu-btn', this.container).addEventListener('click', () => {
            events.emit(EVENTS.SIDEBAR_TOGGLE);
        });

        // Input handling
        this.input.addEventListener('input', () => {
            autoResize(this.input);
            this.updateSendButton();
            this.handleMentionInput();
        });

        this.input.addEventListener('keydown', (e) => {
            // Handle autocomplete navigation
            if (!this.autocomplete.classList.contains('hidden')) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    this.navigateAutocomplete(1);
                    return;
                }
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    this.navigateAutocomplete(-1);
                    return;
                }
                if (e.key === 'Enter' || e.key === 'Tab') {
                    e.preventDefault();
                    this.selectAutocompleteItem();
                    return;
                }
                if (e.key === 'Escape') {
                    this.hideAutocomplete();
                    return;
                }
            }

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.send();
            }
        });

        // Send button
        this.sendBtn.addEventListener('click', () => this.send());

        // State events
        events.on(EVENTS.CHAT_SELECTED, () => {
            this.renderMessages();
            this.updateHeader();
        });

        events.on(EVENTS.MESSAGE_CREATED, () => {
            this.renderMessages();
        });

        events.on(EVENTS.MESSAGE_STREAMING, ({ content }) => {
            this.updateStreamingMessage(content);
        });

        events.on(EVENTS.MESSAGE_COMPLETE, () => {
            this.renderMessages();
        });

        events.on(EVENTS.MODEL_LOADING, () => {
            this.updateModelStatus();
        });

        events.on(EVENTS.MODEL_LOADED, () => {
            this.updateModelStatus();
            this.updateSendButton();
        });

        events.on(EVENTS.MODEL_ERROR, () => {
            this.updateModelStatus();
        });
    }

    updateHeader() {
        if (state.currentChat?.title) {
            this.headerTitle.textContent = state.currentChat.title;
        } else {
            this.headerTitle.textContent = 'Local Chat';
        }
    }

    updateSendButton() {
        const hasContent = this.input.value.trim().length > 0;
        const canSend = hasContent && !state.isStreaming && webllm.isReady();
        this.sendBtn.disabled = !canSend;
    }

    // ==================== Mention Autocomplete ====================

    async handleMentionInput() {
        const text = this.input.value;
        const cursorPos = this.input.selectionStart;

        // Find @ before cursor
        let atPos = -1;
        for (let i = cursorPos - 1; i >= 0; i--) {
            if (text[i] === '@') {
                atPos = i;
                break;
            }
            // Stop if we hit a space or newline (not in a mention)
            if (text[i] === ' ' || text[i] === '\n') {
                break;
            }
        }

        if (atPos === -1) {
            this.hideAutocomplete();
            return;
        }

        this.mentionStart = atPos;
        const query = text.slice(atPos + 1, cursorPos);

        // Search for matching documents
        const docs = await rag.searchDocuments(query);

        if (docs.length === 0) {
            this.hideAutocomplete();
            return;
        }

        this.showAutocomplete(docs);
    }

    showAutocomplete(docs) {
        this.autocompleteItems = docs;
        this.selectedIndex = 0;

        this.autocomplete.innerHTML = docs.map((doc, i) => `
            <div class="mention-item ${i === 0 ? 'selected' : ''}" data-index="${i}">
                <span class="mention-name">${doc.name}</span>
                <span class="mention-type">${doc.type}</span>
            </div>
        `).join('');

        // Add click handlers
        this.autocomplete.querySelectorAll('.mention-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectedIndex = parseInt(item.dataset.index);
                this.selectAutocompleteItem();
            });
        });

        this.autocomplete.classList.remove('hidden');
    }

    hideAutocomplete() {
        this.autocomplete.classList.add('hidden');
        this.mentionStart = -1;
        this.autocompleteItems = [];
    }

    navigateAutocomplete(direction) {
        if (!this.autocompleteItems?.length) return;

        this.selectedIndex = (this.selectedIndex + direction + this.autocompleteItems.length) % this.autocompleteItems.length;

        // Update selection UI
        this.autocomplete.querySelectorAll('.mention-item').forEach((item, i) => {
            item.classList.toggle('selected', i === this.selectedIndex);
        });
    }

    selectAutocompleteItem() {
        if (!this.autocompleteItems?.length || this.mentionStart === -1) return;

        const doc = this.autocompleteItems[this.selectedIndex];
        const text = this.input.value;
        const cursorPos = this.input.selectionStart;

        // Build the mention text (quote if has spaces)
        const mention = doc.name.includes(' ') ? `@"${doc.name}"` : `@${doc.name}`;

        // Replace @query with the full mention
        const before = text.slice(0, this.mentionStart);
        const after = text.slice(cursorPos);
        this.input.value = before + mention + ' ' + after;

        // Move cursor after the mention
        const newPos = this.mentionStart + mention.length + 1;
        this.input.setSelectionRange(newPos, newPos);

        this.hideAutocomplete();
        this.input.focus();
        this.updateSendButton();
    }

    async send() {
        const content = this.input.value.trim();
        if (!content || state.isStreaming || !webllm.isReady()) return;

        // Clear input
        this.input.value = '';
        autoResize(this.input);
        this.updateSendButton();

        // Ensure we have a chat
        if (!state.currentChat) {
            await createChat();
        }

        // Add user message
        await addMessage(MESSAGE_ROLES.USER, content);

        // Start streaming response
        state.isStreaming = true;
        state.streamingContent = '';
        this.renderMessages();

        try {
            // Build messages for context
            const contextMessages = [];
            let systemContext = '';

            // Check for @mentions first (explicit document references)
            const { context: mentionContext, cleanText } = await rag.getMentionedContext(content);
            if (mentionContext) {
                systemContext = mentionContext;
            } else {
                // Fall back to RAG search if no @mentions
                const ragContext = await rag.getContext(content);
                if (ragContext) {
                    systemContext = ragContext;
                }
            }

            if (systemContext) {
                contextMessages.push({
                    role: MESSAGE_ROLES.SYSTEM,
                    content: `You are a helpful assistant. Answer based on the following context from the user's documents. The context contains relevant information - use it to answer the question.\n\n${systemContext}`
                });
            }

            // Add conversation history
            for (const m of state.messages) {
                contextMessages.push({
                    role: m.role,
                    content: m.content
                });
            }

            // Stream response
            let fullContent = '';
            for await (const chunk of webllm.streamChat(contextMessages)) {
                fullContent += chunk;
                state.streamingContent = fullContent;
                events.emit(EVENTS.MESSAGE_STREAMING, { content: fullContent });
            }

            // Save assistant message
            state.isStreaming = false;
            state.streamingContent = '';
            await addMessage(MESSAGE_ROLES.ASSISTANT, fullContent);
            events.emit(EVENTS.MESSAGE_COMPLETE);

        } catch (error) {
            console.error('Chat error:', error);
            state.isStreaming = false;
            state.streamingContent = '';
            events.emit(EVENTS.MESSAGE_ERROR, { error: error.message });

            // Show error message
            await addMessage(MESSAGE_ROLES.ASSISTANT, `Error: ${error.message}`);
        }
    }
}
