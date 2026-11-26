import { Platform } from 'react-native';
import type { CategoryId } from '../core/categories';
import type { LibraryItem } from '../core/merge';
import type { AiResult } from '../core/types';
import { lang } from '../i18n';

/**
 * Browser demo. On the web there is no photo library, so SnapSort runs on
 * these sample screenshots instead. Everything else — the store, the
 * cleanup engine, the screens — is the real app code.
 */
export const IS_DEMO = Platform.OS === 'web';

/** Set by the promo-video recorder to hide the demo notice. */
export const SHOW_DEMO_NOTICE =
  IS_DEMO && !(typeof window !== 'undefined' && (window as unknown as { __SNAPSORT_VIDEO__?: boolean }).__SNAPSORT_VIDEO__);

const DAY = 24 * 60 * 60 * 1000;
const W = 1170;
const H = 2532;

type Sample = {
  id: string;
  /** Days before now the screenshot was taken. */
  ago: number;
  /** Extra seconds, for bursts taken a few seconds apart. */
  sec?: number;
  category: CategoryId;
  title: { ja: string; en: string };
  keywords: string;
  /** Days from today; negative = already over. */
  expiresIn?: number;
  important?: boolean;
  hasCode?: boolean;
  /** Same value = same screen (duplicate detection). */
  hash?: string;
  favorite?: boolean;
  kb: number;
  look: Look;
};

type Look = {
  bar: string;
  app: string;
  lines: string[];
  code?: 'qr' | 'bar';
  map?: boolean;
  bubbles?: boolean;
  dark?: boolean;
  product?: string;
};

