import { DOC_TYPES, type FieldDef } from './doc-types.ts';
import { parseFirstDate } from './dates.ts';
import { detectDispute } from './rules.ts';
import type { DocType, ExtractedField, ExtractionResult, TaskDraft } from './types.ts';

/**
 * 要点を抜き出す仕組みの入口。
 * いまは原文から決めた項目を探すだけのダミー（ルールベース）。
 * AIにつなぐときは同じ形の結果を返す実装に差し替える。
 */
export interface Extractor {
  extract(text: string, type: DocType): Promise<ExtractionResult>;
}

type Line = { text: string; start: number };

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let pos = 0;
  for (const t of text.split('\n')) {
    lines.push({ text: t, start: pos });
    pos += t.length + 1;
  }
  return lines;
}

/** 「項目：値」の形の行。項目名は短いものに限る */
const LABEL_LINE = /^(\s*)([^：:。、]{1,15})[：:]\s*(.*\S)\s*$/;

function found(def: FieldDef, line: Line, value: string, offset: number): ExtractedField {
  const start = line.start + offset;
  return { key: def.key, label: def.label, value, source: { start, end: start + value.length } };
}

function findField(lines: Line[], def: FieldDef, used: Set<number>): ExtractedField {
  // 1. 「項目：値」の形で、項目名に手がかりの語がある行を優先する（値の部分だけを原文のまま出す）
  for (const keyword of def.keywords) {
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      const line = lines[i];
      const m = line.text.match(LABEL_LINE);
      if (!m || !m[2].includes(keyword)) continue;
      used.add(i);
      return found(def, line, m[3], line.text.indexOf(m[3], m[1].length + m[2].length + 1));
    }
  }
  // 2. なければ、手がかりの語を含む文の行を丸ごと原文のまま出す。
  //    条文によく出る短い語（labelOnly）では探さず、別の項目の「項目：値」の行も取らない
  for (const keyword of def.keywords) {
    if (def.labelOnly?.includes(keyword)) continue;
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      const line = lines[i];
      if (!line.text.includes(keyword) || !line.text.trim() || LABEL_LINE.test(line.text)) continue;
      used.add(i);
      const value = line.text.trim();
      return found(def, line, value, line.text.indexOf(value));
    }
  }
  return { key: def.key, label: def.label, value: null, source: null };
}

/** 「までに」「期限」を含む文を、書面にある手続きとしてそのまま並べる */
function findTasks(text: string): TaskDraft[] {
  const tasks: TaskDraft[] = [];
  const sentence = /[^。\n]+(?:。|\n|$)/g;
  let m: RegExpExecArray | null;
  while ((m = sentence.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const body = raw.trim();
    if (body.length < 6) continue;
    const dueDate = parseFirstDate(body);
    // 期限のある手続き：「までに」「前まで」の文か、「期限」と日付がそろった文
    if (!/(までに|前まで)/.test(body) && !(/期限/.test(body) && dueDate)) continue;
    tasks.push({
      title: body,
      dueDate,
      source: { start: m.index + lead, end: m.index + lead + body.length },
      done: false,
      notify: true,
    });
  }
  return tasks;
}

export const ruleBasedExtractor: Extractor = {
  async extract(text, type) {
    const dispute = detectDispute(text);
    if (dispute) return { kind: 'dispute', matched: dispute };
    const lines = splitLines(text);
    const used = new Set<number>();
    const fields = DOC_TYPES[type].fields.map((def) => findField(lines, def, used));
    const counterparty = fields.find((f) => f.key === 'counterparty')?.value ?? null;
    return { kind: 'ok', counterparty, fields, tasks: findTasks(text) };
  },
};
