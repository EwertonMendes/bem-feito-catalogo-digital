import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const catalog = JSON.parse(readFileSync('public/data/catalog.json', 'utf8'));
const dist = 'dist/bem-feito-essencia-viva/browser';
const all = new Set(catalog.formats.map(format => format.id));
let verified = 0;

function validateWebP(relativePath, alphaExpected) {
  assert.match(relativePath, /^assets\/[\w/-]+\.webp$/, 'Invalid public asset path');
  const asset = path.join('public', relativePath);
  const deployed = path.join(dist, relativePath);
  assert.equal(statSync(asset).size, statSync(deployed).size, 'Build changed or omitted asset: ' + relativePath);
  const buf = readFileSync(deployed);
  assert.ok(buf.length >= 1000, 'Truncated asset: ' + relativePath);
  assert.equal(buf.toString('ascii', 0, 4), 'RIFF', 'Invalid RIFF header: ' + relativePath);
  assert.equal(buf.toString('ascii', 8, 12), 'WEBP', 'Invalid WebP header: ' + relativePath);
  assert.equal(buf.readUInt32LE(4) + 8, buf.length, 'RIFF size mismatch: ' + relativePath);
  if (alphaExpected) {
    assert.equal(buf.toString('ascii', 12, 16), 'VP8X', 'Missing extended WebP header: ' + relativePath);
    assert.ok((buf[20] & 0x10) !== 0, 'Foreground must have transparency: ' + relativePath);
  }
  verified++;
}

for (const fragrance of catalog.fragrances) {
  const scene = fragrance.sceneLayers;
  if (!scene) continue;

  assert.ok(fragrance.availableFormats.length > 0, 'Layered fragrance must have formats');
  assert.deepEqual(
    [...Object.keys(scene.products)].sort(),
    [...fragrance.availableFormats].sort(),
    'Every available format must have its own transparent hero artwork'
  );
  for (const format of fragrance.availableFormats) {
    assert.ok(all.has(format), 'Unknown format referenced by fragrance: ' + format);
    validateWebP(scene.products[format], true);
  }
  validateWebP(scene.desktopBackground, false);
  validateWebP(scene.mobileBackground, false);
  for (const value of Object.values(scene.foreground ?? {})) {
    validateWebP(value, true);
  }
}

assert.ok(verified >= 13, 'Expected complete layered artwork');
console.log('Layered scene validated: ' + verified + ' real WebP assets included in production build.');
