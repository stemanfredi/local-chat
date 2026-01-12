# Local Chat

Local-first AI chat application with browser-based inference via WebLLM.

## Quick Start

```bash
# Clone and enter
git clone <repo-url>
cd local-chat

# Install server dependencies
npm install

# Start server (optional, for sync features)
npm start

# Open client
open client/index.html
# Or serve with any static server
npx serve client
```

## Features

- Chat with AI models running directly in your browser (WebLLM)
- Works offline - no server required for basic chat
- Optional server sync for multi-device access
- Document library with RAG (PDF, DOCX support)
- PWA - install as desktop/mobile app

## Documentation

See [CLAUDE.md](CLAUDE.md) for full documentation including specs, architecture, and task tracking.
