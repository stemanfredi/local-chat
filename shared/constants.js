// Database
export const DB_NAME = 'local-chat';
export const DB_VERSION = 1;

// Sync status
export const SYNC_STATUS = {
    LOCAL: 'local',
    SYNCED: 'synced',
    PENDING: 'pending'
};

// Message roles
export const MESSAGE_ROLES = {
    USER: 'user',
    ASSISTANT: 'assistant',
    SYSTEM: 'system'
};

// Default models
export const DEFAULT_INFERENCE_MODEL = 'Llama-3.2-3B-Instruct-q4f16_1-MLC';
export const DEFAULT_EMBEDDING_MODEL = 'snowflake-arctic-embed-m-v1.5-q0f32-MLC';

// Sync modes
export const SYNC_MODES = {
    PURE_OFFLINE: 'pure-offline',
    OFFLINE_FIRST: 'offline-first'
};

// Settings keys
export const SETTINGS_KEYS = {
    SYNC_MODE: 'syncMode',
    INFERENCE_MODEL: 'inferenceModel',
    EMBEDDING_MODEL: 'embeddingModel',
    TOKEN: 'token',
    USER: 'user'
};
