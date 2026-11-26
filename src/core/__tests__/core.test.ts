import { describe, expect, it } from 'vitest';
import { appNameFromFilename, categoryFromFilename } from '../appHints';
import { buildN8nPayload, buildRequestBody, describeHttpError, isValidIsoDate, parseAiResponse, parseN8nResponse } from '../ai';
import {
  computeSuggestions,
  findDuplicates,
  isExpired,
  isWorthNotifying,
  localDateString,
  summarize,
} from '../cleanup';
import { base64ToBytes, dhashFromRgba, hammingDistance } from '../dhash';
import { estimateBytes, formatBytes } from '../format';
import { matchesQuery, mergeLibrary, newRecord } from '../merge';
import { nextWeeklyTime } from '../schedule';
import type { ShotRecord } from '../types';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 10, 26, 12, 0, 0).getTime(); // 26 Nov 2026, local noon

// A hash with plenty of 1s and 0s so it counts as informative.
const H1 = 'a5a5a5a5a5a5a5a5';
const H1_NEAR = 'a5a5a5a5a5a5a5a4'; // 1 bit different
const H2 = '0f0f0f0f33333333'; // clearly different

function shot(partial: Partial<ShotRecord> & { id: string }): ShotRecord {
  return {
    filename: null,
    width: 1170,
    height: 2532,
    createdAt: NOW - 1 * DAY,
    bytes: 1_000_000,
    bytesEstimated: false,
    isFavorite: false,
    category: 'other',
    categorySource: 'ai',
    title: null,
    keywords: null,
    expiresOn: null,
    important: false,
    hasCode: false,
    dhash: null,
    pinned: false,
    lastViewedAt: null,
    localDone: true,
    aiDone: true,
    aiError: null,
    ...partial,
  };
}

describe('appHints', () => {
  it('extracts the app name from Android file names', () => {
    expect(appNameFromFilename('Screenshot_20261120_101530_Amazon Shopping.jpg')).toBe('Amazon Shopping');
    expect(appNameFromFilename('Screenshot_20261120-101530_com.google.android.apps.maps.png')).toBe(
      'com.google.android.apps.maps',
    );
    expect(appNameFromFilename('Screenshot_20261120-101530.png')).toBeNull();
    expect(appNameFromFilename('IMG_1234.PNG')).toBeNull();
    expect(appNameFromFilename(null)).toBeNull();
  });

  it('maps known apps to categories', () => {
    expect(categoryFromFilename('Screenshot_20261120_101530_Amazon Shopping.jpg')).toBe('shopping');
    expect(categoryFromFilename('Screenshot_20261120_101530_com.google.android.apps.maps.jpg')).toBe('map');
    expect(categoryFromFilename('Screenshot_20261120_101530_LINE.jpg')).toBe('chat');
    expect(categoryFromFilename('Screenshot_20261120_101530_jp.naver.line.android.jpg')).toBe('chat');
    expect(categoryFromFilename('Screenshot_20261120_101530_DB Navigator.jpg')).toBe('ticket');
    expect(categoryFromFilename('Screenshot_20261120_101530_PayPal.jpg')).toBe('receipt');
  });

  it('does not match short names inside unrelated words', () => {
    // "line" must not match "Online Banking" -> should be receipt via "banking"
    expect(categoryFromFilename('Screenshot_20261120_101530_Online Banking.jpg')).toBe('receipt');
    expect(categoryFromFilename('Screenshot_20261120_101530_Chrome.jpg')).toBeNull();
  });
});

describe('dhash', () => {
  it('produces 16 hex chars and is stable', () => {
    const px = new Uint8Array(9 * 8 * 4);
    for (let i = 0; i < 9 * 8; i++) {
      const v = (i * 37) % 256;
      px.set([v, v, v, 255], i * 4);
    }
    const h = dhashFromRgba(px);
    expect(h).toMatch(/^[0-9a-f]{16}$/);
    expect(dhashFromRgba(px)).toBe(h);
  });

  it('measures hamming distance', () => {
    expect(hammingDistance(H1, H1)).toBe(0);
    expect(hammingDistance(H1, H1_NEAR)).toBe(1);
    expect(hammingDistance('0000000000000000', 'ffffffffffffffff')).toBe(64);
    expect(hammingDistance('00', '0000')).toBe(64);
  });

  it('decodes base64', () => {
    const text = (bytes: Uint8Array) => String.fromCharCode(...bytes);
    expect(text(base64ToBytes(''))).toBe('');
    expect(text(base64ToBytes('YQ=='))).toBe('a');
    expect(text(base64ToBytes('YWI='))).toBe('ab');
    expect(text(base64ToBytes('YWJj'))).toBe('abc');
    expect(text(base64ToBytes('aGVsbG8gd29ybGQ='))).toBe('hello world');
    expect(Array.from(base64ToBytes('/wAQ'))).toEqual([255, 0, 16]);
    expect(Array.from(base64ToBytes('data:image/png;base64,aGk='))).toEqual([104, 105]);
  });
});

