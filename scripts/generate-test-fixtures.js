#!/usr/bin/env node

/**
 * Generate test fixture images for E2E tests
 * Creates a simple PNG image for upload testing
 */

const fs = require("fs");
const path = require("path");

// Simple 100x100 red PNG (minimal valid PNG)
// This is a pre-generated base64 encoded 100x100 solid red PNG
const TEST_IMAGE_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAA" +
  "GklEQVR42u3BAQEAAACC/F8t/9YIAAAAAK4GBQAACAABF18v" +
  "BAAAAABJRU5ErkJggg==";

// Create a more realistic test image - 200x150 with a shape
// This creates a simple valid PNG structure
function createTestPNG() {
  // PNG signature
  const signature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);

  // IHDR chunk (image header)
  const width = 200;
  const height = 150;
  const bitDepth = 8;
  const colorType = 2; // RGB
  const compression = 0;
  const filter = 0;
  const interlace = 0;

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(bitDepth, 8);
  ihdrData.writeUInt8(colorType, 9);
  ihdrData.writeUInt8(compression, 10);
  ihdrData.writeUInt8(filter, 11);
  ihdrData.writeUInt8(interlace, 12);

  const ihdrChunk = createChunk("IHDR", ihdrData);

  // Create raw image data (RGB, with filter byte per row)
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // Filter byte (none)
    for (let x = 0; x < width; x++) {
      // Create a simple gradient/shape pattern
      const inShape = x >= 50 && x <= 150 && y >= 30 && y <= 120;
      if (inShape) {
        // Blue object
        rawData.push(50, 100, 200);
      } else {
        // White background
        rawData.push(245, 245, 245);
      }
    }
  }

  // Use zlib to compress the data
  const zlib = require("zlib");
  const compressedData = zlib.deflateSync(Buffer.from(rawData), { level: 9 });
  const idatChunk = createChunk("IDAT", compressedData);

  // IEND chunk
  const iendChunk = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, "ascii");
  const crcData = Buffer.concat([typeBuffer, data]);
  const crc = calculateCRC(crcData);

  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc >>> 0, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

// CRC32 implementation for PNG
function calculateCRC(data) {
  let crc = 0xffffffff;
  const table = getCRCTable();

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }

  return crc ^ 0xffffffff;
}

let crcTable = null;
function getCRCTable() {
  if (crcTable) return crcTable;

  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c = c >>> 1;
      }
    }
    crcTable[n] = c;
  }
  return crcTable;
}

// Main
const fixturesDir = path.join(__dirname, "..", "e2e", "fixtures");

// Ensure directory exists
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// Generate test image
const pngBuffer = createTestPNG();
const outputPath = path.join(fixturesDir, "test-object.png");
fs.writeFileSync(outputPath, pngBuffer);

console.log(`Created test fixture: ${outputPath}`);
console.log(`Image size: 200x150 pixels`);
console.log(`File size: ${pngBuffer.length} bytes`);
