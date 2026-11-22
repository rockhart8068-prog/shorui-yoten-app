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
  if (y < 1900 || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
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
