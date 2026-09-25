import { PDFDocument } from 'pdf-lib'
import { imageWatermarkPdf, numberPagesPdf, watermarkPdf, type StampPosition } from './annotation-service.ts'
import type { PdfSource } from './pdf-service'

export type MarkPreviewSettings =
  | { kind: 'text'; text: string; size: number; opacity: number; position: StampPosition }
  | { kind: 'image'; image: File; width: number; opacity: number; position: StampPosition }
  | { kind: 'numbers'; start: number; prefix: string; position: StampPosition }

export async function createMarkPreview(source: PdfSource, pageIndex: number, settings: MarkPreviewSettings): Promise<PdfSource> {
  const original = await PDFDocument.load(source.bytes)
  const preview = await PDFDocument.create()
  const [page] = await preview.copyPages(original, [pageIndex])
  preview.addPage(page)
  const onePage = await preview.save()
  let bytes: Uint8Array
  if (settings.kind === 'text')
    bytes = await watermarkPdf(onePage, { text: settings.text, size: settings.size, opacity: settings.opacity, position: settings.position, angle: 0, margin: 24 })
  else if (settings.kind === 'image')
    bytes = await imageWatermarkPdf(onePage, new Uint8Array(await settings.image.arrayBuffer()), settings.image.type === 'image/png' ? 'image/png' : 'image/jpeg', { width: settings.width, opacity: settings.opacity, position: settings.position, margin: 24 })
  else
    bytes = await numberPagesPdf(onePage, { start: settings.start + pageIndex, prefix: settings.prefix, position: settings.position, size: 12, margin: 24 })
  const file = new File([new Uint8Array(bytes)], 'preview.pdf', { type: 'application/pdf' })
  return { id: crypto.randomUUID(), file, bytes, pages: 1 }
}
