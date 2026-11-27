import { z } from 'zod';

const provenanceSchema = z.object({
  origin: z.enum(['user-upload', 'external-url', 'design-library', 'agnes-generated']),
  attribution: z.string().max(240),
  license: z.string().max(160),
  sourceUrl: z.string().url().optional(),
  model: z.string().max(100).optional(),
  prompt: z.string().max(1600).optional(),
});

const commonLayer = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(100),
  x: z.number().finite().min(-2000).max(4000),
  y: z.number().finite().min(-2000).max(4000),
  width: z.number().finite().positive().max(4000),
  height: z.number().finite().positive().max(4000),
  rotation: z.number().finite().min(-360).max(360).default(0),
  opacity: z.number().min(0).max(1).default(1),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  role: z.enum(['brand', 'title', 'subtitle', 'date-label', 'date', 'place-label', 'place', 'cta', 'decoration', 'asset']).optional(),
});

const textLayerSchema = commonLayer.extend({
  kind: z.literal('text'),
  text: z.string().max(2000),
  fontFamily: z.string().max(120).default('Arial, sans-serif'),
  fontSize: z.number().finite().min(6).max(240),
  lineHeight: z.number().finite().min(0.8).max(3).default(1.2),
  fontWeight: z.enum(['normal', 'medium', 'semibold', 'bold']).default('normal'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  align: z.enum(['start', 'middle', 'end']).default('start'),
  letterSpacing: z.number().finite().min(-8).max(24).default(0),
});

const shapeLayerSchema = commonLayer.extend({
  kind: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse']),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal('none')),
  stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  strokeWidth: z.number().finite().min(0).max(100).default(0),
  radius: z.number().finite().min(0).max(400).default(0),
});

const pathLayerSchema = commonLayer.extend({
  kind: z.literal('path'),
  d: z.string().min(1).max(12000),
  stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  strokeWidth: z.number().finite().min(0.1).max(100),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).or(z.literal('none')).default('none'),
  scaleX: z.number().finite().min(0.01).max(20).optional(),
  scaleY: z.number().finite().min(0.01).max(20).optional(),
});

const assetLayerSchema = commonLayer.extend({
  kind: z.literal('image'),
  src: z.string().min(1).max(3_000_000),
  alt: z.string().max(300),
  fit: z.enum(['cover', 'contain']).default('cover'),
  provenance: provenanceSchema,
});

export const PosterLayerSchema = z.discriminatedUnion('kind', [
  textLayerSchema,
  shapeLayerSchema,
  pathLayerSchema,
  assetLayerSchema,
]);

export type TextLayer = z.infer<typeof textLayerSchema>;
export type ShapeLayer = z.infer<typeof shapeLayerSchema>;
export type PathLayer = z.infer<typeof pathLayerSchema>;
export type AssetLayer = z.infer<typeof assetLayerSchema>;
export type PosterLayer = z.infer<typeof PosterLayerSchema>;

export const PosterDocumentSchema = z.object({
  version: z.literal(1),
  id: z.string().min(1),
  title: z.string().min(1).max(160),
  width: z.number().finite().min(200).max(4000),
  height: z.number().finite().min(200).max(4000),
  background: z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    image: assetLayerSchema.omit({ id: true, name: true, x: true, y: true, width: true, height: true, rotation: true, opacity: true, visible: true, locked: true, role: true }).optional(),
  }),
  layers: z.array(PosterLayerSchema).max(120),
});

export type PosterDocument = z.infer<typeof PosterDocumentSchema>;
export type LayoutPreset = 'editorial' | 'centered' | 'asymmetric';

const ink = '#2a2824';
const accent = '#ed6848';

export function createInitialDocument(): PosterDocument {
  return PosterDocumentSchema.parse({
    version: 1,
    id: `poster-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`,
    title: 'Nouvelle affiche',
    width: 520,
    height: 720,
    background: { color: '#fffdf8' },
    layers: [],
  });
}

