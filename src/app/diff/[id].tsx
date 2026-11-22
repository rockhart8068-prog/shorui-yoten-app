import { useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Notice, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatTimestamp } from '@/lib/dates';
import { diffLines } from '@/lib/diff';
import { historyOf, useStore } from '@/lib/store';

/** 前の版との字句の違い（ルール3：違いの意味づけはしない） */
export default function DiffScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { documents, plan } = useStore();
  const doc = documents.find((d) => d.id === id);
  const history = doc ? historyOf(documents, doc) : [];
  const index = history.findIndex((d) => d.id === id);
  const previous = index > 0 ? history[index - 1] : null;

  // 前の版との違いは有料プランの機能。要点画面のボタンを通らずにこの画面へ来ても出さない
  if (plan !== 'paid') {
    return (
      <Screen>
        <Notice>前の版との違いの表示は有料プランの機能です。</Notice>
      </Screen>
    );
  }

  if (!doc || !previous) {
    return (
      <Screen>
        <Notice>比べる前の版がありません。</Notice>
      </Screen>
    );
  }

  const lines = diffLines(previous.text, doc.text);
  const bg = { added: theme.added, removed: theme.removed, same: 'transparent' } as const;

  return (
    <Screen>
      <Notice>
        {formatTimestamp(previous.createdAt)}の版と{formatTimestamp(doc.createdAt)}の版で、字句が違うところに色をつけています。緑が増えた字、赤が消えた字です。
      </Notice>
      <Card>
        {lines.map((l, i) => (
          <View key={i}>
            {l.kind === 'changed' ? (
              <ThemedText type="small">
                {l.parts.map((p, j) => (
                  <Fragment key={j}>
                    <ThemedText
                      type="small"
                      style={{ backgroundColor: bg[p.kind], textDecorationLine: p.kind === 'removed' ? 'line-through' : 'none' }}>
                      {p.text}
                    </ThemedText>
                  </Fragment>
                ))}
              </ThemedText>
            ) : (
              <ThemedText
                type="small"
                style={{ backgroundColor: bg[l.kind], textDecorationLine: l.kind === 'removed' ? 'line-through' : 'none' }}>
                {l.text || ' '}
              </ThemedText>
            )}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
