import type { PageEntry } from './pdf-service'

export function movePagesTo(entries: PageEntry[], selectedIds: string[], position: number): PageEntry[] {
  if (!Number.isInteger(position) || position < 1 || position > entries.length)
    throw new Error('Choose a page number inside the document.')
  const ids = new Set(selectedIds)
  const moving = entries.filter((entry) => ids.has(entry.id))
  if (!moving.length) return entries
  const rest = entries.filter((entry) => !ids.has(entry.id))
  const index = Math.min(position - 1, rest.length)
  return [...rest.slice(0, index), ...moving, ...rest.slice(index)]
}
