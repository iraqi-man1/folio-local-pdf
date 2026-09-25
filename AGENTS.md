# Agent Guide — Folio Local PDF Suite

## Project goal

Build a polished PDF utility that runs on the user's Windows computer through localhost. Document processing must remain local and work offline after installation. Never add cloud processing, external APIs, telemetry, tracking, accounts, or a network upload path. Keep originals unchanged by default and write results as separate files.

The product is developed in phases. Complete and verify a phase before beginning the next one. Do not present planned tools as available features.

## Current implementation

Phase 1 is implemented in the browser:

- React, TypeScript, Vite, Tailwind CSS, shadcn/ui source components, and Lucide icons.
- PDF.js for local PDF viewing and page rasterization. Its worker and supporting assets are copied into the build by `scripts/copy-pdfjs-assets.mjs`.
- `src/lib/pdf-service.ts` adapts PDF.js, pdf-lib, and JSZip for viewing, merge, split, page organization, rotate, remove, extract, duplicate, JPG/JPEG to PDF, and PDF pages to JPG.
- `src/lib/local-save.ts` handles local output folder selection or browser downloads.
- File drop, multi-file selection, folder selection, clipboard paste, viewer navigation/zoom, Arabic RTL with Cairo, English LTR, and light/dark/system themes.
- The recent list contains file names and job details only; it does not retain document contents.

Phase 2 tools are implemented in the browser through `qpdf-service.ts`, `annotation-service.ts`, and `compression-service.ts`: lossless compression and an explicitly chosen smaller image-based mode for scanned files, structural rewrite, text/image watermark, page numbers, draggable CropBox selection, AES-256 protect, password unlock, and metadata edit/clean. The image-based mode loses selectable text, links, forms and vector detail; it retains the original bytes if the candidate is larger. Watermark and page-number previews render the selected page with the intended mark. The qpdf WASM and Cairo font are bundled locally. The ordinary viewer still rejects encrypted inputs; the Unlock tool accepts one and requires its correct password. Page editing tools also support numbered page jumps and direct moves for long documents. Organize now shows all pages in a grid and opens a larger preview on click.

The browser holds document bytes in memory. Large files and high-DPI exports are bounded by browser memory. A targeted Edge localhost check verified crop drag/export, watermark preview updates, visible page numbers, browser-worker compression/result, direct page movement, Arabic RTL and dark mode. Broader Phase 1 and Phase 2 representative-file QA remains. Service tests, qpdf WASM CLI smoke and build passed. See `README.md`, `docs/phase-1-research.md`, `docs/phase-2-research.md`, and `THIRD_PARTY.md` for verification details and limits.

The newer organize grid and image-based compression controls passed build, lint and service tests, but were not interactively verified because a controllable browser was unavailable during that update. Check their layout, drag order, preview, saved PDF and actual size reduction with representative scanned and Arabic files.

## Project commands

Run in PowerShell from the project root:

```powershell
npm ci
npm run dev -- --host 127.0.0.1
npm test
npm run lint
npm run build
npm run preview -- --host 127.0.0.1
```

Install dependencies while online. The built application must not need internet access. `npm run build` includes local PDF.js assets. To use XAMPP, copy the contents of `dist` to `C:\xampp\htdocs\localpdf\` and open `http://localhost/localpdf/`. Apache serves static assets; document operations stay in the browser or a future local helper.

## Engineering rules

1. Before implementing a complex capability, research mature libraries or native tools that already provide it. Record the capability, license, Windows support, offline behavior, maintenance status, and redistribution implications in `docs/phase-N-research.md`.
2. Prefer established engines over custom PDF parsing or algorithms. Keep engines behind focused adapters such as `PdfService`, `CompressionService`, `OCRService`, `OfficeConversionService`, `ScannerService`, `ImageService`, `SecurityService`, and `ConversionService`.
3. Review dependencies and their transitive licenses before adding them. Document GPL/AGPL obligations and distribution options in `THIRD_PARTY.md`; do not bundle a copyleft native executable without documenting its implications.
4. Keep all assets needed at runtime local. Do not add runtime CDN dependencies or make requests carrying document data. Bind future helper services to loopback only, validate inputs and paths, avoid shell interpolation, isolate each job's temporary files, and clean them up according to the app's local settings.
5. Preserve Arabic and English behavior, including RTL/LTR layout, filenames, and PDF text where supported. Keep UI copy useful and concise; remove generic promotional claims that do not help users complete a task.
6. Preserve the original file by default. Make output names and save behavior clear. Never claim a conversion preserves layout perfectly when the engine cannot guarantee it.
7. Security tools must be technically honest: unlock only with the supplied correct password; do not implement password cracking. Redaction must remove underlying content, not cover it with a rectangle. Label drawn signatures as visual signatures rather than cryptographic signatures.
8. After implementation, run the relevant checks (`npm test`, `npm run lint`, and/or `npm run build`) and report exactly what was verified and what still needs interactive or representative-file testing. For PDF changes, include Arabic/English, large, scanned, and password-protected samples where relevant.

