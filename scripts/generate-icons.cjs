#!/usr/bin/env node
/**
 * Generate PWA icons from SVG
 * Run: node scripts/generate-icons.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '../client/assets/icons');

// Simple chat bubble icon as SVG
const createIconSvg = (size, maskable = false) => {
    const padding = maskable ? size * 0.1 : 0;
    const innerSize = size - padding * 2;
    const cx = size / 2;
    const cy = size / 2;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#1a1a1a"/>
    <g transform="translate(${padding}, ${padding})">
        <rect x="${innerSize * 0.15}" y="${innerSize * 0.2}"
              width="${innerSize * 0.7}" height="${innerSize * 0.5}"
              rx="${innerSize * 0.08}"
              fill="#64748b"/>
        <polygon points="${innerSize * 0.3},${innerSize * 0.7} ${innerSize * 0.25},${innerSize * 0.85} ${innerSize * 0.45},${innerSize * 0.7}"
                 fill="#64748b"/>
        <circle cx="${innerSize * 0.35}" cy="${innerSize * 0.45}" r="${innerSize * 0.05}" fill="#1a1a1a"/>
        <circle cx="${innerSize * 0.5}" cy="${innerSize * 0.45}" r="${innerSize * 0.05}" fill="#1a1a1a"/>
        <circle cx="${innerSize * 0.65}" cy="${innerSize * 0.45}" r="${innerSize * 0.05}" fill="#1a1a1a"/>
    </g>
</svg>`;
};

async function generateIcons() {
    // Ensure directory exists
    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, { recursive: true });
    }

    const sizes = [
        { size: 192, name: 'icon-192.png', maskable: false },
        { size: 512, name: 'icon-512.png', maskable: false },
        { size: 512, name: 'icon-maskable-512.png', maskable: true }
    ];

    for (const { size, name, maskable } of sizes) {
        const svg = createIconSvg(size, maskable);
        const outputPath = path.join(ICONS_DIR, name);

        await sharp(Buffer.from(svg))
            .png()
            .toFile(outputPath);

        console.log(`Generated: ${name}`);
    }

    console.log('Done! Icons saved to client/assets/icons/');
}

generateIcons().catch(console.error);
