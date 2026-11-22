/**
 * アプリとClaude APIのあいだの中継（Cloudflare Workers）。
 * APIキーはここ（Workerの秘密の環境変数）にだけ置き、アプリには入れない。
 *
 * POST /read     撮影した画像・PDFから、書いてある文字をそのまま書き起こす
 * POST /extract  書き起こした文から、種類ごとに決めた項目と期限のある手続きを「原文のまま」抜き出す
 *
 * 判断しないためのルール（企画書）はアプリ側と同じコードを使う。
 * ルール4：もめごとの書類は /extract で要点化しない（アプリ側でも先に止める）。
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

import { DOC_TYPES } from '../../src/lib/doc-types.ts';
import { detectDispute } from '../../src/lib/rules.ts';
import type { DocType } from '../../src/lib/types.ts';

export interface Env {
  ANTHROPIC_API_KEY: string;
  /** アプリと共有する合言葉。最初の版の簡易な保護（README参照） */
  APP_KEY: string;
}

const MODEL = 'claude-opus-5-5';
const MAX_BODY_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 10;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

const ReadRequest = z.object({
  files: z
    .array(
      z.object({
        mediaType: z.enum([...IMAGE_TYPES, 'application/pdf']),
        data: z.string().min(1),
      }),
    )
    .min(1)
    .max(MAX_FILES),
});

const ExtractRequest = z.object({
  type: z.enum(['rental', 'telecom', 'subscription', 'government']),
  text: z.string().min(1).max(200_000),
});

const READ_SYSTEM = [
  'あなたは書類の文字を書き起こす係です。',
  '渡された画像やPDFに書いてある日本語の文字を、書いてあるとおりに書き起こしてください。',
  '要約・言い換え・補足・意見は一切書かないでください。読めない字は「□」にしてください。',
  '行の区切りはなるべく元のとおりにし、ページが変わるところには空行を1つ入れてください。',
  '書き起こした文字だけを出力してください。',
].join('\n');

const EXTRACT_SYSTEM = [
  'あなたは書類から決められた項目を探す係です。判断や助言はしません。',
  '規則：',
  '1. 項目の値と手続きの文は、渡された本文の中の文字列をそのまま一字一句写してください。言い換え・要約・補足・書式の変更はしないでください。',
  '2. 本文に書いていない項目は出力しないでください。推測で埋めないでください。',
  '3. 有利・不利、有効・無効、すべきこと、おすすめなどの評価や勧めは書かないでください。',
  '4. 手続き（tasks）は、本文のうち「いつまでに何をするか」が書いてある1文を、そのまま写してください。',
].join('\n');

const ExtractionSchema = z.object({
  fields: z.array(z.object({ key: z.string(), quote: z.string() })),
  tasks: z.array(z.object({ quote: z.string() })),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

async function readText(client: Anthropic, files: z.infer<typeof ReadRequest>['files']): Promise<Response> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = files.map((f) =>
    f.mediaType === 'application/pdf'
      ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } }
      : { type: 'image', source: { type: 'base64', media_type: f.mediaType as ImageType, data: f.data } },
  );
  content.push({ type: 'text', text: 'この書類の文字を書き起こしてください。' });

  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium' },
    system: READ_SYSTEM,
    messages: [{ role: 'user', content }],
  });
  if (response.stop_reason === 'refusal') return json({ error: 'refused' }, 422);
  if (response.stop_reason === 'max_tokens') return json({ error: 'too_long' }, 413);
  const text = response.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return json({ text });
}

async function extract(client: Anthropic, type: DocType, text: string): Promise<Response> {
  // ルール4：もめごとの書類はAIに要点化させない
  const matched = detectDispute(text);
  if (matched) return json({ kind: 'dispute', matched });

  const defs = DOC_TYPES[type].fields;
  const fieldList = defs.map((d) => `- ${d.key}：${d.label}`).join('\n');
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'medium', format: betaZodOutputFormat(ExtractionSchema) },
    system: EXTRACT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          `書類の種類：${DOC_TYPES[type].label}`,
          `探す項目（key：項目名）：\n${fieldList}`,
          `本文：\n<document>\n${text}\n</document>`,
        ].join('\n\n'),
      },
    ],
  });
  if (response.stop_reason === 'refusal') return json({ error: 'refused' }, 422);
  if (!response.parsed_output) return json({ error: 'unparsed' }, 502);
  // 決めた項目以外は捨てる（ルール1）。原文にあるかの確認はアプリ側でも行う
  const keys = new Set(defs.map((d) => d.key));
  const fields = response.parsed_output.fields.filter((f) => keys.has(f.key) && text.includes(f.quote));
  const tasks = response.parsed_output.tasks.filter((t) => text.includes(t.quote));
  return json({ kind: 'ok', fields, tasks });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    if (!env.APP_KEY || request.headers.get('x-app-key') !== env.APP_KEY) return json({ error: 'unauthorized' }, 401);
    const length = Number(request.headers.get('content-length') ?? '0');
    if (length > MAX_BODY_BYTES) return json({ error: 'too_large' }, 413);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

    try {
      if (url.pathname === '/read') {
        const parsed = ReadRequest.safeParse(body);
        if (!parsed.success) return json({ error: 'bad_request' }, 400);
        return await readText(client, parsed.data.files);
      }
      if (url.pathname === '/extract') {
        const parsed = ExtractRequest.safeParse(body);
        if (!parsed.success) return json({ error: 'bad_request' }, 400);
        return await extract(client, parsed.data.type, parsed.data.text);
      }
      return json({ error: 'not_found' }, 404);
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 503);
      if (error instanceof Anthropic.BadRequestError) return json({ error: 'bad_request' }, 400);
      if (error instanceof Anthropic.APIError) return json({ error: 'upstream', status: error.status }, 502);
      return json({ error: 'internal' }, 500);
    }
  },
};
