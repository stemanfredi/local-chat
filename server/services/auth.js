import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-to-a-random-secret-in-production';
const JWT_EXPIRES_IN = '7d';
const BCRYPT_ROUNDS = 12;

/**
 * Hash a password
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
    return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param {string} password
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

/**
 * Generate a JWT token
 * @param {Object} user
 * @returns {string}
 */
export function generateToken(user) {
    return jwt.sign(
        {
            sub: user.id,
            username: user.username,
            isAdmin: !!user.is_admin
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify a JWT token
 * @param {string} token
 * @returns {Object} Decoded payload
 * @throws {Error} If token is invalid
 */
export function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

/**
 * Decode token without verification (for debugging)
 * @param {string} token
 * @returns {Object|null}
 */
export function decodeToken(token) {
    try {
        return jwt.decode(token);
    } catch {
        return null;
    }
}