const SAMPLES: Sample[] = [
  {
    id: 'boarding-lh', ago: 12, category: 'ticket', kb: 610, expiresIn: -4, hasCode: true,
    title: { ja: 'Lufthansa LH 716 搭乗券', en: 'Lufthansa LH 716 boarding pass' },
    keywords: 'Frankfurt Tokyo Haneda LH716 gate B44',
    look: { bar: '#0B1F4B', app: 'Lufthansa', lines: ['FRA → HND', 'LH 716 · Seat 34K', 'Boarding 21:05 · Gate B44'], code: 'qr' },
  },
  {
    id: 'db-ticket', ago: 3, category: 'ticket', kb: 540, expiresIn: 6, hasCode: true,
    title: { ja: 'DB ICE ハイルブロン→ミュンヘン', en: 'DB ICE Heilbronn → München' },
    keywords: 'Deutsche Bahn ICE Heilbronn München Sparpreis',
    look: { bar: '#EC0016', app: 'DB Navigator', lines: ['Heilbronn Hbf → München Hbf', 'ICE 2297 · Wagen 7', 'Sparpreis · 1 Erw.'], code: 'qr' },
  },
  {
    id: 'rewe-coupon', ago: 20, category: 'coupon', kb: 380, expiresIn: -6, hasCode: true,
    title: { ja: 'REWE 10%オフクーポン', en: 'REWE 10% off coupon' },
    keywords: 'REWE coupon 10% Rabatt',
    look: { bar: '#CC071E', app: 'REWE', lines: ['10 % Rabatt', 'auf deinen Einkauf', 'gültig bis 20.11.'], code: 'bar' },
  },
  {
    id: 'payback', ago: 200, category: 'coupon', kb: 300, hasCode: true, favorite: true,
    title: { ja: 'PAYBACK 会員カード', en: 'PAYBACK member card' },
    keywords: 'PAYBACK Karte',
    look: { bar: '#003EB0', app: 'PAYBACK', lines: ['Deine Karte', 'an der Kasse zeigen'], code: 'bar' },
  },
  {
    id: 'amazon-earbuds', ago: 41, category: 'shopping', kb: 1450,
    title: { ja: 'Amazon: ワイヤレスイヤホン', en: 'Amazon: wireless earbuds' },
    keywords: 'Amazon Sony WF-1000XM5 Kopfhörer 199€',
    look: { bar: '#131921', app: 'amazon', lines: ['Sony WF-1000XM5', '★★★★☆ 12.408', '199,00 €'], product: '#2B2B2B' },
  },
  {
    id: 'zalando-jacket', ago: 4, category: 'shopping', kb: 1620,
    title: { ja: 'Zalando: ダウンジャケット', en: 'Zalando: down jacket' },
    keywords: 'Zalando Jacke Winter 149€',
    look: { bar: '#FF6900', app: 'Zalando', lines: ['Daunenjacke', 'Größe M · Schwarz', '149,95 €'], product: '#3C4A3E' },
  },
  {
    id: 'order-confirm', ago: 35, category: 'receipt', kb: 720,
    title: { ja: '注文確認 #302-118', en: 'Order confirmation #302-118' },
    keywords: 'Bestellung Lieferung order 302-118',
    look: { bar: '#232F3E', app: 'Bestellung', lines: ['Vielen Dank!', 'Bestellung 302-118…', 'Lieferung Do., 2. Okt.'] },
  },
  {
    id: 'paypal', ago: 150, category: 'receipt', kb: 410,
    title: { ja: 'PayPal 送金完了 €35', en: 'PayPal payment sent €35' },
    keywords: 'PayPal 35€ Mitbewohner',
    look: { bar: '#003087', app: 'PayPal', lines: ['35,00 € gesendet', 'an Ruoyao', 'Strom November'] },
  },
  {
    id: 'line-chat', ago: 75, category: 'chat', kb: 880,
    title: { ja: 'LINE: 年末の予定', en: 'LINE: plans for New Year' },
    keywords: 'LINE 年末 帰省 予定',
    look: { bar: '#06C755', app: 'LINE', lines: ['年末いつ帰る？', '28日の便にした', 'じゃあ29日に集合で'], bubbles: true },
  },
  {
    id: 'whatsapp', ago: 9, category: 'chat', kb: 760,
    title: { ja: 'WhatsApp: ランニングクラブ', en: 'WhatsApp: running club' },
    keywords: 'running club Sunday 9am Neckar',
    look: { bar: '#075E54', app: 'Running Club', lines: ['Sunday 9:00 at the bridge', '10 km easy pace', '👍 x7'], bubbles: true },
  },
  {
    id: 'map-1', ago: 2, sec: 0, category: 'map', kb: 2100, hash: 'b4d2a59c3e71c80f',
    title: { ja: 'Google マップ: Bildungscampus', en: 'Google Maps: Bildungscampus' },
    keywords: 'Bildungscampus Heilbronn walking 12 min',
    look: { bar: '#FFFFFF', app: 'Maps', lines: ['Bildungscampus', '12 min · 900 m'], map: true },
  },
  {
    id: 'map-2', ago: 2, sec: 8, category: 'map', kb: 2100, hash: 'b4d2a59c3e71c80e',
    title: { ja: 'Google マップ: Bildungscampus', en: 'Google Maps: Bildungscampus' },
    keywords: 'Bildungscampus Heilbronn walking 12 min',
    look: { bar: '#FFFFFF', app: 'Maps', lines: ['Bildungscampus', '12 min · 900 m'], map: true },
  },
  {
    id: 'map-3', ago: 2, sec: 15, category: 'map', kb: 2100, hash: 'b4d2a59c3e71c80f',
    title: { ja: 'Google マップ: Bildungscampus', en: 'Google Maps: Bildungscampus' },
    keywords: 'Bildungscampus Heilbronn walking 12 min',
    look: { bar: '#FFFFFF', app: 'Maps', lines: ['Bildungscampus', '11 min · 900 m'], map: true },
  },
  {
    id: 'map-old', ago: 33, category: 'map', kb: 1980,
    title: { ja: 'Google マップ: Stuttgart Hbf', en: 'Google Maps: Stuttgart Hbf' },
    keywords: 'Stuttgart Hauptbahnhof route',
    look: { bar: '#FFFFFF', app: 'Maps', lines: ['Stuttgart Hbf', '45 min · S4'], map: true },
  },
  {
    id: 'recipe', ago: 60, category: 'info', kb: 1320,
    title: { ja: '親子丼のレシピ', en: 'Oyakodon recipe' },
    keywords: '親子丼 レシピ 鶏肉 卵 oyakodon',
    look: { bar: '#F4F1EA', app: 'Recipe', lines: ['親子丼', '鶏もも 200g · 卵 3個', 'だし 150ml · みりん 大2'], product: '#E8B04B' },
  },
  {
    id: 'article', ago: 220, category: 'info', kb: 990,
    title: { ja: '記事: 睡眠と集中力', en: 'Article: sleep and focus' },
    keywords: 'sleep focus study article',
    look: { bar: '#FFFFFF', app: 'Article', lines: ['Why sleep beats', 'all-nighters', '6 min read'] },
  },
  {
    id: 'error', ago: 46, category: 'tech', kb: 520,
    title: { ja: 'エラー: npm ERESOLVE', en: 'Error: npm ERESOLVE' },
    keywords: 'npm ERESOLVE peer dependency react-dom',
    look: { bar: '#1E1E1E', app: 'Terminal', lines: ['npm error ERESOLVE', 'could not resolve', 'peer react@19'], dark: true },
  },
  {
    id: 'settings', ago: 5, category: 'tech', kb: 450,
    title: { ja: '設定: Wi-Fi', en: 'Settings: Wi-Fi' },
    keywords: 'Wi-Fi eduroam settings',
    look: { bar: '#F2F2F7', app: 'Settings', lines: ['Wi-Fi', 'eduroam ✓', 'TUM-Guest'] },
  },
  {
    id: 'lease', ago: 300, category: 'info', kb: 1100, important: true,
    title: { ja: '賃貸契約書 1ページ目', en: 'Rental contract, page 1' },
    keywords: 'Mietvertrag contract Heilbronn',
    look: { bar: '#FFFFFF', app: 'Mietvertrag', lines: ['Mietvertrag', 'für Wohnraum', '§1 Mietsache'] },
  },
  {
    id: 'meme', ago: 130, category: 'other', kb: 830,
    title: { ja: 'ミーム: 月曜の朝', en: 'Meme: Monday morning' },
    keywords: 'meme Monday',
    look: { bar: '#000000', app: 'Instagram', lines: ['me on monday', 'at 8:00'], product: '#9C6B3C', dark: true },
  },
];

