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
│  - Chat View      │  - Sync            │    (chats,         │
│  - Settings       │  - RAG             │     messages,      │
│  - Documents      │  - Documents       │     documents)     │
└─────────────────────────────────────────────────────────────┘
                              │ (optional sync)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Server (Node.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Routes           │  Services          │  Storage           │
│  - /api/auth      │  - Auth (JWT)      │  - SQLite          │
│  - /api/chats     │  - Sync            │    (users,         │
│  - /api/sync      │                    │     chats,         │
│  - /api/documents │                    │     messages)      │
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
├── server/                # Node.js backend
│   ├── index.js           # HTTP server entry
│   ├── router.js
│   ├── middleware/
│   ├── routes/
│   ├── db/
│   └── services/
│
├── client/                # Vanilla JS frontend
│   ├── index.html
│   ├── manifest.json      # PWA
│   ├── sw.js              # Service worker
│   ├── css/
│   ├── js/
│   └── assets/
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
| Package | Version |
|---------|---------|
| @mlc-ai/web-llm | 0.2.80 |
| pdfjs-dist | 5.4.530 |
| mammoth | 1.11.0 |
| ulid | 3.0.2 |

### Entities

**User**
- id (ULID), username, passwordHash, isAdmin, createdAt, updatedAt

**Chat**
- id (ULID - visible), localId (auto-increment), userId, title, createdAt, updatedAt, deletedAt

**Message**
- id (ULID), chatId, role (user|assistant|system), content, createdAt, updatedAt, deletedAt

**Document**
- id (ULID), userId, name, type, content, embedding, createdAt, updatedAt, deletedAt

### Sync Protocol
- Every record has `updatedAt`
- Conflict resolution: last-write-wins (most recent `updatedAt`)
- `syncStatus`: local | synced | pending
- Chat shareable only if exists on server

### User Settings
- Mode: pure-offline | offline-first
- Inference model selection
- Embedding model selection
- Refresh model list from WebLLM

### UI Design
- Colors: grayscale (#1a1a1a, #242424, #2d2d2d)
- Text: #e5e5e5, #a3a3a3
- Accent: #64748b (slate)
- Layout: hamburger sidebar (280px), chat max-width 768px
- Desktop-first, responsive
- PWA enabled

### API Endpoints

See [docs/specs/api.md](docs/specs/api.md) when created.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/register | No | Register (first user = admin) |
| POST | /api/auth/login | No | Login, returns JWT |
| GET | /api/auth/me | Yes | Current user |
| GET | /api/chats | Yes | List chats |
| POST | /api/chats | Yes | Create chat |
| GET | /api/chats/:id | Yes | Get chat + messages |
| POST | /api/sync/pull | Yes | Pull changes since timestamp |
| POST | /api/sync/push | Yes | Push local changes |

---

## Tasks

### Current

- [ ] Phase 2: Auth + auto-registration + admin user panel

### Backlog

- [ ] Phase 3: Server sync + pure offline/offline-first toggle
- [ ] Phase 4: Document library + parsing (pdf.js, mammoth)
- [ ] Phase 5: RAG: embedding + retrieval in chat
- [ ] Phase 6: PWA manifest + service worker + UI polish

### Done

- [x] Project design and specification
- [x] Phase 1: Basic chat + WebLLM streaming + local IndexedDB

---

## When to Extract

Extract a section to `docs/specs/[name].md` when:
- Section exceeds ~100 lines
- Multiple files need to reference it
- It changes independently of other sections

After extracting, replace section content with:
```
See [docs/specs/name.md](docs/specs/name.md)
```
