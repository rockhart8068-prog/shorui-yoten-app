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

test('ルール4: よくある督促・請求の言い回しは止める', () => {
  const demands = [
    'ご請求のお知らせ\nサンプル債権回収株式会社\n期日までにお支払いがない場合は、法的手続きに移行いたします。',
    '未払い料金のお支払いについて\nお支払いが確認できない場合、法的措置を講じることになります。',
    '重要なお知らせ\n2026年12月1日までにご入金がない場合は、やむを得ず法的措置を検討いたします。',
    '料金未納のお知らせ\n未納が続く場合、ご契約を解除し、債権回収会社へ委託いたします。',
    '通知書\n当社は貴殿に対し、損害賠償を請求いたします。',
    'お支払いのお願い\n至急ご連絡ください。ご連絡がない場合、しかるべき法的措置をとる所存です。',
    'ご連絡\n期日までにお支払いいただけない場合、裁判所に支払督促を申し立てます。',
    'ご請求書\n未払い料金について、当社顧問弁護士に委任いたしました。',
    '重要\nご入金がない場合、本件債権をサービサーへ譲渡いたします。',
    'ご案内\nお支払いが確認できない場合、法的措置をとる場合がございます。',
    '通知\n訴訟を提起する予定です。',
    '請求書\n山田様\n滞納家賃のお支払いがない場合、強制執行の手続きを行います。',
    '受任通知\n当職は、〇〇株式会社の代理人として、貴殿に対し未払金の支払いを求めます。',
    'ご連絡\n弊所は〇〇株式会社の代理人として、貴殿に未払金のお支払いを求めます。',
    'お知らせ\n未払いの利用料がございます。お支払いのない場合は、弁護士に回収を委任いたします。',
    '最終のご案内\nこれまで再三ご請求しておりますが、ご入金が確認できません。',
    'お支払いについて\nこれまで再三ご連絡しておりますが、ご入金が確認できておりません。',
    '最終のお知らせ\n未納の料金がございます。',
    '家賃滞納のお知らせ\n10月分・11月分の家賃のお支払いが確認できません。',
    'ご連絡\n12月5日までにご入金がない場合、保証会社へ代位弁済を請求し、契約解除の手続きに入ります。',
    'ご連絡\nお支払いが確認できないため、12月10日に回線を停止します。',
    '最終のお知らせ\n至急お支払いください。',
    'ご入金のお願い\nお支払期日を過ぎてもご入金が確認できておりません。至急お振込みください。',
    '建物明渡請求のご通知\n賃料不払いにより契約を解除しましたので、建物の明け渡しを求めます。',
    'ご連絡\n賃料不払いにより契約を解除しました。',
    '債権譲渡通知書\n〇〇株式会社は、貴殿に対する債権を当社へ譲渡しました。',
    'ご通知\n弁護士 山田花子\n当職は〇〇の代理人として本書を送付します。',
  ];
  for (const t of demands) assert.notEqual(detectDispute(t), null, t);
});

test('ルール4: 規約・契約書・行政の通知の決まり文句では止めない', () => {
  const ordinary = [
    'サンプル動画 利用規約\n第8条 不正利用が判明した場合、当社は法的措置をとらせていただきます。',
    'サービスのご案内\n不正利用が判明した場合、当社は法的措置をとらせていただきます。',
    'サンプル光 ご契約内容のご案内\n月額：4,980円\nお支払いが遅れた場合、法的措置をとることがあります。',
    'ご利用条件\n第1条 総則\n第2条 利用者が規約に違反したときは、当社は損害賠償を請求できる。',
    '建物賃貸借契約書\n第5条 借主は毎月末日までに賃料を支払う。\n第12条 借主が賃料を3か月滞納したときは、貸主は契約を解除し、法的措置をとる。',
    '令和8年度 固定資産税 納税通知書\nサンプル市長\n納期限までに納付がない場合は、差押えなどの滞納処分を行います。',
    '国民年金保険料の納付のお願い\n納付がない場合は、督促状を送付し、延滞金がかかることがあります。',
    'サンプル動画 利用規約\n最終更新日：2026年11月1日\n第1条 本規約は当社のサービスに適用します。\n第2条 利用者は代理人を通じて申し込むことができる。',
    '無料期間終了の最終のお知らせ\nサンプル動画プレミアム\n無料期間は2026年12月10日で終わり、自動的に有料会員に更新されます。ご請求額：990円',
    'ご請求金額のお知らせ\n11月分ご請求額：2,980円\nお支払期日：2026年12月26日\n期日までにお支払いください。',
    '解約受付のお知らせ\nご解約を受け付けました。12月31日をもってご契約を解除します。',
    '更新手続きの最終のお知らせ\n期限が近いため、至急お手続きください。',
    '解約のご案内\nお申し出により、12月31日をもってご契約を解除し、サービスを停止します。',
    '国民健康保険料 納入通知書\nサンプル市長\n納期限を過ぎると延滞金がかかることがあります。',
    '契約更新の最終のご案内\nみどり不動産株式会社\n更新を希望しない場合は2027年1月31日までにお申し出ください。',
    'マイナンバーカード申請のお願い\nサンプル市長\n再三のご案内となりますが、申請期限は令和9年3月31日です。',
    '賃貸借契約書\n第3条 借主は、代理人として配偶者を指定できる。\n第9条 紛争の際は各自弁護士に依頼することができる。',
  ];
  for (const t of ordinary) assert.equal(detectDispute(t), null, t);
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
  assert.equal(isDisplayable('この条項は消費者契約法に違反する可能性があります', 'x'), false);
  assert.equal(isDisplayable('早めに解約しましょう', 'x'), false);
  assert.equal(isDisplayable('この解約金は相場より高めです', 'x'), false);
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
