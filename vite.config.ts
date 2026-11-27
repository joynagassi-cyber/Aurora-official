import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createCopilotRuntimeHandler } from '@copilotkit/runtime/v2';
import { createCopilotNodeHandler } from '@copilotkit/runtime/v2/node';
import { createAuroraCopilotRuntime, generateAgnesBackground } from './server/agnes-agent.mjs';
import { getIconifyAsset, permitDesignAssetRequest, searchDesignAssets } from './server/design-assets.mjs';

const API_PATH = '/api/copilotkit';
const BACKGROUND_PATH = '/api/agnes/background';
const DESIGN_ASSET_PATH = '/api/design-assets';
const imageRequestBuckets = new Map<string, { startedAt: number; count: number }>();

function sendJson(response: import('node:http').ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.end(JSON.stringify(body));
}

async function readJson(request: import('node:http').IncomingMessage, maxBytes = 8_000_000) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) throw new Error('Request body is too large.');
    chunks.push(Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
}

function agnesRuntimePlugin(): Plugin {
  let apiKey = '';
  return {
    name: 'aurora-agnes-runtime',
    configResolved(config) {
      apiKey = loadEnv(config.mode, config.root, '').AGNES_API_KEY?.trim() || process.env.AGNES_API_KEY?.trim() || '';
    },
    configureServer(server) {
      const handler = apiKey ? createCopilotNodeHandler(createCopilotRuntimeHandler({
        runtime: createAuroraCopilotRuntime(apiKey),
        basePath: API_PATH,
        activateChannels: false,
      })) : null;

      server.middlewares.use((request, response, next) => {
        const requestUrl = new URL(request.url || '/', 'http://localhost');
        const pathname = requestUrl.pathname;
        if (pathname.startsWith(`${DESIGN_ASSET_PATH}/`)) {
          const isSearch = pathname === `${DESIGN_ASSET_PATH}/search`;
          const isIcon = pathname === `${DESIGN_ASSET_PATH}/icon`;
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
              if (pathname === `${DESIGN_ASSET_PATH}/search` && request.method === 'GET') {
                const result = await searchDesignAssets({
                  source: requestUrl.searchParams.get('source') || 'iconify',
                  query: requestUrl.searchParams.get('query') || '',
                });
                sendJson(response, 200, result);
                return;
              }
              if (pathname === `${DESIGN_ASSET_PATH}/icon` && request.method === 'POST') {
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
        if (pathname === BACKGROUND_PATH) {
          if (request.method !== 'POST') {
            sendJson(response, 405, { error: 'Method not allowed.' });
            return;
          }
          if (!apiKey) {
            sendJson(response, 503, { error: 'Agnes is unavailable: configure AGNES_API_KEY on the server.' });
            return;
          }
          const key = request.socket.remoteAddress || 'unknown';
          const now = Date.now();
          const bucket = imageRequestBuckets.get(key);
          if (bucket && now - bucket.startedAt < 60_000 && bucket.count >= 3) {
            sendJson(response, 429, { error: 'Background generation limit reached. Try again in one minute.' });
            return;
          }
          if (!bucket || now - bucket.startedAt >= 60_000) imageRequestBuckets.set(key, { startedAt: now, count: 1 });
          else bucket.count += 1;
          void (async () => {
            try {
              const body = await readJson(request);
              if (typeof body.prompt !== 'string' || body.prompt.trim().length < 8 || body.prompt.length > 1600) {
                sendJson(response, 400, { error: 'Prompt must contain 8–1600 characters.' });
                return;
              }
              const ratios = new Set(['1:1', '3:4', '4:3', '16:9', '9:16', '2:3', '3:2', '21:9']);
              if (typeof body.ratio !== 'string' || !ratios.has(body.ratio)) {
                sendJson(response, 400, { error: 'Unsupported poster ratio.' });
                return;
              }
              if (body.foregroundDataUri !== undefined && (typeof body.foregroundDataUri !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(body.foregroundDataUri) || body.foregroundDataUri.length > 7_500_000)) {
                sendJson(response, 400, { error: 'Invalid or oversized foreground preview.' });
                return;
              }
              const result = await generateAgnesBackground({
                apiKey,
                prompt: body.prompt,
                ratio: body.ratio,
                foregroundDataUri: body.foregroundDataUri as string | undefined,
              });
              sendJson(response, 200, result);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Agnes background generation failed.';
              sendJson(response, message.includes('too large') || message.includes('JSON') ? 400 : 502, { error: message });
            }
          })();
          return;
        }
        if (pathname === API_PATH || pathname.startsWith(`${API_PATH}/`)) {
          if (!handler) {
            sendJson(response, 503, { error: 'Agnes AI is not configured. Add AGNES_API_KEY to the server environment.' });
            return;
          }
          void handler(request, response).catch(() => {
            server.config.logger.error('Agnes chat request failed.');
            if (!response.headersSent) sendJson(response, 502, { error: 'Agnes chat request failed.' });
          });
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), agnesRuntimePlugin()],
  server: { host: '0.0.0.0', allowedHosts: true },
  preview: { host: '0.0.0.0', allowedHosts: true },
});
