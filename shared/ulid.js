// ULID implementation for both client and server
// Based on the ULID spec: https://github.com/ulid/spec

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

function randomChar() {
    const rand = Math.floor(Math.random() * ENCODING_LEN);
    return ENCODING[rand];
}

function encodeTime(now, len) {
    let str = '';
    for (let i = len; i > 0; i--) {
        const mod = now % ENCODING_LEN;
        str = ENCODING[mod] + str;
        now = Math.floor(now / ENCODING_LEN);
    }
    return str;
}

function encodeRandom(len) {
    let str = '';
    for (let i = 0; i < len; i++) {
        str += randomChar();
    }
    return str;
}

/**
 * Generate a new ULID
 * @param {number} [seedTime] - Optional timestamp to use (defaults to Date.now())
 * @returns {string} A new ULID string
 */
export function ulid(seedTime) {
    const time = seedTime !== undefined ? seedTime : Date.now();
    return encodeTime(time, TIME_LEN) + encodeRandom(RANDOM_LEN);
}

/**
 * Extract the timestamp from a ULID
 * @param {string} id - The ULID string
 * @returns {number} The timestamp in milliseconds
 */
export function decodeTime(id) {
    if (id.length !== 26) {
        throw new Error('Invalid ULID');
    }
    const timeStr = id.substring(0, TIME_LEN);
    let time = 0;
    for (let i = 0; i < timeStr.length; i++) {
        const charIndex = ENCODING.indexOf(timeStr[i]);
        if (charIndex === -1) {
            throw new Error('Invalid ULID character');
        }
        time = time * ENCODING_LEN + charIndex;
    }
    return time;
}

/**
 * Check if a string is a valid ULID
 * @param {string} id - The string to check
 * @returns {boolean} True if valid ULID
 */
export function isValid(id) {
    if (typeof id !== 'string' || id.length !== 26) {
        return false;
    }
    for (let i = 0; i < id.length; i++) {
        if (ENCODING.indexOf(id[i]) === -1) {
            return false;
        }
    }
    return true;
}
