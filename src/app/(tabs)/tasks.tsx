import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { TaskRow } from '@/components/task-row';
import { Chip, Notice, Screen, Section } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useStore } from '@/lib/store';
import type { Task } from '@/lib/types';

const byDue = (a: Task, b: Task) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');

/** 画面4 やること：期限つきの手続きを登録・完了する */
export default function TasksScreen() {
  const { tasks, documents } = useStore();
  const [showDone, setShowDone] = useState(false);
  const registered = tasks.filter((t) => t.registered);
  const open = registered.filter((t) => !t.done).sort(byDue);
  const done = registered.filter((t) => t.done).sort(byDue);
  const docTitle = (id: string) => documents.find((d) => d.id === id)?.title;
  const row = (t: Task) => <TaskRow key={t.id} task={t} docTitle={docTitle(t.docId)} onOpen={() => router.push(`/doc/${t.docId}`)} />;

  return (
    <Screen>
      <Notice>書面に書いてある手続きと期限をそのまま並べています。期日の通知は次の版でつなぎます。</Notice>
      <Section title={`これから（${open.length}件）`}>
        {open.length === 0 ? <Notice>登録したやることはありません。</Notice> : open.map(row)}
      </Section>
      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
        <Chip label={`完了したもの（${done.length}件）`} selected={showDone} onPress={() => setShowDone(!showDone)} />
      </View>
      {showDone && done.map(row)}
    </Screen>
  );
}
