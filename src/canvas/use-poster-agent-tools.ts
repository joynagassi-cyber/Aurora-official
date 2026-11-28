import { useAgentContext, useFrontendTool } from '@copilotkit/react-core/v2';
import { z } from 'zod';
import type { PosterDocument, PosterLayer } from './model';
import { makeTextLayer, relayoutDocument } from './model';

type Commit = (document: PosterDocument) => boolean;
type Undo = () => boolean;
type RequestBackgroundConfirmation = (prompt: string) => void;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.');
const httpsUrl = z.string().url().max(2048).refine((value) => new URL(value).protocol === 'https:', 'Asset URLs must use HTTPS.');
const assetInfo = {
  url: httpsUrl,
  alt: z.string().min(1).max(300),
  attribution: z.string().min(1).max(240),
  license: z.string().min(1).max(160),
};
const protocolRole = z.enum(['brand', 'title', 'subtitle', 'date-label', 'date', 'place-label', 'place', 'cta', 'decoration', 'asset']);
const protocolGeometry = {
  x: z.number().finite().min(0).max(4000),
  y: z.number().finite().min(0).max(4000),
  width: z.number().finite().min(8).max(4000),
  height: z.number().finite().min(8).max(4000),
  rotation: z.number().finite().min(-360).max(360).optional(),
};
const protocolText = z.object({
  kind: z.literal('text'), name: z.string().min(1).max(100), role: protocolRole.optional(),
  text: z.string().min(1).max(2000), ...protocolGeometry,
  fontFamily: z.string().min(1).max(120).optional(), fontSize: z.number().min(6).max(240),
  color: hexColor, fontWeight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
  align: z.enum(['start', 'middle', 'end']).optional(), lineHeight: z.number().min(0.8).max(3).optional(),
  letterSpacing: z.number().min(-8).max(24).optional(),
});
const protocolShape = z.object({
  kind: z.literal('shape'), name: z.string().min(1).max(100), role: protocolRole.optional(),
  shape: z.enum(['rect', 'ellipse']), ...protocolGeometry,
  fill: hexColor.or(z.literal('none')), stroke: hexColor.optional(),
  strokeWidth: z.number().min(0).max(100).optional(), radius: z.number().min(0).max(400).optional(),
});
const protocolPath = z.object({
  kind: z.literal('path'), name: z.string().min(1).max(100), role: protocolRole.optional(),
  ...protocolGeometry, d: z.string().min(1).max(4000), stroke: hexColor,
  strokeWidth: z.number().min(0.1).max(100), fill: hexColor.or(z.literal('none')).optional(),
});
const protocolAssetRef = z.object({
  kind: z.literal('asset_ref'), layerId: z.string().min(1).max(80), ...protocolGeometry,
  fit: z.enum(['cover', 'contain']).optional(),
});
const protocolExistingRef = z.object({
  kind: z.literal('existing_ref'), layerId: z.string().min(1).max(80), ...protocolGeometry,
  fit: z.enum(['cover', 'contain']).optional(),
});
const protocolLayer = z.discriminatedUnion('kind', [protocolText, protocolShape, protocolPath, protocolAssetRef, protocolExistingRef]);
const isExistingReference = (layer: z.infer<typeof protocolLayer>): layer is z.infer<typeof protocolExistingRef> | z.infer<typeof protocolAssetRef> => layer.kind === 'existing_ref' || layer.kind === 'asset_ref';

function newId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function updateLayer(document: PosterDocument, layerId: string, update: (layer: PosterLayer) => PosterLayer) {
  const index = document.layers.findIndex((layer) => layer.id === layerId);
  if (index < 0) return null;
  const current = document.layers[index];
  if (current.locked) return null;
  const layers = [...document.layers];
  layers[index] = update(current);
  return { ...document, layers };
}

function output(ok: boolean, message: string) {
  return JSON.stringify({ ok, message });
}

