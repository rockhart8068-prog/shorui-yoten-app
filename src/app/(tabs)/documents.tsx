import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, Chip, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, parseFirstDate } from '@/lib/dates';
import { DOC_TYPE_LIST, DOC_TYPES } from '@/lib/doc-types';
import { historyOf, useStore } from '@/lib/store';
import type { DocType, StoredDocument, Task } from '@/lib/types';

/** 書類に書いてある日付のうち、今日以降で一番近いもの（更新日・期限での並べ替えに使う） */
function nextDate(doc: StoredDocument, tasks: Task[]): string | null {
  const today = new Date().toISOString().slice(0, 10);
  const dates = [
    ...tasks.filter((t) => t.docId === doc.id).map((t) => t.dueDate),
    ...doc.fields.map((f) => (f.value ? parseFirstDate(f.value) : null)),
  ].filter((d): d is string => !!d && d >= today);
  return dates.sort()[0] ?? null;
}

/** 画面5 書類一覧：検索、種類・相手先・更新日の絞り込み、同じ相手先の履歴 */
export default function DocumentsScreen() {
  const theme = useTheme();
  const { documents, tasks, plan, setPlan } = useStore();
  const [query, setQuery] = useState('');
  const [type, setType] = useState<DocType | null>(null);
  const [sort, setSort] = useState<'new' | 'date'>('new');
  const fullText = plan === 'paid';

  const list = useMemo(() => {
    const q = query.trim();
    const filtered = documents.filter((d) => {
      if (type && d.type !== type) return false;
      if (!q) return true;
      const target = [d.title, d.counterparty ?? '', fullText ? d.text : ''].join('\n');
      return target.includes(q);
    });
    const withDate = filtered.map((d) => ({ doc: d, next: nextDate(d, tasks) }));
    if (sort === 'date') withDate.sort((a, b) => (a.next ?? '9999').localeCompare(b.next ?? '9999'));
    return withDate;
  }, [documents, tasks, query, type, sort, fullText]);

  return (
    <Screen>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={fullText ? '本文・題名・相手先で検索' : '題名・相手先で検索（本文の検索は有料プラン）'}
        placeholderTextColor={theme.textSecondary}
        style={[styles.search, { color: theme.text, borderColor: theme.border }]}
      />
      <View style={styles.chips}>
        <Chip label="すべて" selected={type === null} onPress={() => setType(null)} />
        {DOC_TYPE_LIST.map((t) => (
          <Chip key={t.type} label={t.label} selected={type === t.type} onPress={() => setType(t.type)} />
        ))}
      </View>
      <View style={styles.chips}>
        <Chip label="取り込んだ順" selected={sort === 'new'} onPress={() => setSort('new')} />
        <Chip label="更新日・期限が近い順" selected={sort === 'date'} onPress={() => setSort('date')} />
      </View>

      <Section title={`${list.length}件`}>
        {list.length === 0 ? (
          <Notice>{documents.length === 0 ? 'まだ書類がありません。' : '条件に合う書類はありません。'}</Notice>
        ) : (
          list.map(({ doc, next }) => {
            const versions = historyOf(documents, doc).length;
            return (
              <Card key={doc.id} onPress={() => router.push(`/doc/${doc.id}`)}>
                <ThemedText type="smallBold">{doc.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {DOC_TYPES[doc.type].label}
                  {doc.counterparty ? ` ・ ${doc.counterparty}` : ''}
                  {versions > 1 ? ` ・ 同じ相手先の書類${versions}件` : ''}
                </ThemedText>
                {next && (
                  <ThemedText type="small" themeColor="textSecondary">
                    次の日付：{formatDate(next)}
                  </ThemedText>
                )}
              </Card>
            );
          })
        )}
      </Section>

      <Section title="プラン（開発中の切り替え）">
        <View style={styles.chips}>
          <Chip label="無料" selected={plan === 'free'} onPress={() => setPlan('free')} />
          <Chip label="有料（月額480円・年額4,800円）" selected={plan === 'paid'} onPress={() => setPlan('paid')} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          課金のしくみ（App Store・Google Playの定期購入）は次の版でつなぎます。
        </ThemedText>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
