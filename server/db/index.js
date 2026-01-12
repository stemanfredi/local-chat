import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
const DATA_DIR = process.env.DB_PATH
    ? dirname(process.env.DB_PATH)
    : join(__dirname, '..', '..', 'data');

try {
    mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
    // Directory may already exist
}

const DB_PATH = process.env.DB_PATH || join(DATA_DIR, 'local-chat.db');

// Initialize database
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

console.log(`Database initialized at ${DB_PATH}`);

export { db };

// User queries
export const userQueries = {
    create: db.prepare(`
        INSERT INTO users (id, username, password_hash, is_admin, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `),

    findByUsername: db.prepare(`
        SELECT * FROM users WHERE username = ?
    `),

    findById: db.prepare(`
        SELECT * FROM users WHERE id = ?
    `),

    getAll: db.prepare(`
        SELECT id, username, is_admin, created_at, updated_at FROM users
        ORDER BY created_at DESC
    `),

    count: db.prepare(`
        SELECT COUNT(*) as count FROM users
    `),

    update: db.prepare(`
        UPDATE users SET username = ?, is_admin = ?, updated_at = ? WHERE id = ?
    `),

    delete: db.prepare(`
        DELETE FROM users WHERE id = ?
    `)
};

// Chat queries
export const chatQueries = {
    create: db.prepare(`
        INSERT INTO chats (id, user_id, title, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?)
    `),

    findById: db.prepare(`
        SELECT * FROM chats WHERE id = ? AND deleted_at IS NULL
    `),

    findByUser: db.prepare(`
        SELECT * FROM chats WHERE user_id = ? AND deleted_at IS NULL
        ORDER BY updated_at DESC
    `),

    update: db.prepare(`
        UPDATE chats SET title = ?, updated_at = ? WHERE id = ?
    `),

    softDelete: db.prepare(`
        UPDATE chats SET deleted_at = ?, updated_at = ? WHERE id = ?
    `),

    findUpdatedSince: db.prepare(`
        SELECT * FROM chats WHERE user_id = ? AND updated_at > ?
    `)
};

// Message queries
export const messageQueries = {
    create: db.prepare(`
        INSERT INTO messages (id, chat_id, role, content, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `),

    findByChat: db.prepare(`
        SELECT * FROM messages WHERE chat_id = ? AND deleted_at IS NULL
        ORDER BY created_at ASC
    `),

    update: db.prepare(`
        UPDATE messages SET content = ?, updated_at = ? WHERE id = ?
    `),

    softDelete: db.prepare(`
        UPDATE messages SET deleted_at = ?, updated_at = ? WHERE id = ?
    `),

    findUpdatedSince: db.prepare(`
        SELECT m.* FROM messages m
        JOIN chats c ON m.chat_id = c.id
        WHERE c.user_id = ? AND m.updated_at > ?
    `)
};

// Document queries
export const documentQueries = {
    create: db.prepare(`
        INSERT INTO documents (id, user_id, name, type, content, embedding, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `),

    findByUser: db.prepare(`
        SELECT id, user_id, name, type, created_at, updated_at FROM documents
        WHERE user_id = ? AND deleted_at IS NULL
        ORDER BY updated_at DESC
    `),

    findById: db.prepare(`
        SELECT * FROM documents WHERE id = ? AND deleted_at IS NULL
    `),

    update: db.prepare(`
        UPDATE documents SET name = ?, content = ?, embedding = ?, updated_at = ? WHERE id = ?
    `),

    softDelete: db.prepare(`
        UPDATE documents SET deleted_at = ?, updated_at = ? WHERE id = ?
    `),

    findUpdatedSince: db.prepare(`
        SELECT * FROM documents WHERE user_id = ? AND updated_at > ?
    `)
};
