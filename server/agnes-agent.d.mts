import type { CopilotRuntime } from '@copilotkit/runtime/v2';

export const AGNES_BASE_URL: string;
export const AGNES_CHAT_MODEL: string;
export const AGNES_IMAGE_MODEL: string;
export const MAX_GENERATED_IMAGE_BASE64: number;
export function createAuroraCopilotRuntime(apiKey: string): CopilotRuntime;
export function generateAgnesBackground(input: {
  apiKey: string;
  prompt: string;
  ratio: string;
  foregroundDataUri?: string;
  fetchImpl?: typeof fetch;
}): Promise<{ dataUri: string; model: string }>;
