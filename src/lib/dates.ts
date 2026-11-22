/** 和暦・西暦の日付を YYYY-MM-DD にする。読めなければ null */
const ERA_START: Record<string, number> = { 令和: 2018, 平成: 1988 };

const pad = (n: number) => String(n).padStart(2, '0');

function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

export const DATE_PATTERN = /(令和|平成)?\s*(\d{1,4}|元)\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日|(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/;

export function parseFirstDate(input: string): string | null {
  const s = toHalfWidth(input);
  const m = s.match(DATE_PATTERN);
  if (!m) return null;
  let y: number;
  let mo: number;
  let d: number;
  if (m[5]) {
    y = Number(m[5]);
    mo = Number(m[6]);
    d = Number(m[7]);
  } else {
    const yearNum = m[2] === '元' ? 1 : Number(m[2]);
    y = m[1] ? ERA_START[m[1]] + yearNum : yearNum;
    mo = Number(m[3]);
    d = Number(m[4]);
  }
  const iso = `${y}-${pad(mo)}-${pad(d)}`;
  if (y < 1900 || !isValidIsoDate(iso)) return null;
  return iso;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

/** 今日から何日後か（過ぎていれば負） */
export function daysUntil(iso: string, today = new Date()): number {
  const [y, m, d] = iso.split('-').map(Number);
  const target = Date.UTC(y, m - 1, d);
  const base = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((target - base) / 86400000);
}

/** 端末の時刻（日本なら日本時間）での日付を YYYY-MM-DD にする。toISOString は世界標準時なので、朝9時前は前の日になる */
export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 保存した日時（ISO形式）を、端末の時刻での「YYYY年M月D日」にする */
export function formatTimestamp(iso: string): string {
  return formatDate(localDate(new Date(iso)));
}

/** YYYY-MM-DD の形で、暦の上にある日付か（2月31日などは false） */
export function isValidIsoDate(s: string): boolean {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}
