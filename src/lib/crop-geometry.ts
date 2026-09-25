import type { CropRect } from './annotation-service'

export type CropHandle = 'move' | 'new' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'
export const minimumCropSize = 0.03
export const clampCrop = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value))

export function updateCropRect(rect: CropRect, handle: CropHandle, dx: number, dy: number): CropRect {
  if (handle === 'move') return {
    ...rect,
    x: clampCrop(rect.x + dx, 0, 1 - rect.width),
    y: clampCrop(rect.y + dy, 0, 1 - rect.height),
  }
  if (handle === 'new') {
    const left = clampCrop(Math.min(rect.x, rect.x + dx), 0, 1 - minimumCropSize)
    const top = clampCrop(Math.min(rect.y, rect.y + dy), 0, 1 - minimumCropSize)
    return {
      x: left,
      y: top,
      width: Math.max(minimumCropSize, clampCrop(Math.max(rect.x, rect.x + dx), left + minimumCropSize, 1) - left),
      height: Math.max(minimumCropSize, clampCrop(Math.max(rect.y, rect.y + dy), top + minimumCropSize, 1) - top),
    }
  }
  let left = rect.x
  let top = rect.y
  let right = rect.x + rect.width
  let bottom = rect.y + rect.height
  if (handle.includes('w')) left = clampCrop(left + dx, 0, right - minimumCropSize)
  if (handle.includes('e')) right = clampCrop(right + dx, left + minimumCropSize, 1)
  if (handle.includes('n')) top = clampCrop(top + dy, 0, bottom - minimumCropSize)
  if (handle.includes('s')) bottom = clampCrop(bottom + dy, top + minimumCropSize, 1)
  return { x: left, y: top, width: right - left, height: bottom - top }
}
