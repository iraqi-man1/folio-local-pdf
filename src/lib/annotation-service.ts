import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export type StampPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

export type CropRect = { x: number; y: number; width: number; height: number }

export function cropMarginsFromVisualRect(rect: CropRect, rotation: number) {
  const { x, y, width, height } = rect
  if ([x, y, width, height].some((value) => !Number.isFinite(value)) ||
      x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001)
    throw new Error('Crop area must stay inside the page.')
  const turn = ((rotation % 360) + 360) % 360
  if (turn === 90) return { left: y, top: 1 - x - width, right: 1 - y - height, bottom: x }
  if (turn === 180) return { left: 1 - x - width, top: 1 - y - height, right: x, bottom: y }
  if (turn === 270) return { left: 1 - y - height, top: x, right: y, bottom: 1 - x - width }
  if (turn === 0) return { left: x, top: y, right: 1 - x - width, bottom: 1 - y - height }
  throw new Error('Crop preview supports pages rotated in 90° steps.')
}

export async function cropPdfByRect(input: Uint8Array, rect: CropRect) {
  const pdf = await PDFDocument.load(input)
  for (const page of pdf.getPages()) {
    const box = page.getCropBox()
    const margins = cropMarginsFromVisualRect(rect, page.getRotation().angle)
    const left = box.width * margins.left
    const bottom = box.height * margins.bottom
    const width = box.width * (1 - margins.left - margins.right)
    const height = box.height * (1 - margins.top - margins.bottom)
    if (width < 1 || height < 1) throw new Error('Crop area leaves no visible page area.')
    page.setCropBox(box.x + left, box.y + bottom, width, height)
  }
  return pdf.save()
}

async function textFont(
  pdf: PDFDocument,
  value: string,
  arabicFont?: Uint8Array,
): Promise<PDFFont> {
  if (/[\u0600-\u08ff]/.test(value)) {
    const fontBytes =
      arabicFont ??
      new Uint8Array(
        await (
          await fetch(`${import.meta.env.BASE_URL}fonts/cairo-arabic-400-normal.woff`)
        ).arrayBuffer(),
      )
    pdf.registerFontkit(fontkit)
    return pdf.embedFont(fontBytes, { subset: true })
  }
  return pdf.embedFont(StandardFonts.Helvetica)
}

function coordinates(
  page: PDFPage,
  width: number,
  height: number,
  position: StampPosition,
  margin: number,
) {
  const box = page.getCropBox()
  const x = position.endsWith('left')
    ? box.x + margin
    : position.endsWith('right')
      ? box.x + box.width - margin - width
      : box.x + (box.width - width) / 2
  const y = position.startsWith('top')
    ? box.y + box.height - margin - height
    : position.startsWith('bottom')
      ? box.y + margin
      : box.y + (box.height - height) / 2
  return { x, y }
}

export async function watermarkPdf(
  input: Uint8Array,
  options: {
    text: string
    size: number
    opacity: number
    position: StampPosition
    angle: number
    margin: number
  },
  arabicFont?: Uint8Array,
) {
  const value = options.text.trim()
  if (!value) throw new Error('Enter watermark text.')
  if (options.size < 6 || options.size > 200 || options.opacity < 0.05 || options.opacity > 1)
    throw new Error('Invalid watermark settings.')
  const pdf = await PDFDocument.load(input)
  const font = await textFont(pdf, value, arabicFont)
  const width = font.widthOfTextAtSize(value, options.size)
  for (const page of pdf.getPages()) {
    const at = coordinates(page, width, options.size, options.position, options.margin)
    page.drawText(value, {
      ...at,
      font,
      size: options.size,
      rotate: degrees(options.angle),
      opacity: options.opacity,
      color: rgb(0.28, 0.34, 0.43),
    })
  }
  return pdf.save()
}

export async function imageWatermarkPdf(
  input: Uint8Array,
  imageBytes: Uint8Array,
  mime: 'image/png' | 'image/jpeg',
  options: { width: number; opacity: number; position: StampPosition; margin: number },
) {
  if (options.width < 10 || options.width > 1000 || options.opacity < 0.05 || options.opacity > 1)
    throw new Error('Invalid image watermark settings.')
  const pdf = await PDFDocument.load(input)
  const image =
    mime === 'image/png' ? await pdf.embedPng(imageBytes) : await pdf.embedJpg(imageBytes)
  const height = (options.width * image.height) / image.width
  for (const page of pdf.getPages())
    page.drawImage(image, {
      ...coordinates(page, options.width, height, options.position, options.margin),
      width: options.width,
      height,
      opacity: options.opacity,
    })
  return pdf.save()
}

export async function numberPagesPdf(
  input: Uint8Array,
  options: { start: number; prefix: string; position: StampPosition; size: number; margin: number },
  arabicFont?: Uint8Array,
) {
  if (
    !Number.isInteger(options.start) ||
    options.start < 0 ||
    options.size < 6 ||
    options.size > 72
  )
    throw new Error('Invalid page numbering settings.')
  const pdf = await PDFDocument.load(input)
  const font = await textFont(pdf, options.prefix, arabicFont)
  pdf.getPages().forEach((page, index) => {
    const value = `${options.prefix}${options.start + index}`
    const width = font.widthOfTextAtSize(value, options.size)
    page.drawText(value, {
      ...coordinates(page, width, options.size, options.position, options.margin),
      font,
      size: options.size,
      color: rgb(0.2, 0.24, 0.3),
    })
  })
  return pdf.save()
}

export async function cropPdf(
  input: Uint8Array,
  margins: { top: number; right: number; bottom: number; left: number },
) {
  const values = Object.values(margins)
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1000))
    throw new Error('Crop margins must be from 0 to 1000 pt.')
  const pdf = await PDFDocument.load(input)
  for (const page of pdf.getPages()) {
    const box = page.getCropBox()
    const width = box.width - margins.left - margins.right
    const height = box.height - margins.top - margins.bottom
    if (width < 1 || height < 1) throw new Error('Crop margins leave no visible page area.')
    page.setCropBox(box.x + margins.left, box.y + margins.bottom, width, height)
  }
  return pdf.save()
}

export type PdfMetadata = { title: string; author: string; subject: string; keywords: string }

export async function readMetadata(input: Uint8Array): Promise<PdfMetadata> {
  const pdf = await PDFDocument.load(input, { updateMetadata: false })
  return {
    title: pdf.getTitle() || '',
    author: pdf.getAuthor() || '',
    subject: pdf.getSubject() || '',
    keywords: pdf.getKeywords() || '',
  }
}

export async function editMetadataPdf(input: Uint8Array, data: PdfMetadata) {
  const pdf = await PDFDocument.load(input, { updateMetadata: false })
  pdf.setTitle(data.title)
  pdf.setAuthor(data.author)
  pdf.setSubject(data.subject)
  pdf.setKeywords(
    data.keywords
      .split(/[,;]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  )
  return pdf.save()
}
