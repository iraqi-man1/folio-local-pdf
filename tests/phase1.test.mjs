import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import JSZip from 'jszip'
import jpeg from 'jpeg-js'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import { assemblePdf, createSplitZip, parsePageRanges, openPdf, getPdfDocument, forgetPdf, imagesToPdf } from '../src/lib/pdf-service.ts'

GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

async function sample(name, count) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < count; i++) {
    const page = pdf.addPage([400, 600])
    page.drawText(`${name} page ${i + 1}`, { x: 40, y: 550, font, size: 20 })
  }
  const bytes = await pdf.save()
  return { id: crypto.randomUUID(), bytes, file: new File([bytes], `${name}.pdf`, { type: 'application/pdf' }), pages: count }
}

test('page range parsing validates boundaries and independent groups', () => {
  assert.deepEqual(parsePageRanges('1-3, 5, 8-9', 10), [[0, 1, 2], [4], [7, 8]])
  assert.throws(() => parsePageRanges('4-2', 10), /outside/)
  assert.throws(() => parsePageRanges('11', 10), /outside/)
  assert.throws(() => parsePageRanges('x', 10), /Invalid/)
})

test('PDF.js opens a local PDF without a URL request', async () => {
  const source = await sample('viewer', 3)
  const opened = await openPdf(source.file)
  assert.equal(opened.pages, 3)
  const doc = await getPdfDocument(opened)
  assert.equal(doc.numPages, 3)
  forgetPdf(opened.id)
})

test('assembly preserves page order, duplication and rotation across PDFs', async () => {
  const first = await sample('first', 3)
  const second = await sample('second', 2)
  const entries = [
    { id: 'a', sourceId: second.id, pageIndex: 1, rotation: 90 },
    { id: 'b', sourceId: first.id, pageIndex: 0, rotation: 0 },
    { id: 'c', sourceId: first.id, pageIndex: 0, rotation: 180 },
  ]
  const output = await PDFDocument.load(await assemblePdf(entries, [first, second]))
  assert.equal(output.getPageCount(), 3)
  assert.deepEqual(output.getPages().map((page) => page.getRotation().angle), [90, 0, 180])
  assert.deepEqual(output.getPages().map((page) => page.getSize()), [{ width: 400, height: 600 }, { width: 400, height: 600 }, { width: 400, height: 600 }])
})

test('split archive has a valid PDF for each group', async () => {
  const source = await sample('split', 5)
  const pages = Array.from({ length: 5 }, (_, pageIndex) => ({ id: `${pageIndex}`, sourceId: source.id, pageIndex, rotation: 0 }))
  const archive = await createSplitZip([pages.slice(0, 2), pages.slice(2)], [source], 'split')
  const zip = await JSZip.loadAsync(archive)
  const names = Object.keys(zip.files)
  assert.deepEqual(names, ['split_part_01.pdf', 'split_part_02.pdf'])
  const counts = await Promise.all(names.map(async (name) => (await PDFDocument.load(await zip.file(name).async('uint8array'))).getPageCount()))
  assert.deepEqual(counts, [2, 3])
})

test('100-page assembly remains structurally valid', async () => {
  const source = await sample('large', 100)
  const pages = Array.from({ length: 100 }, (_, pageIndex) => ({ id: `${pageIndex}`, sourceId: source.id, pageIndex, rotation: 0 }))
  const output = await PDFDocument.load(await assemblePdf(pages, [source]))
  assert.equal(output.getPageCount(), 100)
})

test('Arabic text PDF can be opened and reorganized', async (context) => {
  if (process.platform !== 'win32') { context.skip('Windows font fixture'); return }
  const fontBytes = await readFile('C:/Windows/Fonts/arial.ttf')
  const document = await PDFDocument.create()
  document.registerFontkit(fontkit)
  const font = await document.embedFont(fontBytes)
  document.addPage([400, 600]).drawText('مرحبا بالعالم', { x: 35, y: 500, font, size: 25 })
  const bytes = await document.save()
  const source = await openPdf(new File([bytes], 'arabic.pdf', { type: 'application/pdf' }))
  assert.equal(source.pages, 1)
  const output = await PDFDocument.load(await assemblePdf([{ id: 'ar', sourceId: source.id, pageIndex: 0, rotation: 90 }], [source]))
  assert.equal(output.getPage(0).getRotation().angle, 90)
  forgetPdf(source.id)
})

test('image-only scanned PDF page remains intact after extraction', async () => {
  const document = await PDFDocument.create()
  const png = await document.embedPng(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=', 'base64'))
  document.addPage([400, 600]).drawImage(png, { x: 0, y: 0, width: 400, height: 600 })
  const bytes = await document.save()
  const source = await openPdf(new File([bytes], 'scan.pdf', { type: 'application/pdf' }))
  const output = await PDFDocument.load(await assemblePdf([{ id: 'scan', sourceId: source.id, pageIndex: 0, rotation: 0 }], [source]))
  assert.equal(output.getPageCount(), 1)
  assert.ok(output.getPage(0).node.Contents())
  forgetPdf(source.id)
})

test('JPG images become ordered A4 PDF pages with rotation', async () => {
  const pixels = Buffer.alloc(40 * 20 * 4, 255)
  const jpg = jpeg.encode({ data: pixels, width: 40, height: 20 }, 90).data
  const first = new File([jpg], 'first.jpg', { type: 'image/jpeg' })
  const second = new File([jpg], 'second.jpg', { type: 'image/jpeg' })
  const output = await PDFDocument.load(await imagesToPdf([{ id: 'one', file: first, rotation: 90 }, { id: 'two', file: second, rotation: 0 }], { size: 'a4', landscape: false, margin: 20 }))
  assert.equal(output.getPageCount(), 2)
  assert.ok(Math.abs(output.getPage(0).getWidth() - 595.28) < 1)
  assert.ok(Math.abs(output.getPage(0).getHeight() - 841.89) < 1)
})

test('password protected PDF receives a clear unsupported message', async () => {
  const bytes = await readFile(new URL('./fixtures/protected.pdf', import.meta.url))
  await assert.rejects(openPdf(new File([bytes], 'protected.pdf', { type: 'application/pdf' })), /password protected/i)
})
