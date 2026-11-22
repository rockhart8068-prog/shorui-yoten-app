import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, View } from 'react-native';

import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Chip, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { notificationPermission, type PermissionState } from '@/lib/notifications';
import { REMINDER_DAY_CHOICES, REMINDER_HOUR } from '@/lib/reminders';
import { effectiveReminderDays, useStore } from '@/lib/store';
import type { Task } from '@/lib/types';

const byDue = (a: Task, b: Task) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
const dayLabel = (d: number) => (d === 0 ? '当日' : `${d}日前`);

/** 画面4 やること：期限つきの手続きを登録・完了する */
export default function TasksScreen() {
  const store = useStore();
  const { tasks, documents, plan, reminderDays, setReminderDays } = store;
  const [showDone, setShowDone] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  useFocusEffect(
    useCallback(() => {
      notificationPermission(false).then(setPermission).catch(() => {});
    }, []),
  );

  const registered = tasks.filter((t) => t.registered);
  const open = registered.filter((t) => !t.done).sort(byDue);
  const done = registered.filter((t) => t.done).sort(byDue);
  const docTitle = (id: string) => documents.find((d) => d.id === id)?.title;
  const row = (t: Task) => <TaskRow key={t.id} task={t} docTitle={docTitle(t.docId)} onOpen={() => router.push(`/doc/${t.docId}`)} />;
  const days = effectiveReminderDays(store);

  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d];
    if (next.length > 0) setReminderDays(next);
  };

  return (
    <Screen>
      <Notice>書面に書いてある手続きと期限をそのまま並べています。</Notice>
      <Section title={`これから（${open.length}件）`}>
        {open.length === 0 ? <Notice>登録したやることはありません。</Notice> : open.map(row)}
      </Section>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Chip label={`完了したもの（${done.length}件）`} selected={showDone} onPress={() => setShowDone(!showDone)} />
      </View>
      {showDone && done.map(row)}

      <Section title="期限の通知">
        {permission === 'unsupported' ? (
          <Notice>この環境（ブラウザ）では通知を送れません。スマホのアプリでお使いください。</Notice>
        ) : permission === 'denied' ? (
          <>
            <Notice>通知が許可されていません。設定アプリで「書類の要点」の通知をオンにしてください。</Notice>
            <Button label="設定を開く" variant="secondary" onPress={() => Linking.openSettings()} />
          </>
        ) : null}
        <ThemedText type="small" themeColor="textSecondary">
          通知をオンにしたやることを、期日の{days.map(dayLabel).join('・')}の朝{REMINDER_HOUR}時にお知らせします。
        </ThemedText>
        {plan === 'paid' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two }}>
            {REMINDER_DAY_CHOICES.map((d) => (
              <Chip key={d} label={dayLabel(d)} selected={reminderDays.includes(d)} onPress={() => toggleDay(d)} />
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            お知らせする日を選べるのは有料プランです。
          </ThemedText>
        )}
      </Section>
    </Screen>
  );
}