export function usePosterAgentTools(document: PosterDocument, commit: Commit, undo: Undo, requestBackgroundConfirmation: RequestBackgroundConfirmation) {
  useAgentContext({
    description: 'Current Aurora poster document: canvas dimensions, background, ordered editable layers, factual text, asset descriptions/provenance, lock and visibility state. Never invent missing business details.',
    value: {
      documentId: document.id,
      title: document.title,
      width: document.width,
      height: document.height,
      background: { color: document.background.color, hasImage: Boolean(document.background.image) },
      layers: document.layers.map((layer) => ({
        id: layer.id, kind: layer.kind, name: layer.name, role: layer.role ?? null,
        x: layer.x, y: layer.y, width: layer.width, height: layer.height,
        rotation: layer.rotation, opacity: layer.opacity, visible: layer.visible, locked: layer.locked,
        ...(layer.kind === 'text' ? { text: layer.text, fontSize: layer.fontSize, color: layer.color, align: layer.align, fontFamily: layer.fontFamily } : {}),
        ...(layer.kind === 'image' ? { alt: layer.alt, attribution: layer.provenance.attribution, license: layer.provenance.license, origin: layer.provenance.origin } : {}),
      })),
    },
  });

  useFrontendTool({
    name: 'poster_apply_protocol',
    description: 'Create or complete an editable poster from an ordered protocol of text, vector shapes/paths, and references to existing layers. Never flatten the poster. Use create only on a blank canvas; complete preserves unrelated layers; responsive relayout requires targetWidth/targetHeight and may override geometry by existing layerId while preserving its text, style, ID and z-order. For role-based layouts at the current size, use mode=relayout with a preset.',
    parameters: z.object({
      mode: z.enum(['create', 'complete', 'relayout']),
      title: z.string().min(1).max(160).optional(),
      backgroundColor: hexColor.optional(),
      backgroundPrompt: z.string().min(8).max(1200).optional(),
      preset: z.enum(['editorial', 'centered', 'asymmetric']).optional(),
      targetWidth: z.number().int().min(200).max(4000).optional(),
      targetHeight: z.number().int().min(200).max(4000).optional(),
      layers: z.array(protocolLayer).max(120).default([]),
    }),
    handler: async ({ mode, title, backgroundColor, backgroundPrompt, preset, targetWidth, targetHeight, layers: protocol }) => {
      if (mode === 'relayout') {
        if (preset && targetWidth === undefined && targetHeight === undefined) {
          const next = relayoutDocument(document, preset);
          return commit(next) ? output(true, `Reflowed the editable document with ${preset}.`) : output(false, 'Document validation failed; no change was made.');
        }
        if (!targetWidth || !targetHeight) return output(false, 'Responsive re-layout requires both targetWidth and targetHeight. No change was made.');
        if (protocol.some((entry) => !isExistingReference(entry))) return output(false, 'Responsive re-layout only accepts references to existing layers, never replacement content.');
        const refs = protocol as Array<z.infer<typeof protocolExistingRef> | z.infer<typeof protocolAssetRef>>;
        const ids = refs.map((entry) => entry.layerId);
        if (new Set(ids).size !== ids.length) return output(false, 'Each existing layer may appear only once in the re-layout protocol.');
        const overrides = new Map<string, typeof refs[number]>();
        for (const entry of refs) {
          const layer = document.layers.find((item) => item.id === entry.layerId);
          if (!layer) return output(false, `Layer ${entry.layerId} was not found. No change was made.`);
          if (layer.locked) return output(false, `Layer ${entry.layerId} is locked. No change was made.`);
          if (entry.kind === 'asset_ref' && layer.kind !== 'image') return output(false, `Layer ${entry.layerId} is not an image asset.`);
          overrides.set(entry.layerId, entry);
        }
        const scaleX = targetWidth / document.width;
        const scaleY = targetHeight / document.height;
        const uniformScale = Math.min(scaleX, scaleY);
        const layers = document.layers.map((layer) => {
          if (layer.locked) return layer;
          const reference = overrides.get(layer.id);
          const width = Math.min(reference?.width ?? layer.width * scaleX, targetWidth);
          const height = Math.min(reference?.height ?? layer.height * scaleY, targetHeight);
          const x = Math.max(0, Math.min(reference?.x ?? layer.x * scaleX, targetWidth - width));
          const y = Math.max(0, Math.min(reference?.y ?? layer.y * scaleY, targetHeight - height));
          if (layer.kind === 'text') return { ...layer, x, y, width, height, fontSize: Math.min(240, Math.max(6, layer.fontSize * uniformScale)), rotation: reference?.rotation ?? layer.rotation };
          if (layer.kind === 'shape') return { ...layer, x, y, width, height, radius: layer.radius * uniformScale, strokeWidth: layer.strokeWidth * uniformScale, rotation: reference?.rotation ?? layer.rotation };
          if (layer.kind === 'path') return { ...layer, x, y, width, height, scaleX: (layer.scaleX ?? 1) * scaleX, scaleY: (layer.scaleY ?? 1) * scaleY, strokeWidth: layer.strokeWidth * uniformScale, rotation: reference?.rotation ?? layer.rotation };
          return { ...layer, x, y, width, height, fit: reference?.fit ?? layer.fit, rotation: reference?.rotation ?? layer.rotation };
        });
        const next = { ...document, title: title ?? document.title, width: targetWidth, height: targetHeight, background: { color: backgroundColor ?? document.background.color, ...(document.background.image ? { image: document.background.image } : {}) }, layers };
        return commit(next) ? output(true, `Reflowed the editable protocol to ${targetWidth}×${targetHeight}; text/assets/IDs/z-order and locked layers were preserved.`) : output(false, 'Document validation failed; no change was made.');
      }
      if (mode === 'create' && document.layers.length > 0) {
        return output(false, 'This canvas already contains user layers. Preserve them with mode=complete or ask the user before replacing the design.');
      }
      if (mode === 'complete' && protocol.length === 0 && !backgroundColor && !title) {
        return output(false, 'Provide at least one layer, a title, or a background color.');
      }
      const referencedIds = protocol.filter(isExistingReference).map((layer) => layer.layerId);
      if (new Set(referencedIds).size !== referencedIds.length) return output(false, 'A layer can appear only once in the ordered protocol.');
      const referencedLayers: PosterLayer[] = [];
      for (const entry of protocol) {
        if (!isExistingReference(entry)) continue;
        const existing = document.layers.find((layer) => layer.id === entry.layerId);
        if (!existing) return output(false, `Layer ${entry.layerId} was not found. No change was made.`);
        if (existing.locked) return output(false, `Layer ${entry.layerId} is locked. No change was made.`);
        if (entry.kind === 'asset_ref' && existing.kind !== 'image') return output(false, `Layer ${entry.layerId} is not an image asset.`);
        const width = Math.min(entry.width, document.width);
        const height = Math.min(entry.height, document.height);
        const geometry = { x: Math.max(0, Math.min(entry.x, document.width - width)), y: Math.max(0, Math.min(entry.y, document.height - height)), width, height, rotation: entry.rotation ?? existing.rotation };
        if (existing.kind === 'image') referencedLayers.push({ ...existing, ...geometry, ...(entry.fit ? { fit: entry.fit } : {}) });
        else referencedLayers.push({ ...existing, ...geometry });
      }
      const assetById = new Map(referencedLayers.map((layer) => [layer.id, layer]));
      const nextLayers: PosterLayer[] = mode === 'create' ? [] : document.layers.filter((layer) => !assetById.has(layer.id));
      for (const entry of protocol) {
        if (isExistingReference(entry)) {
          const layer = assetById.get(entry.layerId);
          if (layer) nextLayers.push(layer);
          continue;
        }
        const id = newId(entry.kind);
        const role = entry.role ?? (entry.kind === 'text' ? undefined : 'decoration' as const);
        const common = {
          id, name: entry.name, ...(role ? { role } : {}),
          x: Math.max(0, Math.min(entry.x, document.width - Math.min(entry.width, document.width))),
          y: Math.max(0, Math.min(entry.y, document.height - Math.min(entry.height, document.height))),
          width: Math.min(entry.width, document.width), height: Math.min(entry.height, document.height),
          rotation: entry.rotation ?? 0, opacity: 1, visible: true, locked: false,
        };
        if (entry.kind === 'text') nextLayers.push({
          ...common, kind: 'text', text: entry.text, fontFamily: entry.fontFamily ?? 'Arial, sans-serif',
          fontSize: entry.fontSize, lineHeight: entry.lineHeight ?? 1.15, fontWeight: entry.fontWeight ?? 'medium',
          color: entry.color, align: entry.align ?? 'start', letterSpacing: entry.letterSpacing ?? 0,
        });
        if (entry.kind === 'shape') nextLayers.push({
          ...common, kind: 'shape', shape: entry.shape, fill: entry.fill,
          ...(entry.stroke ? { stroke: entry.stroke } : {}), strokeWidth: entry.strokeWidth ?? 0, radius: entry.radius ?? 0,
        });
        if (entry.kind === 'path') nextLayers.push({
          ...common, kind: 'path', d: entry.d, stroke: entry.stroke, strokeWidth: entry.strokeWidth, fill: entry.fill ?? 'none',
        });
      }
      if (nextLayers.length > 120) return output(false, 'The layer limit would be exceeded. No change was made.');
      const next = {
        ...document,
        title: title ?? document.title,
        background: { color: backgroundColor ?? document.background.color, ...(document.background.image ? { image: document.background.image } : {}) },
        layers: nextLayers,
      };
      if (!commit(next)) return output(false, 'Document validation failed; no change was made.');
      return output(true, JSON.stringify({
        message: mode === 'create' ? 'Created the editable design protocol.' : 'Completed the design while preserving unrelated layers.',
        backgroundPrompt: backgroundPrompt ?? null,
        layersBottomToTop: nextLayers.map(({ id, name, kind, role }) => ({ id, name, kind, role: role ?? null })),
        nextStep: backgroundPrompt ? 'Ask for or use explicit user confirmation before calling poster_generate_background with the supplied backgroundPrompt.' : null,
      }));
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_add_text',
    description: 'Add a new editable text layer to the poster. Keep each real text item separate from images and backgrounds.',
    parameters: z.object({
      text: z.string().min(1).max(500),
      x: z.number().min(0).max(4000).optional(),
      y: z.number().min(0).max(4000).optional(),
      fontSize: z.number().min(8).max(160).optional(),
      color: hexColor.optional(),
    }),
    handler: async ({ text, x, y, fontSize, color }) => {
      if (document.layers.length >= 120) return output(false, 'The layer limit has been reached.');
      const layer = makeTextLayer({
        id: newId('text'), text, x: x ?? document.width * 0.08, y: y ?? document.height * 0.62,
        fontSize, color,
      });
      if (!commit({ ...document, layers: [...document.layers, layer] })) return output(false, 'Document validation failed; no change was made.');
      return output(true, `Added editable text layer ${layer.id}.`);
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_update_text',
    description: 'Change the wording of an existing editable text layer. Never replace or flatten the whole poster to edit copy.',
    parameters: z.object({ layerId: z.string().min(1).max(80), text: z.string().max(2000) }),
    handler: async ({ layerId, text }) => {
      const next = updateLayer(document, layerId, (layer) => layer.kind === 'text' ? { ...layer, text } : layer);
      if (!next || next.layers.find((layer) => layer.id === layerId)?.kind !== 'text') return output(false, 'Text layer not found, locked, or not editable. No change was made.');
      if (!commit(next)) return output(false, 'Document validation failed; no change was made.');
      return output(true, `Updated text layer ${layerId}.`);
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_move_element',
    description: 'Move one existing layer on the poster. Keep other layer identities and positions unchanged.',
    parameters: z.object({
      layerId: z.string().min(1).max(80),
      x: z.number().finite().min(-500).max(4000),
      y: z.number().finite().min(-500).max(4000),
    }),
    handler: async ({ layerId, x, y }) => {
      const next = updateLayer(document, layerId, (layer) => ({
        ...layer,
        x: Math.max(0, Math.min(document.width - Math.min(layer.width, document.width), x)),
        y: Math.max(0, Math.min(document.height - Math.min(layer.height, document.height), y)),
      }));
      if (!next) return output(false, 'Layer not found or locked. No change was made.');
      if (!commit(next)) return output(false, 'Document validation failed; no change was made.');
      return output(true, `Moved layer ${layerId}.`);
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_resize_element',
    description: 'Resize one layer without changing its text, asset source, or other layers.',
    parameters: z.object({
      layerId: z.string().min(1).max(80),
      width: z.number().finite().min(8).max(4000),
      height: z.number().finite().min(8).max(4000),
    }),
    handler: async ({ layerId, width, height }) => {
      const next = updateLayer(document, layerId, (layer) => ({
        ...layer,
        width: Math.min(width, document.width),
        height: Math.min(height, document.height),
        x: Math.min(layer.x, Math.max(0, document.width - width)),
        y: Math.min(layer.y, Math.max(0, document.height - height)),
      }));
      if (!next) return output(false, 'Layer not found or locked. No change was made.');
      if (!commit(next)) return output(false, 'Document validation failed; no change was made.');
      return output(true, `Resized layer ${layerId}.`);
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_set_style',
    description: 'Change supported styling on one layer only: text color, text size/weight, shape fill, path stroke, or opacity.',
    parameters: z.object({
      layerId: z.string().min(1).max(80),
      color: hexColor.optional(),
      fontSize: z.number().min(8).max(160).optional(),
      fontWeight: z.enum(['normal', 'medium', 'semibold', 'bold']).optional(),
      opacity: z.number().min(0).max(1).optional(),
    }).refine((value) => value.color !== undefined || value.fontSize !== undefined || value.fontWeight !== undefined || value.opacity !== undefined, 'At least one style property is required.'),
    handler: async ({ layerId, color, fontSize, fontWeight, opacity }) => {
      const next = updateLayer(document, layerId, (layer) => {
        const common = opacity === undefined ? {} : { opacity };
        if (layer.kind === 'text') return { ...layer, ...common, ...(color ? { color } : {}), ...(fontSize ? { fontSize, height: Math.max(layer.height, fontSize * layer.lineHeight) } : {}), ...(fontWeight ? { fontWeight } : {}) };
        if (layer.kind === 'shape') return { ...layer, ...common, ...(color ? { fill: color } : {}) };
        if (layer.kind === 'path') return { ...layer, ...common, ...(color ? { stroke: color } : {}) };
        return { ...layer, ...common };
      });
      if (!next) return output(false, 'Layer not found or locked. No change was made.');
      if (!commit(next)) return output(false, 'Document validation failed; no change was made.');
      return output(true, `Updated style for layer ${layerId}.`);
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_add_shape',
    description: 'Add an editable rectangle or ellipse layer, for a simple graphic accent or a CTA background.',
    parameters: z.object({
      shape: z.enum(['rect', 'ellipse']),
      x: z.number().min(0).max(4000),
      y: z.number().min(0).max(4000),
      width: z.number().min(8).max(4000),
      height: z.number().min(8).max(4000),
      fill: hexColor,
      name: z.string().min(1).max(100).optional(),
    }),
    handler: async ({ shape, x, y, width, height, fill, name }) => {
      if (document.layers.length >= 120) return output(false, 'The layer limit has been reached.');
      const layer = {
        id: newId('shape'), name: name ?? `Forme ${shape}`, kind: 'shape' as const, role: 'decoration' as const,
        shape, x, y, width: Math.min(width, document.width), height: Math.min(height, document.height),
        rotation: 0, opacity: 1, visible: true, locked: false,
        fill, strokeWidth: 0, radius: shape === 'rect' ? 8 : 0,
      };
      if (!commit({ ...document, layers: [...document.layers, layer] })) return output(false, 'Document validation failed; no change was made.');
      return output(true, `Added editable ${shape} layer ${layer.id}.`);
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_search_design_assets',
    description: 'Search the approved external design catalogues. Use Iconify for editable open-source icons and inspect the per-collection SPDX license before choosing. SVGL is a brand-logo lookup only: its repository license does not grant trademark rights, so never treat results as automatically cleared assets.',
    parameters: z.object({
      query: z.string().min(2).max(80),
      source: z.enum(['iconify', 'svgl']).default('iconify'),
    }),
    handler: async ({ query, source }) => {
      const params = new URLSearchParams({ source, query });
      try {
        const response = await fetch(`/api/design-assets/search?${params.toString()}`);
        const result = await response.json() as { source?: string; query?: string; total?: number; assets?: unknown[]; error?: string };
        if (!response.ok || !Array.isArray(result.assets)) return output(false, result.error ?? 'Design asset search failed.');
        return output(true, JSON.stringify({ source: result.source, query: result.query, total: result.total, assets: result.assets }));
      } catch (error) {
        return output(false, error instanceof Error ? error.message : 'Design asset search is unavailable.');
      }
    },
  });

  useFrontendTool({
    name: 'poster_place_iconify_asset',
    description: 'Place an Iconify icon returned by poster_search_design_assets as a self-contained editable SVG image layer. The backend rechecks the icon ID and its collection license, sanitizes SVG markup, and stores source, author, and license provenance. Use only license-approved results.',
    parameters: z.object({
      iconId: z.string().regex(/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/i),
      x: z.number().finite().min(0).max(4000),
      y: z.number().finite().min(0).max(4000),
      width: z.number().finite().min(16).max(4000).default(120),
      height: z.number().finite().min(16).max(4000).default(120),
    }),
    handler: async ({ iconId, x, y, width, height }) => {
      if (document.layers.length >= 120) return output(false, 'The layer limit has been reached.');
      try {
        const response = await fetch('/api/design-assets/icon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ iconId }),
        });
        const result = await response.json() as {
          iconId?: string; title?: string; author?: string; collection?: string; license?: string;
          spdx?: string; sourceUrl?: string; licenseUrl?: string; svg?: string; error?: string;
        };
        if (!response.ok || !result.svg || !result.spdx || !result.sourceUrl) {
          return output(false, result.error ?? 'Iconify did not return a licensed SVG asset. No layer was added.');
        }
        const svgDataUri = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(result.svg)}`;
        if (svgDataUri.length > 2_900_000) return output(false, 'The sanitized SVG exceeds Aurora’s document asset limit.');
        const id = newId('icon');
        const title = result.title ?? iconId;
        const layer = {
          id, name: title.slice(0, 100), kind: 'image' as const, role: 'asset' as const,
          x: Math.min(x, Math.max(0, document.width - Math.min(width, document.width))),
          y: Math.min(y, Math.max(0, document.height - Math.min(height, document.height))),
          width: Math.min(width, document.width), height: Math.min(height, document.height),
          rotation: 0, opacity: 1, visible: true, locked: false,
          src: svgDataUri, alt: `${title} · ${result.collection ?? 'Iconify'}`,
          fit: 'contain' as const,
          provenance: {
            origin: 'design-library' as const,
            attribution: `${result.author ?? 'Unknown author'} · ${result.collection ?? 'Iconify'}`.slice(0, 240),
            license: `${result.license ?? result.spdx} (${result.spdx})${result.licenseUrl ? ` · ${result.licenseUrl}` : ''}`.slice(0, 160),
            sourceUrl: result.sourceUrl,
          },
        };
        if (!commit({ ...document, layers: [...document.layers, layer] })) return output(false, 'Document validation failed; no icon layer was added.');
        return output(true, `Placed ${iconId} as editable SVG image layer ${id}; author and license provenance were saved.`);
      } catch (error) {
        return output(false, error instanceof Error ? error.message : 'Iconify asset could not be placed.');
      }
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_place_asset',
    description: 'Place an HTTPS image as its own editable layer. Record attribution and license; do not claim rights that were not provided.',
    parameters: z.object({
      ...assetInfo,
      x: z.number().min(0).max(4000),
      y: z.number().min(0).max(4000),
      width: z.number().min(16).max(4000).default(220),
      height: z.number().min(16).max(4000).default(220),
      fit: z.enum(['cover', 'contain']).default('cover'),
    }),
    handler: async ({ url, alt, attribution, license, x, y, width, height, fit }) => {
      if (document.layers.length >= 120) return output(false, 'The layer limit has been reached.');
      const id = newId('asset');
      const layer = {
        id, name: alt.slice(0, 100), kind: 'image' as const, role: 'asset' as const,
        x, y, width: Math.min(width, document.width), height: Math.min(height, document.height),
        rotation: 0, opacity: 1, visible: true, locked: false,
        src: url, alt, fit, provenance: { origin: 'external-url' as const, attribution, license, sourceUrl: url },
      };
      if (!commit({ ...document, layers: [...document.layers, layer] })) return output(false, 'Document validation failed; no change was made.');
      return output(true, `Placed asset ${id}; attribution and license were recorded.`);
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_set_background',
    description: 'Set the poster background fill independently from the foreground layers.',
    parameters: z.object({ color: hexColor }),
    handler: async ({ color }) => {
      if (!commit({ ...document, background: { color } })) return output(false, 'Document validation failed; no change was made.');
      return output(true, 'Updated the background fill. Foreground text and asset layers remain separate.');
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_set_background_asset',
    description: 'Set a sourced HTTPS image as the background, separately from editable text and foreground layers. Record its attribution and license.',
    parameters: z.object(assetInfo),
    handler: async ({ url, alt, attribution, license }) => {
      if (!commit({
        ...document,
        background: {
          color: document.background.color,
          image: { kind: 'image', src: url, alt, fit: 'cover', provenance: { origin: 'external-url', attribution, license, sourceUrl: url } },
        },
      })) return output(false, 'Document validation failed; no change was made.');
      return output(true, 'Set the separate background image and recorded its provenance. All foreground layers remain editable.');
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_relayout',
    description: 'Reflow the existing editorial hierarchy into a named composition. This changes role-based positions, not a flattened image or a blind global scale.',
    parameters: z.object({ preset: z.enum(['editorial', 'centered', 'asymmetric']) }),
    handler: async ({ preset }) => {
      if (!commit(relayoutDocument(document, preset))) return output(false, 'Document validation failed; no change was made.');
      return output(true, `Reflowed role-based poster layers using the ${preset} composition. The content remains editable.`);
    },
  }, [document, commit]);

  useFrontendTool({
    name: 'poster_generate_background',
    description: 'Propose a separate Agnes AI background image conditioned on the current editable foreground. This may incur account charges; call only when specifically requested. It always requires the user to confirm before the API call.',
    parameters: z.object({ prompt: z.string().min(8).max(1200) }),
    handler: async ({ prompt }) => {
      requestBackgroundConfirmation(prompt);
      return JSON.stringify({ ok: false, needsConfirmation: true, message: 'The user must confirm the Agnes image generation in the canvas before any image API request is made.' });
    },
  }, [requestBackgroundConfirmation]);

  useFrontendTool({
    name: 'poster_undo_change',
    description: 'Undo the most recent committed poster change. Use this when the user asks to revert.',
    parameters: z.object({}),
    handler: async () => undo() ? output(true, 'Undid the most recent poster change.') : output(false, 'There is no poster change to undo.'),
  }, [undo]);
}
