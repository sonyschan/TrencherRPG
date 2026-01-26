/**
 * Generate PWA icons from SVG
 * Run with: node scripts/generate-icons.js
 *
 * Requires: npm install sharp
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '../public/icons');

// Create a simple gradient icon with crossed swords shape
function createIconSVG(size) {
  const r = size * 0.2;  // border radius
  const cx = size / 2;
  const cy = size / 2;
  const s = size * 0.35; // sword length from center

  // Two crossed swords using paths
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${r}" fill="url(#grad1)"/>
  <!-- Crossed swords icon -->
  <g transform="translate(${cx}, ${cy})" stroke="white" stroke-width="${size * 0.04}" stroke-linecap="round" fill="none">
    <!-- Sword 1 (top-left to bottom-right) -->
    <line x1="${-s}" y1="${-s}" x2="${s}" y2="${s}"/>
    <line x1="${-s * 0.9}" y1="${-s * 0.6}" x2="${-s * 0.6}" y2="${-s * 0.9}"/>
    <circle cx="${s * 0.7}" cy="${s * 0.7}" r="${size * 0.06}" fill="white"/>
    <!-- Sword 2 (top-right to bottom-left) -->
    <line x1="${s}" y1="${-s}" x2="${-s}" y2="${s}"/>
    <line x1="${s * 0.9}" y1="${-s * 0.6}" x2="${s * 0.6}" y2="${-s * 0.9}"/>
    <circle cx="${-s * 0.7}" cy="${s * 0.7}" r="${size * 0.06}" fill="white"/>
  </g>
</svg>`;
}

async function generateIcons() {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (const size of sizes) {
    const svg = Buffer.from(createIconSVG(size));
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`Generated: icon-${size}x${size}.png`);
  }

  // Generate Apple Touch Icon (180x180)
  const appleSvg = Buffer.from(createIconSVG(180));
  await sharp(appleSvg)
    .resize(180, 180)
    .png()
    .toFile(path.join(outputDir, 'apple-touch-icon.png'));
  console.log('Generated: apple-touch-icon.png');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch(console.error);
