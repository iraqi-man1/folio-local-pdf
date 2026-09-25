import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib'
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import { cropPdfByRect, cropMarginsFromVisualRect } from '../src/lib/annotation-service.ts'
import { movePagesTo } from '../src/lib/page-order.ts'
import { compressionSavings, formatFileSize } from '../src/lib/file-size.ts'
import { createMarkPreview } from '../src/lib/preview-service.ts'
import { updateCropRect } from '../src/lib/crop-geometry.ts'

GlobalWorkerOptions.workerSrc = new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()

async function sample() {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  pdf.addPage([400, 600]).drawText('First page', { x: 30, y: 500, font })
  pdf.addPage([600, 400]).drawText('Second page', { x: 30, y: 300, font })
  pdf.getPage(1).setRotation(degrees(90))
  return pdf.save()
}

test('drag crop maps from the visible page to PDF coordinates at each rotation', async () => {
  const rect = { x: 0.1, y: 0.2, width: 0.6, height: 0.5 }
  assert.deepEqual(cropMarginsFromVisualRect(rect, 0), { left: 0.1, top: 0.2, right: 0.30000000000000004, bottom: 0.30000000000000004 })
  assert.deepEqual(cropMarginsFromVisualRect(rect, 90), { left: 0.2, top: 0.30000000000000004, right: 0.30000000000000004, bottom: 0.1 })
  assert.deepEqual(cropMarginsFromVisualRect(rect, 180), { left: 0.30000000000000004, top: 0.30000000000000004, right: 0.1, bottom: 0.2 })
  assert.deepEqual(cropMarginsFromVisualRect(rect, 270), { left: 0.30000000000000004, top: 0.1, right: 0.2, bottom: 0.30000000000000004 })
  const bytes = await sample()
  const result = await PDFDocument.load(await cropPdfByRect(bytes, rect))
  const first = result.getPage(0).getCropBox()
  const second = result.getPage(1).getCropBox()
  assert.ok(Math.abs(first.x - 40) < 0.001 && Math.abs(first.y - 180) < 0.001 && Math.abs(first.width - 240) < 0.001 && Math.abs(first.height - 300) < 0.001)
  assert.ok(Math.abs(second.x - 120) < 0.001 && Math.abs(second.y - 40) < 0.001 && Math.abs(second.width - 300) < 0.001 && Math.abs(second.height - 240) < 0.001)
  assert.deepEqual(result.getPage(0).getMediaBox(), { x: 0, y: 0, width: 400, height: 600 })
  await assert.rejects(cropPdfByRect(bytes, { x: 0.8, y: 0, width: 0.3, height: 1 }), /inside/)
})

test('crop frame can be drawn, moved and resized without leaving the page', () => {
  const drawn = updateCropRect({ x: 0.2, y: 0.25, width: 0.03, height: 0.03 }, 'new', 0.5, 0.4)
  assert.ok(Math.abs(drawn.x - 0.2) < 0.001 && Math.abs(drawn.y - 0.25) < 0.001)
  assert.ok(Math.abs(drawn.width - 0.5) < 0.001 && Math.abs(drawn.height - 0.4) < 0.001)
  const moved = updateCropRect(drawn, 'move', 0.5, 0.5)
  assert.ok(moved.x + moved.width <= 1 && moved.y + moved.height <= 1)
  const resized = updateCropRect(drawn, 'nw', 0.1, 0.1)
  assert.ok(resized.x > drawn.x && resized.y > drawn.y)
  assert.ok(resized.width < drawn.width && resized.height < drawn.height)
})

test('selected pages can move directly in a large document while keeping their order', () => {
  const entries = Array.from({ length: 300 }, (_, pageIndex) => ({ id: String(pageIndex + 1), sourceId: 'a', pageIndex, rotation: 0 }))
  const moved = movePagesTo(entries, ['270', '3', '271'], 12)
  assert.deepEqual(moved.slice(11, 14).map((page) => page.id), ['3', '270', '271'])
  assert.equal(moved.length, 300)
  assert.equal(new Set(moved.map((page) => page.id)).size, 300)
  assert.deepEqual(entries.slice(0, 3).map((page) => page.id), ['1', '2', '3'])
  assert.throws(() => movePagesTo(entries, ['1'], 301), /page number/)
})

test('compression result reports saved KB or MB and percentage', () => {
  assert.deepEqual(compressionSavings(2 * 1024 * 1024, 1536 * 1024), { bytes: 512 * 1024, percent: 25 })
  assert.equal(formatFileSize(512 * 1024, 'en'), '512 KB')
  assert.equal(formatFileSize(1536 * 1024, 'ar'), '1.50 ميغابايت')
  assert.deepEqual(compressionSavings(1000, 1100), { bytes: 0, percent: 0 })
})

test('live page number preview reflects the original page index', async () => {
  const bytes = await sample()
  const source = { id: 'source', bytes, pages: 2, file: new File([bytes], 'original.pdf', { type: 'application/pdf' }) }
  const preview = await createMarkPreview(source, 1, { kind: 'numbers', start: 4, prefix: 'No. ', position: 'bottom-center' })
  const loadingTask = getDocument({ data: preview.bytes.slice() })
  const document = await loadingTask.promise
  assert.equal(document.numPages, 1)
  const page = await document.getPage(1)
  const text = (await page.getTextContent()).items.map((item) => item.str).join(' ')
  assert.match(text, /Second page/)
  assert.match(text, /No\. 5/)
  assert.equal((await PDFDocument.load(bytes)).getPageCount(), 2)
  await loadingTask.destroy()
})

test('live watermark preview shows the entered text on the selected page', async () => {
  const bytes = await sample()
  const source = { id: 'source', bytes, pages: 2, file: new File([bytes], 'original.pdf', { type: 'application/pdf' }) }
  const preview = await createMarkPreview(source, 0, { kind: 'text', text: 'DRAFT', size: 48, opacity: 0.5, position: 'center' })
  const loadingTask = getDocument({ data: preview.bytes.slice() })
  const document = await loadingTask.promise
  const page = await document.getPage(1)
  const text = (await page.getTextContent()).items.map((item) => item.str).join(' ')
  assert.match(text, /DRAFT/)
  assert.match(text, /First page/)
  await loadingTask.destroy()
})
