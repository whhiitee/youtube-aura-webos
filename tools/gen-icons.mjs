/**
 * Draws YouTube Aura's artwork: the launcher icon, the large icon, the
 * background preview and the splash screen, plus the small mark the options
 * panel shows. Pure Node (zlib + CRC32, no image library), so the artwork is
 * reproducible and reviewable as code: run `node tools/gen-icons.mjs` and the
 * PNGs in assets/ and src/ui/icons/ are rewritten.
 *
 * The design is one shape, the Aura mark: a white play triangle inside a ring
 * of soft light on true black. Nothing here is expensive to draw at runtime:
 * these are static PNGs the TV decodes once.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The palette: OLED black, the Aura accent, and white for the mark itself.
const BLACK = [4, 5, 6];
const ACCENT = [138, 180, 248];
const WHITE = [255, 255, 255];

/** A PNG from 8-bit RGB pixels (`rgb` is width*height*3 bytes). */
function encodePng(width, height, rgb) {
  // Filter type 0 (none) in front of every scanline.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = deflateSync(raw, { level: 9 });

  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0, 0);
    return Buffer.concat([length, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

let crcTable = null;
/** The CRC32 of `buf` (the PNG chunk checksum). */
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
  return crc ^ -1;
}

/** How far `p` is inside the triangle with the given centre and half-size. */
function inTriangle(x, y, cx, cy, size) {
  // An equilateral triangle pointing right, its centroid on (cx, cy) so the eye
  // reads it as centred (a triangle centred on its bounding box sits left).
  const w = size;
  const h = size * 1.1;
  // The centroid sits a third of the way from the base, and the base is
  // w/2 left of the centre: that puts the centroid on (cx, cy) exactly.
  const dx = (x - cx + w / 2) / w;
  const dy = (y - cy) / h;
  // Base at -0.5, tip at 1.0, half-height 0.85 at the base.
  if (dx < -0.5 || dx > 1.0) return false;
  const t = (dx + 0.5) / 1.5;
  return Math.abs(dy) <= 0.85 * (1 - t);
}

/**
 * Draws the Aura mark on a `width` x `height` canvas: true black, one accent
 * ring, and the white play triangle in the middle. `scale` sizes the mark
 * relative to the shorter side.
 *
 * Flat, with a 2x2 supersampled edge: no halo, no gradient. On an OLED panel
 * the ring is the light and the black is the absence of it, and a flat mark is
 * also what compresses: large runs of one colour deflate to almost nothing,
 * where a soft glow made a 1920x1080 splash 50 KiB.
 */
function drawMark(width, height, scale) {
  const rgb = Buffer.alloc(width * height * 3);
  const cx = width / 2;
  const cy = height / 2;
  const unit = Math.min(width, height) * scale;
  const ringRadius = unit * 0.6;
  const ringWidth = Math.max(1, unit * 0.024);
  const triSize = unit * 0.23;

  const samples = [
    [-0.25, -0.25],
    [0.25, -0.25],
    [-0.25, 0.25],
    [0.25, 0.25]
  ];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let s = 0; s < samples.length; s++) {
        const px = x + 0.5 + samples[s][0];
        const py = y + 0.5 + samples[s][1];
        const dx = px - cx;
        const dy = py - cy;
        const inTriangleNow = inTriangle(px, py, cx, cy, triSize);
        const inRing =
          !inTriangleNow && Math.abs(Math.sqrt(dx * dx + dy * dy) - ringRadius) <= ringWidth;
        let tone = BLACK;
        if (inTriangleNow) tone = WHITE;
        else if (inRing) tone = ACCENT;
        r += tone[0];
        g += tone[1];
        b += tone[2];
      }
      const i = (y * width + x) * 3;
      rgb[i] = Math.round(r / samples.length);
      rgb[i + 1] = Math.round(g / samples.length);
      rgb[i + 2] = Math.round(b / samples.length);
    }
  }
  return rgb;
}

/** Writes one PNG, reporting its size. */
function write(relative, width, height, scale) {
  const file = resolve(root, relative);
  const png = encodePng(width, height, drawMark(width, height, scale));
  writeFileSync(file, png);
  console.log(`${relative}  ${width}x${height}  ${(png.length / 1024).toFixed(1)} KiB`);
}

// The launcher: the icon at 400x400 and the wide largeIcon the launcher draws.
write('assets/aura-icon.png', 400, 400, 0.62);
write('assets/aura-large-icon.png', 1152, 648, 0.42);
// The app's background preview and splash.
write('assets/aura-preview.png', 1920, 1080, 0.24);
write('assets/aura-splash.png', 1920, 1080, 0.24);
// The mark in the options panel heading.
write('src/ui/icons/aura-mark.png', 96, 96, 0.62);