describe('cleanup', () => {
  it('formats local dates', () => {
    expect(localDateString(NOW)).toBe('2026-11-26');
  });

  it('treats a ticket as expired only after its day is over', () => {
    expect(isExpired('2026-11-26', NOW)).toBe(false);
    expect(isExpired('2026-11-25', NOW)).toBe(true);
    expect(isExpired(null, NOW)).toBe(false);
  });

  it('suggests expired, duplicate and stale shots with one reason each', () => {
    const records = [
      shot({ id: 'ticket-old', category: 'ticket', expiresOn: '2026-11-20' }),
      shot({ id: 'ticket-future', category: 'ticket', expiresOn: '2026-12-24', createdAt: NOW - 200 * DAY }),
      shot({ id: 'map-old', category: 'map', createdAt: NOW - 20 * DAY }),
      shot({ id: 'map-new', category: 'map', createdAt: NOW - 3 * DAY }),
      shot({ id: 'burst-1', dhash: H1, createdAt: NOW - 2 * DAY }),
      shot({ id: 'burst-2', dhash: H1_NEAR, createdAt: NOW - 2 * DAY + 5_000 }),
    ];
    const s = computeSuggestions(records, NOW, 'standard');
    expect(s.map((x) => [x.id, x.reason])).toEqual([
      ['ticket-old', 'expired'],
      ['burst-1', 'duplicate'],
      ['map-old', 'stale'],
    ]);
    expect(s.find((x) => x.id === 'burst-1')?.keptId).toBe('burst-2');
  });

  it('never suggests favourites, pinned or important shots', () => {
    const old = NOW - 400 * DAY;
    const records = [
      shot({ id: 'fav', createdAt: old, isFavorite: true }),
      shot({ id: 'pin', createdAt: old, pinned: true }),
      shot({ id: 'imp', createdAt: old, important: true, expiresOn: '2020-01-01' }),
      shot({ id: 'plain', createdAt: old }),
    ];
    expect(computeSuggestions(records, NOW, 'standard').map((x) => x.id)).toEqual(['plain']);
  });

  it('resets the clock when a shot was opened in the app', () => {
    const r = shot({ id: 'm', category: 'map', createdAt: NOW - 30 * DAY, lastViewedAt: NOW - 2 * DAY });
    expect(computeSuggestions([r], NOW, 'standard')).toEqual([]);
  });

  it('scales shelf life with strength', () => {
    const r = shot({ id: 'm', category: 'map', createdAt: NOW - 20 * DAY }); // map = 14 days
    expect(computeSuggestions([r], NOW, 'standard')).toHaveLength(1);
    expect(computeSuggestions([r], NOW, 'gentle')).toHaveLength(0); // 28 days
    expect(computeSuggestions([r], NOW, 'tidy')).toHaveLength(1); // 7 days
  });

  it('keeps unsorted screenshots for 90 days by default', () => {
    const young = shot({ id: 'u1', category: 'unsorted', createdAt: NOW - 60 * DAY });
    const old = shot({ id: 'u2', category: 'unsorted', createdAt: NOW - 100 * DAY });
    expect(computeSuggestions([young, old], NOW, 'standard').map((x) => x.id)).toEqual(['u2']);
  });

  it('does not treat scrolling screenshots as duplicates', () => {
    const records = [
      shot({ id: 'a', dhash: H1, createdAt: NOW - DAY }),
      shot({ id: 'b', dhash: H2, createdAt: NOW - DAY + 3_000 }),
    ];
    expect(findDuplicates(records).size).toBe(0);
  });

  it('ignores near-blank images when looking for duplicates', () => {
    const records = [
      shot({ id: 'a', dhash: '0000000000000000', createdAt: NOW - DAY }),
      shot({ id: 'b', dhash: '0000000000000000', createdAt: NOW - DAY + 1_000 }),
    ];
    expect(findDuplicates(records).size).toBe(0);
  });

  it('finds identical screens saved days apart, but not near ones', () => {
    const records = [
      shot({ id: 'a', dhash: H1, createdAt: NOW - 10 * DAY }),
      shot({ id: 'b', dhash: H1, createdAt: NOW - 2 * DAY }),
      shot({ id: 'c', dhash: H1_NEAR, createdAt: NOW - 30 * DAY }),
    ];
    const d = findDuplicates(records);
    expect([...d.entries()]).toEqual([['a', 'b']]);
  });

  it('keeps the pinned shot of a duplicate group', () => {
    const records = [
      shot({ id: 'a', dhash: H1, createdAt: NOW - DAY, pinned: true }),
      shot({ id: 'b', dhash: H1, createdAt: NOW - DAY + 1_000 }),
    ];
    expect([...findDuplicates(records).entries()]).toEqual([['b', 'a']]);
  });

  it('does not group different screen sizes', () => {
    const records = [
      shot({ id: 'a', dhash: H1, createdAt: NOW - DAY }),
      shot({ id: 'b', dhash: H1, createdAt: NOW - DAY + 1_000, width: 1080, height: 2400 }),
    ];
    expect(findDuplicates(records).size).toBe(0);
  });

  it('summarises and decides whether to notify', () => {
    const sum = summarize([
      { id: '1', reason: 'stale', bytes: 10 },
      { id: '2', reason: 'stale', bytes: 20 },
    ]);
    expect(sum.count).toBe(2);
    expect(sum.bytes).toBe(30);
    expect(isWorthNotifying(sum)).toBe(false);
    expect(isWorthNotifying(summarize([{ id: '1', reason: 'expired', bytes: 1 }]))).toBe(true);
  });

  it('handles a large library quickly', () => {
    const many: ShotRecord[] = [];
    for (let i = 0; i < 5000; i++) {
      many.push(shot({ id: String(i), dhash: i % 2 ? H1 : H2, createdAt: NOW - i * 60_000 }));
    }
    const t = Date.now();
    computeSuggestions(many, NOW, 'standard');
    expect(Date.now() - t).toBeLessThan(1500);
  });
});

