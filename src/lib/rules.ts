/**
 * 判断しないためのルール（企画書「判断しないためのルール」）をコードにしたもの。
 */

/** ルール4: もめごとの書類を見分ける語。見つかったら要点化せず相談先を案内する */
export const DISPUTE_KEYWORDS = [
  '内容証明',
  '督促',
  '催告',
  '訴訟',
  '訴状',
  '裁判所',
  '法的措置',
  '法的手続',
  '差押',
  '差し押さえ',
  '最終通告',
  '和解',
  '損害賠償請求',
];

export function detectDispute(text: string): string | null {
  return DISPUTE_KEYWORDS.find((w) => text.includes(w)) ?? null;
}

export const CONSULT_CONTACTS = [
  { name: '消費生活センター（消費者ホットライン）', detail: '電話 188（いやや）', url: 'https://www.caa.go.jp/policies/policy/local_cooperation/local_consumer_administration/hotline/' },
  { name: '法テラス', detail: '電話 0570-078374', url: 'https://www.houterasu.or.jp/' },
  { name: '弁護士（日本弁護士連合会の相談窓口）', detail: 'お近くの弁護士会の法律相談', url: 'https://www.nichibenren.or.jp/legal_advice/' },
];

/**
 * 評価・勧めの言葉。AIなどが「新しく作った文」に含まれていたら表示しない。
 * 原文にそのまま書いてある文言の引用は、事実の抜き出しなので表示してよい。
 */
export const JUDGEMENT_WORDS = [
  '不利',
  '有利',
  '無効',
  '違法',
  'すべき',
  'するべき',
  'した方がよい',
  'したほうがよい',
  'おすすめ',
  'お勧め',
  '推奨',
  '注意が必要',
  '危険',
  '損です',
  '得です',
];

export function findJudgementWords(text: string): string[] {
  return JUDGEMENT_WORDS.filter((w) => text.includes(w));
}

/** 生成された文を表示してよいか。原文の中にそのままある文は引用として許す */
export function isDisplayable(generated: string, sourceText: string): boolean {
  if (sourceText.includes(generated)) return true;
  return findJudgementWords(generated).length === 0;
}

export const DISCLAIMER = '法的な判断や助言は行いません。最終確認は原文でしてください。';
