import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateRawSync} from 'node:zlib';
import './export-standalone.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(path.join(root, 'oquiz.html'), 'utf8');
const marker = '<span>실제 문제 출처 ';
if (!html.includes(marker)) throw new Error('The source footer is missing; cannot add the HTML download link.');
const download = '<a href="./oquiz.html" download="oquiz.html" class="download-html-link" style="color:#6541de;font-weight:700;text-decoration:underline">HTML 다운로드</a>';
await writeFile(path.join(root, 'index.html'), html.replace(marker, download + marker), 'utf8');

// A deterministic ZIP containing just the portable HTML; no external packages.
const filename = Buffer.from('oquiz.html');
const content = Buffer.from(html, 'utf8');
const compressed = deflateRawSync(content);
let crc = 0xffffffff;
for (const byte of content) {
  crc ^= byte;
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
}
crc = (crc ^ 0xffffffff) >>> 0;
const local = Buffer.alloc(30);
local.writeUInt32LE(0x04034b50, 0);
local.writeUInt16LE(20, 4);
local.writeUInt16LE(8, 8); // DEFLATE
local.writeUInt16LE(33, 12); // 1980-01-01, fixed for reproducible builds
local.writeUInt32LE(crc, 14);
local.writeUInt32LE(compressed.length, 18);
local.writeUInt32LE(content.length, 22);
local.writeUInt16LE(filename.length, 26);
const central = Buffer.alloc(46);
central.writeUInt32LE(0x02014b50, 0);
central.writeUInt16LE(20, 4);
central.writeUInt16LE(20, 6);
central.writeUInt16LE(8, 10);
central.writeUInt16LE(33, 14);
central.writeUInt32LE(crc, 16);
central.writeUInt32LE(compressed.length, 20);
central.writeUInt32LE(content.length, 24);
central.writeUInt16LE(filename.length, 28);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(1, 8);
end.writeUInt16LE(1, 10);
end.writeUInt32LE(central.length + filename.length, 12);
end.writeUInt32LE(local.length + filename.length + compressed.length, 16);
await writeFile(path.join(root, 'oquiz-html.zip'), Buffer.concat([local, filename, compressed, central, filename, end]));
console.log('GitHub Pages built: index.html, oquiz.html, oquiz-html.zip');
