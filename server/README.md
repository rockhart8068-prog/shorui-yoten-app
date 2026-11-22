# 中継サーバー（Cloudflare Workers）

アプリとClaude APIのあいだに置く小さなサーバーです。Claude APIキーはここだけに置き、アプリには入れません。

| 宛先 | 役割 |
| --- | --- |
| `POST /read` | 撮影した画像（JPEG/PNG/WebP）やPDFの文字を、書いてあるとおりに書き起こす |
| `POST /extract` | 書き起こした文から、種類ごとに決めた項目と期限のある手続きを、原文のまま抜き出す |

判断しないためのルールはアプリと同じコード（`../src/lib/rules.ts`、`../src/lib/doc-types.ts`）を使います。`/extract` はもめごとの書類（ルール4）を要点化せず `{"kind":"dispute"}` を返し、原文にそのまま無い値や決めた項目以外のキーは捨てます。アプリ側でも同じ確認をもう一度します（`src/lib/ai.ts` の `buildFromQuotes`）。

モデルは `claude-opus-5-5` です。安全のための判定で断られたときは、別のモデルで自動的にやり直す設定（`fallbacks: "default"`）を入れています。

## はじめての設定（松さん向け）

1. [Cloudflare](https://dash.cloudflare.com/sign-up) の無料アカウントを作る
2. [Claude Console](https://console.anthropic.com/) でAPIキーを作る（使った分だけの従量課金です。月の上限額も設定できます）
3. このフォルダで次を実行する

```bash
cd server
npm install
npx wrangler login                       # ブラウザでCloudflareにログイン
npx wrangler secret put ANTHROPIC_API_KEY  # 2. のキーを貼り付ける
npx wrangler secret put APP_KEY            # アプリと共有する合言葉（長い適当な文字列）
npx wrangler deploy                      # 表示された https://…workers.dev が宛先
```

4. アプリ側の `.env`（`.env.example` をコピー）に宛先と合言葉を入れる

```
EXPO_PUBLIC_API_URL=https://shorui-yoten-server.<あなたのサブドメイン>.workers.dev
EXPO_PUBLIC_APP_KEY=<3. で入れた合言葉>
```

## 注意（公開前に見直すこと）

- 合言葉（`APP_KEY`）はアプリの中に入るので、取り出そうと思えば取り出せます。最初の版の簡易な保護です。一般公開の前に、Cloudflare のレート制限（Rate Limiting rules）で1台あたりの回数を絞るか、端末の正当性確認（App Attest / Play Integrity）を足してください。
- 書類の画像と文字はClaude APIに送られます。Claude APIに送った内容は、既定ではモデルの学習に使われません。プライバシーポリシーには「読み取りのためにAnthropic社のAPIへ送る」ことを書いてください。
- 1回の送信は20MBまで、画像は10枚までです。