function migrateLegacyPoster(value: unknown): PosterDocument | null {
  if (!value || typeof value !== 'object') return null;
  const legacy = value as Record<string, unknown>;
  if (typeof legacy.title !== 'string' || typeof legacy.date !== 'string' || typeof legacy.place !== 'string') return null;
  const doc = createInitialDocument();
  doc.background.color = typeof legacy.background === 'string' && /^#[0-9a-fA-F]{6}$/.test(legacy.background) ? legacy.background : doc.background.color;
  const color = typeof legacy.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(legacy.color) ? legacy.color : accent;
  const legacyCopy = [
    { key: 'title', id: 'title', name: 'Titre importé', role: 'title', x: 'titleX', y: 'titleY', fontSize: 54, color },
    { key: 'subtitle', id: 'subtitle', name: 'Accroche importée', role: 'subtitle', x: 'subtitleX', y: 'subtitleY', fontSize: 16, color: ink },
    { key: 'date', id: 'date', name: 'Date importée', role: 'date', x: 'dateX', y: 'dateY', fontSize: 18, color: ink },
    { key: 'place', id: 'place', name: 'Lieu importé', role: 'place', x: 'placeX', y: 'placeY', fontSize: 16, color: ink },
    { key: 'cta', id: 'cta', name: 'Appel à l’action importé', role: 'cta', x: 'ctaX', y: 'ctaY', fontSize: 14, color },
  ] as const;
  for (const item of legacyCopy) {
    const text = legacy[item.key];
    if (typeof text !== 'string' || !text.trim()) continue;
    const legacyX = legacy[item.x];
    const legacyY = legacy[item.y];
    const layer = makeTextLayer({
      id: `legacy-${item.id}`,
      name: item.name,
      text,
      x: typeof legacyX === 'number' ? legacyX : 42,
      y: typeof legacyY === 'number' ? legacyY : 100 + doc.layers.length * 64,
      fontSize: item.fontSize,
      color: item.color,
    });
    doc.layers.push({ ...layer, role: item.role, width: 430, fontWeight: item.id === 'title' ? 'bold' : 'medium' });
  }

  if (Array.isArray(legacy.strokes)) {
    for (const raw of legacy.strokes) {
      if (!raw || typeof raw !== 'object') continue;
      const stroke = raw as Record<string, unknown>;
      if (typeof stroke.id !== 'string' || typeof stroke.d !== 'string' || typeof stroke.color !== 'string') continue;
      doc.layers.push({ id: stroke.id, name: 'Tracé importé', kind: 'path', role: 'decoration', x: 0, y: 0, width: doc.width, height: doc.height, rotation: 0, opacity: 1, visible: true, locked: false, d: stroke.d, stroke: /^#[0-9a-fA-F]{6}$/.test(stroke.color) ? stroke.color : ink, strokeWidth: typeof stroke.width === 'number' ? Math.max(0.1, Math.min(100, stroke.width)) : 4, fill: 'none' });
    }
  }
  const parsed = PosterDocumentSchema.safeParse(doc);
  return parsed.success ? parsed.data : null;
}

export function restoreDocument(value: unknown): PosterDocument {
  const parsed = PosterDocumentSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  return migrateLegacyPoster(value) ?? createInitialDocument();
}

export function makeTextLayer(input: {
  id: string; text: string; x: number; y: number; fontSize?: number; color?: string; name?: string;
}): TextLayer {
  return textLayerSchema.parse({
    id: input.id,
    name: input.name ?? 'Texte ajouté',
    kind: 'text',
    x: input.x,
    y: input.y,
    width: 360,
    height: Math.max(24, (input.fontSize ?? 28) * 1.3),
    text: input.text,
    fontFamily: 'Arial, sans-serif',
    fontSize: input.fontSize ?? 28,
    lineHeight: 1.15,
    fontWeight: 'medium',
    color: input.color ?? ink,
    align: 'start',
    letterSpacing: 0,
  });
}

export function relayoutDocument(document: PosterDocument, preset: LayoutPreset): PosterDocument {
  const { width, height } = document;
  const centered = preset === 'centered';
  const asymmetric = preset === 'asymmetric';
  const left = width * (asymmetric ? 0.12 : 0.08);
  const textWidth = width * (asymmetric ? 0.68 : 0.82);
  const center = width / 2;
  const roleY: Record<string, number> = {
    brand: height * 0.08,
    title: height * (asymmetric ? 0.27 : 0.29),
    subtitle: height * 0.53,
    'date-label': height * 0.69,
    date: height * 0.72,
    'place-label': height * 0.80,
    place: height * 0.83,
    cta: height * 0.90,
  };
  return {
    ...document,
    layers: document.layers.map((layer) => {
      if (!layer.role || roleY[layer.role] === undefined || layer.role === 'decoration' || layer.role === 'asset') return layer;
      const isBrand = layer.role === 'brand';
      const isTitle = layer.role === 'title';
      const y = isTitle ? roleY.title - (layer.kind === 'text' ? layer.fontSize * 0.25 : 0) : roleY[layer.role];
      const x = centered && !isBrand ? center : left;
      const align = centered && layer.kind === 'text' && !isBrand ? 'middle' as const : layer.kind === 'text' ? 'start' as const : undefined;
      const resized = layer.kind === 'text'
        ? { ...layer, x, y, width: textWidth, ...(align ? { align } : {}) }
        : { ...layer, x, y, width: textWidth };
      return resized;
    }).map((layer) => {
      if (asymmetric && layer.kind === 'text' && layer.role === 'title') return { ...layer, fontSize: Math.min(layer.fontSize, width * 0.105) };
      return layer;
    }),
  };
}
