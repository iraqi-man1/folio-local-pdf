import { useRef, type PointerEvent, type ReactNode } from 'react'
import type { CropRect } from '@/lib/annotation-service'
import { clampCrop, minimumCropSize, updateCropRect, type CropHandle } from '@/lib/crop-geometry'

type Drag = { handle: CropHandle; startX: number; startY: number; rect: CropRect }

export function CropSelection({ rect, onChange, children, language }: {
  rect: CropRect
  onChange: (next: CropRect) => void
  children: ReactNode
  language: 'ar' | 'en'
}) {
  const drag = useRef<Drag | null>(null)
  const coordinate = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: clampCrop((event.clientX - box.left) / Math.max(box.width, 1), 0, 1), y: clampCrop((event.clientY - box.top) / Math.max(box.height, 1), 0, 1) }
  }
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    const at = coordinate(event)
    const target = event.target as HTMLElement
    const handle = target.closest<HTMLElement>('[data-crop-handle]')?.dataset.cropHandle as CropHandle | undefined
    const fullPage = rect.x === 0 && rect.y === 0 && rect.width === 1 && rect.height === 1
    const action = handle ?? (!fullPage && target.closest('.crop-selection') ? 'move' : 'new')
    const start = action === 'new' ? { x: at.x, y: at.y, width: minimumCropSize, height: minimumCropSize } : rect
    drag.current = { handle: action, startX: at.x, startY: at.y, rect: start }
    if (action === 'new') onChange(start)
    event.currentTarget.setPointerCapture(event.pointerId)
    event.preventDefault()
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const at = coordinate(event)
    const { handle, startX, startY, rect: start } = drag.current
    onChange(updateCropRect(start, handle, at.x - startX, at.y - startY))
  }
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    drag.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  return (
    <div className="crop-canvas">
      {children}
      <div className="crop-interaction" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd}>
        <div className="crop-selection" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%` }}>
          <span className="crop-selection-label">{language === 'ar' ? 'المساحة التي ستبقى' : 'Area to keep'}</span>
          {(['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as CropHandle[]).map((handle) => <span key={handle} className={`crop-handle crop-handle-${handle}`} data-crop-handle={handle} />)}
        </div>
      </div>
    </div>
  )
}
