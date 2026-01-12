import { events, EVENTS } from '../utils/events.js';
import { state } from '../state.js';

/**
 * WebLLM service for browser-based LLM inference
 */
class WebLLMService {
    constructor() {
        this.engine = null;
        this.currentModel = null;
        this.isLoading = false;
        this.webllm = null;

        // Embedding engine (separate from chat)
        this.embedEngine = null;
        this.currentEmbedModel = null;
        this.isLoadingEmbed = false;
    }

    /**
     * Initialize WebLLM library
     */
    async initLibrary() {
        if (this.webllm) return;

        // Dynamic import from CDN
        this.webllm = await import('https://esm.run/@mlc-ai/web-llm@0.2.80');
    }

    /**
     * Get list of available models
     * @returns {Promise<Object[]>}
     */
    async getAvailableModels() {
        await this.initLibrary();

        return this.webllm.prebuiltAppConfig.model_list
            .filter(m => !m.model_id.includes('embed')) // Filter out embedding models
            .map(m => ({
                id: m.model_id,
                name: m.model_id.replace(/-MLC$/, '').replace(/-/g, ' '),
                vram: m.vram_required_MB,
                size: m.low_resource_required ? 'small' : 'large'
            }))
            .sort((a, b) => (a.vram || 0) - (b.vram || 0));
    }

    /**
     * Get list of available embedding models
     * @returns {Promise<Object[]>}
     */
    async getEmbeddingModels() {
        await this.initLibrary();

        return this.webllm.prebuiltAppConfig.model_list
            .filter(m => m.model_id.includes('embed'))
            .map(m => ({
                id: m.model_id,
                name: m.model_id.replace(/-MLC$/, '').replace(/-/g, ' ')
            }));
    }

