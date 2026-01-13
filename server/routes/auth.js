import { userQueries } from '../db/index.js';
import { hashPassword, verifyPassword, generateToken, serializeUser } from '../services/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { validateUser } from '../../shared/validation/user.js';
import { ulid } from '../../shared/ulid.js';
import { json } from '../utils/response.js';

export const authRoutes = {
    /**
     * POST /api/auth/register
     * Register a new user (first user becomes admin)
     */
    async register(req, res) {
        const { username, password } = req.body;

        // Validate input
        const validation = validateUser({ username, password });
        if (!validation.valid) {
            return json(res, 400, { errors: validation.errors });
        }

        // Check if username exists
        const existing = userQueries.findByUsername.get(username);
        if (existing) {
            return json(res, 400, { error: 'Username already taken' });
        }

        // Check if this is the first user (make them admin)
        const { count } = userQueries.count.get();
        const isAdmin = count === 0 ? 1 : 0;

        // Create user
        const now = new Date().toISOString();
        const id = ulid();
        const passwordHash = await hashPassword(password);

        userQueries.create.run(id, username, passwordHash, isAdmin, now, now);

        const user = userQueries.findById.get(id);
        const token = generateToken(user);

        json(res, 201, { user: serializeUser(user), token });
    },

    /**
     * POST /api/auth/login
     * Login and get JWT token
     */
    async login(req, res) {
        const { username, password } = req.body;

        if (!username || !password) {
            return json(res, 400, { error: 'Username and password required' });
        }

        // Find user
        const user = userQueries.findByUsername.get(username);
        if (!user) {
            return json(res, 401, { error: 'Invalid credentials' });
        }

        // Verify password
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return json(res, 401, { error: 'Invalid credentials' });
        }

        // Generate token
        const token = generateToken(user);

        json(res, 200, { user: serializeUser(user), token });
    },

    /**
     * POST /api/auth/refresh
     * Refresh JWT token
     */
    async refresh(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        const token = generateToken(user);

        json(res, 200, { user: serializeUser(user), token });
    },

    /**
     * GET /api/auth/me
     * Get current user info
     */
    async me(req, res) {
        const user = requireAuth(req, res);
        if (!user) return;

        json(res, 200, { user: serializeUser(user) });
    }
};