## Delivery sequence and next steps

### Immediate next steps — finish representative Phase 1 and Phase 2 verification

1. Continue the `127.0.0.1` browser review: dashboard, Arabic/English layout and dark mode were checked; drag/drop, folder picker and clipboard paste still need manual checks.
2. Exercise merge order, split ranges and modes, organize/reorder, rotate, remove, extract, duplicate, and output naming. Check both direct-folder save and browser download behavior.
3. Render a PDF to JPG at the supported DPIs and inspect the ZIP and image output. Check localhost deployment from an XAMPP subdirectory if XAMPP is available.
4. Fix issues found in that check, then update `README.md` and this file with the verified Phase 1 status. Do not mark browser checks complete until they have actually been run.
5. Continue Phase 2 browser checks: one-click qpdf compression and its downloaded output, crop export, watermark preview updates and page-number preview passed on a synthetic English PDF. Check remaining tools and representative Arabic, large, scanned, damaged and password-protected PDFs, plus XAMPP subdirectory hosting, before marking the phase fully verified.

### Phase 1 — viewer and essential page operations (implemented; verification above remains)

PDF.js viewer; drag/drop and file intake; merge; split by ranges, selected pages, each page, every N pages, odd/even pages; page organization; rotate; remove; extract; duplicate; JPG/JPEG to PDF; PDF to JPG.

### Phase 2 — optimize, annotate, and basic security (implemented; interactive verification pending)

qpdf 11.10.0 WASM handles structural/security work; pdf-lib/fontkit handle annotation and metadata; PDF.js handles an internal raster compression path. Ghostscript was evaluated and not bundled because of AGPL/commercial distribution terms. The UI provides one-click lossless compression with before/after savings, repair, watermark and page numbers with live previews, drag-to-crop, protect, unlock with supplied password, and metadata editing/cleaning. Verify output size and structural effects in representative browser files before declaring the phase fully verified.

### Phase 3 — Office conversion and archival output

Integrate LibreOffice headless for Word, Excel, and PowerPoint to PDF; provide available page setup options for spreadsheets; add PDF/A conversion using a suitable local tool. Verify fonts, layout, tables, images, headers, footers, page sizes, and Arabic documents. Explain conversion limits in the UI.

### Phase 4 — editor, signatures, forms, and redaction

Build the PDF.js-based overlay editor for text, images, shapes, drawing, and markup with selection, transform, undo/redo, copy/paste, and save. Add visual signatures and initials, AcroForm fill/flatten, and visual redaction backed by a method that permanently removes covered text/image content. Research each engine and prove redaction on extracted text and rendered output.

### Phase 5 — OCR, scanner, compare, batch, and workflows

Research and integrate Tesseract/OCRmyPDF with selectable language packs (Arabic and English first); implement OCR options and scanned-PDF checks. Investigate a local Windows WIA/TWAIN scanner bridge and its packaging requirements. Add side-by-side comparison, text/visual change views, batch queues, reusable local workflows, and temporary-file retention settings.

### Phase 6 — PDF to Office conversion

Research and implement PDF to Word, Excel, and PowerPoint with honest output modes: editable or layout-focused Word where practical, table preview before Excel export, and page-to-slide PowerPoint at minimum. Document reconstruction limits and test representative text, tables, scans, Arabic, and complex layouts.

## Phase completion checklist

For each phase: identify scope and acceptance criteria; research tools; verify license, Windows support, offline operation, maintenance, and packaging; document the selected adapter; implement one coherent increment; verify it with relevant tests and representative Arabic/English files; test large, scanned, and password-protected files where applicable; record limitations; update `README.md`, research notes, and `THIRD_PARTY.md`. Keep application processing on-device throughout.
