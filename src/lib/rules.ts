/**
 * 判断しないためのルール（企画書「判断しないためのルール」）をコードにしたもの。
 */

/**
 * ルール4: もめごとの書類を見分ける。見つかったら要点化せず相談先を案内する。
 *
 * 「催告」「裁判所」「差押え」「督促」などの語は、普通の契約書や通知にも条文や注意書きとして出てくる
 * （例：賃貸借契約の解除条項の「催告」、利用規約の合意管轄の「裁判所」、納税通知書の「督促状を送付します」）。
 * 本文のどこかにあるだけで止めると、対象の4種類のほとんどが要点化できなくなるため、
 * 1. 書類の題名にあたる冒頭の行にもめごとの語がある
 * 2. 本文に、受け取った人への請求・通告だとわかる言い回しがある
 * のどちらかのときだけ、もめごとの書類とみなす。
 */
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
  '請求書兼通知書',
  '通知書兼請求書',
];

/**
 * 題名を探す範囲。督促状などは日付や宛名の行が先に来ることがあるので冒頭の5行（空行は数えない）を見るが、
 * 条文や長い文は題名ではないので外す。
 */
const HEADING_LINES = 5;
const HEADING_MAX_LENGTH = 25;
const isHeadingLine = (l: string) => l.length <= HEADING_MAX_LENGTH && !/^第\s*[0-9０-９一二三四五六七八九十百]+\s*条/.test(l) && !l.includes('。');

/** 受け取った人に向けた請求・通告の言い回し。本文のどこにあってももめごとの書類とみなす */
const DEMAND_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /本書(面)?(が)?(到達|到着|受領)/, label: '本書到達' },
  { pattern: /最終通告/, label: '最終通告' },
  { pattern: /内容証明郵便(にて|により|で)(通知|請求|催告)(いた)?(し|します|する)/, label: '内容証明' },
  { pattern: /法的(措置|手続き?|手段)(を|に)(とら|取ら|講じ|移行し|着手し|執ら)(せて)?(いただき)?ます/, label: '法的措置' },
  { pattern: /(差押|差し押さえ)(え)?(を)?(予告|執行いたします|執行します|に着手)/, label: '差押' },
  { pattern: /(訴訟|訴え)を提起(いた)?(し|します)/, label: '訴訟' },
  { pattern: /支払督促(の)?(申立|申し立て)/, label: '督促' },
];

export function detectDispute(text: string): string | null {
  const heading = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, HEADING_LINES)
    .filter(isHeadingLine)
    .join('\n');
  const inHeading = DISPUTE_KEYWORDS.find((w) => heading.includes(w));
  if (inHeading) return inHeading;
  return DEMAND_PATTERNS.find((d) => d.pattern.test(text))?.label ?? null;
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
