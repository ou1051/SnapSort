import { getLocales } from 'expo-localization';
import type { CategoryId, CategoryOrUnsorted } from './core/categories';
import type { CleanupReason, CleanupStrength } from './core/types';

export type Lang = 'ja' | 'en';

function detectLang(): Lang {
  try {
    return getLocales()[0]?.languageCode === 'ja' ? 'ja' : 'en';
  } catch {
    return 'en';
  }
}

export const lang: Lang = detectLang();

const ja = {
  appName: 'SnapSort',
  // onboarding
  onboardTitle: 'スクショを、\n自動で片付ける。',
  onboardBody:
    'たまったスクリーンショットを種類ごとに仕分けして、もう要らなさそうなものを教えます。消すのはあなたが確認してから。',
  onboardPoint1: '期限が過ぎたチケットやクーポンを見つける',
  onboardPoint2: '同じ画面を何枚も撮ったスクショをまとめる',
  onboardPoint3: '週に一度、空けられる容量をお知らせ',
  allowPhotos: '写真へのアクセスを許可',
  openSettings: '設定アプリを開く',
  deniedBody: '写真へのアクセスがオフになっています。設定アプリでSnapSortの「写真」をオンにしてください。',
  limitedNote: '一部の写真だけ許可されています。すべてのスクショを整理するには「フルアクセス」を許可してください。',
  changeAccess: '許可を変更',
  // home
  screenshots: 'スクリーンショット',
  shotsCount: (n: number) => `${n}枚`,
  canFree: '片付けられる容量',
  reviewCta: (n: number) => `${n}枚を確認する`,
  allClean: 'いまは片付けるものがありません',
  allCleanSub: '新しいスクショは自動でチェックします',
  analyzing: (done: number, total: number) => `仕分け中 ${done}/${total}`,
  analyzingAi: (done: number, total: number) => `AIで内容を確認中 ${done}/${total}`,
  scanning: 'スクショを探しています…',
  categories: '種類別',
  withCode: 'バーコード・QR付き',
  searchPlaceholder: 'スクショを検索（店名、場所など）',
  noResults: '見つかりませんでした',
  aiOffHint: 'AI仕分けをオンにすると、商品ページやチケットなど内容まで分かります',
  turnOn: 'オンにする',
  aiErrorKey: 'APIキーが正しくないため、AI仕分けを止めました',
  aiErrorOther: 'AI仕分けが一時的に使えません。あとで自動で再開します',
  fix: '直す',
  // review
  reviewTitle: '片付け候補',
  reasonTitle: {
    expired: '期限切れ',
    duplicate: '同じ画面のスクショ',
    stale: 'しばらく見ていない',
  } as Record<CleanupReason, string>,
  reasonSub: {
    expired: '日付が過ぎたチケット・クーポン・予約',
    duplicate: '一番新しい1枚を残します',
    stale: '種類ごとの目安の期間を過ぎたもの',
  } as Record<CleanupReason, string>,
  selectAll: 'すべて選択',
  selectNone: '選択を解除',
  deleteN: (n: number, size: string) => `${n}枚を削除（${size}）`,
  nothingSelected: '削除するスクショを選んでください',
  deletedToast: (n: number, size: string) => `${n}枚・${size}を空けました`,
  deleteFailed: '削除できませんでした。もう一度お試しください',
  iosTrashNote: '削除したスクショは写真アプリの「最近削除した項目」に30日間残ります。',
  androidTrashNote: '削除すると元に戻せません。',
  tapToView: 'タップで選択を切り替え・長押しで拡大',
  // shot detail
  keep: '残す',
  kept: '残す設定中',
  keepHint: '「残す」にしたスクショは片付け候補に出ません',
  delete: '削除',
  category: '種類',
  changeCategory: '種類を変更',
  expires: (d: string) => `${d} まで`,
  expired: (d: string) => `${d} に期限切れ`,
  takenOn: (d: string) => `${d} に撮影`,
  importantBadge: '大事そう',
  codeBadge: 'コード付き',
  unknownSize: '約',
  // settings
  settings: '設定',
  sectionCleanup: '片付けの強さ',
  strength: {
    gentle: 'ゆるめ',
    standard: 'ふつう',
    tidy: 'しっかり',
  } as Record<CleanupStrength, string>,
  strengthSub: {
    gentle: '目安の2倍の期間は残す',
    standard: '種類ごとの目安どおり',
    tidy: '目安の半分の期間で候補にする',
  } as Record<CleanupStrength, string>,
  sectionReminder: 'お知らせ',
  weeklyReminder: '週に一度お知らせ',
  weeklyReminderSub: '片付けられる容量がたまったら、日曜の夜に通知します',
  notifDenied: '通知がオフになっています。設定アプリで許可してください。',
  sectionAi: 'AI仕分け',
  aiToggle: 'AIで内容を読み取る',
  aiToggleSub:
    'スクショを縮小してAnthropicのClaude APIに送り、種類・タイトル・期限を判定します。オフでも端末内で、バーコード検出・重複検出・アプリ名からの仕分けは動きます。',
  apiKey: 'Claude APIキー',
  apiKeyPlaceholder: 'sk-ant-…',
  apiKeySaved: '保存済み',
  save: '保存',
  remove: '削除',
  reanalyze: 'すべて仕分けし直す',
  reanalyzeDone: '仕分けし直しを始めました',
  shelfLifeTitle: '種類ごとの目安（ふつう）',
  days: (n: number) => `${n}日`,
  privacyTitle: 'プライバシー',
  privacyBody:
    'AI仕分けがオフのとき、スクショは端末の外に出ません。オンにすると、まだ仕分けていないスクショだけを1回ずつ送ります。大事そうなもの（身分証・契約書など）は自動で片付け候補から外します。',
  // notifications
  notifTitle: 'スクショを片付けませんか',
  notifBody: (n: number, size: string, expired: number) =>
    expired > 0
      ? `期限切れ${expired}枚を含む${n}枚（${size}）を片付けられます`
      : `${n}枚（${size}）を片付けられます`,
  notifChannel: '片付けのお知らせ',
  cancel: 'キャンセル',
  done: '完了',
};

