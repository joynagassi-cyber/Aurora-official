import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAgnesBackground } from './agnes-agent.mjs';

test('background generation uses the documented Agnes image API without exposing credentials', async () => {
  let requestUrl = '';
  let requestOptions;
  const result = await generateAgnesBackground({
    apiKey: 'test-secret',
    prompt: 'A warm editorial botanical background with open space at the top',
    ratio: '3:4',
    foregroundDataUri: 'data:image/png;base64,Zm9yZWdyb3VuZA==',
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return { ok: true, json: async () => ({ data: [{ b64_json: 'aGVsbG8=', url: null }] }) };
    },
  });

  assert.equal(requestUrl, 'https://apihub.agnes-ai.com/v1/images/generations');
  assert.equal(requestOptions.headers.Authorization, 'Bearer test-secret');
  const body = JSON.parse(requestOptions.body);
  assert.equal(body.model, 'agnes-image-2.1-flash');
  assert.equal(body.ratio, '3:4');
  assert.equal(body.extra_body.response_format, 'b64_json');
  assert.deepEqual(body.extra_body.image, ['data:image/png;base64,Zm9yZWdyb3VuZA==']);
  assert.match(body.prompt, /Do not render any text/);
  assert.equal(result.dataUri, 'data:image/png;base64,aGVsbG8=');
  assert.equal(result.model, 'agnes-image-2.1-flash');
  assert.equal(JSON.stringify(result).includes('test-secret'), false);
});

test('background generation rejects without a server-side Agnes key', async () => {
  let called = false;
  await assert.rejects(() => generateAgnesBackground({
    apiKey: '', prompt: 'A minimal textured background', ratio: '1:1',
    fetchImpl: async () => { called = true; throw new Error('must not call'); },
  }), /not configured/);
  assert.equal(called, false);
});

test('background generation rejects malformed or oversized image payloads', async () => {
  await assert.rejects(() => generateAgnesBackground({
    apiKey: 'test-secret', prompt: 'A minimal textured background', ratio: '1:1',
    fetchImpl: async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'not base64!' }] }) }),
  }), /no valid Base64 image/);
});
