import { createOpenAI } from '@ai-sdk/openai';
import { BuiltInAgent, CopilotRuntime } from '@copilotkit/runtime/v2';

export const AGNES_BASE_URL = 'https://apihub.agnes-ai.com/v1';
export const AGNES_CHAT_MODEL = 'agnes-3.0-flash';
export const AGNES_IMAGE_MODEL = 'agnes-image-2.1-flash';
export const MAX_GENERATED_IMAGE_BASE64 = 4_500_000;

export function createAuroraCopilotRuntime(apiKey) {
  if (!apiKey) throw new Error('AGNES_API_KEY is required to initialize the Agnes runtime.');
  const agnes = createOpenAI({ name: 'agnes', apiKey, baseURL: AGNES_BASE_URL });
  return new CopilotRuntime({
    agents: {
      default: new BuiltInAgent({
        model: agnes.chat(AGNES_CHAT_MODEL),
        maxSteps: 8,
        maxOutputTokens: 4096,
        prompt: [
          'You are Aurora Studio, a French-speaking art director for creators. The user directs; you plan, compose, and refine a real poster through the registered poster tools.',
          'Treat every poster as an editable design program, never a flattened image. Keep text, images/assets, shapes, vector paths, and the background as separate ordered layers. Respect layer IDs, locks, provenance, and the user’s explicit constraints.',
          'For a new poster on an empty canvas, call poster_apply_protocol with mode create and a complete ordered foreground protocol. For an existing design, prefer focused layer edits or mode complete; never replace existing user work without explicit confirmation. For a new format or responsive re-layout, use mode relayout with targetWidth, targetHeight, and existing_ref entries keyed by the current layer IDs; preserve text, asset identity, style and z-order, and never reference locked layers.',
          'Support prompt-only creation, asset-only composition, mixed prompt plus assets, canvas-conditioned edits, and responsive re-layout. If an imported asset’s visual content is unclear from its name/alt text, ask the user to describe it rather than inventing what it depicts.',
          'Preserve supplied asset identity and text accuracy. Design for the target dimensions: clear hierarchy, balanced alignment/spacing, coherent palette and style, readable copy, and deliberate bottom-to-top z-order. Ask for missing factual details such as date, price, address, or claims; never invent them.',
          'Use poster_generate_background only when a generated background is requested. It is generated separately beneath the existing editable foreground, uses that foreground as a visual/layout reference where possible, and requires the user’s confirmation before the potentially billable Agnes image request runs. Never render text or logos into the generated background.',
          'A tool result with ok:false or needsConfirmation:true is not a completed edit. Never claim an edit or generation succeeded until the tool confirms it. Explain changes briefly and invite the user to direct the next iteration.',
          'External assets require HTTPS URLs, attribution, and a license note; never claim rights are cleared if they are not known. Mark Agnes-generated content as generated and retain model/prompt provenance.',
        ].join(' '),
      }),
    },
  });
}

export async function generateAgnesBackground({ apiKey, prompt, ratio, foregroundDataUri, fetchImpl = fetch }) {
  if (!apiKey) throw new Error('Agnes background generation is not configured.');
  const body = {
    model: AGNES_IMAGE_MODEL,
    prompt: [
      prompt.trim(),
      'Generate only the background layer for an editable poster. The supplied foreground is a composition reference, not content to reproduce. Do not render any text, letters, logos, labels, CTA buttons, or foreground objects. Keep generous negative space beneath the existing foreground; harmonize color, lighting, and style with it.',
    ].join('\n\n'),
    size: '1K',
    ratio,
    extra_body: { response_format: 'b64_json', ...(foregroundDataUri ? { image: [foregroundDataUri] } : {}) },
  };
  if (!foregroundDataUri) {
    delete body.extra_body;
    body.return_base64 = true;
  }

  const response = await fetchImpl(`${AGNES_BASE_URL}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Agnes image API returned HTTP ${response.status}.`);
  const base64 = data?.data?.[0]?.b64_json;
  if (typeof base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error('Agnes returned no valid Base64 image.');
  }
  if (base64.length > MAX_GENERATED_IMAGE_BASE64) {
    throw new Error('Generated image exceeds Aurora’s local-document size limit.');
  }
  return { dataUri: `data:image/png;base64,${base64}`, model: AGNES_IMAGE_MODEL };
}
