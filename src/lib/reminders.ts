import { formatDate } from './dates.ts';
import type { StoredDocument, Task } from './types.ts';

/** 期限の何日前に知らせるか。無料は3日前のみ、有料は選べる（企画書：通知の細かい設定は有料） */
export const FREE_REMINDER_DAYS = [3];
export const REMINDER_DAY_CHOICES = [0, 1, 3, 7, 14, 30];
/** 知らせる時刻（端末の時刻で朝9時） */
export const REMINDER_HOUR = 9;
/** iOSは予約できる通知が64件まで。余裕を持って近いものから60件 */
export const MAX_SCHEDULED = 60;

export type Reminder = { key: string; taskId: string; docId: string; date: Date; title: string; body: string };

/** 登録済み・未完了・通知オンで期日のあるやることから、これから届ける通知の予定を作る */
export function planReminders(tasks: Task[], documents: StoredDocument[], daysBefore: number[], now = new Date()): Reminder[] {
  const out: Reminder[] = [];
  const days = [...new Set(daysBefore)].sort((a, b) => b - a);
  for (const t of tasks) {
    if (!t.registered || t.done || !t.notify || !t.dueDate) continue;
    const [y, m, d] = t.dueDate.split('-').map(Number);
    const doc = documents.find((x) => x.id === t.docId);
    for (const before of days) {
      const date = new Date(y, m - 1, d - before, REMINDER_HOUR, 0, 0);
      if (date.getTime() <= now.getTime()) continue;
      const when = before === 0 ? '今日が期日です' : `期日まであと${before}日です`;
      out.push({
        key: `${t.id}:${before}`,
        taskId: t.id,
        docId: t.docId,
        date,
        title: `${when}（${formatDate(t.dueDate)}）`,
        // 書面の文をそのまま出す（判断や勧めの言葉を足さない）
        body: doc ? `${doc.title}：${t.title}` : t.title,
      });
    }
  }
  out.sort((a, b) => a.date.getTime() - b.date.getTime());
  return out.slice(0, MAX_SCHEDULED);
}
