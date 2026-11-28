import { useEffect, useRef, useState } from 'react';
import type { DragEvent, PointerEvent, RefObject } from 'react';
import {
  ArrowDown, ArrowUp, Check, Circle, Clock3, Copy, Download, Eraser, Eye,
  EyeOff, FileImage, Image, Layers2, Lock, MousePointer2, Pencil, Plus,
  Redo2, Square, Trash2, Type, Undo2, Unlock, X,
} from 'lucide-react';
import {
  createInitialDocument, makeTextLayer, PosterDocumentSchema, restoreDocument,
} from './model';
import type { AssetLayer, PathLayer, PosterDocument, PosterLayer, TextLayer } from './model';
import { CanvasColorField, CanvasNumberField, CanvasTextField } from './CanvasInspectorFields';
import { GridaCanvasSurface } from './GridaCanvasSurface';
import { usePosterAgentTools } from './use-poster-agent-tools';

type Tool = 'select' | 'text' | 'pencil' | 'eraser';
type History = { past: PosterDocument[]; future: PosterDocument[] };
type DragState = { layerId: string; pointerX: number; pointerY: number; layerX: number; layerY: number };
type DrawState = { id: string; points: Array<[number, number]> };

const STORAGE_KEY = 'aurora-poster-document-v2';
const PALETTE = ['#ed6848', '#c5e35b', '#6a83eb', '#b6a0ef', '#242521', '#fffdf8'];

function readDocument(): PosterDocument {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return restoreDocument(JSON.parse(current));
    const old = localStorage.getItem('aurora-agent-canvas-v1');
    return old ? restoreDocument(JSON.parse(old)) : createInitialDocument();
  } catch {
    return createInitialDocument();
  }
}

function layerFontWeight(weight: TextLayer['fontWeight']) {
  return weight === 'normal' ? 400 : weight === 'medium' ? 500 : weight === 'semibold' ? 600 : 700;
}

function layerKindLabel(layer: PosterLayer) {
  if (layer.kind === 'text') return 'Texte';
  if (layer.kind === 'shape') return layer.shape === 'rect' ? 'Rectangle' : 'Ellipse';
  if (layer.kind === 'image') return 'Image';
  return 'Dessin';
}

function layerRoleLabel(role: PosterLayer['role']) {
  const labels: Record<NonNullable<PosterLayer['role']>, string> = {
    brand: 'Marque', title: 'Titre', subtitle: 'Sous-titre', 'date-label': 'Libellé date', date: 'Date',
    'place-label': 'Libellé lieu', place: 'Lieu', cta: 'Appel à l’action', decoration: 'Décoration', asset: 'Visuel',
  };
  return role ? labels[role] : 'Élément libre';
}

function PosterLayerView({
  layer, selected, tool, onSelect, onDragStart,
}: {
  layer: PosterLayer;
  selected: boolean;
  tool: Tool;
  onSelect: (layerId: string) => void;
  onDragStart: (layerId: string, event: PointerEvent<SVGGElement>) => void;
}) {
  if (!layer.visible) return null;
  const pointerDown = (event: PointerEvent<SVGGElement>) => {
    if (tool === 'select' && !layer.locked) onDragStart(layer.id, event);
  };
  const click = () => {
    if (tool === 'select' || tool === 'text') onSelect(layer.id);
  };
  const rotation = layer.rotation ? `rotate(${layer.rotation} ${layer.x + layer.width / 2} ${layer.y + layer.height / 2})` : undefined;
  return <g
    transform={rotation}
    opacity={layer.opacity}
    className={`poster-object ${selected ? 'is-selected' : ''}`}
    onPointerDown={pointerDown}
    onClick={click}
    data-layer-id={layer.id}
    aria-label={layer.name}
    style={{ cursor: layer.locked ? 'not-allowed' : tool === 'select' ? 'grab' : 'pointer' }}
  >
    <title>{layer.name}{layer.locked ? ' · verrouillé' : ''}</title>
    {layer.kind === 'text' && <text
      x={layer.align === 'start' ? layer.x : layer.align === 'middle' ? layer.x : layer.x + layer.width}
      y={layer.y + layer.fontSize}
      fill={layer.color}
      textAnchor={layer.align}
      fontFamily={layer.fontFamily}
      fontSize={layer.fontSize}
      fontWeight={layerFontWeight(layer.fontWeight)}
      letterSpacing={layer.letterSpacing}
    >{layer.text.split('\n').map((line, index) => <tspan key={`${layer.id}-${index}`} x={layer.align === 'start' ? layer.x : layer.align === 'middle' ? layer.x : layer.x + layer.width} dy={index === 0 ? 0 : layer.fontSize * layer.lineHeight}>{line || ' '}</tspan>)}</text>}
    {layer.kind === 'shape' && layer.shape === 'rect' && <rect
      x={layer.x} y={layer.y} width={layer.width} height={layer.height} rx={Math.min(layer.radius, layer.height / 2)}
      fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth}
    />}
    {layer.kind === 'shape' && layer.shape === 'ellipse' && <ellipse
      cx={layer.x + layer.width / 2} cy={layer.y + layer.height / 2} rx={layer.width / 2} ry={layer.height / 2}
      fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth}
    />}
    {layer.kind === 'path' && <g transform={`translate(${layer.x} ${layer.y}) scale(${layer.scaleX ?? 1} ${layer.scaleY ?? 1})`}><path d={layer.d} fill={layer.fill} stroke={layer.stroke} strokeWidth={layer.strokeWidth} strokeLinecap="round" strokeLinejoin="round" /></g>}
    {layer.kind === 'image' && <image
      href={layer.src} x={layer.x} y={layer.y} width={layer.width} height={layer.height}
      preserveAspectRatio={layer.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
      aria-label={layer.alt}
    />}
  </g>;
}

