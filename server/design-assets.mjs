import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

const ICONIFY_API = 'https://api.iconify.design';
const SVGL_API = 'https://api.svgl.app';
const MAX_JSON_BYTES = 1_500_000;
const MAX_SVG_BYTES = 500_000;
const LICENSED_ASSET_SPDX = new Set([
  'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'CC0-1.0', 'CC-BY-4.0',
  'ISC', 'MIT', 'OFL-1.1',
]);
const SAFE_ELEMENTS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title',
]);
const SAFE_ATTRIBUTES = new Set([
  'xmlns', 'viewBox', 'width', 'height', 'x', 'y', 'x1', 'x2', 'y1', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-rule', 'fill-opacity',
  'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit',
  'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'transform',
  'id', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform',
  'spreadMethod', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'style',
]);
const SAFE_STYLE_PROPERTIES = new Set([
  'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
  'stroke-opacity', 'opacity', 'stop-color', 'stop-opacity',
]);
const cache = new Map();
const requestBuckets = new Map();

export function permitDesignAssetRequest(key, now = Date.now()) {
  const current = requestBuckets.get(key);
  if (!current || now - current.startedAt >= 60_000) {
    requestBuckets.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 30) return false;
  current.count += 1;
  return true;
}

function validateQuery(query) {
  if (typeof query !== 'string') throw new Error('Search query must be text.');
  const normalized = query.trim().replace(/\s+/g, ' ');
  if (normalized.length < 2 || normalized.length > 80) throw new Error('Search query must contain 2–80 characters.');
  return normalized;
}

function cached(key, ttl) {
  const value = cache.get(key);
  if (!value || value.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  // Refresh insertion order so the cache can discard the oldest key at its cap.
  cache.delete(key);
  cache.set(key, value);
  return value.value;
}

function remember(key, value, ttl) {
  cache.set(key, { value, expiresAt: Date.now() + ttl });
  while (cache.size > 200) cache.delete(cache.keys().next().value);
  return value;
}

async function fetchText(url, { fetchImpl = fetch, maxBytes = MAX_JSON_BYTES } = {}) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json, image/svg+xml;q=0.9' },
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Design library returned HTTP ${response.status}.`);
  const contentLength = Number(response.headers?.get?.('content-length') || 0);
  if (contentLength > maxBytes) throw new Error('Design library response is too large.');
  const body = await response.text();
  if (!body || new TextEncoder().encode(body).byteLength > maxBytes) throw new Error('Design library response is empty or too large.');
  return body;
}

async function fetchJson(url, options) {
  const body = await fetchText(url, options);
  try {
    return JSON.parse(body);
  } catch {
    throw new Error('Design library returned invalid JSON.');
  }
}

function collectionMetadata(prefix, collections) {
  const value = collections?.[prefix];
  if (!value || typeof value !== 'object') return null;
  const license = value.license && typeof value.license === 'object' ? value.license : {};
  const author = value.author && typeof value.author === 'object' ? value.author : {};
  const spdx = typeof license.spdx === 'string' ? license.spdx : '';
  return {
    collection: typeof value.name === 'string' ? value.name : prefix,
    author: typeof author.name === 'string' ? author.name : 'Author not provided by source',
    authorUrl: safeHttpsUrl(author.url),
    license: typeof license.title === 'string' ? license.title : 'License not provided by source',
    spdx: spdx || null,
    licenseUrl: safeHttpsUrl(license.url),
    canPlace: LICENSED_ASSET_SPDX.has(spdx),
  };
}

function safeHttpsUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function searchDesignAssets({ source = 'iconify', query, fetchImpl = fetch }) {
  const normalized = validateQuery(query);
  if (source === 'iconify') {
    const url = new URL('/search', ICONIFY_API);
    url.searchParams.set('query', normalized);
    url.searchParams.set('limit', '32');
    const key = `iconify-search:${normalized.toLowerCase()}`;
    const prior = cached(key, 5 * 60_000);
    if (prior) return prior;
    const data = await fetchJson(url.toString(), { fetchImpl });
    if (!Array.isArray(data.icons) || !data.collections || typeof data.collections !== 'object') {
      throw new Error('Iconify search response did not include icon and collection metadata.');
    }
    const assets = data.icons.slice(0, 8).map((iconId) => {
      if (typeof iconId !== 'string' || !/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/i.test(iconId)) return null;
      const [prefix, name] = iconId.split(':');
      const metadata = collectionMetadata(prefix, data.collections);
      if (!metadata) return null;
      return {
        id: iconId,
        title: `${metadata.collection}: ${name.replace(/-/g, ' ')}`,
        source: 'Iconify',
        collection: metadata.collection,
        author: metadata.author,
        authorUrl: metadata.authorUrl,
        license: metadata.license,
        spdx: metadata.spdx,
        licenseUrl: metadata.licenseUrl,
        sourceUrl: `https://api.iconify.design/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`,
        canPlace: metadata.canPlace,
        note: metadata.canPlace ? 'License identified; attribution will be stored on the layer.' : 'Not placeable automatically: license is missing or outside Aurora’s approved MVP license set.',
      };
    }).filter(Boolean);
    return remember(key, { source: 'Iconify', query: normalized, total: Number(data.total) || assets.length, assets }, 5 * 60_000);
  }

  if (source === 'svgl') {
    const url = new URL('/', SVGL_API);
    url.searchParams.set('search', normalized);
    const key = `svgl-search:${normalized.toLowerCase()}`;
    const prior = cached(key, 5 * 60_000);
    if (prior) return prior;
    const data = await fetchJson(url.toString(), { fetchImpl });
    if (!Array.isArray(data)) throw new Error('SVGL search response was not a list.');
    const assets = data.slice(0, 8).filter((item) => item && Number.isInteger(item.id) && typeof item.title === 'string').map((item) => ({
      id: `svgl:${item.id}`,
      title: item.title,
      category: typeof item.category === 'string' ? item.category : 'Brand logo',
      source: 'SVGL',
      brandUrl: safeHttpsUrl(item.url),
      brandGuidelinesUrl: safeHttpsUrl(item.brandUrl),
      previewUrl: safeHttpsUrl(typeof item.route === 'string' ? item.route : item.route?.light),
      canPlace: false,
      note: 'Search result only. Brand/trademark rights are not granted by SVGL’s repository license; verify permissions before importing.',
    }));
    return remember(key, { source: 'SVGL', query: normalized, total: assets.length, assets }, 5 * 60_000);
  }

  throw new Error('Unsupported design asset source. Choose Iconify or SVGL.');
}

