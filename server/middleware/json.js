/**
 * JSON body parser middleware
 * @param {http.IncomingMessage} req
 * @returns {Promise<Object>}
 */
export async function parseJson(req) {
    return new Promise((resolve, reject) => {
        // Only parse for methods that have body
        if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
            resolve({});
            return;
        }

        const contentType = req.headers['content-type'] || '';
        if (!contentType.includes('application/json')) {
            resolve({});
            return;
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
            // Limit body size to 10MB
            if (body.length > 10 * 1024 * 1024) {
                reject(new Error('Request body too large'));
            }
        });

        req.on('end', () => {
            try {
                const parsed = body ? JSON.parse(body) : {};
                console.log('Parsed body:', Object.keys(parsed));
                resolve(parsed);
            } catch (e) {
                console.error('JSON parse error:', e.message, 'Body:', body.slice(0, 100));
                reject(new Error('Invalid JSON'));
            }
        });

        req.on('error', reject);
    });
}
