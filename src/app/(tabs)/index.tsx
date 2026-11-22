import { router } from 'expo-router';

import { TaskRow } from '@/components/task-row';
import { ThemedText } from '@/components/themed-text';
import { Button, Card, Notice, Screen, Section } from '@/components/ui';
import { daysUntil, formatTimestamp } from '@/lib/dates';
import { DOC_TYPES, FREE_DOC_LIMIT } from '@/lib/doc-types';
import { useStore } from '@/lib/store';

/** 画面1 ホーム：今日やることと作業の入口 */
export default function HomeScreen() {
  const { documents, tasks, plan, canAddDocument } = useStore();
  const upcoming = tasks
    .filter((t) => t.registered && !t.done && t.dueDate && daysUntil(t.dueDate) <= 30)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
    .slice(0, 3);
  const docTitle = (id: string) => documents.find((d) => d.id === id)?.title;

  return (
    <Screen>
      <Button label="書類を取り込む" onPress={() => router.push('/import')} disabled={!canAddDocument} />
      {!canAddDocument && (
        <Notice>無料プランで保管できるのは{FREE_DOC_LIMIT}件までです。有料プランにすると無制限になります。</Notice>
      )}
      {plan === 'free' && canAddDocument && (
        <ThemedText type="small" themeColor="textSecondary">
          無料プラン：{documents.length} / {FREE_DOC_LIMIT}件
        </ThemedText>
      )}

      <Section title="期限が近いやること（30日以内）">
        {upcoming.length === 0 ? (
          <Notice>期限が近いやることはありません。書類の要点画面で「やることに登録」すると、ここに出ます。</Notice>
        ) : (
          upcoming.map((t) => <TaskRow key={t.id} task={t} docTitle={docTitle(t.docId)} onOpen={() => router.push(`/doc/${t.docId}`)} />)
        )}
      </Section>

      <Section title="最近の書類">
        {documents.length === 0 ? (
          <Notice>まだ書類がありません。「書類を取り込む」から始めてください。</Notice>
        ) : (
          documents.slice(0, 3).map((d) => (
            <Card key={d.id} onPress={() => router.push(`/doc/${d.id}`)}>
              <ThemedText type="smallBold">{d.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {DOC_TYPES[d.type].label}
                {d.counterparty ? ` ・ ${d.counterparty}` : ''} ・ {formatTimestamp(d.createdAt)}取り込み
              </ThemedText>
            </Card>
          ))
        )}
      </Section>
    </Screen>
  );
}
