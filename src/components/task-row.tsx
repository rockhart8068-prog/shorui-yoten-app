import { useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button, Card } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { daysUntil, formatDate, isValidIsoDate } from '@/lib/dates';
import { useStore } from '@/lib/store';
import type { Task } from '@/lib/types';

export function dueLabel(task: Task): string {
  if (!task.dueDate) return '期日が書面から読めません。期日を入れてください';
  const d = daysUntil(task.dueDate);
  const date = formatDate(task.dueDate);
  if (d < 0) return `${date}（${-d}日過ぎています）`;
  if (d === 0) return `${date}（今日）`;
  return `${date}（あと${d}日）`;
}

/** 書面にある手続きの1件。mode=candidate は書類画面での登録前の表示 */
export function TaskRow({ task, docTitle, onOpen, mode = 'registered' }: { task: Task; docTitle?: string; onOpen?: () => void; mode?: 'registered' | 'candidate' }) {
  const theme = useTheme();
  const { updateTask } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.dueDate ?? '');
  const valid = isValidIsoDate(draft);

  return (
    <Card>
      <View style={styles.row}>
        {mode === 'registered' && (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.done }}
            onPress={() => updateTask(task.id, { done: !task.done })}
            style={[styles.check, { borderColor: theme.accent, backgroundColor: task.done ? theme.accent : 'transparent' }]}>
            {task.done && <ThemedText style={{ color: theme.accentText, lineHeight: 20 }}>✓</ThemedText>}
          </Pressable>
        )}
        <Pressable style={{ flex: 1, gap: 2 }} onPress={onOpen} disabled={!onOpen} accessibilityRole={onOpen ? 'link' : undefined}>
          <ThemedText type="small" style={task.done ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}>
            {task.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {dueLabel(task)}
            {docTitle ? ` ・ ${docTitle}` : ''}
          </ThemedText>
        </Pressable>
      </View>

      {editing ? (
        <View style={styles.editRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="2026-12-31"
            placeholderTextColor={theme.textSecondary}
            inputMode="numeric"
            style={[styles.input, { color: theme.text, borderColor: valid || !draft ? theme.border : theme.warning }]}
          />
          <Button
            label="保存"
            disabled={!valid}
            onPress={() => {
              updateTask(task.id, { dueDate: draft });
              setEditing(false);
            }}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button">
            <ThemedText type="small" style={{ color: theme.accent }}>
              期日を{task.dueDate ? '直す' : '入れる'}
            </ThemedText>
          </Pressable>
          {mode === 'registered' ? (
            <View style={styles.notify}>
              <ThemedText type="small" themeColor="textSecondary">
                通知
              </ThemedText>
              <Switch value={task.notify} onValueChange={(v) => updateTask(task.id, { notify: v })} />
            </View>
          ) : (
            <Pressable onPress={() => updateTask(task.id, { registered: !task.registered })} accessibilityRole="button">
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                {task.registered ? '登録済み（取り消す）' : 'やることに登録'}
              </ThemedText>
            </Pressable>
          )}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two, alignItems: 'flex-start' },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.one },
  notify: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  editRow: { flexDirection: 'row', gap: Spacing.two, alignItems: 'center', marginTop: Spacing.one },
  input: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
});
