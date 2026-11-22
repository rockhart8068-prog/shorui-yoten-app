import { useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Notice, Screen } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/dates';
import { diffLines } from '@/lib/diff';
import { historyOf, useStore } from '@/lib/store';

/** 前の版との字句の違い（ルール3：違いの意味づけはしない） */
export default function DiffScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { documents } = useStore();
  const doc = documents.find((d) => d.id === id);
  const history = doc ? historyOf(documents, doc) : [];
  const index = history.findIndex((d) => d.id === id);
  const previous = index > 0 ? history[index - 1] : null;

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
        {formatDate(previous.createdAt.slice(0, 10))}の版と{formatDate(doc.createdAt.slice(0, 10))}の版で、字句が違うところに色をつけています。緑が増えた字、赤が消えた字です。
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