    /**
     * Load a model
     * @param {string} modelId
     */
    async loadModel(modelId) {
        if (this.isLoading) {
            throw new Error('Already loading a model');
        }

        if (this.currentModel === modelId && this.engine) {
            return; // Model already loaded
        }

        await this.initLibrary();

        this.isLoading = true;
        state.isModelLoading = true;
        state.modelLoadProgress = 0;

        events.emit(EVENTS.MODEL_LOADING, { modelId, progress: 0 });

        try {
            // Unload existing model
            if (this.engine) {
                await this.unloadModel();
            }

            // Create new engine
            this.engine = await this.webllm.CreateMLCEngine(modelId, {
                initProgressCallback: (report) => {
                    const progress = report.progress || 0;
                    state.modelLoadProgress = progress;
                    events.emit(EVENTS.MODEL_LOADING, {
                        modelId,
                        progress,
                        text: report.text
                    });
                }
            });

            this.currentModel = modelId;
            state.currentModel = modelId;
            state.isModelLoading = false;
            state.modelLoadProgress = 1;

            events.emit(EVENTS.MODEL_LOADED, { modelId });
        } catch (error) {
            console.error('Failed to load model:', error);
            state.isModelLoading = false;
            state.modelLoadProgress = 0;
            events.emit(EVENTS.MODEL_ERROR, { modelId, error: error.message });
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Unload the current model
     */
    async unloadModel() {
        if (this.engine) {
            try {
                await this.engine.unload();
            } catch (e) {
                // Ignore unload errors
            }
            this.engine = null;
            this.currentModel = null;
            state.currentModel = null;
        }
    }

    /**
     * Check if a model is loaded
     * @returns {boolean}
     */
    isReady() {
        return this.engine !== null && !this.isLoading;
    }

    /**
     * Generate a streaming chat completion
     * @param {Object[]} messages - Chat messages
     * @param {Object} options - Generation options
     * @yields {string} - Generated text chunks
     */
    async *streamChat(messages, options = {}) {
        if (!this.engine) {
            throw new Error('No model loaded');
        }

        const stream = await this.engine.chat.completions.create({
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            })),
            stream: true,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2048,
            top_p: options.topP ?? 0.95
        });

        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) {
                yield delta;
            }
        }
    }

    /**
     * Generate a non-streaming chat completion
     * @param {Object[]} messages - Chat messages
     * @param {Object} options - Generation options
     * @returns {Promise<string>} - Generated text
     */
    async chat(messages, options = {}) {
        if (!this.engine) {
            throw new Error('No model loaded');
        }

        const response = await this.engine.chat.completions.create({
            messages: messages.map(m => ({
                role: m.role,
                content: m.content
            })),
            stream: false,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 2048,
            top_p: options.topP ?? 0.95
        });

        return response.choices[0]?.message?.content || '';
    }

    /**
     * Reset the chat context
     */
    async resetChat() {
        if (this.engine) {
            await this.engine.resetChat();
        }
    }

    /**
     * Get current model info
     * @returns {Object|null}
     */
    getModelInfo() {
        if (!this.currentModel) return null;
        return {
            id: this.currentModel,
            name: this.currentModel.replace(/-MLC$/, '').replace(/-/g, ' ')
        };
    }

    // ==================== Embedding Model ====================

    /**
     * Load an embedding model
     * @param {string} modelId
     */
    async loadEmbeddingModel(modelId) {
        if (this.isLoadingEmbed) {
            throw new Error('Already loading an embedding model');
        }

        if (this.currentEmbedModel === modelId && this.embedEngine) {
            return; // Model already loaded
        }

        await this.initLibrary();

        this.isLoadingEmbed = true;
        state.isEmbedModelLoading = true;

        events.emit(EVENTS.EMBED_MODEL_LOADING, { modelId, progress: 0 });

        try {
            // Unload existing embedding model
            if (this.embedEngine) {
                await this.unloadEmbeddingModel();
            }

            // Create new embedding engine
            this.embedEngine = await this.webllm.CreateMLCEngine(modelId, {
                initProgressCallback: (report) => {
                    const progress = report.progress || 0;
                    events.emit(EVENTS.EMBED_MODEL_LOADING, {
                        modelId,
                        progress,
                        text: report.text
                    });
                }
            });

            this.currentEmbedModel = modelId;
            state.currentEmbedModel = modelId;
            state.isEmbedModelLoading = false;

            events.emit(EVENTS.EMBED_MODEL_LOADED, { modelId });
        } catch (error) {
            console.error('Failed to load embedding model:', error);
            state.isEmbedModelLoading = false;
            events.emit(EVENTS.EMBED_MODEL_ERROR, { modelId, error: error.message });
            throw error;
        } finally {
            this.isLoadingEmbed = false;
        }
    }

    /**
     * Unload the embedding model
     */
    async unloadEmbeddingModel() {
        if (this.embedEngine) {
            try {
                await this.embedEngine.unload();
            } catch (e) {
                // Ignore unload errors
            }
            this.embedEngine = null;
            this.currentEmbedModel = null;
            state.currentEmbedModel = null;
        }
    }

    /**
     * Check if embedding model is ready
     * @returns {boolean}
     */
    isEmbeddingReady() {
        return this.embedEngine !== null && !this.isLoadingEmbed;
    }

    /**
     * Generate embeddings for text(s)
     * @param {string|string[]} input - Text or array of texts
     * @returns {Promise<number[][]>} - Array of embedding vectors
     */
    async generateEmbedding(input) {
        if (!this.embedEngine) {
            throw new Error('No embedding model loaded');
        }

        const texts = Array.isArray(input) ? input : [input];

        const response = await this.embedEngine.embeddings.create({
            input: texts,
            model: this.currentEmbedModel
        });

        // Return array of embedding vectors
        return response.data.map(d => d.embedding);
    }

    /**
     * Get current embedding model info
     * @returns {Object|null}
     */
    getEmbedModelInfo() {
        if (!this.currentEmbedModel) return null;
        return {
            id: this.currentEmbedModel,
            name: this.currentEmbedModel.replace(/-MLC$/, '').replace(/-/g, ' ')
        };
    }
}

// Singleton instance
export const webllm = new WebLLMService();