type Strings = typeof ja;

const en: Strings = {
  appName: 'SnapSort',
  onboardTitle: 'Your screenshots,\ntidied up for you.',
  onboardBody:
    'SnapSort sorts your screenshots by kind and tells you which ones you probably don’t need anymore. Nothing is deleted until you confirm.',
  onboardPoint1: 'Finds tickets and coupons that have expired',
  onboardPoint2: 'Groups repeated shots of the same screen',
  onboardPoint3: 'Tells you once a week how much space you can free',
  allowPhotos: 'Allow photo access',
  openSettings: 'Open Settings',
  deniedBody: 'Photo access is turned off. Turn on Photos for SnapSort in the Settings app.',
  limitedNote: 'Only some photos are shared with SnapSort. Allow full access to sort all screenshots.',
  changeAccess: 'Change access',
  screenshots: 'Screenshots',
  shotsCount: (n: number) => `${n}`,
  canFree: 'You can free up',
  reviewCta: (n: number) => `Review ${n} screenshots`,
  allClean: 'Nothing to clean up right now',
  allCleanSub: 'New screenshots are checked automatically',
  analyzing: (done: number, total: number) => `Sorting ${done}/${total}`,
  analyzingAi: (done: number, total: number) => `Reading with AI ${done}/${total}`,
  scanning: 'Looking for screenshots…',
  categories: 'By kind',
  withCode: 'With barcode or QR',
  searchPlaceholder: 'Search screenshots (shop, place…)',
  noResults: 'No matches',
  aiOffHint: 'Turn on AI sorting to recognise product pages, tickets and more',
  turnOn: 'Turn on',
  aiErrorKey: 'AI sorting stopped because the API key is not valid',
  aiErrorOther: 'AI sorting is unavailable for now. It will resume automatically',
  fix: 'Fix',
  reviewTitle: 'Clean up',
  reasonTitle: {
    expired: 'Expired',
    duplicate: 'Same screen, several shots',
    stale: 'Not looked at in a while',
  },
  reasonSub: {
    expired: 'Tickets, coupons and bookings whose date has passed',
    duplicate: 'The newest one is kept',
    stale: 'Older than the usual shelf life for their kind',
  },
  selectAll: 'Select all',
  selectNone: 'Select none',
  deleteN: (n: number, size: string) => `Delete ${n} (${size})`,
  nothingSelected: 'Select screenshots to delete',
  deletedToast: (n: number, size: string) => `Freed ${size} (${n} screenshots)`,
  deleteFailed: 'Could not delete. Please try again',
  iosTrashNote: 'Deleted screenshots stay in Photos › Recently Deleted for 30 days.',
  androidTrashNote: 'Deleting cannot be undone.',
  tapToView: 'Tap to select or unselect · long-press to view',
  keep: 'Keep',
  kept: 'Kept',
  keepHint: 'Kept screenshots are never suggested for cleanup',
  delete: 'Delete',
  category: 'Kind',
  changeCategory: 'Change kind',
  expires: (d: string) => `Valid until ${d}`,
  expired: (d: string) => `Expired on ${d}`,
  takenOn: (d: string) => `Taken on ${d}`,
  importantBadge: 'Looks important',
  codeBadge: 'Has code',
  unknownSize: '~',
  settings: 'Settings',
  sectionCleanup: 'Cleanup strength',
  strength: { gentle: 'Gentle', standard: 'Standard', tidy: 'Thorough' },
  strengthSub: {
    gentle: 'Keeps screenshots twice as long',
    standard: 'Uses the usual shelf life per kind',
    tidy: 'Suggests after half the usual time',
  },
  sectionReminder: 'Reminders',
  weeklyReminder: 'Weekly reminder',
  weeklyReminderSub: 'On Sunday evening, when there is something worth cleaning up',
  notifDenied: 'Notifications are off. Allow them in the Settings app.',
  sectionAi: 'AI sorting',
  aiToggle: 'Read screenshots with AI',
  aiToggleSub:
    'Sends a downscaled copy of each screenshot to Anthropic’s Claude API to find its kind, a title and any expiry date. Without it, barcode detection, duplicate detection and app-name sorting still run on your phone.',
  apiKey: 'Claude API key',
  apiKeyPlaceholder: 'sk-ant-…',
  apiKeySaved: 'Saved',
  save: 'Save',
  remove: 'Remove',
  reanalyze: 'Sort everything again',
  reanalyzeDone: 'Sorting again',
  shelfLifeTitle: 'Usual shelf life (standard)',
  days: (n: number) => `${n} days`,
  privacyTitle: 'Privacy',
  privacyBody:
    'With AI sorting off, screenshots never leave your phone. With it on, each unsorted screenshot is sent once. Things that look important (IDs, contracts…) are never suggested for cleanup.',
  notifTitle: 'Time to tidy your screenshots?',
  notifBody: (n: number, size: string, expired: number) =>
    expired > 0
      ? `${n} screenshots (${size}) can go, including ${expired} expired`
      : `${n} screenshots (${size}) can go`,
  notifChannel: 'Cleanup reminders',
  cancel: 'Cancel',
  done: 'Done',
};

