# Phase 2 engine review and verification

Reviewed on 2026-09-25. Scope: one-click lossless compression in the UI with an internal raster path; structural repair; text and image watermarks; visible page numbers; draggable CropBox editing; AES-256 password protection and password-based unlock; standard metadata editing and cleaning. All processing must run locally and the original file must remain untouched.

| Engine | Capability and selection | License and distribution | Windows, offline, maintenance |
| --- | --- | --- | --- |
| [qpdf](https://qpdf.readthedocs.io/en/stable/) 11.10.0 via [qpdf-run](https://github.com/RabbitHols/qpdf-run) 0.2.1 | Structural rewrite, Flate/object stream optimization, AES-256 protection, password-based decryption, Info/XMP removal | qpdf Apache-2.0, wrapper MIT. Bundled WASM/JS and notices in `dist/licenses`. No native executable bundled. qpdf-run has no npm runtime dependencies but is a young wrapper around an older qpdf build; keep behind `qpdf-service.ts`. | Runs in a browser worker on Windows and offline from localhost. qpdf upstream remains active and publishes current Windows binaries; the bundled WASM is 11.10.0, verified with `--version`. |
| [pdf-lib](https://pdf-lib.js.org/) 1.17.1 and [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) 1.1.1 | CropBox, text/image drawing, page numbers, Info editing | MIT. fontkit depends on pako (MIT and zlib). Cairo font is OFL-1.1. | Browser JavaScript, bundled for offline use. pdf-lib does not support encrypted input; qpdf handles that separately. |
| [PDF.js](https://mozilla.github.io/pdf.js/) 6.3.289 | Raster compression renders pages before JPEG embedding | Apache-2.0. Existing local worker and assets. | Browser based and offline; memory usage is bounded per page to 45 megapixels. |
| [Ghostscript](https://ghostscript.com/faq/) | Evaluated for optimization and recovery, not selected | AGPL or commercial license. Its redistribution terms need a separate licensing decision. | Windows binaries exist, but qpdf and existing PDF.js cover this increment without an AGPL native distribution. |

## Adapter behavior

- `qpdf-service.ts` runs qpdf in a local worker with in-memory virtual files. Input bytes are copied because the wrapper transfers its buffer. The wrapper removes each job's virtual files and the adapter destroys the worker after each run.
- Lossless compression uses qpdf stream/object compression and keeps the original bytes when qpdf's result is larger. It does not promise a size reduction on already optimized PDFs.
- The UI offers lossless compression by default and an explicitly chosen smaller image-based mode for scanned documents. The latter renders every page with PDF.js at 120 DPI and encodes it as JPEG at 62% quality, so selectable text, links, forms and vector detail are lost. The UI states this before processing. Both modes retain the original bytes when the candidate is larger and report before/after size, saved bytes and percentage (including zero).
- Repair is a qpdf structural rewrite. It may recover damaged cross references but cannot restore missing page content. Files that qpdf cannot parse still fail.
- Crop selection is dragged and resized on the PDF.js page preview. Its normalized rectangle maps through the page's 0/90/180/270-degree rotation into the CropBox of every page. Cropped content stays in the PDF; cropping is not redaction.
- Watermarks and page numbers are drawn into the saved page content. A one-page local PDF uses the same annotation functions for the live preview. Arabic marks use a bundled Cairo font; English uses Helvetica. Rotated pages and complex writing require visual inspection.
- Protection uses AES-256 with the supplied opening password and a random distinct owner password. Unlock requires the supplied correct password. There is no password cracking or stored password.
- Metadata cleaning removes the main Info dictionary entries except qpdf's modification date behavior, plus catalog XMP. It does not remove personal data in page content, attachments, comments or other custom objects.

## Verification

- `npm test`: 19 tests passed, including crop dragging, bounds and rotation, Arabic and English marks, watermark/page-number previews, PNG watermark, metadata editing, 300-page direct movement, a scanned page and encrypted-input rejection in the old viewer.
- `npm run build`: passed; local qpdf worker, WASM, Cairo font and license notices are present in `dist`.
- `npm run preview -- --host 127.0.0.1`: served the built app and qpdf worker/JS/WASM, Cairo font and qpdf license over loopback with correct MIME types (HTTP 200). XAMPP itself is not installed here.
- `npm run lint`: passed with nonblocking React warnings about effect state updates and existing component/ref patterns; vendored assets are excluded from source linting.
- qpdf 11.10.0 WASM was exercised through its CLI in Node with an in-memory PDF. It produced AES-256 encrypted output, decrypted it with the correct password, and produced output for lossless compression, metadata removal and structural rewrite. A wrong password failed. This validates engine flags, though not the browser wrapper.
- Edge headless on `127.0.0.1` loaded a synthetic 12-page English PDF. Dragging the crop frame produced a downloaded PDF with CropBox approximately `{x:75,y:175,width:315,height:385}` on the 500×700-point first page, matching the visual selection. Changing watermark text changed the preview canvas. Page numbering was visible when the whole page fit in the viewer. The browser qpdf worker completed one-click compression and produced a downloaded PDF; the sample was already optimized, so it correctly reported 0 bytes and 0%. Moving page 1 to position 10 kept 12 pages and updated the thumbnails. Arabic RTL and dark mode were inspected in Edge.
- The organize grid and smaller image-based compression mode were added later. `npm test`, `npm run lint`, and `npm run build` passed. A controllable browser was unavailable in that session, so the new controls and downloaded output still need interactive verification with English, Arabic and scanned samples.
- Full representative-file QA remains: all Phase 1 flows, direct-folder save, PDF-to-JPG output, other Phase 2 tools, XAMPP subdirectory, and Arabic/English, large, scanned, damaged and protected files before calling the phase fully verified.
