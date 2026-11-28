import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { createCopilotRuntimeHandler } from '@copilotkit/runtime/v2';
import { createCopilotNodeHandler } from '@copilotkit/runtime/v2/node';
import { createAuroraCopilotRuntime, generateAgnesBackground } from './agnes-agent.mjs';
import { getIconifyAsset, permitDesignAssetRequest, searchDesignAssets } from './design-assets.mjs';

const host = '0.0.0.0';
const port = Number.parseInt(process.env.PORT || '3000', 10);
const apiPath = '/api/copilotkit';
const distDirectory = resolve(process.cwd(), 'dist');
const indexFile = resolve(distDirectory, 'index.html');
const agnesApiKey = process.env.AGNES_API_KEY?.trim();
const copilotHandler = agnesApiKey
  ? createCopilotNodeHandler(createCopilotRuntimeHandler({
      runtime: createAuroraCopilotRuntime(agnesApiKey),
      basePath: apiPath,
      activateChannels: false,
    }))
  : null;
const backgroundRequests = new Map();

if (!existsSync(indexFile)) {
  console.error('Missing dist/index.html. Run the production build before starting Aurora.');
  process.exit(1);
}

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendJson(response, statusCode, body) {
  const payload = JSON.stringify(body);
  response.writeHead(statusCode, {
    'Content-Length': Buffer.byteLength(payload),
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(payload);
}

async function readJson(request, maxBytes = 16_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body is too large.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function permitBackgroundRequest(request) {
  const key = request.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = backgroundRequests.get(key);
  if (!current || now - current.startedAt > 60_000) {
    backgroundRequests.set(key, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= 3) return false;
  current.count += 1;
  return true;
}

function serveFile(request, response, filename, pathname) {
  const details = statSync(filename);
  response.writeHead(200, {
    'Content-Length': details.size,
    'Content-Type': contentTypes[extname(filename).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  if (request.method === 'HEAD') {
    response.end();
    return;
  }
  createReadStream(filename).pipe(response);
}

const server = createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
  } catch {
    sendJson(response, 400, { error: 'Invalid request path.' });
    return;
  }

  if (pathname === '/healthz') {
    sendJson(response, 200, {
      status: 'ok',
      runtime: 'copilotkit',
      provider: 'agnes',
      providerConfigured: Boolean(agnesApiKey),
      chatModel: 'agnes-3.0-flash',
      imageModel: 'agnes-image-2.1-flash',
    });
    return;
  }

  if (pathname.startsWith('/api/design-assets/')) {
    const isSearch = pathname === '/api/design-assets/search';
    const isIcon = pathname === '/api/design-assets/icon';
    if (!isSearch && !isIcon) {
      sendJson(response, 404, { error: 'Design asset endpoint not found.' });
      return;
    }
    if ((isSearch && request.method !== 'GET') || (isIcon && request.method !== 'POST')) {
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }
    const key = request.socket.remoteAddress || 'unknown';
    if (!permitDesignAssetRequest(key)) {
      sendJson(response, 429, { error: 'Design asset search limit reached. Try again in one minute.' });
      return;
    }
    void (async () => {
      try {
        const url = new URL(request.url || '/', 'http://localhost');
        if (pathname === '/api/design-assets/search' && request.method === 'GET') {
          const result = await searchDesignAssets({
            source: url.searchParams.get('source') || 'iconify',
            query: url.searchParams.get('query') || '',
          });
          sendJson(response, 200, result);
          return;
        }
        if (pathname === '/api/design-assets/icon' && request.method === 'POST') {
          const body = await readJson(request, 8_000);
          if (typeof body.iconId !== 'string') throw new Error('Invalid Iconify icon ID.');
          const result = await getIconifyAsset({ iconId: body.iconId });
          sendJson(response, 200, result);
          return;
        }
        sendJson(response, 404, { error: 'Design asset endpoint not found.' });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Design asset request failed.';
        const badRequest = message.includes('must be') || message.includes('must contain') || message.includes('Unsupported design asset source') || message.includes('Invalid Iconify') || message.includes('Request body is too large') || message.includes('JSON');
        sendJson(response, badRequest ? 400 : 502, { error: message });
      }
    })();
    return;
  }

  if (pathname === '/api/agnes/background') {
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: 'Method not allowed.' });
      return;
    }
    if (!agnesApiKey) {
      sendJson(response, 503, { error: 'Agnes is unavailable: configure AGNES_API_KEY on the server.' });
      return;
    }
    if (!permitBackgroundRequest(request)) {
      sendJson(response, 429, { error: 'Background generation limit reached. Try again in one minute.' });
      return;
    }
    void (async () => {
      try {
        const body = await readJson(request, 8_000_000);
        if (typeof body.prompt !== 'string' || body.prompt.trim().length < 8 || body.prompt.length > 1600) {
          sendJson(response, 400, { error: 'Prompt must contain 8–1600 characters.' });
          return;
        }
        const validRatios = new Set(['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9']);
        if (!validRatios.has(body.ratio)) {
          sendJson(response, 400, { error: 'Unsupported poster ratio.' });
          return;
        }
        if (body.foregroundDataUri !== undefined && (typeof body.foregroundDataUri !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.foregroundDataUri) || body.foregroundDataUri.length > 7_500_000)) {
          sendJson(response, 400, { error: 'Invalid or oversized foreground preview.' });
          return;
        }
        const result = await generateAgnesBackground({
          apiKey: agnesApiKey,
          prompt: body.prompt,
          ratio: body.ratio,
          foregroundDataUri: body.foregroundDataUri,
        });
        sendJson(response, 200, result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Agnes background generation failed.';
        const clientError = message.includes('too large') || message.includes('JSON');
        sendJson(response, clientError ? 400 : 502, { error: message });
      }
    })();
    return;
  }

  if (pathname === apiPath || pathname.startsWith(`${apiPath}/`)) {
    if (!copilotHandler) {
      sendJson(response, 503, { error: 'Agnes AI is not configured. Add AGNES_API_KEY to the server environment.' });
      return;
    }
    void copilotHandler(request, response).catch(() => {
      console.error('[CopilotKit] Agnes request failed.');
      if (!response.headersSent) sendJson(response, 502, { error: 'Agnes chat request failed.' });
      else response.destroy();
    });
    return;
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  const requestedFile = resolve(distDirectory, `.${pathname}`);
  const isWithinDist = requestedFile === distDirectory || requestedFile.startsWith(`${distDirectory}${sep}`);
  if (!isWithinDist) {
    sendJson(response, 400, { error: 'Invalid request path.' });
    return;
  }

  if (existsSync(requestedFile) && statSync(requestedFile).isFile()) {
    serveFile(request, response, requestedFile, pathname);
    return;
  }

  if (pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'API route not found.' });
    return;
  }

  serveFile(request, response, indexFile, '/index.html');
});

server.listen(port, host, () => {
  console.log(`Aurora listening on ${host}:${port}`);
  console.log(`Agnes runtime configured: ${Boolean(agnesApiKey)} (chat: agnes-3.0-flash, image: agnes-image-2.1-flash)`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