describe('ai', () => {
  it('builds a request with an image and a forced tool call', () => {
    const body = buildRequestBody({ imageBase64: 'AAAA', mediaType: 'image/jpeg', language: 'ja', today: '2026-11-26' });
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'record_screenshot' });
    expect(body.messages[0].content[0]).toMatchObject({ type: 'image', source: { data: 'AAAA' } });
    expect(body.system).toContain('2026-11-26');
    expect(body.system).toContain('Japanese');
  });

  it('parses and validates tool output', () => {
    const res = parseAiResponse({
      content: [
        { type: 'text', text: 'ok' },
        {
          type: 'tool_use',
          name: 'record_screenshot',
          input: {
            category: 'ticket',
            title: '  Lufthansa   LH 716  ',
            keywords: 'Munich Tokyo',
            expires_on: '2026-12-20',
            important: false,
          },
        },
      ],
    });
    expect(res).toEqual({
      category: 'ticket',
      title: 'Lufthansa LH 716',
      keywords: 'Munich Tokyo',
      expiresOn: '2026-12-20',
      important: false,
    });
  });

  it('falls back safely on bad values', () => {
    const res = parseAiResponse({
      content: [
        {
          type: 'tool_use',
          name: 'record_screenshot',
          input: { category: 'banana', title: 5, expires_on: '2026-02-30', important: 'yes' },
        },
      ],
    });
    expect(res).toEqual({ category: 'other', title: '', keywords: '', expiresOn: null, important: false });
    expect(() => parseAiResponse({ content: [] })).toThrow();
    expect(() => parseAiResponse(null)).toThrow();
  });

  it('validates ISO dates', () => {
    expect(isValidIsoDate('2026-12-31')).toBe(true);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('26-12-31')).toBe(false);
    expect(isValidIsoDate(null)).toBe(false);
  });

  it('maps HTTP errors to codes', () => {
    expect(describeHttpError(401, {})).toBe('invalid_key');
    expect(describeHttpError(429, {})).toBe('rate_limited');
    expect(describeHttpError(529, {})).toBe('server_busy');
    expect(describeHttpError(400, { error: { message: 'bad' } })).toBe('http_400: bad');
  });
});

