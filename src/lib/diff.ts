/**
 * ルール3: 前の版との違いは字句の違いを示すだけにする（意味づけはしない）。
 * 行ごとに比べ、変わった行の組は文字ごとに比べる。
 */
export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string };

function lcsDiff(a: string[], b: string[]): DiffPart[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ kind, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push('same', a[i]);
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      push('removed', a[i++]);
    } else {
      push('added', b[j++]);
    }
  }
  while (i < n) push('removed', a[i++]);
  while (j < m) push('added', b[j++]);
  return out;
}

/** 文字単位の違い。長い文は計算量が大きいので行単位の比較と組み合わせて使う */
export function diffChars(before: string, after: string): DiffPart[] {
  return lcsDiff([...before], [...after]);
}

export type LineDiff =
  | { kind: 'same'; text: string }
  | { kind: 'added'; text: string }
  | { kind: 'removed'; text: string }
  | { kind: 'changed'; parts: DiffPart[] };

export function diffLines(before: string, after: string): LineDiff[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const parts = lcsDiff(
    a.map((l) => l + '\n'),
    b.map((l) => l + '\n'),
  );
  const result: LineDiff[] = [];
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    const next = parts[k + 1];
    const lines = (s: string) => s.replace(/\n$/, '').split('\n');
    if (p.kind === 'removed' && next?.kind === 'added') {
      const removed = lines(p.text);
      const added = lines(next.text);
      const pairs = Math.min(removed.length, added.length);
      for (let x = 0; x < pairs; x++) result.push({ kind: 'changed', parts: diffChars(removed[x], added[x]) });
      for (const t of removed.slice(pairs)) result.push({ kind: 'removed', text: t });
      for (const t of added.slice(pairs)) result.push({ kind: 'added', text: t });
      k++;
    } else {
      for (const t of lines(p.text)) result.push({ kind: p.kind, text: t });
    }
  }
  return result;
}