function PosterSvg({
  document, svgRef, tool, selectedLayerId, renderedByGrida, onSelect, onDragStart, onTextStart, onStrokeStart, onStrokeMove, onStrokeEnd, onErase,
}: {
  document: PosterDocument;
  svgRef: RefObject<SVGSVGElement | null>;
  tool: Tool;
  selectedLayerId: string | null;
  renderedByGrida: boolean;
  onSelect: (layerId: string) => void;
  onDragStart: (layerId: string, event: PointerEvent<SVGGElement>) => void;
  onTextStart: (event: PointerEvent<SVGSVGElement>) => void;
  onStrokeStart: (event: PointerEvent<SVGSVGElement>) => void;
  onStrokeMove: (event: PointerEvent<SVGSVGElement>) => void;
  onStrokeEnd: () => void;
  onErase: (event: PointerEvent<SVGSVGElement>) => void;
}) {
  const backgroundImage = document.background.image;
  return <svg
    ref={svgRef}
    viewBox={`0 0 ${document.width} ${document.height}`}
    width={document.width}
    height={document.height}
    className={`poster-art tool-${tool} ${renderedByGrida ? 'grida-hit-surface' : ''}`}
    role="img"
    aria-label={`Canvas éditable : ${document.title}`}
    xmlns="http://www.w3.org/2000/svg"
    onPointerMove={onStrokeMove}
    onPointerUp={onStrokeEnd}
    onPointerLeave={onStrokeEnd}
    onPointerDown={tool === 'pencil' ? onStrokeStart : tool === 'eraser' ? onErase : tool === 'text' ? onTextStart : undefined}
  >
    <rect width={document.width} height={document.height} fill={document.background.color} />
    {backgroundImage && <image
      href={backgroundImage.src}
      x={0} y={0} width={document.width} height={document.height}
      preserveAspectRatio={backgroundImage.fit === 'cover' ? 'xMidYMid slice' : 'xMidYMid meet'}
      aria-label={`Fond : ${backgroundImage.alt}`}
    />}
    {document.layers.map((layer) => <PosterLayerView
      key={layer.id}
      layer={layer}
      selected={selectedLayerId === layer.id}
      tool={tool}
      onSelect={onSelect}
      onDragStart={onDragStart}
    />)}
  </svg>;
}

