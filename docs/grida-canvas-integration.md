# Grida Canvas integration

Aurora uses the official `@grida/canvas-wasm` package (`0.91.0-canary.22`, Apache-2.0) as a **rendering engine** for structured poster SVGs. It is initialized lazily in the browser, converts the current SVG to Grida's document format, and paints it to a WebGL canvas. The regular SVG remains the accessible hit-test surface, export source, and automatic fallback.

This is an engine integration, not a vendored copy of the complete Grida web editor or Grida Desktop. Aurora retains its own poster document schema, agent actions, inspector, and layer controls so its existing features and Agnes workflow remain intact.

If WebGL is unavailable, Grida fails to initialize/parse a particular document, or a poster contains image assets that the SVG importer cannot reliably resolve, Aurora displays the original SVG renderer instead of dropping content. The Grida WASM module is dynamically loaded, while Vite emits its WASM binary as a separate asset.

The package's Apache-2.0 text is included at [`../licenses/GRIDA-APACHE-2.0.txt`](../licenses/GRIDA-APACHE-2.0.txt), with attribution in [`../THIRD_PARTY_NOTICES.md`](../THIRD_PARTY_NOTICES.md). Verify the license of any additional Grida packages or imported assets separately before redistribution.
