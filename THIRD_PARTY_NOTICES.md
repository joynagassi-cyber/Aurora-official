# Third-party notices

## Grida Canvas WASM

Aurora uses `@grida/canvas-wasm` version `0.91.0-canary.22` from [gridaco/grida](https://github.com/gridaco/grida) as an optional WebGL rendering engine for structured poster SVG documents. The package is distributed under the Apache License, Version 2.0. Its full license text is included at [`licenses/GRIDA-APACHE-2.0.txt`](licenses/GRIDA-APACHE-2.0.txt).

Aurora's integration adapter and its changes are maintained in `src/canvas/GridaCanvasSurface.tsx` and `src/canvas/PosterCanvas.tsx`. Grida's name and logo are not used to suggest endorsement or an official Grida product. The separate Grida Desktop application and Grida-hosted services are not bundled by this integration.

## `@xmldom/xmldom`

Aurora uses the exact dependency version `0.9.12` in the server-side design asset pipeline to parse and serialize SVG documents before adding them to a poster. Its package is distributed under the MIT License; see the package metadata and license in the installed dependency for the full notice.

## Remote design asset catalogues

Aurora can query Iconify and SVGL at runtime. Catalogue names, logos, and other assets remain the property of their respective contributors or rights holders; an API response or repository license is not a blanket grant of rights. Aurora imports Iconify SVGs only when the returned collection metadata provides an approved SPDX license, records the available source/author/license metadata, and does not place SVGL brand results automatically. Users remain responsible for use of marks and any additional attribution requirements.
