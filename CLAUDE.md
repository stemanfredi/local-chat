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
│                   │                    │     settings)      │
└─────────────────────────────────────────────────────────────┘
                              │ (optional sync)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Server (Node.js)                      │
├─────────────────────────────────────────────────────────────┤
│  Routes           │  Services          │  Storage           │
│  - /api/auth      │  - Auth (JWT)      │  - SQLite          │
│  - /api/users     │  - Sync            │    (users,         │
│  - /api/chats     │                    │     chats,         │
│                   │                    │     messages)      │
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
│   ├── routes/            # auth, users, chats
│   ├── db/                # SQLite schema + queries
│   └── services/          # auth (JWT, bcrypt)
│
├── client/
│   ├── index.html
│   ├── css/
│   │   ├── main.css
│   │   ├── variables.css
│   │   └── components/panel.css
│   └── js/
│       ├── app.js         # Entry point
│       ├── state.js       # Global state
│       ├── db/            # IndexedDB wrapper
│       ├── api/           # client, auth, users
│       ├── services/      # webllm
│       ├── components/    # sidebar, chat-view, panel
│       └── utils/         # dom, events
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
- User menu dropdown: Settings, Manage Users (admin), Sign Out/Sign In

**ChatView**
- Header with menu toggle, title, model status
- Message list with streaming support
- Input with send button

**Panel** (slides from right)
- Mode: 'settings' or 'users' (controlled by dropdown selection)
- Settings: Account/login form (guest only), Model, Sync, About
- Users: User list with admin toggle and delete (admin only)

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

### Validation Rules
- Username: 3-30 chars, alphanumeric + underscore
- Password: 8-100 chars

---

## Tasks

### Current

- [ ] Phase 3: Server sync + pure offline/offline-first toggle

### Backlog

- [ ] Phase 4: Document library + parsing (pdf.js, mammoth)
- [ ] Phase 5: RAG: embedding + retrieval in chat
- [ ] Phase 6: PWA manifest + service worker + UI polish

### Done

- [x] Project design and specification
- [x] Phase 1: Basic chat + WebLLM streaming + local IndexedDB
- [x] Phase 2: Auth + server + admin user panel + simplified UI

---

## When to Extract

Extract a section to `docs/specs/[name].md` when:
- Section exceeds ~100 lines
- Multiple files need to reference it
- It changes independently of other sections
