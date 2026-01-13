/**
 * HTTP response utilities
 */

/**
 * Send JSON response
 * @param {http.ServerResponse} res
 * @param {number} status - HTTP status code
 * @param {Object} data - Response data
 */
export function json(res, status, data) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}
