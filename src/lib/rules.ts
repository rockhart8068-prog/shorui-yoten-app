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
  '受任通知',
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
  { pattern: /(差押|差し押さえ)(え)?予告/, label: '差押' },
  { pattern: /支払督促(の)?(申立|申し立て)/, label: '督促' },
  // 弁護士・代理人からの受任通知や請求
  { pattern: /当職/, label: '代理人からの通知' },
  { pattern: /受任(通知|いたしました|しました|しております)/, label: '代理人からの通知' },
  { pattern: /代理人として[^。]*貴(殿|社|方)|貴(殿|社|方)[^。]*代理人として/, label: '代理人からの通知' },
  // 再三の請求・督促
  { pattern: /再三[^。]*(請求|督促|催促|ご連絡|お願い|お知らせ)/, label: '再三の請求' },
];

/** 題名の行にあれば督促とみなす言い回し（「最終更新日」などは含めない） */
const HEADING_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /最終(の)?(ご案内|お知らせ|通知|ご通知|ご請求|請求|通告|催告|警告|ご連絡)/, label: '最終のご案内' },
];

/**
 * 法的な手段に進むと告げる言い回し。文の中に見つかり、その文が「〜ことがあります」のような
 * 一般的な決まりの書き方でなければ、受け取った人への通告とみなす。
 */
const ESCALATION_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /法的(な)?(措置|手続き?|手段|処置)/, label: '法的措置' },
  { pattern: /(債権回収|サービサー|回収業者|回収代行)[^。]{0,12}(委託|委任|譲渡|依頼|移管|引き継)/, label: '債権回収' },
  { pattern: /支払督促|少額訴訟|民事調停/, label: '法的手続' },
  { pattern: /弁護士[^。]{0,15}(委任|依頼|委託|引き継)/, label: '弁護士への委任' },
  { pattern: /損害賠償(金)?(を|の)?(請求|支払)/, label: '損害賠償請求' },
  { pattern: /(訴訟|訴え|裁判)(を|の)?(提起|起こ|申し立て|申立)|提訴/, label: '訴訟' },
  { pattern: /(差押|差し押さえ)/, label: '差押' },
  { pattern: /強制執行/, label: '強制執行' },
];

/** 一般的な決まりとしての書き方（「〜ことがあります」「〜ものとします」）。この形の文は通告とみなさない */
const HEDGED = /(ことが(あります|ある|ございます)|場合が(あります|ある)|ことができ|できるものと|ものとします|ものとする|可能性が(あります|ある)|とします。?$|とする。?$)/;

/** 規約・契約書でよくある「違反・不正があったら」という一般的な条件。受け取った人個人への通告ではない */
const GENERAL_CONDITION = /(不正(な)?(利用|使用|行為|アクセス)|違反|禁止(事項|行為)|規約に(反|違反)|転売|著作権|迷惑行為|虚偽)/;

/** 受け取った人のいまの支払い遅れを指す語 */
const ARREARS = /(未払|未納|滞納|延滞|お支払いが(確認|ない|な[くかけ]|ありません|され)|ご?入金が(確認|ない|な[くかけ]|ありません)|お支払いいただけ(ない|ず)|支払いがない|再三|至急)/;

/** 行政の通知。納税通知書の「納付がない場合は差押えを行うことがあります」のような決まり文句が多いので、題名でだけ判定する */
const GOVERNMENT = /(市長|区長|町長|村長|知事|税務署|年金機構|役所|役場|国民年金|国民健康保険|市税|県税|都税|住民税|固定資産税)/;

/** 規約・契約書・契約内容の案内の形の書類か。題名の行が「〜規約」「〜契約書」で終わるか、条文が2つ以上ある */
function isContractLike(heading: string, text: string): boolean {
  const first = heading.split('\n')[0] ?? '';
  if (/(規約|約款|契約書|利用条件|重要事項説明書?|ご?契約内容(の(ご案内|お知らせ|ご確認))?)\s*$/.test(first)) return true;
  if (/本(規約|約款)/.test(text)) return true;
  const articles = text.split('\n').filter((l) => /^\s*第\s*[0-9０-９一二三四五六七八九十百]+\s*条/.test(l));
  return articles.length >= 2;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=。)|\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/**
 * 書類がもめごとの書類（督促状・催告書・内容証明など）なら、その手がかりの語を返す。
 * 1. 題名にあたる冒頭の行に「督促」「催告」「内容証明」などがある
 * 2. 「本書面到達後」「最終通告」「差押予告」など、通告にしか出ない言い回しがある
 * 3. 法的な手段に進むと告げる文（法的措置・債権回収会社への委託・損害賠償の請求・訴訟など）がある。ただし
 *    - 規約・契約書の形の書類の条文、行政の通知の決まり文句は、この判定に使わない
 *    - 「不正利用・違反があった場合」のような一般的な条件の文は使わない（支払い遅れを指していれば使う）
 *    - 「〜ことがあります」のようなぼかした書き方の文は、支払い遅れを指しているときだけ使う
 */
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
  const headingPattern = HEADING_PATTERNS.find((h) => h.pattern.test(heading));
  if (headingPattern) return headingPattern.label;

  const demand = DEMAND_PATTERNS.find((d) => d.pattern.test(text));
  if (demand) return demand.label;

  if (isContractLike(heading, text) || GOVERNMENT.test(text)) return null;

  for (const sentence of splitSentences(text)) {
    const hit = ESCALATION_PATTERNS.find((e) => e.pattern.test(sentence));
    if (!hit) continue;
    const arrears = ARREARS.test(sentence);
    if (GENERAL_CONDITION.test(sentence) && !arrears) continue;
    if (HEDGED.test(sentence) && !arrears) continue;
    return hit.label;
  }
  return null;
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
  '違反',
  'しましょう',
  '高め',
  '安め',
  '割高',
  '割安',
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
