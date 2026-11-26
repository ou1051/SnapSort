import { CATEGORY_IDS, isCategoryId } from './categories';
import type { AiResult } from './types';

/**
 * Request building and response parsing for the Claude Messages API.
 * Kept free of React Native imports so it can be unit tested.
 */

export const AI_MODEL = 'claude-haiku-5-5';
export const AI_ENDPOINT = 'https://api.anthropic.com/v1/messages';
export const AI_API_VERSION = '2023-06-01';
const TOOL_NAME = 'record_screenshot';

export type AiLanguage = 'ja' | 'en';

const CATEGORY_GUIDE = `
- ticket: boarding pass, train/bus/event ticket, hotel or restaurant reservation, entry QR code
- coupon: coupon, voucher, loyalty card, payment barcode/QR, gift card
- shopping: product page, item someone wants to buy, price comparison, wish list, cart
- receipt: order confirmation, receipt, invoice, bank transfer or payment confirmation, delivery tracking
- chat: chat conversation, social media post or comment, email thread
- map: map, directions, route, timetable, location pin
- info: article, recipe, schedule, how-to, notes, quotes, study material, anything saved to read later
- tech: error message, app or system settings, code, terminal, tech support screen
- other: meme, photo of people, game, video still, anything that fits nowhere else`.trim();

export function buildSystemPrompt(language: AiLanguage, today: string): string {
  const lang = language === 'ja' ? 'Japanese' : 'English';
  return [
    'You sort phone screenshots for a storage-cleanup app.',
    `Today is ${today}. Use it to resolve dates that omit the year.`,
    'Look at the screenshot and call the tool exactly once.',
    '',
    'Categories:',
    CATEGORY_GUIDE,
    '',
    'Rules:',
    `- title: what this screenshot is, in ${lang}, at most 30 characters. Name the shop, app, place or item if visible (e.g. "Amazon: wireless earbuds", "Lufthansa LH 716 boarding pass").`,
    `- keywords: up to 12 words in ${lang} or as shown on screen (names, numbers, places) that someone might search for. Never include passwords, card numbers or one-time codes.`,
    '- expires_on: the last day the screenshot is useful (event date, travel date, coupon end date, reservation date) as YYYY-MM-DD. Use null when there is no such date.',
    '- important: true only for things that should be kept long-term: ID documents, contracts, warranties, tax or medical documents, account recovery codes, passwords. Ordinary receipts, tickets and chats are not important.',
  ].join('\n');
}

export function buildToolSchema() {
  return {
    name: TOOL_NAME,
    description: 'Save the classification of one screenshot.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: [...CATEGORY_IDS] },
        title: { type: 'string' },
        keywords: { type: 'string' },
        expires_on: { type: ['string', 'null'], description: 'YYYY-MM-DD or null' },
        important: { type: 'boolean' },
      },
      required: ['category', 'title', 'keywords', 'expires_on', 'important'],
    },
  };
}

export function buildRequestBody(params: {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
  language: AiLanguage;
  today: string;
}) {
  return {
    model: AI_MODEL,
    max_tokens: 400,
    system: buildSystemPrompt(params.language, params.today),
    tools: [buildToolSchema()],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: params.mediaType, data: params.imageBase64 },
          },
          { type: 'text', text: 'Classify this screenshot.' },
        ],
      },
    ],
  };
}

export function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function clip(text: unknown, max: number): string {
  if (typeof text !== 'string') return '';
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

export class AiResponseError extends Error {}

/** Turns a Messages API JSON response into a validated AiResult. */
export function parseAiResponse(json: unknown): AiResult {
  const content = (json as { content?: unknown })?.content;
  if (!Array.isArray(content)) throw new AiResponseError('Response has no content');
  const block = content.find(
    (c: { type?: string; name?: string }) => c?.type === 'tool_use' && c?.name === TOOL_NAME,
  ) as { input?: Record<string, unknown> } | undefined;
  if (!block || typeof block.input !== 'object' || block.input === null) {
    throw new AiResponseError('Model did not return a classification');
  }
  return parseAiFields(block.input);
}

/**
 * Validates the classification fields, wherever they came from: the Claude
 * tool call above, or the JSON an n8n workflow answers with.
 */
export function parseAiFields(input: Record<string, unknown>): AiResult {
  if (typeof input !== 'object' || input === null) throw new AiResponseError('No classification');
  return {
    category: isCategoryId(input.category) ? input.category : 'other',
    title: clip(input.title, 40),
    keywords: clip(input.keywords, 200),
    expiresOn: isValidIsoDate(input.expires_on) ? input.expires_on : null,
    important: input.important === true,
  };
}

/** Readable message for HTTP errors from the API. */
export function describeHttpError(status: number, body: unknown): string {
  const apiMessage = (body as { error?: { message?: string } })?.error?.message;
  if (status === 401) return 'invalid_key';
  if (status === 429) return 'rate_limited';
  if (status === 529 || status >= 500) return 'server_busy';
  return apiMessage ? `http_${status}: ${apiMessage}` : `http_${status}`;
}

/** Body SnapSort posts to an n8n webhook (see n8n/snapsort-classify.json). */
export function buildN8nPayload(params: {
  imageBase64: string;
  mediaType: 'image/jpeg' | 'image/png';
  language: AiLanguage;
  today: string;
}) {
  return {
    image_base64: params.imageBase64,
    media_type: params.mediaType,
    language: params.language,
    today: params.today,
  };
}

/** n8n may answer with the fields directly, wrapped in { result }, or as a one-item array. */
export function parseN8nResponse(json: unknown): AiResult {
  let value: unknown = Array.isArray(json) ? json[0] : json;
  if (value && typeof value === 'object' && 'result' in value) value = (value as { result: unknown }).result;
  if (!value || typeof value !== 'object' || !('category' in value)) {
    throw new AiResponseError('n8n answered without a category');
  }
  return parseAiFields(value as Record<string, unknown>);
}
