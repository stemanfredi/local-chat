import { db } from '../db/index.js';
import { state } from '../state.js';
import { events, EVENTS } from '../utils/events.js';
import { webllm } from './webllm.js';
import { rag } from './rag.js';

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

        // Use unpkg CDN - more reliable for pdf.js
        this.pdfjs = await import('https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.min.mjs');
        this.pdfjs.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';
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

        // pdfjs-dist exports getDocument directly
        const getDocument = this.pdfjs.getDocument || this.pdfjs.default?.getDocument;
        if (!getDocument) {
            throw new Error('Failed to load pdf.js: getDocument not found');
        }

        const pdf = await getDocument({ data: arrayBuffer }).promise;

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
     * @param {boolean} generateEmbedding - Generate embedding if model is loaded
     * @returns {Promise<Object>}
     */
    async uploadDocument(file, generateEmbedding = true) {
        events.emit(EVENTS.DOCUMENT_UPLOADING, { name: file.name });

        try {
            const { name, type, content } = await this.parseFile(file);

            if (!content || content.trim().length === 0) {
                throw new Error('No content could be extracted from file');
            }

            const doc = await db.createDocument({
                name,
                type,
                content
            });

            events.emit(EVENTS.DOCUMENT_UPLOADED, doc);

            // Generate embedding if model is loaded
            if (generateEmbedding && webllm.isEmbeddingReady()) {
                try {
                    await rag.embedDocument(doc.id);
                } catch (error) {
                    // Don't fail upload if embedding fails
                }
            }

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
