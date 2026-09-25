import { PDFDocument, degrees, PageSizes } from 'pdf-lib'
import JSZip from 'jszip'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy } from 'pdfjs-dist'

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type PdfSource = {
  id: string
  file: File
  bytes: Uint8Array
  pages: number
}

export type PageEntry = {
  id: string
  sourceId: string
  pageIndex: number
  rotation: number
}

export type ImageEntry = { id: string; file: File; rotation: number }

const documentCache = new Map<string, Promise<PDFDocumentProxy>>()

export async function openPdf(file: File): Promise<PdfSource> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const id = crypto.randomUUID()
  const source = { id, file, bytes, pages: 0 }
  try {
    const document = await getPdfDocument(source)
    source.pages = document.numPages
    return source
  } catch (error) {
    documentCache.delete(id)
    if (error instanceof Error && error.name === 'PasswordException')
      throw new Error(
        'This PDF is password protected. Unlock it with the correct password before opening it here.',
      )
    throw error
  }
}

export function getPdfDocument(source: PdfSource): Promise<PDFDocumentProxy> {
  let promise = documentCache.get(source.id)
  if (!promise) {
    const assetBase = typeof window === 'undefined' ? null : `${import.meta.env.BASE_URL}pdfjs/`
    promise = getDocument({
      data: source.bytes.slice(),
      useSystemFonts: true,
      ...(assetBase
        ? {
            cMapUrl: `${assetBase}cmaps/`,
            iccUrl: `${assetBase}iccs/`,
            standardFontDataUrl: `${assetBase}standard_fonts/`,
            wasmUrl: `${assetBase}wasm/`,
          }
        : {}),
    }).promise
    documentCache.set(source.id, promise)
  }
  return promise
}

export function forgetPdf(sourceId: string) {
  const promise = documentCache.get(sourceId)
  documentCache.delete(sourceId)
  void promise?.then((doc) => doc.cleanup()).catch(() => undefined)
}

export async function renderPage(
  source: PdfSource,
  pageIndex: number,
  width: number,
  rotation = 0,
): Promise<HTMLCanvasElement> {
  const doc = await getPdfDocument(source)
  const page = await doc.getPage(pageIndex + 1)
  const natural = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 })
  const scale = width / natural.width
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 })
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width * pixelRatio)
  canvas.height = Math.round(viewport.height * pixelRatio)
  canvas.style.width = `${Math.round(viewport.width)}px`
  canvas.style.height = `${Math.round(viewport.height)}px`
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable in this browser.')
  await page.render({
    canvas,
    canvasContext: context,
    viewport,
    transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
  }).promise
  return canvas
}

export async function assemblePdf(entries: PageEntry[], sources: PdfSource[]): Promise<Uint8Array> {
  if (!entries.length) throw new Error('Select at least one page.')
  const output = await PDFDocument.create()
  const loaded = new Map<string, PDFDocument>()
  for (const entry of entries) {
    const source = sources.find((item) => item.id === entry.sourceId)
    if (!source) throw new Error('A source document is missing.')
    let input = loaded.get(source.id)
    if (!input) {
      input = await PDFDocument.load(source.bytes)
      loaded.set(source.id, input)
    }
    const [page] = await output.copyPages(input, [entry.pageIndex])
    if (entry.rotation) page.setRotation(degrees((page.getRotation().angle + entry.rotation) % 360))
    output.addPage(page)
  }
  return output.save()
}

export function parsePageRanges(value: string, pageCount: number): number[][] {
  const groups = value
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  if (!groups.length) throw new Error('Enter at least one page range.')
  return groups.map((group) => {
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(group)
    if (!match) throw new Error(`Invalid range: ${group}`)
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    if (start < 1 || end > pageCount || end < start)
      throw new Error(`Range outside document: ${group}`)
    return Array.from({ length: end - start + 1 }, (_, i) => start + i - 1)
  })
}

export async function createSplitZip(
  groups: PageEntry[][],
  sources: PdfSource[],
  baseName: string,
): Promise<Blob> {
  const zip = new JSZip()
  for (let i = 0; i < groups.length; i++) {
    const bytes = await assemblePdf(groups[i], sources)
    zip.file(`${baseName}_part_${String(i + 1).padStart(2, '0')}.pdf`, bytes)
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

export async function imagesToPdf(
  images: ImageEntry[],
  options: { size: 'fit' | 'a4' | 'letter'; landscape: boolean; margin: number },
): Promise<Uint8Array> {
  if (!images.length) throw new Error('Add at least one JPG image.')
  const output = await PDFDocument.create()
  for (const image of images) {
    const data = new Uint8Array(await image.file.arrayBuffer())
    const embedded = await output.embedJpg(data)
    const turn = image.rotation % 360
    const rotated = turn === 90 || turn === 270
    const contentWidth = rotated ? embedded.height : embedded.width
    const contentHeight = rotated ? embedded.width : embedded.height
    let pageSize: [number, number]
    if (options.size === 'fit')
      pageSize = [contentWidth + options.margin * 2, contentHeight + options.margin * 2]
    else {
      const raw = options.size === 'a4' ? PageSizes.A4 : PageSizes.Letter
      pageSize = options.landscape ? [raw[1], raw[0]] : [raw[0], raw[1]]
    }
    const page = output.addPage(pageSize)
    const scale = Math.min(
      (pageSize[0] - options.margin * 2) / contentWidth,
      (pageSize[1] - options.margin * 2) / contentHeight,
    )
    const w = embedded.width * scale
    const h = embedded.height * scale
    const x = (pageSize[0] - contentWidth * scale) / 2
    const y = (pageSize[1] - contentHeight * scale) / 2
    if (turn === 90)
      page.drawImage(embedded, { x: x + h, y, width: w, height: h, rotate: degrees(90) })
    else if (turn === 180)
      page.drawImage(embedded, { x: x + w, y: y + h, width: w, height: h, rotate: degrees(180) })
    else if (turn === 270)
      page.drawImage(embedded, { x, y: y + w, width: w, height: h, rotate: degrees(270) })
    else page.drawImage(embedded, { x, y, width: w, height: h })
  }
  return output.save()
}

export async function pdfToJpgZip(
  source: PdfSource,
  dpi: number,
  onProgress?: (done: number, total: number) => void,
): Promise<Blob> {
  const doc = await getPdfDocument(source)
  const zip = new JSZip()
  const base = source.file.name.replace(/\.pdf$/i, '')
  for (let i = 0; i < doc.numPages; i++) {
    const page = await doc.getPage(i + 1)
    const viewport = page.getViewport({ scale: dpi / 72 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable in this browser.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('Image export failed.'))),
        'image/jpeg',
        0.92,
      ),
    )
    zip.file(`${base}_page_${String(i + 1).padStart(3, '0')}.jpg`, blob)
    onProgress?.(i + 1, doc.numPages)
    canvas.width = 0
    canvas.height = 0
  }
  return zip.generateAsync({ type: 'blob', compression: 'STORE' })
}
