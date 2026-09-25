import { cp, mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
await mkdir(new URL('../public/pdfjs/', import.meta.url), { recursive: true })
for (const name of ['cmaps', 'iccs', 'standard_fonts', 'wasm']) {
  await cp(
    new URL(`../node_modules/pdfjs-dist/${name}/`, import.meta.url),
    new URL(`../public/pdfjs/${name}/`, import.meta.url),
    { recursive: true, force: true },
  )
}
console.log(`Copied local PDF.js assets into ${root}public/pdfjs`)

await mkdir(new URL('../public/qpdf/', import.meta.url), { recursive: true })
for (const [name, source] of [
  ['worker.js', 'src/worker.js'],
  ['qpdf.js', 'vendor/qpdf/lib/qpdf.js'],
  ['qpdf.wasm', 'vendor/qpdf/lib/qpdf.wasm'],
]) {
  await copyFile(
    new URL(`../node_modules/qpdf-run/${source}`, import.meta.url),
    new URL(`../public/qpdf/${name}`, import.meta.url),
  )
}
await mkdir(new URL('../public/fonts/', import.meta.url), { recursive: true })
await copyFile(
  new URL('../node_modules/@fontsource/cairo/files/cairo-arabic-400-normal.woff', import.meta.url),
  new URL('../public/fonts/cairo-arabic-400-normal.woff', import.meta.url),
)

await mkdir(new URL('../public/licenses/', import.meta.url), { recursive: true })
for (const [name, source] of [
  ['pdfjs.txt', 'pdfjs-dist/LICENSE'],
  ['pdf-lib.txt', 'pdf-lib/LICENSE.md'],
  ['jszip.txt', 'jszip/LICENSE.markdown'],
  ['react.txt', 'react/LICENSE'],
  ['lucide.txt', 'lucide-react/LICENSE'],
  ['base-ui.txt', '@base-ui/react/LICENSE'],
  ['shadcn.txt', 'shadcn/LICENSE.md'],
  ['cairo.txt', '@fontsource/cairo/LICENSE'],
  ['geist.txt', '@fontsource-variable/geist/LICENSE'],
  ['tailwind.txt', 'tailwindcss/LICENSE'],
  ['qpdf-run.txt', 'qpdf-run/LICENSE'],
  ['pako.txt', 'pako/LICENSE'],
]) {
  await copyFile(
    new URL(`../node_modules/${source}`, import.meta.url),
    new URL(`../public/licenses/${name}`, import.meta.url),
  )
}
for (const name of ['qpdf-license.txt', 'qpdf-notice.md'])
  await copyFile(
    new URL(`../licenses/${name}`, import.meta.url),
    new URL(`../public/licenses/${name}`, import.meta.url),
  )
