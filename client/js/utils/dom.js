/**
 * DOM utility functions
 */

/**
 * Query selector shorthand
 * @param {string} selector - CSS selector
 * @param {Element} parent - Parent element (defaults to document)
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
    return parent.querySelector(selector);
}

/**
 * Create an element with attributes and children
 * @param {string} tag - HTML tag name
 * @param {Object} attrs - Attributes object
 * @param {...(string|Element)} children - Child elements or text
 * @returns {Element}
 */
export function createElement(tag, attrs = {}, ...children) {
    const element = document.createElement(tag);

    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'dataset') {
            Object.assign(element.dataset, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            const event = key.slice(2).toLowerCase();
            element.addEventListener(event, value);
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else {
            element.setAttribute(key, value);
        }
    }

    for (const child of children) {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Element) {
            element.appendChild(child);
        }
    }

    return element;
}

/**
 * Shorthand for createElement
 */
export const el = createElement;

/**
 * Remove all children from an element
 * @param {Element} element
 */
export function clearChildren(element) {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text
 * @returns {string}
 */
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Parse a markdown table into HTML
 * @param {string} tableText - Lines of table markdown
 * @returns {string} HTML table
 */
function parseTable(tableText) {
    const lines = tableText.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return tableText;

    const parseRow = (line) => {
        return line.split('|')
            .map(cell => cell.trim())
            .filter((cell, i, arr) => i > 0 && i < arr.length - 1); // Remove empty first/last from | borders
    };

    const headerCells = parseRow(lines[0]);

    // Check if second line is separator (| --- | --- |)
    const isSeparator = /^\|?\s*[-:]+\s*\|/.test(lines[1]);
    if (!isSeparator) return tableText;

    let html = '<table><thead><tr>';
    for (const cell of headerCells) {
        html += `<th>${cell}</th>`;
    }
    html += '</tr></thead><tbody>';

    // Parse body rows (skip header and separator)
    for (let i = 2; i < lines.length; i++) {
        const cells = parseRow(lines[i]);
        html += '<tr>';
        for (const cell of cells) {
            html += `<td>${cell}</td>`;
        }
        html += '</tr>';
    }

    html += '</tbody></table>';
    return html;
}

/**
 * Parse simple markdown to HTML
 * Supports: **bold**, *italic*, `code`, ```code blocks```, tables
 * @param {string} text
 * @returns {string}
 */
export function parseMarkdown(text) {
    // Escape HTML first
    let html = escapeHtml(text);

    // Code blocks (must be first to prevent other parsing inside)
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // Tables (before other inline parsing)
    // Match consecutive lines starting with |
    html = html.replace(/((?:^\|.+\|$\n?)+)/gm, (match) => {
        return parseTable(match);
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks (but not inside pre/code or tables)
    // Simple approach: convert double newlines to paragraphs
    html = html.split(/\n\n+/).map(p => {
        if (p.startsWith('<pre>') || p.startsWith('<table>')) return p;
        return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    }).join('');

    return html;
}

/**
 * Auto-resize textarea based on content
 * @param {HTMLTextAreaElement} textarea
 */
export function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}