export const t: Strings = lang === 'ja' ? ja : en;

const CATEGORY_LABELS: Record<Lang, Record<CategoryOrUnsorted, string>> = {
  ja: {
    ticket: 'チケット・予約',
    coupon: 'クーポン・会員証',
    shopping: '商品・買い物',
    receipt: '注文・支払い',
    chat: 'トーク・SNS',
    map: '地図・経路',
    info: '記事・メモ',
    tech: 'エラー・設定',
    other: 'その他',
    unsorted: '未分類',
  },
  en: {
    ticket: 'Tickets & bookings',
    coupon: 'Coupons & cards',
    shopping: 'Shopping',
    receipt: 'Orders & payments',
    chat: 'Chats & social',
    map: 'Maps & routes',
    info: 'Articles & notes',
    tech: 'Errors & settings',
    other: 'Other',
    unsorted: 'Unsorted',
  },
};

export function categoryLabel(id: CategoryOrUnsorted): string {
  return CATEGORY_LABELS[lang][id];
}

export function formatDate(msOrIso: number | string): string {
  const d =
    typeof msOrIso === 'number'
      ? new Date(msOrIso)
      : new Date(Number(msOrIso.slice(0, 4)), Number(msOrIso.slice(5, 7)) - 1, Number(msOrIso.slice(8, 10)));
  try {
    return d.toLocaleDateString(lang === 'ja' ? 'ja-JP' : undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return d.toDateString();
  }
}

export type { CategoryId };
