/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysUntil, parseFirstDate } from '../src/lib/dates.ts';
import { diffLines } from '../src/lib/diff.ts';
import { ruleBasedExtractor } from '../src/lib/extractor.ts';
import { findGlossaryTerms } from '../src/lib/glossary.ts';
import { detectDispute, findJudgementWords, isDisplayable } from '../src/lib/rules.ts';
import { SAMPLE_DOCS } from '../src/lib/samples.ts';

test('和暦と西暦の日付を読む', () => {
  assert.equal(parseFirstDate('納期限 令和8年10月31日'), '2026-10-31');
  assert.equal(parseFirstDate('令和元年5月1日'), '2019-05-01');
  assert.equal(parseFirstDate('２０２７年１月３１日までに'), '2027-01-31');
  assert.equal(parseFirstDate('2026/12/10'), '2026-12-10');
  assert.equal(parseFirstDate('2か月前までに'), null);
  assert.equal(daysUntil('2026-11-25', new Date(2026, 10, 22)), 3);
});

test('賃貸の見本から決めた項目を原文の位置つきで抜き出す', async () => {
  const doc = SAMPLE_DOCS[0];
  const r = await ruleBasedExtractor.extract(doc.text, doc.type);
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  const get = (k: string) => r.fields.find((f) => f.key === k)!;
  assert.equal(get('counterparty').value, 'みどり不動産株式会社');
  assert.equal(get('rent').value, '月額85,000円');
  assert.equal(get('deposit').value, '170,000円');
  for (const f of r.fields) {
    if (f.value === null) continue;
    assert.equal(doc.text.slice(f.source!.start, f.source!.end), f.value, `${f.label} の原文位置`);
  }
  assert.equal(r.counterparty, 'みどり不動産株式会社');
  const withDate = r.tasks.find((t) => t.dueDate === '2027-01-31');
  assert.ok(withDate, '期日つきのやることがある');
  assert.ok(r.tasks.some((t) => t.title.includes('2か月前までに') && t.dueDate === null));
});

test('4種類すべての見本で、見つかった項目は原文にそのままある', async () => {
  for (const doc of SAMPLE_DOCS) {
    const r = await ruleBasedExtractor.extract(doc.text, doc.type);
    assert.equal(r.kind, 'ok', doc.title);
    if (r.kind !== 'ok') continue;
    assert.ok(r.fields.filter((f) => f.value).length >= 3, `${doc.title} で3項目以上`);
    for (const f of r.fields) if (f.value) assert.ok(doc.text.includes(f.value));
    for (const t of r.tasks) assert.equal(doc.text.slice(t.source!.start, t.source!.end), t.title);
  }
});

test('見つからない項目は null にする', async () => {
  const r = await ruleBasedExtractor.extract('賃料：50,000円', 'rental');
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  assert.equal(r.fields.find((f) => f.key === 'deposit')!.value, null);
});

test('ルール4: もめごとの書類は要点化しない', async () => {
  assert.equal(detectDispute('内容証明郵便にて通知します'), '内容証明');
  const r = await ruleBasedExtractor.extract('督促状\n未払いの賃料をお支払いください', 'rental');
  assert.deepEqual(r, { kind: 'dispute', matched: '督促' });
});

test('評価・勧めの言葉は、原文の引用でなければ表示しない', () => {
  assert.deepEqual(findJudgementWords('この条項は不利です。解約すべきです'), ['不利', 'すべき']);
  assert.equal(isDisplayable('解約すべきです', '賃料：5万円'), false);
  assert.equal(isDisplayable('この特約は無効とする', '第5条 この特約は無効とする'), true);
  assert.equal(isDisplayable('月額85,000円', ''), true);
});

test('ルール2: 用語解説は固定文から原文に出る順で返す', () => {
  const terms = findGlossaryTerms('更新料は1か月分、敷金は2か月分');
  assert.deepEqual(terms.map((t) => t.term), ['更新料', '敷金']);
  assert.ok(terms.every((t) => t.text.includes('一般に')), '個別の当てはめをしない固定文');
});

test('ルール3: 前の版との字句の違いだけを出す', () => {
  const d = diffLines('賃料：85,000円\n敷金：170,000円', '賃料：88,000円\n敷金：170,000円\n更新料：1か月分');
  assert.equal(d[0].kind, 'changed');
  if (d[0].kind === 'changed') {
    assert.equal(d[0].parts.filter((p) => p.kind === 'removed').map((p) => p.text).join(''), '5');
    assert.equal(d[0].parts.filter((p) => p.kind === 'added').map((p) => p.text).join(''), '8');
  }
  assert.deepEqual(d[1], { kind: 'same', text: '敷金：170,000円' });
  assert.deepEqual(d[2], { kind: 'added', text: '更新料：1か月分' });
});

test('見本の書類の種類を推定できる', async () => {
  const { guessDocType } = await import('../src/lib/doc-types.ts');
  for (const doc of SAMPLE_DOCS) assert.equal(guessDocType(doc.text), doc.type, doc.title);
  assert.equal(guessDocType('こんにちは'), null);
});
