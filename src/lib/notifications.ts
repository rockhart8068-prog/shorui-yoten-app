import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { planReminders } from './reminders';
import type { StoredDocument, Task } from './types';

const CHANNEL_ID = 'deadlines';
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

if (supported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function notificationPermission(ask: boolean): Promise<PermissionState> {
  if (!supported) return 'unsupported';
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted && perm.canAskAgain && ask) perm = await Notifications.requestPermissionsAsync();
  if (perm.granted) return 'granted';
  return perm.canAskAgain ? 'undetermined' : 'denied';
}

let running: Promise<void> = Promise.resolve();

/**
 * 予約済みの通知を作り直す。やること・プラン・通知設定が変わるたびに呼ぶ。
 * 通知を使うやることが1つでもあるときだけ、許可を求める。
 */
export function syncNotifications(tasks: Task[], documents: StoredDocument[], daysBefore: number[]): Promise<void> {
  if (!supported) return Promise.resolve();
  running = running
    .catch(() => {})
    .then(async () => {
      const plan = planReminders(tasks, documents, daysBefore);
      await Notifications.cancelAllScheduledNotificationsAsync();
      if (plan.length === 0) return;
      if ((await notificationPermission(true)) !== 'granted') return;
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: '期限のお知らせ',
          importance: AndroidImportance.DEFAULT,
        });
      }
      for (const r of plan) {
        await Notifications.scheduleNotificationAsync({
          identifier: r.key,
          content: { title: r.title, body: r.body, data: { docId: r.docId } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL_ID },
        });
      }
    });
  return running;
}

/** 最後にタップされた通知（その書類の要点画面を開くのに使う）。id は同じ通知で二度開かないための目印 */
export function useTappedNotification(): { id: string; docId: string } | null {
  const last = Notifications.useLastNotificationResponse();
  if (!supported || !last) return null;
  const docId = last.notification.request.content.data?.docId;
  if (typeof docId !== 'string') return null;
  return { id: `${last.notification.request.identifier}@${last.notification.date}`, docId };
}
