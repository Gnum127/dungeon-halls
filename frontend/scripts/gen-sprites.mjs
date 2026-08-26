#!/usr/bin/env node
/**
 * Generates placeholder 64×64 PNG sprites for all registered tile types
 * and object kinds. Run with: node scripts/gen-sprites.mjs
 *
 * Creates files in public/sprites/tiles/ and public/sprites/objects/.
 * Each PNG is a solid-color 64×64 image (pixel-art friendly).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SPRITES_DIR = join(__dirname, '..', 'public', 'sprites')

const TILE_COLORS = {
  floor: [0x8a, 0x7f, 0x66],
  grass: [0x3f, 0x6d, 0x3a],
  water: [0x2f, 0x5f, 0x8a],
  stone: [0x6e, 0x6e, 0x78],
  sand: [0xc9, 0xb4, 0x76],
  wall: [0x3c, 0x35, 0x50],
}

const OBJECT_COLORS = {
  door: [0xb0, 0x76, 0x2f],
  stairs: [0x7a, 0x7f, 0x8c],
  table: [0x8a, 0x5a, 0x2b],
  chair: [0x6b, 0x44, 0x23],
  chest: [0x9c, 0x6b, 0x30],
  barrel: [0x7a, 0x5a, 0x2b],
  torch: [0xe0, 0x8a, 0x2d],
  bush: [0x2d, 0x6b, 0x2d],
  rock: [0x6e, 0x6e, 0x78],
}

const SIZE = 64

function makePNG(r, g, b) {
  // IHDR
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(SIZE, 0)
  ihdrData.writeUInt32BE(SIZE, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 2 // color type: RGB
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace

  // Image data: filter byte (0) + RGB pixels per row
  const rowBytes = 1 + SIZE * 3
  const rawData = Buffer.alloc(SIZE * rowBytes)
  for (let y = 0; y < SIZE; y++) {
    const offset = y * rowBytes
    rawData[offset] = 0 // no filter
    for (let x = 0; x < SIZE; x++) {
      const px = offset + 1 + x * 3
      rawData[px] = r
      rawData[px + 1] = g
      rawData[px + 2] = b
    }
  }

  const compressed = deflateSync(rawData)

  function chunk(type, data) {
    const buf = Buffer.alloc(4 + 4 + data.length + 4)
    buf.writeUInt32BE(data.length, 0)
    buf.write(type, 4)
    data.copy(buf, 8)
    // CRC32 over type + data
    const crc = crc32(Buffer.concat([Buffer.from(type), data]))
    buf.writeInt32BE(crc, 8 + data.length)
    return buf
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdrData),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Minimal CRC32
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = c ^ buf[i]
    for (let j = 0; j < 8; j++) {
      c = c >>> 1 ^ (c & 1 ? 0xedb88320 : 0)
    }
  }
  return (c ^ 0xffffffff) | 0
}

mkdirSync(join(SPRITES_DIR, 'tiles'), { recursive: true })
mkdirSync(join(SPRITES_DIR, 'objects'), { recursive: true })

for (const [name, [r, g, b]] of Object.entries(TILE_COLORS)) {
  const path = join(SPRITES_DIR, 'tiles', `${name}.png`)
  writeFileSync(path, makePNG(r, g, b))
  console.log(`  tiles/${name}.png`)
}

for (const [name, [r, g, b]] of Object.entries(OBJECT_COLORS)) {
  const path = join(SPRITES_DIR, 'objects', `${name}.png`)
  writeFileSync(path, makePNG(r, g, b))
  console.log(`  objects/${name}.png`)
}

console.log(`\nGenerated ${Object.keys(TILE_COLORS).length + Object.keys(OBJECT_COLORS).length} sprite files.`)
