import type { DocType } from './types.ts';

/**
 * 種類ごとに「決めた項目」だけを抜き出す（判断しないルール1）。
 * keywords は原文でその項目を探す手がかりの語。
 */
export type FieldDef = { key: string; label: string; keywords: string[] };

export type DocTypeDef = {
  type: DocType;
  label: string;
  fields: FieldDef[];
};

export const DOC_TYPES: Record<DocType, DocTypeDef> = {
  rental: {
    type: 'rental',
    label: '賃貸の契約',
    fields: [
      { key: 'counterparty', label: '貸主・管理会社', keywords: ['貸主', '管理会社', '甲'] },
      { key: 'property', label: '物件', keywords: ['物件', '所在地', '住所'] },
      { key: 'period', label: '契約期間', keywords: ['契約期間', '賃貸借期間', '期間'] },
      { key: 'rent', label: '賃料', keywords: ['賃料', '家賃'] },
      { key: 'commonFee', label: '共益費・管理費', keywords: ['共益費', '管理費'] },
      { key: 'deposit', label: '敷金', keywords: ['敷金', '保証金'] },
      { key: 'renewalFee', label: '更新料', keywords: ['更新料'] },
      { key: 'cancelNotice', label: '解約の申し出', keywords: ['解約', '退去'] },
    ],
  },
  telecom: {
    type: 'telecom',
    label: '携帯・ネット回線',
    fields: [
      { key: 'counterparty', label: '事業者', keywords: ['事業者', '提供者', '会社名'] },
      { key: 'plan', label: '料金プラン', keywords: ['料金プラン', 'プラン'] },
      { key: 'monthlyFee', label: '月額料金', keywords: ['月額', '基本料金', '月々'] },
      { key: 'period', label: '契約期間', keywords: ['契約期間', '最低利用期間'] },
      { key: 'cancelFee', label: '解約金', keywords: ['解約金', '違約金', '契約解除料'] },
      { key: 'autoRenewal', label: '自動更新', keywords: ['自動更新', '自動的に更新'] },
      { key: 'renewalMonth', label: '更新月', keywords: ['更新月', '更新期間'] },
    ],
  },
  subscription: {
    type: 'subscription',
    label: 'サブスクの契約',
    fields: [
      { key: 'counterparty', label: 'サービス・事業者', keywords: ['サービス名', '事業者', '提供者'] },
      { key: 'fee', label: '料金', keywords: ['月額', '年額', '利用料'] },
      { key: 'trial', label: '無料期間', keywords: ['無料期間', 'お試し', 'トライアル'] },
      { key: 'autoRenewal', label: '自動更新', keywords: ['自動更新', '自動的に更新'] },
      { key: 'nextRenewal', label: '次回更新日', keywords: ['次回更新', '更新日', '次回請求'] },
      { key: 'cancelMethod', label: '解約の方法', keywords: ['解約'] },
    ],
  },
  government: {
    type: 'government',
    label: '行政の通知',
    fields: [
      { key: 'counterparty', label: '差出元', keywords: ['差出', '発行', '市長', '区長', '町長', '村長', '税務署', '年金事務所'] },
      { key: 'subject', label: '件名', keywords: ['件名', 'について', 'のお知らせ'] },
      { key: 'deadline', label: '期限', keywords: ['提出期限', '納期限', '期限', 'までに'] },
      { key: 'amount', label: '金額', keywords: ['金額', '税額', '納付額', '保険料'] },
      { key: 'submitTo', label: '提出先・問い合わせ先', keywords: ['提出先', '問い合わせ', '問合せ', '窓口'] },
      { key: 'documents', label: '必要なもの', keywords: ['必要書類', '持ち物', '添付', '必要なもの'] },
    ],
  },
};

export const DOC_TYPE_LIST: DocTypeDef[] = Object.values(DOC_TYPES);

/** 無料プランで保管できる書類の数（企画書の仮の値） */
export const FREE_DOC_LIMIT = 10;

const TYPE_HINTS: Record<DocType, string[]> = {
  rental: ['賃貸', '賃料', '家賃', '敷金', '貸主', '借主', '物件'],
  telecom: ['回線', '携帯', 'スマホ', '通信', 'ギガ', 'MNP', '光', 'プロバイダ'],
  subscription: ['サブスク', '定期購入', '無料期間', 'トライアル', '配信', '会員'],
  government: ['市長', '区長', '町長', '村長', '税', '年金', '納期限', '役所', '令和'],
};

/** 本文から書類の種類を推定する。最後は利用者が確定する */
export function guessDocType(text: string): DocType | null {
  let best: DocType | null = null;
  let bestScore = 0;
  for (const [type, hints] of Object.entries(TYPE_HINTS) as [DocType, string[]][]) {
    const score = hints.filter((h) => text.includes(h)).length;
    if (score > bestScore) {
      best = type;
      bestScore = score;
    }
  }
  return best;
}
