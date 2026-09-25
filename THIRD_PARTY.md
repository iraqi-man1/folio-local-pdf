# Third-party components

Licenses were checked against the installed packages and upstream sources for Phases 1–2. Preserve the corresponding license notices when distributing the app.

| Component | Version | License | Purpose |
| --- | --- | --- | --- |
| [PDF.js / pdfjs-dist](https://github.com/mozilla/pdf.js) | 6.3.289 | Apache-2.0 | Local viewing and rasterization |
| [pdf-lib](https://github.com/Hopding/pdf-lib) | 1.17.1 | MIT | Page and image PDF assembly |
| [JSZip](https://github.com/Stuk/jszip) | 3.10.2 | MIT **or** GPL-3.0-or-later | ZIP output; this project elects the MIT option |
| [React](https://github.com/facebook/react) | 19.3.0 | MIT | UI |
| [Vite](https://github.com/vitejs/vite) | 8.3.1 | MIT | Build |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | 4.3.3 | MIT | Styling |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | 4.21.0 | MIT | UI component source and utilities |
| [Base UI](https://github.com/mui/base-ui) | 1.8.0 | MIT | Button primitive |
| [Lucide](https://github.com/lucide-icons/lucide) | 1.48.0 | ISC | Icons |
| [Cairo](https://github.com/Gue3bara/Cairo) | Fontsource 5.3.0 | OFL-1.1 | Arabic font |
| [Geist](https://github.com/vercel/geist-font) | Fontsource 5.3.0 | OFL-1.1 | UI font |
| [qpdf](https://github.com/qpdf/qpdf) WASM | 11.10.0 (bundled by qpdf-run) | Apache-2.0 | Local structural PDF work and AES-256 encryption/decryption |
| [qpdf-run](https://github.com/RabbitHols/qpdf-run) | 0.2.1 | MIT | Browser worker wrapper around qpdf WASM; no npm runtime dependencies |
| [@pdf-lib/fontkit](https://github.com/Hopding/fontkit) | 1.1.1 | MIT | Arabic font embedding for watermarks and page numbers |
| [pako](https://github.com/nodeca/pako) | 1.0.11, transitive through fontkit | MIT and zlib | Fontkit compression support |

Test-only dependency: `jpeg-js` (BSD-3-Clause). No GPL or AGPL-only runtime dependency has been introduced. qpdf's [license](licenses/qpdf-license.txt) and [notice](licenses/qpdf-notice.md), including attribution for embedded SHA-2 code, and the [qpdf-run license](https://github.com/RabbitHols/qpdf-run/blob/main/LICENSE) are copied into `dist/licenses/`. Ghostscript was evaluated but not bundled because its [AGPL/commercial distribution terms](https://ghostscript.com/faq/) require a separate licensing choice.

The application makes no outbound document-processing requests. Installing dependencies during development requires network access; the built application does not.