// ------------------------------------------------------------ fake screenshots

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b > 160;
}

function pseudoRandom(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function qr(x: number, y: number, size: number, seed: string): string {
  const rnd = pseudoRandom(seed);
  const n = 21;
  const c = size / n;
  let out = `<rect x="${x - 12}" y="${y - 12}" width="${size + 24}" height="${size + 24}" fill="#fff"/>`;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const finder = (i < 7 && j < 7) || (i < 7 && j >= n - 7) || (i >= n - 7 && j < 7);
      let on: boolean;
      if (finder) {
        const fi = i % (n - 7);
        const fj = j % (n - 7);
        const ri = Math.min(fi, 6 - fi);
        const rj = Math.min(fj, 6 - fj);
        on = Math.min(ri, rj) !== 1;
      } else on = rnd() > 0.5;
      if (on) out += `<rect x="${(x + j * c).toFixed(1)}" y="${(y + i * c).toFixed(1)}" width="${c.toFixed(1)}" height="${c.toFixed(1)}" fill="#111"/>`;
    }
  }
  return out;
}

function barcode(x: number, y: number, w: number, h: number, seed: string): string {
  const rnd = pseudoRandom(seed);
  let out = `<rect x="${x - 14}" y="${y - 14}" width="${w + 28}" height="${h + 40}" fill="#fff"/>`;
  let cx = x;
  while (cx < x + w) {
    const bw = 1 + Math.floor(rnd() * 4);
    if (rnd() > 0.45) out += `<rect x="${cx}" y="${y}" width="${bw}" height="${h}" fill="#111"/>`;
    cx += bw + 1;
  }
  out += `<text x="${x + w / 2}" y="${y + h + 20}" font-size="13" text-anchor="middle" fill="#111" font-family="monospace">4 012345 678901</text>`;
  return out;
}

