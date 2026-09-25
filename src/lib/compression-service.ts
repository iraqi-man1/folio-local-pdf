import { PDFDocument } from 'pdf-lib'
import { getPdfDocument, type PdfSource } from './pdf-service'
import { optimizePdf } from './qpdf-service'

export type CompressionOptions =
  { mode: 'lossless'; level: number } | { mode: 'raster'; dpi: number; quality: number }

export async function compressPdf(
  source: PdfSource,
  options: CompressionOptions,
  onProgress?: (done: number, total: number) => void,
) {
  if (options.mode === 'lossless') {
    const result = await optimizePdf(source.bytes, options.level)
    return {
      bytes: result.bytes.length < source.bytes.length ? result.bytes : source.bytes.slice(),
      warnings: result.warnings,
    }
  }
  if (
    !Number.isFinite(options.dpi) ||
    options.dpi < 72 ||
    options.dpi > 300 ||
    options.quality < 0.3 ||
    options.quality > 0.95
  )
    throw new Error('Choose 72–300 DPI and JPEG quality 30–95%.')
  const input = await getPdfDocument(source)
  const output = await PDFDocument.create()
  for (let index = 0; index < input.numPages; index++) {
    const page = await input.getPage(index + 1)
    const viewport = page.getViewport({ scale: options.dpi / 72 })
    if (viewport.width * viewport.height > 45_000_000)
      throw new Error('A rendered page exceeds the 45 MP browser limit. Choose lower DPI.')
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable.')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const jpeg = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error('JPEG encoding failed.'))),
        'image/jpeg',
        options.quality,
      ),
    )
    const image = await output.embedJpg(await jpeg.arrayBuffer())
    const size = page.getViewport({ scale: 1 })
    output
      .addPage([size.width, size.height])
      .drawImage(image, { x: 0, y: 0, width: size.width, height: size.height })
    canvas.width = 0
    canvas.height = 0
    onProgress?.(index + 1, input.numPages)
  }
  const rasterized = await output.save()
  return {
    bytes: rasterized.length < source.bytes.length ? rasterized : source.bytes.slice(),
    warnings: [] as string[],
  }
}
