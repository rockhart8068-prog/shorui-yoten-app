/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { daysUntil, isValidIsoDate, localDate, parseFirstDate } from '../src/lib/dates.ts';
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

test('条文に出てくる短い語を、別の項目として出さない', async () => {
  const text = '建物賃貸借契約書\n貸主：A不動産\n賃料：月額70,000円\n第15条 貸主が相当の期間を定めて催告したにもかかわらず支払わないときは、契約を解除できる。';
  const r = await ruleBasedExtractor.extract(text, 'rental');
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  assert.equal(r.fields.find((f) => f.key === 'period')!.value, null);
  assert.equal(r.fields.find((f) => f.key === 'cancelNotice')!.value, null);
});

test('「項目：値」の行を、手前の文より優先する', async () => {
  const text = '第3条 借主は敷金を預け入れる。\n敷金：賃料の2か月分';
  const r = await ruleBasedExtractor.extract(text, 'rental');
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  assert.equal(r.fields.find((f) => f.key === 'deposit')!.value, '賃料の2か月分');
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
  assert.equal(detectDispute('催告書\n貴殿に対し、未払い賃料の支払いを求めます。'), '催告');
  assert.equal(detectDispute('〇〇様\n本書到達後7日以内にお支払いください。'), '本書到達');
  assert.equal(detectDispute('ご連絡\nお支払いがない場合は法的措置をとらせていただきます。'), '法的措置');
  assert.equal(detectDispute('差押予告通知書\n滞納している市税について'), '差押');
  assert.equal(detectDispute('令和8年11月1日\n山田太郎 様\n督促状\nお支払いが確認できていません。'), '督促');
});

test('ルール4: 普通の契約書・通知にある条文や注意書きでは止めない', () => {
  const ordinary = [
    '建物賃貸借契約書\n貸主：A不動産\n第15条 借主が賃料の支払いを2か月以上怠り、貸主が相当の期間を定めて催告したにもかかわらず支払わないときは、契約を解除できる。\n第16条 借主が差押えを受けたときは解除できる。',
    'サービス名：B動画\n月額：990円\n第20条 本規約に関する紛争は東京地方裁判所を第一審の専属的合意管轄裁判所とします。\n第21条 当社は、違反があった場合、法的措置を講じることがあります。',
    '令和8年度 市民税 納税通知書\n差出：C市長\n納期限 令和8年10月31日\n納期限までに納付がない場合、督促状を送付し延滞金がかかります。',
    'ご契約内容\n事業者：Dモバイル\n料金のお支払いが遅れた場合、督促手数料がかかります。訴訟の費用は利用者の負担とします。',
  ];
  for (const t of ordinary) assert.equal(detectDispute(t), null, t.split('\n')[0]);
  for (const doc of SAMPLE_DOCS) assert.equal(detectDispute(doc.text), null, doc.title);
});

test('暦にない日付は読まない・保存しない', () => {
  assert.equal(parseFirstDate('2026年2月30日まで'), null);
  assert.equal(isValidIsoDate('2026-02-31'), false);
  assert.equal(isValidIsoDate('2028-02-29'), true);
  assert.equal(isValidIsoDate('2026-13-01'), false);
});

test('今日の日付は端末の時刻で数える（世界標準時にしない）', () => {
  assert.equal(localDate(new Date(2026, 10, 22, 7, 30)), '2026-11-22');
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

test('無料プランは10件まで、有料プランは無制限', async () => {
  const { canStoreAnother, FREE_DOC_LIMIT } = await import('../src/lib/doc-types.ts');
  assert.equal(FREE_DOC_LIMIT, 10);
  assert.equal(canStoreAnother('free', 9), true);
  assert.equal(canStoreAnother('free', 10), false);
  assert.equal(canStoreAnother('free', 12), false);
  assert.equal(canStoreAnother('paid', 500), true);
});
