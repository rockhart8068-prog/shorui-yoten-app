import { DOC_TYPES } from './doc-types.ts';
import { parseFirstDate } from './dates.ts';
import type { Extractor } from './extractor.ts';
import { detectDispute, isDisplayable } from './rules.ts';
import type { DocType, ExtractedField, ExtractionResult, TaskDraft } from './types.ts';

/** AIが返す形。値はすべて原文からそのまま写した文字列（quote） */
export type AiQuotes = {
  fields: { key: string; quote: string }[];
  tasks: { quote: string }[];
};

/** 撮影・PDFの1ページ分 */
export type ReadFile = { mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf'; data: string };

/**
 * AIの答えを、判断しないためのルールに沿って要点にする。
 * - ルール1：種類ごとに決めた項目だけを使い、原文にそのまま無い値は捨てて「見つかりませんでした」にする
 * - 評価・勧めの言葉が入った文は、原文の引用でなければ出さない（isDisplayable）
 * - 原文の位置（source）はここで計算するので、要点をタップすると原文の箇所が光る
 */
export function buildFromQuotes(text: string, type: DocType, ai: AiQuotes): ExtractionResult {
  const dispute = detectDispute(text);
  if (dispute) return { kind: 'dispute', matched: dispute };

  const usedStarts = new Set<number>();
  const locate = (quote: string): { start: number; end: number } | null => {
    const q = quote.trim();
    if (!q || !isDisplayable(q, text)) return null;
    let from = 0;
    let at = text.indexOf(q, from);
    // 同じ文字列が何度も出るときは、まだ使っていない箇所を指す
    while (at >= 0 && usedStarts.has(at)) {
      from = at + 1;
      at = text.indexOf(q, from);
    }
    if (at < 0) at = text.indexOf(q);
    if (at < 0) return null;
    usedStarts.add(at);
    return { start: at, end: at + q.length };
  };

  const fields: ExtractedField[] = DOC_TYPES[type].fields.map((def) => {
    for (const f of ai.fields) {
      if (f.key !== def.key) continue;
      const source = locate(f.quote);
      if (source) return { key: def.key, label: def.label, value: f.quote.trim(), source };
    }
    return { key: def.key, label: def.label, value: null, source: null };
  });

  const seen = new Set<string>();
  const tasks: TaskDraft[] = [];
  for (const t of ai.tasks) {
    const q = t.quote.trim();
    if (!q || seen.has(q) || !isDisplayable(q, text)) continue;
    const start = text.indexOf(q);
    if (start < 0) continue;
    seen.add(q);
    tasks.push({ title: q, dueDate: parseFirstDate(q), source: { start, end: start + q.length }, done: false, notify: true });
  }
  tasks.sort((a, b) => a.source!.start - b.source!.start);

  const counterparty = fields.find((f) => f.key === 'counterparty')?.value ?? null;
  return { kind: 'ok', counterparty, fields, tasks };
}

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';
const APP_KEY = process.env.EXPO_PUBLIC_APP_KEY ?? '';

/** 中継サーバーの宛先が設定されていればAIを使う。無ければルールベースのダミーで動く */
export const aiAvailable = API_URL.length > 0;

export class AiError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-app-key': APP_KEY },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiError('network');
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new AiError(data.error ?? `http_${res.status}`);
  return data;
}

/** 撮影した画像・PDFの文字を書き起こす（読み取り結果は利用者が確認してから要点にする） */
export async function readDocument(files: ReadFile[]): Promise<string> {
  const { text } = await post<{ text: string }>('/read', { files });
  return text;
}

export const aiExtractor: Extractor = {
  async extract(text, type) {
    // ルール4：もめごとの書類はAIに送らずに止める
    const dispute = detectDispute(text);
    if (dispute) return { kind: 'dispute', matched: dispute };
    const res = await post<({ kind: 'ok' } & AiQuotes) | { kind: 'dispute'; matched: string }>('/extract', { type, text });
    if (res.kind === 'dispute') return res;
    return buildFromQuotes(text, type, res);
  },
};

export function aiErrorMessage(e: unknown): string {
  const code = e instanceof AiError ? e.code : 'internal';
  switch (code) {
    case 'network':
      return 'つながりませんでした。電波のよいところでもう一度お試しください。';
    case 'too_large':
    case 'too_long':
      return '書類が大きすぎます。ページを分けて取り込んでください。';
    case 'busy':
      return '混み合っています。少し待ってからもう一度お試しください。';
    case 'refused':
      return 'この書類は読み取れませんでした。';
    default:
      return '読み取りに失敗しました。もう一度お試しください。';
  }
}
