import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApiRequest } from './router.js';

// Initialize database (runs schema)
import './db/index.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLIENT_DIR = join(__dirname, '..', 'client');
const SHARED_DIR = join(__dirname, '..', 'shared');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// MIME types
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

/**
 * Serve a static file
 */
async function serveStatic(res, filePath) {
    try {
        const stats = await stat(filePath);
        if (!stats.isFile()) {
            return false;
        }

        const ext = extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const content = await readFile(filePath);

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return true;
    } catch {
        return false;
    }
}

/**
 * Handle incoming requests
 */
async function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    let pathname = url.pathname;

    // API routes
    if (pathname.startsWith('/api/')) {
        return handleApiRequest(req, res);
    }

    // Serve shared directory for ES module imports
    if (pathname.startsWith('/shared/')) {
        const filePath = join(SHARED_DIR, pathname.slice(8));
        if (await serveStatic(res, filePath)) return;
    }

    // Serve client files
    if (pathname === '/') {
        pathname = '/index.html';
    }

    const filePath = join(CLIENT_DIR, pathname);
    if (await serveStatic(res, filePath)) return;

    // Fallback to index.html for SPA routing
    const indexPath = join(CLIENT_DIR, 'index.html');
    if (await serveStatic(res, indexPath)) return;

    // 404
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
}

// Create server
const server = createServer(handleRequest);

server.listen(PORT, HOST, () => {
    console.log(`
  Local Chat Server
  -----------------
  Running at: http://${HOST}:${PORT}

  Open in your browser to start chatting!
  Press Ctrl+C to stop.
`);
});
