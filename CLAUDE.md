# Local Chat

Local-first AI chat application using WebLLM for browser-based inference, with optional server sync.

## Principles

- **DRY** - Don't Repeat Yourself
- **KISS** - Keep It Simple
- **YAGNI** - You Aren't Gonna Need It
- **Specs First** - Update spec before code
- **Less is more** - Best code is no code

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Browser)                      │
├─────────────────────────────────────────────────────────────┤
│  UI Components    │  Services          │  Storage           │
│  - Sidebar        │  - WebLLM          │  - IndexedDB       │
│  - ChatView       │  - Auth API        │    (chats,         │
│  - Panel          │  - Users API       │     messages,      │
│                   │  - Sync            │     documents,     │
│                   │  - Documents       │     settings)      │
│                   │  - RAG             │                    │
└─────────────────────────────────────────────────────────────┘
                              │ (optional sync)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Server (Node.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Routes           │  Services          │  Storage           │
│  - /api/auth      │  - Auth (JWT)      │  - SQLite          │
│  - /api/users     │                    │    (users,         │
│  - /api/chats     │                    │     chats,         │
│  - /api/documents │                    │     messages,      │
│  - /api/sync      │                    │     documents)     │
└─────────────────────────────────────────────────────────────┘
```

## Structure

```
local-chat/
├── CLAUDE.md              # This file
├── README.md              # Quick start
├── package.json           # Server dependencies
│
├── shared/                # Client/server shared code
│   ├── validation/        # Input validators
│   ├── constants.js
│   └── ulid.js
│
├── server/
│   ├── index.js           # HTTP server (static + API)
│   ├── router.js          # API route dispatcher
│   ├── middleware/        # cors, json, auth
│   ├── routes/            # auth, users, chats, documents, sync
│   ├── db/                # SQLite schema + queries
│   └── services/          # auth (JWT, bcrypt)
│
├── client/
│   ├── index.html
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service worker
│   ├── assets/icons/          # PWA icons (192, 512, maskable)
│   ├── css/
│   │   ├── main.css
│   │   ├── variables.css
│   │   └── components/panel.css
│   └── js/
│       ├── app.js         # Entry point
│       ├── state.js       # Global state
│       ├── db/            # IndexedDB wrapper
│       ├── api/           # client, auth, users, sync
│       ├── services/      # webllm, sync, documents, rag
│       ├── components/    # sidebar, chat-view, panel
│       └── utils/         # dom, events
│
├── scripts/
│   └── generate-icons.cjs # PWA icon generator (uses sharp)
│
└── data/                  # Runtime data (gitignored)
```

## Commits

Format: `<type>(<scope>): <description>`

| Type | Use |
|------|-----|
| feat | New feature |
| fix | Bug fix |
| docs | Documentation |
| refactor | Code restructuring |
| test | Adding tests |
| chore | Maintenance |

Rules: subject <=50 chars, lowercase, no period, imperative mood

---

## Specs

### Stack
| Layer | Tech |
|-------|------|
| Frontend | Vanilla JS, ES modules, CDN deps |
| Backend | Node.js (no framework) |
| Server DB | SQLite (better-sqlite3 ^12.6.0) |
| Client DB | IndexedDB |
| Auth | JWT stateless (jsonwebtoken ^9.0.3) |

### Client Dependencies (CDN)
| Package | Version | CDN |
|---------|---------|-----|
| @mlc-ai/web-llm | 0.2.80 | esm.run |
| pdfjs-dist | 4.4.168 | unpkg |
| mammoth | 1.11.0 | esm.run |

### Entities

**User**
- id (ULID), username, passwordHash, isAdmin, createdAt, updatedAt

**Chat**
- id (ULID - visible), localId (auto-increment), title, createdAt, updatedAt, deletedAt, syncStatus

**Message**
- id (ULID), chatLocalId, role (user|assistant|system), content, createdAt, updatedAt, deletedAt, syncStatus

**Document** (Phase 4)
- id (ULID), name, type, content, embedding, createdAt, updatedAt, deletedAt, syncStatus

### UI Components

**Sidebar**
- Chat list with active state and delete button (shows on hover)
- User menu button (bottom) showing avatar + name + status
- User menu dropdown: Settings, Documents, Manage Users (admin), Sign Out/Sign In

**ChatView**
- Header with menu toggle, title, model status
- Message list with streaming support
- User messages right-aligned (like Claude.ai), assistant messages left-aligned
- Message avatars: user's initial (or 'G' for guest), 'AI' for assistant
- Markdown rendering: **bold**, *italic*, `code`, ```code blocks```, tables
- Input with send button and @mention autocomplete for documents

**Panel** (slides from right)
- Mode: 'settings', 'users', or 'documents' (controlled by dropdown selection)
- Settings sections (in order): Account (guest only), Models, Sync, Appearance, About
- Models section: Refresh button, Chat dropdown, Load button, Embedding dropdown, Load button
- Model dropdowns: grouped by context size (Small Context 1k, Full Context), show VRAM, "(cached)" suffix for downloaded models
- Load buttons: show "Loaded" and disabled when selected model is already loaded
- Users: User list with admin toggle and delete (admin only)
- Documents: Upload, manage, and embed documents for RAG (shows embedding status)

### Model Loading

- First visit (new browser): no auto-load
- Return visit: auto-load last successfully loaded model (cached)
- Per-browser storage, but user-specific if logged in
- Setting key: `lastLoadedModel` (guest) or `lastLoadedModel:<userId>` (logged in)
- On login/logout: auto-load that user/guest's last model

### Documents

**Supported formats**: PDF, DOCX, TXT, MD, JSON, JS, TS, PY, HTML, CSS

**Libraries** (loaded from CDN on demand):
- pdf.js v4.4.168 for PDF parsing (unpkg CDN)
- mammoth v1.11.0 for DOCX parsing (esm.run CDN)

**Storage**: IndexedDB locally, SQLite on server, synced via /api/sync

### RAG (Retrieval Augmented Generation)

**Embedding Model**:
- Loaded separately from chat model via WebLLM
- Auto-load last used model on return visit (per-user)
- Setting key: `lastLoadedEmbedModel` (guest) or `lastLoadedEmbedModel:<userId>` (logged in)

**@Mention Documents**:
- Type `@` in chat to show document autocomplete
- Select with arrow keys + Enter/Tab, or click
- Syntax: `@filename` or `@"filename with spaces"`
- Multiple mentions: `@doc1 @doc2 compare these`
- Mentioned docs included in full (up to 8KB each)

**Auto RAG Search** (fallback when no @mentions):
- Documents split into ~1000 char chunks with 200 char overlap
- Chunks stored with embeddings in document's `embedding` field as JSON
- Format: `{chunks: [{text, docName, index, embedding}, ...]}`
- Cosine similarity search on user query
- Top 5 most relevant chunks retrieved (min score: 0.2)

**Context Injection**:
- @mentioned docs or RAG chunks injected as system message
- Only when embedding model is loaded and documents have embeddings

### API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register (first user = admin) |
| POST | /api/auth/login | No | Login, returns JWT |
| POST | /api/auth/refresh | Yes | Refresh token |
| GET | /api/auth/me | Yes | Current user |
| GET | /api/users | Admin | List users |
| PATCH | /api/users/:id | Admin | Update user |
| DELETE | /api/users/:id | Admin | Delete user |
| GET | /api/chats | Yes | List chats |
| POST | /api/chats | Yes | Create chat |
| GET | /api/chats/:id | Yes | Get chat + messages |
| PATCH | /api/chats/:id | Yes | Update chat |
| DELETE | /api/chats/:id | Yes | Soft delete chat |
| POST | /api/chats/:id/messages | Yes | Create message |
| GET | /api/documents | Yes | List documents |
| POST | /api/documents | Yes | Create document |
| GET | /api/documents/:id | Yes | Get document with content |
| PATCH | /api/documents/:id | Yes | Update document |
| DELETE | /api/documents/:id | Yes | Soft delete document |
| POST | /api/sync/pull | Yes | Get changes since timestamp |
| POST | /api/sync/push | Yes | Push local changes |

### Validation Rules
- Username: 3-30 chars, alphanumeric + underscore
- Password: 8-100 chars

### Data Isolation

**Principle**: Every user-owned record has `userId`. All queries filter by current user.

**IndexedDB Schema** (client-side):
- `chats.userId` - null for guest, user ID for logged-in user
- `documents.userId` - null for guest, user ID for logged-in user
- `messages` - linked to chats via `chatLocalId` (indirect isolation)

**Server Schema** (SQLite):
- All tables have `user_id` foreign key
- All queries filter by authenticated user

**Auth State Flow**:

| Event | Action |
|-------|--------|
| Logout | Load guest data (userId=null), clear current state |
| Login | Load user's data (userId=user.id), sync from server |
| Page Load | Filter all data by current user ID |
| Sync Pull | Merge records with current userId |

**Security Guarantees**:
- Guest cannot see logged-in user's data
- User A cannot see User B's data (same browser)
- Server enforces user_id on all endpoints
- Client filters by userId in all getAllX() calls

### Sync

**Modes**
- Pure Offline: No sync, all data stays local only
- Offline-First: Syncs with server when online, works offline

**Strategy**
- Last-write-wins based on updatedAt timestamp
- Push local changes first, then pull server changes
- Auto-sync every 30 seconds when in offline-first mode
- Immediate sync on coming online
- Manual "Sync Now" button in settings

**syncStatus**
- `local`: Created locally, never synced
- `synced`: In sync with server
- `pending`: Modified locally since last sync

### PWA

**Service Worker** (sw.js):
- Caches static assets on install
- Cache-first strategy for app files
- Network-only for API requests and external CDN
- Offline fallback to cached index.html

**Install**:
- Uses browser's native install prompt (Chrome/Edge "Add to Home Screen")
- No in-app install button (browser native is better UX)

**Icons**:
- Generated via `node scripts/generate-icons.cjs` (requires sharp dev dependency)
- Sizes: 192x192, 512x512, 512x512 maskable

### Mobile Responsive

**Viewport fix** (Android Chrome 100vh issue):
- Uses `position: fixed; inset: 0` instead of `height: 100vh` on mobile
- Applied to: `.app`, `.sidebar`, `.panel`, `.sidebar-overlay`
- Flexbox with `min-height: 0` for scrollable areas

**Sidebar** (mobile):
- Slides in from left as overlay
- Dark backdrop overlay (tap to close)
- Starts collapsed, toggle via hamburger menu
- z-index above main content

**Touch targets**:
- Minimum 44px for all interactive elements
- 16px font-size on inputs (prevents iOS zoom)

### Theme

**Modes**: Light (default), Dark

**Implementation**:
- Light mode colors in `:root` (default, no data attribute)
- Dark mode colors in `[data-theme="dark"]` selector
- Theme applied via `data-theme` attribute on `<html>` element
- Persisted in IndexedDB via `theme` setting key
- Toggle in Settings panel under "Appearance" section

**Colors** (light mode):
- Background: `#ffffff`, `#f5f5f5`, `#ebebeb`
- Text: `#1a1a1a`, `#525252`, `#737373`
- Border: `#d4d4d4`
- Accent: `#475569` (slate)

**Colors** (dark mode):
- Background: `#1a1a1a`, `#242424`, `#2d2d2d`
- Text: `#e5e5e5`, `#a3a3a3`, `#737373`
- Border: `#404040`
- Accent: `#64748b` (slate)

---

## Tasks

### Done

- [x] Project design and specification
- [x] Phase 1: Basic chat + WebLLM streaming + local IndexedDB
- [x] Phase 2: Auth + server + admin user panel + simplified UI
- [x] Phase 3: Server sync + pure offline/offline-first toggle
- [x] Phase 4: Document library + parsing (pdf.js, mammoth)
- [x] Phase 5: RAG with embedding + retrieval in chat
- [x] Phase 6: PWA manifest + service worker + install prompt
- [x] Light/dark theme toggle (defaults to light)

### Health Audit (Jan 2026)

**Sprint 1 - Dead Code Removal:**
- [x] Remove unused DOM utils: `$$`, `toggleClass`, `show`, `hide`, `debounce` from `client/js/utils/dom.js`

**Sprint 2 - Server Consolidation:**
- [x] Extract `json()` helper to `server/utils/response.js`
- [x] Update all route files to use shared helper
- [x] Extract `serializeUser()` to `server/services/auth.js`
- [x] Remove debug console.logs from `server/routes/auth.js`

**Sprint 3 - Event Constants:**
- [x] Add `PANEL_USERS`, `PANEL_DOCUMENTS` to `client/js/utils/events.js`
- [x] Update sidebar.js and panel.js to use constants

**Additional:**
- [x] Add markdown table rendering support to `parseMarkdown()`

### UX Improvements (Jan 2026)

- [x] Reorganize Settings panel: Models (combined), Sync, Appearance, About
- [x] Model dropdowns show VRAM in GB/MB format
- [x] Model dropdowns grouped by context size (Small Context 1k, Full Context)
- [x] Embedding models sorted by VRAM ascending with size displayed
- [x] Load buttons show "Loaded" and disabled when model already loaded
- [x] Dynamic button state updates on dropdown change
- [x] Refresh button updates both chat and embedding model lists
- [x] Chat message avatars show user's initial (or 'G' for guest)
- [x] Model cache indicator: "(cached)" suffix for already-downloaded models
- [x] Clear chat state on logout (privacy: guest can't see previous user's chats)

### Security Audit (Jan 2026)

- [x] Add userId field to documents in IndexedDB
- [x] Filter getAllDocuments() by userId
- [x] Filter getAllChats() by userId in sync pull
- [x] Update documents.js service to pass userId on create/get
- [x] Update rag.js service to filter by userId (7 call sites)
- [x] Update mergeChat/mergeDocument to set userId from sync
- [x] Document data isolation model in CLAUDE.md

### UI Polish (Jan 2026)

- [x] User messages right-aligned in chat (like Claude.ai)
- [x] Delete button on chat items in sidebar (shows on hover, confirm before delete)