function sanitizeStyle(value) {
  if (value.length > 1000 || /url\s*\(|expression\s*\(|javascript:|@import/i.test(value)) return '';
  const declarations = value.split(';').map((part) => part.trim()).filter(Boolean).flatMap((part) => {
    const separator = part.indexOf(':');
    if (separator < 1) return [];
    const property = part.slice(0, separator).trim().toLowerCase();
    const content = part.slice(separator + 1).trim();
    if (!SAFE_STYLE_PROPERTIES.has(property) || /[<>"'\\]/.test(content)) return [];
    if (/url\s*\(/i.test(content) && !/^url\(\s*#[A-Za-z_][\w.-]*\s*\)$/.test(content)) return [];
    return [`${property}:${content}`];
  });
  return declarations.join(';');
}

function sanitizeSvg(svg) {
  if (typeof svg !== 'string' || new TextEncoder().encode(svg).byteLength > MAX_SVG_BYTES) throw new Error('SVG asset is empty or exceeds the size limit.');
  if (/<!doctype|<!entity/i.test(svg)) throw new Error('SVG assets with document declarations are not accepted.');
  let parseError = '';
  const parser = new DOMParser({ onError: (level, message) => { if (level !== 'warning') parseError = message; } });
  let document;
  try {
    document = parser.parseFromString(svg, 'image/svg+xml');
  } catch {
    throw new Error('SVG asset could not be parsed safely.');
  }
  if (parseError || !document.documentElement || document.documentElement.localName.toLowerCase() !== 'svg') {
    throw new Error('Design library did not return a valid SVG document.');
  }
  const root = document.documentElement;
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  root.setAttribute('width', root.getAttribute('width') || '24');
  root.setAttribute('height', root.getAttribute('height') || '24');

  function clean(element) {
    for (const attribute of Array.from(element.attributes ?? [])) {
      const name = attribute.name;
      const lowerName = name.toLowerCase();
      const value = attribute.value.trim();
      if (lowerName.startsWith('on') || !SAFE_ATTRIBUTES.has(name)) {
        element.removeAttribute(name);
        continue;
      }
      if (lowerName === 'style') {
        const style = sanitizeStyle(value);
        if (style) element.setAttribute(name, style);
        else element.removeAttribute(name);
        continue;
      }
      if ((lowerName === 'fill' || lowerName === 'stroke' || lowerName === 'clip-path' || lowerName === 'mask') && /url\s*\(/i.test(value) && !/^url\(\s*#[A-Za-z_][\w.-]*\s*\)$/.test(value)) {
        element.removeAttribute(name);
      }
    }
    for (const child of Array.from(element.childNodes ?? [])) {
      if (child.nodeType !== 1) {
        if (child.nodeType !== 3 && child.nodeType !== 4) element.removeChild(child);
        continue;
      }
      const tag = child.localName;
      if (!SAFE_ELEMENTS.has(tag)) {
        element.removeChild(child);
        continue;
      }
      clean(child);
    }
  }
  clean(root);
  const result = new XMLSerializer().serializeToString(root);
  if (!result.includes('<svg') || result.length > MAX_SVG_BYTES) throw new Error('SVG asset failed Aurora’s safe-content checks.');
  return result;
}

export async function getIconifyAsset({ iconId, fetchImpl = fetch }) {
  if (typeof iconId !== 'string' || !/^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/i.test(iconId)) {
    throw new Error('Invalid Iconify icon ID. Use an ID returned by poster_search_design_assets.');
  }
  const [prefix, name] = iconId.split(':');
  const metadataUrl = new URL('/collections', ICONIFY_API);
  metadataUrl.searchParams.set('prefix', prefix);
  const collections = await fetchJson(metadataUrl.toString(), { fetchImpl });
  const metadata = collectionMetadata(prefix, collections);
  if (!metadata?.canPlace || !metadata.spdx) throw new Error('This icon collection has no approved, machine-readable license. No asset was added.');

  const svgUrl = new URL(`/${encodeURIComponent(prefix)}/${encodeURIComponent(name)}.svg`, ICONIFY_API);
  const svg = sanitizeSvg(await fetchText(svgUrl.toString(), { fetchImpl, maxBytes: MAX_SVG_BYTES }));
  return {
    iconId,
    title: `${metadata.collection}: ${name.replace(/-/g, ' ')}`,
    sourceUrl: svgUrl.toString(),
    author: metadata.author,
    authorUrl: metadata.authorUrl,
    collection: metadata.collection,
    license: metadata.license,
    spdx: metadata.spdx,
    licenseUrl: metadata.licenseUrl,
    svg,
  };
}

export function clearDesignAssetCache() {
  cache.clear();
}
