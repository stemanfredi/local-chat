import { verifyToken } from '../services/auth.js';
import { userQueries } from '../db/index.js';

/**
 * Authentication middleware
 * Extracts and verifies JWT from Authorization header
 * Attaches user to request object
 *
 * @param {http.IncomingMessage} req
 * @returns {{ user: Object|null, error: string|null }}
 */
export function authenticate(req) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { user: null, error: 'No token provided' };
    }

    const token = authHeader.slice(7);

    try {
        const payload = verifyToken(token);
        const user = userQueries.findById.get(payload.sub);

        if (!user) {
            return { user: null, error: 'User not found' };
        }

        // Don't include password hash in user object
        const { password_hash, ...safeUser } = user;
        return { user: safeUser, error: null };
    } catch (e) {
        return { user: null, error: 'Invalid token' };
    }
}

/**
 * Require authentication - returns error response if not authenticated
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @returns {Object|null} User object or null if response was sent
 */
export function requireAuth(req, res) {
    const { user, error } = authenticate(req);

    if (!user) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error || 'Unauthorized' }));
        return null;
    }

    return user;
}

/**
 * Require admin role
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @returns {Object|null} User object or null if response was sent
 */
export function requireAdmin(req, res) {
    const user = requireAuth(req, res);
    if (!user) return null;

    if (!user.is_admin) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Admin access required' }));
        return null;
    }

    return user;
}
