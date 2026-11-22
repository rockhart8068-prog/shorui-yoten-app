# 書類の要点（仮）

賃貸・携帯/ネット回線・サブスクの契約書や行政の通知を取り込むと、書いてある要点を原文の箇所つきで示し、書面にある手続きと期限を「やること」として並べるスマホアプリです。企画書：「企画書：書類・規約の要点化とやること提案アプリ」（2026-11-22）。

Expo（React Native + TypeScript、Expo SDK 58、expo-router）で、iPhoneとAndroidの両方に出します。

## 試し方

```bash
npm install
cp .env.example .env  # 中継サーバーの宛先や課金のキーを入れる（空なら下の「ダミーで動く部分」のとおり）
npx expo start --web  # ブラウザで見る（カメラ・通知・課金は動きません）
```

カメラ、通知、課金はスマホの専用の試用版アプリ（development build）で試します。Expo Go では動きません。

```bash
npx eas-cli@latest build --profile development --platform ios   # または android
npx expo start --dev-client
```

`app.json` の `bundleIdentifier` / `package`（いまは `com.example.shoruiyoten`）は、ストアに出す前に松さんのものに変えます。

## 画面（企画書の画面構成どおり）

| 画面 | ファイル |
| --- | --- |
| 1. ホーム | `src/app/(tabs)/index.tsx` |
| 2. 取り込み | `src/app/import.tsx` |
| 3. 要点 | `src/app/doc/[id].tsx`（前の版との違いは `src/app/diff/[id].tsx`） |
| 4. やること | `src/app/(tabs)/tasks.tsx` |
| 5. 書類一覧 | `src/app/(tabs)/documents.tsx` |

## 判断しないためのルールの置き場所

| ルール | 実装 |
| --- | --- |
| 1. 種類ごとに決めた項目だけを抜き出す | `src/lib/doc-types.ts`、`src/lib/extractor.ts` |
| 2. 用語解説はAIに書かせず固定文 | `src/lib/glossary.ts` |
| 3. 前の版との違いは字句だけ | `src/lib/diff.ts` |
| 4. もめごとの書類は要点化せず相談先を案内 | `src/lib/rules.ts`（`detectDispute`、`CONSULT_CONTACTS`） |
| 評価・勧めの言葉を出さない検査 | `src/lib/rules.ts`（`isDisplayable`）。AIの答えに `src/lib/ai.ts` の `buildFromQuotes` で適用 |

AIの答えは、原文の中にそのままある文字列だけを使います（`buildFromQuotes`）。言い換え、決めた項目以外、評価や勧めの文は捨てて「見つかりませんでした」にします。もめごとの書類はAIに送る前に止めます。

## 仕組み

| 部分 | 置き場所 |
| --- | --- |
| AIの中継サーバー（Cloudflare Workers、Claude API） | `server/`（設定は `server/README.md`） |
| 中継サーバーの自動配置 | `.github/workflows/deploy-server.yml`（main に入ると配置） |
| 撮影・写真・PDFの取り込み | `src/lib/capture.ts` |
| AIの呼び出しと答えの確認 | `src/lib/ai.ts` |
| 期限の通知（端末の中で予約） | `src/lib/reminders.ts`、`src/lib/notifications.ts` |
| 課金（RevenueCat、月額・年額） | `src/lib/billing.tsx`、`src/app/plan.tsx` |

## ダミーで動く部分・まだのもの

- `.env` に中継サーバーの宛先が無いときは、AIではなくルールベースのダミー（`ruleBasedExtractor`）で要点を出します。撮影・PDFのボタンも押せません。
- 課金のキーが無いとき（ブラウザ・未設定）は課金を使わず、開発中だけプランの画面に切り替えのボタンが出ます。
- 期限の通知は、期日の3日前の朝9時（有料は 当日・1・3・7・14・30日前から選べる）。端末の中で予約するので、サーバーは使いません。
- 保存時の暗号化はまだです。
- 無料プランの上限（10件）は企画書の仮の値です（`FREE_DOC_LIMIT`）。

## 確認

```bash
npm test           # 抜き出し・ルール・日付・違い表示・AIの答えの確認・通知の予定のテスト
npm run typecheck
npm run lint
cd server && npx tsc --noEmit   # 中継サーバーの型チェック
```
