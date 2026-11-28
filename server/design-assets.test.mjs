import test from 'node:test';
import assert from 'node:assert/strict';
import { clearDesignAssetCache, getIconifyAsset, permitDesignAssetRequest, searchDesignAssets } from './design-assets.mjs';

const iconifySearch = {
  icons: ['tabler:heart', 'unlicensed:bird'],
  total: 2,
  collections: {
    tabler: {
      name: 'Tabler Icons', author: { name: 'Tabler Authors', url: 'https://github.com/tabler/tabler-icons' },
      license: { title: 'MIT', spdx: 'MIT', url: 'https://github.com/tabler/tabler-icons/blob/main/LICENSE' },
    },
    unlicensed: { name: 'Unlicensed set', author: { name: 'Unknown' }, license: { title: 'Unknown' } },
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

test('Iconify search returns per-collection attribution and distinguishes placeable licenses', async () => {
  clearDesignAssetCache();
  let requestedUrl = '';
  const result = await searchDesignAssets({
    query: '  heart   outline ',
    fetchImpl: async (url) => {
      requestedUrl = String(url);
      return jsonResponse(iconifySearch);
    },
  });
  assert.match(requestedUrl, /^https:\/\/api\.iconify\.design\/search\?/);
  assert.match(requestedUrl, /query=heart\+outline/);
  assert.equal(result.assets[0].id, 'tabler:heart');
  assert.equal(result.assets[0].spdx, 'MIT');
  assert.equal(result.assets[0].canPlace, true);
  assert.equal(result.assets[1].canPlace, false);
});

test('Iconify SVG is sanitized, size-limited, and carries its source license metadata', async () => {
  const urls = [];
  const result = await getIconifyAsset({
    iconId: 'tabler:heart',
    fetchImpl: async (url) => {
      const value = String(url);
      urls.push(value);
      if (value.includes('/collections?')) {
        return jsonResponse({ tabler: {
          name: 'Tabler Icons', author: { name: 'Tabler Authors', url: 'https://github.com/tabler/tabler-icons' },
          license: { title: 'MIT', spdx: 'MIT', url: 'https://github.com/tabler/tabler-icons/blob/main/LICENSE' },
        } });
      }
      return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" onload="bad()"><script>alert(1)</script><path d="M1 1" fill="currentColor"/><image href="https://tracker.example/pixel"/><g onclick="bad()"><circle cx="5" cy="5" r="2"/></g></svg>', {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' },
      });
    },
  });
  assert.equal(result.spdx, 'MIT');
  assert.equal(result.author, 'Tabler Authors');
  assert.equal(urls.length, 2);
  assert.match(result.svg, /<path/);
  assert.match(result.svg, /<circle/);
  assert.doesNotMatch(result.svg, /script|onload|onclick|tracker\.example|<image/i);
});

test('Iconify placement refuses unknown licenses, malformed IDs, and unsafe SVG declarations', async () => {
  await assert.rejects(() => getIconifyAsset({ iconId: 'https://bad.example/icon.svg' }), /Invalid Iconify icon ID/);
  await assert.rejects(() => getIconifyAsset({
    iconId: 'tabler:heart',
    fetchImpl: async () => jsonResponse({ tabler: { name: 'Tabler', license: { title: 'Unknown' } } }),
  }), /no approved, machine-readable license/);
  await assert.rejects(() => getIconifyAsset({
    iconId: 'tabler:heart',
    fetchImpl: async (url) => String(url).includes('/collections?')
      ? jsonResponse({ tabler: { name: 'Tabler', license: { title: 'MIT', spdx: 'MIT' } } })
      : new Response('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg/>', { status: 200 }),
  }), /document declarations/);
});

test('Design asset API limiter caps requests per key per minute and resets after the window', () => {
  const key = `test-${Math.random()}`;
  assert.equal(permitDesignAssetRequest(key, 1_000), true);
  for (let index = 0; index < 29; index += 1) assert.equal(permitDesignAssetRequest(key, 1_001 + index), true);
  assert.equal(permitDesignAssetRequest(key, 1_100), false);
  assert.equal(permitDesignAssetRequest(key, 61_001), true);
});

test('Design asset search validates provider and query before issuing a request', async () => {
  let called = false;
  await assert.rejects(() => searchDesignAssets({ source: 'unknown', query: 'icon', fetchImpl: async () => { called = true; } }), /Unsupported design asset source/);
  await assert.rejects(() => searchDesignAssets({ source: 'iconify', query: 'x', fetchImpl: async () => { called = true; } }), /2–80 characters/);
  assert.equal(called, false);
});
