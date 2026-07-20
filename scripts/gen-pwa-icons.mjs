// Temporary placeholder PWA icon generator — composites the existing brand
// mark (public/favicon.svg) onto a solid square background at the standard
// PWA icon sizes. Replace with real logo-derived icons once one is supplied;
// this file and the sharp devDependency can be deleted once that's done.
import sharp from 'sharp'
import { readFileSync } from 'fs'

const BG = '#07191E' // matches manifest.theme_color / background_color in vite.config.js
const svg = readFileSync('public/favicon.svg', 'utf-8')

async function makeIcon(size, outPath, padding = 0.28) {
  const markSize = Math.round(size * (1 - padding * 2))
  const markBuffer = await sharp(Buffer.from(svg)).resize(markSize, markSize, { fit: 'contain' }).png().toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: markBuffer, gravity: 'center' }])
    .png()
    .toFile(outPath)

  console.log(`Wrote ${outPath} (${size}x${size})`)
}

await makeIcon(192, 'public/pwa-192x192.png')
await makeIcon(512, 'public/pwa-512x512.png')
// A maskable icon needs more padding (safe zone) since OS icon shapes crop it.
await makeIcon(512, 'public/pwa-maskable-512x512.png', 0.35)
