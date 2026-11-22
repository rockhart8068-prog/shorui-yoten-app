import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type ScrollViewInstance } from 'react-native';

import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Disclaimer, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/dates';
import { DOC_TYPES } from '@/lib/doc-types';
import { findGlossaryTerms } from '@/lib/glossary';
import { historyOf, useStore } from '@/lib/store';
import type { SourceSpan } from '@/lib/types';

/** 画面3 要点：書いてあることを原文つきで示す */
export default function DocumentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const { documents, tasks, plan, deleteDocument } = useStore();
  const scrollRef = useRef<ScrollViewInstance>(null);
  const originalY = useRef(0);
  const [selected, setSelected] = useState<SourceSpan | null>(null);

  const doc = documents.find((d) => d.id === id);
  if (!doc) {
    return (
      <Screen>
        <Notice>この書類は見つかりませんでした。</Notice>
      </Screen>
    );
  }

  const docTasks = tasks.filter((t) => t.docId === doc.id);
  const glossary = findGlossaryTerms(doc.text);
  const history = historyOf(documents, doc);
  const index = history.findIndex((d) => d.id === doc.id);
  const previous = index > 0 ? history[index - 1] : null;

  const jump = (span: SourceSpan | null) => {
    if (!span) return;
    setSelected(span);
    scrollRef.current?.scrollTo({ y: Math.max(0, originalY.current - 12), animated: true });
  };

  return (
    <>
      <Stack.Screen options={{ title: doc.title }} />
      <Screen scrollRef={scrollRef}>
        <Disclaimer />
        <ThemedText type="small" themeColor="textSecondary">
          {DOC_TYPES[doc.type].label} ・ {formatDate(doc.createdAt.slice(0, 10))}取り込み
        </ThemedText>

        <Section title="書いてあること（タップで原文の箇所へ）">
          {doc.fields.map((f) => (
            <Pressable key={f.key} onPress={() => jump(f.source)} disabled={!f.source} accessibilityRole="button">
              <View style={[styles.field, { borderBottomColor: theme.border }]}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.fieldLabel}>
                  {f.label}
                </ThemedText>
                <ThemedText type="small" style={[{ flex: 1 }, f.value ? undefined : { color: theme.textSecondary }]}>
                  {f.value ?? '見つかりませんでした（原文でご確認ください）'}
                </ThemedText>
              </View>
            </Pressable>
          ))}
        </Section>

        {glossary.length > 0 && (
          <Section title="用語の一般的な意味">
            {glossary.map((g) => (
              <Card key={g.term}>
                <ThemedText type="smallBold">{g.term}</ThemedText>
                <ThemedText type="small">{g.text}</ThemedText>
              </Card>
            ))}
          </Section>
        )}

        <Section title="書面にある手続きと期限">
          {docTasks.length === 0 ? (
            <Notice>期限のある手続きは見つかりませんでした。原文でご確認ください。</Notice>
          ) : (
            docTasks.map((t) => <TaskRow key={t.id} task={t} mode="candidate" onOpen={() => jump(t.source)} />)
          )}
        </Section>

        {history.length > 1 && (
          <Section title={`同じ相手先の書類（${history.length}件）`}>
            {history.map((h) => (
              <Card key={h.id} onPress={h.id === doc.id ? undefined : () => router.push(`/doc/${h.id}`)}>
                <ThemedText type="small">
                  {formatDate(h.createdAt.slice(0, 10))} ・ {h.title}
                  {h.id === doc.id ? '（この書類）' : ''}
                </ThemedText>
              </Card>
            ))}
            {previous &&
              (plan === 'paid' ? (
                <Button label="前の版との違いを見る" variant="secondary" onPress={() => router.push(`/diff/${doc.id}`)} />
              ) : (
                <Notice>前の版との違いの表示は有料プランの機能です。</Notice>
              ))}
          </Section>
        )}

        <View onLayout={(e) => (originalY.current = e.nativeEvent.layout.y)}>
          <Section title="原文">
            <Card>
              <ThemedText type="small" selectable>
                {selected ? (
                  <>
                    {doc.text.slice(0, selected.start)}
                    <ThemedText type="smallBold" style={{ backgroundColor: theme.highlight }}>
                      {doc.text.slice(selected.start, selected.end)}
                    </ThemedText>
                    {doc.text.slice(selected.end)}
                  </>
                ) : (
                  doc.text
                )}
              </ThemedText>
            </Card>
          </Section>
        </View>

        <Button
          label="この書類を削除"
          variant="secondary"
          onPress={() => {
            deleteDocument(doc.id);
            router.back();
          }}
        />
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  fieldLabel: { width: 110 },
});
