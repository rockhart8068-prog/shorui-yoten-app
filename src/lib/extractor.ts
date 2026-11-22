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

function findField(lines: Line[], def: FieldDef, used: Set<number>): ExtractedField {
  for (const keyword of def.keywords) {
    for (let i = 0; i < lines.length; i++) {
      if (used.has(i)) continue;
      const line = lines[i];
      if (!line.text.includes(keyword) || !line.text.trim()) continue;
      // 「項目：値」の形で項目名に手がかりの語があれば値の部分だけ、それ以外は行全体を原文のまま出す
      const m = line.text.match(LABEL_LINE);
      let value: string;
      let offset: number;
      if (m && m[2].includes(keyword)) {
        value = m[3];
        offset = line.text.indexOf(value, m[1].length + m[2].length + 1);
      } else {
        value = line.text.trim();
        offset = line.text.indexOf(value);
      }
      used.add(i);
      const start = line.start + offset;
      return { key: def.key, label: def.label, value, source: { start, end: start + value.length } };
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