function renderSvg(s: Sample): string {
  const L = s.look;
  const bg = L.dark ? '#121212' : '#FFFFFF';
  const ink = L.dark ? '#F2F2F2' : '#111111';
  const barInk = isLight(L.bar) ? '#111' : '#fff';
  const parts: string[] = [];
  parts.push(`<rect width="390" height="844" fill="${bg}"/>`);
  parts.push(`<rect width="390" height="110" fill="${L.bar}"/>`);
  parts.push(`<text x="24" y="28" font-size="14" font-weight="600" fill="${barInk}">9:41</text>`);
  parts.push(`<rect x="330" y="17" width="36" height="14" rx="4" fill="none" stroke="${barInk}" stroke-width="1.5"/>`);
  parts.push(`<text x="24" y="86" font-size="26" font-weight="700" fill="${barInk}">${esc(L.app)}</text>`);

  let y = 150;
  if (L.map) {
    parts.push(`<rect x="0" y="110" width="390" height="520" fill="#E8EEE4"/>`);
    parts.push(`<path d="M-10 300 C 120 260, 200 420, 400 380" stroke="#fff" stroke-width="22" fill="none"/>`);
    parts.push(`<path d="M140 110 L 180 640" stroke="#fff" stroke-width="16"/>`);
    parts.push(`<rect x="230" y="150" width="120" height="90" fill="#CFE3C4"/>`);
    parts.push(`<path d="M80 520 C 120 450, 160 380, 250 300" stroke="#1A73E8" stroke-width="7" fill="none" stroke-dasharray="1 0"/>`);
    parts.push(`<circle cx="80" cy="520" r="10" fill="#1A73E8" stroke="#fff" stroke-width="3"/>`);
    parts.push(`<path d="M250 268 a 16 16 0 1 1 0.1 0 Z M250 300 L 240 280 L 260 280 Z" fill="#EA4335"/>`);
    y = 680;
  }
  if (L.product) {
    parts.push(`<rect x="24" y="${y}" width="342" height="260" rx="16" fill="${L.product}"/>`);
    parts.push(`<circle cx="195" cy="${y + 130}" r="70" fill="rgba(255,255,255,0.18)"/>`);
    y += 290;
  }
  if (L.bubbles) {
    L.lines.forEach((line, i) => {
      const mine = i % 2 === 1;
      const w = Math.min(300, 40 + line.length * 13);
      const x = mine ? 366 - w : 24;
      parts.push(`<rect x="${x}" y="${y}" width="${w}" height="54" rx="20" fill="${mine ? '#95EC69' : '#EDEDED'}"/>`);
      parts.push(`<text x="${x + 18}" y="${y + 34}" font-size="17" fill="#111">${esc(line)}</text>`);
      y += 74;
    });
  } else {
    L.lines.forEach((line, i) => {
      parts.push(`<text x="24" y="${y + 30}" font-size="${i === 0 ? 30 : 20}" font-weight="${i === 0 ? 700 : 400}" fill="${ink}">${esc(line)}</text>`);
      y += i === 0 ? 54 : 38;
    });
  }
  if (L.code === 'qr') parts.push(qr(105, y + 30, 180, s.id));
  if (L.code === 'bar') parts.push(barcode(70, y + 40, 250, 90, s.id));
  if (!L.map && !L.code && !L.bubbles) {
    for (let i = 0; i < 6; i++) {
      parts.push(`<rect x="24" y="${y + 20 + i * 28}" width="${300 - (i % 3) * 60}" height="10" rx="5" fill="${L.dark ? '#333' : '#E6E6E6'}"/>`);
    }
  }
  parts.push(`<rect x="130" y="826" width="130" height="5" rx="2.5" fill="${L.dark ? '#fff' : '#111'}"/>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 844" font-family="-apple-system, Helvetica, Arial, sans-serif">${parts.join('')}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ------------------------------------------------------------ demo "library"

const byId = new Map(SAMPLES.map((s) => [s.id, s]));
const deleted = new Set<string>();
const imageCache = new Map<string, string>();
const loadedAt = Date.now();

function createdAt(s: Sample): number {
  return loadedAt - s.ago * DAY + (s.sec ?? 0) * 1000;
}

export function demoImageUri(id: string): string {
  let uri = imageCache.get(id);
  if (!uri) {
    const s = byId.get(id);
    uri = s ? renderSvg(s) : '';
    imageCache.set(id, uri);
  }
  return uri;
}

export function demoLibrary(): LibraryItem[] {
  return SAMPLES.filter((s) => !deleted.has(s.id)).map((s) => ({
    id: s.id,
    filename: `IMG_${s.id}.PNG`,
    width: W,
    height: H,
    creationTime: createdAt(s),
    modificationTime: createdAt(s),
    isFavorite: !!s.favorite,
  }));
}

export function demoDelete(ids: string[]) {
  ids.forEach((id) => deleted.add(id));
}

function informativeHash(id: string): string {
  const rnd = pseudoRandom(`hash:${id}`);
  let hex = '';
  for (let i = 0; i < 16; i++) hex += Math.floor(rnd() * 16).toString(16);
  return hex;
}

export function demoLocal(id: string) {
  const s = byId.get(id);
  return {
    bytes: (s?.kb ?? 500) * 1024,
    hasCode: !!s?.hasCode,
    dhash: s?.hash ?? informativeHash(id),
    shape: null,
  };
}

function isoInDays(days: number): string {
  const d = new Date(loadedAt + days * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function demoAi(id: string): AiResult {
  const s = byId.get(id);
  if (!s) return { category: 'other', title: '', keywords: '', expiresOn: null, important: false };
  return {
    category: s.category,
    title: s.title[lang],
    keywords: s.keywords,
    expiresOn: s.expiresIn === undefined ? null : isoInDays(s.expiresIn),
    important: !!s.important,
  };
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Image source for a screenshot id (the id itself on phones, a generated picture in the demo). */
export function imageUri(id: string): string {
  return IS_DEMO ? demoImageUri(id) : id;
}
