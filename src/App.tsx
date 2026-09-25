import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  FileText,
  FolderOpen,
  GripVertical,
  Languages,
  LayoutGrid,
  Menu,
  Moon,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  ShieldCheck,
  Sun,
  Trash2,
  UploadCloud,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CropSelection } from '@/components/crop-selection'
import { tools, categories, availableIds, type Category, type ToolId } from '@/data/tools'
import { compressPdf } from '@/lib/compression-service'
import {
  cropPdfByRect,
  editMetadataPdf,
  imageWatermarkPdf,
  numberPagesPdf,
  readMetadata,
  watermarkPdf,
  type PdfMetadata,
  type CropRect,
  type StampPosition,
} from '@/lib/annotation-service'
import { createMarkPreview, type MarkPreviewSettings } from '@/lib/preview-service'
import { movePagesTo } from '@/lib/page-order'
import { compressionSavings, formatFileSize } from '@/lib/file-size'
import { cleanMetadataPdf, protectPdf, repairPdf, unlockPdf } from '@/lib/qpdf-service'
import {
  assemblePdf,
  createSplitZip,
  forgetPdf,
  imagesToPdf,
  openPdf,
  parsePageRanges,
  pdfToJpgZip,
  renderPage,
  type ImageEntry,
  type PageEntry,
  type PdfSource,
} from '@/lib/pdf-service'
import { canChooseFolder, chooseOutputFolder, saveLocal } from '@/lib/local-save'
import './App.css'

type View = 'home' | 'tools' | 'recent' | 'workflows' | 'settings'
type Language = 'en' | 'ar'
type Theme = 'light' | 'dark' | 'system'
type RecentItem = { name: string; tool: string; date: string; pages?: number }
type SplitMode = 'ranges' | 'extract' | 'every' | 'every-n' | 'odd' | 'even'
type CompressionResult = { name: string; before: number; after: number }
type CompressionMode = 'lossless' | 'smaller'
const defaultCrop: CropRect = { x: 0, y: 0, width: 1, height: 1 }

const labels = {
  en: {
    home: 'Home',
    tools: 'All Tools',
    recent: 'Recent Files',
    workflows: 'Workflows',
    settings: 'Settings',
    drop: 'Drop files here',
    dropSub: 'PDF and JPG files are processed on this computer.',
    select: 'Select Files',
    folder: 'Select Folder',
    browse: 'Explore all tools',
    search: 'Search tools...',
    private: 'Your files never leave this computer.',
    ready: 'Ready to work',
    upload: 'Add files',
    output: 'Output settings',
    save: 'Create file',
    selected: 'selected',
    pages: 'pages',
    page: 'Page',
    coming: 'Planned',
    phase: 'Phase',
    all: 'All tools',
    noFiles: 'Add a PDF to begin',
    selectPage: 'Select a page to preview it',
    chooseFolder: 'Choose output folder',
    browserDownloads: 'Browser Downloads',
    filename: 'Output filename',
    overwrite: 'Overwrite existing file',
    completed: 'Saved',
    selectTool: 'Choose a tool',
    imageHint: 'JPG and JPEG images',
    pdfHint: 'PDF documents',
  },
  ar: {
    home: 'الرئيسية',
    tools: 'كل الأدوات',
    recent: 'الملفات الأخيرة',
    workflows: 'سير العمل',
    settings: 'الإعدادات',
    drop: 'أفلت الملفات هنا',
    dropSub: 'تُعالَج ملفات PDF وJPG على هذا الكمبيوتر.',
    select: 'اختر ملفات',
    folder: 'اختر مجلداً',
    browse: 'استكشف الأدوات',
    search: 'ابحث عن أداة...',
    private: 'ملفاتك لا تغادر هذا الكمبيوتر.',
    ready: 'جاهز للعمل',
    upload: 'إضافة ملفات',
    output: 'إعدادات الحفظ',
    save: 'إنشاء الملف',
    selected: 'محددة',
    pages: 'صفحات',
    page: 'صفحة',
    coming: 'قريباً',
    phase: 'المرحلة',
    all: 'كل الأدوات',
    noFiles: 'أضف ملف PDF للبدء',
    selectPage: 'اختر صفحة لمعاينتها',
    chooseFolder: 'اختر مجلد الحفظ',
    browserDownloads: 'تنزيلات المتصفح',
    filename: 'اسم الملف الناتج',
    overwrite: 'استبدال ملف موجود',
    completed: 'تم الحفظ',
    selectTool: 'اختر أداة',
    imageHint: 'صور JPG و JPEG',
    pdfHint: 'ملفات PDF',
  },
}

const suffix: Record<ToolId, string> = {
  merge: 'merged',
  split: 'split',
  organize: 'organized',
  remove: 'pages_removed',
  extract: 'extracted',
  duplicate: 'duplicated',
  rotate: 'rotated',
  'jpg-pdf': 'images',
  'pdf-jpg': 'jpg',
  crop: 'cropped',
  compress: 'compressed',
  repair: 'repaired',
  watermark: 'watermarked',
  'page-numbers': 'numbered',
  protect: 'protected',
  unlock: 'unlocked',
  'metadata-clean': 'metadata_clean',
  'metadata-edit': 'metadata_edited',
}
const arabicCategories: Record<Category, string> = {
  Organize: 'تنظيم',
  Optimize: 'تحسين',
  Convert: 'تحويل',
  Edit: 'تحرير',
  Security: 'حماية',
  Scan: 'مسح',
  Forms: 'نماذج',
  Workflows: 'سير العمل',
}
const arabicSplitModes: Record<SplitMode, string> = {
  ranges: 'نطاقات صفحات',
  extract: 'استخراج النطاقات معاً',
  every: 'كل صفحة',
  'every-n': 'كل عدد من الصفحات',
  odd: 'الصفحات الفردية',
  even: 'الصفحات الزوجية',
}

function PageCanvas({
  source,
  pageIndex,
  rotation,
  width,
  className = '',
  lazy = false,
}: {
  source: PdfSource
  pageIndex: number
  rotation: number
  width: number
  className?: string
  lazy?: boolean
}) {
  const host = useRef<HTMLDivElement>(null)
  const [error, setError] = useState(false)
  const [visible, setVisible] = useState(!lazy)
  useEffect(() => {
    if (!lazy || visible || !host.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '250px' },
    )
    observer.observe(host.current)
    return () => observer.disconnect()
  }, [lazy, visible])
  useEffect(() => {
    if (!visible) return
    let active = true
    const target = host.current
    if (target) target.replaceChildren()
    setError(false)
    void renderPage(source, pageIndex, width, rotation)
      .then((canvas) => {
        if (active && target) target.replaceChildren(canvas)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [source, pageIndex, width, rotation, visible])
  return (
    <div ref={host} className={`page-canvas ${className}`}>
      {error && <span>Preview unavailable</span>}
    </div>
  )
}

function ImagePreview({ file, rotation }: { file: File; rotation: number }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const value = URL.createObjectURL(file)
    setUrl(value)
    return () => URL.revokeObjectURL(value)
  }, [file])
  return (
    <div className="image-preview">
      <img src={url} alt={file.name} style={{ transform: `rotate(${rotation}deg)` }} />
    </div>
  )
}

