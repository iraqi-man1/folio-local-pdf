import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import {
  cropPdf,
  editMetadataPdf,
  imageWatermarkPdf,
  numberPagesPdf,
  readMetadata,
  watermarkPdf,
} from '../src/lib/annotation-service.ts'

async function sample(count = 2) {
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  for (let index = 0; index < count; index++)
    pdf.addPage([400, 600]).drawText(`Original ${index + 1}`, { x: 30, y: 500, font, size: 20 })
  return pdf.save()
}

test('crop updates visible box without changing media box or page count', async () => {
  const input = await sample()
  const output = await PDFDocument.load(
    await cropPdf(input, { top: 10, right: 20, bottom: 30, left: 40 }),
  )
  assert.equal(output.getPageCount(), 2)
  assert.deepEqual(output.getPage(0).getCropBox(), { x: 40, y: 30, width: 340, height: 560 })
  assert.deepEqual(output.getPage(0).getMediaBox(), { x: 0, y: 0, width: 400, height: 600 })
  await assert.rejects(cropPdf(input, { top: 400, right: 0, bottom: 400, left: 0 }), /no visible/)
})

test('English and Arabic text marks leave existing page content in place', async () => {
  const input = await sample()
  const arabicFont = await readFile(
    'node_modules/@fontsource/cairo/files/cairo-arabic-400-normal.woff',
  )
  const marked = await watermarkPdf(
    input,
    { text: 'مسودة', size: 36, opacity: 0.3, position: 'center', angle: 0, margin: 20 },
    arabicFont,
  )
  const numbered = await numberPagesPdf(marked, {
    start: 3,
    prefix: 'Page ',
    position: 'bottom-center',
    size: 12,
    margin: 20,
  })
  const output = await PDFDocument.load(numbered)
  assert.equal(output.getPageCount(), 2)
  for (const page of output.getPages()) assert.ok(page.node.Contents())
})

test('standard metadata editing is readable and original bytes remain unchanged', async () => {
  const input = await sample(1)
  const initial = input.slice()
  const output = await editMetadataPdf(input, {
    title: 'تجربة',
    author: 'Ali',
    subject: 'Test',
    keywords: 'PDF, Arabic',
  })
  assert.deepEqual(await readMetadata(output), {
    title: 'تجربة',
    author: 'Ali',
    subject: 'Test',
    keywords: 'PDF Arabic',
  })
  assert.deepEqual(input, initial)
})

test('PNG watermark embeds on each page', async () => {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=',
    'base64',
  )
  const output = await PDFDocument.load(
    await imageWatermarkPdf(await sample(), png, 'image/png', {
      width: 80,
      opacity: 0.4,
      position: 'top-right',
      margin: 10,
    }),
  )
  assert.equal(output.getPageCount(), 2)
  assert.ok(output.getPage(0).node.Resources())
})
