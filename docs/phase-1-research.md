# Phase 1 engine review

Reviewed before implementation on 2026-09-25. The installed versions are recorded in `package-lock.json`.

| Capability | Selected tool | License | Windows and offline fit | Maintenance observation |
| --- | --- | --- | --- | --- |
| Render and rasterize PDF | [Mozilla PDF.js](https://github.com/mozilla/pdf.js) (`pdfjs-dist` 6.3.289) | Apache-2.0 | Browser based; worker, CMaps, fonts, ICC and WASM assets are bundled locally | Current 6.3 release and active Mozilla repository |
| Copy, reorder and rotate pages; embed JPG | [pdf-lib](https://github.com/Hopding/pdf-lib) (1.17.1) | MIT | JavaScript browser package, no native Windows install | Established library with slower release cadence than PDF.js; kept behind `pdf-service.ts` |
| Package split/JPG outputs | [JSZip](https://github.com/Stuk/jszip) (3.10.2) | MIT or GPL-3.0-or-later; **MIT selected** | Browser based and offline | Upstream 3.10 line maintained |
| UI component | [shadcn/ui](https://ui.shadcn.com/docs/installation/vite) | MIT | Source component bundled in Vite build | Current Vite setup supported |

The chosen engines run without a document server. No PDF parser, page copier or rasterizer was written from scratch. Structural repair and encryption were deferred to qpdf; compression was deferred to Ghostscript. Those native tools are not Phase 1 dependencies.

PDF.js [browser examples](https://mozilla.github.io/pdf.js/examples/) informed the canvas renderer. pdf-lib's [copy and image examples](https://github.com/Hopding/pdf-lib) informed assembly. All assets referenced by the built app are local.
