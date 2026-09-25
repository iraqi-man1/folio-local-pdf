type DirectoryHandle = {
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<{
    createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>
  }>
}

type PickerWindow = Window & { showDirectoryPicker?: () => Promise<DirectoryHandle> }

export async function chooseOutputFolder(): Promise<DirectoryHandle | null> {
  const picker = (window as PickerWindow).showDirectoryPicker
  if (!picker) return null
  return picker()
}

export async function saveLocal(
  blob: Blob,
  requestedName: string,
  folder: DirectoryHandle | null,
  overwrite: boolean,
): Promise<string> {
  const safeName =
    [...requestedName.trim()]
      .map((character) =>
        character.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(character) ? '_' : character,
      )
      .join('') || 'output.pdf'
  if (folder) {
    let name = safeName
    if (!overwrite) {
      const dot = safeName.lastIndexOf('.')
      const stem = dot > 0 ? safeName.slice(0, dot) : safeName
      const extension = dot > 0 ? safeName.slice(dot) : ''
      let suffix = 1
      while (true) {
        try {
          await folder.getFileHandle(name)
          name = `${stem}_${suffix++}${extension}`
        } catch (error) {
          if (error instanceof DOMException && error.name === 'NotFoundError') break
          throw error
        }
      }
    }
    const handle = await folder.getFileHandle(name, { create: true })
    const writer = await handle.createWritable()
    await writer.write(blob)
    await writer.close()
    return name
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = safeName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return safeName
}

export function canChooseFolder() {
  return typeof (window as PickerWindow).showDirectoryPicker === 'function'
}
