import { scanFromURLAsync } from 'expo-camera';
import { File } from 'expo-file-system';
import { Asset } from 'expo-media-library';
import { ImageManipulator, SaveFormat, type ImageManipulatorContext, type ImageRef } from 'expo-image-manipulator';
import { Platform } from 'react-native';
import UPNG from 'upng-js';
import {
  AI_API_VERSION,
  AI_ENDPOINT,
  buildN8nPayload,
  buildRequestBody,
  describeHttpError,
  parseAiResponse,
  parseN8nResponse,
  type AiLanguage,
} from '../core/ai';
import { localDateString } from '../core/cleanup';
import { base64ToBytes, dhashFromRgba, HASH_H, HASH_W } from '../core/dhash';
import type { AiResult } from '../core/types';
import { IS_DEMO, demoAi, demoLocal, sleep } from './demo';
import { getFileUri } from './library';

/**
 * Per-screenshot analysis that runs on the phone:
 *  - real file size
 *  - QR / barcode detection (free, offline)
 *  - perceptual hash for duplicate detection
 * plus the optional AI classification.
 */

export type LocalAnalysis = {
  bytes: number | null;
  hasCode: boolean;
  dhash: string | null;
  /** Only filled when the media store did not report the dimensions (some Android phones). */
  shape: { width: number; height: number } | null;
};

async function readSize(uri: string): Promise<number | null> {
  try {
    const size = new File(uri).size;
    return typeof size === 'number' && size > 0 ? size : null;
  } catch {
    return null;
  }
}

async function detectCode(uri: string): Promise<boolean> {
  try {
    const results = await scanFromURLAsync(uri);
    return results.some((r) => typeof r.data === 'string' && r.data.length > 0);
  } catch {
    return false;
  }
}

async function computeHash(uri: string): Promise<string | null> {
  let ctx: ImageManipulatorContext | null = null;
  let ref: ImageRef | null = null;
  try {
    // Decode at low resolution to keep memory flat, then shrink to 9×8.
    ctx = ImageManipulator.manipulate(uri, { maxWidth: 256 });
    ctx.resize({ width: HASH_W, height: HASH_H });
    ref = await ctx.renderAsync();
    const saved = await ref.saveAsync({ base64: true, format: SaveFormat.PNG });
    if (!saved.base64) return null;
    const bytes = base64ToBytes(saved.base64);
    const png = UPNG.decode(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
    if (png.width !== HASH_W || png.height !== HASH_H) return null;
    const rgba = new Uint8Array(UPNG.toRGBA8(png)[0]);
    return dhashFromRgba(rgba);
  } catch {
    return null;
  } finally {
    ref?.release();
    ctx?.release();
  }
}

/**
 * URI the native image loaders can open. On Android the asset id is already a
 * content:// URI, which avoids raw storage paths; on iOS the ph:// id has to
 * be resolved to a file in the Photos library first.
 */
async function readableUri(id: string): Promise<string> {
  return Platform.OS === 'android' ? id : getFileUri(id);
}

async function readSizeWithFallback(id: string, uri: string): Promise<number | null> {
  const direct = await readSize(uri);
  if (direct || Platform.OS !== 'android') return direct;
  try {
    return await readSize(await getFileUri(id));
  } catch {
    return null;
  }
}

export async function analyzeLocally(id: string, needShape: boolean): Promise<LocalAnalysis> {
  if (IS_DEMO) {
    await sleep(60);
    return demoLocal(id);
  }
  const uri = await readableUri(id);
  const [bytes, hasCode, dhash, shape] = await Promise.all([
    readSizeWithFallback(id, uri),
    detectCode(uri),
    computeHash(uri),
    needShape ? new Asset(id).getShape().catch(() => null) : Promise.resolve(null),
  ]);
  return { bytes, hasCode, dhash, shape };
}

/** Long edge sent to the AI. Enough to read text, small enough to be cheap. */
const AI_MAX_EDGE = 1400;

async function prepareImageForAi(id: string, width: number, height: number): Promise<string> {
  const uri = await readableUri(id);
  const ctx = ImageManipulator.manipulate(uri, { maxWidth: 1600, maxHeight: 1600 });
  if (Math.max(width, height) > AI_MAX_EDGE) {
    ctx.resize(height >= width ? { height: AI_MAX_EDGE } : { width: AI_MAX_EDGE });
  }
  const ref = await ctx.renderAsync();
  try {
    const saved = await ref.saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.7 });
    if (!saved.base64) throw new Error('image_encode_failed');
    return saved.base64;
  } finally {
    ref.release();
    ctx.release();
  }
}

export class AiError extends Error {
  constructor(public code: string) {
    super(code);
  }
  /** Errors that will not go away by retrying the same request. */
  get isFatal(): boolean {
    return this.code === 'invalid_key';
  }
  get isTransient(): boolean {
    return this.code === 'rate_limited' || this.code === 'server_busy' || this.code === 'network';
  }
}

export async function classifyWithAi(params: {
  id: string;
  width: number;
  height: number;
  apiKey: string | null;
  n8nUrl: string;
  language: AiLanguage;
}): Promise<AiResult> {
  if (IS_DEMO) {
    // The demo shows what the AI returns for these samples, without a network call.
    await sleep(220);
    return demoAi(params.id);
  }
  const imageBase64 = await prepareImageForAi(params.id, params.width, params.height);
  const today = localDateString(Date.now());

  // Preferred: an n8n workflow does the AI call (the key stays on the server).
  if (params.n8nUrl) {
    const json = await postJson(params.n8nUrl, buildN8nPayload({ imageBase64, mediaType: 'image/jpeg', language: params.language, today }), {});
    return parseOrThrow(() => parseN8nResponse(json));
  }
  if (!params.apiKey) throw new AiError('invalid_key');

  const body = buildRequestBody({
    imageBase64,
    mediaType: 'image/jpeg',
    language: params.language,
    today,
  });
  const json = await postJson(AI_ENDPOINT, body, {
    'x-api-key': params.apiKey,
    'anthropic-version': AI_API_VERSION,
  });
  return parseOrThrow(() => parseAiResponse(json));
}

function parseOrThrow(parse: () => AiResult): AiResult {
  try {
    return parse();
  } catch (e) {
    throw new AiError(e instanceof Error ? e.message : 'bad_response');
  }
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new AiError('network');
  } finally {
    clearTimeout(timer);
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    // fall through with null body
  }
  if (!response.ok) throw new AiError(describeHttpError(response.status, json));
  return json;
}
