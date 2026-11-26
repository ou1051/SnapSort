# SnapSort

**Screenshots pile up. SnapSort sorts them automatically and tells you which ones can go.**

SnapSort is an iPhone and Android app (Expo / React Native). It reads your screenshot album, works out what each screenshot *is* — a boarding pass, a product page, a chat, a map — and uses that to decide when it stops being useful. Once a week it tells you how much space you can free, and one tap takes you to a pre-selected list to delete.

> 日本語の概要は下にあります。

---

## What it automates

| Without SnapSort | With SnapSort |
| --- | --- |
| Scroll through hundreds of screenshots to find old ones | Suggestions are grouped by reason and pre-selected |
| Remember which tickets and coupons have expired | The AI reads the date; expired ones show up on the next day |
| Notice you took the same screen five times | Near-identical shots are grouped; the newest is kept |
| Remember to clean up at all | A weekly reminder, only when it is worth it |

### The pipeline

```
new screenshot
   │
   ├─ 1. File name hint (Android, free)     "Screenshot_…_Amazon.jpg" → Shopping
   ├─ 2. On-device checks (free, offline)   real file size · QR/barcode detection · perceptual hash
   ├─ 3. AI (optional, Claude API)          kind · short title · expiry date · "looks important"
   │
   ▼
cleanup engine (src/core/cleanup.ts) — one reason per screenshot:
   expired   → known expiry date has passed           (tickets, coupons, bookings)
   duplicate → same screen shot again within 2 min, or an identical screen any time
   stale     → older than the shelf life of its kind, and not opened in SnapSort since
   never     → favourites, screenshots you "Keep", things the AI marks as important
   │
   ▼
weekly reminder (Sunday 19:00) + background refresh every ~12 h
```

### Categories and shelf life

| Kind | Examples | Shelf life (standard) |
| --- | --- | --- |
| Tickets & bookings | boarding pass, train ticket, reservation | until the date, else 30 days |
| Coupons & cards | coupon, loyalty barcode, payment QR | until the date, else 60 days |
| Shopping | product page, price comparison | 30 days |
| Orders & payments | order confirmation, receipt, transfer | 120 days (returns, warranty) |
| Chats & social | messages, posts | 60 days |
| Maps & routes | directions, timetables | 14 days |
| Articles & notes | recipes, how-tos, read-later | 180 days |
| Errors & settings | error messages, settings screens | 30 days |
| Other | memes, everything else | 90 days |

"Gentle" doubles these, "Thorough" halves them. You can change a screenshot's kind by hand; the AI never overrides your choice.

### Why "not used" means "not opened in SnapSort"

Neither iOS nor Android tells apps when you last *looked* at a photo. SnapSort therefore measures age from the later of "taken" and "last opened in SnapSort", and you can mark anything as **Keep**. Opening a screenshot from the cleanup list does not count, so checking before deleting does not reset it.

---

## Demo video

[docs/SnapSort-demo.mp4](docs/SnapSort-demo.mp4) (40 s, no sound)

## Automation with n8n

The AI step can run in n8n: import [`n8n/snapsort-classify.json`](n8n/), add your Anthropic key as a Header Auth credential, activate, and paste the webhook URL into **Settings → AI sorting → n8n webhook URL**. The phone then never holds an API key. Details in [n8n/README.md](n8n/README.md).

## Try it in the browser

There is a browser demo that runs the real app code on 20 sample screenshots (no photo access, no API key, nothing leaves the page):

- **GitHub Pages:** https://ou1051.github.io/SnapSort/ (one-time setup: *Settings → Pages → Source: GitHub Actions*; every push then redeploys it)
- Locally: `npx expo start --web`
- As one self-contained HTML file: `npm run build:demo` → `dist-demo/index.html`

The demo lives in `src/services/demo.ts`; on the web the photo library, analysis and AI calls are swapped for these samples, and everything else is unchanged.

## Running it on your phone

SnapSort uses native modules (photo library, ML Kit barcode scanning, background tasks), so it needs a **development build**; Expo Go is not enough.

```bash
npm install
npx expo run:ios        # or: npx expo run:android   (needs Xcode / Android Studio)
# or build in the cloud and install on your phone:
npx eas-cli@latest build --profile development --platform ios
```

AI sorting is optional and off by default. To turn it on, create a key at [console.anthropic.com](https://console.anthropic.com), then in the app go to **Settings → AI sorting**, switch it on and paste the key. It is stored in the device keychain (expo-secure-store). The model is `claude-haiku-5-5` (set in `src/core/ai.ts`); each screenshot is downscaled to a 1400 px long edge and sent once.

```bash
npm test            # unit tests for the core logic (vitest)
npm run typecheck
npm run lint
```

## Project structure

```
src/
  core/        pure TypeScript, no React Native — unit tested
    categories.ts   kinds and shelf lives
    appHints.ts     Android file name → kind
    dhash.ts        perceptual hash + base64 decoder
    cleanup.ts      the suggestion engine
    ai.ts           Claude request + response validation
    merge.ts        syncing records with the photo library, search
    schedule.ts     next reminder time
  services/    device side
    library.ts      finding screenshots (iOS subtype / Android "Screenshots" albums), deleting
    analyze.ts      size, QR scan, hash, AI call
    store.ts        app state, work queue, persistence
    notifications.ts, background.ts, settings.ts, persist.ts
  app/         screens (Expo Router): home, review, category, shot, settings
  ui/          shared components
```

## Privacy

With AI sorting off, nothing leaves the phone. With it on, each screenshot that has not been sorted yet is sent once to Anthropic's API. The prompt tells the model never to copy passwords, card numbers or one-time codes into the searchable keywords. Screenshots that look important (IDs, contracts, recovery codes) are never suggested for cleanup.

## Known limits

- iOS decides when background tasks run (often overnight). The reminder text is refreshed whenever the app or the background task runs.
- iOS scans QR codes from images only; Android also detects 1D barcodes.
- On Android 11+, deleted screenshots are removed permanently after the system confirmation. On iOS they go to *Recently Deleted* for 30 days.
- With "limited" photo access, only the shared screenshots are sorted.

---

## 日本語の概要

スクショはすぐたまって容量を食います。SnapSortはスクショの中身（チケット、商品ページ、トーク、地図など）を自動で仕分けして、**もう要らなさそうなものを理由つきで提案**します。

- **期限切れ**：AIが読み取った日付（搭乗日・クーポン期限など）を過ぎたもの
- **同じ画面**：同じ画面を何枚も撮ったもの（一番新しい1枚を残す）
- **しばらく見ていない**：種類ごとの目安期間（例：地図は14日、注文確認は120日）を過ぎたもの
- お気に入り・「残す」にしたもの・AIが「大事そう」と判断したもの（身分証、契約書など）は候補にしない

週に一度（日曜19時）、片付けられる容量がたまっていれば通知し、タップすると選択済みのリストが開きます。削除は必ずOSの確認ダイアログを通ります。

AI仕分けはオプション（初期状態はオフ）。オフでも、端末内でバーコード/QR検出、重複検出、Androidのファイル名からのアプリ判定が動きます。
