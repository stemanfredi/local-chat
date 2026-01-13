# Local Chat

Local-first AI chat application with browser-based inference. Your data stays on your device; the cloud is optional.

## Quick Start

```bash
npm install
npm start           # Optional: enables sync features
open client/index.html
```

## Features

- **Private**: AI runs entirely in your browser via WebLLM
- **Offline**: No internet required for chat
- **RAG**: Upload documents, ask questions about them
- **Sync**: Optional server for multi-device access
- **PWA**: Install as desktop/mobile app

---

## How It Works

This section explains the core technologies. Each heading links to official documentation for deeper exploration.

### [WebLLM](https://webllm.mlc.ai/) — Browser-Based AI

WebLLM runs Large Language Models directly in your browser using [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) for GPU acceleration. No server, no API keys, no data leaving your device.

**The Stack:**
- [WebGPU](https://www.w3.org/TR/webgpu/) — Modern GPU API for the web (successor to WebGL)
- [Apache TVM](https://tvm.apache.org/) — ML compiler that optimizes models for WebGPU
- [MLC-LLM](https://llm.mlc.ai/) — Compiles LLMs into efficient WebGPU kernels

**Performance:** WebLLM retains ~80% of native GPU performance. Models run at 20-50+ tokens/second depending on hardware.

**Supported Models:** Llama 3, Phi 3, Gemma, Mistral, Qwen, and [many others](https://webllm.mlc.ai/docs/).

### [WebGPU](https://caniuse.com/webgpu) — Browser Support

WebGPU is required for GPU-accelerated inference. As of January 2026:

| Browser | Status | Notes |
|---------|--------|-------|
| Chrome/Edge 113+ | Stable | Windows, macOS, ChromeOS, Android 12+ |
| Safari 26+ | Stable | macOS Tahoe, iOS 26+, iPadOS 26, visionOS 26 |
| Firefox 141+ | Partial | Windows stable; macOS ARM in v145+; Linux behind flag |

**Coverage:** [~78% global](https://caniuse.com/webgpu), ~90%+ on modern desktop browsers.

**Linux Note:** WebGPU on Linux is still experimental across all browsers. Firefox expects stable Linux support in 2026. Chrome requires launch flags (`--enable-unsafe-webgpu`).

**Fallback:** Without WebGPU, the app works but AI features are unavailable.

### Hardware Requirements

LLM inference requires GPU memory (VRAM). The rule of thumb:

> **~0.5-1 GB VRAM per billion parameters** (with 4-bit quantization)

| GPU VRAM | Recommended Models |
|----------|-------------------|
| 4 GB | Phi-3-mini (3.8B), small models |
| 6-8 GB | Llama 3 8B, Mistral 7B, Qwen 7B |
| 12-16 GB | Larger context windows, faster inference |

**Minimum:** 4GB VRAM for small models. Integrated GPUs may work but expect slower performance.

**Note:** VRAM is shared with other browser tabs and system. Close unused tabs for best results.

### [RAG](https://www.promptingguide.ai/research/rag) — Retrieval-Augmented Generation

RAG lets you chat with your documents. Upload PDFs or Word docs, and the AI answers questions using their content.

**How it works:**

1. **Chunking** — Documents are split into ~1000 character passages
2. **Embedding** — Each chunk is converted to a vector (array of numbers) capturing its meaning
3. **Storage** — Vectors are stored locally in IndexedDB
4. **Retrieval** — When you ask a question, it's also embedded, and [cosine similarity](https://www.ibm.com/think/topics/cosine-similarity) finds the most relevant chunks
5. **Generation** — Retrieved chunks are injected into the prompt as context

**Embedding Models:** WebLLM loads a separate, smaller model (like `snowflake-arctic-embed`) to generate embeddings. This runs alongside the chat model.

### [Local-First](https://www.inkandswitch.com/essay/local-first/) Architecture

Local-first means your data lives on your device by default. The cloud is a sync mechanism, not the source of truth.

**Principles:**
- **Offline by default** — App works without internet
- **Instant** — No loading spinners; data is already local
- **Private** — Your chats never leave your device unless you enable sync
- **Durable** — Data survives server outages

**Implementation:**
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — Browser database storing chats, messages, documents
- [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) — Caches app for offline use
- **Last-write-wins sync** — Simple conflict resolution when syncing multiple devices

### [PWA](https://web.dev/learn/pwa/) — Progressive Web App

Install Local Chat like a native app. Works offline, launches from home screen.

**Technologies:**
- [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) — App metadata, icons, theme
- [Service Worker](https://web.dev/learn/pwa/service-workers/) — Offline caching, background sync
- [IndexedDB](https://web.dev/learn/pwa/offline-data/) — Persistent storage (up to 60% of disk)

---

## Further Reading

| Topic | Resource |
|-------|----------|
| WebLLM | [Documentation](https://webllm.mlc.ai/docs/), [GitHub](https://github.com/mlc-ai/web-llm), [Paper](https://arxiv.org/abs/2412.15803) |
| WebGPU | [MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API), [Spec](https://www.w3.org/TR/webgpu/), [Browser Support](https://caniuse.com/webgpu) |
| MLC-LLM | [Documentation](https://llm.mlc.ai/docs/), [GitHub](https://github.com/mlc-ai/mlc-llm) |
| Apache TVM | [Website](https://tvm.apache.org/), [WebGPU Blog](https://tvm.apache.org/2020/05/14/compiling-machine-learning-to-webassembly-and-webgpu) |
| RAG | [Prompt Engineering Guide](https://www.promptingguide.ai/research/rag), [Survey Paper](https://arxiv.org/abs/2312.10997) |
| Embeddings | [Pinecone Guide](https://www.pinecone.io/learn/vector-similarity/), [Best Models](https://greennode.ai/blog/best-embedding-models-for-rag) |
| Local-First | [Ink & Switch Essay](https://www.inkandswitch.com/essay/local-first/) |
| PWA | [web.dev Guide](https://web.dev/learn/pwa/), [MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps) |
| IndexedDB | [MDN Guide](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) |

---

## Documentation

See [CLAUDE.md](CLAUDE.md) for architecture, API specs, and development notes.

## License

MIT
