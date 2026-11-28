declare module '@grida/canvas-wasm/dist/index.mjs' {
  export interface GridaScene {
    svgkit: { toDocument(svg: string): Uint8Array | null };
    loadSceneGrida(data: Uint8Array): void;
    resize(width: number, height: number): void;
    redraw(): void;
    dispose(): void;
  }

  export interface GridaApplicationFactory {
    createWebGLCanvasSurface(canvas: HTMLCanvasElement): GridaScene;
  }

  export default function init(options?: {
    locateFile?: (path: string, scriptDirectory: string) => string;
  }): Promise<GridaApplicationFactory>;
}

declare module '@grida/canvas-wasm/dist/grida_canvas_wasm.wasm?url' {
  const assetUrl: string;
  export default assetUrl;
}