function App() {
  const [view, setView] = useState<View>('home')
  const [tool, setTool] = useState<ToolId | null>(null)
  const [language, setLanguage] = useState<Language>(() =>
    localStorage.getItem('localpdf-language') === 'ar' ? 'ar' : 'en',
  )
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('localpdf-theme') as Theme) || 'light',
  )
  const [prefersDark, setPrefersDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<Category | 'All'>('All')
  const [sources, setSources] = useState<PdfSource[]>([])
  const [pages, setPages] = useState<PageEntry[]>([])
  const [images, setImages] = useState<ImageEntry[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const [notice, setNotice] = useState('')
  const [zoom, setZoom] = useState(1)
  const [outputName, setOutputName] = useState('output.pdf')
  const [outputFolder, setOutputFolder] =
    useState<Awaited<ReturnType<typeof chooseOutputFolder>>>(null)
  const [overwrite, setOverwrite] = useState(false)
  const [splitMode, setSplitMode] = useState<SplitMode>('ranges')
  const [ranges, setRanges] = useState('1')
  const [everyN, setEveryN] = useState(2)
  const [dpi, setDpi] = useState(150)
  const [pageSize, setPageSize] = useState<'fit' | 'a4' | 'letter'>('a4')
  const [landscape, setLandscape] = useState(false)
  const [margin, setMargin] = useState(20)
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null)
  const [compressionMode, setCompressionMode] = useState<CompressionMode>('lossless')
  const [organizePreview, setOrganizePreview] = useState<string | null>(null)
  const [watermarkText, setWatermarkText] = useState('DRAFT')
  const [watermarkKind, setWatermarkKind] = useState<'text' | 'image'>('text')
  const [watermarkImage, setWatermarkImage] = useState<File | null>(null)
  const [watermarkWidth, setWatermarkWidth] = useState(160)
  const [watermarkSize, setWatermarkSize] = useState(48)
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3)
  const [stampPosition, setStampPosition] = useState<StampPosition>('center')
  const [numberPrefix, setNumberPrefix] = useState('')
  const [numberStart, setNumberStart] = useState(1)
  const [cropRect, setCropRect] = useState<CropRect>(defaultCrop)
  const [markPreview, setMarkPreview] = useState<{ source: PdfSource; sourceId: string; pageIndex: number } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [pageJump, setPageJump] = useState('')
  const [moveTarget, setMoveTarget] = useState('')
  const [password, setPassword] = useState('')
  const [metadata, setMetadata] = useState<PdfMetadata>({
    title: '',
    author: '',
    subject: '',
    keywords: '',
  })
  const [recent, setRecent] = useState<RecentItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('localpdf-recent') || '[]')
    } catch {
      return []
    }
  })
  const fileInput = useRef<HTMLInputElement>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const pageRail = useRef<HTMLDivElement>(null)
  const watermarkInput = useRef<HTMLInputElement>(null)
  const history = useRef<PageEntry[][]>([])
  const future = useRef<PageEntry[][]>([])
  const copiedPages = useRef<PageEntry[]>([])
  const t = labels[language]
  const resolvedDark = theme === 'dark' || (theme === 'system' && prefersDark)

  useEffect(() => {
    localStorage.setItem('localpdf-language', language)
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = language
  }, [language])
  useEffect(() => {
    localStorage.setItem('localpdf-theme', theme)
    document.documentElement.classList.toggle('dark', resolvedDark)
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', resolvedDark ? '#111517' : '#f7f9f5')
  }, [theme, resolvedDark])
  useEffect(() => {
    const preference = matchMedia('(prefers-color-scheme: dark)')
    const syncPreference = () => setPrefersDark(preference.matches)
    preference.addEventListener('change', syncPreference)
    return () => preference.removeEventListener('change', syncPreference)
  }, [])
  useEffect(() => {
    localStorage.setItem('localpdf-recent', JSON.stringify(recent))
  }, [recent])

  const currentPage = pages.find((page) => page.id === currentId) || pages[0]
  const currentImage = images.find((image) => image.id === currentId) || images[0]
  const isImageTool = tool === 'jpg-pdf'
  const rawTool = tool === 'unlock' || tool === 'repair'
  const itemCount = rawTool ? sources.length : isImageTool ? images.length : pages.length
  const toolInfo = tools.find((item) => item.id === tool)
  const currentSource = sources.find((source) => source.id === currentPage?.sourceId)
  const previewPage = pages.find((page) => page.id === organizePreview)
  const previewSource = sources.find((source) => source.id === previewPage?.sourceId)

  useEffect(() => () => {
    if (markPreview) forgetPdf(markPreview.source.id)
  }, [markPreview])

  useEffect(() => {
    if ((tool !== 'watermark' && tool !== 'page-numbers') || !currentSource || !currentPage) {
      setMarkPreview(null)
      setPreviewLoading(false)
      setPreviewError('')
      return
    }
    if (tool === 'watermark' && watermarkKind === 'image' && !watermarkImage) {
      setMarkPreview(null)
      setPreviewLoading(false)
      return
    }
    let active = true
    setPreviewLoading(true)
    setPreviewError('')
    const timer = window.setTimeout(() => {
      const settings: MarkPreviewSettings = tool === 'page-numbers'
        ? { kind: 'numbers', start: numberStart, prefix: numberPrefix, position: stampPosition }
        : watermarkKind === 'image'
          ? { kind: 'image', image: watermarkImage!, width: watermarkWidth, opacity: watermarkOpacity, position: stampPosition }
          : { kind: 'text', text: watermarkText, size: watermarkSize, opacity: watermarkOpacity, position: stampPosition }
      void createMarkPreview(currentSource, currentPage.pageIndex, settings)
        .then((source) => {
          if (active) setMarkPreview({ source, sourceId: currentSource.id, pageIndex: currentPage.pageIndex })
        })
        .catch((error) => { if (active) setPreviewError(error instanceof Error ? error.message : 'Preview unavailable.') })
        .finally(() => { if (active) setPreviewLoading(false) })
    }, 180)
    return () => { active = false; window.clearTimeout(timer) }
  }, [tool, currentSource, currentPage, watermarkKind, watermarkImage, watermarkText, watermarkSize, watermarkWidth, watermarkOpacity, stampPosition, numberStart, numberPrefix])

  const commitPages = useCallback(
    (next: PageEntry[]) => {
      history.current.push(pages)
      if (history.current.length > 30) history.current.shift()
      future.current = []
      setPages(next)
    },
    [pages],
  )

  const undo = useCallback(() => {
    const previous = history.current.pop()
    if (previous) {
      future.current.push(pages)
      setPages(previous)
      setSelected([])
      setCurrentId(previous[0]?.id || null)
    }
  }, [pages])
  const redo = useCallback(() => {
    const next = future.current.pop()
    if (next) {
      history.current.push(pages)
      setPages(next)
      setSelected([])
      setCurrentId(next[0]?.id || null)
    }
  }, [pages])

  const startTool = (id: ToolId) => {
    for (const source of sources) forgetPdf(source.id)
    setSources([])
    setPages([])
    setImages([])
    setSelected([])
    setCurrentId(null)
    history.current = []
    future.current = []
    copiedPages.current = []
    setTool(id)
    setView('home')
    setNotice('')
    setProgress('')
    setOutputFolder(null)
    setOverwrite(false)
    setPassword('')
    setMetadata({ title: '', author: '', subject: '', keywords: '' })
    setWatermarkImage(null)
    setStampPosition(id === 'page-numbers' ? 'bottom-center' : 'center')
    setCropRect(defaultCrop)
    setCompressionResult(null)
    setCompressionMode('lossless')
    setOrganizePreview(null)
    setMarkPreview(null)
    setPreviewError('')
    setPageJump('')
    setMoveTarget('')
    setOutputName(id === 'pdf-jpg' || id === 'split' ? 'output.zip' : 'output.pdf')
  }

  const addFiles = async (incoming: File[], targetTool = tool) => {
    if (!incoming.length) return
    const fresh = !targetTool
    let chosen = targetTool
    if (!chosen) {
      chosen = incoming.some((file) => /\.(jpe?g)$/i.test(file.name)) ? 'jpg-pdf' : 'organize'
      startTool(chosen)
    }
    setBusy(true)
    setNotice('')
    setCompressionResult(null)
    if (chosen === 'crop') setCropRect(defaultCrop)
    try {
      if (chosen === 'jpg-pdf') {
        const valid = incoming.filter((file) => /\.(jpe?g)$/i.test(file.name))
        if (!valid.length) throw new Error('Choose JPG or JPEG images.')
        const added = valid.map((file) => ({ id: crypto.randomUUID(), file, rotation: 0 }))
        setImages((old) => [...old, ...added])
        setCurrentId((old) => old || added[0].id)
        if (fresh || images.length === 0)
          setOutputName(`${valid[0].name.replace(/\.[^.]+$/, '')}_images.pdf`)
      } else {
        const valid = incoming.filter((file) => /\.pdf$/i.test(file.name))
        if (!valid.length) throw new Error('Choose PDF documents.')
        const phase2 =
          chosen &&
          [
            'crop',
            'compress',
            'repair',
            'watermark',
            'page-numbers',
            'protect',
            'unlock',
            'metadata-clean',
            'metadata-edit',
          ].includes(chosen)
        const limited =
          chosen === 'split' || chosen === 'pdf-jpg' || phase2 ? valid.slice(0, 1) : valid
        const loaded: PdfSource[] = []
        for (const file of limited) {
          if (chosen === 'unlock' || chosen === 'repair')
            loaded.push({
              id: crypto.randomUUID(),
              file,
              bytes: new Uint8Array(await file.arrayBuffer()),
              pages: 0,
            })
          else loaded.push(await openPdf(file))
        }
        const entries = loaded.flatMap((source) =>
          Array.from({ length: source.pages }, (_, pageIndex) => ({
            id: crypto.randomUUID(),
            sourceId: source.id,
            pageIndex,
            rotation: 0,
          })),
        )
        if (chosen === 'split' || chosen === 'pdf-jpg' || phase2) {
          for (const source of sources) forgetPdf(source.id)
          setSources(loaded)
          setPages(entries)
          history.current = []
          future.current = []
        } else {
          setSources((old) => [...old, ...loaded])
          setPages((old) => [...old, ...entries])
        }
        setCurrentId(
          (old) =>
            (chosen === 'split' || chosen === 'pdf-jpg' || phase2
              ? entries[0]?.id
              : old || entries[0]?.id) || null,
        )
        if (chosen === 'metadata-edit') setMetadata(await readMetadata(loaded[0].bytes))
        if (fresh || sources.length === 0 || chosen === 'split' || chosen === 'pdf-jpg' || phase2)
          setOutputName(
            `${valid[0].name.replace(/\.pdf$/i, '')}_${suffix[chosen]}${chosen === 'split' || chosen === 'pdf-jpg' ? '.zip' : '.pdf'}`,
          )
        setRecent((old) =>
          [
            {
              name: valid[0].name,
              tool: chosen!,
              date: new Date().toISOString(),
              pages: loaded[0].pages,
            },
            ...old,
          ].slice(0, 20),
        )
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not open the file.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files || [])
      if (files.length) {
        event.preventDefault()
        void addFiles(files)
      } else if (
        tool &&
        copiedPages.current.length &&
        !isImageTool &&
        !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault()
        const insertion = pages.findIndex((page) => page.id === currentId) + 1
        commitPages([
          ...pages.slice(0, insertion),
          ...copiedPages.current.map((page) => ({ ...page, id: crypto.randomUUID() })),
          ...pages.slice(insertion),
        ])
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  const pickFiles = () => {
    if (fileInput.current) {
      fileInput.current.accept = isImageTool
        ? '.jpg,.jpeg,image/jpeg'
        : tool
          ? '.pdf,application/pdf'
          : '.pdf,.jpg,.jpeg,application/pdf,image/jpeg'
      fileInput.current.click()
    }
  }
  const selectPage = (id: string, event: React.MouseEvent) => {
    if (event.shiftKey && currentId) {
      const start = pages.findIndex((page) => page.id === currentId)
      const end = pages.findIndex((page) => page.id === id)
      setSelected(
        pages.slice(Math.min(start, end), Math.max(start, end) + 1).map((page) => page.id),
      )
    } else if (event.ctrlKey || event.metaKey)
      setSelected((old) => (old.includes(id) ? old.filter((value) => value !== id) : [...old, id]))
    else setSelected([id])
    setCurrentId(id)
  }
  const scrollPageIntoRail = (id: string) => {
    const rail = pageRail.current
    const tile = rail?.querySelector<HTMLElement>(`[data-entry-id="${id}"]`)
    if (!rail || !tile) return
    const railBox = rail.getBoundingClientRect()
    const tileBox = tile.getBoundingClientRect()
    rail.scrollTo({
      top: rail.scrollTop + tileBox.top - railBox.top - (rail.clientHeight - tile.clientHeight) / 2,
      behavior: 'smooth',
    })
  }
  const jumpToPage = () => {
    const index = Number(pageJump) - 1
    if (!Number.isInteger(index) || index < 0 || index >= pages.length) {
      setNotice(language === 'ar' ? 'اكتب رقم صفحة موجود.' : 'Enter a page number in this document.')
      return
    }
    const id = pages[index].id
    setCurrentId(id)
    setSelected([id])
    setNotice('')
    requestAnimationFrame(() => scrollPageIntoRail(id))
  }
  const moveSelectedToPage = () => {
    const ids = selected.length ? selected : currentId ? [currentId] : []
    try {
      const next = movePagesTo(pages, ids, Number(moveTarget))
      commitPages(next)
      if (ids[0]) setCurrentId(ids[0])
      setNotice('')
      requestAnimationFrame(() => scrollPageIntoRail(ids[0]))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not move pages.')
    }
  }
  const rotateSelected = (angle: number) => {
    if (isImageTool) {
      setImages((old) =>
        old.map((image) =>
          selected.includes(image.id) || (!selected.length && image.id === currentId)
            ? { ...image, rotation: (image.rotation + angle + 360) % 360 }
            : image,
        ),
      )
      return
    }
    const ids = selected.length ? selected : currentId ? [currentId] : []
    commitPages(
      pages.map((page) =>
        ids.includes(page.id) ? { ...page, rotation: (page.rotation + angle + 360) % 360 } : page,
      ),
    )
  }
  const deleteSelected = () => {
    const ids = selected.length ? selected : currentId ? [currentId] : []
    if (isImageTool) {
      const next = images.filter((image) => !ids.includes(image.id))
      setImages(next)
      setCurrentId(next[0]?.id || null)
    } else {
      const next = pages.filter((page) => !ids.includes(page.id))
      commitPages(next)
      setCurrentId(next[0]?.id || null)
    }
    setSelected([])
  }
  const duplicateSelected = () => {
    const ids = selected.length ? selected : currentId ? [currentId] : []
    const next = pages.flatMap((page) =>
      ids.includes(page.id) ? [page, { ...page, id: crypto.randomUUID() }] : [page],
    )
    commitPages(next)
  }
  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return
    if (isImageTool) {
      const next = [...images]
      const from = next.findIndex((item) => item.id === fromId)
      const to = next.findIndex((item) => item.id === toId)
      if (from < 0 || to < 0) return
      next.splice(to, 0, next.splice(from, 1)[0])
      setImages(next)
    } else {
      const next = [...pages]
      const from = next.findIndex((item) => item.id === fromId)
      const to = next.findIndex((item) => item.id === toId)
      if (from < 0 || to < 0) return
      next.splice(to, 0, next.splice(from, 1)[0])
      commitPages(next)
    }
  }
  const moveSource = (id: string, direction: -1 | 1) => {
    const next = [...sources]
    const index = next.findIndex((source) => source.id === id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= next.length) return
    next.splice(target, 0, next.splice(index, 1)[0])
    setSources(next)
    commitPages(next.flatMap((source) => pages.filter((page) => page.sourceId === source.id)))
  }
  const removeSource = (id: string) => {
    forgetPdf(id)
    setSources((old) => old.filter((source) => source.id !== id))
    const next = pages.filter((page) => page.sourceId !== id)
    commitPages(next)
    setSelected((old) => old.filter((pageId) => next.some((page) => page.id === pageId)))
    if (currentPage?.sourceId === id) setCurrentId(next[0]?.id || null)
  }

  const exportFile = async () => {
    if (!tool || !itemCount || busy) return
    setBusy(true)
    setNotice('')
    setProgress('')
    try {
      let blob: Blob
      let name = outputName
      let details = ''
      if (tool === 'jpg-pdf')
        blob = new Blob(
          [new Uint8Array(await imagesToPdf(images, { size: pageSize, landscape, margin }))],
          { type: 'application/pdf' },
        )
      else if (tool === 'pdf-jpg') {
        blob = await pdfToJpgZip(sources[0], dpi, (done, total) =>
          setProgress(`${done} / ${total} pages`),
        )
        if (!name.toLowerCase().endsWith('.zip')) name += '.zip'
      } else if (tool === 'split') {
        const sourcePages = pages
        let groups: PageEntry[][] = []
        if (splitMode === 'ranges' || splitMode === 'extract') {
          const indices = parsePageRanges(ranges, sourcePages.length)
          groups =
            splitMode === 'extract'
              ? [indices.flatMap((group) => group.map((index) => sourcePages[index]))]
              : indices.map((group) => group.map((index) => sourcePages[index]))
        } else if (splitMode === 'every') groups = sourcePages.map((page) => [page])
        else if (splitMode === 'every-n') {
          for (let i = 0; i < sourcePages.length; i += everyN)
            groups.push(sourcePages.slice(i, i + everyN))
        } else
          groups = [
            sourcePages.filter((_, index) => (index + 1) % 2 === (splitMode === 'odd' ? 1 : 0)),
          ]
        groups = groups.filter((group) => group.length)
        if (!groups.length) throw new Error('No pages match this selection.')
        if (groups.length === 1) {
          blob = new Blob([new Uint8Array(await assemblePdf(groups[0], sources))], {
            type: 'application/pdf',
          })
          name = name.replace(/\.zip$/i, '.pdf')
        } else {
          blob = await createSplitZip(groups, sources, name.replace(/\.(zip|pdf)$/i, ''))
          if (!name.toLowerCase().endsWith('.zip')) name = name.replace(/\.pdf$/i, '') + '.zip'
        }
      } else if (tool === 'compress') {
        const result = await compressPdf(
          sources[0],
          compressionMode === 'lossless'
            ? { mode: 'lossless', level: 6 }
            : { mode: 'raster', dpi: 120, quality: 0.62 },
          (done, total) => setProgress(`${done} / ${total} ${t.pages}`),
        )
        blob = new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' })
      } else if (tool === 'repair') {
        const result = await repairPdf(sources[0].bytes)
        blob = new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' })
        if (result.warnings.length)
          details = ` · ${result.warnings.length} structure warning(s); inspect the result`
      } else if (tool === 'protect') {
        const result = await protectPdf(sources[0].bytes, password)
        blob = new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' })
      } else if (tool === 'unlock') {
        const result = await unlockPdf(sources[0].bytes, password)
        blob = new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' })
      } else if (tool === 'metadata-clean') {
        const result = await cleanMetadataPdf(sources[0].bytes)
        blob = new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' })
      } else if (tool === 'metadata-edit') {
        blob = new Blob([new Uint8Array(await editMetadataPdf(sources[0].bytes, metadata))], {
          type: 'application/pdf',
        })
      } else if (tool === 'crop') {
        blob = new Blob([new Uint8Array(await cropPdfByRect(sources[0].bytes, cropRect))], {
          type: 'application/pdf',
        })
      } else if (tool === 'watermark') {
        let bytes: Uint8Array
        if (watermarkKind === 'text')
          bytes = await watermarkPdf(sources[0].bytes, {
            text: watermarkText,
            size: watermarkSize,
            opacity: watermarkOpacity,
            position: stampPosition,
            angle: 0,
            margin: 24,
          })
        else {
          if (!watermarkImage) throw new Error('Choose a PNG or JPG watermark image.')
          bytes = await imageWatermarkPdf(
            sources[0].bytes,
            new Uint8Array(await watermarkImage.arrayBuffer()),
            watermarkImage.type === 'image/png' ? 'image/png' : 'image/jpeg',
            {
              width: watermarkWidth,
              opacity: watermarkOpacity,
              position: stampPosition,
              margin: 24,
            },
          )
        }
        blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' })
      } else if (tool === 'page-numbers') {
        blob = new Blob(
          [
            new Uint8Array(
              await numberPagesPdf(sources[0].bytes, {
                start: numberStart,
                prefix: numberPrefix,
                position: stampPosition,
                size: 12,
                margin: 24,
              }),
            ),
          ],
          { type: 'application/pdf' },
        )
      } else {
        let chosen = pages
        if (tool === 'extract') chosen = pages.filter((page) => selected.includes(page.id))
        if (tool === 'remove') chosen = pages.filter((page) => !selected.includes(page.id))
        if (!chosen.length)
          throw new Error(
            tool === 'extract' ? 'Select pages to extract.' : 'A PDF needs at least one page.',
          )
        blob = new Blob([new Uint8Array(await assemblePdf(chosen, sources))], {
          type: 'application/pdf',
        })
        if (!name.toLowerCase().endsWith('.pdf')) name += '.pdf'
      }
      if (tool !== 'split' && tool !== 'pdf-jpg' && !name.toLowerCase().endsWith('.pdf'))
        name += '.pdf'
      const saved = await saveLocal(blob, name, outputFolder, overwrite)
      if (tool === 'compress') setCompressionResult({ name: saved, before: sources[0].bytes.length, after: blob.size })
      setNotice(`${t.completed}: ${saved}${details}`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Processing failed.')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (event.ctrlKey && event.key.toLowerCase() === 's' && tool) {
        event.preventDefault()
        void exportFile()
        return
      }
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (event.ctrlKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'a' && tool) {
        event.preventDefault()
        setSelected(isImageTool ? images.map((image) => image.id) : pages.map((page) => page.id))
      }
      if (event.ctrlKey && event.key.toLowerCase() === 'c' && tool && !isImageTool) {
        event.preventDefault()
        copiedPages.current = pages.filter(
          (page) => selected.includes(page.id) || (!selected.length && page.id === currentId),
        )
      }
      if (event.key === 'Delete' && selected.length && tool !== 'pdf-jpg') {
        event.preventDefault()
        deleteSelected()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const filteredTools = useMemo(
    () =>
      tools.filter(
        (item) =>
          (category === 'All' || item.category === category) &&
          `${item.name} ${item.arabic} ${item.description}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [category, search],
  )
  const onDropFiles = (event: React.DragEvent) => {
    event.preventDefault()
    const files = Array.from(event.dataTransfer.files)
    if (files.length) void addFiles(files)
  }
  const recentLabel = (item: RecentItem) =>
    tools.find((entry) => entry.id === item.tool)?.name || item.tool

  return (
    <div
      className="app-shell"
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes('Files')) event.preventDefault()
      }}
      onDrop={onDropFiles}
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          void addFiles(Array.from(event.target.files || []))
          event.target.value = ''
        }}
      />
      <input
        ref={folderInput}
        type="file"
        multiple
        hidden
        {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={(event) => {
          void addFiles(Array.from(event.target.files || []))
          event.target.value = ''
        }}
      />
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setTool(null)
            setView('home')
          }}
          aria-label="LocalPDF home"
        >
          <span className="brand-mark">
            <FileText size={21} strokeWidth={2.3} />
          </span>
          <span>
            folio<span className="brand-dot">.</span>
            <small>LOCAL PDF SUITE</small>
          </span>
        </button>
        <nav className="topnav" aria-label="Main navigation">
          {(['home', 'tools', 'recent', 'workflows', 'settings'] as View[]).map((item) => (
            <button
              key={item}
              className={view === item && !tool ? 'active' : ''}
              onClick={() => {
                setTool(null)
                setView(item)
              }}
            >
              {t[item]}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button
            className="icon-button"
            onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
            title="English / العربية"
          >
            <Languages size={18} />
          </button>
          <button
            className="icon-button"
            onClick={() => setTheme(resolvedDark ? 'light' : 'dark')}
            title={resolvedDark ? language === 'ar' ? 'الوضع الفاتح' : 'Light mode' : language === 'ar' ? 'الوضع الليلي' : 'Dark mode'}
            aria-label={resolvedDark ? language === 'ar' ? 'الوضع الفاتح' : 'Light mode' : language === 'ar' ? 'الوضع الليلي' : 'Dark mode'}
            aria-pressed={resolvedDark}
          >
            {resolvedDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>
      </header>

      {tool ? (
        <main className="workspace-wrap">
          <div className="workspace-heading">
            <button
              className="back-button"
              onClick={() => {
                setTool(null)
                setView('tools')
              }}
            >
              <ArrowLeft size={17} /> {t.all}
            </button>
            <span className="heading-sep" />
            <span className="tool-heading-icon">{toolInfo && <toolInfo.icon size={19} />}</span>
            <div>
              <h1>{language === 'ar' ? toolInfo?.arabic : toolInfo?.name}</h1>
              <p>
                {language === 'ar'
                  ? toolInfo?.arabicDescription || toolInfo?.description
                  : toolInfo?.description}
              </p>
            </div>
            <div className="heading-spacer" />
            <span className="workspace-count">
              {itemCount} {rawTool ? (language === 'ar' ? 'ملف' : 'document') : t.pages}
            </span>
            <Button onClick={pickFiles} variant="outline">
              <Plus size={16} /> {t.upload}
            </Button>
          </div>
          {notice && (
            <div
              className={`notice ${notice.startsWith(t.completed) ? 'success' : ''}`}
              role="status"
            >
              <span>{notice}</span>
              <button onClick={() => setNotice('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {toolInfo?.phase === 1 && (
            <div className="workspace-toolbar">
              <div className="toolbar-group">
                <button onClick={undo} disabled={!history.current.length} title="Undo (Ctrl+Z)">
                  <RotateCcw size={17} />
                </button>
                <button onClick={redo} disabled={!future.current.length} title="Redo (Ctrl+Y)">
                  <RotateCw size={17} />
                </button>
              </div>
              <span className="toolbar-sep" />
              <div className="toolbar-group">
                <button
                  onClick={() => rotateSelected(-90)}
                  disabled={!itemCount || tool === 'pdf-jpg'}
                  title="Rotate left"
                >
                  <RotateCcw size={17} />
                  <span>{language === 'ar' ? 'يسار' : 'Left'}</span>
                </button>
                <button
                  onClick={() => rotateSelected(90)}
                  disabled={!itemCount || tool === 'pdf-jpg'}
                  title="Rotate right"
                >
                  <RotateCw size={17} />
                  <span>{language === 'ar' ? 'يمين' : 'Right'}</span>
                </button>
              </div>
              {!isImageTool && tool !== 'pdf-jpg' && (
                <>
                  <span className="toolbar-sep" />
                  <div className="toolbar-group">
                    <button
                      onClick={duplicateSelected}
                      disabled={!itemCount}
                      title="Duplicate selected"
                    >
                      <Copy size={17} />
                      <span>{language === 'ar' ? 'تكرار' : 'Duplicate'}</span>
                    </button>
                    <button onClick={deleteSelected} disabled={!itemCount} title="Delete selected">
                      <Trash2 size={17} />
                      <span>{language === 'ar' ? 'حذف' : 'Delete'}</span>
                    </button>
                  </div>
                </>
              )}
              {isImageTool && (
                <button onClick={deleteSelected} disabled={!itemCount}>
                  <Trash2 size={17} /> {language === 'ar' ? 'حذف' : 'Remove'}
                </button>
              )}
              <div className="toolbar-end">
                <span>
                  {selected.length} {t.selected}
                </span>
                <button
                  onClick={() =>
                    setSelected(
                      isImageTool ? images.map((image) => image.id) : pages.map((page) => page.id),
                    )
                  }
                >
                  {language === 'ar' ? 'تحديد الكل' : 'Select all'}
                </button>
              </div>
            </div>
          )}
          <div className={`workspace-grid ${tool === 'organize' ? 'organize-workspace' : ''}`}>
            <aside className="page-rail">
              <div className="panel-title">
                <strong>{tool === 'organize' ? language === 'ar' ? 'كل الصفحات · اسحب للترتيب واضغط للمعاينة' : 'All pages · drag to reorder, click to preview' : language === 'ar' ? 'الصفحات' : 'Pages'}</strong>
                <span>{itemCount}</span>
              </div>
              {!isImageTool && pages.length > 1 && <div className="page-navigation-tools">
                <label>{language === 'ar' ? 'انتقل إلى صفحة' : 'Go to page'}</label>
                <div className="page-navigation-row">
                  <input aria-label={language === 'ar' ? 'رقم الصفحة' : 'Page number'} type="number" min={1} max={pages.length} value={pageJump} onChange={(event) => setPageJump(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') jumpToPage() }} placeholder={`1–${pages.length}`} />
                  <button type="button" onClick={jumpToPage}>{language === 'ar' ? 'اذهب' : 'Go'}</button>
                </div>
                {toolInfo?.phase === 1 && tool !== 'pdf-jpg' && <>
                  <label>{language === 'ar' ? 'انقل المحدد ليبدأ عند' : 'Move selection to start at'}</label>
                  <div className="page-navigation-row">
                    <input aria-label={language === 'ar' ? 'موضع النقل' : 'Move position'} type="number" min={1} max={pages.length} value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') moveSelectedToPage() }} placeholder={`1–${pages.length}`} />
                    <button type="button" onClick={moveSelectedToPage}>{language === 'ar' ? 'انقل' : 'Move'}</button>
                  </div>
                  <small>{language === 'ar' ? 'حدد صفحات متعددة بـ Ctrl أو مدى بـ Shift.' : 'Use Ctrl to select pages or Shift to select a range.'}</small>
                </>}
              </div>}
              <div className="page-list" ref={pageRail}>
                {isImageTool
                  ? images.map((image, index) => (
                      <button
                        key={image.id}
                        className={`page-tile ${currentId === image.id ? 'current' : ''} ${selected.includes(image.id) ? 'selected' : ''}`}
                        draggable={toolInfo?.phase === 1}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', image.id)
                          event.stopPropagation()
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.stopPropagation()
                          event.preventDefault()
                          reorder(event.dataTransfer.getData('text/plain'), image.id)
                        }}
                        onClick={(event) => {
                          setCurrentId(image.id)
                          setSelected(
                            event.ctrlKey
                              ? selected.includes(image.id)
                                ? selected.filter((id) => id !== image.id)
                                : [...selected, image.id]
                              : [image.id],
                          )
                        }}
                      >
                        <span className="tile-grip">
                          <GripVertical size={13} />
                        </span>
                        <ImagePreview file={image.file} rotation={image.rotation} />
                        <span className="tile-number">{index + 1}</span>
                      </button>
                    ))
                  : pages.map((page, index) => {
                      const source = sources.find((item) => item.id === page.sourceId)
                      return source ? (
                        <button
                          key={page.id}
                          data-entry-id={page.id}
                          className={`page-tile ${currentId === page.id ? 'current' : ''} ${selected.includes(page.id) ? 'selected' : ''}`}
                          draggable={toolInfo?.phase === 1}
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', page.id)
                            event.stopPropagation()
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.stopPropagation()
                            event.preventDefault()
                            reorder(event.dataTransfer.getData('text/plain'), page.id)
                          }}
                          onClick={(event) => {
                            selectPage(page.id, event)
                            if (tool === 'organize' && !event.ctrlKey && !event.metaKey && !event.shiftKey)
                              setOrganizePreview(page.id)
                          }}
                          aria-label={`${source.file.name}, ${t.page} ${page.pageIndex + 1}, ${language === 'ar' ? 'الموضع' : 'position'} ${index + 1}`}
                        >
                          <span className="tile-grip">
                            <GripVertical size={13} />
                          </span>
                          <PageCanvas
                            source={source}
                            pageIndex={page.pageIndex}
                            rotation={page.rotation}
                            width={tool === 'organize' ? 160 : 104}
                            lazy
                          />
                          <span className="tile-number">{index + 1}</span>
                          {tool === 'organize' && <span className="tile-file-name" title={source.file.name}>{source.file.name} · {t.page} {page.pageIndex + 1}</span>}
                        </button>
                      ) : null
                    })}
                <button className="add-page-tile" onClick={pickFiles}>
                  <Plus size={21} />
                  <span>{t.upload}</span>
                </button>
              </div>
            </aside>
            {tool !== 'organize' && <section className="viewer-panel">
              <div className="viewer-top">
                <span>
                  {isImageTool
                    ? currentImage?.file.name
                    : sources.find((source) => source.id === currentPage?.sourceId)?.file.name}
                </span>
                {previewLoading && <span className="preview-indicator">{language === 'ar' ? 'جاري تحديث المعاينة…' : 'Updating preview…'}</span>}
                {previewError && <span className="preview-indicator preview-error">{language === 'ar' ? 'تعذرت المعاينة' : 'Preview unavailable'}</span>}
              </div>
              <div
                className="viewer-stage"
                onWheel={(event) => {
                  if (event.ctrlKey) {
                    event.preventDefault()
                    setZoom((value) =>
                      Math.min(2, Math.max(0.4, value + (event.deltaY < 0 ? 0.1 : -0.1))),
                    )
                  }
                }}
              >
                {rawTool && sources.length ? (
                  <div className="empty-workspace">
                    <FileText size={32} />
                    <h2>{sources[0].file.name}</h2>
                    <p>
                      {language === 'ar'
                        ? 'الملف جاهز للمعالجة. المعاينة غير متاحة قبل إصلاحه أو فتحه.'
                        : 'Ready to process. Preview is unavailable until repaired or unlocked.'}
                    </p>
                  </div>
                ) : !itemCount ? (
                  <div className="empty-workspace">
                    <div className="empty-icon">
                      <UploadCloud size={31} />
                    </div>
                    <h2>{t.noFiles}</h2>
                    <p>
                      {isImageTool ? t.imageHint : t.pdfHint} · Drag & drop or paste from clipboard
                    </p>
                    <Button onClick={pickFiles}>
                      <Plus size={16} /> {t.select}
                    </Button>
                  </div>
                ) : isImageTool && currentImage ? (
                  <div className="large-image">
                    <ImagePreview file={currentImage.file} rotation={currentImage.rotation} />
                  </div>
                ) : tool === 'crop' && currentPage && currentSource ? (
                  <CropSelection rect={cropRect} onChange={setCropRect} language={language}>
                    <PageCanvas source={currentSource} pageIndex={currentPage.pageIndex} rotation={currentPage.rotation} width={Math.round(650 * zoom)} className="large-page" />
                  </CropSelection>
                ) : currentPage ? (
                  <PageCanvas
                    source={markPreview && markPreview.sourceId === currentPage.sourceId && markPreview.pageIndex === currentPage.pageIndex && (tool === 'watermark' || tool === 'page-numbers') ? markPreview.source : sources.find((source) => source.id === currentPage.sourceId)!}
                    pageIndex={markPreview && markPreview.sourceId === currentPage.sourceId && markPreview.pageIndex === currentPage.pageIndex && (tool === 'watermark' || tool === 'page-numbers') ? 0 : currentPage.pageIndex}
                    rotation={currentPage.rotation}
                    width={Math.round(650 * zoom)}
                    className={`large-page ${tool === 'watermark' || tool === 'page-numbers' ? 'mark-page' : ''}`}
                  />
                ) : (
                  <p>{t.selectPage}</p>
                )}
              </div>
              {!rawTool && (
                <div className="viewer-footer">
                  <div className="page-navigation">
                    <button
                      onClick={() =>
                        setCurrentId(
                          pages[Math.max(0, pages.findIndex((page) => page.id === currentId) - 1)]
                            ?.id || currentId,
                        )
                      }
                      disabled={isImageTool || !itemCount}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span>
                      {t.page}{' '}
                      {Math.max(
                        1,
                        (isImageTool ? images : pages).findIndex((item) => item.id === currentId) +
                          1,
                      )}{' '}
                      / {itemCount || 0}
                    </span>
                    <button
                      onClick={() =>
                        setCurrentId(
                          pages[
                            Math.min(
                              pages.length - 1,
                              pages.findIndex((page) => page.id === currentId) + 1,
                            )
                          ]?.id || currentId,
                        )
                      }
                      disabled={isImageTool || !itemCount}
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <div className="zoom-controls">
                    <button onClick={() => setZoom(Math.max(0.4, zoom - 0.1))}>
                      <ZoomOut size={17} />
                    </button>
                    <span>{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(Math.min(2, zoom + 0.1))}>
                      <ZoomIn size={17} />
                    </button>
                  </div>
                </div>
              )}
            </section>}
            <aside className="options-panel">
              <div className="panel-title">
                <strong>{language === 'ar' ? 'خيارات الأداة' : 'Tool options'}</strong>
                <Menu size={17} />
              </div>
              <div className="options-scroll">
                {tool === 'split' && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'طريقة التقسيم' : 'Split method'}</h3>
                    <div className="segmented-list">
                      {(
                        [
                          ['ranges', 'Page ranges'],
                          ['extract', 'Extract ranges together'],
                          ['every', 'Every page'],
                          ['every-n', 'Every N pages'],
                          ['odd', 'Odd pages'],
                          ['even', 'Even pages'],
                        ] as [SplitMode, string][]
                      ).map(([id, name]) => (
                        <label key={id} className={splitMode === id ? 'chosen' : ''}>
                          <input
                            type="radio"
                            name="split"
                            checked={splitMode === id}
                            onChange={() => setSplitMode(id)}
                          />
                          <span>{language === 'ar' ? arabicSplitModes[id] : name}</span>
                          {splitMode === id && <Check size={15} />}
                        </label>
                      ))}
                    </div>
                    {(splitMode === 'ranges' || splitMode === 'extract') && (
                      <div className="field">
                        <label>{language === 'ar' ? 'نطاقات الصفحات' : 'Page ranges'}</label>
                        <textarea
                          value={ranges}
                          onChange={(event) => setRanges(event.target.value)}
                          placeholder="1-5, 6-10, 15"
                          rows={3}
                        />
                        <small>
                          {language === 'ar'
                            ? 'افصل المجموعات بفواصل. مثال: 1-5, 6-10, 15'
                            : 'Separate groups with commas. Example: 1-5, 6-10, 15'}
                        </small>
                      </div>
                    )}
                    {splitMode === 'every-n' && (
                      <div className="field">
                        <label>
                          {language === 'ar' ? 'عدد الصفحات لكل ملف' : 'Pages per file'}
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={9999}
                          value={everyN}
                          onChange={(event) => setEveryN(Math.max(1, Number(event.target.value)))}
                        />
                      </div>
                    )}
                  </div>
                )}
                {(tool === 'extract' || tool === 'remove') && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'الصفحات المحددة' : 'Selected pages'}</h3>
                    <p className="muted-text">
                      {language === 'ar'
                        ? tool === 'extract'
                          ? 'حدد الصفحات من الشريط الجانبي لتصديرها.'
                          : 'حدد الصفحات التي تريد حذفها من النسخة المحفوظة.'
                        : tool === 'extract'
                          ? 'Select pages in the thumbnail rail to export them.'
                          : 'Select pages to remove from the saved copy.'}
                    </p>
                    <span className="selection-chip">
                      {selected.length} {t.selected}
                    </span>
                  </div>
                )}
                {tool === 'merge' && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'ترتيب الملفات' : 'Document order'}</h3>
                    <p className="muted-text">
                      {language === 'ar'
                        ? 'انقل الملفات كاملة هنا، أو اسحب صور الصفحات المصغرة.'
                        : 'Move whole files here, or drag individual page thumbnails.'}
                    </p>
                    <div className="source-list">
                      {sources.map((source, index) => (
                        <div className="source-row" key={source.id}>
                          <span className="source-file-icon">
                            <FileText size={16} />
                          </span>
                          <span className="source-file-name" title={source.file.name}>
                            {source.file.name}
                            <small>
                              {source.pages} {t.pages}
                            </small>
                          </span>
                          <span className="source-actions">
                            <button
                              onClick={() => moveSource(source.id, -1)}
                              disabled={index === 0}
                              title="Move file up"
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              onClick={() => moveSource(source.id, 1)}
                              disabled={index === sources.length - 1}
                              title="Move file down"
                            >
                              <ArrowDown size={13} />
                            </button>
                            <button
                              onClick={() =>
                                commitPages(
                                  pages.map((page) =>
                                    page.sourceId === source.id
                                      ? { ...page, rotation: (page.rotation + 90) % 360 }
                                      : page,
                                  ),
                                )
                              }
                              title="Rotate file"
                            >
                              <RotateCw size={13} />
                            </button>
                            <button onClick={() => removeSource(source.id)} title="Remove file">
                              <X size={13} />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(tool === 'organize' || tool === 'duplicate' || tool === 'rotate') && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'ترتيب الصفحات' : 'Page order'}</h3>
                    <p className="muted-text">
                      {language === 'ar'
                        ? 'اسحب الصور المصغرة لتغيير الترتيب. استخدم Ctrl أو Shift لتحديد صفحات متعددة.'
                        : 'Drag thumbnails to reorder. Use Ctrl or Shift to select multiple pages.'}
                    </p>
                    <span className="selection-chip">
                      {sources.length} {language === 'ar' ? 'ملفات' : 'documents'} · {pages.length}{' '}
                      {t.pages}
                    </span>
                  </div>
                )}
                {tool === 'pdf-jpg' && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'جودة الصورة' : 'Image quality'}</h3>
                    <div className="field">
                      <label>{language === 'ar' ? 'الدقة' : 'Resolution'}</label>
                      <select value={dpi} onChange={(event) => setDpi(Number(event.target.value))}>
                        <option value={72}>72 DPI · Screen</option>
                        <option value={150}>150 DPI · Standard</option>
                        <option value={300}>300 DPI · Print</option>
                        <option value={600}>600 DPI · High</option>
                      </select>
                      <small>
                        {language === 'ar'
                          ? 'الدقة العالية تستهلك ذاكرة أكثر وتنتج ملفات أكبر.'
                          : 'High DPI requires more memory and creates larger files.'}
                      </small>
                    </div>
                  </div>
                )}
                {tool === 'jpg-pdf' && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'تخطيط الصفحة' : 'Page layout'}</h3>
                    <div className="field">
                      <label>{language === 'ar' ? 'حجم الصفحة' : 'Page size'}</label>
                      <select
                        value={pageSize}
                        onChange={(event) => setPageSize(event.target.value as typeof pageSize)}
                      >
                        <option value="a4">A4</option>
                        <option value="letter">Letter</option>
                        <option value="fit">
                          {language === 'ar' ? 'حجم الصورة' : 'Fit image'}
                        </option>
                      </select>
                    </div>
                    <div className="field">
                      <label>{language === 'ar' ? 'الاتجاه' : 'Orientation'}</label>
                      <div className="two-choice">
                        <button
                          className={!landscape ? 'chosen' : ''}
                          onClick={() => setLandscape(false)}
                        >
                          {language === 'ar' ? 'عمودي' : 'Portrait'}
                        </button>
                        <button
                          className={landscape ? 'chosen' : ''}
                          onClick={() => setLandscape(true)}
                        >
                          {language === 'ar' ? 'أفقي' : 'Landscape'}
                        </button>
                      </div>
                    </div>
                    <div className="field">
                      <label>{language === 'ar' ? 'الهوامش (نقطة)' : 'Margin (pt)'}</label>
                      <input
                        type="number"
                        min={0}
                        max={200}
                        value={margin}
                        onChange={(event) => setMargin(Math.max(0, Number(event.target.value)))}
                      />
                    </div>
                  </div>
                )}
                {tool === 'compress' && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'ضغط الملف' : 'Compress PDF'}</h3>
                    {sources[0] && <p className="muted-text">{language === 'ar' ? 'الحجم الحالي' : 'Current size'}: {formatFileSize(sources[0].bytes.length, language)}</p>}
                    <div className="compression-modes" role="radiogroup" aria-label={language === 'ar' ? 'طريقة الضغط' : 'Compression method'}>
                      <label className={compressionMode === 'lossless' ? 'chosen' : ''}>
                        <input type="radio" name="compression-mode" checked={compressionMode === 'lossless'} onChange={() => { setCompressionMode('lossless'); setCompressionResult(null) }} />
                        <span><strong>{language === 'ar' ? 'بلا فقدان' : 'Lossless'}</strong><small>{language === 'ar' ? 'يحافظ على النص والروابط وجودة الصور. قد لا يقل الحجم.' : 'Keeps text, links and image quality. Size may stay the same.'}</small></span>
                      </label>
                      <label className={compressionMode === 'smaller' ? 'chosen' : ''}>
                        <input type="radio" name="compression-mode" checked={compressionMode === 'smaller'} onChange={() => { setCompressionMode('smaller'); setCompressionResult(null) }} />
                        <span><strong>{language === 'ar' ? 'حجم أصغر للملفات المصوّرة' : 'Smaller image-based PDF'}</strong><small>{language === 'ar' ? 'يحوّل كل صفحة إلى صورة JPEG بدقة 120 DPI؛ يفقد النص القابل للتحديد والروابط والنماذج.' : 'Turns every page into a 120 DPI JPEG; selectable text, links and forms are lost.'}</small></span>
                      </label>
                    </div>
                    {compressionResult && <div className="compression-result" role="status">
                      <strong>{compressionResult.after < compressionResult.before ? language === 'ar' ? 'اكتمل الضغط' : 'Compression complete' : language === 'ar' ? 'لم يقل حجم الملف' : 'File size did not decrease'}</strong>
                      <span>{language === 'ar' ? 'قبل' : 'Before'}: {formatFileSize(compressionResult.before, language)}</span>
                      <span>{language === 'ar' ? 'بعد' : 'After'}: {formatFileSize(compressionResult.after, language)}</span>
                      <span>{compressionSavings(compressionResult.before, compressionResult.after).bytes > 0
                        ? language === 'ar'
                          ? `وفّرت ${formatFileSize(compressionSavings(compressionResult.before, compressionResult.after).bytes, language)} (${compressionSavings(compressionResult.before, compressionResult.after).percent}%)`
                          : `Saved ${formatFileSize(compressionSavings(compressionResult.before, compressionResult.after).bytes, language)} (${compressionSavings(compressionResult.before, compressionResult.after).percent}%)`
                        : language === 'ar' ? 'التوفير 0 بايت (0%). حفظنا نسخة مطابقة لتجنّب ملف أكبر.' : 'Saved 0 B (0%). The original bytes were kept to avoid a larger file.'}</span>
                      {compressionResult.after === compressionResult.before && compressionMode === 'lossless' &&
                        <button type="button" className="compression-try-smaller" onClick={() => { setCompressionMode('smaller'); setCompressionResult(null) }}>
                          {language === 'ar' ? 'جرّب خيار الحجم الأصغر للملفات المصوّرة' : 'Try the smaller image-based option'}
                        </button>}
                    </div>}
                  </div>
                )}
                {tool === 'repair' && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'إصلاح البنية' : 'Structure repair'}</h3>
                    <small>
                      {language === 'ar'
                        ? 'يعيد qpdf كتابة الملف ويصلح بعض أخطاء البنية. لا يستطيع استرجاع محتوى مفقود.'
                        : 'qpdf rewrites recoverable structure. Missing page content cannot be restored.'}
                    </small>
                  </div>
                )}
                {tool === 'crop' && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'حدد منطقة القص' : 'Choose the crop area'}</h3>
                    <p className="muted-text">{language === 'ar' ? 'اسحب على الصفحة لتحديد الجزء الذي تريد إبقاءه. تگدر تحرك الإطار أو تسحب أطرافه لتعدله. نفس القص ينطبق على كل الصفحات.' : 'Drag on the page to choose the area to keep. Move or resize the frame to adjust it. The same crop applies to every page.'}</p>
                    <button className="crop-reset" type="button" onClick={() => setCropRect(defaultCrop)}>{language === 'ar' ? 'إرجاع الصفحة كاملة' : 'Reset to full page'}</button>
                    <small>
                      {language === 'ar'
                        ? 'القص يغيّر حدود العرض فقط؛ المحتوى المخفي يبقى داخل الملف.'
                        : 'Crop changes the visible boundary; hidden content remains in the file.'}
                    </small>
                  </div>
                )}
                {(tool === 'watermark' || tool === 'page-numbers') && (
                  <div className="option-section">
                    <h3>
                      {tool === 'watermark'
                        ? language === 'ar'
                          ? 'علامة مائية'
                          : 'Watermark'
                        : language === 'ar'
                          ? 'ترقيم الصفحات'
                          : 'Page numbers'}
                    </h3>
                    {tool === 'watermark' && (
                      <>
                        <div className="field">
                          <label>{language === 'ar' ? 'النوع' : 'Type'}</label>
                          <select
                            value={watermarkKind}
                            onChange={(event) =>
                              setWatermarkKind(event.target.value as 'text' | 'image')
                            }
                          >
                            <option value="text">{language === 'ar' ? 'نص' : 'Text'}</option>
                            <option value="image">{language === 'ar' ? 'صورة' : 'Image'}</option>
                          </select>
                        </div>
                        {watermarkKind === 'image' && (
                          <>
                            <div className="field">
                              <label>{language === 'ar' ? 'الصورة' : 'Image'}</label>
                              <input
                                ref={watermarkInput}
                                type="file"
                                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                                onChange={(event) =>
                                  setWatermarkImage(event.target.files?.[0] || null)
                                }
                              />
                              <small>{watermarkImage?.name}</small>
                            </div>
                            <div className="field">
                              <label>{language === 'ar' ? 'العرض (نقطة)' : 'Width (pt)'}</label>
                              <input
                                type="number"
                                min={10}
                                max={1000}
                                value={watermarkWidth}
                                onChange={(event) => setWatermarkWidth(Number(event.target.value))}
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}
                    {tool === 'watermark' ? (
                      watermarkKind === 'text' ? (
                        <>
                          <div className="field">
                            <label>{language === 'ar' ? 'النص' : 'Text'}</label>
                            <input
                              value={watermarkText}
                              onChange={(event) => setWatermarkText(event.target.value)}
                            />
                          </div>
                          <div className="field">
                            <label>{language === 'ar' ? 'الحجم' : 'Size'}</label>
                            <input
                              type="number"
                              min={6}
                              max={200}
                              value={watermarkSize}
                              onChange={(event) => setWatermarkSize(Number(event.target.value))}
                            />
                          </div>
                          <div className="field">
                            <label>{language === 'ar' ? 'الشفافية (%)' : 'Opacity (%)'}</label>
                            <input
                              type="number"
                              min={5}
                              max={100}
                              value={Math.round(watermarkOpacity * 100)}
                              onChange={(event) =>
                                setWatermarkOpacity(Number(event.target.value) / 100)
                              }
                            />
                          </div>
                        </>
                      ) : (
                        <div className="field">
                          <label>
                            {language === 'ar'
                              ? '\u0627\u0644\u0634\u0641\u0627\u0641\u064a\u0629 (%)'
                              : 'Opacity (%)'}
                          </label>
                          <input
                            type="number"
                            min={5}
                            max={100}
                            value={Math.round(watermarkOpacity * 100)}
                            onChange={(event) =>
                              setWatermarkOpacity(Number(event.target.value) / 100)
                            }
                          />
                        </div>
                      )
                    ) : (
                      <>
                        <div className="field">
                          <label>{language === 'ar' ? 'البداية' : 'Start at'}</label>
                          <input
                            type="number"
                            min={0}
                            value={numberStart}
                            onChange={(event) => setNumberStart(Number(event.target.value))}
                          />
                        </div>
                        <div className="field">
                          <label>{language === 'ar' ? 'بادئة اختيارية' : 'Optional prefix'}</label>
                          <input
                            value={numberPrefix}
                            onChange={(event) => setNumberPrefix(event.target.value)}
                          />
                        </div>
                      </>
                    )}
                    <div className="field">
                      <label>{language === 'ar' ? 'الموضع' : 'Position'}</label>
                      <select
                        value={stampPosition}
                        onChange={(event) => setStampPosition(event.target.value as StampPosition)}
                      >
                        {(
                          [
                            'top-left',
                            'top-center',
                            'top-right',
                            'center',
                            'bottom-left',
                            'bottom-center',
                            'bottom-right',
                          ] as StampPosition[]
                        ).map((position) => (
                          <option key={position} value={position}>
                            {position.replace('-', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
                {(tool === 'protect' || tool === 'unlock') && (
                  <div className="option-section">
                    <h3>
                      {tool === 'protect'
                        ? language === 'ar'
                          ? 'تشفير AES-256'
                          : 'AES-256 protection'
                        : language === 'ar'
                          ? 'فتح بكلمة المرور'
                          : 'Unlock with password'}
                    </h3>
                    <div className="field">
                      <label>{language === 'ar' ? 'كلمة المرور' : 'Password'}</label>
                      <input
                        type="password"
                        autoComplete="off"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                    </div>
                    <small>
                      {tool === 'unlock'
                        ? language === 'ar'
                          ? 'يلزم إدخال كلمة المرور الصحيحة. لا توجد محاولة لكسرها.'
                          : 'The correct password is required.'
                        : language === 'ar'
                          ? 'احتفظ بكلمة المرور؛ لا يمكن استعادتها من التطبيق.'
                          : 'Keep this password. Folio cannot recover it.'}
                    </small>
                  </div>
                )}
                {tool === 'metadata-edit' && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'البيانات الوصفية' : 'Document metadata'}</h3>
                    {(['title', 'author', 'subject', 'keywords'] as const).map((key) => (
                      <div className="field" key={key}>
                        <label>
                          {language === 'ar'
                            ? {
                                title: 'العنوان',
                                author: 'المؤلف',
                                subject: 'الموضوع',
                                keywords: 'الكلمات المفتاحية',
                              }[key]
                            : key}
                        </label>
                        <input
                          value={metadata[key]}
                          onChange={(event) =>
                            setMetadata((old) => ({ ...old, [key]: event.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                {tool === 'metadata-clean' && (
                  <div className="option-section">
                    <h3>{language === 'ar' ? 'تنظيف البيانات الوصفية' : 'Metadata cleanup'}</h3>
                    <small>
                      {language === 'ar'
                        ? 'يزيل حقول Info وبيانات XMP الرئيسية. لا يفحص النص أو المرفقات أو التعليقات بحثاً عن معلومات شخصية.'
                        : 'Removes the main Info fields and catalog XMP. It does not inspect page content, attachments or comments.'}
                    </small>
                  </div>
                )}
                <div className="option-section output-section">
                  <h3>{t.output}</h3>
                  <div className="field">
                    <label htmlFor="output-name">{t.filename}</label>
                    <input
                      id="output-name"
                      value={outputName}
                      onChange={(event) => setOutputName(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>{language === 'ar' ? 'مجلد الحفظ' : 'Output folder'}</label>
                    <button
                      className="folder-choice"
                      onClick={async () => {
                        try {
                          const folder = await chooseOutputFolder()
                          if (folder) setOutputFolder(folder)
                          else
                            setNotice(
                              'Folder selection is unavailable here. The file will go to browser Downloads.',
                            )
                        } catch (error) {
                          if (!(error instanceof DOMException && error.name === 'AbortError'))
                            setNotice('Could not open the folder picker.')
                        }
                      }}
                    >
                      <FolderOpen size={17} />
                      <span>
                        {outputFolder
                          ? language === 'ar'
                            ? 'مجلد محدد'
                            : 'Chosen local folder'
                          : t.browserDownloads}
                      </span>
                      <ChevronDown size={15} />
                    </button>
                    {!canChooseFolder() && (
                      <small>
                        Direct folder saving requires a browser with File System Access support.
                      </small>
                    )}
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={overwrite}
                      onChange={(event) => setOverwrite(event.target.checked)}
                      disabled={!outputFolder}
                    />
                    {t.overwrite}
                  </label>
                  <small>Original files are never modified.</small>
                </div>
              </div>
              <div className="options-bottom">
                <Button
                  className="export-button"
                  disabled={!itemCount || busy}
                  onClick={() => void exportFile()}
                >
                  <Download size={17} /> {busy ? progress || (language === 'ar' ? 'جاري المعالجة…' : 'Processing…') : tool === 'compress' ? language === 'ar' ? 'اضغط الملف' : 'Compress PDF' : t.save}{' '}
                  <ArrowRight size={16} />
                </Button>
                <div className="privacy-note">
                  <ShieldCheck size={14} />
                  {t.private}
                </div>
              </div>
            </aside>
          </div>
          {tool === 'organize' && previewPage && previewSource && (
            <div className="organize-preview-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOrganizePreview(null) }}>
              <div className="organize-preview-dialog" role="dialog" aria-modal="true" aria-label={language === 'ar' ? 'معاينة الصفحة' : 'Page preview'} onKeyDown={(event) => { if (event.key === 'Escape') setOrganizePreview(null) }}>
                <div className="organize-preview-header">
                  <div>
                    <strong>{previewSource.file.name}</strong>
                    <span>{t.page} {previewPage.pageIndex + 1} · {language === 'ar' ? 'الموضع' : 'Position'} {pages.findIndex((page) => page.id === previewPage.id) + 1} / {pages.length}</span>
                  </div>
                  <button autoFocus type="button" onClick={() => setOrganizePreview(null)} aria-label={language === 'ar' ? 'إغلاق المعاينة' : 'Close preview'}><X size={20} /></button>
                </div>
                <div className="organize-preview-page">
                  <PageCanvas source={previewSource} pageIndex={previewPage.pageIndex} rotation={previewPage.rotation} width={650} />
                </div>
                <div className="organize-preview-footer">
                  <button type="button" disabled={pages[0]?.id === previewPage.id} onClick={() => setOrganizePreview(pages[pages.findIndex((page) => page.id === previewPage.id) - 1]?.id || null)}><ChevronLeft size={18} /> {language === 'ar' ? 'السابق' : 'Previous'}</button>
                  <button type="button" disabled={pages[pages.length - 1]?.id === previewPage.id} onClick={() => setOrganizePreview(pages[pages.findIndex((page) => page.id === previewPage.id) + 1]?.id || null)}>{language === 'ar' ? 'التالي' : 'Next'} <ChevronRight size={18} /></button>
                </div>
              </div>
            </div>
          )}
        </main>
      ) : view === 'home' ? (
        <main className="home-content">
          <section
            className="drop-panel"
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDropFiles}
          >
            <div className="drop-icon">
              <UploadCloud size={27} />
            </div>
            <div className="drop-text">
              <h2>{t.drop}</h2>
              <p>{t.dropSub}</p>
            </div>
            <div className="drop-actions">
              <Button size="lg" onClick={pickFiles}>
                <Plus size={17} /> {t.select}
              </Button>
              <Button size="lg" variant="outline" onClick={() => folderInput.current?.click()}>
                <FolderOpen size={17} /> {t.folder}
              </Button>
            </div>
            <span className="drop-hint">
              <Clipboard size={14} />{' '}
              {language === 'ar' ? 'اسحب أو الصق أو اختر ملفاً' : 'Drag & drop, paste, or browse'}
            </span>
          </section>
          <section className="tools-section">
            <div className="section-heading">
              <div>
                <h2>{language === 'ar' ? 'الأدوات المتاحة' : 'Available tools'}</h2>
              </div>
              <button className="text-link" onClick={() => setView('tools')}>
                {t.browse}
                <ArrowRight size={17} />
              </button>
            </div>
            <div className="featured-grid">
              {tools
                .filter((item) => availableIds.has(item.id as ToolId))
                .slice(0, 12)
                .map((item) => (
                  <button
                    key={item.id}
                    className="tool-card"
                    onClick={() => startTool(item.id as ToolId)}
                  >
                    <span className={`tool-icon tool-icon-${item.category.toLowerCase()}`}>
                      <item.icon size={22} strokeWidth={1.8} />
                    </span>
                    <span className="tool-card-content">
                      <strong>{language === 'ar' ? item.arabic : item.name}</strong>
                      <small>
                        {language === 'ar'
                          ? item.arabicDescription || item.description
                          : item.description}
                      </small>
                    </span>
                    <ArrowRight className="card-arrow" size={17} />
                  </button>
                ))}
            </div>
          </section>
        </main>
      ) : view === 'tools' ? (
        <main className="catalog-content">
          <div className="catalog-intro">
            <h1>{t.tools}</h1>
          </div>
          <div className="catalog-controls">
            <div className="search-box">
              <Search size={19} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t.search}
              />
            </div>
            <div className="category-tabs">
              <button
                className={category === 'All' ? 'active' : ''}
                onClick={() => setCategory('All')}
              >
                {language === 'ar' ? 'الكل' : 'All'}
              </button>
              {categories.map((item) => (
                <button
                  key={item}
                  className={category === item ? 'active' : ''}
                  onClick={() => setCategory(item)}
                >
                  {language === 'ar' ? arabicCategories[item] : item}
                </button>
              ))}
            </div>
          </div>
          <div className="catalog-grid">
            {filteredTools.map((item) => (
              <button
                key={item.id}
                className={`catalog-card ${!availableIds.has(item.id as ToolId) ? 'future' : ''}`}
                onClick={() => availableIds.has(item.id as ToolId) && startTool(item.id as ToolId)}
                disabled={!availableIds.has(item.id as ToolId)}
              >
                <div className="catalog-card-top">
                  <span className={`tool-icon tool-icon-${item.category.toLowerCase()}`}>
                    <item.icon size={22} />
                  </span>
                  <span
                    className={
                      availableIds.has(item.id as ToolId) ? 'available-badge' : 'phase-badge'
                    }
                  >
                    {availableIds.has(item.id as ToolId)
                      ? language === 'ar'
                        ? 'متاح'
                        : 'AVAILABLE'
                      : `${t.phase} ${item.phase}`}
                  </span>
                </div>
                <strong>{language === 'ar' ? item.arabic : item.name}</strong>
                <p>
                  {language === 'ar'
                    ? item.arabicDescription || item.description
                    : item.description}
                </p>
                <span className="catalog-card-bottom">
                  {language === 'ar' ? arabicCategories[item.category] : item.category}
                  <ArrowRight size={16} />
                </span>
              </button>
            ))}
          </div>
          {!filteredTools.length && (
            <div className="empty-results">
              {language === 'ar'
                ? `لا توجد أدوات تطابق «${search}».`
                : `No tools match “${search}”.`}
            </div>
          )}
        </main>
      ) : view === 'recent' ? (
        <main className="simple-content">
          <div className="section-kicker">{language === 'ar' ? 'نشاطك' : 'YOUR ACTIVITY'}</div>
          <h1>{t.recent}</h1>
          <p>
            {language === 'ar'
              ? 'تبقى أسماء الملفات في هذا المتصفح فقط. لا تُخزَّن المستندات هنا.'
              : 'File names stay in this browser only. Documents are never stored here.'}
          </p>
          {recent.length ? (
            <div className="recent-list">
              {recent.map((item, index) => (
                <div key={`${item.date}-${index}`} className="recent-row">
                  <span className="recent-file-icon">
                    <FileText size={19} />
                  </span>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {recentLabel(item)} · {item.pages || 0} {t.pages}
                    </small>
                  </div>
                  <time>
                    {new Date(item.date).toLocaleDateString(language === 'ar' ? 'ar-IQ' : 'en-US')}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <div className="simple-empty">
              <FileText size={29} />
              <strong>
                {language === 'ar' ? 'لا توجد ملفات حديثة بعد' : 'No recent files yet'}
              </strong>
              <p>
                {language === 'ar'
                  ? 'ستظهر أسماء الملفات التي تفتحها هنا.'
                  : 'Files you open will appear here by name.'}
              </p>
            </div>
          )}
        </main>
      ) : view === 'workflows' ? (
        <main className="simple-content">
          <div className="section-kicker">
            {language === 'ar' ? 'في المرحلة الخامسة' : 'COMING IN PHASE 5'}
          </div>
          <h1>{t.workflows}</h1>
          <p>
            {language === 'ar'
              ? 'سيأتي سير العمل المحلي القابل لإعادة الاستخدام بعد الأدوات الأساسية والمعالجة الدفعية.'
              : 'Reusable local processing sequences are planned after the core tools and batch queue.'}
          </p>
          <div className="simple-empty">
            <LayoutGrid size={30} />
            <strong>{language === 'ar' ? 'أنشئ سير عمل قريباً' : 'Build a workflow soon'}</strong>
            <p>
              {language === 'ar'
                ? 'حالياً، استخدم الأدوات المتاحة خطوة بخطوة.'
                : 'For now, use the available tools one step at a time.'}
            </p>
            <Button onClick={() => setView('tools')}>{t.browse}</Button>
          </div>
        </main>
      ) : (
        <main className="simple-content">
          <div className="section-kicker">{language === 'ar' ? 'التفضيلات' : 'PREFERENCES'}</div>
          <h1>{t.settings}</h1>
          <p>
            {language === 'ar'
              ? 'تُحفظ هذه الإعدادات في هذا المتصفح على هذا الكمبيوتر.'
              : 'These settings are saved in this browser on this computer.'}
          </p>
          <div className="settings-card">
            <div>
              <strong>{language === 'ar' ? 'المظهر' : 'Appearance'}</strong>
              <small>
                {language === 'ar' ? 'اختر المظهر المفضل.' : 'Choose your preferred theme.'}
              </small>
            </div>
            <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
              <option value="light">{language === 'ar' ? 'فاتح' : 'Light'}</option>
              <option value="dark">{language === 'ar' ? 'داكن' : 'Dark'}</option>
              <option value="system">{language === 'ar' ? 'النظام' : 'System'}</option>
            </select>
          </div>
          <div className="settings-card">
            <div>
              <strong>{language === 'ar' ? 'اللغة' : 'Language'}</strong>
              <small>
                {language === 'ar'
                  ? 'بدّل بين الإنجليزية والعربية.'
                  : 'Switch between English and Arabic.'}
              </small>
            </div>
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value as Language)}
            >
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
          <div className="settings-card">
            <div>
              <strong>{language === 'ar' ? 'أسماء الملفات الحديثة' : 'Recent file names'}</strong>
              <small>
                {language === 'ar'
                  ? 'احذف السجل المحلي. لا تُخزَّن بيانات المستندات.'
                  : 'Clear locally saved history. No document data is stored.'}
              </small>
            </div>
            <Button variant="outline" onClick={() => setRecent([])}>
              {language === 'ar' ? 'حذف السجل' : 'Clear history'}
            </Button>
          </div>
        </main>
      )}
    </div>
  )
}

export default App
