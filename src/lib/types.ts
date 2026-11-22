/** 最初の版で扱う書類の種類（企画書で決定した4種類） */
export type DocType = 'rental' | 'telecom' | 'subscription' | 'government';

/** 原文の中の位置（文字の開始位置と終了位置） */
export type SourceSpan = { start: number; end: number };

/** 種類ごとに決めた項目の1つ。見つからなければ value と source は null */
export type ExtractedField = {
  key: string;
  label: string;
  value: string | null;
  source: SourceSpan | null;
};

/** 書面にある手続きと期限 */
export type Task = {
  id: string;
  docId: string;
  title: string;
  /** YYYY-MM-DD。書面から読めなければ null（利用者が入れる） */
  dueDate: string | null;
  /** 書面の該当箇所 */
  source: SourceSpan | null;
  /** やること一覧に登録したか（書類画面で利用者が登録する） */
  registered: boolean;
  done: boolean;
  notify: boolean;
};

export type TaskDraft = Omit<Task, 'id' | 'docId' | 'registered'>;

export type StoredDocument = {
  id: string;
  type: DocType;
  title: string;
  counterparty: string | null;
  text: string;
  createdAt: string;
  fields: ExtractedField[];
};

/** 取り込み結果。もめごとの書類なら要点化しない */
export type ExtractionResult =
  | { kind: 'ok'; counterparty: string | null; fields: ExtractedField[]; tasks: TaskDraft[] }
  | { kind: 'dispute'; matched: string };
