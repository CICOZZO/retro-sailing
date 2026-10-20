// Gera os ícones do jogo (veleiro em pixel art, paleta CGA 0) em icons/.
// Uso: node tools/make-icons.mjs
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';

const OUT = new URL('../icons/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const PAL = { '.': [0, 0, 0], B: [170, 85, 0], G: [0, 170, 0], R: [170, 0, 0] };
const GRID = [
  'BBBBBBBBBBBBBBBB',
  'B..............B',
  'B......B.......B',
  'B......BG......B',
  'B......BGG.....B',
  'B......BGGG....B',
  'B......BGGGG...B',
  'B......BGGGGG..B',
  'B......BGGGGGG.B',
  'B......B.......B',
  'B......B.......B',
  'B.RRRRRRRRRRR..B',
  'B..RRRRRRRRR...B',
  'B...RRRRRRR....B',
  'B..............B',
  'BBBBBBBBBBBBBBBB'
];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

function png(size) {
  const n = GRID.length, scale = size / n;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const ch = GRID[Math.min(n - 1, Math.floor(y / scale))][Math.min(n - 1, Math.floor(x / scale))];
      const [r, g, b] = PAL[ch];
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))
  ]);
}

const hex = ([r, g, b]) => '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
let rects = '';
GRID.forEach((row, y) => [...row].forEach((ch, x) => {
  if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${hex(PAL[ch])}"/>`;
}));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges"><rect width="16" height="16" fill="#000"/>${rects}</svg>\n`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'icon.svg'), svg);
for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  fs.writeFileSync(path.join(OUT, name), png(size));
}
console.log('Ícones gerados em', OUT);
