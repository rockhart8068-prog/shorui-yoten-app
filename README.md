# 書類の要点（仮）

賃貸・携帯/ネット回線・サブスクの契約書や行政の通知を取り込むと、書いてある要点を原文の箇所つきで示し、書面にある手続きと期限を「やること」として並べるスマホアプリです。企画書：「企画書：書類・規約の要点化とやること提案アプリ」（2026-11-22）。

Expo（React Native + TypeScript、Expo SDK 58、expo-router）で、iPhoneとAndroidの両方に出します。

## 試し方

```bash
npm install
npx expo start        # スマホの Expo Go でQRコードを読む
npx expo start --web  # ブラウザで見る
```

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
| 評価・勧めの言葉を出さない検査 | `src/lib/rules.ts`（`isDisplayable`）※AIをつなぐときに生成文へ適用する |

## いまの版でダミーのもの・まだのもの

- 要点の抜き出しは、AIではなく原文から項目名を探すルールベースのダミーです（`ruleBasedExtractor`）。AIにつなぐときは `Extractor` と同じ形の結果を返す実装に差し替えます。
- カメラ撮影とPDFの読み取りは、AIの読み取りをつなぐ版で入れます。今は文字の貼り付けと見本の書類で試せます。
- 期限のプッシュ通知（expo-notifications）、課金（App Store・Google Playの定期購入）、保存時の暗号化はまだです。プランの切り替えは書類一覧の画面に開発用として置いています。
- 無料プランの上限（10件）は企画書の仮の値です（`FREE_DOC_LIMIT`）。

## 確認

```bash
npm test           # 抜き出し・ルール・日付・違い表示のテスト
npm run typecheck
npm run lint
```