export default function PosterCanvas() {
  const [document, setDocument] = useState<PosterDocument>(readDocument);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>('select');
  const [saved, setSaved] = useState(true);
  const [zoom, setZoom] = useState(84);
  const [gridaReady, setGridaReady] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [pendingBackgroundPrompt, setPendingBackgroundPrompt] = useState('');
  const [generatingBackground, setGeneratingBackground] = useState(false);
  const [toast, setToast] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<History>({ past: [], future: [] });
  const dragRef = useRef<DragState | null>(null);
  const drawingRef = useRef<DrawState | null>(null);
  const selectedLayer = document.layers.find((layer) => layer.id === selectedLayerId) ?? null;

  function pushHistory(snapshot: PosterDocument) {
    historyRef.current.past = [...historyRef.current.past.slice(-49), snapshot];
    historyRef.current.future = [];
    setHistoryVersion((version) => version + 1);
  }

  function commitDocument(next: PosterDocument) {
    const valid = PosterDocumentSchema.safeParse(next);
    if (!valid.success) {
      showToast('Modification refusée : le document ne respecte pas son schéma.');
      return false;
    }
    pushHistory(document);
    setDocument(valid.data);
    return true;
  }

  function updateLayer(layerId: string, updates: Partial<PosterLayer>) {
    const layers = document.layers.map((layer) => layer.id === layerId ? { ...layer, ...updates } as PosterLayer : layer);
    commitDocument({ ...document, layers });
  }

  function undo() {
    const previous = historyRef.current.past.pop();
    if (!previous) return false;
    historyRef.current.future.push(document);
    setDocument(previous);
    setHistoryVersion((version) => version + 1);
    return true;
  }

  function redo() {
    const next = historyRef.current.future.pop();
    if (!next) return;
    historyRef.current.past.push(document);
    setDocument(next);
    setHistoryVersion((version) => version + 1);
  }

  function requestBackgroundConfirmation(prompt: string) {
    setPendingBackgroundPrompt(prompt);
    setShowLayers(false);
  }

  async function makeForegroundPreview(): Promise<string | undefined> {
    const svg = svgRef.current;
    if (!svg || document.layers.every((layer) => !layer.visible)) return undefined;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const backgroundRect = Array.from(clone.children).find((child) => child.tagName.toLowerCase() === 'rect');
    backgroundRect?.remove();
    if (document.background.image) {
      const backgroundImage = Array.from(clone.children).find((child) => child.tagName.toLowerCase() === 'image');
      backgroundImage?.remove();
    }
    const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new window.Image();
      image.src = svgUrl;
      await image.decode();
      const canvas = window.document.createElement('canvas');
      canvas.width = document.width;
      canvas.height = document.height;
      const context = canvas.getContext('2d');
      if (!context) return undefined;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/png');
    } catch {
      // A remote image without CORS permission can taint the canvas. In that case
      // Agnes still generates a separate background from the written prompt.
      return undefined;
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  async function confirmBackgroundGeneration() {
    if (!pendingBackgroundPrompt || generatingBackground) return;
    setGeneratingBackground(true);
    try {
      const ratios = ['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9'];
      const targetRatio = document.width / document.height;
      const ratio = ratios.reduce((closest, candidate) => {
        const value = candidate.split(':').map(Number);
        const candidateRatio = value[0] / value[1];
        const closestValue = closest.split(':').map(Number);
        return Math.abs(Math.log(candidateRatio / targetRatio)) < Math.abs(Math.log((closestValue[0] / closestValue[1]) / targetRatio)) ? candidate : closest;
      });
      const foregroundDataUri = await makeForegroundPreview();
      const response = await fetch('/api/agnes/background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: pendingBackgroundPrompt, ratio, foregroundDataUri }),
      });
      const result = await response.json() as { dataUri?: string; model?: string; error?: string };
      if (!response.ok || !result.dataUri || !result.model) throw new Error(result.error ?? 'Agnes image generation failed.');
      const generatedImage: AssetLayer = {
        id: `agnes-background-${Date.now()}`,
        name: 'Fond généré par Agnes',
        kind: 'image',
        role: 'asset',
        x: 0, y: 0, width: document.width, height: document.height,
        rotation: 0, opacity: 1, visible: true, locked: false,
        src: result.dataUri,
        alt: 'Fond de poster généré séparément par Agnes AI',
        fit: 'cover',
        provenance: {
          origin: 'agnes-generated',
          attribution: 'Agnes AI',
          license: 'Conditions du compte Agnes AI à vérifier',
          model: result.model,
          prompt: pendingBackgroundPrompt,
        },
      };
      if (!commitDocument({ ...document, background: { color: document.background.color, image: generatedImage } })) {
        throw new Error('The generated background could not be added to this document.');
      }
      showToast(foregroundDataUri ? 'Fond Agnes ajouté sous les calques éditables.' : 'Fond Agnes ajouté; la référence visuelle n’a pas pu être transmise.');
      setPendingBackgroundPrompt('');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'La génération du fond a échoué.');
    } finally {
      setGeneratingBackground(false);
    }
  }

  usePosterAgentTools(document, commitDocument, undo, requestBackgroundConfirmation);

  useEffect(() => {
    setSaved(false);
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(document));
        setSaved(true);
      } catch {
        showToast('Sauvegarde locale impossible : retirez un asset trop volumineux.');
        setSaved(false);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [document]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = target?.matches('input, textarea, select, [contenteditable="true"]');
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.key.toLowerCase() === 'z' && !editing) {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === 'y' && !editing) { event.preventDefault(); redo(); return; }
      if (modifier && event.key.toLowerCase() === 'd' && !editing) { event.preventDefault(); duplicateSelectedLayer(); return; }
      if (event.key === 'Escape') { setSelectedLayerId(null); setTool('select'); return; }
      if (editing || !selectedLayer) return;
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelectedLayer(); return; }
      const step = event.shiftKey ? 10 : 1;
      if (event.key === 'ArrowLeft') { event.preventDefault(); nudgeSelectedLayer(-step, 0); }
      if (event.key === 'ArrowRight') { event.preventDefault(); nudgeSelectedLayer(step, 0); }
      if (event.key === 'ArrowUp') { event.preventDefault(); nudgeSelectedLayer(0, -step); }
      if (event.key === 'ArrowDown') { event.preventDefault(); nudgeSelectedLayer(0, step); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  }

  function toCanvasPoint(event: { clientX: number; clientY: number }) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * document.width / rect.width,
      y: (event.clientY - rect.top) * document.height / rect.height,
    };
  }

  function beginDrag(layerId: string, event: PointerEvent<SVGGElement>) {
    const layer = document.layers.find((item) => item.id === layerId);
    if (!layer || layer.locked) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    pushHistory(document);
    const point = toCanvasPoint(event);
    dragRef.current = { layerId, pointerX: point.x, pointerY: point.y, layerX: layer.x, layerY: layer.y };
    setSelectedLayerId(layerId);
  }

  function handleCanvasMove(event: PointerEvent<SVGSVGElement>) {
    const point = toCanvasPoint(event);
    if (dragRef.current) {
      const drag = dragRef.current;
      setDocument((current) => ({
        ...current,
        layers: current.layers.map((layer) => layer.id !== drag.layerId ? layer : {
          ...layer,
          x: Math.max(0, Math.min(current.width - Math.min(layer.width, current.width), drag.layerX + point.x - drag.pointerX)),
          y: Math.max(0, Math.min(current.height - Math.min(layer.height, current.height), drag.layerY + point.y - drag.pointerY)),
        }),
      }));
    }
    if (drawingRef.current) {
      const drawing = drawingRef.current;
      drawing.points.push([point.x, point.y]);
      const d = drawing.points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
      setDocument((current) => ({
        ...current,
        layers: current.layers.map((layer) => layer.id === drawing.id && layer.kind === 'path' ? { ...layer, d } : layer),
      }));
    }
  }

  function endPointer() {
    dragRef.current = null;
    drawingRef.current = null;
  }

  function handleCanvasTextStart(event: PointerEvent<SVGSVGElement>) {
    if (tool !== 'text') return;
    const target = event.target;
    if (target instanceof Element && target.closest('[data-layer-id]')) return;
    event.preventDefault();
    const point = toCanvasPoint(event);
    addTextLayer({ x: point.x, y: point.y });
  }

  function beginStroke(event: PointerEvent<SVGSVGElement>) {
    if (tool !== 'pencil') return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pushHistory(document);
    const point = toCanvasPoint(event);
    const id = `path-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    drawingRef.current = { id, points: [[point.x, point.y]] };
    const layer: PathLayer = {
      id, name: 'Tracé au crayon', kind: 'path', role: 'decoration', x: 0, y: 0,
      width: document.width, height: document.height, rotation: 0, opacity: 1, visible: true, locked: false, d: `M ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
      stroke: '#252620', strokeWidth: Math.max(2, document.width / 130), fill: 'none',
    };
    setDocument((current) => ({ ...current, layers: [...current.layers, layer] }));
  }

  function eraseAt(event: PointerEvent<SVGSVGElement>) {
    if (tool !== 'eraser') return;
    const point = toCanvasPoint(event);
    const removable = [...document.layers].reverse().find((layer) => {
      if (layer.kind !== 'path' || layer.locked) return false;
      const numbers = layer.d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      for (let index = 0; index + 1 < numbers.length; index += 2) {
        if (Math.hypot(numbers[index] - point.x, numbers[index + 1] - point.y) < 30) return true;
      }
      return false;
    });
    if (!removable) return;
    commitDocument({ ...document, layers: document.layers.filter((layer) => layer.id !== removable.id) });
  }

  function reorderLayer(layerId: string, direction: -1 | 1) {
    const index = document.layers.findIndex((layer) => layer.id === layerId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= document.layers.length) return;
    const layers = [...document.layers];
    [layers[index], layers[target]] = [layers[target], layers[index]];
    commitDocument({ ...document, layers });
  }

  function setLayerOrBackgroundColor(color: string) {
    if (selectedLayer?.locked) { showToast('Déverrouillez le calque avant de modifier sa couleur.'); return; }
    if (!selectedLayer) {
      commitDocument({ ...document, background: { color } });
      return;
    }
    const layers = document.layers.map((layer) => {
      if (layer.id !== selectedLayer.id) return layer;
      if (layer.kind === 'text') return { ...layer, color };
      if (layer.kind === 'shape') return { ...layer, fill: color };
      if (layer.kind === 'path') return { ...layer, stroke: color };
      return layer;
    });
    commitDocument({ ...document, layers });
  }

  function addTextLayer(point?: { x: number; y: number }) {
    if (document.layers.length >= 120) return showToast('Le document a atteint la limite de calques.');
    const id = `text-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    const layer = makeTextLayer({ id, text: 'Votre texte', x: point?.x ?? document.width * 0.1, y: point?.y ?? document.height * 0.25, fontSize: Math.max(28, document.width * 0.09), name: 'Nouveau texte' });
    if (commitDocument({ ...document, layers: [...document.layers, { ...layer, role: 'title', width: document.width * 0.8, fontFamily: 'Manrope, Arial, sans-serif', fontWeight: 'bold' }] })) {
      setSelectedLayerId(id);
      setTool('select');
    }
  }

  function addShapeLayer(shape: 'rect' | 'ellipse') {
    if (document.layers.length >= 120) return showToast('Le document a atteint la limite de calques.');
    const width = document.width * 0.24;
    const height = document.height * 0.12;
    const id = `shape-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    const layer = { id, name: shape === 'rect' ? 'Rectangle' : 'Ellipse', kind: 'shape' as const, role: 'decoration' as const, shape, x: (document.width - width) / 2, y: (document.height - height) / 2, width, height, rotation: 0, opacity: 1, visible: true, locked: false, fill: '#ed6848', strokeWidth: 0, radius: shape === 'rect' ? 12 : 0 };
    if (commitDocument({ ...document, layers: [...document.layers, layer] })) setSelectedLayerId(id);
  }

  function nudgeSelectedLayer(dx: number, dy: number) {
    if (!selectedLayer) return;
    if (selectedLayer.locked) return showToast('Ce calque est verrouillé.');
    updateLayer(selectedLayer.id, {
      x: Math.max(0, Math.min(document.width - Math.min(selectedLayer.width, document.width), selectedLayer.x + dx)),
      y: Math.max(0, Math.min(document.height - Math.min(selectedLayer.height, document.height), selectedLayer.y + dy)),
    });
  }

  function deleteSelectedLayer() {
    if (!selectedLayer) return;
    if (selectedLayer.locked) return showToast('Déverrouillez ce calque avant de le supprimer.');
    if (commitDocument({ ...document, layers: document.layers.filter((layer) => layer.id !== selectedLayer.id) })) setSelectedLayerId(null);
  }

  function duplicateSelectedLayer() {
    if (!selectedLayer) return;
    if (selectedLayer.locked) return showToast('Déverrouillez ce calque avant de le dupliquer.');
    if (document.layers.length >= 120) return showToast('Le document a atteint la limite de calques.');
    const id = `${selectedLayer.kind}-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
    const copy = { ...selectedLayer, id, name: `${selectedLayer.name} · copie`, x: Math.min(document.width - selectedLayer.width, selectedLayer.x + 18), y: Math.min(document.height - selectedLayer.height, selectedLayer.y + 18), locked: false } as PosterLayer;
    if (commitDocument({ ...document, layers: [...document.layers, copy] })) setSelectedLayerId(id);
  }

  function resizeCanvas(width: number, height: number) {
    const scaleX = width / document.width;
    const scaleY = height / document.height;
    const uniformScale = Math.min(scaleX, scaleY);
    const layers = document.layers.map((layer) => {
      if (layer.locked) return layer;
      const layerWidth = Math.min(width, layer.width * scaleX);
      const layerHeight = Math.min(height, layer.height * scaleY);
      const x = Math.max(0, Math.min(width - layerWidth, layer.x * scaleX));
      const y = Math.max(0, Math.min(height - layerHeight, layer.y * scaleY));
      if (layer.kind === 'text') return { ...layer, x, y, width: layerWidth, height: layerHeight, fontSize: Math.min(240, Math.max(6, layer.fontSize * uniformScale)) };
      if (layer.kind === 'shape') return { ...layer, x, y, width: layerWidth, height: layerHeight, radius: layer.radius * uniformScale, strokeWidth: layer.strokeWidth * uniformScale };
      if (layer.kind === 'path') return { ...layer, x, y, width: layerWidth, height: layerHeight, scaleX: (layer.scaleX ?? 1) * scaleX, scaleY: (layer.scaleY ?? 1) * scaleY, strokeWidth: layer.strokeWidth * uniformScale };
      return { ...layer, x, y, width: layerWidth, height: layerHeight };
    });
    if (commitDocument({ ...document, width, height, layers })) showToast(`Format modifié : ${width} × ${height}. Les calques verrouillés ont conservé leur géométrie.`);
  }

  function addUploadedImage(file: File, point?: { x: number; y: number }) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      showToast('Formats acceptés : PNG, JPG ou WebP.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image trop lourde : maximum 2 Mo pour ce prototype.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const id = `upload-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
      const image: AssetLayer = {
        id,
        name: file.name.slice(0, 100),
        kind: 'image',
        role: 'asset',
        x: point?.x ?? document.width * 0.2,
        y: point?.y ?? document.height * 0.2,
        width: document.width * 0.6,
        height: document.height * 0.34,
        rotation: 0,
        opacity: 1,
        visible: true,
        locked: false,
        src: reader.result,
        alt: file.name,
        fit: 'contain',
        provenance: { origin: 'user-upload', attribution: `Importé par l’utilisateur : ${file.name}`, license: 'Fourni par l’utilisateur' },
      };
      commitDocument({ ...document, layers: [...document.layers, image] });
      setSelectedLayerId(id);
      showToast('Image ajoutée comme calque indépendant.');
    };
    reader.onerror = () => showToast('Lecture de l’image impossible.');
    reader.readAsDataURL(file);
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) addUploadedImage(file);
    event.currentTarget.value = '';
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const rect = event.currentTarget.getBoundingClientRect();
    addUploadedImage(file, {
      x: Math.max(0, (event.clientX - rect.left) * document.width / rect.width),
      y: Math.max(0, (event.clientY - rect.top) * document.height / rect.height),
    });
  }

  function exportFileName(extension: string) {
    return `${document.title.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'aurora-poster'}.${extension}`;
  }

  function exportSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const serialized = new XMLSerializer().serializeToString(clone);
    const url = URL.createObjectURL(new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }));
    const link = window.document.createElement('a');
    link.href = url;
    link.download = exportFileName('svg');
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('SVG éditable exporté. Vérifiez les droits des assets externes.');
  }

  async function exportPng() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const image = new window.Image();
      image.src = svgUrl;
      await image.decode();
      const canvas = window.document.createElement('canvas');
      canvas.width = document.width;
      canvas.height = document.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Canvas de rendu indisponible.');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Export PNG impossible; vérifiez les droits/CORS des images distantes.');
      const pngUrl = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = pngUrl;
      link.download = exportFileName('png');
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(pngUrl), 1000);
      showToast(`PNG exporté en ${document.width} × ${document.height}.`);
    } catch {
      showToast('Export PNG bloqué par un asset distant sans CORS. Essayez l’export SVG.');
    } finally {
      URL.revokeObjectURL(svgUrl);
    }
  }

  const canUndo = historyRef.current.past.length > 0;
  const canRedo = historyRef.current.future.length > 0;
  const currentColor = selectedLayer?.kind === 'text' ? selectedLayer.color : selectedLayer?.kind === 'shape' && selectedLayer.fill !== 'none' ? selectedLayer.fill : selectedLayer?.kind === 'path' ? selectedLayer.stroke : document.background.color;
  void historyVersion;

  return <section className="canvas-side">
    <header className="canvas-header">
      <div className="canvas-title"><span className="canvas-status-dot" /><div><strong>Canvas en direct</strong><small>{document.title} · {document.width} × {document.height}</small></div></div>
      <div className="canvas-header-actions"><button className="export-button" onClick={exportSvg}><Download size={14} /><span>SVG</span></button><button className="export-button export-png-button" onClick={() => void exportPng()}><FileImage size={14} /><span>PNG</span></button><button className="more-canvas" aria-label="Afficher les calques" title="Afficher les calques" onClick={() => setShowLayers(!showLayers)}><Layers2 size={16} /></button></div>
    </header>
    <div className="canvas-toolsbar">
      <div className="canvas-tool-groups">
        <div className="tool-switcher" aria-label="Outils canvas">
          {([{ id: 'select', icon: MousePointer2, label: 'Sélectionner' }, { id: 'text', icon: Type, label: 'Texte' }, { id: 'pencil', icon: Pencil, label: 'Crayon' }, { id: 'eraser', icon: Eraser, label: 'Gomme' }] as const).map(({ id, icon: Icon, label }) => <button key={id} className={tool === id ? 'active' : ''} onClick={() => { setTool(id); setSelectedLayerId(null); }} title={label} aria-label={label}><Icon size={15} /></button>)}
          <span className="tool-divider" />
          <button className={`tool-icon ${canUndo ? '' : 'disabled'}`} title="Annuler" onClick={undo} disabled={!canUndo}><Undo2 size={15} /></button>
          <button className={`tool-icon ${canRedo ? '' : 'disabled'}`} title="Rétablir" onClick={redo} disabled={!canRedo}><Redo2 size={15} /></button>
        </div>
        <div className="object-add-tools"><button onClick={() => addTextLayer()} title="Ajouter un texte éditable"><Type size={14} /><span>Texte</span></button><button onClick={() => addShapeLayer('rect')} title="Ajouter un rectangle" aria-label="Ajouter un rectangle"><Square size={13} /></button><button onClick={() => addShapeLayer('ellipse')} title="Ajouter une ellipse" aria-label="Ajouter une ellipse"><Circle size={13} /></button></div>
        <button className="import-image-button" onClick={() => fileRef.current?.click()} title="Importer une image comme calque"><Image size={14} /><span>Importer</span></button>
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleFileChange} />
      <div className="canvas-view-controls">
        <div className="canvas-colors" aria-label="Couleur active">{PALETTE.map((color) => <button key={color} className={`color-dot ${currentColor === color ? 'active' : ''}`} style={{ background: color }} onClick={() => setLayerOrBackgroundColor(color)} aria-label={`Appliquer ${color} au calque actif ou au fond`} />)}<label className="color-add" title="Choisir une couleur personnalisée"><input type="color" aria-label="Couleur personnalisée" value={currentColor} onChange={(event) => setLayerOrBackgroundColor(event.target.value)} /><Plus size={13} /></label></div>
        <label className="format-picker"><span>Format</span><select value={['520,720','1080,1920','1080,1350','1080,1080','1920,1080'].includes(`${document.width},${document.height}`) ? `${document.width},${document.height}` : 'custom'} onChange={(event) => { const [width, height] = event.target.value.split(',').map(Number); if (width && height) resizeCanvas(width, height); }}><option value="custom">Personnalisé</option><option value="520,720">Affiche portrait</option><option value="1080,1920">Story 9:16</option><option value="1080,1350">Post 4:5</option><option value="1080,1080">Carré 1:1</option><option value="1920,1080">Paysage 16:9</option></select></label>
        <div className="zoom-controls"><button aria-label="Réduire le zoom" onClick={() => setZoom((value) => Math.max(60, value - 10))}>−</button><span>{zoom}%</span><button aria-label="Augmenter le zoom" onClick={() => setZoom((value) => Math.min(140, value + 10))}>+</button></div>
      </div>
    </div>
    {showLayers && <aside className="layers-panel" aria-label="Structure des calques">
      <div className="layers-heading"><div><strong>Structure</strong><small>{document.layers.length} élément{document.layers.length === 1 ? '' : 's'} · du premier plan au fond</small></div><button onClick={() => setShowLayers(false)} aria-label="Fermer les calques"><X size={15} /></button></div>
      {document.layers.length === 0 ? <div className="layers-empty"><Layers2 size={18} /><span>Aucun élément pour le moment.</span><small>Ajoutez du texte, une forme ou une image pour commencer.</small></div> : <div className="layers-list">{[...document.layers].reverse().map((layer) => <article key={layer.id} className={`layer-row ${selectedLayerId === layer.id ? 'selected' : ''} ${layer.visible ? '' : 'is-hidden'}`}>
        <button className="layer-select" onClick={() => setSelectedLayerId(layer.id)} aria-label={`Sélectionner ${layer.name}`}><span className="layer-kind-icon">{layer.kind === 'text' ? <Type size={15} /> : layer.kind === 'image' ? <Image size={15} /> : layer.kind === 'path' ? <Pencil size={15} /> : <Square size={15} />}</span><span className="layer-copy"><strong>{layer.name}</strong><small>{layerKindLabel(layer)} <i /> {layerRoleLabel(layer.role)}</small><small className="layer-dimensions">{Math.round(layer.width)} × {Math.round(layer.height)} px · x {Math.round(layer.x)}, y {Math.round(layer.y)}</small></span></button>
        <div className="layer-actions"><button title={layer.visible ? 'Masquer le calque' : 'Afficher le calque'} aria-label={layer.visible ? `Masquer ${layer.name}` : `Afficher ${layer.name}`} onClick={() => updateLayer(layer.id, { visible: !layer.visible } as Partial<PosterLayer>)}>{layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}</button><button title={layer.locked ? 'Déverrouiller le calque' : 'Verrouiller le calque'} aria-label={layer.locked ? `Déverrouiller ${layer.name}` : `Verrouiller ${layer.name}`} onClick={() => updateLayer(layer.id, { locked: !layer.locked } as Partial<PosterLayer>)}>{layer.locked ? <Lock size={14} /> : <Unlock size={14} />}</button><button title="Monter le calque" aria-label={`Monter ${layer.name}`} disabled={document.layers.at(-1)?.id === layer.id} onClick={() => reorderLayer(layer.id, 1)}><ArrowUp size={13} /></button><button title="Descendre le calque" aria-label={`Descendre ${layer.name}`} disabled={document.layers[0]?.id === layer.id} onClick={() => reorderLayer(layer.id, -1)}><ArrowDown size={13} /></button></div>
      </article>)}</div>}
    </aside>}
    {pendingBackgroundPrompt && <div className="background-confirmation"><div><strong>Confirmer la génération du fond ?</strong><p>Agnes AI recevra votre prompt et, si possible, un aperçu de premier plan pour composer un fond séparé. La génération peut être facturée selon votre compte Agnes.</p><small>{pendingBackgroundPrompt}</small></div><button className="confirm-cancel" disabled={generatingBackground} onClick={() => setPendingBackgroundPrompt('')}>Annuler</button><button className="confirm-generate" disabled={generatingBackground} onClick={() => void confirmBackgroundGeneration()}>{generatingBackground ? 'Génération…' : 'Confirmer'}</button></div>}
    {selectedLayer && <div className="selection-edit"><span>{selectedLayer.kind === 'text' ? <Type size={13} /> : selectedLayer.kind === 'image' ? <Image size={13} /> : <Layers2 size={13} />}{selectedLayer.name}{selectedLayer.locked && <Lock size={11} />}</span>{selectedLayer.kind === 'image' && <small className="asset-provenance">{selectedLayer.provenance.attribution} · {selectedLayer.provenance.license}</small>}<button onClick={duplicateSelectedLayer} aria-label="Dupliquer le calque" disabled={selectedLayer.locked}><Copy size={13} /></button><button onClick={deleteSelectedLayer} aria-label="Supprimer le calque" disabled={selectedLayer.locked}><Trash2 size={13} /></button><button onClick={() => setSelectedLayerId(null)} aria-label="Désélectionner"><X size={14} /></button></div>}
    {selectedLayer && <div className="layer-inspector">
      <section className="inspector-section"><h3>Élément</h3><div className="inspector-grid identity-fields"><CanvasTextField label="Nom du calque" value={selectedLayer.name} disabled={selectedLayer.locked} onCommit={(name) => updateLayer(selectedLayer.id, { name })} />{selectedLayer.kind === 'text' && <CanvasTextField label="Contenu texte" value={selectedLayer.text} multiline disabled={selectedLayer.locked} onCommit={(text) => updateLayer(selectedLayer.id, { text })} />}</div></section>
      <section className="inspector-section"><h3>Position et dimensions</h3><div className="inspector-grid geometry-fields"><CanvasNumberField label="X" value={selectedLayer.x} min={0} max={document.width} disabled={selectedLayer.locked} onCommit={(x) => updateLayer(selectedLayer.id, { x })} /><CanvasNumberField label="Y" value={selectedLayer.y} min={0} max={document.height} disabled={selectedLayer.locked} onCommit={(y) => updateLayer(selectedLayer.id, { y })} /><CanvasNumberField label="Largeur" value={selectedLayer.width} min={8} max={document.width} disabled={selectedLayer.locked} onCommit={(width) => updateLayer(selectedLayer.id, { width })} /><CanvasNumberField label="Hauteur" value={selectedLayer.height} min={8} max={document.height} disabled={selectedLayer.locked} onCommit={(height) => updateLayer(selectedLayer.id, { height })} /><CanvasNumberField label="Rotation" value={selectedLayer.rotation} min={-360} max={360} disabled={selectedLayer.locked} onCommit={(rotation) => updateLayer(selectedLayer.id, { rotation })} /><CanvasNumberField label="Opacité" value={selectedLayer.opacity} min={0} max={1} step={0.05} disabled={selectedLayer.locked} onCommit={(opacity) => updateLayer(selectedLayer.id, { opacity })} /></div></section>
      <section className="inspector-section"><h3>Apparence</h3><div className="inspector-grid style-fields">{selectedLayer.kind === 'text' && <><CanvasNumberField label="Corps" value={selectedLayer.fontSize} min={6} max={240} disabled={selectedLayer.locked} onCommit={(fontSize) => updateLayer(selectedLayer.id, { fontSize })} /><CanvasColorField label="Couleur" value={selectedLayer.color} disabled={selectedLayer.locked} onCommit={(color) => updateLayer(selectedLayer.id, { color })} /><label className="inspector-field"><span>Alignement</span><select value={selectedLayer.align} disabled={selectedLayer.locked} onChange={(event) => updateLayer(selectedLayer.id, { align: event.target.value as TextLayer['align'] })}><option value="start">Gauche</option><option value="middle">Centre</option><option value="end">Droite</option></select></label><label className="inspector-field"><span>Graisse</span><select value={selectedLayer.fontWeight} disabled={selectedLayer.locked} onChange={(event) => updateLayer(selectedLayer.id, { fontWeight: event.target.value as TextLayer['fontWeight'] })}><option value="normal">Normale</option><option value="medium">Moyenne</option><option value="semibold">Semi-gras</option><option value="bold">Gras</option></select></label></>}{selectedLayer.kind === 'shape' && <CanvasColorField label="Remplissage" value={selectedLayer.fill === 'none' ? '#ffffff' : selectedLayer.fill} disabled={selectedLayer.locked} onCommit={(fill) => updateLayer(selectedLayer.id, { fill })} />}{selectedLayer.kind === 'path' && <CanvasColorField label="Trait" value={selectedLayer.stroke} disabled={selectedLayer.locked} onCommit={(stroke) => updateLayer(selectedLayer.id, { stroke })} />}{selectedLayer.kind === 'image' && <label className="inspector-field"><span>Recadrage</span><select value={selectedLayer.fit} disabled={selectedLayer.locked} onChange={(event) => updateLayer(selectedLayer.id, { fit: event.target.value as AssetLayer['fit'] })}><option value="contain">Contenir</option><option value="cover">Remplir</option></select></label>}</div></section>
    </div>}
    <div className="poster-stage" onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
      <div className="stage-grid" />
      <div className="poster-wrapper" style={{ aspectRatio: `${document.width} / ${document.height}`, transform: `scale(${zoom / 84})` }}>
        <GridaCanvasSurface document={document} svgRef={svgRef} onReady={setGridaReady} />
        <PosterSvg document={document} svgRef={svgRef} tool={tool} selectedLayerId={selectedLayerId} renderedByGrida={gridaReady} onSelect={setSelectedLayerId} onDragStart={beginDrag} onTextStart={handleCanvasTextStart} onStrokeStart={beginStroke} onStrokeMove={handleCanvasMove} onStrokeEnd={endPointer} onErase={eraseAt} />
      </div>
      <div className="stage-label"><span>{gridaReady ? 'GRIDA · MOTEUR DE RENDU' : 'SVG · CALQUES ÉDITABLES'}</span><span>{document.layers.length} CALQUE{document.layers.length > 1 ? 'S' : ''}</span></div>
    </div>
    <div className="agent-stream">
      <div className="stream-heading"><div><span className="stream-pulse" /><strong>Document vivant</strong></div><span className="stream-mode">TEXTE · ASSETS · FOND SÉPARÉS</span></div>
      <div className="stream-placeholder"><span className="stream-lines"><i /><i /><i /></span><p>{document.layers.length === 0 ? 'Canevas vierge prêt pour votre idée.' : 'Chaque élément reste éditable et réversible.'}<br /><span>{document.layers.length === 0 ? 'Décrivez votre affiche à l’agent, ajoutez un asset, ou combinez les deux.' : 'Importez un asset ou demandez à l’agent un changement ciblé.'}</span></p></div>
    </div>
    <footer className="canvas-footer"><span><Layers2 size={13} /> {document.layers.length} calques · {saved ? 'enregistré' : 'enregistrement…'}</span><button onClick={() => showToast('Historique local limité aux 50 dernières opérations.')}><Clock3 size={13} />Historique</button><button onClick={() => { if (commitDocument(createInitialDocument())) { setSelectedLayerId(null); showToast('Document initial restauré.'); } }}><Undo2 size={13} />Réinitialiser</button></footer>
    {toast && <div className="toast"><Check size={14} />{toast}</div>}
  </section>;
}
