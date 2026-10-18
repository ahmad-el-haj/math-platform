/**
 * Downloads the Google Fonts woff2 files used by the platform and rewrites the
 * @font-face rules to point at the locally hosted copies.
 *
 * Self-hosting matters here: the in-app preview iframe has no network access,
 * and a Cloudflare Pages deployment should not depend on a third-party CDN at
 * runtime. Run with:  node scripts/fetch-fonts.mjs
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const outDir = resolve(root, 'public/fonts')
const cssOut = resolve(outDir, 'fonts.css')

const FAMILIES = [
  'IBM+Plex+Sans+Arabic:wght@300;400;500;600;700',
  'Amiri:wght@400;700',
]

// Only these unicode ranges are bundled: Arabic + Latin. Keeps the payload small.
const KEEP_SUBSETS = ['arabic', 'latin']
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function main() {
  await mkdir(outDir, { recursive: true })

  const url = `https://fonts.googleapis.com/css2?family=${FAMILIES.join('&family=')}&display=swap`
  const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text()

  const blocks = css.split('/*').slice(1)
  const out = []
  let index = 0

  for (const block of blocks) {
    const subset = block.slice(0, block.indexOf('*/')).trim()
    if (!KEEP_SUBSETS.includes(subset)) continue

    const family = /font-family:\s*'([^']+)'/.exec(block)?.[1]
    const weight = /font-weight:\s*(\d+)/.exec(block)?.[1]
    const range = /unicode-range:\s*([^;]+);/.exec(block)?.[1]
    const src = /url\((https:[^)]+)\)/.exec(block)?.[1]
    if (!family || !weight || !src) continue

    const slug = family.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const fileName = `${slug}-${weight}-${subset}.woff2`
    const target = resolve(outDir, fileName)

    const bytes = Buffer.from(await (await fetch(src)).arrayBuffer())
    await writeFile(target, bytes)
    index += 1

    out.push(
      `/* ${family} ${weight} — ${subset} */\n` +
        `@font-face {\n` +
        `  font-family: '${family}';\n` +
        `  font-style: normal;\n` +
        `  font-weight: ${weight};\n` +
        `  font-display: swap;\n` +
        `  src: url('/fonts/${fileName}') format('woff2');\n` +
        (range ? `  unicode-range: ${range};\n` : '') +
        `}\n`,
    )
  }

  await writeFile(cssOut, out.join('\n'), 'utf8')
  console.log(`Downloaded ${index} font files -> public/fonts/fonts.css`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
