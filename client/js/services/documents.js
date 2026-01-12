import { db } from '../db/index.js';
import { state } from '../state.js';
import { events, EVENTS } from '../utils/events.js';

/**
 * Document parsing and management service
 */
class DocumentService {
    constructor() {
        this.pdfjs = null;
        this.mammoth = null;
    }

    /**
     * Initialize PDF.js library
     */
    async initPdfjs() {
        if (this.pdfjs) return;
        this.pdfjs = await import('https://esm.run/pdfjs-dist@5.4.530/build/pdf.min.mjs');
        this.pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.run/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';
    }

    /**
     * Initialize Mammoth library
     */
    async initMammoth() {
        if (this.mammoth) return;
        this.mammoth = await import('https://esm.run/mammoth@1.11.0');
    }

    /**
     * Parse a file and extract text content
     * @param {File} file
     * @returns {Promise<{name: string, type: string, content: string}>}
     */
    async parseFile(file) {
        const ext = file.name.split('.').pop().toLowerCase();

        let content;
        let type;

        switch (ext) {
            case 'pdf':
                content = await this.parsePdf(file);
                type = 'pdf';
                break;
            case 'docx':
                content = await this.parseDocx(file);
                type = 'docx';
                break;
            case 'txt':
            case 'md':
            case 'json':
            case 'js':
            case 'ts':
            case 'py':
            case 'html':
            case 'css':
                content = await this.parseText(file);
                type = 'text';
                break;
            default:
                throw new Error(`Unsupported file type: ${ext}`);
        }

        return {
            name: file.name,
            type,
            content
        };
    }

    /**
     * Parse PDF file
     * @param {File} file
     * @returns {Promise<string>}
     */
    async parsePdf(file) {
        await this.initPdfjs();

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await this.pdfjs.getDocument({ data: arrayBuffer }).promise;

        const textParts = [];
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            textParts.push(pageText);
        }

        return textParts.join('\n\n');
    }

    /**
     * Parse DOCX file
     * @param {File} file
     * @returns {Promise<string>}
     */
    async parseDocx(file) {
        await this.initMammoth();

        const arrayBuffer = await file.arrayBuffer();
        const result = await this.mammoth.default.extractRawText({ arrayBuffer });
        return result.value;
    }

    /**
     * Parse text file
     * @param {File} file
     * @returns {Promise<string>}
     */
    async parseText(file) {
        return file.text();
    }

    /**
     * Upload and store a document
     * @param {File} file
     * @returns {Promise<Object>}
     */
    async uploadDocument(file) {
        events.emit(EVENTS.DOCUMENT_UPLOADING, { name: file.name });

        try {
            const { name, type, content } = await this.parseFile(file);

            const doc = await db.createDocument({
                name,
                type,
                content
            });

            events.emit(EVENTS.DOCUMENT_UPLOADED, doc);
            return doc;
        } catch (error) {
            events.emit(EVENTS.DOCUMENT_ERROR, { name: file.name, error: error.message });
            throw error;
        }
    }

    /**
     * Get all documents
     * @returns {Promise<Object[]>}
     */
    async getDocuments() {
        return db.getAllDocuments();
    }

    /**
     * Delete a document
     * @param {string} id
     */
    async deleteDocument(id) {
        await db.deleteDocument(id);
        events.emit(EVENTS.DOCUMENT_DELETED, { id });
    }

    /**
     * Get supported file extensions
     * @returns {string[]}
     */
    getSupportedExtensions() {
        return ['pdf', 'docx', 'txt', 'md', 'json', 'js', 'ts', 'py', 'html', 'css'];
    }

    /**
     * Get accept string for file input
     * @returns {string}
     */
    getAcceptString() {
        return '.pdf,.docx,.txt,.md,.json,.js,.ts,.py,.html,.css';
    }
}

export const documentService = new DocumentService();
