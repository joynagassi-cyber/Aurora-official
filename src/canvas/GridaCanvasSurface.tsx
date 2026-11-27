import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import wasmUrl from '@grida/canvas-wasm/dist/grida_canvas_wasm.wasm?url';
import type { PosterDocument } from './model';

type GridaScene = {
  svgkit: { toDocument(svg: string): Uint8Array | null };
  loadSceneGrida(data: Uint8Array): void;
  resize(width: number, height: number): void;
  redraw(): void;
  dispose(): void;
};

type GridaSurfaceProps = {
  document: PosterDocument;
  svgRef: RefObject<SVGSVGElement | null>;
  onReady: (ready: boolean) => void;
};

/**
 * Render Aurora's structured poster SVG through Grida's Apache-2.0 WASM
 * renderer. The existing SVG remains as a transparent interaction/export
 * surface and is also the safe fallback when Grida cannot parse a document.
 */
export function GridaCanvasSurface({ document, svgRef, onReady }: GridaSurfaceProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GridaScene | null>(null);
  const documentRef = useRef(document);
  const readyCallbackRef = useRef(onReady);
  documentRef.current = document;
  readyCallbackRef.current = onReady;

  useEffect(() => {
    let cancelled = false;
    let scene: GridaScene | null = null;
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    async function start(targetCanvas: HTMLCanvasElement) {
      try {
        const { default: init } = await import('@grida/canvas-wasm/dist/index.mjs');
        const factory = await init({ locateFile: (path) => path.endsWith('.wasm') ? wasmUrl : path });
        if (cancelled) return;
        const current = documentRef.current;
        targetCanvas.width = current.width;
        targetCanvas.height = current.height;
        scene = factory.createWebGLCanvasSurface(targetCanvas);
        sceneRef.current = scene;
        renderCurrentDocument();
      } catch (error) {
        console.warn('Grida Canvas renderer unavailable; using native SVG rendering.', error);
        readyCallbackRef.current(false);
      }
    }

    function renderCurrentDocument() {
      const activeScene = sceneRef.current;
      const svg = svgRef.current;
      if (!activeScene || !svg || cancelled) return;

      // The current Grida SVG importer does not consistently resolve every
      // remote/data URI image source. Keep image-rich posters on the proven
      // native SVG renderer instead of silently dropping their assets.
      const current = documentRef.current;
      if (current.background.image || current.layers.some((layer) => layer.kind === 'image')) {
        readyCallbackRef.current(false);
        return;
      }

      try {
        const markup = new XMLSerializer().serializeToString(svg);
        const gridaDocument = activeScene.svgkit.toDocument(markup);
        if (!gridaDocument?.byteLength) throw new Error('Grida could not parse the poster SVG.');
        activeScene.loadSceneGrida(gridaDocument);
        activeScene.resize(current.width, current.height);
        activeScene.redraw();
        readyCallbackRef.current(true);
      } catch (error) {
        console.warn('Grida could not render this poster; using native SVG rendering.', error);
        readyCallbackRef.current(false);
      }
    }

    void start(canvasElement);

    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [svgRef]);

  useEffect(() => {
    // React updates the SVG before this effect runs, so serialize the current
    // document once per committed edit. Image documents deliberately stay on
    // native SVG so assets never disappear while switching renderers.
    const scene = sceneRef.current;
    const svg = svgRef.current;
    if (!scene || !svg) return;
    if (document.background.image || document.layers.some((layer) => layer.kind === 'image')) {
      onReady(false);
      return;
    }
    try {
      const bytes = scene.svgkit.toDocument(new XMLSerializer().serializeToString(svg));
      if (!bytes?.byteLength) throw new Error('Grida could not parse the poster SVG.');
      scene.loadSceneGrida(bytes);
      scene.resize(document.width, document.height);
      scene.redraw();
      onReady(true);
    } catch (error) {
      console.warn('Grida could not render this poster; using native SVG rendering.', error);
      onReady(false);
    }
  }, [document, svgRef]);

  return <canvas ref={canvasRef} className="grida-canvas-surface" aria-hidden="true" />;
}