describe('format', () => {
  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 MB');
    expect(formatBytes(512 * 1024)).toBe('512 KB');
    expect(formatBytes(48 * 1024 * 1024)).toBe('48.0 MB');
    expect(formatBytes(1.25 * 1024 * 1024 * 1024)).toBe('1.3 GB');
  });

  it('estimates sizes', () => {
    expect(estimateBytes(1170, 2532, 'IMG_1.PNG')).toBeGreaterThan(estimateBytes(1170, 2532, 'a.jpg'));
    expect(estimateBytes(0, 0, null)).toBe(500 * 1024);
  });
});


describe('schedule', () => {
  // 26 Nov 2026 is a Thursday (weekday 5).
  it('finds the coming Sunday 19:00', () => {
    const d = nextWeeklyTime(NOW, 1, 19);
    expect(d.getDay()).toBe(0);
    expect(d.getDate()).toBe(29);
    expect(d.getHours()).toBe(19);
  });
  it('uses today if still ahead, next week if too close or past', () => {
    expect(nextWeeklyTime(NOW, 5, 19).getDate()).toBe(26);
    expect(nextWeeklyTime(NOW, 5, 12).getDate()).toBe(3); // noon already now -> next Thursday (3 Dec)
    expect(nextWeeklyTime(NOW, 5, 12).getMonth()).toBe(11);
  });
});


describe('merge', () => {
  const item = (id: string, t: number, extra: Partial<Parameters<typeof newRecord>[0]> = {}) => ({
    id,
    filename: null,
    width: 1080,
    height: 2400,
    creationTime: t,
    modificationTime: t,
    isFavorite: false,
    ...extra,
  });

  it('adds new, removes deleted, keeps analysis of existing', () => {
    const existing = { a: shot({ id: 'a', title: 'kept title', createdAt: 1 }), gone: shot({ id: 'gone' }) };
    const res = mergeLibrary(existing, [item('a', 1), item('b', 2, { filename: 'Screenshot_20261120_101530_Amazon.jpg' })]);
    expect(res.added).toBe(1);
    expect(res.removed).toBe(1);
    expect(res.order).toEqual(['b', 'a']);
    expect(res.records.a.title).toBe('kept title');
    expect(res.records.b.category).toBe('shopping');
    expect(res.records.b.categorySource).toBe('local');
    expect(res.records.b.bytesEstimated).toBe(true);
  });

  it('refreshes favourite state', () => {
    const existing = { a: shot({ id: 'a' }) };
    const res = mergeLibrary(existing, [item('a', 1, { isFavorite: true })]);
    expect(res.records.a.isFavorite).toBe(true);
  });

  it('handles missing dimensions and times', () => {
    const r = newRecord(item('x', 0, { width: null, height: null, creationTime: null, modificationTime: 5 }));
    expect(r.createdAt).toBe(5);
    expect(r.bytes).toBeGreaterThan(0);
    expect(r.category).toBe('unsorted');
  });

  it('searches title, keywords and category, full-width tolerant', () => {
    const r = shot({ id: 's', title: 'Ａｍａｚｏｎ: イヤホン', keywords: 'Sony WF-1000XM6' });
    expect(matchesQuery(r, 'amazon', '商品・買い物')).toBe(true);
    expect(matchesQuery(r, 'sony イヤホン', '')).toBe(true);
    expect(matchesQuery(r, '買い物', '商品・買い物')).toBe(true);
    expect(matchesQuery(r, 'apple', '')).toBe(false);
    expect(matchesQuery(r, '   ', '')).toBe(true);
  });
});



describe('n8n', () => {
  it('builds the webhook payload', () => {
    expect(buildN8nPayload({ imageBase64: 'AA', mediaType: 'image/jpeg', language: 'en', today: '2026-11-26' })).toEqual({
      image_base64: 'AA',
      media_type: 'image/jpeg',
      language: 'en',
      today: '2026-11-26',
    });
  });
  it('accepts plain, wrapped and array answers', () => {
    const fields = { category: 'map', title: 'Route', keywords: 'a', expires_on: null, important: false };
    const want = { category: 'map', title: 'Route', keywords: 'a', expiresOn: null, important: false };
    expect(parseN8nResponse(fields)).toEqual(want);
    expect(parseN8nResponse({ result: fields })).toEqual(want);
    expect(parseN8nResponse([fields])).toEqual(want);
    expect(() => parseN8nResponse({ message: 'Workflow was started' })).toThrow();
  });
});
