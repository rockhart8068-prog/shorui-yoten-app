/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildFromQuotes } from '../src/lib/ai.ts';
import { SAMPLE_DOCS } from '../src/lib/samples.ts';

const rental = SAMPLE_DOCS.find((d) => d.type === 'rental')!;

test('AIの答えのうち、原文にそのままある値だけを位置つきで使う', () => {
  const r = buildFromQuotes(rental.text, 'rental', {
    fields: [
      { key: 'rent', quote: '月額85,000円' },
      { key: 'deposit', quote: '17万円' }, // 言い換えは捨てる
      { key: 'counterparty', quote: 'みどり不動産株式会社' },
    ],
    tasks: [{ quote: '更新を希望しない場合は、2027年1月31日までに管理会社へ申し出ること。' }],
  });
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  const get = (k: string) => r.fields.find((f) => f.key === k)!;
  assert.equal(get('rent').value, '月額85,000円');
  assert.equal(rental.text.slice(get('rent').source!.start, get('rent').source!.end), '月額85,000円');
  assert.equal(get('deposit').value, null, '原文に無い言い換えは「見つかりませんでした」');
  assert.equal(r.counterparty, 'みどり不動産株式会社');
  assert.equal(r.tasks.length, 1);
  assert.equal(r.tasks[0].dueDate, '2027-01-31');
});

test('ルール1：決めた項目以外のキーは使わない', () => {
  const r = buildFromQuotes(rental.text, 'rental', { fields: [{ key: 'advice', quote: '賃料' }], tasks: [] });
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  assert.ok(r.fields.every((f) => f.key !== 'advice'));
  assert.ok(r.fields.every((f) => f.value === null));
});

test('評価・勧めの文は、原文に無ければ出さない', () => {
  const r = buildFromQuotes(rental.text, 'rental', {
    fields: [{ key: 'cancelNotice', quote: '早めに解約すべきです' }],
    tasks: [{ quote: 'この条件は不利なので交渉しましょう' }],
  });
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  assert.equal(r.fields.find((f) => f.key === 'cancelNotice')!.value, null);
  assert.equal(r.tasks.length, 0);
});

test('ルール4：もめごとの書類は、AIの答えがあっても要点化しない', () => {
  const r = buildFromQuotes('督促状\n賃料が未払いです。至急お支払いください。', 'rental', {
    fields: [{ key: 'rent', quote: '賃料' }],
    tasks: [],
  });
  assert.equal(r.kind, 'dispute');
});

test('同じ文字列が2か所にあるときは、別々の箇所を指す', () => {
  const text = '賃料：月額5,000円\n共益費：月額5,000円';
  const r = buildFromQuotes(text, 'rental', {
    fields: [
      { key: 'rent', quote: '月額5,000円' },
      { key: 'commonFee', quote: '月額5,000円' },
    ],
    tasks: [],
  });
  assert.equal(r.kind, 'ok');
  if (r.kind !== 'ok') return;
  const a = r.fields.find((f) => f.key === 'rent')!.source!.start;
  const b = r.fields.find((f) => f.key === 'commonFee')!.source!.start;
  assert.notEqual(a, b);
});

test('期限の通知の予定：登録済み・未完了・通知オン・これからの日だけ、朝9時', async () => {
  const { planReminders } = await import('../src/lib/reminders.ts');
  const base = { docId: 'd1', source: null, title: '更新の申し出', registered: true, done: false, notify: true };
  const tasks = [
    { ...base, id: 'a', dueDate: '2026-12-10' },
    { ...base, id: 'b', dueDate: '2026-12-10', done: true },
    { ...base, id: 'c', dueDate: '2026-12-10', notify: false },
    { ...base, id: 'd', dueDate: '2026-12-10', registered: false },
    { ...base, id: 'e', dueDate: null },
    { ...base, id: 'f', dueDate: '2026-11-23' }, // 3日前はもう過ぎている
  ];
  const docs = [{ id: 'd1', type: 'rental' as const, title: '賃貸借契約書', counterparty: null, text: '', createdAt: '', fields: [] }];
  const plan = planReminders(tasks, docs, [3, 0], new Date(2026, 10, 22, 12, 0));
  assert.deepEqual(plan.map((r) => r.key), ['f:0', 'a:3', 'a:0']);
  const a3 = plan.find((r) => r.key === 'a:3')!;
  assert.equal(a3.date.getDate(), 7);
  assert.equal(a3.date.getHours(), 9);
  assert.equal(a3.body, '賃貸借契約書：更新の申し出');
});
