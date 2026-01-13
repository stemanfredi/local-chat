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
- Chat list with active state
- User menu button (bottom) showing avatar + name + status
- User menu dropdown: Settings, Documents, Manage Users (admin), Sign Out/Sign In

**ChatView**
- Header with menu toggle, title, model status
- Message list with streaming support
- Input with send button and @mention autocomplete for documents

**Panel** (slides from right)
- Mode: 'settings', 'users', or 'documents' (controlled by dropdown selection)
- Settings: Account/login form (guest only), Appearance (theme), Chat Model, Embedding Model (RAG), Sync, About
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

