import type { CategoryId } from './categories';

/**
 * Free, offline category guess from the screenshot's file name.
 *
 * Many Android phones (Samsung, Xiaomi, OnePlus, some Pixels) put the
 * name of the app that was on screen into the file name, e.g.
 *   Screenshot_20261120_101530_Amazon Shopping.jpg
 *   Screenshot_20261120-101530_com.google.android.apps.maps.png
 * iPhones use IMG_1234.PNG, so this returns null there and the AI
 * (or the user) decides instead.
 */

type Rule = { category: CategoryId; patterns: string[] };

// Order matters: the first matching rule wins.
const RULES: Rule[] = [
  {
    category: 'ticket',
    patterns: [
      'dbnavigator', 'db navigator', 'bahn', 'flixbus', 'ryanair', 'lufthansa', 'easyjet',
      'eurowings', 'wizz', 'ana', 'jal', 'ticketmaster', 'eventim', 'boarding', 'trainline',
      'omio', 'booking', 'airbnb', 'hotels', 'expedia', 'ekinet', 'smartex', 'jrwest', 'jreast',
    ],
  },
  {
    category: 'coupon',
    patterns: ['payback', 'lidl', 'kaufland', 'rewe', 'mcdonald', 'starbucks', 'paypay', 'rakutenpay', 'coupon', 'stocard'],
  },
  {
    category: 'receipt',
    patterns: ['paypal', 'revolut', 'n26', 'sparkasse', 'commerzbank', 'ing', 'wise', 'banking', 'bank', 'klarna', 'sumup'],
  },
  {
    category: 'shopping',
    patterns: [
      'amazon', 'mshop', 'ebay', 'zalando', 'shein', 'temu', 'aliexpress', 'mercari', 'rakuten',
      'vinted', 'kleinanzeigen', 'etsy', 'ikea', 'zara', 'uniqlo', 'idealo', 'otto', 'mediamarkt', 'shop',
    ],
  },
  {
    category: 'map',
    patterns: ['maps', 'citymapper', 'waze', 'moovit', 'navitime', 'transit', 'organicmaps', 'osmand'],
  },
  {
    category: 'chat',
    patterns: [
      'line', 'whatsapp', 'messenger', 'telegram', 'signal', 'instagram', 'twitter', 'threads',
      'discord', 'slack', 'teams', 'facebook', 'snapchat', 'wechat', 'kakaotalk', 'messages', 'mms',
      'tiktok', 'reddit', 'bluesky', 'mastodon', 'linkedin',
    ],
  },
  {
    category: 'tech',
    patterns: ['settings', 'android.settings', 'packageinstaller', 'github', 'termux', 'vscode'],
  },
];

/** Extracts the app part of an Android screenshot file name, or null. */
export function appNameFromFilename(filename: string | null | undefined): string | null {
  if (!filename) return null;
  const base = filename.replace(/\.[a-z0-9]+$/i, '');
  // Screenshot_<date>[_-]<time>[_-]<app>
  const match = /^screenshot[_-]?\d{8}[_-]?\d{4,6}(?:\d{3})?[_-](.+)$/i.exec(base);
  if (!match) return null;
  const app = match[1].trim();
  return app.length > 0 ? app : null;
}

function normalise(app: string): string {
  return app.toLowerCase().replace(/[_]+/g, ' ');
}

function matches(appNorm: string, pattern: string): boolean {
  // Package names: match whole dot/space separated tokens so "line" does not hit "online".
  const tokens = appNorm.split(/[.\s-]+/).filter(Boolean);
  if (pattern.includes(' ') || pattern.includes('.')) return appNorm.includes(pattern);
  if (pattern.length <= 4) return tokens.includes(pattern);
  return tokens.some((t) => t.includes(pattern));
}

export function categoryFromFilename(filename: string | null | undefined): CategoryId | null {
  const app = appNameFromFilename(filename);
  if (!app) return null;
  const norm = normalise(app);
  for (const rule of RULES) {
    if (rule.patterns.some((p) => matches(norm, p))) return rule.category;
  }
  return null;
}
