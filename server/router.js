import { cors } from './middleware/cors.js';
import { parseJson } from './middleware/json.js';
import { authRoutes } from './routes/auth.js';
import { userRoutes } from './routes/users.js';
import { chatRoutes } from './routes/chats.js';
import { documentRoutes } from './routes/documents.js';
import { syncRoutes } from './routes/sync.js';

/**
 * Simple router for API requests
 */
export async function handleApiRequest(req, res) {
    // CORS
    if (cors(req, res)) return;

    // Parse JSON body
    try {
        req.body = await parseJson(req);
    } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
        return;
    }

    // Parse URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    const method = req.method;

    // Route matching helper
    const match = (pattern, handler) => {
        // Convert /api/users/:id to regex
        const regexPattern = pattern
            .replace(/:[^/]+/g, '([^/]+)')
            .replace(/\//g, '\\/');
        const regex = new RegExp(`^${regexPattern}$`);
        const matches = path.match(regex);

        if (matches) {
            // Extract params
            const paramNames = (pattern.match(/:[^/]+/g) || []).map(p => p.slice(1));
            const params = {};
            paramNames.forEach((name, i) => {
                params[name] = matches[i + 1];
            });
            req.params = params;
            req.query = Object.fromEntries(url.searchParams);
            return handler;
        }
        return null;
    };

    // Define routes
    const routes = [
        // Auth routes
        { method: 'POST', pattern: '/api/auth/register', handler: authRoutes.register },
        { method: 'POST', pattern: '/api/auth/login', handler: authRoutes.login },
        { method: 'POST', pattern: '/api/auth/refresh', handler: authRoutes.refresh },
        { method: 'GET', pattern: '/api/auth/me', handler: authRoutes.me },

        // User routes (admin)
        { method: 'GET', pattern: '/api/users', handler: userRoutes.list },
        { method: 'GET', pattern: '/api/users/:id', handler: userRoutes.get },
        { method: 'PATCH', pattern: '/api/users/:id', handler: userRoutes.update },
        { method: 'DELETE', pattern: '/api/users/:id', handler: userRoutes.delete },

        // Chat routes
        { method: 'GET', pattern: '/api/chats', handler: chatRoutes.list },
        { method: 'POST', pattern: '/api/chats', handler: chatRoutes.create },
        { method: 'GET', pattern: '/api/chats/:id', handler: chatRoutes.get },
        { method: 'PATCH', pattern: '/api/chats/:id', handler: chatRoutes.update },
        { method: 'DELETE', pattern: '/api/chats/:id', handler: chatRoutes.delete },
        { method: 'GET', pattern: '/api/chats/:id/messages', handler: chatRoutes.getMessages },
        { method: 'POST', pattern: '/api/chats/:id/messages', handler: chatRoutes.createMessage },

        // Document routes
        { method: 'GET', pattern: '/api/documents', handler: documentRoutes.list },
        { method: 'POST', pattern: '/api/documents', handler: documentRoutes.create },
        { method: 'GET', pattern: '/api/documents/:id', handler: documentRoutes.get },
        { method: 'PATCH', pattern: '/api/documents/:id', handler: documentRoutes.update },
        { method: 'DELETE', pattern: '/api/documents/:id', handler: documentRoutes.delete },

        // Sync routes
        { method: 'POST', pattern: '/api/sync/pull', handler: syncRoutes.pull },
        { method: 'POST', pattern: '/api/sync/push', handler: syncRoutes.push },
    ];

    // Find matching route
    for (const route of routes) {
        if (route.method === method) {
            const handler = match(route.pattern, route.handler);
            if (handler) {
                try {
                    await handler(req, res);
                } catch (e) {
                    console.error('Route error:', e);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: 'Internal server error' }));
                    }
                }
                return;
            }
        }
    }

    // No route matched
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
}
